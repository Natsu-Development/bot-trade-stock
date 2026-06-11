Stock metrics: refresh is split into two distinct operations — the heavy provider
fetch is owned by the JOB; the HTTP endpoint only recomputes the caller's per-config
signals from already-cached bars (it never sweeps the provider).

## (A) The stock-refresh JOB — owns the provider fetch

- Sweeps all exchanges (HOSE/HNX/UPCOM), computes config-independent base metrics,
  ranks them, persists to Mongo, and publishes the in-RAM snapshot. After publishing
  it eagerly recomputes per-config alert trendlines (`metrics.UseCase.Refresh` runs
  the base refresh then the alert recompute — explicit composition, no publish hook).
- Runs ONCE at startup AND on the daily cron, gated by `STOCK_REFRESH_ENABLED`.
  When disabled, neither the boot run nor the cron runs and the cache stays cold.
- The boot run is best-effort: launched from `StartSchedulers` (after `wire.New`),
  timeout-bounded, panic-recovered, off the request path — a fresh deploy
  self-populates without a manual call.

## (B) POST /stocks/recompute — per-config recompute (NO fetch)

Recomputes the caller's per-config signals from the snapshot's ALREADY-CACHED bars
via the existing Layer-2 compute. It NEVER triggers a provider sweep.

```bash
curl -X POST "http://localhost:8080/stocks/recompute?config_id=<id>"
```

Response (200): `{ message, total_stocks, calculated_at }`
(`total_stocks` = ranked symbols in the cache).

### Snapshot states (response contract)

| Snapshot state | Result |
|---|---|
| no snapshot (truly cold) | **503** — data warming up |
| snapshot present (DB-warm or post-fetch) | **200** |

Unknown `config_id` → **404**; missing `config_id` → **400**.

## Check cache status

```bash
curl http://localhost:8080/stocks/cache-info
```
