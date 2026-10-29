---
name: feedback-use-emdash-docs-mcp
description: Use the docs.emdashcms MCP for EmDash questions and check upstream package versions
type: feedback
---

For EmDash API or behavior questions, search the `docs_emdashcms` MCP (`search_docs`) before reading `node_modules` or answering from memory. When touching EmDash code, also check whether the packages have newer releases.

**Why:** User asked directly: "use docs.emdashcms for docs, also check if there's any update for packages from the sources".

**How to apply:** Check docs first, then confirm in `node_modules/emdash/dist` types when the docs are thin. Report version gaps; don't upgrade them inside an unrelated change.
