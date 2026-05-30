# MCP & Worker Architecture

This document covers the Cloudflare Worker entrypoint, the remote MCP server, and the live content collection config.

---

## Worker Entrypoint (`src/worker.ts`)

The project uses a custom Cloudflare Worker entrypoint that intercepts requests before they reach the Astro server renderer.

### Exports

| Export | Source | Purpose |
|--------|--------|---------|
| `default` | `src/worker.ts` | Main `fetch` handler |
| `EmDashMCP` | `src/mcp/index.ts` | Durable Object class (must be exported for Wrangler binding) |
| `PluginBridge` | `@emdash-cms/cloudflare/sandbox` | EmDash plugin sandbox bridge |

### Environment (`WorkerEnv`)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `MCP_OBJECT` | `DurableObjectNamespace` | Yes | Namespace for the `EmDashMCP` Durable Object |
| `EMDASH_TOKEN` | `string` | Yes (in prod) | Bearer token that gates access to `/mcp` |

### Request routing

```
GET /mcp   → auth check → EmDashMCP.serve("/mcp").fetch()
GET /*     → Astro handler
```

**Auth check** — the worker reads the token from either:
- `Authorization: Bearer <token>` header, or
- `?token=<token>` query parameter

If `EMDASH_TOKEN` is unset or the token does not match, the worker returns `401 Unauthorized` and the request never reaches the MCP agent.

---

## MCP Server (`src/mcp/index.ts`)

A remote [Model Context Protocol](https://modelcontextprotocol.io) server built on the Cloudflare Agents SDK (`McpAgent`). It runs inside a Durable Object so each connected AI client gets a stateful, persistent session over SSE.

### Architecture

```
AI client (Claude, Cursor, etc.)
    │  HTTP SSE  (Authorization: Bearer …)
    ▼
Cloudflare Worker  (/mcp)
    │
    ▼
EmDashMCP  (Durable Object)
    │
    ▼
EmDashClient  →  EmDash CMS REST API
```

### Class: `EmDashMCP extends McpAgent<Env>`

**Env bindings used**

| Binding | Purpose |
|---------|---------|
| `EMDASH_URL` | Base URL of the EmDash site (default: `https://wp.engdawood.com`) |
| `EMDASH_TOKEN` | API token passed to `EmDashClient` for authenticated CMS requests |
| `MCP_OBJECT` | Durable Object namespace (self-reference, required by the Agents SDK) |

**Internal helpers** (defined inside `init()`)

- `req(method, path, body?)` — typed wrapper around `EmDashClient`'s private `.request()` method. Confines the `as any` cast to one place.

**Response helper** (module-level)

- `jsonText(data)` — wraps any value in the MCP text content envelope: `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }`.

---

### Tools Reference

#### Collections

| Tool | Description |
|------|-------------|
| `list_collections` | List all content collections (projects, posts, pages, etc.) |

**`list_collections`** — no parameters. Returns an array of collection objects with their slugs, labels, and field schemas.

---

#### Content

| Tool | Description |
|------|-------------|
| `list_content` | List entries in a collection with optional status filter and limit |
| `get_content` | Get a single entry by ID or slug |
| `create_content` | Create a new entry; auto-publishes by default |
| `update_content` | Update fields on an existing entry |
| `delete_content` | Move an entry to trash (soft delete — reversible from admin) |
| `publish_content` | Publish a draft entry |

**`list_content`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Collection slug (e.g. `projects`, `posts`, `pages`) |
| `status` | `"published" \| "draft" \| "all"` | No | Filter by status (default: all) |
| `limit` | integer 1–100 | No | Max entries to return (default: 50) |

**`get_content`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Collection slug |
| `id` | string | Yes | Entry ULID or slug |

**`create_content`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Collection slug |
| `data` | object | Yes | Field values. Posts: `title`, `excerpt`, `content` (markdown). Projects: `title`, `client`, `year`, `summary`, `content`, `url`. Image fields accept a media ID from `upload_media_from_url`. |
| `slug` | string | No | Custom URL slug — auto-generated from title if omitted |
| `draft` | boolean | No | Save as draft instead of publishing (default: false) |

**`update_content`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Collection slug |
| `id` | string | Yes | Entry ID |
| `data` | object | Yes | Fields to update (only include changed fields) |
| `rev` | string | No | Revision token from `get_content` — prevents overwriting concurrent edits |
| `draft` | boolean | No | Save as draft instead of publishing (default: false) |

**`delete_content`** / **`publish_content`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Collection slug |
| `id` | string | Yes | Entry ID |

> `delete_content` sets `deleted_at` on the row (soft delete). The entry can be restored from the admin panel. Use `permanentDelete` via the admin if you need to fully remove the record.

---

#### Search

| Tool | Description |
|------|-------------|
| `search_content` | Full-text search across all content |

**`search_content`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `collection` | string | No | Limit results to a specific collection |
| `limit` | integer 1–50 | No | Max results (default: 10) |

---

#### Media

| Tool | Description |
|------|-------------|
| `list_media` | List uploaded media files |
| `upload_media_from_url` | Fetch a remote file and upload it to the media library |

**`list_media`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer 1–100 | No | Max items (default: 50) |
| `mimeType` | string | No | Filter by MIME type, e.g. `image/jpeg` |

**`upload_media_from_url`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string (URL) | Yes | Public URL of the file to fetch and upload |
| `filename` | string | No | Override filename (default: derived from URL) |
| `alt` | string | No | Alt text for accessibility |
| `caption` | string | No | Optional caption |

Returns the full media item object including its `id`, which can be used in content `data` fields that accept media references.

---

#### Taxonomies

| Tool | Description |
|------|-------------|
| `list_taxonomy_terms` | List all terms for a taxonomy |
| `get_term` | Get a single term by slug (includes entry count and child terms) |
| `get_content_terms` | Get taxonomy terms assigned to a content entry |
| `set_content_terms` | Assign terms to a content entry (replaces existing) |

**`list_taxonomy_terms`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taxonomy` | string | Yes | Taxonomy name: `category` or `tag` |

**`get_term`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taxonomy` | string | Yes | Taxonomy name: `category` or `tag` |
| `slug` | string | Yes | Term slug |

**`get_content_terms`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Collection slug |
| `id` | string | Yes | Entry ID or slug |
| `taxonomy` | string | Yes | Taxonomy name: `category` or `tag` |

**`set_content_terms`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Collection slug |
| `id` | string | Yes | Entry ID or slug |
| `taxonomy` | string | Yes | Taxonomy name: `category` or `tag` |
| `termIds` | string[] | Yes | Term IDs to assign — use `list_taxonomy_terms` to get IDs. Replaces all existing terms for this taxonomy. |

---

#### Bylines (Authorship)

| Tool | Description |
|------|-------------|
| `list_bylines` | List author/contributor byline profiles |
| `set_content_bylines` | Assign author credits to a content entry (replaces existing) |

**`list_bylines`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Filter by name |
| `limit` | integer 1–100 | No | Max results (default: 50) |

**`set_content_bylines`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Collection slug |
| `id` | string | Yes | Entry ID |
| `bylines` | array | Yes | Ordered list of byline credits |
| `bylines[].bylineId` | string | Yes | Byline profile ID from `list_bylines` |
| `bylines[].roleLabel` | string | No | Optional role label, e.g. `"Photographer"` |

---

#### Sections

| Tool | Description |
|------|-------------|
| `list_sections` | List reusable page sections (content blocks) |

**`list_sections`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer 1–100 | No | Max results (default: 50) |
| `search` | string | No | Filter by title or slug |

---

#### Site

| Tool | Description |
|------|-------------|
| `get_site_settings` | Get site-wide settings (title, tagline, logo, favicon, etc.) |
| `get_menu` | Get a navigation menu and its items by name |

**`get_site_settings`** — no parameters.

**`get_menu`**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Menu name, e.g. `"primary"` |

---

### Connecting a client

**Claude Desktop / Claude Code**

Add to your MCP config:

```json
{
  "mcpServers": {
    "emdash": {
      "type": "sse",
      "url": "https://<your-worker-domain>/mcp?token=<EMDASH_TOKEN>"
    }
  }
}
```

Or use the `Authorization` header if your client supports it:

```
Authorization: Bearer <EMDASH_TOKEN>
```

---

## Live Content Collection (`src/live.config.ts`)

Registers the `_emdash` Astro live collection so CMS content can be queried natively in `.astro` files and API routes.

```ts
export const collections = {
  _emdash: defineLiveCollection({ loader: emdashLoader() }),
};
```

| Function | Source | Description |
|----------|--------|-------------|
| `defineLiveCollection` | `astro:content` | Astro API for defining a live (runtime-fetched) collection |
| `emdashLoader()` | `emdash/runtime` | EmDash loader that connects to the CMS and handles type mapping |

**Usage in pages**

```ts
import { getEmDashCollection, getEmDashEntry } from "emdash/runtime";

const projects = await getEmDashCollection("projects");
const post = await getEmDashEntry("posts", "my-post-slug");
```
