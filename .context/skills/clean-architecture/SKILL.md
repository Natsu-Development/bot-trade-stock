---
name: clean-architecture
description: Use when designing or modifying Go backend architecture, Clean Architecture boundaries, DDD aggregates/value objects/domain services, ports/adapters, dependency direction, and backend layering.
---

# Clean Architecture + DDD for Go

Guidelines for implementing Clean Architecture with Domain-Driven Design patterns in the backend service.

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│  Presentation (HTTP handlers, router)       │
├─────────────────────────────────────────────┤
│  Application (Use Cases, Services)          │
│      Uses ports (interfaces)                │
├─────────────────────────────────────────────┤
│  Domain (Aggregates, Services, Value Objects)│
│      Zero external dependencies             │
├─────────────────────────────────────────────┤
│  Infrastructure (Adapters, Repositories)    │
│      Implements ports from inner layers     │
└─────────────────────────────────────────────┘
```

## Dependency Rule

**Dependencies point inward only:**
- Infrastructure → Application → Domain
- Domain layer has ZERO external dependencies
- Application depends on domain only
- Infrastructure implements interfaces defined in application/port

## Directory Structure

```
backend/
├── domain/
│   ├── aggregate/          # Domain aggregates (Analysis, Config, Market)
│   │   ├── analysis/       # DivergenceType, AnalysisResult
│   │   ├── config/         # TradingConfig aggregate root
│   │   └── market/         # Signal, Query, Indicator types
│   └── service/            # Domain services (pure business logic)
│       ├── divergence/     # RSI divergence detection
│       ├── trendline/      # Trendline detection
│       └── stockmetrics/   # RS Rating calculation
├── application/
│   ├── port/
│   │   ├── inbound/        # Use case interfaces
│   │   └── outbound/       # Repository/gateway interfaces
│   ├── service/            # Application services (schedulers, jobs)
│   └── usecase/            # Business use cases
├── infrastructure/
│   ├── adapter/            # External service adapters
│   ├── mongodb/            # Repository implementations
│   ├── port/               # Infrastructure interfaces
│   └── telegram/           # Notification implementation
└── presentation/http/      # API handlers, middleware
```

## Key Patterns

### Aggregate Root
```go
// domain/aggregate/config/trading_config.go
type TradingConfig struct {
    ID          string
    Watchlist   []string
    Timeframes  []string
    // Business methods here
}

func (c *TradingConfig) AddSymbol(symbol string) error {
    // Business validation
    if c.hasSymbol(symbol) {
        return errors.New("symbol already exists")
    }
    c.Watchlist = append(c.Watchlist, symbol)
    return nil
}
```

### Port (Interface) Definition
```go
// application/port/outbound/market_data.go
type MarketDataGateway interface {
    GetPriceData(ctx context.Context, symbol string, interval string, limit int) ([]market.PriceData, error)
}
```

### Repository Implementation
```go
// infrastructure/mongodb/config_repository.go
type ConfigRepository struct {
    collection *mongo.Collection
}

func (r *ConfigRepository) Save(ctx context.Context, config *config.TradingConfig) error {
    // Implementation details
}
```

### Use Case
```go
// application/usecase/analyze.go
type AnalyzeUseCase struct {
    marketGateway   outbound.MarketDataGateway
    divergenceSvc   *divergence.Detector
}

func (uc *AnalyzeUseCase) Execute(ctx context.Context, symbol string) (*AnalysisResult, error) {
    // Orchestration logic
}
```

### Thin Handler
```go
// presentation/http/handler/analyze.go
func (h *AnalyzeHandler) Analyze(c *gin.Context) {
    symbol := c.Param("symbol")
    result, err := h.analyzeUseCase.Execute(c.Request.Context(), symbol)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    c.JSON(200, mapper.ToResponse(result))
}
```

## Rules to Follow

1. **Domain has no imports** from external packages (only standard library)
2. **Handlers are thin** - delegate all logic to use cases
3. **Use cases orchestrate** - don't contain business rules
4. **Domain services** contain pure business logic
5. **All config from environment** - no hardcoded values
6. **Interfaces in ports** - implementations in infrastructure

## Testing Strategy

- **Domain**: Unit tests with no mocks needed (pure Go)
- **Application**: Mock ports for use case tests
- **Infrastructure**: Integration tests with real DB
- **Presentation**: HTTP handler tests with mocked use cases
