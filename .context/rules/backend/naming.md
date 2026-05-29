---
name: backend-naming
description: Go naming conventions and import organization
paths:
  - "backend/**/*.go"
---

# Go Naming Conventions

> See [style.md](./style.md) for general style rules.

## Naming Table

| Type | Convention | Example |
|------|------------|---------|
| Files | snake_case | `divergence_detector.go` |
| Packages | lowercase, single word | `domain`, `handler` |
| Exported types | PascalCase | `MarketGateway` |
| Unexported | mixedCaps | `httpClient` |
| Interfaces | PascalCase + purpose | `StockProvider`, `Notifier` |
| Constants | PascalCase or UPPER_SNAKE | `MinPeriod`, `MaxPeriod` |
| Errors | `Err` prefix | `ErrInvalidConfigID` |
| Initialisms | All caps | `HTTP`, `URL`, `ID`, `API`, `JSON` |

## Receiver Names

- 1-2 letter abbreviation of type
- Consistent across all methods

```go
func (s *Server) Start() { }      // Server -> s
func (c *Config) Validate() { }   // Config -> c
func (p *Provider) Fetch() { }    // Provider -> p
```

## Import Organization

Three groups separated by blank lines: stdlib → external → internal

```go
import (
    // stdlib
    "context"
    "fmt"
    "net/http"

    // external
    "github.com/gin-gonic/gin"
    "go.uber.org/zap"

    // internal
    "backend/config"
    "backend/domain/metrics/aggregate"
    "backend/application/port/outbound"
)
```

## Anti-Patterns

```go
// Bad: interface in provider package
package repository

type UserRepository interface { ... }  // Define at consumer, not provider

// Bad: context in struct field
type Request struct {
    ctx context.Context  // Context should be first param, not field
    ID  string
}
```
