# MCP API Reference

This document provides a comprehensive, deep technical reference for all the tools exposed by the integrated Model Context Protocol (MCP) server located in `src/mcp/index.ts`. 

These tools are available to any AI agent connecting to the `/mcp` endpoint over Server-Sent Events (SSE).

## Collections & Content

### `list_collections`
List all content collections (e.g., projects, posts, pages).
- **Parameters:** None

### `list_content`
List entries in a specific collection.
- **Parameters:**
  - `collection` (string, required): Collection slug (`projects`, `posts`, or `pages`).
  - `status` (enum, optional): Filter by status (`"published"`, `"draft"`, `"all"`). Default is `"all"`.
  - `limit` (number, optional): Max entries to return (1-100). Default is 50.

### `get_content`
Get a single content entry by its ID or slug.
- **Parameters:**
  - `collection` (string, required): Collection slug.
  - `id` (string, required): Entry ID (ULID) or slug.

### `create_content`
Create a new entry in a collection. Auto-publishes by default unless `draft` is true.
- **Parameters:**
  - `collection` (string, required): Collection slug.
  - `data` (object, required): Field values. 
    - *For posts:* `title`, `excerpt`, `content` (markdown).
    - *For projects:* `title`, `client`, `year`, `summary`, `content` (markdown), `url`.
  - `slug` (string, optional): Custom URL slug. Auto-generated from title if omitted.
  - `draft` (boolean, optional): Save as draft instead of publishing. Default is `false`.

### `update_content`
Update an existing entry. (Best practice: fetch with `get_content` first to get the `_rev` token).
- **Parameters:**
  - `collection` (string, required): Collection slug.
  - `id` (string, required): Entry ID.
  - `data` (object, required): Fields to update (only include changed fields).
  - `rev` (string, optional): Revision token to prevent overwriting concurrent edits.
  - `draft` (boolean, optional): Save as draft instead of publishing.

### `delete_content`
Soft-delete a content entry.
- **Parameters:**
  - `collection` (string, required): Collection slug.
  - `id` (string, required): Entry ID.

### `publish_content`
Publish a draft entry.
- **Parameters:**
  - `collection` (string, required): Collection slug.
  - `id` (string, required): Entry ID.

### `search_content`
Full-text search across all content.
- **Parameters:**
  - `query` (string, required): Search query.
  - `collection` (string, optional): Limit search to a specific collection.
  - `limit` (number, optional): Max results (1-50). Default is 10.

---

## Media Management

### `list_media`
List uploaded media files.
- **Parameters:**
  - `limit` (number, optional): Max items (1-100). Default is 50.
  - `mimeType` (string, optional): Filter by MIME type (e.g., `image/jpeg`).

### `upload_media_from_url`
Fetch an image or file from a public URL and upload it to the media library. Returns the media item ID to be used in content fields.
- **Parameters:**
  - `url` (string, required): Public URL of the file.
  - `filename` (string, optional): Override filename.
  - `alt` (string, optional): Alt text for accessibility.
  - `caption` (string, optional): Optional caption.

---

## Taxonomies & Categorization

### `list_taxonomy_terms`
List all terms for a given taxonomy.
- **Parameters:**
  - `taxonomy` (string, required): Taxonomy name (e.g., `category` or `tag`).

### `get_content_terms`
Get the taxonomy terms currently assigned to a specific content entry.
- **Parameters:**
  - `collection` (string, required): Collection slug.
  - `id` (string, required): Entry ID or slug.
  - `taxonomy` (string, required): Taxonomy name.

### `set_content_terms`
Assign taxonomy terms to a content entry. Replaces all existing terms for that taxonomy on the entry.
- **Parameters:**
  - `collection` (string, required): Collection slug.
  - `id` (string, required): Entry ID or slug.
  - `taxonomy` (string, required): Taxonomy name.
  - `termIds` (array of strings, required): Array of term IDs to assign (fetch these via `list_taxonomy_terms`).

---

## Bylines (Authorship)

### `list_bylines`
List author/contributor byline profiles.
- **Parameters:**
  - `search` (string, optional): Filter by name.
  - `limit` (number, optional): Max results (1-100). Default is 50.

### `set_content_bylines`
Assign author credits to a content entry. Replaces all existing bylines.
- **Parameters:**
  - `collection` (string, required): Collection slug.
  - `id` (string, required): Entry ID.
  - `bylines` (array of objects, required): Ordered list of credits. Each object contains:
    - `bylineId` (string, required): ID from `list_bylines`.
    - `roleLabel` (string, optional): e.g., "Photographer".

---

## Site Structure & Layout

### `list_sections`
List reusable page sections (content blocks) available on the site.
- **Parameters:**
  - `limit` (number, optional): Max results (1-100). Default is 50.
  - `search` (string, optional): Filter by title or slug.

### `get_site_settings`
Get site-wide settings including title, tagline, logo, and favicon.
- **Parameters:** None

### `get_menu`
Get a navigation menu and its items by name.
- **Parameters:**
  - `name` (string, required): Menu name (e.g., `"primary"`).

### `get_term`
Get a single taxonomy term by its slug (includes entry count and child terms).
- **Parameters:**
  - `taxonomy` (string, required): Taxonomy name.
  - `slug` (string, required): Term slug.