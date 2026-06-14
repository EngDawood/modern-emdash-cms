import type { PublicPageContext } from "emdash";
import { buildPageUrl } from "./urls.js";

const NOINDEX_PATHS = new Set(["/search"]);

/**
 * Generate canonical URL.
 *
 * - Every indexable page gets one
 * - Omit on 404 and noindex pages
 * - Absolute, clean, with trailing slash
 * - Respect user override
 * - Include pagination parameter
 *
 * For content entries on i18n sites, `page.url` carries the bare slug path
 * (e.g. `/blog/slug`) without a locale prefix. We use `buildPageUrl` —
 * the same helper hreflang uses — to produce the correct locale-prefixed URL
 * (e.g. `/ar/blog/slug/`) so the canonical matches the real 200 URL instead
 * of a redirecting one.
 */
export async function generateCanonical(
  page: PublicPageContext,
  siteUrl: string,
): Promise<string | null> {
  const path = page.path || "/";

  // No canonical for 404 or noindex pages
  if (path === "/404") return null;
  if (page.seo?.robots?.includes("noindex")) return null;
  if (NOINDEX_PATHS.has(path)) return null;

  // User override
  if (page.canonical) return page.canonical;

  // For content entries use buildPageUrl to get the locale-prefixed URL.
  // page.url on collection pages is bare (e.g. /blog/slug) — without the
  // locale — which would produce a canonical pointing at a 302 redirect.
  if (page.kind === "content" && page.content && page.locale) {
    const { getI18nConfig, getCollectionInfo } = await import("emdash");
    const cfg = getI18nConfig();
    if (cfg) {
      let collection;
      try {
        collection = await getCollectionInfo(page.content.collection);
      } catch {
        // fall through to URL-based path below
      }
      if (collection?.urlPattern) {
        const slug = page.content.slug || page.content.id;
        const built = buildPageUrl({
          locale: page.locale,
          slug,
          siteUrl,
          cfg,
          urlPattern: collection.urlPattern,
        });
        if (built !== null) return built;
      }
    }
  }

  // Fallback: build from page URL (static/custom pages, or when collection
  // info is unavailable).
  try {
    const u = new URL(page.url, siteUrl);
    let pathname = u.pathname.toLowerCase().replace(/\/+/g, "/");

    // Ensure trailing slash
    if (!pathname.endsWith("/")) pathname += "/";

    // Build clean URL with only pagination param
    const pageParam = u.searchParams.get("page");
    let canonical = `${siteUrl.replace(/\/$/, "")}${pathname}`;
    if (pageParam && Number(pageParam) > 1) {
      canonical += `?page=${pageParam}`;
    }

    return canonical;
  } catch {
    return null;
  }
}
