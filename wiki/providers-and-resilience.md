---
title: "Market data providers and resilience"
tags: ["providers", "resilience", "ssi", "operations"]
created: 2026-05-22
updated: 2026-05-22
sources: ["docs/providers-and-resilience.md"]
category: debugging
confidence: high
schemaVersion: 1
---

# Market data providers & resilience

The bot fetches OHLCV bars and quotes from multiple Vietnamese brokers (SSI, Vietcap, VPS).
Resilience is layered: HTTP retry transport → adaptive token bucket → health tracking →
round-robin failover.

## Provider pool (`infrastructure/provider/pool.go`)

`ProviderPool` implements `MarketGateway` and `StockLister`. `FetchData` round-robins across
providers, skipping unhealthy ones, and tries each provider at most once before returning
`all providers failed for symbol` (`:50-74`). `ErrNoData` is treated as "symbol legitimately
has no data" — it triggers failover without logging an error and without penalizing the
provider's RPS (`:63`, and `wrapper.go:66-68`).

`ListAllStocks` uses the **primary** provider only and requires it to implement `StockLister`
via type assertion (`:78-91`).

## Adaptive rate limiting (`infrastructure/provider/token_bucket.go`)

A classic token bucket with an AIMD-style dynamic refill rate:
- Grows by 1.1× after 10 consecutive successes, gated by a 2s cooldown; the streak is preserved if cooldown blocks the bump (`:98-128`).
- Shrinks by 0.7× on **any** failure (429/5xx/timeout/network), floored at 1 RPS, with no cooldown — backoff is immediate (`:133-151`).
- Initial/max RPS come from `DEFAULT_PROVIDER_RPS` / `MAX_PROVIDER_RPS`.

## Health tracking & metrics (`infrastructure/provider/wrapper.go`)

`WrappedProvider.FetchObserved` wraps each call with metrics + bucket gating (`:43-78`):
- success → `OnSuccess`, mark healthy;
- `ErrNoData` → no-op (healthy, failover);
- `ErrRateLimited` / `ErrForbidden` → `OnFailure` **and mark unhealthy** (taken out of round-robin until next success);
- other errors → `OnFailure` only.

The pool falls back to primary when all providers are unhealthy (`pool.go:108-114`), so the
system keeps trying rather than going dark.

## SSI credential hot-reload

The SSI provider needs Cloudflare cookies (`SSI_CF_CLEARANCE`, etc.) that expire. `flaresolverr`
mints fresh cookies; a refresh script writes them to the env file via atomic `mv` (inode
replacement). On `SIGHUP`, `EnvCredentialStore.Reload` re-parses and atomically swaps an
`atomic.Pointer[SSICredentials]` — readers (parallel exchange goroutines) snapshot lock-free
(`credentials/env_store.go:31-72`). Parse failure preserves the prior snapshot and returns the
error so the SIGHUP handler logs without crashing (`main.go:62-81`). Required keys are validated
at construction (fail-fast) and on reload; `SSI_COOKIES_MINTED_AT` accepts both colon and
non-colon TZ offsets (`env_store.go:75-103,140-150`).

> Operational gotcha: the container must bind-mount the **directory** `/etc/bot-trade`, not the
> file, or the inode swap is invisible and SIGHUP reloads stale cookies
> (`docker-compose.prod.yml:43-48`).

## Failure modes & recovery

| Failure | Behavior | Recovery |
|---------|----------|----------|
| One provider rate-limited (429) | Marked unhealthy, RPS halved-ish, round-robin skips it | Self-heals on next success |
| All providers unhealthy | Pool falls back to primary; FetchData may return "all providers failed" per symbol | Check upstream broker status; inspect `/metrics` |
| SSI cookies expired (403 Forbidden) | SSI marked unhealthy | Run cookie refresh + `SIGHUP`; confirm `ssi credentials reloaded result=success` log |
| Stale-file mount | SIGHUP logs success but uses old cookies | Fix mount to directory; redeploy |

## Unknowns
- **Unknown:** retry counts/backoff in `infrastructure/http/retry_transport.go` (only referenced, not read here). Verify: read that file.
- **Unknown:** exact provider list registered at runtime. Verify: `infrastructure/provider/registry/factory.go` and `sources/*.go` `init()`.
