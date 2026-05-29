# Go save-time checks

Quality gates the project applies after any Go-related file change: formatting drift, static analysis, fast linters, comment-marker hygiene, and (for `go.mod`) module integrity + known vulnerabilities. Run from any tool, agent, editor save-hook, pre-commit, or CI step that can pipe a file path to the dispatcher.

## Dispatcher

Single source of truth: [`scripts/go-check.sh`](../../scripts/go-check.sh).

One shell script, one JSON payload on stdin, one merged JSON document on stdout when there are findings (silent otherwise). Always exits 0; never modifies the file under check; advisory by design.

## What runs

| File kind | Check | Tool | Scope | Reported when |
| --- | --- | --- | --- | --- |
| `*.go` | Formatting drift | `gofmt -l` | per-file | File needs `gofmt -w` |
| `*.go` | Static analysis | `go vet` | per-package (`./pkg/path`) | Vet exits non-zero |
| `*.go` | Linting | `golangci-lint run --fast` (timeout 30s, max 10/linter) | per-package | Lint finds issues |
| `*.go` | Comment markers | `grep -nE '(TODO\|FIXME\|XXX\|HACK)([(:]\| )'` | per-file | Up to 10 hits surfaced |
| `go.mod` | Module integrity | `go mod verify` | module | Verify exits non-zero |
| `go.mod` | Vulnerability scan | `govulncheck -mode=source ./...` | module | Vulnerabilities found |

All checks `command -v <tool>` first and skip silently if the binary isn't on PATH.

## Invoke

The script reads a JSON document from stdin and extracts `.tool_input.file_path`:

```bash
echo '{"tool_input":{"file_path":"backend/path/to/file.go"}}' \
  | bash scripts/go-check.sh
```

Empty stdout = clean. Findings come back as a single JSON document (shape below). Non-Go paths and unknown filenames cause an immediate silent exit 0 — safe to invoke on every file change without pre-filtering.

The JSON-on-stdin contract comes from the original save-hook integration that drove the script's design. If you need a plain `path` argument (CLI-friendly invocation from pre-commit, Makefile targets, etc.), wrap with a one-liner:

```bash
file="$1"
printf '{"tool_input":{"file_path":"%s"}}\n' "$file" | bash scripts/go-check.sh
```

## Output

When any check produces findings:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "[go-check] /abs/path/file.go\n--- gofmt ---\n…\n--- go vet ---\n…\n"
  }
}
```

The human-readable findings live in `hookSpecificOutput.additionalContext`. Sections are joined by `--- <check-name> ---` headers in insertion order: gofmt → go vet → golangci-lint → go-todo-fixme (for `*.go`); go mod verify → govulncheck (for `go.mod`). The envelope shape is fixed for compatibility with save-hook consumers that expect this schema; treat the rest as metadata.

For non-JSON consumers, extract the inner string:

```bash
echo '…' | bash scripts/go-check.sh | jq -r '.hookSpecificOutput.additionalContext // empty'
```

## Extending

Add new checks as a new block inside the existing `case "$kind" in … esac` in `scripts/go-check.sh`, following the established pattern:

```bash
if command -v <tool> >/dev/null 2>&1; then
    out=$(cd "$mod_root" && <tool> <args> 2>&1)
    if [ $? -ne 0 ] && [ -n "$out" ]; then
        append "<label>" "$(printf '%s' "$out" | head -<N>)"
    fi
fi
```

Rules: per-package targets (`$pkg_target`), `head` cap, advisory (no `-w`), exit 0 always, `command -v` guard. Keep this as a single dispatcher — splitting into N scripts or N save-hook entries fragments the output and duplicates the payload parse on every file change.

## Known gaps vs. upstream `zircote/go-lsp@v1.0.0`

Not currently wired (port if needed):

- `gosec` — security scanner on `*.go`
- `staticcheck` — fallback when `golangci-lint` is absent
- `go.sum` checksum verify (we only handle `go.mod`)
- Test-file run hint, race-detection hint, benchmark hint
- Markdown lint on `*.md`

Deliberately **not** ported from upstream (bug-prone in v1.0.0):

- `go vet "$file_path"` and `go build -o /dev/null "$file_path"` — both need a package, not a single file. Our dispatcher uses `$pkg_target` consistently.
- `goimports -w "$file_path"` — silently rewrites the file under check. We only advise via `gofmt -l`.
- `grep -qE 'err\s*:?=.*\n\s*[^if]'` — multi-line regex that never matches in `grep` (no `-z`).

## Related

- Backend coding rules the checks gate against: [`rules/backend/style.md`](../rules/backend/style.md), [`rules/backend/error-handling.md`](../rules/backend/error-handling.md), [`rules/backend/patterns.md`](../rules/backend/patterns.md).
