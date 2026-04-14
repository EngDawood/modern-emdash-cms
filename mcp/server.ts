/**
 * EmDash MCP Server
 *
 * Exposes EmDash content management as MCP tools so any AI client
 * (Claude, Cursor, Windsurf, etc.) can manage projects and posts.
 *
 * Config (env vars):
 *   EMDASH_URL    — site URL, defaults to http://localhost:4321
 *   EMDASH_TOKEN  — API token (required for remote instances)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EmDashClient } from "emdash/client";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const baseUrl = process.env["EMDASH_URL"] ?? "http://localhost:4321";
const token = process.env["EMDASH_TOKEN"];
const isLocal = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

const client = new EmDashClient({
	baseUrl,
	token,
	devBypass: !token && isLocal,
});

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
	name: "emdash",
	version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tools — Collections
// ---------------------------------------------------------------------------

server.tool(
	"list_collections",
	"List all content collections (projects, posts, pages, etc.)",
	{},
	async () => {
		const collections = await client.collections();
		return {
			content: [{ type: "text", text: JSON.stringify(collections, null, 2) }],
		};
	},
);

// ---------------------------------------------------------------------------
// Tools — Content
// ---------------------------------------------------------------------------

server.tool(
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
		return {
			content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
		};
	},
);

server.tool(
	"get_content",
	"Get a single content entry by ID",
	{
		collection: z.string().describe("Collection slug: projects, posts, or pages"),
		id: z.string().describe("Entry ID (ULID) or slug"),
	},
	async ({ collection, id }) => {
		const item = await client.get(collection, id);
		return {
			content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
		};
	},
);

server.tool(
	"create_content",
	"Create a new entry in a collection. Auto-publishes by default.",
	{
		collection: z.string().describe("Collection slug: projects, posts, or pages"),
		data: z.record(z.unknown()).describe(
			"Field values. For posts: title, excerpt, content (markdown). For projects: title, client, year, summary, content (markdown), url.",
		),
		slug: z.string().optional().describe("URL slug (auto-generated from title if omitted)"),
		draft: z.boolean().optional().describe("Save as draft instead of publishing (default: false)"),
	},
	async ({ collection, data, slug, draft }) => {
		const item = await client.create(collection, {
			data,
			slug,
			status: draft ? "draft" : "published",
		});
		return {
			content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
		};
	},
);

server.tool(
	"update_content",
	"Update an existing entry. Fetch the entry first with get_content to get its _rev token.",
	{
		collection: z.string().describe("Collection slug: projects, posts, or pages"),
		id: z.string().describe("Entry ID"),
		data: z.record(z.unknown()).describe("Fields to update (only include changed fields)"),
		rev: z.string().optional().describe("Revision token from get_content (prevents overwriting concurrent edits)"),
		draft: z.boolean().optional().describe("Save as draft instead of publishing (default: false)"),
	},
	async ({ collection, id, data, rev, draft }) => {
		const item = await client.update(collection, id, {
			data,
			_rev: rev,
			status: draft ? "draft" : "published",
		});
		return {
			content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
		};
	},
);

server.tool(
	"delete_content",
	"Soft-delete a content entry",
	{
		collection: z.string().describe("Collection slug: projects, posts, or pages"),
		id: z.string().describe("Entry ID"),
	},
	async ({ collection, id }) => {
		await client.delete(collection, id);
		return {
			content: [{ type: "text", text: `Deleted ${collection}/${id}` }],
		};
	},
);

server.tool(
	"publish_content",
	"Publish a draft entry",
	{
		collection: z.string().describe("Collection slug: projects, posts, or pages"),
		id: z.string().describe("Entry ID"),
	},
	async ({ collection, id }) => {
		await client.publish(collection, id);
		return {
			content: [{ type: "text", text: `Published ${collection}/${id}` }],
		};
	},
);

// ---------------------------------------------------------------------------
// Tools — Search
// ---------------------------------------------------------------------------

server.tool(
	"search_content",
	"Full-text search across all content",
	{
		query: z.string().describe("Search query"),
		collection: z.string().optional().describe("Limit to a specific collection (projects, posts, etc.)"),
		limit: z.number().int().min(1).max(50).optional().describe("Max results (default: 10)"),
	},
	async ({ query, collection, limit }) => {
		const results = await client.search(query, { collection, limit: limit ?? 10 });
		return {
			content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
		};
	},
);

// ---------------------------------------------------------------------------
// Tools — Media
// ---------------------------------------------------------------------------

server.tool(
	"list_media",
	"List uploaded media files",
	{
		limit: z.number().int().min(1).max(100).optional().describe("Max items (default: 50)"),
		mimeType: z.string().optional().describe("Filter by MIME type, e.g. image/jpeg"),
	},
	async ({ limit, mimeType }) => {
		const result = await client.mediaList({ limit, mimeType });
		return {
			content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
		};
	},
);

// ---------------------------------------------------------------------------
// Tools — Taxonomies
// ---------------------------------------------------------------------------

server.tool(
	"list_taxonomy_terms",
	"List terms for a taxonomy (category or tag)",
	{
		taxonomy: z.string().describe("Taxonomy name: category or tag"),
	},
	async ({ taxonomy }) => {
		const result = await client.terms(taxonomy);
		return {
			content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
		};
	},
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
