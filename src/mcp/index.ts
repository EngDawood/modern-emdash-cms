/**
 * EmDash MCP Proxy (Cloudflare Workers)
 *
 * Single MCP endpoint at /mcp that:
 *  • Handles 10 tracker_* tools locally (TRACKER_DB + R2)
 *  • Proxies everything else to the built-in EmDash MCP at /_emdash/api/mcp
 *
 * Auth: Bearer token via Authorization header OR ?token= query param.
 * The same token is forwarded upstream as `Authorization: Bearer <token>`,
 * so a valid EmDash PAT (ec_pat_*) authenticates against the built-in.
 */

import { EmDashClient } from "emdash/client";

interface Env extends Cloudflare.Env {
	MCP_OBJECT: DurableObjectNamespace;
	EMDASH_URL?: string;
	EMDASH_TOKEN?: string;
	TRACKER_DB: D1Database;
	MEDIA: R2Bucket;
	SELF: Fetcher;
}

const UPSTREAM_PATH = "/_emdash/api/mcp";

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id?: string | number;
	method: string;
	params?: { name?: string; arguments?: Record<string, unknown> } & Record<string, unknown>;
}

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, mcp-session-id, mcp-protocol-version",
	"Access-Control-Expose-Headers": "mcp-session-id",
	"Access-Control-Max-Age": "86400",
};

const jsonText = (data: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

async function parseSseOrJson(res: Response): Promise<{ result?: { tools?: unknown[] } }> {
	const ct = res.headers.get("Content-Type") ?? "";
	if (ct.includes("application/json")) return res.json();
	const text = await res.text();
	const match = text.match(/^data: (.+)$/m);
	if (!match) throw new Error(`No data event in SSE response: ${text.slice(0, 200)}`);
	return JSON.parse(match[1]);
}

// ── Tracker tool definitions (JSON Schema) ───────────────────────────────────

const TRACKER_TOOLS = [
	{
		name: "tracker_list_tasks",
		description: "List tracker tasks. Optionally filter by status, priority, or payment. Ordered by deadline (soonest first).",
		inputSchema: {
			type: "object",
			properties: {
				status: { type: "string", enum: ["new", "progress", "done", "cancel"], description: "Filter by status" },
				priority: { type: "string", enum: ["hi", "med", "lo"], description: "Filter by priority" },
				payment: { type: "string", enum: ["paid", "half", "unpaid"], description: "Filter by payment status" },
				limit: { type: "integer", minimum: 1, maximum: 500, description: "Max tasks to return (default: all)" },
			},
		},
	},
	{
		name: "tracker_get_task",
		description: "Get a single tracker task by its numeric ID",
		inputSchema: {
			type: "object",
			properties: { id: { type: "integer", description: "Task ID" } },
			required: ["id"],
		},
	},
	{
		name: "tracker_create_task",
		description: "Create a new tracker task. Returns the new task ID.",
		inputSchema: {
			type: "object",
			properties: {
				client: { type: "string", description: "Client name" },
				title_en: { type: "string", description: "Task title in English" },
				title_ar: { type: "string", description: "Task title in Arabic" },
				university: { type: "string", description: "University name" },
				course: { type: "string", description: "Course name" },
				type: { type: "string", description: "Task type, e.g. Assignment, Project, Exam" },
				deadline: { type: "string", description: "Deadline date in YYYY-MM-DD format" },
				priority: { type: "string", enum: ["hi", "med", "lo"], description: "Priority (default: med)" },
				status: { type: "string", enum: ["new", "progress", "in_progress", "done", "cancel"], description: "Status" },
				price: { type: "number", description: "Price amount" },
				payment: { type: "string", enum: ["paid", "half", "unpaid"], description: "Payment status (default: unpaid)" },
				claude: { type: "string", description: "Claude account tier: Pro, Max, API, Team" },
				fatora: { type: "string", description: "Fatora invoice status" },
				fatora_link: { type: "string", description: "Fatora invoice URL" },
				notes: { type: "string", description: "Internal notes" },
				instructions: { type: "string", description: "Task instructions" },
			},
			required: ["client", "title_en"],
		},
	},
	{
		name: "tracker_update_task",
		description: "Update fields on an existing tracker task. Only provide fields you want to change.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "integer", description: "Task ID" },
				client: { type: "string" },
				university: { type: "string" },
				course: { type: "string" },
				title_en: { type: "string" },
				title_ar: { type: "string" },
				type: { type: "string" },
				deadline: { type: "string", description: "YYYY-MM-DD" },
				priority: { type: "string", enum: ["hi", "med", "lo"] },
				status: { type: "string", enum: ["new", "progress", "in_progress", "done", "cancel"] },
				price: { type: "number" },
				payment: { type: "string", enum: ["paid", "half", "unpaid"] },
				claude: { type: "string" },
				fatora: { type: "string" },
				fatora_link: { type: "string" },
				notes: { type: "string" },
				instructions: { type: "string" },
				log: {
					type: "array",
					items: {
						type: "object",
						properties: { when: { type: "string" }, who: { type: "string" }, what: { type: "string" } },
						required: ["when", "who", "what"],
					},
					description: "Full activity log array (replaces existing)",
				},
			},
			required: ["id"],
		},
	},
	{
		name: "tracker_delete_task",
		description: "Permanently delete a tracker task by ID",
		inputSchema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
	},
	{
		name: "tracker_list_universities",
		description: "List all universities in the tracker reference table",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "tracker_list_task_files",
		description: "List files attached to a tracker task. Returns file IDs, names, sizes, and download URLs.",
		inputSchema: { type: "object", properties: { task_id: { type: "integer" } }, required: ["task_id"] },
	},
	{
		name: "tracker_upload_file",
		description: "Upload a file attachment to a tracker task from base64-encoded content. For local files, prefer curl on /api/tracker/upload to avoid context size limits.",
		inputSchema: {
			type: "object",
			properties: {
				task_id: { type: "integer" },
				base64: { type: "string", description: "Base64-encoded file content" },
				filename: { type: "string" },
				mimeType: { type: "string" },
			},
			required: ["task_id", "base64", "filename"],
		},
	},
	{
		name: "tracker_upload_file_from_url",
		description: "Fetch a file from a URL and attach it to a tracker task.",
		inputSchema: {
			type: "object",
			properties: {
				task_id: { type: "integer" },
				url: { type: "string", format: "uri" },
				filename: { type: "string" },
			},
			required: ["task_id", "url"],
		},
	},
	{
		name: "tracker_delete_file",
		description: "Delete a file attachment from a tracker task. Removes it from the task and the EmDash media library.",
		inputSchema: {
			type: "object",
			properties: { task_id: { type: "integer" }, fileId: { type: "string" } },
			required: ["task_id", "fileId"],
		},
	},
] as const;

// ── Tracker tool handlers ────────────────────────────────────────────────────

type Handler = (args: Record<string, unknown>, env: Env, baseUrl: string, token: string) => Promise<unknown>;

const trackerHandlers: Record<string, Handler> = {
	tracker_list_tasks: async (args, env) => {
		const { status, priority, payment, limit } = args as { status?: string; priority?: string; payment?: string; limit?: number };
		const conditions: string[] = [];
		const params: unknown[] = [];
		if (status) { conditions.push("status = ?"); params.push(status); }
		if (priority) { conditions.push("priority = ?"); params.push(priority); }
		if (payment) { conditions.push("payment = ?"); params.push(payment); }
		const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
		const limitClause = limit ? `LIMIT ${limit}` : "";
		const sql = `SELECT * FROM tasks ${where} ORDER BY deadline ASC NULLS LAST, id DESC ${limitClause}`.trim();
		const stmt = env.TRACKER_DB.prepare(sql);
		const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
		return jsonText(results);
	},

	tracker_get_task: async (args, env) => {
		const { id } = args as { id: number };
		const row = await env.TRACKER_DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
		if (!row) throw new Error(`Task ${id} not found`);
		return jsonText(row);
	},

	tracker_create_task: async (args, env) => {
		const f = args as Record<string, string | number | undefined>;
		const status = f.status === "in_progress" ? "progress" : f.status;
		const now = new Date().toISOString();
		const { meta } = await env.TRACKER_DB.prepare(
			`INSERT INTO tasks (client, university, course, task, title_ar, type, deadline, priority, status, price, payment, claude_account, fatora_status, fatora_link, notes, instructions, log, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`,
		).bind(
			f.client, f.university ?? null, f.course ?? null, f.title_en,
			f.title_ar ?? null, f.type ?? "Assignment", f.deadline ?? null,
			f.priority ?? "med", status ?? "new", f.price ?? null,
			f.payment ?? "unpaid", f.claude ?? null, f.fatora ?? null,
			f.fatora_link ?? null, f.notes ?? null, f.instructions ?? null,
			now, now,
		).run();
		return jsonText({ id: meta.last_row_id });
	},

	tracker_update_task: async (args, env) => {
		const { id, log, status: rawStatus, title_en, claude, fatora, ...rest } = args as Record<string, unknown> & { id: number; log?: unknown[]; status?: string; title_en?: string; claude?: string; fatora?: string };
		const status = rawStatus === "in_progress" ? "progress" : rawStatus;
		const map: Record<string, unknown> = {
			...rest,
			task: title_en,
			status,
			claude_account: claude,
			fatora_status: fatora,
		};
		const setClauses: string[] = [];
		const params: unknown[] = [];
		for (const [col, val] of Object.entries(map)) {
			if (val !== undefined) { setClauses.push(`${col} = ?`); params.push(val); }
		}
		if (log !== undefined) { setClauses.push("log = ?"); params.push(JSON.stringify(log)); }
		if (setClauses.length === 0) throw new Error("No fields to update");
		setClauses.push("updated_at = datetime('now')");
		params.push(id);
		await env.TRACKER_DB.prepare(`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?`).bind(...params).run();
		return { content: [{ type: "text" as const, text: `Updated task ${id}` }] };
	},

	tracker_delete_task: async (args, env) => {
		const { id } = args as { id: number };
		await env.TRACKER_DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
		return { content: [{ type: "text" as const, text: `Deleted task ${id}` }] };
	},

	tracker_list_universities: async (_args, env) => {
		const { results } = await env.TRACKER_DB.prepare("SELECT * FROM universities ORDER BY name ASC").all();
		return jsonText(results);
	},

	tracker_list_task_files: async (args, env) => {
		const { task_id } = args as { task_id: number };
		const row = await env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?").bind(task_id).first<{ files: string | null }>();
		return jsonText(JSON.parse(row?.files ?? "[]"));
	},

	tracker_upload_file: async (args, env, baseUrl, token) => {
		const { task_id, base64, filename, mimeType } = args as { task_id: number; base64: string; filename: string; mimeType?: string };
		const client = new EmDashClient({ baseUrl, token });
		const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
		const blob = new Blob([binary], { type: mimeType ?? "application/octet-stream" });
		const item = await client.mediaUpload(blob, filename, { contentType: mimeType });
		const fileRef = { id: item.id, key: item.key, name: filename, size: item.size, url: `${baseUrl}/api/tracker/file/${item.key}` };

		const row = await env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?").bind(task_id).first<{ files: string | null }>();
		const files = JSON.parse(row?.files ?? "[]");
		files.push(fileRef);
		await env.TRACKER_DB.prepare("UPDATE tasks SET files = ? WHERE id = ?").bind(JSON.stringify(files), task_id).run();
		return jsonText(fileRef);
	},

	tracker_upload_file_from_url: async (args, env, baseUrl, token) => {
		const { task_id, url: fileUrl, filename } = args as { task_id: number; url: string; filename?: string };
		const client = new EmDashClient({ baseUrl, token });
		const response = await fetch(fileUrl);
		if (!response.ok) throw new Error(`Failed to fetch ${fileUrl}: HTTP ${response.status}`);
		const blob = await response.blob();
		const name = filename ?? fileUrl.split("/").pop()?.split("?")[0] ?? "file";
		const item = await client.mediaUpload(blob, name);
		const fileRef = { id: item.id, key: item.key, name, size: item.size, url: `${baseUrl}/api/tracker/file/${item.key}` };

		const row = await env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?").bind(task_id).first<{ files: string | null }>();
		const files = JSON.parse(row?.files ?? "[]");
		files.push(fileRef);
		await env.TRACKER_DB.prepare("UPDATE tasks SET files = ? WHERE id = ?").bind(JSON.stringify(files), task_id).run();
		return jsonText(fileRef);
	},

	tracker_delete_file: async (args, env, baseUrl, token) => {
		const { task_id, fileId } = args as { task_id: number; fileId: string };
		const row = await env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?").bind(task_id).first<{ files: string | null }>();
		const files = (JSON.parse(row?.files ?? "[]") as Array<{ id: string }>).filter((f) => f.id !== fileId);
		await env.TRACKER_DB.prepare("UPDATE tasks SET files = ? WHERE id = ?").bind(JSON.stringify(files), task_id).run();
		await fetch(`${baseUrl}/_emdash/api/media/${fileId}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${token}` },
		}).catch(() => {});
		return jsonText({ ok: true });
	},
};

// ── Proxy handler ────────────────────────────────────────────────────────────

export async function handleMcp(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (request.method === "OPTIONS") {
		return new Response(null, { headers: CORS_HEADERS });
	}

	const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
		?? url.searchParams.get("token");

	if (!token) {
		return new Response("Unauthorized", {
			status: 401,
			headers: { ...CORS_HEADERS, "WWW-Authenticate": "Bearer" },
		});
	}

	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
	}

	const baseUrl = env.EMDASH_URL ?? url.origin;
	// Use Service Binding for same-worker calls to avoid 522 subrequest errors.
	const upstreamUrl = `${baseUrl}${UPSTREAM_PATH}`;
	const upstreamFetch = (req: RequestInit & { url?: string }) =>
		env.SELF.fetch(new Request(upstreamUrl, req));

	let rpc: JsonRpcRequest;
	try {
		rpc = await request.json();
	} catch {
		return Response.json(
			{ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
			{ headers: CORS_HEADERS },
		);
	}

	const upstreamHeaders = {
		"Content-Type": "application/json",
		Accept: "application/json, text/event-stream",
		Authorization: `Bearer ${token}`,
	};

	// Notification (no id) — fire-and-forget
	if (rpc.id === undefined) {
		void upstreamFetch({ method: "POST", headers: upstreamHeaders, body: JSON.stringify(rpc) }).catch(() => {});
		return new Response(null, { status: 202, headers: CORS_HEADERS });
	}

	// tools/list — merge upstream tools with tracker tools
	if (rpc.method === "tools/list") {
		let upstreamTools: unknown[] = [];
		try {
			const res = await upstreamFetch({ method: "POST", headers: upstreamHeaders, body: JSON.stringify(rpc) });
			const upstreamData = await parseSseOrJson(res);
			upstreamTools = (upstreamData.result?.tools as unknown[]) ?? [];
		} catch {
			// upstream unavailable — return tracker tools only
		}
		return Response.json(
			{ jsonrpc: "2.0", id: rpc.id, result: { tools: [...upstreamTools, ...TRACKER_TOOLS] } },
			{ headers: CORS_HEADERS },
		);
	}

	// tools/call for tracker_*
	if (rpc.method === "tools/call" && typeof rpc.params?.name === "string" && rpc.params.name.startsWith("tracker_")) {
		const handler = trackerHandlers[rpc.params.name];
		if (!handler) {
			return Response.json(
				{ jsonrpc: "2.0", id: rpc.id, error: { code: -32601, message: `Unknown tool: ${rpc.params.name}` } },
				{ headers: CORS_HEADERS },
			);
		}
		try {
			const result = await handler((rpc.params.arguments as Record<string, unknown>) ?? {}, env, baseUrl, token);
			return Response.json({ jsonrpc: "2.0", id: rpc.id, result }, { headers: CORS_HEADERS });
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			return Response.json(
				{ jsonrpc: "2.0", id: rpc.id, result: { content: [{ type: "text", text: message }], isError: true } },
				{ headers: CORS_HEADERS },
			);
		}
	}

	// Everything else (initialize, ping, content_*, schema_*, media_*, etc.) → forward
	const res = await upstreamFetch({ method: "POST", headers: upstreamHeaders, body: JSON.stringify(rpc) });
	const headers = new Headers(res.headers);
	for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
	return new Response(res.body, { status: res.status, headers });
}

// ── Durable Object stub (kept for wrangler binding compatibility) ────────────

export class EmDashMCP {
	constructor(private state: DurableObjectState, private env: Env) {}
	async fetch(request: Request): Promise<Response> {
		return handleMcp(request, this.env);
	}
}
