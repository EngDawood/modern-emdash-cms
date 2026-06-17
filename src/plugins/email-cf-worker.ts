/**
 * Email Provider Plugin — Cloudflare Email Routing (paid plan)
 *
 * Sends via the native send_email binding (cloudflare:email + mimetext).
 * Requires Email Routing to be active on engdawood.com and the SEND_EMAIL
 * binding declared in wrangler.prod.jsonc.
 */

import { EmailMessage } from "cloudflare:email";
import type { PluginContext, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";
import { createMimeMessage } from "mimetext";
import { env as cfEnv } from "cloudflare:workers";

const FROM = "noreply@engdawood.com";

export function createPlugin(): ResolvedPlugin {
	return definePlugin({
		id: "email-cf-provider",
		version: "0.1.0",
		capabilities: ["hooks.email-transport:register"],

		hooks: {
			"email:deliver": {
				exclusive: true,
				handler: async (
					event: { message: { to: string; subject: string; text: string; html?: string } },
					_ctx: PluginContext,
				) => {
					const msg = createMimeMessage();
					msg.setSender({ name: "Dawood", addr: FROM });
					msg.setRecipient(event.message.to);
					msg.setSubject(event.message.subject);
					msg.addMessage({ contentType: "text/plain", data: event.message.text });
					if (event.message.html) {
						msg.addMessage({ contentType: "text/html", data: event.message.html });
					}

					const emailMessage = new EmailMessage(FROM, event.message.to, msg.asRaw());
					const env = cfEnv as unknown as Record<string, { send(msg: EmailMessage): Promise<void> }>;
					await env.SEND_EMAIL.send(emailMessage);
				},
			},
		},
	});
}

export default createPlugin;
