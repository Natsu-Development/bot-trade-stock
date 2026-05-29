#!/usr/bin/env bash
# Delegation prompt assembler for Ralph workflow.
# Reads .context/policies/delegation-playbook.md and prints the assembled
# Task() prompt for the named phase. Optional --task interpolates into
# the template's <TASK_DESCRIPTION> placeholder.
#
# Usage:
#   bash scripts/delegate.sh <phase> [--task "<text>"]
#   bash scripts/delegate.sh --list
#   bash scripts/delegate.sh --help
#
# The leader (Claude Code main session) runs this via the Bash tool, captures
# the stdout, and pastes it as the `prompt` argument to Task(). The script
# does NOT invoke Task() itself — that's a Claude Code tool, only callable
# from inside a conversation turn.

set -euo pipefail

PLAYBOOK=".context/policies/delegation-playbook.md"

usage() {
    cat <<EOF
Usage:
  $(basename "$0") <phase> [--task "<text>"]
  $(basename "$0") --list
  $(basename "$0") --help

Available phases:
$(grep -E '^## Phase: ' "$PLAYBOOK" 2>/dev/null | sed 's/^## Phase: /  /' || echo "  (playbook not found)")
EOF
}

# --- arg parse ---
phase=""
task=""

case "${1:-}" in
    ""|-h|--help)
        usage
        [ "${1:-}" = "" ] && exit 2 || exit 0
        ;;
    --list)
        if [ ! -f "$PLAYBOOK" ]; then
            echo "Missing $PLAYBOOK" >&2
            exit 3
        fi
        grep -E '^## Phase: ' "$PLAYBOOK" | sed 's/^## Phase: //'
        exit 0
        ;;
    *)
        phase="$1"
        shift
        ;;
esac

while [ $# -gt 0 ]; do
    case "$1" in
        --task)
            [ $# -lt 2 ] && { echo "--task needs a value" >&2; exit 2; }
            task="$2"
            shift 2
            ;;
        *)
            echo "Unknown arg: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

# --- guards ---
if [ ! -f "$PLAYBOOK" ]; then
    echo "Missing $PLAYBOOK — run from repo root." >&2
    exit 3
fi

# --- extract section for the phase ---
# Capture lines between "## Phase: <phase>" and the next "## Phase: " heading.
section=$(awk -v target="## Phase: $phase" '
    $0 == target { capture=1; next }
    /^## Phase: / && capture { exit }
    capture { print }
' "$PLAYBOOK")

if [ -z "$section" ]; then
    echo "Phase '$phase' not found. Try: $(basename "$0") --list" >&2
    exit 4
fi

# --- extract prompt template between BEGIN/END markers ---
template=$(awk '
    /^<!-- BEGIN PROMPT -->$/ { capture=1; next }
    /^<!-- END PROMPT -->$/   { capture=0 }
    capture { print }
' <<<"$section")

if [ -z "$template" ]; then
    echo "Phase '$phase' has no <!-- BEGIN PROMPT --> block (likely a notes-only phase)." >&2
    exit 5
fi

# --- interpolate task description ---
if [ -n "$task" ]; then
    # Bash parameter expansion does the replacement safely (no eval/sed escaping).
    output="${template//<TASK_DESCRIPTION>/$task}"
else
    output="$template"
fi

printf '%s\n' "$output"
