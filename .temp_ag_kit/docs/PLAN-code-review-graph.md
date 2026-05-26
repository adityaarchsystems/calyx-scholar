# PLAN: Code Review Graph Skill Integration

> **Objective:** Create a new AG Kit skill for `code-review-graph` — the Tree-sitter + SQLite MCP tool that reduces AI coding assistant token usage by 6.8-49x.

---

## Context

Source: [How code-review-graph Cuts Claude Code Token Usage by 49x](https://dev.to/emperorakashi20/how-code-review-graph-cuts-claude-code-token-usage-by-49x-and-whether-its-actually-worth-it-4kn1)

`code-review-graph` is an open-source MCP server that:
- Uses **Tree-sitter** to parse codebases into ASTs (19 languages)
- Stores relationships in a **SQLite graph** (functions, classes, imports, tests)
- Traces **blast radius** of changes via breadth-first search
- Serves context via **MCP** to AI coding tools that support MCP integrations
- Reduces token usage by **6.8x average**, up to **49x** on large monorepos
- Improves review quality from **7.2 → 8.8/10** (more signal, less noise)

---

## Proposed Changes

### 1. [NEW] `.agent/skills/code-review-graph/SKILL.md`

New dedicated skill covering:
- **When to use** (500+ file codebases, multi-file changes, cross-module deps)
- **When to skip** (under 200 files, single-file changes, dynamic patterns)
- **Installation** (pipx, uvx, pip options)
- **MCP configuration** for AG Kit, Cursor, and Windsurf
- **Graph build & watch mode**
- **Blast radius analysis** — the core token-saving feature
- **Dead code detection** workflow
- **Risk-scored changes** workflow
- **Architecture visualization** workflow
- **Best practices** (ignore files, depth tuning, session architecture)
- **Alternatives comparison** (Claudette, Serena, code-graph-rag)

### 2. [MODIFY] `README.md`

Add `code-review-graph` to the "New in v3.0" component table.

### 3. [MODIFY] `ARCHITECTURE.md`

Update skill count (44 → 45) and add entry to the Orchestration & Memory table.

### 4. [MODIFY] `CHANGELOG.md`

Add entry under [Unreleased] for the new skill.

---

## Task Breakdown

| # | Task | Agent | Status |
|---|------|-------|--------|
| 1 | Create `code-review-graph/SKILL.md` | project-planner | ✅ |
| 2 | Update README.md | documentation-writer | ✅ |
| 3 | Update ARCHITECTURE.md counts | documentation-writer | ✅ |
| 4 | Update CHANGELOG.md | documentation-writer | ✅ |
| 5 | Verify all files are consistent | test-engineer | ✅ |

---

## Verification Plan

- [x] `code-review-graph/SKILL.md` exists with valid frontmatter
- [x] `when_to_use` field is present and descriptive
- [x] README skill count matches actual directory count
- [x] ARCHITECTURE.md skill count matches actual directory count
- [x] CHANGELOG has entry for new skill
- [x] Grep confirms `code-review-graph` appears in all 4 files
