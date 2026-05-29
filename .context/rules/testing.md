---
paths:
  - "**/*_test.go"
  - "frontend/tests/**/*.spec.ts"
---

# Testing Rules

## Backend Testing (Go)

> See [backend/patterns.md](./backend/patterns.md) for domain patterns and [backend/architecture.md](./backend/architecture.md) for interface design.

### Conventions

- Place tests alongside source files (`*_test.go`)
- Use table-driven tests for multiple scenarios
- Mock external dependencies (VietCap API, MongoDB, Telegram)
- Interfaces in `application/port/` enable easy mocking

### Table-Driven Test Pattern

```go
func TestDivergenceDetector(t *testing.T) {
    tests := []struct {
        name    string
        input   []OHLCV
        want    []Divergence
        wantErr bool
    }{
        {
            name:    "bullish divergence detected",
            input:   mockOHLCVBullish,
            want:    []Divergence{{Type: "bullish"}},
            wantErr: false,
        },
        {
            name:    "no divergence",
            input:   mockOHLCVFlat,
            want:    nil,
            wantErr: false,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := Detect(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("Detect() error = %v, wantErr %v", err, tt.wantErr)
            }
            if !reflect.DeepEqual(got, tt.want) {
                t.Errorf("Detect() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

## Frontend Testing (Playwright)

- E2E tests in `frontend/tests/`
- Test critical user flows:
  - Config CRUD operations
  - Chart rendering
  - Screener filtering
