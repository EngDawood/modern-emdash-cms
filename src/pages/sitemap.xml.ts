import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";

const LOCALES = ["ar", "en"] as const;

function urlEntry(origin: string, path: string, lastmod?: string): string {
	const loc = `${origin}${path}`;
	const alternates = LOCALES.map(
		(lang) =>
			`    <xhtml:link rel="alternate" hreflang="${lang}" href="${origin}/${lang}${path === "/" ? "" : path}"/>`
	).join("\n");
	return [
		"  <url>",
		`    <loc>${loc}</loc>`,
		alternates,
		lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
		"  </url>",
	]
		.filter(Boolean)
		.join("\n");
}

export const GET: APIRoute = async ({ url: reqUrl }) => {
	const origin = reqUrl.origin;

	const [postsResult, projectsResult, pagesResult] = await Promise.allSettled([
		getEmDashCollection("posts", { orderBy: { published_at: "desc" } }),
		getEmDashCollection("projects", { orderBy: { published_at: "desc" } }),
		getEmDashCollection("pages"),
	]);

	const posts = postsResult.status === "fulfilled" ? postsResult.value.entries : [];
	const projects = projectsResult.status === "fulfilled" ? projectsResult.value.entries : [];
	const pages = pagesResult.status === "fulfilled" ? pagesResult.value.entries : [];

	const today = new Date().toISOString().split("T")[0];

	const staticUrls = LOCALES.map((locale) =>
		urlEntry(origin, `/${locale}`, today)
	);

	const postUrls = posts.flatMap((post) => {
		const slug = post.data.slug || post.id;
		const lastmod = (post.data.updatedAt ?? post.data.publishedAt)
			?.toISOString()
			.split("T")[0];
		return LOCALES.map((locale) =>
			urlEntry(origin, `/${locale}/posts/${slug}`, lastmod)
		);
	});

	const projectUrls = projects.flatMap((project) => {
		const slug = project.data.slug || project.id;
		const lastmod = (project.data.updatedAt ?? project.data.publishedAt)
			?.toISOString()
			.split("T")[0];
		return LOCALES.map((locale) =>
			urlEntry(origin, `/${locale}/work/${slug}`, lastmod)
		);
	});

	const pageUrls = pages.flatMap((page) => {
		const slug = page.data.slug || page.id;
		return LOCALES.map((locale) =>
			urlEntry(origin, `/${locale}/pages/${slug}`)
		);
	});

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
${[...staticUrls, ...postUrls, ...projectUrls, ...pageUrls].join("\n")}
</urlset>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
