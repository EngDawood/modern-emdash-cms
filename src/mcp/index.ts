/**
 * EmDash MCP Agent (Cloudflare Workers)
 *
 * Remote MCP server deployed at /mcp on the existing EmDash worker.
 * Exposes the same tools as mcp/server.ts but over HTTP (SSE) instead of stdio.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { EmDashClient } from "emdash/client";
import { z } from "zod";

interface Env extends Cloudflare.Env {
	MCP_OBJECT: DurableObjectNamespace;
	EMDASH_URL?: string;
	EMDASH_TOKEN?: string;
}

export class EmDashMCP extends McpAgent<Env> {
	server = new McpServer({ name: "emdash", version: "1.0.0" });

	async init() {
		const baseUrl = this.env.EMDASH_URL ?? "https://wp.engdawood.com";
		const client = new EmDashClient({ baseUrl, token: this.env.EMDASH_TOKEN });

		// -----------------------------------------------------------------------
		// Collections
		// -----------------------------------------------------------------------

		this.server.tool(
			"list_collections",
			"List all content collections (projects, posts, pages, etc.)",
			{},
			async () => {
				const collections = await client.collections();
				return { content: [{ type: "text", text: JSON.stringify(collections, null, 2) }] };
			},
		);

		// -----------------------------------------------------------------------
		// Content
		// -----------------------------------------------------------------------

		this.server.tool(
			"list_content",
			"List entries in a collection (e.g. projects, posts)",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				status: z.enum(["published", "draft", "all"]).optional().describe("Filter by status (default: all)"),
				limit: z.number().int().min(1).max(100).optional().describe("Max entries to return (default: 50)"),
			},
			async ({ collection, status, limit }) => {
				const result = await client.list(collection, {
					status: status === "all" ? undefined : status,
					limit,
				});
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		this.server.tool(
			"get_content",
			"Get a single content entry by ID",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				id: z.string().describe("Entry ID (ULID) or slug"),
			},
			async ({ collection, id }) => {
				const item = await client.get(collection, id);
				return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
			},
		);

		this.server.tool(
			"create_content",
			"Create a new entry in a collection. Auto-publishes by default.",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				data: z.record(z.string(), z.unknown()).describe(
					"Field values. For posts: title, excerpt, content (markdown string). For projects: title, client, year, summary, content (markdown string), url. Image fields accept a media ID from upload_media_from_url.",
				),
				slug: z.string().optional().describe("URL slug — use this to set a custom path (e.g. 'my-post'). Auto-generated from title if omitted."),
				draft: z.boolean().optional().describe("Save as draft instead of publishing (default: false)"),
			},
			async ({ collection, data, slug, draft }) => {
				const item = await client.create(collection, {
					data,
					slug,
					status: draft ? "draft" : "published",
				});
				return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
			},
		);

		this.server.tool(
			"update_content",
			"Update an existing entry. Fetch the entry first with get_content to get its _rev token.",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				id: z.string().describe("Entry ID"),
				data: z.record(z.string(), z.unknown()).describe("Fields to update (only include changed fields)"),
				rev: z.string().optional().describe("Revision token from get_content (prevents overwriting concurrent edits)"),
				draft: z.boolean().optional().describe("Save as draft instead of publishing (default: false)"),
			},
			async ({ collection, id, data, rev, draft }) => {
				const item = await client.update(collection, id, {
					data,
					_rev: rev,
					status: draft ? "draft" : "published",
				});
				return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
			},
		);

		this.server.tool(
			"delete_content",
			"Soft-delete a content entry",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				id: z.string().describe("Entry ID"),
			},
			async ({ collection, id }) => {
				await client.delete(collection, id);
				return { content: [{ type: "text", text: `Deleted ${collection}/${id}` }] };
			},
		);

		this.server.tool(
			"publish_content",
			"Publish a draft entry",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				id: z.string().describe("Entry ID"),
			},
			async ({ collection, id }) => {
				await client.publish(collection, id);
				return { content: [{ type: "text", text: `Published ${collection}/${id}` }] };
			},
		);

		// -----------------------------------------------------------------------
		// Search
		// -----------------------------------------------------------------------

		this.server.tool(
			"search_content",
			"Full-text search across all content",
			{
				query: z.string().describe("Search query"),
				collection: z.string().optional().describe("Limit to a specific collection (projects, posts, etc.)"),
				limit: z.number().int().min(1).max(50).optional().describe("Max results (default: 10)"),
			},
			async ({ query, collection, limit }) => {
				const results = await client.search(query, { collection, limit: limit ?? 10 });
				return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
			},
		);

		// -----------------------------------------------------------------------
		// Media
		// -----------------------------------------------------------------------

		this.server.tool(
			"list_media",
			"List uploaded media files",
			{
				limit: z.number().int().min(1).max(100).optional().describe("Max items (default: 50)"),
				mimeType: z.string().optional().describe("Filter by MIME type, e.g. image/jpeg"),
			},
			async ({ limit, mimeType }) => {
				const result = await client.mediaList({ limit, mimeType });
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		this.server.tool(
			"upload_media_from_url",
			"Fetch an image or file from a URL and upload it to the media library. Returns the media item including its ID, which can be referenced in content fields.",
			{
				url: z.string().url().describe("Public URL of the file to fetch and upload"),
				filename: z.string().optional().describe("Override filename (default: derived from URL)"),
				alt: z.string().optional().describe("Alt text for accessibility"),
				caption: z.string().optional().describe("Optional caption"),
			},
			async ({ url, filename, alt, caption }) => {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
				}
				const blob = await response.blob();
				const name = filename ?? url.split("/").pop()?.split("?")[0] ?? "upload";
				const item = await client.mediaUpload(blob, name, { alt, caption });
				return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
			},
		);

		// -----------------------------------------------------------------------
		// Taxonomies
		// -----------------------------------------------------------------------

		this.server.tool(
			"list_taxonomy_terms",
			"List terms for a taxonomy (category or tag)",
			{
				taxonomy: z.string().describe("Taxonomy name: category or tag"),
			},
			async ({ taxonomy }) => {
				const result = await client.terms(taxonomy);
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		this.server.tool(
			"get_content_terms",
			"Get the taxonomy terms (categories, tags, etc.) currently assigned to a content entry",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				id: z.string().describe("Entry ID or slug"),
				taxonomy: z.string().describe("Taxonomy name: category or tag"),
			},
			async ({ collection, id, taxonomy }) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = await (client as any).request(
					"GET",
					`/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}/terms/${encodeURIComponent(taxonomy)}`,
				);
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		this.server.tool(
			"set_content_terms",
			"Assign taxonomy terms (categories or tags) to a content entry. Replaces all existing terms for that taxonomy.",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				id: z.string().describe("Entry ID or slug"),
				taxonomy: z.string().describe("Taxonomy name: category or tag"),
				termIds: z.array(z.string()).describe("Array of term IDs to assign. Use list_taxonomy_terms to get IDs."),
			},
			async ({ collection, id, taxonomy, termIds }) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = await (client as any).request(
					"POST",
					`/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}/terms/${encodeURIComponent(taxonomy)}`,
					{ termIds },
				);
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		// -----------------------------------------------------------------------
		// Bylines
		// -----------------------------------------------------------------------

		this.server.tool(
			"list_bylines",
			"List author/contributor byline profiles. Use the returned IDs with set_content_bylines.",
			{
				search: z.string().optional().describe("Filter by name"),
				limit: z.number().int().min(1).max(100).optional().describe("Max results (default: 50)"),
			},
			async ({ search, limit }) => {
				const params = new URLSearchParams();
				if (search) params.set("search", search);
				if (limit) params.set("limit", String(limit));
				const qs = params.toString();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = await (client as any).request("GET", `/admin/bylines${qs ? `?${qs}` : ""}`);
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		this.server.tool(
			"set_content_bylines",
			"Assign author credits (bylines) to a content entry. Replaces all existing byline assignments.",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				id: z.string().describe("Entry ID"),
				bylines: z.array(
					z.object({
						bylineId: z.string().describe("Byline profile ID from list_bylines"),
						roleLabel: z.string().optional().describe("Optional role label, e.g. 'Photographer'"),
					}),
				).describe("Ordered list of byline credits"),
			},
			async ({ collection, id, bylines }) => {
				// The update endpoint accepts bylines directly
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = await (client as any).request(
					"PUT",
					`/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
					{ bylines },
				);
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		// -----------------------------------------------------------------------
		// Sections
		// -----------------------------------------------------------------------

		this.server.tool(
			"list_sections",
			"List reusable page sections (content blocks) available on the site",
			{
				limit: z.number().int().min(1).max(100).optional().describe("Max results (default: 50)"),
				search: z.string().optional().describe("Filter by title or slug"),
			},
			async ({ limit, search }) => {
				const params = new URLSearchParams();
				if (limit) params.set("limit", String(limit));
				if (search) params.set("search", search);
				const qs = params.toString();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = await (client as any).request("GET", `/sections${qs ? `?${qs}` : ""}`);
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		// -----------------------------------------------------------------------
		// Site
		// -----------------------------------------------------------------------

		this.server.tool(
			"get_site_settings",
			"Get site-wide settings (title, tagline, logo, favicon, etc.)",
			{},
			async () => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = await (client as any).request("GET", "/settings");
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		this.server.tool(
			"get_menu",
			"Get a navigation menu and its items by name",
			{
				name: z.string().describe("Menu name, e.g. 'primary'"),
			},
			async ({ name }) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = await (client as any).request("GET", `/menus/${encodeURIComponent(name)}`);
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);

		this.server.tool(
			"get_term",
			"Get a single taxonomy term by slug (includes entry count and child terms)",
			{
				taxonomy: z.string().describe("Taxonomy name: category or tag"),
				slug: z.string().describe("Term slug"),
			},
			async ({ taxonomy, slug }) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = await (client as any).request(
					"GET",
					`/taxonomies/${encodeURIComponent(taxonomy)}/terms/${encodeURIComponent(slug)}`,
				);
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
			},
		);
	}
}
