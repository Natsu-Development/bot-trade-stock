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

Architecture Decision Records live in [`adr/`](./adr/). Use them for durable decisions: context, decision, rejected alternatives, and consequences. Read ADRs before changing the related subsystem.
## OMX compatibility

`wiki/` is the canonical shareable project wiki. This workspace uses option 4: project config in `.omx/config.json` with `wiki.path = "wiki"`. With the local OMX config support applied, `omx wiki wiki_query`, `wiki_list`, and `wiki_read` load this folder directly, including nested ADR files under `wiki/adr/`.

Do not recreate a separate `omx_wiki/` copy. If OMX is reinstalled or updated and `omx wiki_*` starts returning no pages, check that `.omx/config.json` still contains `wiki.path = "wiki"`; if upstream OMX lacks config-root support, use the temporary compatibility symlink `omx_wiki -> wiki` until configurable wiki roots are supported natively.
