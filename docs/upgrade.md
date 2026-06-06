# EmDash Upgrade: 0.1.1 → 0.17.2

## Current State

Installed: `emdash@0.1.1`, `@emdash-cms/auth@0.1.1`
Target: `emdash@0.17.2`, `@emdash-cms/auth@0.17.2`

---

## Why Upgrade

### 🔴 Security (blocking)

`0.15.0` fixes **3 high-severity SQL injection CVEs** in `kysely` (the DB query layer):

- `GHSA-wmrf-hv6w-mr66` — SQL injection via unsanitized JSON path keys
- `GHSA-pv5w-4p9q-p3v2` — JSON-path traversal injection via `JSONPathBuilder.key()` / `.at()`
- `GHSA-8cpq-38p9-67gx` — MySQL SQL injection via `sql.lit(string)`

### Bug Fixes Relevant to This Site

- **`0.17.1`** — `getEmDashCollection` pagination losing `nextCursor` with Astro 6 live collections
- **`0.17.0`** — `getEmDashCollection` by-slug update broken when multiple locales share the same slug (`ar`/`en`)
- **`0.17.0`** — `require is not defined` crash on EmDash API routes in `astro dev` on Cloudflare Workers
- **`0.17.0`** — SEO fields (`noindex`, canonical URL) not affecting rendered pages
- **`0.16.0`** — i18n-aware sitemaps with `hreflang` alternates (relevant for bilingual `ar`/`en` site)

### New Features

- **`0.16.0`** — `getEmDashCollection` supports `where` with field-level filtering and ranges
- **`0.16.0`** — Per-collection sitemap emits `<xhtml:link rel="alternate" hreflang="...">` per locale
- **`0.15.0`** — Code block language picker in the admin editor

---

## Current Patches (must be re-created after upgrade)

### `patches/emdash@0.1.1.patch`

Three separate fixes bundled into this patch:

**1. Database driver swap** (`dist/connection-*.mjs`)

Replaces `better-sqlite3` + `SqliteDialect` with `@libsql/kysely-libsql` + `LibsqlDialect`.

- **Why:** `better-sqlite3` is a native Node.js addon. Cloudflare Workers run in a V8 isolate (not Node.js) and cannot load native `.node` binaries. `@libsql/kysely-libsql` is a pure JS/WASM implementation that runs in CF Workers.
- **Status in 0.17.2:** `better-sqlite3` is still listed as a dependency in `emdash@0.17.2`. This patch is **still required**.
- **Note:** The dist filename is hashed (e.g. `connection-B4zVnQIa.mjs`) and will be different in 0.17.2. Must locate the new filename after installing.

**2. Astro v6 OAuth env access** (`src/astro/routes/api/auth/oauth/[provider].ts` and `callback.ts`)

Replaces `locals.runtime?.env` with `import { env } from "cloudflare:workers"`.

- **Why:** Astro v6 removed `locals.runtime.env`. The Cloudflare Workers canonical way to access env vars is the `cloudflare:workers` module.
- **Status in 0.17.2:** Unknown — may have been fixed upstream. Check after installing.

**3. `isFirstLogin` session removal** (`src/astro/routes/api/auth/me.ts`)

Removes session-based `isFirstLogin` logic, hard-codes it to `false`.

- **Why:** Related to Astro v6 session API changes.
- **Status in 0.17.2:** Fixed upstream in `0.17.0` — "Persist welcome-dismissed flag in database instead of session." This patch is **no longer needed**.

### `patches/@emdash-cms__auth@0.1.1.patch`

Adds `User-Agent: emdash-cms` header to GitHub API fetch calls (`fetchProfile` and `fetchGitHubEmail`).

- **Why:** GitHub's API requires a `User-Agent` header and returns 403 without it.
- **Status in 0.17.2:** Unknown — check if upstream added this. If not, still required.

---

## Upgrade Steps

```bash
# 1. Remove old patches from package.json pnpm.patchedDependencies
#    (edit manually)

# 2. Install new versions
pnpm add emdash@0.17.2 @emdash-cms/auth@0.17.2 @emdash-cms/cloudflare@0.17.2

# 3. Try to build — see what breaks
pnpm build

# 4. Start new patch for emdash
pnpm patch emdash@0.17.2

# 5. Inside the patched copy, find the connection file:
#    rg "better-sqlite3" node_modules/.pnpm-patches/ -l
#    Apply the libsql swap to the new hashed filename

# 6. Check if OAuth env fix is still needed:
#    rg "locals.runtime" node_modules/emdash/ -l

# 7. Commit the patch
pnpm patch-commit <patch-dir>

# 8. Repeat for @emdash-cms/auth if User-Agent is still missing
pnpm patch @emdash-cms/auth@0.17.2
```

---

## Changelog Summary (0.1.1 → 0.17.2)

### emdash@0.17.2 — Patch Changes
- Scope Postgres table/column introspection to active schema (not hardcoded `public`) — fixes non-public schema deployments
- `buildMediaUrl` handles root-relative paths without doubling the API prefix
- Fix frontend pages wrongly redirecting to `/_emdash/admin/setup` on transient DB errors

### emdash@0.17.1 — Patch Changes
- Fix `emdash export-seed` omitting bylines
- Pre-bundle auth/MCP/admin-shell deps so `astro dev` on Cloudflare no longer triggers re-optimize cascade on cold start
- Fix `emdash export-seed` collapsing locale variants into duplicate seed ids on i18n projects
- **Fix `getEmDashCollection` pagination losing `nextCursor` with Astro 6 live collections**

### emdash@0.17.0 — Patch Changes
- Byline hydration resolves avatar storage key in the same query (no N+1 media lookups)
- **Persist welcome-dismissed flag in database instead of session** (removes need for `isFirstLogin` patch)
- Fix exact redirects to match with or without trailing slash
- Make content list search work on large collections (server-side search via `q` param)
- **Fix locale-aware content updates so `update by slug` works when multiple locales share the same slug**
- Fix taxonomy terms not being locale-aware in the content editor
- Add search and filtering to the media library
- **Fix `require is not defined` crash on EmDash API routes under `astro dev` on Cloudflare**
- **Fix SEO fields not affecting rendered pages** — `entry.data.seo` now populated

### emdash@0.16.1 — Patch Changes
- Dependency updates only

### emdash@0.16.0 — Minor + Patch Changes
- **i18n-aware per-collection sitemap** with `hreflang` alternates and `x-default`
- Plugin compatibility requirements (`requires` block in manifest)
- Plugin icon/screenshot/banner images in registry
- **`getEmDashCollection` `where` clause now supports exact match, multi-value, and range filtering on any column**
- Fix scheduled posts missing from snapshot export until UTC midnight
- Fix `portableTextToProsemirror` flattening nested lists with mixed types
- **Fix Postgres server bundles importing `better-sqlite3`** (partial upstream fix — CF Workers still need the patch)
- Fix public form embeds during SSR
- Fix WordPress import leaving `featured_image` pointing at original URL after media download

### emdash@0.15.0 — Minor + Patch Changes
- Workerd-based plugin sandboxing for Node.js deployments
- First-class i18n support for bylines (row-per-locale)
- Code block language picker in admin editor
- Plugin uninstall/update from admin for registry plugins
- Version picker on registry plugin detail page
- **Upgrade `kysely` to `^0.29.0` — fixes 3 high-severity SQL injection CVEs**

### emdash@0.14.0 — Patch Changes
- Resolve bare local media IDs in media fields before falling back to external URLs
- Fix experimental registry navigation and CSP for aggregator
- Validate aggregator responses at the trust boundary

### emdash@0.13.0 — Breaking Changes
- **`definePlugin()` removed for sandboxed plugins** — new shape is bare default export with `satisfies SandboxedPlugin`
- This affects plugin _authors_, not sites that _use_ plugins — **likely no impact on this repo**
- Menu REST API refactored: camelCase responses, path-style item endpoints (`PUT /menus/:name/items/:id`)
