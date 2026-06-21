# RSS Aggregator Plugin

Local native plugin at `src/plugins/rss-aggregator/`. Imports RSS/Atom feeds into EmDash content, with an optional AI Content Suite for summarization, rewriting, and translation.

**Branch:** `feat/improve-rss-aggregator-with-AI`

---

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Storage Collections](#storage-collections)
4. [Plugin Settings](#plugin-settings)
5. [Source Settings](#source-settings)
6. [Import Pipeline](#import-pipeline)
7. [AI Content Suite](#ai-content-suite)
8. [Image Import](#image-import)
9. [Custom Field Mapping](#custom-field-mapping)
10. [Manual Curation](#manual-curation)
11. [Full-Text RSS](#full-text-rss)
12. [Displays](#displays)
13. [Admin Routes](#admin-routes)
14. [Public API](#public-api)
15. [Cron Jobs](#cron-jobs)

---

## Overview

The plugin fetches RSS 2.0 and Atom feeds on a per-source schedule, stores items in plugin storage (`feedItems` collection), and optionally mirrors them as EmDash content entries. Premium features include:

- AI summarization, rewriting, and translation (via any OpenAI-compatible endpoint)
- AI credit ledger (monthly cap)
- Image import to EmDash media library (R2)
- Custom RSS→content field mapping
- Manual curation (pending approval queue)
- Full-text RSS (scrapes article pages for excerpt-only feeds)
- Feed-to-Post (converts feed items into regular content entries)
- Keyword filtering (include/exclude by title or content)
- YouTube and podcast/audio detection

---

## Setup

```js
// astro.config.mjs
import { rssAggregatorPlugin } from "./src/plugins/rss-aggregator/src/index.js";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [rssAggregatorPlugin()],
    }),
  ],
});
```

**Options** (`RssAggregatorOptions`):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `contentCollection` | `string` | `"feed-items"` | EmDash collection for imported items |
| `fetchInterval` | `number` | `60` | Global fetch interval (minutes) |
| `feedToPost` | `boolean` | `false` | Enable Feed-to-Post globally |
| `postCollection` | `string` | `"posts"` | Default post collection for Feed-to-Post |

Capabilities declared: `read:content`, `write:content`, `read:media`, `write:media`, `network:fetch`.

---

## Storage Collections

| Collection | Type | Key indexes |
|------------|------|-------------|
| `sources` | `Source` | `status`, `tag`, `createdAt`, `[status, nextFetchAt]` |
| `feedItems` | `FeedItem` | `sourceId`, `guid`, `publishedAt`, `[sourceId, publishedAt]`, `[sourceId, guid]` |
| `displays` | `Display` | `name` |
| `rejectList` | `RejectListEntry` | `guid`, `sourceId`, `createdAt` |
| `importLogs` | `ImportLog` | `sourceId`, `status`, `createdAt`, `[sourceId, createdAt]` |
| `folders` | `Folder` | `slug`, `name` |

---

## Plugin Settings

Stored in KV under the `settings:*` prefix. Editable in the admin Settings page or via the `settings/save` route.

### Core

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `globalFetchInterval` | `number` | `60` | Minutes between feed checks |
| `maxItemsPerSource` | `number` | `200` | Items kept per source (oldest deleted first) |
| `maxItemAge` | `number` | `0` | Delete items older than this. `0` = keep forever |
| `maxItemAgeUnit` | `"days" \| "hours"` | `"days"` | Unit for `maxItemAge` |
| `defaultUniqueBy` | `"guid" \| "title"` | `"guid"` | Duplicate detection method |
| `defaultReconcileStrategy` | `"preserve" \| "overwrite"` | `"preserve"` | Behavior on duplicates |
| `defaultOpenInNewTab` | `boolean` | `true` | Links open in new tab by default |
| `defaultNofollow` | `boolean` | `true` | Add `rel="nofollow"` to links |
| `logRetentionDays` | `number` | `30` | Days to keep import logs. `0` = forever |
| `contentCollection` | `string` | `"feed-items"` | EmDash collection for synced entries |
| `userAgent` | `string` | `"EmDash RSS Aggregator/1.0"` | HTTP User-Agent for feed fetches |
| `fetchTimeout` | `number` | `30000` | Request timeout in ms |
| `enableYouTubeDetection` | `boolean` | `true` | Detect YouTube URLs and extract video IDs |

### Feed-to-Post

| Setting | Default | Description |
|---------|---------|-------------|
| `enableFeedToPost` | `false` | Enable global Feed-to-Post |
| `defaultPostCollection` | `"posts"` | Target collection |
| `defaultPostStatus` | `"draft"` | Initial status for created posts |

### Outgoing Feed

| Setting | Default | Description |
|---------|---------|-------------|
| `enableCustomFeed` | `false` | Serve aggregated items as RSS at the public API endpoint |
| `customFeedTitle` | `"Aggregated Feed"` | Feed title |
| `customFeedLimit` | `50` | Max items |
| `customFeedFormat` | `"rss2"` | `"rss2"` or `"atom"` |

### Full-Text RSS

| Setting | Default | Description |
|---------|---------|-------------|
| `enableFullText` | `false` | Enable full-text scraping globally |
| `fullTextMinWords` | `0` | Only scrape when excerpt is shorter than this. `0` = always when enabled |

### AI Content Suite

| Setting | Default | Description |
|---------|---------|-------------|
| `aiEnabled` | `false` | Master switch for all AI features |
| `aiApiEndpoint` | `"https://api.openai.com/v1/chat/completions"` | OpenAI-compatible endpoint |
| `aiApiKey` | `""` | Bearer key (secret — stored in KV, rendered as password field) |
| `aiModel` | `"gpt-4o-mini"` | Model identifier |
| `aiSummaryEnabled` | `false` | Auto-generate TL;DR summaries on import |
| `aiSummaryWords` | `50` | Target summary length in words |
| `aiRewriteEnabled` | `false` | Auto-rewrite items in the owner's voice on import |
| `aiOwnerVoice` | `""` | Voice/tone description used in rewrite prompts |
| `aiCreditMonthlyLimit` | `0` | Monthly credit cap. `0` = unlimited |

### Multilingual Translation

| Setting | Default | Description |
|---------|---------|-------------|
| `translationEnabled` | `false` | Enable translating imported content |
| `translationLocales` | `""` | Comma-separated BCP-47 locales, e.g. `"ar,fr"` |

### Image Import

| Setting | Default | Description |
|---------|---------|-------------|
| `imageImportEnabled` | `false` | Download featured images to media library |
| `imageImportContentImages` | `false` | Also import in-content `<img>` URLs |
| `imageImportMaxPerItem` | `10` | Max images per item |

### Manual Curation

| Setting | Default | Description |
|---------|---------|-------------|
| `curationEnabled` | `false` | Import items as `"pending"` requiring manual approval |

---

## Source Settings

Each source (`Source`) can override most global settings. Key per-source fields:

| Field | Description |
|-------|-------------|
| `url` | Feed URL |
| `status` | `"active"` \| `"paused"` \| `"error"` |
| `tag` | Optional tag for grouping |
| `importLimit` | Max items to keep for this source |
| `importOrder` | `"asc"` or `"desc"` — import oldest or newest first |
| `ageLimit` / `ageLimitUnit` | Drop items older than this |
| `uniqueBy` | `"guid"` or `"title"` |
| `reconcileStrategy` | `"preserve"` or `"overwrite"` |
| `enableFullText` | Full-text scraping for this source |
| `enableAiSummary` | AI summarization for this source |
| `enableAiRewrite` | AI rewriting for this source |
| `enableTranslation` | Translation for this source |
| `importImages` | Image import for this source |
| `fieldMappings` | `FieldMapping[]` — custom RSS→content field rules |
| `requireApproval` | Override curation for this source |
| `feedToPost` | Enable Feed-to-Post for this source |
| `postCollection` / `postStatus` | Target collection and status |
| `keywordFilterEnabled` / `keywordFilterMode` / `keywords` | Keyword filtering |
| `authorHandling` | `"from-feed"`, `"fallback"`, or `"override"` |
| `assignFeaturedImage` / `featuredImageSource` | Featured image handling |
| `fetchInterval` | Per-source fetch interval (minutes) |
| `nextFetchAt` | ISO timestamp of next scheduled fetch |
| `futureActivateAt` / `futurePauseAt` | Scheduled activation / pause |

---

## Import Pipeline

Triggered by cron (`fetch-pending-sources`) or the `sources/fetch-now` route. Per-item order inside `feed-fetcher.ts`:

```
Parse feed XML
  └── Filter by ageLimit, keyword rules, duplicate detection (guid/title)
      └── For each new/updated item:
          1. Full-text fetch     (if enableFullText + word threshold)
          2. Image import        (if importImages; uploads to media library)
          3. Custom field map    (applyFieldMappings on raw XML)
          4. AI suite            (summarize → rewrite → translate; each gated on settings)
          5. Curation status     (status = "pending" | "approved")
          6. Write to feedItems  (plugin storage)
          7. Write content entry (if status === "approved")
          8. Feed-to-Post        (if feedToPost && status === "approved")
```

`rewrittenContent` (when set) takes precedence over `content` in the Feed-to-Post payload.

---

## AI Content Suite

Module: `src/plugins/rss-aggregator/src/ai-service.ts`

All AI calls are made via `ctx.http.fetch` to an OpenAI-compatible chat completions endpoint. There is **no** `ctx.ai` — Cloudflare Workers AI is not used.

### Credit Ledger

Credits are stored in KV:

| KV Key | Value |
|--------|-------|
| `credits:limit` | Monthly cap (`0` = unlimited) |
| `credits:used` | Credits consumed in the current period |
| `credits:period` | Accounting period in `YYYY-MM` |

The period rolls over automatically at the start of each new calendar month (UTC). Each successful AI operation costs 1 credit. The gate is checked **before** the API call; credits are consumed only after a successful response.

### Functions

```ts
getCreditState(ctx, settings): Promise<CreditState>
consumeCredits(ctx, settings, amount): Promise<{ ok: boolean; state: CreditState }>
setCreditLimit(ctx, limit): Promise<CreditState>
resetCredits(ctx): Promise<CreditState>

summarize(ctx, settings, { title, content }): Promise<AiResult<string>>
rewriteInVoice(ctx, settings, { title, content, voice }): Promise<AiResult<string>>
translate(ctx, settings, { title?, excerpt?, content?, summary?, targetLocale }): Promise<AiResult<ItemTranslation>>
```

```ts
interface AiResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
  creditsUsed: number;
}

interface CreditState {
  limit: number;  // 0 = unlimited
  used: number;
  period: string; // "YYYY-MM"
}
```

Input content is truncated to 6 000 characters (after stripping HTML) before being forwarded to the model.

---

## Image Import

Module: `src/plugins/rss-aggregator/src/image-importer.ts`

Downloads the featured image and (optionally) all `<img>` URLs found in the item content, uploads them to the EmDash media library (`ctx.media.upload`), and rewrites `<img src>` attributes in the content HTML to point at the stored media URLs.

- **No-op** when `ctx.media?.upload` is absent.
- Skips `data:` URIs and images already on the same origin as the site.
- Capped at `imageImportMaxPerItem` (default 10) downloads per item.
- Uses string replacement (`split/join`) to rewrite URLs — no DOM parser.

```ts
interface ImageImportResult {
  featuredUrl?: string;      // new media URL for the featured image
  featuredMediaId?: string;
  content: string;           // content HTML with rewritten img src
  mediaIds: string[];        // all created media IDs
}
```

---

## Custom Field Mapping

Module: `src/plugins/rss-aggregator/src/field-mapper.ts`

Maps arbitrary RSS/XML fields to content fields, defined per-source as `Source.fieldMappings: FieldMapping[]`.

```ts
interface FieldMapping {
  rssField: string;     // tag name, "tag@attr" for attribute, or known prop name
  targetField: string;  // key in the content payload
  transform?: "none" | "strip-html" | "truncate" | "date" | "lowercase" | "uppercase";
  truncateLength?: number; // used when transform === "truncate"
}
```

### `rssField` resolution order

1. **Attribute syntax** `tag@attr` — reads `attr` off the first matching XML tag.
2. **Raw tag text** — extracts inner text of the first matching XML element (namespace-prefixed tags are handled).
3. **Known-prop fallback** — maps well-known names (`title`, `link`, `guid`, `description`, `content`, `author`, `pubdate`, `category`, `enclosure`, `thumbnail`) to their `ParsedItem` equivalents.

Mapped values are merged into `FeedItem.customFields` and also promoted to the top-level of the EmDash content payload.

---

## Manual Curation

Items are imported with `status: "pending"` when curation is enabled (globally or per-source). Pending items are stored in `feedItems` but **not** synced to EmDash content and **not** converted to posts until approved.

### Approval flow

1. Admin opens the Items page, filters by `status=pending`.
2. Clicks **Approve** → calls `items/approve`.
3. The route sets `status: "approved"`, writes the EmDash content entry, and (if `feedToPost`) creates the post entry. Any AI suite operations (summarize/rewrite/translate) deferred from import run at this point too.

### `ItemStatus`

```ts
type ItemStatus = "pending" | "approved" | "rejected";
```

Rejecting an item via `items/reject` adds the item's GUID to the `rejectList` (blocking future re-imports) and deletes the `feedItem`.

---

## Full-Text RSS

Module: `src/plugins/rss-aggregator/src/full-text.ts`

Fetches the article URL and extracts the main content using a readability-lite algorithm:

1. Extract `<body>`.
2. Strip noise elements (`script`, `style`, `nav`, `header`, `footer`, `aside`, `form`, `iframe`).
3. Prefer `<article>` if present.
4. Otherwise: find the `<div>` or `<section>` with the densest paragraph text (most total plain-text characters across its `<p>` children).
5. Fallback: collect all `<p>` elements from the full body.
6. Return `null` if the extracted text is shorter than 200 characters.

The result replaces `item.excerpt` / `item.content` in the pipeline. Full-text fetching is only attempted when:
- `source.enableFullText` is `true` (and `settings.enableFullText` is `true`).
- `settings.fullTextMinWords > 0` → only when the existing excerpt is shorter than that threshold.

---

## Displays

A `Display` configures layout and filtering for rendering a set of feed items in the frontend. The default display (`id: "default"`) is created on install.

Key layout fields: `layout` (`"list"` | `"grid"` | `"excerpts"` | `"thumbnails"`), `numItems`, `enablePagination`, `paginationStyle`.

Filter fields: `sources` (allowlist of source IDs), `excludeSources`, `tags`.

Used by the Astro components (`FeedList`, `RssFeedEmbed`, `RssFeedSource`) and the public API.

---

## Admin Routes

All routes are called via the EmDash plugin route mechanism. Authenticated.

### Sources

| Route | Input | Description |
|-------|-------|-------------|
| `sources` (GET) | `?status=&tag=&limit=&cursor=` | List sources |
| `sources/create` | `CreateSourceInput` | Create a source (validates URL on creation) |
| `sources/update` | `{ id } & UpdateSourceInput` | Update a source |
| `sources/delete` | `{ id }` | Delete source + all its items, logs, and reject-list entries |
| `sources/fetch-now` | `{ id }` | Trigger immediate import for one source |
| `sources/fetch-all` | — | Trigger import for all active sources |
| `validate-feed` | `{ url }` | Validate a feed URL and return feed metadata |

### Items

| Route | Input | Description |
|-------|-------|-------------|
| `items` (GET) | `?sourceId=&status=&limit=&cursor=` | List items |
| `items/delete` | `{ ids: string[] }` | Bulk delete items |
| `items/reject` | `{ id, reason? }` | Reject an item (adds to reject list, deletes item) |
| `items/approve` | `{ id }` | Approve a pending item (syncs content + Feed-to-Post) |
| `items/ai` | `{ id, action: "summarize"\|"rewrite"\|"translate", locale? }` | Run an AI operation on one item manually |

### AI Credits

| Route | Input | Description |
|-------|-------|-------------|
| `credits` (GET) | — | Read current credit state |
| `credits/save` | `{ limit?, reset? }` | Set a new monthly limit or reset the counter |

### Displays

| Route | Input | Description |
|-------|-------|-------------|
| `displays` | — | List all displays |
| `displays/create` | `CreateDisplayInput` | Create a display |
| `displays/update` | `{ id } & UpdateDisplayInput` | Update a display |
| `displays/delete` | `{ id }` | Delete a display (cannot delete `"default"`) |

### Folders

| Route | Input | Description |
|-------|-------|-------------|
| `folders` | — | List all folders |
| `folders/create` | `{ name, sourceIds? }` | Create a folder |
| `folders/update` | `{ id } & Partial<Folder>` | Update a folder |
| `folders/delete` | `{ id }` | Delete a folder |

### Reject List

| Route | Input | Description |
|-------|-------|-------------|
| `reject-list` | `?limit=&cursor=` | List reject-list entries |
| `reject-list/remove` | `{ id }` | Remove an entry (allows re-import of that GUID) |

### Logs

| Route | Input | Description |
|-------|-------|-------------|
| `logs` | `?sourceId=&status=&limit=&cursor=` | List import logs |
| `logs/clear` | `{ sourceId? }` | Delete logs (optionally scoped to one source) |

### Settings

| Route | Input | Description |
|-------|-------|-------------|
| `settings` (GET) | — | Return all current settings |
| `settings/save` | `Partial<PluginSettings>` | Persist one or more settings |

### Stats

| Route | Description |
|-------|-------------|
| `stats` | Dashboard counts: total/active/paused/error sources, total items, items today, last import |

---

## Public API

Unauthenticated endpoints for frontend consumption.

### `public/items`

```
GET ?display=<id>&source=<id>&tag=<tag>&limit=<n>&cursor=<cursor>
```

Returns paginated feed items, optionally filtered by display config, source ID, or tag. Includes a `display` object with layout configuration when a display is found.

### `public/feed.xml`

Returns the aggregated feed as RSS 2.0 or Atom. Requires `enableCustomFeed: true` in settings.

---

## Cron Jobs

Scheduled on `plugin:activate`, cancelled on `plugin:deactivate`.

| Job name | Schedule | Action |
|----------|----------|--------|
| `fetch-pending-sources` | `*/15 * * * *` | Check all active sources with `nextFetchAt <= now` and import due ones |
| `cleanup-old-logs` | `0 3 * * *` | Delete import logs older than `logRetentionDays` |
| `cleanup-old-items` | `0 4 * * *` | Delete feed items older than `maxItemAge` |

---

## File Map

```
src/plugins/rss-aggregator/src/
├── index.ts               Plugin descriptor factory (rssAggregatorPlugin)
├── sandbox-entry.ts       Runtime plugin (hooks, routes, cron handlers)
├── types.ts               All shared types and DEFAULT_SETTINGS
├── feed-fetcher.ts        Import pipeline (full-text → images → field-map → AI → curation)
├── feed-parser.ts         RSS 2.0 / Atom XML parser (regex-based, CF Workers safe)
├── ai-service.ts          AI Content Suite (summarize, rewrite, translate, credit ledger)
├── image-importer.ts      Image downloader and media library uploader
├── field-mapper.ts        Custom RSS→content field mapping
├── full-text.ts           Readability-lite full-text scraper
├── admin.tsx              Admin shell (router for admin pages)
├── astro/
│   ├── index.ts           Astro component exports
│   ├── FeedList.astro     Render a list of feed items
│   ├── FeedItem.astro     Render a single feed item
│   ├── RssFeedEmbed.astro Portable-text block: display by ID
│   └── RssFeedSource.astro Portable-text block: items by source ID
└── components/
    ├── SourcesPage.tsx    Admin: feed sources list and form
    ├── ItemsPage.tsx      Admin: items list with status filter, approve, AI actions
    ├── DisplaysPage.tsx   Admin: displays list and form
    ├── LogsPage.tsx       Admin: import log table
    ├── SettingsPage.tsx   Admin: all settings panels including AI, images, curation
    ├── StatsWidget.tsx    Admin dashboard widget
    ├── shared.tsx         Shared admin helpers (formatters, status badges)
    └── ui.tsx             Shared UI primitives (Input, Select, Button, etc.)
```
