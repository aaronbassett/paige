# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paige is an AI-powered coaching tool for junior developers. Instead of writing code for developers, Paige coaches them through problems. The tagline: "Claude Codes, Paige Pairs."

This is a hackathon project (one-week, solo developer) for the Claude Code Hackathon at Cerebral Valley. Judging is 30% demo, 25% impact, 25% Opus 4.6 use, 20% depth & execution.

## Architecture: Three Tiers

```
Claude Code Plugin ←── MCP (SSE) ──→ Backend Server ←── WebSocket ──→ Electron UI
  (Personality)                        (Brain)                         (Face)
```

**Claude Code Plugin**: Coaching persona, read-only enforcement via hooks, prompt enrichment. Uses SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, and Stop hooks.

**Backend Server**: Node.js/TypeScript. Owns ALL state (SQLite for structured data, ChromaDB for semantic search), all file I/O, all MCP tool implementations, action logging. Single source of truth — if the backend doesn't know about it, it didn't happen.

**Electron UI**: Thin rendering client. React + TypeScript. Monaco Editor for code, xterm.js for terminal, file tree with hint decorations. Communicates with backend via WebSocket only. NEVER touches the filesystem directly. Contains no AI logic.

## References

- `docs/planning/initial-brainstorm.md` — Full architecture, research, UI design, coaching pipeline, MCP tool surface, WebSocket protocol, Observer system, demo script (Read when required)
@.sdd/memory/constitution.md — Project constitution with enforceable principles and development standards (Read at the start of every session)
