# Project Context

This directory is the shared implementation context for this repository. It is platform-neutral and should be readable by any person, tool, or automation working on the project.

| Directory | Purpose |
| --- | --- |
| `rules/` | Path-specific coding and testing rules |
| `skills/` | Skill-shaped project and domain guidance |
| `runbooks/` | Operational command references |
| `policies/` | Cross-cutting policies (pre/post-edit workflow, code intelligence) |

## Rule Lookup

| Path touched | Read first |
| --- | --- |
| `bot-trade/**/*.go` | `rules/backend/architecture.md`, `rules/backend/style.md`, `rules/backend/naming.md`, `rules/backend/error-handling.md`, `rules/backend/concurrency.md`, `rules/backend/patterns.md` |
| `frontend/**/*.{ts,tsx}` | `rules/frontend.md` |
| `**/*_test.go`, `frontend/tests/**/*.spec.ts` | `rules/testing.md` |

## Skill Lookup

| Work area | Read first |
| --- | --- |
| Go implementation, review, linting, concurrency, error handling, testing, or static analysis | `skills/golang-mastery/SKILL.md` |
| Go backend architecture, Clean Architecture, DDD, ports/adapters, `bot-trade` layering | `skills/clean-architecture/SKILL.md` |
| React + TypeScript frontend components, hooks, API client, UI conventions | `skills/frontend-patterns/SKILL.md` |
| Trading logic, RSI divergence, trendlines, RS Rating, alerts, stock metrics | `skills/trading-domain/SKILL.md` |

## Runbook Lookup

| Task | Read first |
| --- | --- |
| Analyze a stock symbol through the API | `runbooks/analyze.md` |
| Deploy the trading bot | `runbooks/deploy.md` |
| Refresh stock metrics cache | `runbooks/refresh-metrics.md` |
| Test API endpoints | `runbooks/test-api.md` |
| Go file change quality gates (gofmt/vet/lint/vuln) | `runbooks/go-hooks.md` |

## Policy Lookup

| Concern | Read first |
| --- | --- |
| Any code edit — GitNexus impact analysis, gopls usage, tool routing, delegation contract | `policies/code-intelligence.md` |
| Ralph workflow — which agent runs at which phase, with assembled Task prompt | `policies/delegation-playbook.md` (paired with `scripts/delegate.sh`) |

## Maintenance

- Keep this directory limited to project facts, conventions, domain guidance, skill-shaped project context, and operational runbooks.
- Do not add tool-specific orchestration prompts, model routing, session state, or runtime workflow instructions here.
- Keep this as the only README in `.context/`; update this index when adding or moving context files.
