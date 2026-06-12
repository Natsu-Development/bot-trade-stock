# Project Structure

> This project does **not** use the `internal/`-based "standard layout". The Go module
> (`module backend`, `go 1.23.0`) is organized by **Clean Architecture + DDD layers**.
> For the layer tree and dependency rules see
> [`../../clean-architecture/SKILL.md`](../../clean-architecture/SKILL.md) and
> [`../../../rules/backend/architecture.md`](../../../rules/backend/architecture.md).
> This file covers the module / DI / build / packaging conventions around that layout.

## Module & toolchain

```
module backend            # short module path — imports are `backend/domain/...`
go 1.23.0                 # language floor: do NOT use newer features without a go.mod bump
toolchain go1.23.2        # pinned toolchain
```

- Imports use the bare module path: `import "backend/domain/metrics/aggregate"`.
- Treat `go 1.23.0` as a ceiling. Refuse Go 1.24+ features (e.g. `tool` directives) until the
  team explicitly bumps `go.mod`.

## Layer layout (not `internal/`)

```
backend/
├── cmd/server/main.go     # thin entrypoint: build wire.App, run, wait for shutdown
├── domain/                # pure business logic, ZERO external deps (grouped by context)
├── application/           # use cases, jobs, ports, DTOs
├── infrastructure/        # Mongo, HTTP providers, Telegram, cron, credentials
├── presentation/http/     # Gin handlers, middleware, response
├── wire/                  # MANUAL dependency injection (see below)
├── config/                # env-based configuration
└── pkg/                   # shared utilities (keep minimal)
```

**Why no `internal/`:** the layer packages already encode the boundary, and the module ships as
a single deployable (not a reusable library), so `internal/` import-fencing adds nothing here.

## Dependency injection — `wire/` is MANUAL

The `wire/` package is **hand-written constructor wiring**, NOT Google Wire codegen (despite the
name). It builds the three layers bottom-up and exposes the app's `Run()` / `Shutdown()`. Add a
dependency by threading its constructor through `wire/` — there is no `wire_gen.go` to regenerate.
Compile-time interface assertions (`var _ Iface = (*Impl)(nil)`) guard the seams.

## Key dependencies (`backend/go.mod`)

| Concern | Library |
|---|---|
| HTTP framework | `github.com/gin-gonic/gin v1.9.1` |
| Logging | `go.uber.org/zap v1.27.0` (global `zap.L()`) |
| Database | `go.mongodb.org/mongo-driver v1.17.6` (MongoDB) |
| Scheduling | `github.com/robfig/cron/v3 v3.0.1` |
| Concurrency | `golang.org/x/sync v0.16.0` (`errgroup`, `singleflight`) |

## go.mod hygiene

```bash
go mod tidy       # add missing, drop unused
go mod verify     # verify checksums
go mod download   # pre-fetch deps
```

## Build & packaging

Builds go through the root `Makefile`, which includes `makefiles/{common,development,docker}.mk`:

```bash
make golang-build   # build the Go backend (makefiles/development.mk)
make docker-test    # containerized test run   (makefiles/docker.mk)
make help           # list all available targets
```

- `backend/Dockerfile` and `frontend/Dockerfile` are multi-stage (build → minimal runtime image).
- Keep `cmd/server/main.go` thin: load config, construct `wire.App`, run, handle signals.

## Package naming

```go
package handler       // short, lowercase, no underscores
package valueobject   // singular, domain-meaningful
package provider

// avoid: utils, models (plural), userService (camelCase)
```
