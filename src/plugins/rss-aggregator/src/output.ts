/**
 * Output publisher for the RSS Aggregator plugin.
 * Builds content-entry payloads from Output Profiles and publishes them via ctx.content.
 * No Node APIs — safe for Cloudflare Workers runtime.
 */

import type { PluginContext } from "emdash";
import type { Source, FeedItem, OutputProfile, PluginSettings, Agent } from "./types.js";
import { agents } from "./utils.js";
import { slugify, resolveTemplate } from "./template.js";
import { htmlToPortableText } from "./html-parser.js";

export interface PublishResult {
	action: "internal" | "created" | "updated" | "skipped";
	contentId?: string;
	error?: string;
}

/**
 * Pure: build the content-entry payload from a profile + item + source.
 * `outputsByAgentName` maps each custom agent's NAME to its produced text,
 * making it available as `{output.<agentName>}` in the footer template.
 */
export function buildPublishPayload(opts: {
	source: Source;
	item: FeedItem;
	profile: OutputProfile;
	outputsByAgentName?: Record<string, string>;
}): Record<string, unknown> {
	const { source, item, profile, outputsByAgentName = {} } = opts;

	// ── Slug ──────────────────────────────────────────────────────────────
	const sourceSlug = source.slug || slugify(source.name);
	const itemSlug = slugify(item.title);
	const slug = resolveTemplate(profile.slugPattern || "{itemSlug}", { itemSlug, sourceSlug });

	// ── Body ──────────────────────────────────────────────────────────────
	let body: string;
	switch (profile.bodySource) {
		case "rewrite":
			body = item.rewrittenContent ?? item.content ?? "";
			break;
		case "summary":
			body = item.summary ?? item.content ?? "";
			break;
		case "original":
		default:
			body = item.content ?? "";
			break;
	}

	// ── Footer ────────────────────────────────────────────────────────────
	const agentTokens: Record<string, string> = {};
	for (const [name, text] of Object.entries(outputsByAgentName)) {
		agentTokens[`output.${name}`] = text;
	}

	const footerTokens: Record<string, string> = {
		sourceName: source.name,
		sourceUrl: source.url,
		originalUrl: item.url,
		originalTitle: item.title,
		author: item.author?.name ?? "",
		publishedAt: item.publishedAt,
		summary: item.summary ?? "",
		sourceSlug,
		itemSlug,
		...agentTokens,
	};

	const footer = profile.footerTemplate
		? resolveTemplate(profile.footerTemplate, footerTokens)
		: "";

	const finalBody = body + (footer ? "\n" + footer : "");

	// ── Excerpt ───────────────────────────────────────────────────────────
	let excerpt: string | undefined;
	switch (profile.excerptSource) {
		case "summary":
			excerpt = item.summary;
			break;
		case "original":
			excerpt = item.excerpt;
			break;
		case "none":
		default:
			excerpt = undefined;
			break;
	}

	// ── Meta & SEO ────────────────────────────────────────────────────────
	const meta: Record<string, unknown> = {
		rssSourceId: item.sourceId,
		rssSourceUrl: source.url,
		rssGuid: item.guid,
	};
	if (item.enclosure !== undefined) meta.rssEnclosure = item.enclosure;
	if (item.audioUrl !== undefined) meta.rssAudioUrl = item.audioUrl;
	if (item.youtubeVideoId !== undefined) meta.rssYoutubeId = item.youtubeVideoId;
	if (item.mediaType !== undefined) meta.rssMediaType = item.mediaType;

	const seo = {
		title: item.title,
		description: excerpt ?? item.summary ?? item.excerpt ?? "",
		image: item.imageUrl ?? null,
		canonical: item.url ?? null,
		noIndex: false,
	};

	// ── Payload ───────────────────────────────────────────────────────────
	const payload: Record<string, unknown> = {
		title: item.title,
		slug,
		content: htmlToPortableText(finalBody),
		status: profile.status,
		publishedAt: item.publishedAt,
		meta,
		seo,
	};

	if (excerpt !== undefined) payload.excerpt = excerpt;
	if (item.author?.name !== undefined) payload.author = item.author.name;
	const categories: string[] = [];
	if (profile.defaultCategories && Array.isArray(profile.defaultCategories)) {
		categories.push(...profile.defaultCategories);
	}
	if (profile.mapFeedCategories !== false) {
		if (sourceSlug) categories.push(sourceSlug);
	}
	if (categories.length > 0) {
		payload.categories = Array.from(new Set(categories));
	}

	// ── Custom Fields & Generic Schema Aliases ────────────────────────────
	const data: Record<string, unknown> = {
		title: item.title,
	};

	if (item.customFields) {
		for (const [key, val] of Object.entries(item.customFields)) {
			if (typeof val === "string" && (/<[a-z][\s\S]*>/i.test(val) || key.includes("description") || key.includes("content"))) {
				data[key] = htmlToPortableText(val);
				payload[key] = data[key];
			} else {
				data[key] = val;
				payload[key] = val;
			}
		}
	}

	// Dynamic schema fallback aliases for custom collections (e.g. jobs, events)
	if (data.job_descriptions === undefined) {
		data.job_descriptions = htmlToPortableText(finalBody);
		payload.job_descriptions = data.job_descriptions;
	}
	if (data.original_url === undefined) {
		data.original_url = item.url;
		payload.original_url = data.original_url;
	}
	if (data.deadline === undefined) {
		data.deadline = item.publishedAt;
		payload.deadline = data.deadline;
	}
	if (data.job_posting === undefined) {
		data.job_posting = item.publishedAt;
		payload.job_posting = data.job_posting;
	}

	payload.data = data;

	return payload;
}

/**
 * Resolve custom-agent outputs for the source, build the payload, then
 * create or update the content entry via ctx.content.
 *
 * Never throws — returns `{ action: "skipped", error }` on any failure.
 */
export async function publishItem(
	ctx: PluginContext,
	settings: PluginSettings,
	opts: {
		source: Source;
		item: FeedItem;
		profile: OutputProfile | null;
		existingContentId?: string;
	},
): Promise<PublishResult> {
	const { source, item, profile, existingContentId } = opts;

	// Internal mode or no profile → nothing to publish.
	if (!profile || profile.mode === "internal") {
		return { action: "internal" };
	}

	try {
		// ── Resolve custom-agent outputs ──────────────────────────────────
		const outputsByAgentName: Record<string, string> = {};
		for (const agentId of source.aiAgentIds ?? []) {
			const agent = (await agents(ctx).get(agentId)) as Agent | null;
			if (!agent) continue;
			const produced = item.aiOutputs?.[agentId];
			if (produced !== undefined) {
				outputsByAgentName[agent.name] = produced;
			}
		}

		const payload = buildPublishPayload({ source, item, profile, outputsByAgentName });

		// ── Guard: content API must be available ──────────────────────────
		if (!ctx.content) {
			return { action: "skipped", error: "no content access" };
		}

		// ── Helper for operations with dynamic missing column recovery ─────
		const executeWithFallback = async <T>(
			op: (p: Record<string, unknown>) => Promise<T>
		): Promise<T> => {
			let cur = { ...payload };
			const stripped = new Set<string>();
			while (true) {
				try {
					return await op(cur);
				} catch (err) {
					const errMsg = String(err);
					const match =
						errMsg.match(/has no column named ([a-zA-Z0-9_]+)/i) ||
						errMsg.match(/no such column:?\s*(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)/i);

					let fieldToStrip: string | null = null;
					if (match && match[1]) {
						fieldToStrip = match[1];
					} else if (errMsg.includes("categories") && "categories" in cur) {
						fieldToStrip = "categories";
					}

					if (fieldToStrip && !stripped.has(fieldToStrip)) {
						if (fieldToStrip !== "title" && fieldToStrip !== "slug") {
							stripped.add(fieldToStrip);
							delete cur[fieldToStrip];
							if (cur.data && typeof cur.data === "object") {
								delete (cur.data as Record<string, unknown>)[fieldToStrip];
							}
							continue;
						}
					}
					throw err;
				}
			}
		};

		// ── Create or update ──────────────────────────────────────────────
		let contentId = existingContentId;
		let action: "created" | "updated" = "updated";
		if (existingContentId) {
			await executeWithFallback((p) => ctx.content!.update!(profile.collection, existingContentId, p));
		} else {
			const entry = await executeWithFallback((p) => ctx.content!.create!(profile.collection, p));
			contentId = entry?.id;
			action = "created";
		}

		if (contentId && profile.status === "published" && (ctx.content as any).publish) {
			try {
				await (ctx.content as any).publish(profile.collection, contentId, { publishedAt: item.publishedAt });
			} catch (pubErr) {
				ctx.log.warn("Failed to set live published revision", { contentId, error: String(pubErr) });
			}
		}

		return { action, contentId };

	} catch (err) {
		ctx.log.warn("publishItem failed", { sourceId: item.sourceId, guid: item.guid, error: String(err) });
		return { action: "skipped", error: String(err) };
	}
}
