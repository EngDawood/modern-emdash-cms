# SEO Architecture

This document covers the full SEO setup for the portfolio — what exists, how it works, and how to extend it.

---

## Overview

| Feature | Status | Location |
|---|---|---|
| Meta tags (title, description) | ✅ | `Base.astro` via `EmDashHead` |
| Open Graph / Twitter cards | ✅ | `EmDashHead` (EmDash CMS) |
| Canonical URL | ✅ | `EmDashHead` |
| hreflang (ar/en) | ✅ | `Base.astro` |
| JSON-LD — WebSite schema | ✅ | `Base.astro` |
| JSON-LD — BlogPosting schema | ✅ | `Base.astro` (articles only) |
| `robots.txt` | ✅ | `public/robots.txt` |
| Sitemap | ✅ | `src/pages/sitemap.xml.ts` |
| RSS feed | ✅ | `src/pages/rss.xml.ts` |

---

## How It Works

### 1. Meta Tags & Open Graph

Handled by EmDash CMS via the `EmDashHead` component in `Base.astro`. It receives a `pageCtx` object built by `createPublicPageContext()`:

```ts
const pageCtx = createPublicPageContext({
  Astro,
  title: fullTitle,
  description,
  canonical: canonical ?? Astro.url.href,
  image,
  pageType: type,           // "website" | "article"
  seo: { ogImage: image, robots },
  articleMeta: { publishedTime, modifiedTime, author },
  siteName: siteTitle,
});
```

`EmDashHead` outputs: `<title>`, `<meta name="description">`, `<meta property="og:*">`, `<meta name="twitter:*">`, and `<link rel="canonical">`.

### 2. hreflang

Added directly in `Base.astro`. The current URL path has its locale prefix stripped, then rebuilt for each locale:

```ts
const pathWithoutLocale = Astro.url.pathname.replace(/^\/(ar|en)/, "") || "/";
const hrefAr = `${Astro.url.origin}/ar${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
const hrefEn = `${Astro.url.origin}/en${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
```

Output in `<head>`:
```html
<link rel="alternate" hreflang="ar" href="https://engdawood.com/ar/posts/my-post" />
<link rel="alternate" hreflang="en" href="https://engdawood.com/en/posts/my-post" />
<link rel="alternate" hreflang="x-default" href="https://engdawood.com/ar/posts/my-post" />
```

`x-default` points to the Arabic version since that is the `defaultLocale`.

### 3. JSON-LD Structured Data

Two schemas are injected in `Base.astro`:

**WebSite** — emitted on every page:
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Studio",
  "url": "https://engdawood.com"
}
```

**BlogPosting** — emitted only when `type="article"` and `publishedTime` is provided:
```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Post Title",
  "url": "https://engdawood.com/ar/posts/slug",
  "datePublished": "2025-01-01T00:00:00.000Z",
  "dateModified": "2025-01-02T00:00:00.000Z",
  "description": "...",
  "image": "https://...",
  "author": { "@type": "Person", "name": "Dawood" }
}
```

The post template (`src/pages/[locale]/posts/[slug].astro`) passes `type="article"` and the publication dates to `Base`, which triggers this schema automatically.

### 4. Sitemap

**File:** `src/pages/sitemap.xml.ts`

A custom SSR endpoint (required because the site uses server rendering — `@astrojs/sitemap` only works for static sites). It fetches all content from EmDash at request time and builds the XML:

- Fetches posts, projects, and pages in parallel
- Generates URLs for both `/ar/` and `/en/` variants of every page
- Includes `<xhtml:link>` hreflang alternates inside each `<url>` block (the correct sitemap approach)
- Sets `<lastmod>` from `updatedAt` or `publishedAt` on content entries
- Cached for 1 hour (`Cache-Control: public, max-age=3600`)

Accessible at: `https://engdawood.com/sitemap.xml`

### 5. robots.txt

**File:** `public/robots.txt`

```
User-agent: *
Allow: /
Sitemap: https://engdawood.com/sitemap.xml
```

Allows all crawlers and points them to the sitemap.

### 6. RSS Feed

**File:** `src/pages/rss.xml.ts`

A manual SSR RSS feed (does not use `@astrojs/rss`). Currently includes projects only. To add posts, duplicate the projects query for the `posts` collection and merge the item arrays.

Accessible at: `https://engdawood.com/rss.xml`

---

## Passing SEO Props

### From any page to Base layout

```astro
<Base
  title="Page Title"
  description="Page description for meta and OG."
  image="https://engdawood.com/og-image.jpg"
  canonical="https://engdawood.com/ar/posts/my-post"
  robots="index, follow"
  type="article"
  publishedTime="2025-01-01T00:00:00.000Z"
  modifiedTime="2025-01-02T00:00:00.000Z"
  author="Dawood"
  locale="ar"
/>
```

All props are optional. Defaults:
- `type` → `"website"`
- `description` → site tagline from EmDash settings
- `canonical` → current `Astro.url.href`
- `locale` → detected from URL path, falls back to `defaultLocale` (`ar`)

### Using `getSeoMeta()` (post/project pages)

EmDash provides `getSeoMeta()` to extract SEO fields from a content entry:

```ts
import { getSeoMeta } from "emdash";

const seo = getSeoMeta(post, {
  siteTitle,
  siteUrl: Astro.url.origin,
  path: `/posts/${slug}`,
  defaultOgImage: featuredImageUrl,
});

// Then pass to Base:
// title={seo.title} description={seo.description} image={seo.ogImage}
// canonical={seo.canonical} robots={seo.robots}
```

---

## Adding a New Locale

If a third locale is added (e.g., `fr`):

1. Add it to `src/i18n/utils.ts` → `locales` array
2. Update the hreflang logic in `Base.astro` to include the new locale
3. Update `src/pages/sitemap.xml.ts` → `LOCALES` constant at the top of the file

---

## Verification

After deploying, test with:

- **Google Search Console** — submit `https://engdawood.com/sitemap.xml`
- **Rich Results Test** — `https://search.google.com/test/rich-results`
- **hreflang validator** — check `<link rel="alternate">` in page source
- **robots.txt** — `https://engdawood.com/robots.txt`
