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

	// ── Meta ──────────────────────────────────────────────────────────────
	const meta: Record<string, unknown> = {
		rssSourceId: item.sourceId,
		rssSourceUrl: source.url,
		rssGuid: item.guid,
	};
	if (item.enclosure !== undefined) meta.rssEnclosure = item.enclosure;
	if (item.audioUrl !== undefined) meta.rssAudioUrl = item.audioUrl;
	if (item.youtubeVideoId !== undefined) meta.rssYoutubeId = item.youtubeVideoId;
	if (item.mediaType !== undefined) meta.rssMediaType = item.mediaType;

	// ── Payload ───────────────────────────────────────────────────────────
	const payload: Record<string, unknown> = {
		title: item.title,
		slug,
		content: htmlToPortableText(finalBody),
		status: profile.status,
		publishedAt: item.publishedAt,
		meta,
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

		// ── Create or update ──────────────────────────────────────────────
		if (existingContentId) {
			try {
				await ctx.content.update?.(profile.collection, existingContentId, payload);
			} catch (err) {
				const errMsg = String(err);
				if (errMsg.includes("no such column") || errMsg.includes("categories")) {
					const { categories, ...stripped } = payload;
					await ctx.content.update?.(profile.collection, existingContentId, stripped);
				} else {
					throw err;
				}
			}
			return { action: "updated", contentId: existingContentId };
		}

		let entry;
		try {
			entry = await ctx.content.create?.(profile.collection, payload);
		} catch (err) {
			const errMsg = String(err);
			if (errMsg.includes("no such column") || errMsg.includes("categories")) {
				const { categories, ...stripped } = payload;
				entry = await ctx.content.create?.(profile.collection, stripped);
			} else {
				throw err;
			}
		}
		return { action: "created", contentId: entry?.id };

	} catch (err) {
		ctx.log.warn("publishItem failed", { sourceId: item.sourceId, guid: item.guid, error: String(err) });
		return { action: "skipped", error: String(err) };
	}
}
