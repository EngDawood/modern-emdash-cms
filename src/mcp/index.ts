/**
 * EmDash MCP Agent (Cloudflare Workers)
 *
 * Remote MCP server deployed at /mcp on the existing EmDash worker.
 * Exposes EmDash content management as MCP tools over HTTP (SSE).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { EmDashClient } from "emdash/client";
import { z } from "zod";

const jsonText = (data: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

interface Env extends Cloudflare.Env {
	MCP_OBJECT: DurableObjectNamespace;
	EMDASH_URL?: string;
	EMDASH_TOKEN?: string;
	TRACKER_DB: D1Database;
	MEDIA: R2Bucket;
}

export class EmDashMCP extends McpAgent<Env> {
	server = new McpServer({ name: "emdash", version: "1.0.0" });

	async init() {
		const baseUrl = this.env.EMDASH_URL ?? "https://engdawood.com";
		const client = new EmDashClient({ baseUrl, token: this.env.EMDASH_TOKEN });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const req = (method: string, path: string, body?: unknown): Promise<unknown> => (client as any).request(method, path, body);

		// -----------------------------------------------------------------------
		// Collections
		// -----------------------------------------------------------------------

		this.server.tool(
			"list_collections",
			"List all content collections defined in the CMS (e.g. projects, posts, pages). Returns each collection's slug, label, and field schema — use the slug with list_content, create_content, etc.",
			{},
			async () => {
				const collections = await client.collections();
				return jsonText(collections);
			},
		);

		// -----------------------------------------------------------------------
		// Content
		// -----------------------------------------------------------------------

		this.server.tool(
			"list_content",
			"List entries in a content collection. Returns an array of entries with their ID, slug, status, and all field values. Use list_collections first to discover available collections and their fields.",
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
				return jsonText(result);
			},
		);

		this.server.tool(
			"get_content",
			"Get a single content entry by ID or slug",
			{
				collection: z.string().describe("Collection slug: projects, posts, or pages"),
				id: z.string().describe("Entry ID (ULID) or slug"),
			},
			async ({ collection, id }) => {
				const item = await client.get(collection, id);
				return jsonText(item);
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
				return jsonText(item);
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
				return jsonText(item);
			},
		);

		this.server.tool(
			"delete_content",
			"Move a content entry to trash (sets deleted_at — reversible from the admin panel)",
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
			"Publish a draft entry, making it publicly visible on the site. Has no effect if the entry is already published.",
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
			"Full-text search across all CMS content. Returns matching entries with their collection, slug, title, and a text excerpt around the match. Useful for finding existing posts or projects before creating duplicates.",
			{
				query: z.string().describe("Search query"),
				collection: z.string().optional().describe("Limit to a specific collection (projects, posts, etc.)"),
				limit: z.number().int().min(1).max(50).optional().describe("Max results (default: 10)"),
			},
			async ({ query, collection, limit }) => {
				const results = await client.search(query, { collection, limit: limit ?? 10 });
				return jsonText(results);
			},
		);

		// -----------------------------------------------------------------------
		// Media
		// -----------------------------------------------------------------------

		this.server.tool(
			"list_media",
			"List uploaded media files in the library. Returns each item's ID, filename, MIME type, size, and dimensions (for images). Use the ID to reference media in content fields.",
			{
				limit: z.number().int().min(1).max(100).optional().describe("Max items (default: 50)"),
				mimeType: z.string().optional().describe("Filter by MIME type, e.g. image/jpeg"),
			},
			async ({ limit, mimeType }) => {
				const result = await client.mediaList({ limit, mimeType });
				return jsonText(result);
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
				return jsonText(item);
			},
		);

		this.server.tool(
			"upload_media_from_base64",
			"Upload a file directly from base64-encoded data to the media library. Returns the media item including its ID.",
			{
				base64: z.string().describe("Base64-encoded file content"),
				filename: z.string().describe("Filename including extension, e.g. photo.jpg"),
				mimeType: z.string().optional().describe("MIME type, e.g. image/jpeg. Inferred from filename if omitted."),
				alt: z.string().optional().describe("Alt text for accessibility"),
				caption: z.string().optional().describe("Optional caption"),
			},
			async ({ base64, filename, mimeType, alt, caption }) => {
				const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
				const blob = new Blob([binary], { type: mimeType });
				const item = await client.mediaUpload(blob, filename, { alt, caption, contentType: mimeType });
				return jsonText(item);
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
				return jsonText(result);
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
				const result = await req("GET", `/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}/terms/${encodeURIComponent(taxonomy)}`);
				return jsonText(result);
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
				const result = await req("POST", `/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}/terms/${encodeURIComponent(taxonomy)}`, { termIds });
				return jsonText(result);
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
				const result = await req("GET", `/admin/bylines${qs ? `?${qs}` : ""}`);
				return jsonText(result);
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
				const result = await req("PUT", `/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { bylines });
				return jsonText(result);
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
				const result = await req("GET", `/sections${qs ? `?${qs}` : ""}`);
				return jsonText(result);
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
				const result = await req("GET", "/settings");
				return jsonText(result);
			},
		);

		this.server.tool(
			"get_menu",
			"Get a navigation menu and its items by name",
			{
				name: z.string().describe("Menu name, e.g. 'primary'"),
			},
			async ({ name }) => {
				const result = await req("GET", `/menus/${encodeURIComponent(name)}`);
				return jsonText(result);
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
				const result = await req("GET", `/taxonomies/${encodeURIComponent(taxonomy)}/terms/${encodeURIComponent(slug)}`);
				return jsonText(result);
			},
		);

		// -----------------------------------------------------------------------
		// Tracker
		// -----------------------------------------------------------------------

		this.server.tool(
			"tracker_list_tasks",
			"List tracker tasks. Optionally filter by status, priority, or payment. Ordered by deadline (soonest first).",
			{
				status: z.enum(["new", "progress", "done", "cancel"]).optional().describe("Filter by status"),
				priority: z.enum(["hi", "med", "lo"]).optional().describe("Filter by priority"),
				payment: z.enum(["paid", "half", "unpaid"]).optional().describe("Filter by payment status"),
				limit: z.number().int().min(1).max(500).optional().describe("Max tasks to return (default: all)"),
			},
			async ({ status, priority, payment, limit }) => {
				const conditions: string[] = [];
				const params: unknown[] = [];
				if (status) { conditions.push("status = ?"); params.push(status); }
				if (priority) { conditions.push("priority = ?"); params.push(priority); }
				if (payment) { conditions.push("payment = ?"); params.push(payment); }
				const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
				const limitClause = limit ? `LIMIT ${limit}` : "";
				const sql = `SELECT * FROM tasks ${where} ORDER BY deadline ASC NULLS LAST, id DESC ${limitClause}`.trim();
				const stmt = this.env.TRACKER_DB.prepare(sql);
				const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
				return jsonText(results);
			},
		);

		this.server.tool(
			"tracker_get_task",
			"Get a single tracker task by its numeric ID",
			{
				id: z.number().int().describe("Task ID"),
			},
			async ({ id }) => {
				const row = await this.env.TRACKER_DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
				if (!row) throw new Error(`Task ${id} not found`);
				return jsonText(row);
			},
		);

		this.server.tool(
			"tracker_create_task",
			"Create a new tracker task. Returns the new task ID.",
			{
				client: z.string().describe("Client name"),
				title_en: z.string().describe("Task title in English"),
				title_ar: z.string().optional().describe("Task title in Arabic"),
				university: z.string().optional().describe("University name"),
				course: z.string().optional().describe("Course name"),
				type: z.string().optional().describe("Task type, e.g. Assignment, Project, Exam"),
				deadline: z.string().optional().describe("Deadline date in YYYY-MM-DD format"),
				priority: z.enum(["hi", "med", "lo"]).optional().describe("Priority (default: med)"),
				status: z.enum(["new", "progress", "done", "cancel"]).optional().describe("Status (default: new)"),
				price: z.number().optional().describe("Price amount"),
				payment: z.enum(["paid", "half", "unpaid"]).optional().describe("Payment status (default: unpaid)"),
				claude: z.string().optional().describe("Claude account tier: Pro, Max, API, Team"),
				fatora: z.string().optional().describe("Fatora invoice status"),
				fatora_link: z.string().optional().describe("Fatora invoice URL"),
				notes: z.string().optional().describe("Internal notes"),
				instructions: z.string().optional().describe("Task instructions"),
			},
			async (f) => {
				const now = new Date().toISOString();
				const { meta } = await this.env.TRACKER_DB.prepare(
					`INSERT INTO tasks (client, university, course, task, title_ar, type, deadline, priority, status, price, payment, claude_account, fatora_status, fatora_link, notes, instructions, log, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`,
				).bind(
					f.client, f.university ?? null, f.course ?? null, f.title_en,
					f.title_ar ?? null, f.type ?? "Assignment", f.deadline ?? null,
					f.priority ?? "med", f.status ?? "new", f.price ?? null,
					f.payment ?? "unpaid", f.claude ?? null, f.fatora ?? null,
					f.fatora_link ?? null, f.notes ?? null, f.instructions ?? null,
					now, now,
				).run();
				return jsonText({ id: meta.last_row_id });
			},
		);

		this.server.tool(
			"tracker_update_task",
			"Update fields on an existing tracker task. Only provide fields you want to change.",
			{
				id: z.number().int().describe("Task ID"),
				client: z.string().optional().describe("Client name"),
				university: z.string().optional().describe("University or institution name"),
				course: z.string().optional().describe("Course name"),
				title_en: z.string().optional().describe("Task title in English"),
				title_ar: z.string().optional().describe("Task title in Arabic"),
				type: z.string().optional().describe("Task type: Assignment, Project, Exam Prep, Thesis, Report, Lab"),
				deadline: z.string().optional().describe("Deadline date in YYYY-MM-DD format"),
				priority: z.enum(["hi", "med", "lo"]).optional().describe("Priority: hi=high, med=medium, lo=low"),
				status: z.enum(["new", "progress", "done", "cancel"]).optional().describe("Status: new, progress, done, cancel"),
				price: z.number().optional().describe("Price amount"),
				payment: z.enum(["paid", "half", "unpaid"]).optional().describe("Payment status: paid, half, unpaid"),
				claude: z.string().optional().describe("Claude account tier: Pro, Max, API, Team"),
				fatora: z.string().optional().describe("Fatora invoice status: paid, active, unknown"),
				fatora_link: z.string().optional().describe("Fatora invoice URL (https://fato.me/v/...)"),
				notes: z.string().optional().describe("Private internal notes"),
				instructions: z.string().optional().describe("Client requirements and instructions"),
				log: z.array(z.object({ when: z.string(), who: z.string(), what: z.string() })).optional().describe("Full activity log array (replaces existing)"),
			},
			async ({ id, client, university, course, title_en, title_ar, type, deadline, priority, status, price, payment, claude, fatora, fatora_link, notes, instructions, log }) => {
				const setClauses: string[] = [];
				const params: unknown[] = [];
				const add = (col: string, val: unknown) => {
					if (val !== undefined) { setClauses.push(`${col} = ?`); params.push(val); }
				};
				add("client", client);
				add("university", university);
				add("course", course);
				add("task", title_en);
				add("title_ar", title_ar);
				add("type", type);
				add("deadline", deadline);
				add("priority", priority);
				add("status", status);
				add("price", price);
				add("payment", payment);
				add("claude_account", claude);
				add("fatora_status", fatora);
				add("fatora_link", fatora_link);
				add("notes", notes);
				add("instructions", instructions);
				if (log !== undefined) { setClauses.push("log = ?"); params.push(JSON.stringify(log)); }
				if (setClauses.length === 0) throw new Error("No fields to update");
				setClauses.push("updated_at = datetime('now')");
				params.push(id);
				await this.env.TRACKER_DB.prepare(
					`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?`,
				).bind(...params).run();
				return { content: [{ type: "text" as const, text: `Updated task ${id}` }] };
			},
		);

		this.server.tool(
			"tracker_delete_task",
			"Permanently delete a tracker task by ID",
			{
				id: z.number().int().describe("Task ID"),
			},
			async ({ id }) => {
				await this.env.TRACKER_DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
				return { content: [{ type: "text" as const, text: `Deleted task ${id}` }] };
			},
		);

		this.server.tool(
			"tracker_list_universities",
			"List all universities in the tracker reference table",
			{},
			async () => {
				const { results } = await this.env.TRACKER_DB.prepare("SELECT * FROM universities ORDER BY name ASC").all();
				return jsonText(results);
			},
		);

		// -----------------------------------------------------------------------
		// Tracker — Files
		// -----------------------------------------------------------------------

		this.server.tool(
			"tracker_list_task_files",
			"List files attached to a tracker task. Returns file IDs, names, sizes, and download URLs.",
			{
				taskId: z.number().int().describe("Task ID"),
			},
			async ({ taskId }) => {
				const row = await this.env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?")
					.bind(taskId)
					.first<{ files: string | null }>();
				return jsonText(JSON.parse(row?.files ?? "[]"));
			},
		);

		this.server.tool(
			"tracker_upload_file",
			"Upload a file attachment to a tracker task from base64-encoded content. The file is registered in the EmDash media library and attached to the task.",
			{
				taskId: z.number().int().describe("Task ID to attach the file to"),
				base64: z.string().describe("Base64-encoded file content"),
				filename: z.string().describe("Filename including extension, e.g. brief.pdf"),
				mimeType: z.string().optional().describe("MIME type, e.g. application/pdf"),
			},
			async ({ taskId, base64, filename, mimeType }) => {
				const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
				const blob = new Blob([binary], { type: mimeType ?? "application/octet-stream" });
				const item = await client.mediaUpload(blob, filename, { contentType: mimeType });

				const fileRef = { id: item.id, key: item.key, name: filename, size: item.size, url: `${baseUrl}/api/tracker/file/${item.key}` };

				const row = await this.env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?")
					.bind(taskId)
					.first<{ files: string | null }>();
				const files = JSON.parse(row?.files ?? "[]");
				files.push(fileRef);
				await this.env.TRACKER_DB.prepare("UPDATE tasks SET files = ? WHERE id = ?")
					.bind(JSON.stringify(files), taskId)
					.run();

				return jsonText(fileRef);
			},
		);

		this.server.tool(
			"tracker_upload_file_from_url",
			"Fetch a file from a URL and attach it to a tracker task. The file is registered in the EmDash media library.",
			{
				taskId: z.number().int().describe("Task ID to attach the file to"),
				url: z.string().url().describe("Public URL of the file to fetch"),
				filename: z.string().optional().describe("Override filename (default: derived from URL)"),
			},
			async ({ taskId, url: fileUrl, filename }) => {
				const response = await fetch(fileUrl);
				if (!response.ok) throw new Error(`Failed to fetch ${fileUrl}: HTTP ${response.status}`);
				const blob = await response.blob();
				const name = filename ?? fileUrl.split("/").pop()?.split("?")[0] ?? "file";
				const item = await client.mediaUpload(blob, name);

				const fileRef = { id: item.id, key: item.key, name, size: item.size, url: `${baseUrl}/api/tracker/file/${item.key}` };

				const row = await this.env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?")
					.bind(taskId)
					.first<{ files: string | null }>();
				const files = JSON.parse(row?.files ?? "[]");
				files.push(fileRef);
				await this.env.TRACKER_DB.prepare("UPDATE tasks SET files = ? WHERE id = ?")
					.bind(JSON.stringify(files), taskId)
					.run();

				return jsonText(fileRef);
			},
		);

		this.server.tool(
			"tracker_delete_file",
			"Delete a file attachment from a tracker task. Removes it from the task and the EmDash media library.",
			{
				taskId: z.number().int().describe("Task ID the file belongs to"),
				fileId: z.string().describe("File ID from tracker_list_task_files"),
			},
			async ({ taskId, fileId }) => {
				const row = await this.env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?")
					.bind(taskId)
					.first<{ files: string | null }>();
				const files = (JSON.parse(row?.files ?? "[]") as Array<{ id: string; key: string }>).filter(
					(f) => f.id !== fileId,
				);
				await this.env.TRACKER_DB.prepare("UPDATE tasks SET files = ? WHERE id = ?")
					.bind(JSON.stringify(files), taskId)
					.run();

				try {
					await req("DELETE", `/media/${fileId}`);
				} catch {
					// EmDash delete failed — file may still appear in dashboard but is detached from task
				}

				return jsonText({ ok: true });
			},
		);
	}
}
