# SSI Cloudflare bypass — production runbook

Keeps the `cf_clearance` cookie that `bot-trade` needs to call SSI's `iboard-query` API fresh, without restarting the bot.

## Contract

The bot does **not** know how cookies are minted. It only reads `/etc/bot-trade/ssi.env` on startup and on SIGHUP. Everything in this directory is host-side machinery that maintains that file.

```
host systemd timer  ──fires──▶  refresh-cookies.sh
                                       │
                                       ▼
                                FlareSolverr (127.0.0.1:8191)
                                       │
                                       ▼
                          /etc/bot-trade/ssi.env  (atomic write, mode 600)
                                       │
                                       ▼
                          docker kill -s HUP trading-bot
                                       │
                                       ▼
                          bot SIGHUP handler → atomic.Pointer swap
```

## Components

| Component | Lives in | Purpose |
|---|---|---|
| FlareSolverr | `docker/docker-compose.prod.yml` (`flaresolverr` service, `127.0.0.1:8191`) | Headless-Chrome proxy that solves Cloudflare and returns fresh cookies |
| `refresh-cookies.sh` | this directory | Calls FlareSolverr, writes env file atomically, signals the bot container |
| `systemd/bot-trade-cookie-refresh.{timer,service}` | this directory | Schedules refresh at 08:50 / 12:50 ICT, Mon–Fri |
| `verify-bypass.sh` | this directory | Ad-hoc smoke test — mints cookies and curls SSI in the same shell |

## Schedule

Two refreshes per VN trading day:

- **08:50 ICT** — 10 min before HOSE morning session opens at 09:00
- **12:50 ICT** — 10 min before HOSE afternoon session opens at 13:00

The 10-minute pre-roll guarantees the new snapshot is in the bot's `atomic.Pointer` before the first fetch of the session (FlareSolverr mints take ~3-5s).

## Install

```bash
# 1. Make sure FlareSolverr is running (it's now in the prod compose stack)
cd /opt/bot-trade/docker
docker compose -f docker-compose.prod.yml up -d flaresolverr

# 2. Verify it can mint cookies for SSI from this VPS
bash /opt/bot-trade/scripts/ssi-bypass/verify-bypass.sh
# Expected: "PASS: real JSON payload returned"

# 3. Create the env directory the script writes to
sudo mkdir -p /etc/bot-trade
sudo chown bot-trade:bot-trade /etc/bot-trade
sudo chmod 755 /etc/bot-trade

# 4. Bootstrap the env file once so the bot can start
sudo bash /opt/bot-trade/scripts/ssi-bypass/refresh-cookies.sh \
     /etc/bot-trade/ssi.env --reload-target=none

# 5. Install the systemd units
sudo cp /opt/bot-trade/scripts/ssi-bypass/systemd/bot-trade-cookie-refresh.{timer,service} \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bot-trade-cookie-refresh.timer

# 6. Confirm the schedule
systemctl list-timers bot-trade-cookie-refresh.timer

# 7. Verify the SIGHUP delivery path (one-time, catches Dockerfile wrapper bugs)
docker exec trading-bot ps -o pid,comm 1
# Expected: PID 1 is the bot binary, NOT 'sh' or 'tini'. If a wrapper holds
# PID 1 without exec'ing the bot, SIGHUP from the cookie-refresh service
# gets swallowed and reloads fail silently.

docker logs trading-bot 2>&1 | grep 'signal handler registered' | tail -1
# Expected: pid=1, signals include SIGHUP.

# Smoke-test the signal path end-to-end:
docker kill -s HUP trading-bot
docker logs --tail 5 trading-bot 2>&1 | grep 'ssi credentials reloaded'
# Expected: a fresh "ssi credentials reloaded" line within ~1s. The result
# may be "failure" if the env file isn't bootstrapped yet — that still
# proves the SIGHUP handler fired, which is what this step verifies.
```

## Verify

```bash
# Trigger a refresh now (out-of-schedule)
sudo systemctl start bot-trade-cookie-refresh.service

# Watch the script run
journalctl -u bot-trade-cookie-refresh.service -f

# Confirm the bot ingested the new cookies
docker logs --tail 20 trading-bot 2>&1 | grep 'ssi credentials reloaded' | tail -1 | jq .
# Expected: result="success", minted_at within the last few seconds.
```

## Operational monitoring

All operational signal lives in `docker logs trading-bot` (already scraped into Loki by `monitoring/alloy/config.alloy`). No `/health` extension, no Prometheus counter — the bot's structured zap logs are the single source of truth.

| Where to look | What you're checking |
|---|---|
| `docker logs trading-bot \| grep 'ssi credentials reloaded'` | Per-reload outcome — JSON fields `result` (`success`/`failure`), `duration_ms`, `minted_at`, and `error` on failure |
| `docker logs trading-bot \| grep -iE 'ssi.*(403\|forbidden)'` | Downstream symptom of stale cookies. Fires even when the refresh timer dies silently (no `reloaded` line at all) — this is the safety-net signal |
| `systemctl status bot-trade-cookie-refresh.service` *(VPS, on demand)* | Last script run exit status. Use when bot logs show stale-cookie 403s with no recent `reloaded` line |
| `journalctl -u bot-trade-cookie-refresh.service` *(VPS, on demand)* | Script-side error detail (FlareSolverr unreachable, no `cf_clearance`, env-file write failures). Only reached for the script half; the bot-side reload outcome is in `docker logs` |
| `docker logs flaresolverr` | Cloudflare solver errors (rare; usually a CF update) |

**Alarm rules (Loki, using the existing Docker scrape):**

- **Primary — reload failed:**
  `{container="trading-bot"} |= "ssi credentials reloaded" | json | result="failure"`
  Catches env-file parse errors, missing keys, store-swap failures.
- **Backstop — stale-cookie symptom in the bot:**
  `{container="trading-bot"} |~ "(?i)ssi.*(403|forbidden)"`
  Catches every other failure mode (timer didn't fire, script crashed before SIGHUP, SIGHUP eaten by Docker wrapper) — the bot eventually hits SSI with stale cookies and surfaces the 403 in its logs.

Do **not** set a staleness threshold yet — real `cf_clearance` TTL is unknown; observe production for one to two weeks first, then tune.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `journalctl -u bot-trade-cookie-refresh.service` shows `FlareSolverr not reachable` | FlareSolverr container down | `docker compose -f docker-compose.prod.yml up -d flaresolverr` |
| Script exits with `no cf_clearance in returned cookies` | Cloudflare hardened the challenge | Try again in a few minutes; if persistent, swap image to `21hsmw/flaresolverr:nodriver` (drop-in tag swap) |
| `docker logs trading-bot \| grep 'ssi credentials reloaded' \| tail -1` shows an old `minted_at` after a successful script run | Bot container missed SIGHUP | Re-run the §Install step 7 verification: confirm `docker exec trading-bot ps -o pid,comm 1` is the bot binary at PID 1, and that `DOCKER_BOT_CONTAINER=trading-bot` matches in the service unit |
| `Reload()` failing with `parse MintedAt` errors | Script timestamp format drift | The script writes `SSI_COOKIES_MINTED_AT` via `date -Iseconds`; check it produces RFC3339 with TZ offset on your distro |
| 403/forbidden lines in `docker logs trading-bot` appear between 09:00 and 12:50 ICT | `cf_clearance` TTL shorter than 4h | Add a mid-morning refresh (e.g., `OnCalendar=Mon..Fri *-*-* 10:50:00 Asia/Ho_Chi_Minh`) |

## Manual rollback

If the systemd timer needs to be disabled (e.g., investigating issues):

```bash
sudo systemctl disable --now bot-trade-cookie-refresh.timer
# Cookies will go stale. Refresh manually with:
sudo bash /opt/bot-trade/scripts/ssi-bypass/refresh-cookies.sh \
     /etc/bot-trade/ssi.env --reload-target=docker
```
