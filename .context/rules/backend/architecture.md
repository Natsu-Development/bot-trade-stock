---
paths:
  - "bot-trade/**/*.go"
---

# Go Architecture Rules (bot-trade)

> Path-specific quick lookup for any `bot-trade/**/*.go` change.
> **Canonical patterns**, narrative, and code examples live in [`../../skills/clean-architecture/SKILL.md`](../../skills/clean-architecture/SKILL.md). Read that for: dependency direction prose, aggregate examples, port/repository code, use-case orchestration, thin handler patterns.

## Dependency direction

**Infrastructure → Application → Domain** (never reverse). Domain has zero external dependencies.

## Layers

| Layer | Purpose | External deps |
|-------|---------|---------------|
| `domain/` | Core business logic, bounded contexts | ❌ None |
| `application/` | Use cases, jobs, DTOs, ports | ❌ None (only interfaces) |
| `infrastructure/` | Handlers, repositories, providers | ✅ Yes |
| `cmd/` | Entrypoint | ✅ Yes |
| `pkg/` | Shared utilities | ⚠️ Minimal |

## Bounded contexts (in `domain/`)

| Context | Aggregate | Purpose |
|---------|-----------|---------|
| `metrics/` | `StockMetrics` | Stock data and indicators |
| `analysis/` | — | Divergence and trendline detection |
| `config/` | `Config` | User configuration |
| `shared/` | — | Cross-context domain concepts |

## Key files

| File | Purpose |
|------|---------|
| `cmd/bot-trade/main.go` | Entrypoint |
| `wire/wire.go` | Dependency injection (Wire) |
| `config/` | Env-based configuration |
| `application/port/inbound/` | Handler interfaces |
| `application/port/outbound/` | Repository and provider interfaces |

## Location patterns

| Type | Location | Example |
|------|----------|---------|
| Aggregate roots | `domain/*/aggregate/` | `StockMetrics` |
| Value objects | `domain/*/valueobject/` | `RSIPeriod`, `OHLCV` |
| Domain services | `domain/*/service/` | `DivergenceDetector` |
| Use cases | `application/usecase/` | `analyze_divergence.go` |
| Jobs | `application/jobs/` | `refresh_stock_data.go` |
| DTOs | `application/dto/` | `AnalyzeRequest` |
| Handlers | `infrastructure/handler/` | `config_handler.go` |
| Repositories | `infrastructure/repository/` | `config_repository.go` |
| Providers | `infrastructure/provider/sources/` | `vietcap.go` |

## Interface rules (path-specific summary)

1. **Small, focused interfaces** — 1-2 methods. Compose for more.
2. **Accept interfaces, return structs.**
3. **Define at the consumer** — interface lives in the package that uses it.
4. **Compile-time verification**: `var _ Interface = (*Struct)(nil)`

For full interface design patterns, code examples, and rationale, see [`../../skills/clean-architecture/SKILL.md`](../../skills/clean-architecture/SKILL.md) and [`../../skills/golang-mastery/references/interfaces.md`](../../skills/golang-mastery/references/interfaces.md).

## Related rules

- Style + tooling — [`style.md`](./style.md)
- Domain patterns (value objects, aggregates, services) — [`patterns.md`](./patterns.md)
- Error handling — [`error-handling.md`](./error-handling.md)
- Naming + imports — [`naming.md`](./naming.md)
- Concurrency — [`concurrency.md`](./concurrency.md)
