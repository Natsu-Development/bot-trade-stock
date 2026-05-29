---
name: backend-error-handling
description: Go error handling - wrapping, checking, anti-patterns
paths:
  - "backend/**/*.go"
---

# Go Error Handling

> See [style.md](./style.md) for general style rules.

## Rules

- **Return errors, never panic** (except unrecoverable failures in `main`)
- **Wrap with `%w`** for errors callers might inspect
- **Use `%v`** for internal implementation details callers won't match
- **Error strings**: lowercase, no trailing punctuation
- **Handle errors once**: don't log AND return

```go
// Good: wrap with context for inspection
func LoadConfig(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("load config %s: %w", path, err)
    }
    // ...
}

// Bad: log AND return (caller might log again)
if err != nil {
    log.Printf("failed: %v", err)
    return err
}

// Good: return with context, let caller decide
if err != nil {
    return fmt.Errorf("fetch user %s: %w", id, err)
}
```

## Checking Errors

```go
// Check sentinel error
if errors.Is(err, ErrNotFound) {
    return nil, ErrNotFound
}

// Check error type
var validationErr *ValidationError
if errors.As(err, &validationErr) {
    return handleValidationError(validationErr)
}

// Never use == for error comparison
```

## Error Type Decision

| Scenario | Use |
|----------|-----|
| Caller matches specific error | Sentinel: `var ErrNotFound = errors.New(...)` |
| Caller needs error details | Custom type: `type ValidationError struct{...}` |
| Just adding context | `fmt.Errorf("context: %w", err)` |
| Multiple errors | `errors.Join(err1, err2)` (Go 1.20+) |

## Anti-Patterns

```go
// Bad: panic for control flow
func GetUser(id string) *User {
    user, err := db.Find(id)
    if err != nil { panic(err) }  // Only for truly unrecoverable
    return user
}

// Bad: ignoring errors
result, _ := doSomething()  // Always handle errors

// Bad: error strings with caps/punctuation
fmt.Errorf("Failed to connect.")  // Wrong
fmt.Errorf("connect to db: %w", err)  // Correct

// Bad: log AND return
if err != nil {
    log.Printf("failed: %v", err)
    return err  // Caller might log again - double logging
}
```
