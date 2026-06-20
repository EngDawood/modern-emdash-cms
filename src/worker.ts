import handler from "@astrojs/cloudflare/entrypoints/server";
import { EmDashMCP, handleMcp } from "./mcp";

interface WorkerEnv extends Cloudflare.Env {
	MCP_OBJECT: DurableObjectNamespace<EmDashMCP>;
}

export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";
export { EmDashMCP };

export default {
	async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/mcp") {
			return handleMcp(request, env);
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

	async email(
		message: {
			readonly from: string;
			readonly to: string;
			readonly raw: ReadableStream<Uint8Array>;
			readonly rawSize: number;
			setReject(reason: string): void;
		},
		env: WorkerEnv,
		ctx: ExecutionContext,
	): Promise<void> {
		const inboundSecret = await env.SESSION.get("settings:inboundSecret");
		if (!inboundSecret) {
			console.error("[worker:email] settings:inboundSecret not set in KV");
			message.setReject("Receiver not configured");
			return;
		}

		const rawMime = await new Response(message.raw).text();

		const response = await env.SELF.fetch("http://localhost/_emdash/api/plugins/emdash-inbox/inbound", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Inbound-Secret": inboundSecret,
				"X-EmDash-Request": "1",
			},
			body: JSON.stringify({ rawMime }),
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "<no body>");
			console.error(`[worker:email] inbound forward failed: ${response.status} ${body}`);
			message.setReject(`Ingest failed: ${response.status}`);
		}
	},
};
