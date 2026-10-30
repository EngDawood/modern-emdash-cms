---
name: project-pending-followups
description: Open follow-ups after the catch-all collection routes work (Oct 2026)
type: project
---

Branch `feat/dazzling-bohr-2goffx` added catch-all `/[locale]/[collection]` routes and automatic sitemap/llms.txt/RSS/search listing for admin-created collections. As of 2026-10-29 it is pushed but has no PR and is not deployed.

Open items:
- Deploy, recreate a test entry in the `mcp` collection, and verify `/ar/mcp/<slug>`, the sitemap and search on production. Search needs the collection's FTS index, which is built when Search is enabled in the admin; not confirmed for `mcp`.
- The SEO plugin's IndexNow/hreflang URLs use the collection urlPattern without the `ar` prefix (`/blog/x/`), so crawlers get a redirect. Pre-existing; fix separately.
- Package upgrade: emdash and @emdash-cms/cloudflare are now 1.4.0 (wrangler 4.99.0, vite-plugin 1.40.1, patch re-ported for update path only). Still open: @astrojs/cloudflare 13.1.8 (latest 14.4.3), astro 6 (latest 7.4.4). Major jumps; they break `patches/emdash@0.38.0.patch` and the pinned adapter set. Do it on its own branch.
- `.gitignore` ignores `.claude/*` (except `.claude/memory/`), so the `.claude/` docs CLAUDE.md links (CLAUDE.EMDASH.md, CLAUDE.CLOUDFLARE.md, rules/dep-pinning.md, …) exist only on the user's machine. Fresh cloud sessions don't have them; `.claude/rules/` was absent here.

**Why:** These were explicitly deferred so the routing change stayed small.

**How to apply:** Check the branch/PR state with git before acting; these may already be done.
