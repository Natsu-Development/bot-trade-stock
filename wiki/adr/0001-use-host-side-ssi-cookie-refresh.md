---
title: "ADR 0001: Use host-side SSI cookie refresh"
tags: ["ssi", "ssi-quote", "ssi-qoute", "cookies", "cloudflare", "flaresolverr", "sighup", "stock-alert", "runbook"]
created: 2026-05-22T07:40:10.215Z
updated: 2026-05-22T07:40:10.215Z
sources: ["scripts/ssi-bypass/README.md", "backend/infrastructure/provider/sources/ssi_quote.go", "backend/infrastructure/credentials/env_store.go"]
links: ["providers-and-resilience.md", "jobs-and-scheduling.md"]
category: decision
confidence: high
schemaVersion: 1
---

# ADR 0001: Use host-side SSI cookie refresh

## Status
Accepted.

## Context
The `ssi-quote` real-time quote API is Cloudflare-protected. The bot needs fresh Cloudflare cookies, but cookie minting is operational/browser-automation machinery rather than core trading-domain logic.

## Decision
Keep cookie minting outside the Go bot. A host-side systemd timer runs FlareSolverr through `refresh-cookies.sh`, writes `/etc/bot-trade/ssi.env` atomically, then sends `SIGHUP` to the `trading-bot` container. The Go process only reloads and consumes the credential snapshot.

## Rejected alternatives
- Hardcoded cookies: rejected because Cloudflare cookies expire and cause production drift.
- In-bot FlareSolverr/Playwright refresh logic: rejected because it couples the trading bot to browser-automation infrastructure.
- Reactive refresh-on-403 inside the provider: rejected because the current design treats minting as host-side ops and keeps the bot's 403 behavior observable.

## Consequences
- Production needs FlareSolverr plus the systemd timer/service installed.
- Operators must preserve the `/etc/bot-trade` directory mount so atomic env-file replacement is visible inside the container.
- The bot can reload cookies without restart.
- `/health` SSI fields are not currently implemented; use logs/systemd and provider telemetry unless code changes.

## Implementation flow

## Scope / naming
This page documents the `ssi-quote` real-time quote flow. The user typo `ssi-qoute` should map to `ssi-quote`. The provider label is `ssi-quote` in `backend/infrastructure/provider/sources/ssi_quote.go`.

## Runtime flow
1. Host systemd timer `scripts/ssi-bypass/systemd/bot-trade-cookie-refresh.timer` fires at 08:50 and 12:50 Asia/Ho_Chi_Minh on Monday-Friday.
2. Timer runs `scripts/ssi-bypass/systemd/bot-trade-cookie-refresh.service`.
3. Service executes `/opt/bot-trade/scripts/ssi-bypass/refresh-cookies.sh /etc/bot-trade/ssi.env --reload-target=docker` with `DOCKER_BOT_CONTAINER=trading-bot` and `FLARESOLVERR_URL=http://127.0.0.1:8191/v1`.
4. `refresh-cookies.sh` calls FlareSolverr for `https://iboard.ssi.com.vn/`, extracts `cf_clearance`, `__cf_bm`, `_cfuvid`, and `solution.userAgent`, writes `/etc/bot-trade/ssi.env` atomically with mode 600 semantics, then sends `docker kill -s HUP trading-bot`.
5. The Go bot SIGHUP handler in `backend/cmd/server/main.go` calls `app.ReloadCredentials()` and logs `event=ssi credentials reloaded`, `result=success|failure`, duration, and `minted_at` on success.
6. `backend/wire/wire.go` delegates reload to `a.infra.CredStore.Reload()`.
7. `backend/infrastructure/credentials/env_store.go` re-parses the env file and atomically swaps an `atomic.Pointer[SSICredentials]`. On parse failure the old snapshot is preserved.
8. `SSIQueryProvider.fetchExchange` in `backend/infrastructure/provider/sources/ssi_quote.go` snapshots current credentials per exchange request, builds a fresh per-call cookie jar, seeds non-empty CF cookies for `.ssi.com.vn`, sets browser-like headers plus the minted User-Agent, and fetches iboard-query endpoints.
9. `FetchAllQuotes` fetches HOSE/HNX/UPCOM in parallel and returns a symbol-keyed `MarketQuote` map.
10. `backend/application/jobs/alert/stock_alert_job.go` calls `quoteProvider.FetchAllQuotes(ctx)` each tick, evaluates configured alerts, notifies Telegram, and auto-disables fired conditions.

## Key files
- `scripts/ssi-bypass/refresh-cookies.sh` — mints SSI Cloudflare cookies via FlareSolverr, validates `cf_clearance`, prints diagnostics, writes env vars, and optionally signals bot reload.
- `scripts/ssi-bypass/verify-bypass.sh` — smoke test that mints cookies and immediately curls `https://iboard-query.ssi.com.vn/stock/group/HOSE` with the same UA/cookie string.
- `scripts/ssi-bypass/systemd/bot-trade-cookie-refresh.{timer,service}` — production refresh schedule and reload service.
- `docker/docker-compose.prod.yml` — runs `trading-bot`, mounts `/etc/bot-trade:/etc/bot-trade:ro`, and runs `flaresolverr` bound to `127.0.0.1:8191`.
- `config/production.env` — sets `SSI_CREDENTIALS_ENV_PATH=/etc/bot-trade/ssi.env`.
- `scripts/vps-setup.sh` — seeds placeholder `/etc/bot-trade/ssi.env` so production config can pass startup until timer replaces it.
- `scripts/deploy-vps.sh` — installs ssi-bypass scripts and systemd timer; verifies `/etc/bot-trade/ssi.env` has `SSI_CF_CLEARANCE`.
- `backend/config/config.go` — requires `SSI_CREDENTIALS_ENV_PATH` only when `ENVIRONMENT=production`.
- `backend/wire/infra.go` — in production constructs `credentials.NewEnvCredentialStore`; in non-production leaves the credential store unset so dev does not load cookie-refresh code.
- `backend/infrastructure/credentials/env_store.go` — strict env-file parser plus atomic hot-reload store.
- `backend/cmd/server/main.go` — SIGHUP reload path; SIGINT/SIGTERM remain shutdown signals.
- `backend/infrastructure/provider/sources/ssi_quote.go` — actual `ssi-quote` real-time quote provider and per-call cookie/header usage.
- `backend/application/jobs/alert/stock_alert_job.go` — downstream consumer of quote map for stock alert evaluation.

## Env file contract
The refresh script writes:

```env
SSI_USER_AGENT="..."
SSI_CF_CLEARANCE="..."
SSI_CF_BM="..."
SSI_CF_UVID="..."
SSI_COOKIES_MINTED_AT="2026-05-22T00:00:00+00:00"
```

Current parser requirements in `env_store.go`:
- Required and non-empty: `SSI_USER_AGENT`, `SSI_CF_CLEARANCE`, `SSI_CF_BM`, `SSI_COOKIES_MINTED_AT`.
- `SSI_CF_UVID` is parsed but currently not required; its required-key entry is commented out.
- `SSI_COOKIES_MINTED_AT` accepts `time.RFC3339` and non-colon offset layout `2006-01-02T15:04:05-0700`.

## SSI quote request details
`SSIQueryProvider` uses:
- base URL `https://iboard-query.ssi.com.vn`
- paths `/stock/exchange/hose`, `/stock/exchange/hnx`, `/stock/exchange/upcom`
- provider metric label `ssi-quote`
- per-call `cookiejar.Jar`, not a shared mutable jar
- shallow-copied HTTP client to preserve retry transport while attaching the per-call jar
- `LastForbiddenAt()` telemetry updated when a fetch returns `contract.ErrForbidden`

Headers intentionally mimic browser top-level navigation. Do not casually alter `Accept`, `Accept-Language`, `Sec-Ch-Ua`, `Sec-Fetch-*`, `Upgrade-Insecure-Requests`, or User-Agent handling; comments say Cloudflare may reject valid `cf_clearance` if the request fingerprint drifts.

## Important gotchas
- Mount `/etc/bot-trade` as a directory, not `/etc/bot-trade/ssi.env` as a file. `refresh-cookies.sh` writes via `mv`, replacing the inode; a single-file bind mount would keep the container pinned to stale cookies even after SIGHUP.
- The bot does not know how to mint cookies. FlareSolverr and refresh scheduling are host-side only; the Go process only reads env snapshots and reloads them on SIGHUP.
- Reload failure is non-fatal: `EnvCredentialStore.Reload` preserves the previous credential snapshot and the SIGHUP handler logs failure.
- `ssi-quote` is not part of the OHLCV `ProviderPool`; it is a standalone real-time quote adapter wired into the stock-alert job.
- Current code mismatch: `scripts/ssi-bypass/README.md` mentions `GET /health -> ssi.cookies_minted_at` and `ssi.last_403_at`, but current `backend/presentation/http/router.go` returns only `{status, timestamp}`. Treat SSI health fields as deferred/not implemented unless code changes.
- Prometheus credential reload counters mentioned in the runbook/plan are not visible in current code; current observability is systemd journal plus bot reload logs and provider metrics/`LastForbiddenAt` in code.

## Manual verification commands
```bash
bash /opt/bot-trade/scripts/ssi-bypass/verify-bypass.sh
sudo systemctl start bot-trade-cookie-refresh.service
journalctl -u bot-trade-cookie-refresh.service -f
docker logs trading-bot | grep 'ssi credentials reloaded'
```

For local repo validation of the code path:
```bash
cd backend && go test ./infrastructure/credentials ./infrastructure/provider/sources ./application/jobs/alert
```

## Related pages
- [Market data providers and resilience](../providers-and-resilience.md)
- [Jobs and scheduling](../jobs-and-scheduling.md)
