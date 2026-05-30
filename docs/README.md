# Codebase Documentation

Welcome to the internal technical documentation for the project. This documentation is intended for developers working on the codebase, providing deep technical insights into the structure, API, and components of the application.

## Documentation Index

The documentation is organized into logical modules:

1. **[Components](./components.md)**
   - Detailed API references for all Astro UI components.
   - Includes props, rendering logic, and usage examples for `LanguageSwitcher`, `PostCard`, `ProjectCard`, and `TagList`.

2. **[Routing & Pages](./routing_and_pages.md)**
   - Explanation of the Astro file-based routing architecture.
   - Details on internationalization (i18n) routing (`[locale]`) and dynamic routes.

3. **[Utilities](./utilities.md)**
   - Function signatures and explanations for helper utilities such as `reading-time.ts` and `i18n/utils.ts`.

4. **[Data & State](./data.md)**
   - Documentation of static data structures and types, specifically `skills.ts`.

5. **[MCP & Worker Architecture](./mcp_worker.md)**
   - Deep dive into the backend and integration layers.
   - Documentation for the Cloudflare Worker (`worker.ts`), Model Context Protocol server (`mcp/index.ts`), and core configuration (`live.config.ts`).

6. **[MCP API Reference](./mcp_api_reference.md)**
   - Exhaustive API documentation for all tools exposed by the Model Context Protocol server, including exact parameters and schemas.

7. **[SEO Architecture](./seo.md)**
   - Full SEO setup: meta tags, Open Graph, hreflang, JSON-LD schemas, sitemap, robots.txt, and RSS feed.
   - Includes how to pass SEO props, use `getSeoMeta()`, and extend for new locales.
