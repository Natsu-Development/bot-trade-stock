---
title: "Project wiki guide"
tags: ["project", "wiki", "guide"]
created: 2026-05-22
updated: 2026-05-22
sources: []
category: reference
confidence: high
schemaVersion: 1
---

# Project wiki guide

This folder contains curated knowledge about the trading application only: architecture, runtime behavior, data flow, frontend structure, jobs, provider resilience, and operational recovery notes.

Excluded from this wiki: agent-runtime notes, migration notes, raw session logs, and tool setup history.

## ADRs

Architecture Decision Records use the `adr-NNNN-*.md` naming at the wiki root (kept flat, not in an `adr/` subfolder, so tools whose page listing is non-recursive can still index them). Use them for durable decisions: context, decision, rejected alternatives, and consequences. Read ADRs before changing the related subsystem.

## Tool access

This wiki is **tool-agnostic** — any human, agent, or assistant should be able to read it. Tool-specific wiring (how a given agent discovers, loads, or indexes this folder) belongs in that tool's own config — e.g. `CLAUDE.md` or `AGENTS.md` at the repo root — **not in this folder**. Keep the wiki free of agent/harness names (assistant brands, plugin or MCP tool names, session-runtime details) so the knowledge stays portable across whatever tooling reads it.
