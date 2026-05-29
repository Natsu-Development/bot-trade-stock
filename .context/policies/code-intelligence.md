# Code Intelligence Policy

Mandatory pre- and post-edit workflow when changing code in this repository. Applies to every agent, runtime, and human contributor.

This file is the **single source of truth** for GitNexus and gopls usage. Top-level operating contracts (`AGENTS.md`, `CLAUDE.md`) point at this file rather than restating it. When inline blocks in those files disagree with this policy (e.g. after a `gitnexus ai-context` regeneration), this file wins.

## GitNexus — Blast Radius & Graph Awareness

This project is indexed by GitNexus as **bot-trade-stock** (3497 symbols, 8696 relationships, 248 execution flows). The graph is the source of truth for "what will break if I change X?".

### Always

- **Before editing any function/method/class/exported symbol**, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report:
  - Direct callers
  - Affected processes / flows
  - Risk level (LOW / MEDIUM / HIGH / CRITICAL)
- **Before committing**, run `gitnexus_detect_changes()` and verify the diff only touches expected symbols and flows.
- **Warn the user explicitly** if impact returns HIGH or CRITICAL — name what would break, then ask for confirmation.
- **For unfamiliar code**, use `gitnexus_query({query: "concept"})` (process-grouped, embeddings-ranked) instead of grep.
- **For full symbol context** (callers + callees + flows), use `gitnexus_context({name: "symbolName"})`.

### Never

- Edit a function/method/class without running `gitnexus_impact` first.
- Ignore HIGH or CRITICAL risk findings.
- Rename symbols with find-and-replace. Use `gitnexus_rename` (graph-aware, cross-language) or `gopls.go_rename_symbol` (Go-only semantic).
- Commit without `gitnexus_detect_changes()`.

### Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/bot-trade-stock/context` | Codebase overview, check index freshness |
| `gitnexus://repo/bot-trade-stock/clusters` | All functional areas |
| `gitnexus://repo/bot-trade-stock/processes` | All execution flows |
| `gitnexus://repo/bot-trade-stock/process/{name}` | Step-by-step execution trace |

### Index freshness

If any GitNexus tool warns the index is stale, run `npx gitnexus@1.6.5 analyze --embeddings` before relying on its output. The version is pinned (`1.6.5`) — both the MCP server and the index must share a schema. See `.omc/wiki/toolchain-setup-gitnexus-lsp-go-lsp.md`.

## gopls — Go Semantic Correctness

For `backend/**/*.go`, gopls is the source of truth for "is this Go valid, where are the exact references, what does this package expose?". The Go workspace is the `backend` module at `backend/go.mod`.

### Always

- `gopls.go_workspace` — when workspace/module shape is unclear.
- **Absolute file paths** — gopls requires them for file-argument tools.
- `gopls.go_file_context` and `gopls.go_package_api` — before changing package boundaries, exported APIs, constructors, interfaces, or dependency wiring.
- `gopls.go_symbol_references` — before changing shared functions, methods, fields, interfaces, or exported names.
- `gopls.go_diagnostics` — after Go edits and before claiming the code is clean.
- `gopls.go_vulncheck` or `govulncheck` — when dependency, security, or network-facing changes are involved.

### Pairing rules

1. **GitNexus first, gopls second.** GitNexus answers "what breaks?"; gopls answers "is the Go valid and where are the exact references?".
2. **gopls diagnostics do not replace tests.** Follow diagnostics with the smallest relevant `go test` command.
3. **`gitnexus_detect_changes` is still required** before commits, even when gopls is clean.
4. **If GitNexus and gopls disagree**, inspect the source directly and report the mismatch before editing.

## Tool boundaries

| Question | First tool | Fallback |
|---|---|---|
| "What breaks if I change X?" | `gitnexus_impact` / `gitnexus_api_impact` | Read direct callers |
| "How does X work?" / "Where does X happen?" | `gitnexus_query` / `gitnexus_context` | `gitnexus_route_map` for API surface |
| "Is this Go valid?" / "Where are the exact references?" | `gopls.*` | `go vet`, `go build` |
| "Where does this text appear?" | `rg` / `Grep` | Supplement only — never a replacement for graph or semantic tools |
| Cross-cutting Go change | GitNexus for scope → gopls for semantics → targeted tests | Broader checks if risk warrants |
| Frontend/API contract drift | `gitnexus_route_map`, `gitnexus_shape_check`, `gitnexus_api_impact` | Browser/API smoke checks |

## Default flow

1. Start with `.context/README.md` and the matching path-specific rules under `.context/rules/`.
2. Use GitNexus to map flows, owners, routes, consumers, and blast radius **before** changing code symbols.
3. For Go work, use gopls to inspect package APIs, references, diagnostics, and rename safety.
4. Edit only after graph impact and language-server context are understood.
5. Verify with the smallest proving check first; scale to package or repo-wide checks if risk warrants.

## Hook coverage — what's automatic vs. what isn't

**Post-edit (automatic):**

The `PostToolUse` hook in `.claude/settings.json` runs `scripts/go-check.sh` on every `Edit|Write|MultiEdit` to a `*.go` file (gofmt / go vet / golangci-lint / TODO scan) and on `go.mod` (`go mod verify` / `govulncheck`). The hook fires at the Claude Code harness level — **it covers OMC sub-agent edits within the same session**. Findings come back as a single `additionalContext` JSON block. See `.context/runbooks/go-hooks.md` for the dispatcher contract.

**Pre-edit (NOT automatic — agent responsibility):**

GitNexus impact analysis and gopls inspection cannot be hook-enforced because:

- `PreToolUse` hooks see `file_path`, not the **symbol** being changed.
- Symbol extraction from a planned diff is non-trivial.
- Blocking on HIGH risk would interrupt every flow, not just risky ones.

Consequence: when work is delegated to OMC sub-agents (`executor`, `code-reviewer`, etc.), the orchestrator must include this policy in the task prompt — sub-agent prompts have no GitNexus references of their own.

## Delegation contract

When delegating Go edits to OMC sub-agents, the task prompt **must** include this preamble:

```
Before editing any Go symbol in backend/**/*.go:
1. Run `mcp__gitnexus__impact({target: "<symbolName>", direction: "upstream"})`.
2. Report direct callers, affected flows, and risk level.
3. Refuse to proceed on HIGH/CRITICAL risk without explicit confirmation.

Before completing the task:
4. Run `mcp__gitnexus__detect_changes()`.
5. Report only the symbols/flows that should have changed; flag anything unexpected.

Read .context/policies/code-intelligence.md for the full policy.
```

Without this preamble, the sub-agent will edit without impact analysis. The `PostToolUse` hook protects code quality (formatting, lint, vuln); it does not enforce graph-aware editing.

## Related

- Path-specific Go coding rules: [`../rules/backend/`](../rules/backend/)
- Go save-time check dispatcher: [`../runbooks/go-hooks.md`](../runbooks/go-hooks.md)
- Toolchain version pinning: `.omc/wiki/toolchain-setup-gitnexus-lsp-go-lsp.md`
