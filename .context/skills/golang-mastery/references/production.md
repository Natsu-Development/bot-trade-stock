# Production Patterns

Production-readiness patterns for **this** stack: **Gin** (HTTP), **zap** (logging), **MongoDB**
(storage), **robfig/cron** (scheduling), `golang.org/x/sync` (concurrency). Where the codebase
already implements a pattern, the location is cited — extend those rather than re-introducing a
parallel mechanism.

## Graceful shutdown

`cmd/server/main.go` builds a `wire.App`, starts the Gin server, then blocks on `waitForShutdown`
(SIGINT / SIGTERM / SIGHUP) and calls `srv.Shutdown()` bounded by `cfg.HTTPShutdownTimeout`. All
lifecycle events log through `zap.L()`.

```go
srv.Start()                              // non-blocking; logs "HTTP server starting"
waitForShutdown(app)                     // blocks on SIGINT/SIGTERM/SIGHUP
zap.L().Info("Shutting down...")
if err := srv.Shutdown(); err != nil {   // bounded by HTTPShutdownTimeout
    zap.L().Error("Server shutdown error", zap.Error(err))
}
```

SIGHUP additionally hot-reloads SSI credentials without a restart — see ADR
`wiki/adr/0001-use-host-side-ssi-cookie-refresh.md`.

## Structured logging — zap (NOT slog)

The project standard is **`go.uber.org/zap`** via the global `zap.L()` (see `rules/backend/style.md`).
Do not introduce `log/slog`.

```go
zap.L().Info("request",
    zap.String("method", c.Request.Method),
    zap.String("path", c.FullPath()),
    zap.Int("status", status),
    zap.Duration("duration", elapsed),
)
zap.L().Error("db query failed", zap.Error(err), zap.String("collection", "metrics"))
```

- Use typed fields (`zap.String`, `zap.Int`, `zap.Error`) — never `fmt.Sprintf` into the message.
- Attach request-scoped fields with `logger := zap.L().With(zap.String("request_id", id))`.

## Gin middleware

Middleware lives in `presentation/http/middleware/`. Use `gin.HandlerFunc`:

```go
func RequestLogger() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        zap.L().Info("request",
            zap.String("path", c.FullPath()),
            zap.Int("status", c.Writer.Status()),
            zap.Duration("duration", time.Since(start)),
        )
    }
}

// register: router.Use(RequestLogger(), gin.Recovery())
```

`gin.Recovery()` provides panic recovery; wrap it (or add a custom recovery) so the stack is logged
through `zap` and the client gets a 500 via the `presentation/http/response` envelope.

## Health check

```go
// GET /health — registered in presentation/http/router.go
func (h *HealthHandler) Health(c *gin.Context) {
    if err := h.mongo.Ping(c.Request.Context(), nil); err != nil {
        c.JSON(http.StatusServiceUnavailable, gin.H{"status": "degraded", "db": "down"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
```

## MongoDB connection

Storage is MongoDB via the official driver — there is no `database/sql`. Construct the client once
at startup, reuse it, and set pool bounds on the client options.

```go
opts := options.Client().
    ApplyURI(cfg.MongoURI).
    SetMaxPoolSize(cfg.MongoMaxPool).
    SetServerSelectionTimeout(5 * time.Second)

client, err := mongo.Connect(ctx, opts)
if err != nil { return err }
if err := client.Ping(ctx, nil); err != nil { return err }
// repositories take a *mongo.Collection (see infrastructure/mongodb/)
```

Always pass a `context.Context` with a deadline to driver calls.

## External-API resilience (already implemented)

External market data is the main systemic risk; the codebase already mitigates it — extend these,
don't reinvent:

- **Provider pool with failover** — `infrastructure/provider/pool.go` (`ProviderPool.FetchData`).
- **AIMD rate control + retry** — `infrastructure/http/retry_transport.go`.
- **`singleflight`** dedupes concurrent `Refresh` calls (`golang.org/x/sync/singleflight`).
- **Bounded fan-out** — `errgroup` with `SetLimit`.
- **Lock-free hot reads** — `StockMetrics` published via `atomic.Pointer`; the 15s alert job reads
  without locking (the published map is immutable — preserve that on any change).

The two-track alert + analyze design is recorded in ADR
`wiki/adr/0002-two-track-alert-and-analyze-architecture.md`. Add a new circuit breaker only if a
flaky dependency isn't already covered by the pool / retry transport.

## Body-size & request limits

`POST /stocks/filter` caps the body with `http.MaxBytesReader` before decoding, and the filter tree
enforces depth/condition caps (`FilterNode.Validate`). Apply the same defense-in-depth to any new
endpoint that accepts recursive or unbounded input.

## Production checklist

- [ ] Graceful shutdown on SIGINT/SIGTERM (+ SIGHUP for credential reload)
- [ ] Structured logging via `zap.L()` (no `slog`, no bare `fmt` in messages)
- [ ] `/health` endpoint pings MongoDB
- [ ] `gin.Recovery()` (or a custom zap recovery) registered
- [ ] Request timeouts + body-size caps (`http.MaxBytesReader`) on input-accepting routes
- [ ] MongoDB client pool bounds set; every driver call takes a `ctx` with a deadline
- [ ] External calls go through the provider pool / retry transport (no raw `http.Get`)
- [ ] Context propagated through all layers
- [ ] Errors wrapped with `%w` where callers inspect; handled once (no log + return)
- [ ] Race detector clean (`go test -race ./...`)
