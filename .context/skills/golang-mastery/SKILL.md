---
name: golang-mastery
description: Use when writing, reviewing, debugging, linting, or hardening Go code. Covers idiomatic Go, error handling, concurrency, interfaces, generics, tests, static analysis, production readiness, and Go toolchain checks for bot-trade.
---

# Golang Mastery

Use this skill for Go implementation and review work, especially under `bot-trade/**/*.go`.

## Project Constraints

- The backend module is `bot-trade`.
- `bot-trade/go.mod` declares `go 1.23.0` and `toolchain go1.23.2`.
- Do not use Go features newer than the module/toolchain unless the module version is intentionally changed.
- Project-specific rules in `.context/rules/backend/*.md` override generic Go guidance.
- Architecture guidance in `.context/skills/clean-architecture/SKILL.md` applies when changing layer boundaries, ports/adapters, domain objects, use cases, jobs, handlers, repositories, or providers.

## Current Tooling

Observed local toolchain:

| Tool | Version / source |
| --- | --- |
| Go | `go1.23.2 linux/amd64` |
| gopls | `golang.org/x/tools/gopls v0.22.0` |
| golangci-lint | `v1.64.8` |
| govulncheck | `v1.3.0` |

The local toolchain includes `gopls` support for `bot-trade`. Prefer available language-server diagnostics for symbol/refactor questions, then verify with Go commands.

## Workflow

1. Load `.context/README.md`.
2. Load the relevant backend rules from `.context/rules/backend/`.
3. If architecture or domain boundaries are involved, load `.context/skills/clean-architecture/SKILL.md`.
4. If trading logic is involved, load `.context/skills/trading-domain/SKILL.md`.
5. Make the smallest idiomatic Go change that preserves project boundaries.
6. Verify with targeted tests first, then broader checks as risk increases.

## Verification Ladder

Use the smallest check that proves the claim. For Go work, prefer:

```bash
go test ./...
go vet ./...
golangci-lint run ./...
govulncheck ./...
go test -race -count=1 ./...
```

Run heavier checks such as `govulncheck` and race tests when the change affects dependencies, concurrency, shared services, or production-critical paths. If a tool is unavailable or too expensive for the current turn, state the gap and run the next-best check.

## Quick Decision Table

| Need | Default approach | Optional reference |
| --- | --- | --- |
| Error handling | Return errors, wrap with `%w` when callers inspect, handle once | `references/error-handling.md` |
| Concurrency | Prefer synchronous functions, pass `context.Context`, use `errgroup` for bounded parallelism | `references/concurrency.md` |
| Interfaces | Keep interfaces small and define them at the consumer side | `references/interfaces.md` |
| Generics | Use only when they remove real duplication without hiding domain meaning | `references/generics.md` |
| Testing | Table-driven tests for scenarios; mock ports at application boundaries | `references/testing.md` |
| Production hardening | Timeouts, graceful shutdown, health checks, structured logs | `references/production.md` |
| Static analysis | Map findings to severity before fixing | `references/static-analysis.md` |

## Core Rules

- Keep code simple, flat, and explicit.
- Put `context.Context` first and never store it in structs.
- Avoid package-level mutable state.
- Use early guard clauses and keep the happy path unindented.
- Prefer `errgroup` over ad hoc goroutine coordination.
- Keep channel buffers at `0` or `1` unless a larger buffer is justified.
- Do not log and return the same error.
- Organize imports as standard library, external, then internal.
- Run `gofmt`/`goimports` on changed Go files.

## Delegation contract

When delegating Go work in `bot-trade/**/*.go` to sub-agents (`executor`, `architect`, `critic`, `debugger`, `test-engineer`), prepend this preamble to the Task prompt:

> Before writing or reviewing Go in `bot-trade/`:
> 1. `context.Context` first-arg, never stored in structs; no package-level mutable state.
> 2. Wrap errors with `fmt.Errorf("...: %w", err)` only when callers inspect; handle once (no log + return).
> 3. Prefer `errgroup` for bounded parallelism; channel buffers 0 or 1 unless justified.
> 4. Early guard clauses, happy path unindented.
> 5. Target `go 1.23.0` toolchain — refuse newer features without explicit `go.mod` change.
> 6. Apply the full 9 Core Rules in `.context/skills/golang-mastery/SKILL.md` for everything else.
>
> Before reporting completion:
> 7. Run the smallest **Verification Ladder** rung that proves the change:
>    `go test ./affected/pkg/...` → `go vet` → `golangci-lint run --fast`.
> 8. Escalate to `govulncheck` / `go test -race -count=1` if dependencies or concurrency changed.
> 9. Report which rung you ran and the fresh output.
>
> Read `.context/skills/golang-mastery/SKILL.md` for the full skill, decision table, and project tooling constraints (Go 1.23.0, gopls v0.22.0, golangci-lint v1.64.8, govulncheck v1.3.0).

Without this preamble, the sub-agent works from its own prompt's generic Go heuristics — fine for trivial single-file edits, but it will not apply this project's Core Rules, the Verification Ladder, or the Go 1.23.0 toolchain ceiling. Pair this preamble with the `.context/policies/code-intelligence.md` delegation contract when the change touches exported symbols (graph-aware impact analysis is enforced separately by that policy).
