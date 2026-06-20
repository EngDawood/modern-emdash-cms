/**
 * EmDash MCP Proxy (Cloudflare Workers)
 *
 * Single MCP endpoint at /mcp that proxies all requests to the built-in
 * EmDash MCP at /_emdash/api/mcp, merging in the inbox plugin tools.
 *
 * Auth: Bearer token via Authorization header OR ?token= query param.
 * The same token is forwarded upstream as `Authorization: Bearer <token>`,
 * so a valid EmDash PAT (ec_pat_*) authenticates against the built-in.
 */

import { DurableObject } from "cloudflare:workers";

interface Env extends Cloudflare.Env {
	MCP_OBJECT: DurableObjectNamespace<EmDashMCP>;
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

async function parseSseOrJson(res: Response): Promise<{ result?: { tools?: unknown[] } }> {
	const ct = res.headers.get("Content-Type") ?? "";
	if (ct.includes("application/json")) return res.json();
	const text = await res.text();
	const match = text.match(/^data: (.+)$/m);
	if (!match) throw new Error(`No data event in SSE response: ${text.slice(0, 200)}`);
	return JSON.parse(match[1]);
}

const INBOX_TOOL_NAMES = new Set([
	"list_threads",
	"get_thread",
	"search_messages",
	"mark_read",
	"pin_thread",
	"snooze_thread",
	"mark_done",
]);

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

	// tools/list — merge upstream tools and inbox plugin tools
	if (rpc.method === "tools/list") {
		let upstreamTools: unknown[] = [];
		try {
			const res = await upstreamFetch({ method: "POST", headers: upstreamHeaders, body: JSON.stringify(rpc) });
			const upstreamData = await parseSseOrJson(res);
			upstreamTools = (upstreamData.result?.tools as unknown[]) ?? [];
		} catch {
			// upstream unavailable
		}

		let inboxTools: unknown[] = [];
		try {
			const inboxRes = await env.SELF.fetch(new Request(`${baseUrl}/_emdash/api/plugins/emdash-inbox/messages/mcp`, {
				method: "POST",
				headers: upstreamHeaders,
				body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
			}));
			if (inboxRes.ok) {
				const inboxData = (await inboxRes.json()) as any;
				inboxTools = inboxData.result?.tools ?? [];
			}
		} catch (e) {
			console.error("Failed to fetch inbox plugin tools:", e);
		}

		return Response.json(
			{ jsonrpc: "2.0", id: rpc.id, result: { tools: [...upstreamTools, ...inboxTools] } },
			{ headers: CORS_HEADERS },
		);
	}

	// tools/call for inbox plugin tools
	if (rpc.method === "tools/call" && typeof rpc.params?.name === "string" && INBOX_TOOL_NAMES.has(rpc.params.name)) {
		try {
			const inboxRes = await env.SELF.fetch(new Request(`${baseUrl}/_emdash/api/plugins/emdash-inbox/messages/mcp`, {
				method: "POST",
				headers: upstreamHeaders,
				body: JSON.stringify(rpc),
			}));
			if (!inboxRes.ok) {
				const body = await inboxRes.text().catch(() => "<no body>");
				throw new Error(`Inbox plugin returned ${inboxRes.status}: ${body}`);
			}
			const inboxData = (await inboxRes.json()) as any;
			return Response.json(inboxData, { headers: CORS_HEADERS });
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

export class EmDashMCP extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		return handleMcp(request, this.env);
	}
}
