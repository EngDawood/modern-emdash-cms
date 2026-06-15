/**
 * AI Generate field widget plugin.
 *
 * Adds an "AI Generate" widget to `string`/`text` fields. The admin widget
 * (see admin.tsx) renders the normal input plus a "Generate with AI" button
 * that posts the entry title to the `generate` route below. The route calls
 * Cloudflare Workers AI and returns a one-sentence summary the widget drops
 * into the field.
 *
 * Usage: set `"widget": "ai:generate"` on a string/text field in the schema.
 */

import type { ResolvedPlugin, RouteContext } from "emdash";
import { definePlugin } from "emdash";
import { z } from "astro/zod";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

/** Build the generation prompt for a given field label. */
function buildPrompt(title: string, label: string): string {
	return [
		`You are writing the "${label}" field for a piece of web content.`,
		`The content title is: "${title}".`,
		"Write a single compelling sentence, at most 160 characters, that summarizes it.",
		"Return only the sentence — no quotes, no preamble, no markdown.",
	].join("\n");
}

export function createPlugin(): ResolvedPlugin {
	return definePlugin({
		id: "ai",
		version: "0.1.0",

		admin: {
			fieldWidgets: [
				{ name: "generate", label: "AI Generate", fieldTypes: ["string", "text"] },
			],
		},

		routes: {
			generate: {
				input: z.object({
					title: z.string().min(1),
					label: z.string().optional(),
				}),
				handler: async (ctx: RouteContext) => {
					const { title, label } = ctx.input as { title: string; label?: string };
					const fieldLabel = (label ?? "summary").trim() || "summary";

					const { env } = await import("cloudflare:workers");
					const ai = (env as unknown as Record<string, unknown>).AI as
						| { run: (model: string, opts: unknown) => Promise<{ response?: string }> }
						| undefined;
					if (!ai) {
						return { ok: false, error: "Workers AI binding 'AI' not found" };
					}

					try {
						const out = await ai.run(MODEL, {
							prompt: buildPrompt(title, fieldLabel),
							max_tokens: 120,
							temperature: 0.5,
						});
						const text = String(out?.response ?? "")
							.trim()
							.replace(/^["']|["']$/g, "");
						return { ok: true, text };
					} catch {
						return { ok: false, error: "AI generation failed" };
					}
				},
			},
		},
	});
}

export default createPlugin;
