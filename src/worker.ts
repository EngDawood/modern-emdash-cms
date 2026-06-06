import handler from "@astrojs/cloudflare/entrypoints/server";
import { EmDashClient } from "emdash/client";
import { EmDashMCP, handleMcp } from "./mcp";

interface WorkerEnv extends Cloudflare.Env {
	MCP_OBJECT: DurableObjectNamespace;
	EMDASH_TOKEN?: string;
	TRACKER_DB: D1Database;
	SESSION: KVNamespace;
	MEDIA: R2Bucket;
	SELF: Fetcher;
}

export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";
export { EmDashMCP };

// ── Cookie helper ─────────────────────────────────────────────────────────────
function parseCookies(header: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const part of header.split(";")) {
		const idx = part.indexOf("=");
		if (idx < 0) continue;
		result[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
	}
	return result;
}

// ── Tracker API auth ──────────────────────────────────────────────────────────
async function isAuthenticated(request: Request, env: WorkerEnv): Promise<boolean> {
	const cookies = parseCookies(request.headers.get("Cookie") ?? "");
	const sessionId = cookies["astro-session"];
	if (!sessionId) return false;
	const session = await env.SESSION.get(sessionId);
	return session !== null;
}

// ── Tracker: query ────────────────────────────────────────────────────────────
async function handleTrackerQuery(request: Request, env: WorkerEnv): Promise<Response> {
	const { sql, params } = (await request.json()) as { sql: string; params?: unknown[] };
	const stmt = env.TRACKER_DB.prepare(sql);
	const result = params?.length ? await stmt.bind(...params).all() : await stmt.all();
	return new Response(JSON.stringify(result), {
		headers: { "Content-Type": "application/json" },
	});
}

interface TaskFileRef {
	id: string;
	key: string;
	name: string;
	size: number;
	url: string;
}

// ── Tracker: upload ───────────────────────────────────────────────────────────
async function handleTrackerUpload(request: Request, env: WorkerEnv): Promise<Response> {
	const form = await request.formData();
	const file = form.get("file") as File;
	const taskId = form.get("taskId") as string;
	if (!file || !taskId) return new Response("Bad request", { status: 400 });

	let fileRef: TaskFileRef;

	const isBearerAuth = (request.headers.get("Authorization") ?? "").startsWith("Bearer ");

	if (isBearerAuth) {
		// Programmatic upload: use EmDashClient so the file appears in the media dashboard
		const baseUrl = new URL(request.url).origin;
		const client = new EmDashClient({ baseUrl, token: env.EMDASH_TOKEN });
		const item = await client.mediaUpload(file, file.name, { contentType: file.type || undefined });
		fileRef = {
			id: item.id,
			key: item.key,
			name: file.name,
			size: item.size,
			url: `/api/tracker/file/${item.key}`,
		};
	} else {
		// Browser upload: go through EmDash media API so the file appears in the dashboard
		const baseUrl = new URL(request.url).origin;
		const mediaForm = new FormData();
		mediaForm.append("file", file, file.name);
		const mediaRes = await fetch(`${baseUrl}/_emdash/api/media`, {
			method: "POST",
			body: mediaForm,
			headers: { Cookie: request.headers.get("Cookie") ?? "" },
		});
		if (!mediaRes.ok) return new Response("Media upload failed", { status: 502 });
		const { data } = (await mediaRes.json()) as { data: { item: { id: string; key: string; size: number } } };
		const item = data.item;
		fileRef = {
			id: item.id,
			key: item.key,
			name: file.name,
			size: item.size,
			url: `/api/tracker/file/${item.key}`,
		};
	}

	// Append to tasks.files JSON in D1
	const row = await env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?")
		.bind(taskId)
		.first<{ files: string | null }>();
	const existing: TaskFileRef[] = JSON.parse(row?.files ?? "[]");
	existing.push(fileRef);
	await env.TRACKER_DB.prepare("UPDATE tasks SET files = ? WHERE id = ?")
		.bind(JSON.stringify(existing), taskId)
		.run();

	return new Response(JSON.stringify(fileRef), { headers: { "Content-Type": "application/json" } });
}

// ── Tracker: list files ───────────────────────────────────────────────────────
async function handleTrackerFiles(url: URL, env: WorkerEnv): Promise<Response> {
	const taskId = url.pathname.replace("/api/tracker/files/", "");
	const row = await env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?")
		.bind(taskId)
		.first<{ files: string | null }>();
	return new Response(row?.files ?? "[]", { headers: { "Content-Type": "application/json" } });
}

// ── Tracker: delete file ──────────────────────────────────────────────────────
async function handleTrackerFileDelete(request: Request, env: WorkerEnv): Promise<Response> {
	const { taskId, fileId } = (await request.json()) as { taskId: number; fileId: string };

	const row = await env.TRACKER_DB.prepare("SELECT files FROM tasks WHERE id = ?")
		.bind(taskId)
		.first<{ files: string | null }>();
	const files = (JSON.parse(row?.files ?? "[]") as TaskFileRef[]).filter((f) => f.id !== fileId);
	await env.TRACKER_DB.prepare("UPDATE tasks SET files = ? WHERE id = ?")
		.bind(JSON.stringify(files), taskId)
		.run();

	// Remove from EmDash media (best effort — keeps dashboard in sync)
	const baseUrl = new URL(request.url).origin;
	await fetch(`${baseUrl}/_emdash/api/media/${fileId}`, {
		method: "DELETE",
		headers: { Cookie: request.headers.get("Cookie") ?? "" },
	}).catch(() => {});

	return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}

// ── Tracker: serve file ───────────────────────────────────────────────────────
async function handleTrackerFile(url: URL, env: WorkerEnv): Promise<Response> {
	const key = decodeURIComponent(url.pathname.replace("/api/tracker/file/", ""));
	const obj = await env.MEDIA.get(key);
	if (!obj) return new Response("Not found", { status: 404 });
	return new Response(obj.body, {
		headers: {
			"Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
			"Content-Disposition": `attachment; filename="${key.split("/").pop()}"`,
		},
	});
}

export default {
	async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// ── MCP endpoint ──────────────────────────────────────────────────────
		// Stateless proxy: tracker_* tools handled locally; everything else
		// forwarded to /_emdash/api/mcp with the caller's bearer token.
		if (url.pathname === "/mcp") {
			return handleMcp(request, env);
		}

		// ── Tracker API — intercepted before Astro to avoid body consumption ──
		if (url.pathname.startsWith("/api/tracker")) {
			const bearerToken = request.headers.get("Authorization")?.replace("Bearer ", "");
			const hasValidToken = env.EMDASH_TOKEN && bearerToken === env.EMDASH_TOKEN;
			if (!hasValidToken && !(await isAuthenticated(request, env))) {
				return new Response("Unauthorized", { status: 401 });
			}
			if (url.pathname === "/api/tracker" && request.method === "POST") {
				return handleTrackerQuery(request, env);
			}
			if (url.pathname === "/api/tracker/upload" && request.method === "POST") {
				return handleTrackerUpload(request, env);
			}
			if (url.pathname.startsWith("/api/tracker/files/") && request.method === "GET") {
				return handleTrackerFiles(url, env);
			}
			if (url.pathname === "/api/tracker/file" && request.method === "DELETE") {
				return handleTrackerFileDelete(request, env);
			}
			if (url.pathname.startsWith("/api/tracker/file/") && request.method === "GET") {
				return handleTrackerFile(url, env);
			}
			return new Response("Not found", { status: 404 });
		}

		const response = await handler.fetch(request, env, ctx);

		// Cache public GET pages at the edge (skip for authenticated users or non-200s)
		if (
			request.method === "GET" &&
			response.status === 200 &&
			!request.headers.get("Cookie")?.includes("astro-session")
		) {
			const cached = new Response(response.body, response);
			cached.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
			return cached;
		}

		return response;
	},
};
