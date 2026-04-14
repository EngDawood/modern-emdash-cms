/**
 * EmDash MCP Server (stdio)
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
import { registerTools } from "../src/mcp/tools.js";

const baseUrl = process.env["EMDASH_URL"] ?? "http://localhost:4321";
const token = process.env["EMDASH_TOKEN"];
const isLocal = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

const client = new EmDashClient({
	baseUrl,
	token,
	devBypass: !token && isLocal,
});

const server = new McpServer({ name: "emdash", version: "1.0.0" });
registerTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
