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
```

## Verify

```bash
# Trigger a refresh now (out-of-schedule)
sudo systemctl start bot-trade-cookie-refresh.service

# Watch the script run
journalctl -u bot-trade-cookie-refresh.service -f

# Confirm the bot picked up the new cookies
curl -s http://localhost:8080/health | jq .ssi
# Expected: cookies_minted_at is "just now"
```

## Operational monitoring

| Where to look | What you're checking |
|---|---|
| `GET /health` → `ssi.cookies_minted_at` | Last successful reload inside the bot |
| `GET /health` → `ssi.last_403_at` | When the bot last observed an SSI 403 (null = never) |
| Prometheus `ssi_credential_reloads_total{result="failure"}` | Reload failures (env-file parse errors, missing keys) |
| `journalctl -u bot-trade-cookie-refresh.service` | Script logs (FlareSolverr errors, atomic-write issues) |
| `docker logs flaresolverr` | Cloudflare solver errors (rare; usually a CF update) |

**Alarm rule (initial):** alert on `ssi_credential_reloads_total{result="failure"}` increase. Do **not** set a staleness threshold yet — real `cf_clearance` TTL is unknown; observe `last_403_at` patterns in production for one to two weeks first, then set a `cookies_age_seconds` threshold based on observed expiry.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `journalctl` shows `FlareSolverr not reachable` | FlareSolverr container down | `docker compose -f docker-compose.prod.yml up -d flaresolverr` |
| Script exits with `no cf_clearance in returned cookies` | Cloudflare hardened the challenge | Try again in a few minutes; if persistent, swap image to `21hsmw/flaresolverr:nodriver` (drop-in tag swap) |
| `/health` shows old `cookies_minted_at` after a successful script run | Bot container missed SIGHUP | Check the bot logs for "ssi credentials reloaded"; verify `DOCKER_BOT_CONTAINER=trading-bot` in the service unit |
| `Reload()` failing with `parse MintedAt` errors | Script timestamp format drift | The script writes `SSI_COOKIES_MINTED_AT` via `date -Iseconds`; check it produces RFC3339 with TZ offset on your distro |
| `last_403_at` populated between 09:00 and 12:50 ICT | `cf_clearance` TTL shorter than 4h | Add a mid-morning refresh (e.g., `OnCalendar=Mon..Fri *-*-* 10:50:00 Asia/Ho_Chi_Minh`) |

## Manual rollback

If the systemd timer needs to be disabled (e.g., investigating issues):

```bash
sudo systemctl disable --now bot-trade-cookie-refresh.timer
# Cookies will go stale. Refresh manually with:
sudo bash /opt/bot-trade/scripts/ssi-bypass/refresh-cookies.sh \
     /etc/bot-trade/ssi.env --reload-target=docker
```
