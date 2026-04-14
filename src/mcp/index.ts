/**
 * EmDash MCP Agent (Cloudflare Workers)
 *
 * Remote MCP server deployed at /mcp on the existing EmDash worker.
 * Exposes the same tools as mcp/server.ts but over HTTP (SSE) instead of stdio.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { EmDashClient } from "emdash/client";
import { registerTools } from "./tools.js";

interface Env extends Cloudflare.Env {
	MCP_OBJECT: DurableObjectNamespace;
	EMDASH_URL?: string;
	EMDASH_TOKEN?: string;
}

export class EmDashMCP extends McpAgent<Env> {
	server = new McpServer({ name: "emdash", version: "1.0.0" });

	async init() {
		const client = new EmDashClient({
			baseUrl: this.env.EMDASH_URL ?? "https://wp.engdawood.com",
			token: this.env.EMDASH_TOKEN,
		});
		registerTools(this.server, client);
	}
}
