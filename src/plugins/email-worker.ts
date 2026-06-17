/**
 * Email Provider Plugin
 *
 * Native EmDash plugin that delivers emails via the Resend API.
 * Requires RESEND_API_KEY to be set as a Cloudflare Worker secret.
 */

import type { PluginContext, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";
// On Cloudflare Workers, runtime secrets come from the Workers env, not import.meta.env.
import { env as cfEnv } from "cloudflare:workers";

export function createPlugin(): ResolvedPlugin {
	return definePlugin({
		id: "email-resend-provider",
		version: "0.1.0",
		capabilities: ["hooks.email-transport:register"],

		hooks: {
			"email:deliver": {
				exclusive: true,
				handler: async (
					event: { message: { to: string; subject: string; text: string; html?: string }; source: string },
					_ctx: PluginContext,
				) => {
					const apiKey =
						(cfEnv as unknown as Record<string, string | undefined>).RESEND_API_KEY ??
						import.meta.env.RESEND_API_KEY;
					const res = await fetch("https://api.resend.com/emails", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${apiKey}`,
						},
						body: JSON.stringify({
							from: "noreply@engdawood.com",
							to: [event.message.to],
							subject: event.message.subject,
							text: event.message.text,
							...(event.message.html ? { html: event.message.html } : {}),
						}),
					});
					if (!res.ok) {
						throw new Error(`Resend responded with ${res.status}: ${await res.text()}`);
					}
				},
			},
		},
	});
}

export default createPlugin;
