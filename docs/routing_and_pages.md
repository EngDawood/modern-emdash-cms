# Routing & Pages Architecture

This document describes the URL routing structure and internationalization (i18n) setup for the Astro application.

## Directory Structure

The application uses Astro's file-based routing. The `src/pages/` directory dictates the URL structure:

```text
src/pages/
├── index.astro             // Root redirect
├── [locale]/               // Localized routes
│   ├── index.astro         // Localized homepage
│   ├── category/           // Category archives
│   ├── pages/              // Static CMS pages
│   ├── posts/              // Blog posts
│   ├── tag/                // Tag archives
│   └── work/               // Portfolio projects
├── rss.xml.ts              // RSS Feed generator
└── 404.astro               // Not Found page
```

## Internationalization (i18n) Routing

All core content routes are wrapped inside the `[locale]` directory. This enables URL structures like `/en/work` or `/ar/posts`.

### Root Redirection
The top-level `src/pages/index.astro` does not render content. Instead, it performs an immediate 302 redirect to the default locale (Arabic):
```astro
return Astro.redirect("/ar/", 302);
```

### Route Validation
Inside `[locale]/index.astro` (and other localized pages), the `locale` param is extracted and validated against the known supported languages (defined in `src/i18n/utils.ts`):

```typescript
const { locale: localeParam } = Astro.params;
// Validates if the param is "en" or "ar"
const locale: Locale = locales.includes(localeParam as Locale)
	? (localeParam as Locale)
	: defaultLocale;

if (!locales.includes(localeParam as Locale)) {
	return Astro.redirect(`/${defaultLocale}/`, 302);
}
```

## Data Fetching

Because the project uses Server-Side Rendering (SSR) in conjunction with Cloudflare Workers, pages fetch data dynamically using EmDash helpers rather than statically building at compile time.

Example from `[locale]/index.astro`:
```typescript
import { getEmDashCollection, getSiteSettings } from "emdash";

const settings = await getSiteSettings();
const { entries: projects, cacheHint } = await getEmDashCollection("projects");

// Pass cache hints to Astro's caching layer
Astro.cache.set(cacheHint);
```

## Dynamic Routes

Files like `src/pages/[locale]/work/[slug].astro` handle individual item rendering based on the URL slug. They use the same `locale` validation strategy and query the EmDash CMS for the specific entry matching the slug.
