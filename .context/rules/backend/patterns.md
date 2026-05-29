---
paths:
  - "backend/**/*.go"
---

# Go Domain Patterns

> See [architecture.md](./architecture.md) for layer structure and bounded contexts.

## Value Objects (`domain/*/valueobject/`)

### Rules

- **Immutable structs** with validation in constructor
- **No identity** — compared by value, not ID
- **Define errors at top of file**
- **No setters** — return new instances for modifications

### Example

```go
// domain/config/valueobject/types.go
var (
    ErrInvalidConfigID   = errors.New("config ID must be between 2 and 50 alphanumeric characters")
    ErrInvalidRSIPeriod  = errors.New("RSI period must be between 2 and 100")
)

const (
    MinPeriod = 2
    MaxPeriod = 100
)

// RSIPeriod represents the RSI indicator period (immutable).
type RSIPeriod int

// NewRSIPeriod creates a validated RSI period.
func NewRSIPeriod(value int) (RSIPeriod, error) {
    if value < MinPeriod || value > MaxPeriod {
        return 0, ErrInvalidRSIPeriod
    }
    return RSIPeriod(value), nil
}

// WatchlistType represents which watchlist a symbol belongs to.
type WatchlistType string

const (
    WatchlistBullish WatchlistType = "bullish"
    WatchlistBearish WatchlistType = "bearish"
)

// NewWatchlistType creates a validated WatchlistType.
func NewWatchlistType(value string) (WatchlistType, error) {
    normalized := strings.ToLower(strings.TrimSpace(value))
    wt := WatchlistType(normalized)
    if wt == WatchlistBullish || wt == WatchlistBearish {
        return wt, nil
    }
    return "", ErrInvalidWatchlistType
}
```

## Aggregates (`domain/*/aggregate/`)

- Aggregate roots manage consistency boundary
- One aggregate root per bounded context
- Examples: `StockMetrics`, `Config`

## Domain Services (`domain/*/service/`)

- Stateless operations involving multiple aggregates/value objects
- Pure Go, no external dependencies
- Examples: `DivergenceDetector`, `TrendlineAnalyzer`

## Use Cases (`application/usecase/`)

- One file per business operation
- Orchestrate domain objects via ports
- Never depend on infrastructure directly

## Jobs (`application/jobs/`)

- Registered in `registry.go` with cron schedule
- Naming: `{action}_{target}.go` (e.g., `analyze_bearish.go`, `refresh_stock_data.go`)
- Delegate to use cases, no direct infrastructure access

## DTOs (`application/dto/`)

- Request/Response objects for API layer
- Map to/from domain objects in handlers
- Keep flat and serializable

## Providers (`infrastructure/provider/`)

- Implement outbound ports from application layer
- Use connection pool for HTTP clients
- Apply rate limiting for external API calls
