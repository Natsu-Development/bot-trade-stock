# Ralph Delegation Playbook

Single source of truth for **which OMC sub-agent runs at which Ralph phase** and **what policy preamble must be in its Task prompt**. Use with `scripts/delegate.sh` for one-command assembly.

## How to use

Two paths:

**Helper script (recommended):**
```bash
bash scripts/delegate.sh execute --task "Implement US-001 from prd.json: …"
```
Script extracts the matching phase template, substitutes `<TASK_DESCRIPTION>`, prints the assembled prompt. Leader paste it into `Task(prompt=…)`.

**Manual:**
Open this file, scroll to `## Phase: <name>`, copy everything between `<!-- BEGIN PROMPT -->` and `<!-- END PROMPT -->`, fill placeholders, paste into Task call.

## Phase → agent mapping (verified from `~/.claude/plugins/marketplaces/omc/agents/`)

| Ralph step | Phase name | Agent | Model | Read-only? | Ralph SKILL reference |
|---|---|---|---|---|---|
| Step 1 — Requirements gap | `brainstorm` | `analyst` | opus | ✅ | PRD refinement quality |
| Step 1 — Plan refinement | `plan` | `planner` | opus | Limited (only `.omc/plans/`) | PRD scaffold → task-specific criteria |
| Step 3 — Implementation | `execute` | `executor` | sonnet (haiku trivial / opus complex) | ❌ | Default story body |
| Step 3 — Bug fix variant | `execute-bugfix` | `debugger` | sonnet | Minimal Edit only | Root-cause stories |
| Step 3 — TDD / test variant | `execute-test` | `test-engineer` | sonnet | Test-files only | RED-GREEN-REFACTOR stories |
| Step 4 — Heavy verification | `verify` | `verifier` | sonnet | ✅ | When per-story verification needs evidence audit |
| Step 7 — Default reviewer | `review` | `architect` | sonnet (<5 files) / opus (>20 files or security) | ✅ | Default Ralph reviewer |
| Step 7 — `--critic=critic` | `critic` | `critic` | opus | ✅ | Adversarial reviewer alternative |
| Step 7.5 — Deslop | n/a (skill, not agent) | `Skill("ai-slop-cleaner")` | runs in leader context | n/a | Mandatory post-approval cleanup |

---

## Phase: brainstorm

**Agent:** `oh-my-claudecode:analyst`
**Default model:** `opus`
**Composed from:**
- `.context/policies/code-intelligence.md` (discovery half — `gitnexus_query`, `gitnexus_context`)
- `.context/skills/trading-domain/SKILL.md` (if trading work)
- `.context/skills/clean-architecture/SKILL.md` (if layer boundaries involved)

<!-- BEGIN PROMPT -->
You are analyzing requirements for a Ralph workflow. Surface gaps before planning begins.

Before producing the gap report:
1. Use `mcp__gitnexus__query({query: "<feature area>"})` to discover existing flows the work would touch.
2. Use `mcp__gitnexus__context({name: "<key symbol>"})` for full caller/callee picture of any symbol mentioned.
3. Read `.context/skills/trading-domain/SKILL.md` if the work touches RSI / divergence / trendlines / RS Rating / alerts.
4. Read `.context/skills/clean-architecture/SKILL.md` if the work crosses layer boundaries (domain/application/infrastructure/presentation).

Produce your standard output (Missing Questions / Undefined Guardrails / Scope Risks / Unvalidated Assumptions / Missing Acceptance Criteria / Edge Cases / Recommendations / Open Questions).

Each acceptance criterion you propose must be **testable** (pass/fail), citing the verification command (e.g., `go test ./path/...`) or specific behavior check.

Task: <TASK_DESCRIPTION>
<!-- END PROMPT -->

---

## Phase: explore

**Agent:** `oh-my-claudecode:explore`
**Default model:** `haiku` (fast/cheap; level 3)
**Composed from:**
- `.context/policies/code-intelligence.md` (graph-aware search — `gitnexus_query`, `gitnexus_context`)
- `.context/README.md` (routing tables for sub-agent to know which files apply to which paths)

Note: `explore` is **read-only** (`disallowedTools: Write, Edit`). It is also commonly invoked as a sub-callee by `planner` and `analyst`. Use this phase when the leader wants to delegate just a search without involving a higher-level agent.

<!-- BEGIN PROMPT -->
You are searching the bot-trade-stock codebase for files, symbols, patterns, or relationships. Return actionable results with absolute paths.

Before falling back to text search:
1. For "how does X work?" / "where does X happen?" — `mcp__gitnexus__query({query: "<concept>"})` first. Embedding-ranked, process-grouped results.
2. For full caller/callee context on a symbol — `mcp__gitnexus__context({name: "<symbolName>"})`.
3. For exact symbol references in Go — `mcp__plugin_oh-my-claudecode_t__lsp_find_references` with an absolute path.
4. For symbol shape / package surface — `mcp__plugin_oh-my-claudecode_t__lsp_workspace_symbols` or `lsp_document_symbols`.
5. Use Glob / Grep only when graph and LSP tools don't fit the query (raw text patterns, file globs).

Constraints:
- READ-ONLY — you cannot create, modify, or delete files.
- Return ABSOLUTE paths (starting with `/`).
- Return ALL relevant matches, not just the first one.
- Explain relationships between files/patterns when relevant.
- Caller should be able to proceed without asking "but where exactly?" or "what about X?".

For routing context, consult `.context/README.md` (Rule/Skill/Runbook lookup tables) to know which project files apply to the paths you find.

Task: <TASK_DESCRIPTION>
<!-- END PROMPT -->

---

## Phase: plan

**Agent:** `oh-my-claudecode:planner`
**Default model:** `opus`
**Composed from:**
- `.context/policies/code-intelligence.md` (so the planner knows GitNexus is available for explore-agent delegations)
- `.context/skills/golang-mastery/SKILL.md` Verification Ladder (for testable acceptance criteria)
- `.context/skills/clean-architecture/SKILL.md` (for layer-aware step breakdown)
- `.context/README.md` Skill/Rule lookup tables

<!-- BEGIN PROMPT -->
You are creating a Ralph PRD work plan. Refine the auto-generated scaffold into task-specific acceptance criteria.

Constraints for this project:
1. Each acceptance criterion must map to a concrete verification rung from the Verification Ladder in `.context/skills/golang-mastery/SKILL.md` (`go test ./pkg/...` → `go vet` → `golangci-lint run --fast` → `govulncheck` → `go test -race`).
2. Plan steps must respect layer boundaries from `.context/skills/clean-architecture/SKILL.md` — lower layers cannot import higher layers.
3. For codebase questions, spawn the `explore` agent with `model=haiku` — do NOT ask the user about codebase facts.
4. Use `mcp__gitnexus__impact({target: "<symbol>", direction: "upstream"})` to size blast radius for any step that touches an exported symbol.
5. Target 3–6 stories per PRD. Each story completes in one iteration.

Output: refined `prd.json` with task-specific acceptance criteria, plus `.omc/plans/{name}.md` if user explicitly requests plan generation.

Read these for full context as needed:
- `.context/README.md` (routing tables for path-specific rules and domain skills)
- `.context/policies/code-intelligence.md` (graph-aware editing policy)
- `.context/skills/golang-mastery/SKILL.md` (Go workflow and verification ladder)

Task: <TASK_DESCRIPTION>
<!-- END PROMPT -->

---

## Phase: execute

**Agent:** `oh-my-claudecode:executor`
**Default model:** `sonnet` (use `haiku` for trivial single-file work; `opus` for complex multi-system changes)
**Composed from:**
- `.context/policies/code-intelligence.md` Delegation contract
- `.context/skills/golang-mastery/SKILL.md` Delegation contract
- `.context/rules/backend/*.md` (path-specific, for any touched backend file)
- `.context/skills/clean-architecture/SKILL.md` (if layer boundaries touched)
- `.context/skills/trading-domain/SKILL.md` (if trading logic touched)

<!-- BEGIN PROMPT -->
Before editing any Go symbol in `backend/**/*.go`:
1. Run `mcp__gitnexus__impact({target: "<symbolName>", direction: "upstream"})`.
   Report direct callers, affected flows, risk level (LOW/MEDIUM/HIGH/CRITICAL).
2. Refuse to proceed on HIGH/CRITICAL risk without explicit confirmation.
3. Use `mcp__plugin_oh-my-claudecode_t__lsp_document_symbols` or `lsp_workspace_symbols` to confirm symbol shape before editing.

Before writing Go code in `backend/`:
4. `context.Context` first-arg, never stored in structs.
5. Wrap errors with `fmt.Errorf("...: %w", err)` only when callers inspect; handle each error once (no log + return).
6. Prefer `errgroup` for bounded parallelism; channel buffers 0 or 1 unless justified.
7. Early guard clauses, happy path unindented.
8. Target `go 1.23.0` toolchain — refuse newer features without explicit `go.mod` change.
9. Respect layer boundaries: lower layers cannot import higher layers (domain ← application ← infrastructure ← presentation).
10. Apply the 9 Core Rules in `.context/skills/golang-mastery/SKILL.md`.

Before reporting completion:
11. Run smallest Verification Ladder rung that proves the change:
    `go test ./affected/pkg/...` → `go vet` → `golangci-lint run --fast`.
12. Escalate to `govulncheck` / `go test -race -count=1` if deps or concurrency changed.
13. Run `mcp__gitnexus__detect_changes()`. Report only the symbols/flows that should have changed; flag anything unexpected.
14. Report which verification rung you ran with fresh output.

Read these for full context as needed:
- `.context/policies/code-intelligence.md` (full GitNexus + gopls policy)
- `.context/skills/golang-mastery/SKILL.md` (full skill + decision table)
- `.context/rules/backend/{architecture,style,naming,error-handling,concurrency,patterns}.md` for the paths you touch
- `.context/skills/clean-architecture/SKILL.md` if changing layer boundaries
- `.context/skills/trading-domain/SKILL.md` if changing RSI / divergence / trendlines / RS Rating / alerts

Task: <TASK_DESCRIPTION>
<!-- END PROMPT -->

---

## Phase: execute-bugfix

**Agent:** `oh-my-claudecode:debugger`
**Default model:** `sonnet`
**Composed from:**
- `.context/policies/code-intelligence.md` (debugging emphasis — `gitnexus_query`, `gitnexus_context` before hypothesis)
- `.context/skills/golang-mastery/SKILL.md` (Go-specific patterns)
- 3-failure circuit breaker baked into agent prompt (no need to repeat)

<!-- BEGIN PROMPT -->
Investigate this bug. Find root cause; do NOT fix symptoms.

Before forming a hypothesis:
1. `mcp__gitnexus__query({query: "<symptom or feature area>"})` — find the relevant execution flow, not just text matches.
2. `mcp__gitnexus__context({name: "<suspected symbol>"})` — read callers + callees before reading the function in isolation.
3. `git log --oneline -20 -- <suspected file>` — check recent changes around the bug surface.
4. Use `lsp_diagnostics` / `lsp_diagnostics_directory` on the affected files.

Refuse to propose a fix until:
- Root cause is identified (not symptom).
- Reproduction steps are documented.
- Fix is minimal (< 5% of affected file changed).

Before reporting:
5. `mcp__gitnexus__detect_changes()` to confirm the fix touched only the intended symbols.
6. Run the smallest Verification Ladder rung that proves the fix.
7. Cite file:line for every claim.

If you hit the 3-failure circuit breaker (3 hypotheses fail), STOP and escalate to architect instead of trying variations.

Read these for full context as needed:
- `.context/policies/code-intelligence.md` (debugging routing matrix)
- `.context/skills/golang-mastery/SKILL.md` (Go idioms)
- `.context/skills/trading-domain/SKILL.md` if symptom is in indicator/signal logic

Task: <TASK_DESCRIPTION>
<!-- END PROMPT -->

---

## Phase: execute-test

**Agent:** `oh-my-claudecode:test-engineer`
**Default model:** `sonnet`
**Composed from:**
- `.context/rules/testing.md` (project testing conventions)
- `.context/skills/golang-mastery/SKILL.md` (testing Core Rules subset)
- TDD discipline already in agent prompt (RED-GREEN-REFACTOR)

<!-- BEGIN PROMPT -->
You are writing or hardening Go tests for `backend/`. Follow strict TDD if the parent story is greenfield; otherwise add tests that mirror existing patterns.

Constraints:
1. Match existing test patterns in the package — same framework (`testing` stdlib), table-driven structure, naming convention.
2. Each test verifies ONE behavior. Use the form `Test<Function>_<Scenario>` or table-driven with descriptive case names.
3. For TDD stories: RED (failing test first, confirm it fails) → GREEN (minimal code to pass) → REFACTOR (clean up, tests stay green).
4. Apply the relevant Core Rules from `.context/skills/golang-mastery/SKILL.md` (context first-arg, no log + return, etc.) — tests also follow project style.
5. For concurrency code, write `go test -race` tests.
6. Read `.context/rules/testing.md` for the project's testing conventions before authoring.

Before reporting:
7. Run `go test ./affected/pkg/... -v` and include fresh output.
8. If touching concurrency: also run `go test -race -count=1`.
9. Report coverage delta if it can be measured.

Task: <TASK_DESCRIPTION>
<!-- END PROMPT -->

---

## Phase: verify

**Agent:** `oh-my-claudecode:verifier`
**Default model:** `sonnet`
**Composed from:**
- `.context/policies/code-intelligence.md` (`gitnexus_detect_changes` for scope verification)
- `.context/skills/golang-mastery/SKILL.md` Verification Ladder
- prd.json acceptance criteria (inject explicitly)

<!-- BEGIN PROMPT -->
Verify these acceptance criteria are met with fresh evidence. Do not trust prior claims.

Acceptance criteria from prd.json:
<ACCEPTANCE_CRITERIA>

Required checks (run yourself, do not trust claims):
1. `mcp__plugin_oh-my-claudecode_t__lsp_diagnostics_directory` on changed files — must return 0 errors.
2. Smallest Verification Ladder rung from `.context/skills/golang-mastery/SKILL.md` that covers all criteria.
3. Escalate to `govulncheck` if deps changed; `go test -race -count=1` if concurrency touched.
4. `mcp__gitnexus__detect_changes()` to confirm scope — only the intended symbols/flows changed.

For each acceptance criterion, output:
- VERIFIED (test exists + passes + covers edges)
- PARTIAL (test exists but incomplete)
- MISSING (no test)

Final verdict: PASS / FAIL / INCOMPLETE with confidence high/medium/low and explicit blocker count.

Reject the work if:
- Any acceptance criterion is MISSING evidence
- Any tool reports errors that block the build
- `detect_changes` shows unintended symbols modified
- Any "should", "probably", or "seems to" appears in the implementation summary

Task: <TASK_DESCRIPTION>
<!-- END PROMPT -->

---

## Phase: review

**Agent:** `oh-my-claudecode:architect`
**Default model:** `sonnet` for <5 files / standard changes; `opus` for >20 files or security/architectural changes.
**Composed from:**
- `.context/policies/code-intelligence.md` verification half + file:line citation rule
- `.context/skills/golang-mastery/SKILL.md` Core Rules (for Go-idiom review)
- prd.json acceptance criteria

<!-- BEGIN PROMPT -->
Review the Ralph implementation. Output: Summary, Analysis, Root Cause (if bug-related), Recommendations (prioritized), Trade-offs table, References (file:line for every claim).

Acceptance criteria from prd.json:
<ACCEPTANCE_CRITERIA>

Mandatory checks before issuing recommendations:
1. `mcp__gitnexus__detect_changes()` — confirm only intended symbols/flows changed; flag any unexpected change as a finding.
2. `mcp__plugin_oh-my-claudecode_t__lsp_diagnostics` on each changed file — diagnostics must be zero.
3. For exported symbol changes: `mcp__gitnexus__impact({target: ..., direction: "upstream"})` — verify caller impact assessment matches what the executor reported.
4. Cross-reference the implementation against the 9 Core Rules in `.context/skills/golang-mastery/SKILL.md`.
5. Cross-reference against the path-specific rules in `.context/rules/backend/*.md`.

Cite file:line for every claim. Vague advice ("consider refactoring") is rejected — use the architect Output_Format.

If you hit the 3-failure circuit breaker on a recurring issue, do NOT keep recommending variations — flag it as an architectural concern instead.

Files changed: <FILES_CHANGED>

Read these for full context as needed:
- `.context/policies/code-intelligence.md`
- `.context/skills/golang-mastery/SKILL.md`
- `.context/rules/backend/*.md` for touched paths
<!-- END PROMPT -->

---

## Phase: critic

**Agent:** `oh-my-claudecode:critic`
**Default model:** `opus`
**Composed from:**
- All of phase `review` above
- Adversarial-mode escalation criteria (CRITICAL or 3+ MAJOR triggers ADVERSARIAL)
- Explicit "What's Missing" gap analysis anchor
- Realist Check / Self-Audit discipline already in agent prompt

<!-- BEGIN PROMPT -->
Final quality gate review. Issue an explicit VERDICT (REJECT / REVISE / ACCEPT-WITH-RESERVATIONS / ACCEPT).

Acceptance criteria from prd.json:
<ACCEPTANCE_CRITERIA>

Required investigation (your standard 5-phase protocol):
1. **Pre-commitment** — predict 3-5 likely problem areas before reading detail.
2. **Verification** — extract every claim, verify against actual source. Run:
   - `mcp__gitnexus__detect_changes()` — confirm scope of changes
   - `mcp__plugin_oh-my-claudecode_t__lsp_diagnostics_directory` on changed files
   - `mcp__gitnexus__impact` on every exported symbol changed
   - `mcp__gitnexus__context` on at least the top-3 most critical changed symbols
3. **Multi-perspective** (code work): security engineer / new hire / ops engineer angles.
4. **Gap analysis** — what's MISSING that should be there?
5. **Self-Audit + Realist Check** — pressure-test severities. Every downgrade requires an explicit "Mitigated by: …" rationale.

Cross-reference against the project policies:
- `.context/policies/code-intelligence.md` (graph-aware editing was enforced?)
- `.context/skills/golang-mastery/SKILL.md` Core Rules (Go-idiom adherence?)
- `.context/rules/backend/*.md` (path-specific rules for touched files)

Escalate to ADVERSARIAL mode if any CRITICAL finding OR 3+ MAJOR findings OR a systemic pattern emerges.

Output strictly per your defined format (VERDICT first, then Critical/Major/Minor findings with evidence, What's Missing, Multi-Perspective Notes, Verdict Justification, Open Questions).

Files changed: <FILES_CHANGED>
<!-- END PROMPT -->

---

## Phase: deslop

> Note: this phase is a **skill invocation, not a `Task()` call**. `scripts/delegate.sh deslop` will exit with code 5 ("no `<!-- BEGIN PROMPT -->` block") by design — there is nothing to assemble for sub-agent delegation.

**Tool:** `Skill("ai-slop-cleaner")` (a SKILL invocation, NOT `Task(subagent_type=…)`).
**Why no Task template:** Skills run in the leader's context; the leader invokes them directly. There is nothing to assemble into a sub-agent prompt.

**When:** Mandatory after Ralph Step 7 approval, unless `--no-deslop` was passed.

**Scope:** Ralph-changed file set only. Do not broaden the cleanup pass.

**Hand-off:** After deslop, leader runs Step 7.6 regression re-verification (`verify` phase against the post-deslop state).

---

## Maintenance notes

This playbook is **drift-prone** because phase templates compose preambles from multiple source files. When any of these change:
- `.context/policies/code-intelligence.md`
- `.context/skills/golang-mastery/SKILL.md`
- `.context/skills/clean-architecture/SKILL.md`
- `.context/skills/trading-domain/SKILL.md`
- `.context/rules/backend/*.md`
- `.context/rules/testing.md`

…re-read the affected phase template(s) above and update by hand. Source files remain the canonical policy; this playbook is the **assembled cocktail** per phase.

The composition is documented under each phase's "Composed from" header so re-sync is mechanical.

## Related

- Helper script: [`scripts/delegate.sh`](../../scripts/delegate.sh)
- Source policy: [`code-intelligence.md`](code-intelligence.md)
- Source skills: [`../skills/`](../skills/)
- Source rules: [`../rules/`](../rules/)
- Ralph workflow contract: `~/.claude/plugins/marketplaces/omc/skills/ralph/SKILL.md`
