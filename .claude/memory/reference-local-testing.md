---
name: reference-local-testing
description: Gotchas for testing this site locally with pnpm dev
type: reference
---

- `pnpm bootstrap` seeds `data.db` (SQLite), but `pnpm dev` reads the local D1 in `.wrangler/state`, so seeded content does not appear in dev. To test, create data in-process from a temporary API route using `getDb()` from `emdash/runtime` plus `SchemaRegistry` / `handleContentCreate` / `handleContentPublish` from `emdash`, then delete the route.
- Dev responses are cached (`cf-cache-status: HIT`, s-maxage 86400). Add a random query string (`?$RANDOM`) to every curl, or you get stale output.
- Collections created directly via `SchemaRegistry` have no search index. Use `FTSManager.setSearchConfig` + `rebuildIndex` before testing search.
- `pkill -f <name>` from the Bash tool kills its own shell (exit 144). Find PIDs with `ps` and `kill` them instead.
- `pnpm dev` and `pnpm typecheck` clash on port 9230; stop the dev server first.
