---
name: backend-style
description: Go style guide - principles, configuration, guard clauses
paths:
  - "bot-trade/**/*.go"
---

# Go Style Guide

> See [architecture.md](./architecture.md) for architecture rules, [patterns.md](./patterns.md) for domain patterns, [error-handling.md](./error-handling.md) for error handling, and [naming.md](./naming.md) for naming conventions.

## Quick Reference

| Need | Solution |
|------|----------|
| Error handling | Return errors, wrap with `%w`, handle once |
| Concurrency | errgroup, worker pool, context propagation |
| Interface design | 1-2 methods, accept interface return struct |
| Configuration | Required (not optional), fail fast on missing |
| Guard clauses | Check negative first, return early, flat code |
| Logging | `zap.L()` globally, structured fields |

## Core Principles (in order)

1. **Clarity** — purpose and rationale are obvious to the reader
2. **Simplicity** — accomplishes the goal in the simplest way
3. **Concision** — high signal to noise ratio
4. **Maintainability** — easy to modify correctly
5. **Consistency** — matches surrounding codebase

## Configuration

- **Required, not optional** — all config values must be present at startup
- **Fail fast** — wire initialization must error if config is missing/invalid
- **No defaults for required fields** — explicit configuration only

```go
// Good: required config, fail if missing
func NewInfra(cfg *config.InfraConfig) (*Infra, error) {
    if cfg == nil {
        return nil, errors.New("infra config is required")
    }
    if cfg.MongoURI == "" {
        return nil, errors.New("mongo uri is required")
    }
    // ... proceed with valid config
}

// Bad: optional config with silent defaults
func NewInfra(cfg *config.InfraConfig) *Infra {
    if cfg == nil {
        cfg = &config.InfraConfig{MongoURI: "localhost:27017"}  // Hidden default!
    }
    // ...
}
```

## Guard Clauses

- **Check negative conditions first** — return early to reduce nesting
- **Flat code** — prefer early returns over deeply nested if-else
- **Readability** — main logic stays at the left margin

```go
// Good: guard clauses, flat structure
func ProcessOrder(ctx context.Context, order *Order) error {
    if order == nil {
        return errors.New("order is required")
    }
    if order.Items == nil {
        return errors.New("order items is required")
    }
    if err := order.Validate(); err != nil {
        return fmt.Errorf("validate order: %w", err)
    }

    // Main logic at left margin, no nesting
    return executeOrder(ctx, order)
}

// Bad: deeply nested happy path
func ProcessOrder(ctx context.Context, order *Order) error {
    if order != nil {
        if order.Items != nil {
            if err := order.Validate(); err == nil {
                return executeOrder(ctx, order)  // Deep nesting!
            } else {
                return fmt.Errorf("validate order: %w", err)
            }
        } else {
            return errors.New("order items is required")
        }
    } else {
        return errors.New("order is required")
    }
}
```

## Tooling

### Essential (run before merge)

```bash
go vet ./...                    # Compiler-level static analysis
golangci-lint run ./...         # Comprehensive linting
```

### Deep Analysis

```bash
govulncheck ./...               # CVE vulnerability scanner
nilaway ./...                   # Nil pointer detection (Uber)
deadcode ./...                  # Find unreachable functions
```

### Build

```bash
CGO_ENABLED=0 go build -o bin/server ./cmd/server
go build -ldflags "-X main.version=1.0.0" ./cmd/server
```

## Production Checklist

- [ ] Graceful shutdown with signal handling
- [ ] Structured logging (zap JSON)
- [ ] Health check endpoint (`/health`)
- [ ] Request timeouts (read, write, idle)
- [ ] Database connection pool limits
- [ ] Rate limiting for external APIs
- [ ] Context propagation through all layers
- [ ] Error wrapping with context at each layer
- [ ] No package-level mutable state
