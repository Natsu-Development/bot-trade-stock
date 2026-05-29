---
paths:
  - "bot-trade/**/*.go"
---

# Go Concurrency Rules (bot-trade)

> Path-specific quick lookup for any concurrency change in `bot-trade/**/*.go`.
> **Canonical patterns** (worker pool, fan-out/in, pipeline, semaphore, rate limiter, sync primitives, full code examples) live in [`../../skills/golang-mastery/references/concurrency.md`](../../skills/golang-mastery/references/concurrency.md). Read that for deep patterns.

## Channel rules

- **Buffer size: 0 or 1.** Justify anything larger with a comment.
- **Document goroutine lifetimes.** Every `go func()` must have a clear shutdown path.
- **Prefer synchronous functions.** Let callers add concurrency.

## Context best practices

- **First parameter**, always: `func Do(ctx context.Context, ...)`.
- **Never store in struct fields** — pass explicitly.
- **Propagate to all blocking calls** — HTTP, DB, external APIs.
- **Set deadlines** for external calls: `context.WithTimeout(ctx, 5*time.Second)`.
- **Check cancellation** in long loops: `select { case <-ctx.Done(): return ctx.Err(); default: ... }`.

## Default tool

`errgroup` for bounded parallelism with fail-fast error propagation. Code example and `SetLimit` usage: [`../../skills/golang-mastery/references/concurrency.md`](../../skills/golang-mastery/references/concurrency.md#errgroup-preferred-for-most-cases).

## Verification gate

For any concurrency change in `bot-trade/**/*.go`:

```bash
go test -race -count=1 ./affected/pkg/...
```

The race check is **not** automatically wired into the PostToolUse hook (`scripts/go-check.sh` only runs gofmt/vet/lint --fast on file save). Run it explicitly when goroutines, channels, mutexes, or shared state change. See [`../../runbooks/go-hooks.md`](../../runbooks/go-hooks.md) for the hook's exact scope.

## When to escalate to references/

| Need | Read |
|------|------|
| Worker pool with bounded queue | [`references/concurrency.md`](../../skills/golang-mastery/references/concurrency.md#worker-pool-bounded-concurrency) |
| Fan-out / fan-in across N goroutines | [`references/concurrency.md`](../../skills/golang-mastery/references/concurrency.md#fan-out--fan-in) |
| Pipeline / stream transformations | [`references/concurrency.md`](../../skills/golang-mastery/references/concurrency.md#pipeline) |
| Goroutine-leak prevention pattern | [`references/concurrency.md`](../../skills/golang-mastery/references/concurrency.md#preventing-goroutine-leaks) |
| Mutex / RWMutex / sync.Once / sync.Pool / atomics | [`references/concurrency.md`](../../skills/golang-mastery/references/concurrency.md#sync-primitives) |
| Rate limiter (`golang.org/x/time/rate`) | [`references/concurrency.md`](../../skills/golang-mastery/references/concurrency.md#rate-limiting) |
| Semaphore (bounded concurrency without worker pool) | [`references/concurrency.md`](../../skills/golang-mastery/references/concurrency.md#semaphore-bounded-concurrency-without-worker-pool) |

## Related rules

- General style — [`style.md`](./style.md)
- Error handling under concurrency (`errgroup` propagates the first error) — [`error-handling.md`](./error-handling.md)
- Naming for receiver methods on concurrent types — [`naming.md`](./naming.md)
