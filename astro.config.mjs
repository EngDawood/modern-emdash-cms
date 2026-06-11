import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { aiModerationPlugin } from "@emdash-cms/plugin-ai-moderation";
import atproto from "@emdash-cms/plugin-atproto";
import auditLog from "@emdash-cms/plugin-audit-log";
import { colorPlugin } from "@emdash-cms/plugin-color";
import { embedsPlugin } from "@emdash-cms/plugin-embeds";
import { formsPlugin } from "@emdash-cms/plugin-forms";
import webhookNotifier from "@emdash-cms/plugin-webhook-notifier";
import { customBlocksPlugin } from "@emdash.directory/plugin-custom-blocks";
import { calloutPlugin } from "@plugdash/callout";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";

const emailWorkerEntrypoint = fileURLToPath(
	new URL("./src/plugins/email-cf-worker.ts", import.meta.url),
).replaceAll("\\", "/");

const trackerLinkEntrypoint = fileURLToPath(
	new URL("./src/plugins/tracker-link.ts", import.meta.url),
).replaceAll("\\", "/");

const trackerLinkAdminEntry = fileURLToPath(
	new URL("./src/plugins/tracker-link.admin.tsx", import.meta.url),
).replaceAll("\\", "/");

const seoEntrypoint = fileURLToPath(
	new URL("./src/plugins/seo/index.ts", import.meta.url),
).replaceAll("\\", "/");

const seoAdminEntry = fileURLToPath(
	new URL("./src/plugins/seo/admin.tsx", import.meta.url),
).replaceAll("\\", "/");

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	fonts: [
		{ provider: fontProviders.google(), name: "Playfair Display", cssVariable: "--font-playfair", weights: [400, 500, 700], styles: ["normal", "italic"] },
		{ provider: fontProviders.google(), name: "JetBrains Mono", cssVariable: "--font-jetbrains", weights: [400] },
		{ provider: fontProviders.google(), name: "Amiri", cssVariable: "--font-amiri", weights: [400, 700] },
		{ provider: fontProviders.google(), name: "Cairo", cssVariable: "--font-cairo", weights: [400, 500, 600] },
	],
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			mcp:true ,
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			plugins: [
				formsPlugin(),
				colorPlugin(),
				embedsPlugin(),
				calloutPlugin(),
				{
					id: "seo",
					version: "0.10.0",
					format: "native",
					entrypoint: seoEntrypoint,
					adminEntry: seoAdminEntry,
					adminPages: [
						{ path: "/settings", label: "SEO", icon: "settings" },
						{ path: "/fuzzy-redirects", label: "Fuzzy Redirects", icon: "arrow-right" },
					],
				},
				aiModerationPlugin(),
				{
					id: "email-cf-provider",
					version: "0.1.0",
					format: "native",
					entrypoint: emailWorkerEntrypoint,
					capabilities: ["hooks.email-transport:register"],
				},
				{
					id: "tracker-link",
					version: "0.1.0",
					format: "native",
					entrypoint: trackerLinkEntrypoint,
					adminEntry: trackerLinkAdminEntry,
					adminPages: [{ path: "/", label: "Tracker", icon: "table" }],
					adminWidgets: [{ id: "tracker-open", title: "Task Tracker", size: "third" }],
				},
			],
			sandboxed: [...(process.env.NODE_ENV !== "production" ? [webhookNotifier] : []), auditLog, atproto, customBlocksPlugin()],
			sandboxRunner: sandbox(),
			marketplace: "https://marketplace.emdashcms.com",
		}),
	],
	devToolbar: { enabled: false },
	vite: {
		optimizeDeps: {
			include: [
				"emdash/middleware",
				"emdash/middleware/redirect",
				"emdash/middleware/setup",
				"emdash/middleware/auth",
				"emdash/middleware/request-context",
				"@emdash-cms/cloudflare/db/d1",
				"emdash/media/local-runtime",
				"@emdash-cms/plugin-forms",
				"@emdash-cms/cloudflare/storage/r2",
				"emdash/ui",
				"@emdash-cms/plugin-forms/astro",
				"@emdash-cms/plugin-color",
				"@emdash-cms/plugin-embeds",
				"@emdash-cms/plugin-embeds/astro",
				"@plugdash/callout",
				"@plugdash/callout/astro",
				"astro/zod",
				"emdash/runtime",
			],
		},
	},
});
