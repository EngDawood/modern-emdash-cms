import { getCollectionInfo } from "emdash";

/**
 * Collections served by the catch-all `/[locale]/[collection]` routes.
 *
 * Any collection created in the admin with a URL pattern gets public pages at
 * `/{locale}/{collection-slug}/{entry-slug}` without a new route file. Ones
 * with hand-written routes (blog, projects, pages…) never reach this: Astro
 * matches static path segments before dynamic ones.
 */
export async function getRoutableCollection(slug: string | undefined) {
	if (!slug) return null;
	const info = await getCollectionInfo(slug);
	if (!info?.urlPattern || info.routable === false) return null;
	return info;
}
