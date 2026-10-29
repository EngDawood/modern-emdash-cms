import { getCollectionInfo, SchemaRegistry } from "emdash";
import { getDb } from "emdash/runtime";

/**
 * Collections with hand-written routes, sitemap/feed/llms.txt entries and
 * search handling. Everything else routable is served by the catch-all.
 */
const HANDWRITTEN = new Set(["posts", "projects", "pages"]);

function isCatchAll(info: { slug: string; urlPattern?: string; routable?: boolean }) {
	return Boolean(info.urlPattern) && info.routable !== false && !HANDWRITTEN.has(info.slug);
}

/**
 * Collections served by the catch-all `/[locale]/[collection]` routes.
 *
 * Any collection created in the admin with a URL pattern gets public pages at
 * `/{locale}/{collection-slug}/{entry-slug}` without a new route file.
 */
export async function getRoutableCollection(slug: string | undefined) {
	if (!slug) return null;
	const info = await getCollectionInfo(slug);
	return info && isCatchAll(info) ? info : null;
}

/**
 * Every catch-all collection, so the sitemap, feeds, llms.txt and search pick
 * up new collections without code changes.
 */
export async function listRoutableCollections() {
	const all = await new SchemaRegistry(await getDb()).listCollections();
	return all.filter(isCatchAll);
}
