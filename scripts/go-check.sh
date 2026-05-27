#!/usr/bin/env bash
# Go development hooks dispatcher.
# Triggered as a PostToolUse hook on Edit|Write|MultiEdit.
# Reads the hook payload from stdin, filters to .go / go.mod files,
# and runs the appropriate Go tooling. Non-blocking: always exits 0.
# Findings (if any) go to stdout — Claude Code surfaces them as
# additional context for the next turn.
#
# Tools gracefully skipped when not installed.

set -uo pipefail

# ---------- 1. Parse payload ----------
payload=$(cat)
file_path=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)

[ -z "$file_path" ] && exit 0
[ ! -f "$file_path" ] && exit 0

base=$(basename "$file_path")
case "$base" in
    *.go)    kind=go  ;;
    go.mod)  kind=mod ;;
    *)       exit 0  ;;
esac

# ---------- 2. Locate module root ----------
mod_root=$(dirname "$file_path")
while [ "$mod_root" != "/" ] && [ ! -f "$mod_root/go.mod" ]; do
    mod_root=$(dirname "$mod_root")
done
[ ! -f "$mod_root/go.mod" ] && exit 0

# ---------- 3. Helpers ----------
issues=""
append() {
    issues+=$'\n--- '"$1"$' ---\n'"$2"$'\n'
}

# Relative directory for the file's package (used by go vet / golangci-lint)
rel_path=${file_path#"$mod_root"/}
pkg_dir=$(dirname "$rel_path")
[ "$pkg_dir" = "." ] && pkg_target="./..." || pkg_target="./$pkg_dir"

# ---------- 4. Run checks ----------
if [ "$kind" = "go" ]; then

    # gofmt — formatting drift (fast, ~10ms)
    if command -v gofmt >/dev/null 2>&1; then
        unfmt=$(gofmt -l "$file_path" 2>&1)
        if [ -n "$unfmt" ]; then
            append "gofmt" "File needs formatting. Fix: gofmt -w \"$file_path\""
        fi
    fi

    # go vet — per-package, fast
    if command -v go >/dev/null 2>&1; then
        if ! vet_out=$(cd "$mod_root" && go vet "$pkg_target" 2>&1); then
            append "go vet" "$(printf '%s' "$vet_out" | head -20)"
        fi
    fi

    # golangci-lint --fast — fast linters only, package-scoped
    if command -v golangci-lint >/dev/null 2>&1; then
        lint_out=$(cd "$mod_root" && golangci-lint run --fast --timeout 30s \
            --max-issues-per-linter 10 --max-same-issues 5 \
            --out-format=line-number "$pkg_target" 2>&1)
        lint_rc=$?
        if [ $lint_rc -ne 0 ] && [ -n "$lint_out" ]; then
            append "golangci-lint --fast" "$(printf '%s' "$lint_out" | head -30)"
        fi
    fi

    # go-todo-fixme — surface TODO/FIXME/XXX/HACK markers in the edited file.
    # Pure grep, no external deps. Capped at 10 hits to keep noise low.
    todo_out=$(grep -nE '(TODO|FIXME|XXX|HACK)([(:]| )' "$file_path" 2>/dev/null | head -10)
    if [ -n "$todo_out" ]; then
        append "go-todo-fixme" "$todo_out"
    fi

elif [ "$kind" = "mod" ]; then

    # go mod verify — quick checksum / vendor verify
    if command -v go >/dev/null 2>&1; then
        if ! verify_out=$(cd "$mod_root" && go mod verify 2>&1); then
            append "go mod verify" "$verify_out"
        fi
    fi

    # govulncheck — known-vuln scan against ./... (can take 5-15s)
    if command -v govulncheck >/dev/null 2>&1; then
        vuln_out=$(cd "$mod_root" && govulncheck -mode=source ./... 2>&1)
        vuln_rc=$?
        if [ $vuln_rc -ne 0 ] && [ -n "$vuln_out" ]; then
            append "govulncheck" "$(printf '%s' "$vuln_out" | head -40)"
        fi
    fi
fi

# ---------- 5. Surface findings ----------
if [ -n "$issues" ]; then
    # Emit JSON so Claude Code injects the text as additionalContext
    # for the next turn (raw stdout is not always surfaced).
    text="[go-check] $file_path$issues"
    jq -n --arg ctx "$text" '{
        hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: $ctx
        }
    }'
fi
exit 0
