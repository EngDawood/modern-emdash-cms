import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { formsPlugin } from "@emdash-cms/plugin-forms";
import { webhookNotifierPlugin } from "@emdash-cms/plugin-webhook-notifier";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";

const emailWorkerEntrypoint = fileURLToPath(
	new URL("./src/plugins/email-worker.ts", import.meta.url),
).replaceAll("\\", "/");

const trackerLinkEntrypoint = fileURLToPath(
	new URL("./src/plugins/tracker-link.ts", import.meta.url),
).replaceAll("\\", "/");

const trackerLinkAdminEntry = fileURLToPath(
	new URL("./src/plugins/tracker-link.admin.tsx", import.meta.url),
).replaceAll("\\", "/");

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			plugins: [
				formsPlugin(),
				{
					id: "email-resend-provider",
					version: "0.1.0",
					entrypoint: emailWorkerEntrypoint,
					capabilities: ["email:provide"],
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
			sandboxed: [webhookNotifierPlugin()],
			sandboxRunner: sandbox(),
			marketplace: "https://marketplace.emdashcms.com",
		}),
	],
	devToolbar: { enabled: false },
});
