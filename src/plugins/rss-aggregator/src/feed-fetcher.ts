/**
 * @dawod/emdash-rss-aggregator
 *
 * Import pipeline that fetches feed, parses items, filters them,
 * deduplicates against database, and syncs them to storage and content collections.
 */

import type { PluginContext, StorageCollection } from "emdash";
import type {
	Source,
	FeedItem,
	ImportLog,
	PluginSettings,
	RejectListEntry,
	ParsedItem,
	MediaType,
	AuthorInfo,
} from "./types.js";
import { parseFeed, extractYouTubeVideoId } from "./feed-parser.js";
import { fetchFullText } from "./full-text.js";
import { importImages } from "./image-importer.js";
import { applyFieldMappings } from "./field-mapper.js";
import { applyAgents } from "./ai-service.js";
import { publishItem } from "./output.js";
import { generateId, outputProfiles } from "./utils.js";
import { htmlToPortableText } from "./html-parser.js";
import type { OutputProfile } from "./types.js";

export function applyKeywordFilter(items: ParsedItem[], source: Source): ParsedItem[] {
	if (!source.keywordFilterEnabled || !source.keywords || source.keywords.length === 0) {
		return items;
	}
	const keywords = source.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
	if (keywords.length === 0) return items;

	const matchIn = source.keywordMatchIn || ["title"];
	const mode = source.keywordFilterMode || "include";

	return items.filter((item) => {
		let matched = false;
		for (const kw of keywords) {
			if (matchIn.includes("title") && item.title?.toLowerCase().includes(kw)) {
				matched = true;
				break;
			}
			if (matchIn.includes("content") && item.content?.toLowerCase().includes(kw)) {
				matched = true;
				break;
			}
			if (matchIn.includes("content") && item.description?.toLowerCase().includes(kw)) {
				matched = true;
				break;
			}
		}
		return mode === "include" ? matched : !matched;
	});
}

export function trimContentToWords(html: string, maxWords: number): string {
	if (!html) return "";
	const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
	const words = text.split(/\s+/);
	if (words.length <= maxWords) return html;
	return words.slice(0, maxWords).join(" ") + "...";
}

export function generateExcerpt(content: string, maxWords: number): string {
	if (!content) return "";
	const text = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
	const words = text.split(/\s+/);
	if (words.length <= maxWords) return text;
	return words.slice(0, maxWords).join(" ") + "...";
}

export function extractImageFromContent(html: string): string | null {
	if (!html) return null;
	const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
	return match ? match[1] : null;
}

// ── Import Pipeline ────────────────────────────────────────────────────

/**
 * Fetches, parses, filters, deduplicates and imports a single feed source.
 */
export async function fetchAndImportFeed(
	source: Source,
	ctx: PluginContext,
	settings: PluginSettings,
	sourceId: string,
): Promise<ImportLog> {
	const start = Date.now();
	const now = new Date().toISOString();
	let itemsFound = 0;
	let itemsImported = 0;
	let itemsSkipped = 0;
	let itemsRejected = 0;
	let itemsUpdated = 0;
	let feedTitle: string | undefined;

	// Type cast collections
	const rejectList = ctx.storage.rejectList as StorageCollection<RejectListEntry>;
	const feedItems = ctx.storage.feedItems as StorageCollection<FeedItem>;
	const sources = ctx.storage.sources as StorageCollection<Source>;
	const importLogs = ctx.storage.importLogs as StorageCollection<ImportLog>;

	try {
		if (!ctx.http) {
			throw new Error("HTTP client capability is missing");
		}

		// 1. Fetch feed XML
		const response = await ctx.http.fetch(source.url, {
			headers: { "User-Agent": settings.userAgent || "EmDash RSS Aggregator/1.0" },
			signal: AbortSignal.timeout(settings.fetchTimeout || 30000),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const xml = await response.text();

		// 2. Parse feed XML
		const parsedFeed = parseFeed(xml);
		feedTitle = parsedFeed.title;
		itemsFound = parsedFeed.items.length;

		// 3. Apply keyword filtering
		let filteredItems = applyKeywordFilter(parsedFeed.items, source);

		// 4. Load reject list for this source to filter out rejected GUIDs
		const rejectedGuids = new Set<string>();
		let rejCursor: string | undefined;
		do {
			const res = await rejectList.query({
				where: { sourceId },
				limit: 1000,
				cursor: rejCursor,
			});
			for (const item of res.items) {
				if (item.data.guid) {
					rejectedGuids.add(item.data.guid);
				}
			}
			rejCursor = res.cursor;
		} while (rejCursor);

		const preRejectCount = filteredItems.length;
		filteredItems = filteredItems.filter((item) => !rejectedGuids.has(item.guid));
		itemsRejected = preRejectCount - filteredItems.length;

		// 5. Load existing items for this source to deduplicate
		const existingItems = new Map<string, { id: string; contentId?: string; publishedContentId?: string }>();
		let itemCursor: string | undefined;
		do {
			const res = await feedItems.query({
				where: { sourceId },
				limit: 1000,
				cursor: itemCursor,
			});
			for (const item of res.items) {
				const key = source.uniqueBy === "title" ? item.data.title : item.data.guid;
				if (key) {
					existingItems.set(key, { id: item.id, contentId: (item.data as any).contentId, publishedContentId: (item.data as any).publishedContentId });
				}
			}
			itemCursor = res.cursor;
		} while (itemCursor);

		// Determine content collection name
		const collectionName = settings.contentCollection || "feed-items";

		// 6. Process items
		for (const parsed of filteredItems) {
			const key = source.uniqueBy === "title" ? parsed.title : parsed.guid;
			const existing = existingItems.get(key);

			if (existing && source.reconcileStrategy === "preserve") {
				itemsSkipped++;
				continue;
			}

			// Trim content
			let content = parsed.content || parsed.description || "";
			if (source.trimContent && source.contentMaxWords > 0) {
				content = trimContentToWords(content, source.contentMaxWords);
			}

			// Generate excerpt
			let excerpt = generateExcerpt(parsed.description || parsed.content || "", 40);

			// Extract image
			let imageUrl: string | undefined;
			if (source.assignFeaturedImage) {
				if (source.featuredImageSource === "enclosure" && parsed.enclosure?.url) {
					imageUrl = parsed.enclosure.url;
				} else if (source.featuredImageSource === "media-thumbnail" && parsed.mediaThumbnail) {
					imageUrl = parsed.mediaThumbnail;
				} else {
					imageUrl = extractImageFromContent(parsed.content || "") || parsed.mediaThumbnail || parsed.enclosure?.url || undefined;
				}
			}

			// Detect YouTube Video ID
			let youtubeVideoId: string | undefined;
			if (settings.enableYouTubeDetection) {
				youtubeVideoId = extractYouTubeVideoId(parsed.link) || extractYouTubeVideoId(parsed.guid) || undefined;
			}

			// Detect Audio/Podcast
			let audioUrl: string | undefined;
			let mediaType: MediaType = "article";
			if (parsed.enclosure?.type?.startsWith("audio/") || parsed.enclosure?.url?.match(/\.(mp3|wav|ogg|aac|m4a)$/i)) {
				audioUrl = parsed.enclosure.url;
				mediaType = "audio";
			}
			if (youtubeVideoId) {
				mediaType = "video";
			}

			const authorInfo: AuthorInfo = parsed.author || { name: "Feed Importer" };
			if (source.authorHandling === "override" && source.overrideAuthor) {
				authorInfo.name = source.overrideAuthor;
			} else if (source.authorHandling === "fallback" && !authorInfo.name && source.fallbackAuthor) {
				authorInfo.name = source.fallbackAuthor;
			}

			// ── Full Text RSS (premium) ──────────────────────────────────
			// For excerpt-only feeds, scrape the full article from the source page.
			if (source.enableFullText && settings.enableFullText && parsed.link) {
				const wordCount = content ? content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length : 0;
				if (settings.fullTextMinWords <= 0 || wordCount < settings.fullTextMinWords) {
					try {
						const full = await fetchFullText(ctx, settings, parsed.link);
						if (full) {
							content = source.trimContent && source.contentMaxWords > 0
								? trimContentToWords(full, source.contentMaxWords)
								: full;
							excerpt = generateExcerpt(content, 40);
						}
					} catch (ftErr) {
						ctx.log.warn("Full-text fetch failed", { guid: parsed.guid, error: String(ftErr) });
					}
				}
			}

			// ── Image Import to Media Library (premium) ──────────────────
			let mediaIds: string[] = [];
			const doImages = source.importImages ?? settings.imageImportEnabled;
			if (doImages) {
				try {
					const imgRes = await importImages(ctx, settings, {
						featuredImageUrl: imageUrl,
						content,
						importContentImages: settings.imageImportContentImages,
					});
					content = imgRes.content;
					if (imgRes.featuredUrl) imageUrl = imgRes.featuredUrl;
					mediaIds = imgRes.mediaIds;
				} catch (imgErr) {
					ctx.log.warn("Image import failed", { guid: parsed.guid, error: String(imgErr) });
				}
			}

			// ── Custom Field Mapping (premium) ───────────────────────────
			const customFields = applyFieldMappings(source.fieldMappings, parsed);

			// ── AI Pipeline ──────────────────────────────────────────────
			// Run the feed's bound agents on its bound model. applyAgents is
			// defensive: returns {} when AI is off, unbound, or out of credits.
			const aiInput = { title: parsed.title, content, excerpt } as unknown as FeedItem;
			const aiFields = await applyAgents(ctx, settings, {
				item: aiInput,
				modelId: source.aiModelId,
				agentIds: source.aiAgentIds,
			});
			const summary = aiFields.summary;
			const rewrittenContent = aiFields.rewrittenContent;
			const translations = aiFields.translations;
			const aiOutputs = aiFields.aiOutputs;
			const aiProcessedAt = aiFields.aiProcessedAt;

			// ── Output profile + approval gate ───────────────────────────
			const profile = source.outputProfileId
				? ((await outputProfiles(ctx).get(source.outputProfileId)) as OutputProfile | null)
				: null;
			const requireApproval = profile?.requireApproval ?? source.requireApproval ?? settings.curationEnabled;
			const status: "pending" | "approved" = requireApproval ? "pending" : "approved";

			const feedItemData: FeedItem = {
				sourceId,
				sourceName: source.name,
				sourceUrl: source.url,
				guid: parsed.guid,
				title: parsed.title,
				url: parsed.link,
				content,
				excerpt,
				author: authorInfo,
				publishedAt: parsed.pubDate || now,
				enclosure: parsed.enclosure,
				imageUrl,
				mediaType,
				youtubeVideoId,
				audioUrl,
				categories: parsed.categories,
				importedAt: now,
				status,
				approvedAt: status === "approved" ? now : undefined,
				summary,
				rewrittenContent,
				aiOutputs,
				aiProcessedAt,
				translations,
				mediaIds: mediaIds.length ? mediaIds : undefined,
				customFields: Object.keys(customFields).length ? customFields : undefined,
			};

			// Content entry payload: custom-mapped fields are promoted to top-level
			// so they can map onto collection fields.
			const contentPayload: Record<string, unknown> = {
				...feedItemData,
				...customFields,
				seo: {
					title: parsed.title,
					description: excerpt,
					image: imageUrl ?? null,
					canonical: parsed.link ?? null,
					noIndex: false,
				},
			};

			const data: Record<string, unknown> = {
				title: parsed.title,
			};

			if (customFields) {
				for (const [key, val] of Object.entries(customFields)) {
					if (typeof val === "string" && (/<[a-z][\s\S]*>/i.test(val) || key.includes("description") || key.includes("content"))) {
						data[key] = htmlToPortableText(val);
						contentPayload[key] = data[key];
					} else {
						data[key] = val;
						contentPayload[key] = val;
					}
				}
			}

			if (data.job_descriptions === undefined) {
				data.job_descriptions = htmlToPortableText(content);
				contentPayload.job_descriptions = data.job_descriptions;
			}
			if (data.original_url === undefined) {
				data.original_url = parsed.link;
				contentPayload.original_url = data.original_url;
			}
			if (data.deadline === undefined) {
				data.deadline = parsed.pubDate || now;
				contentPayload.deadline = data.deadline;
			}
			if (data.job_posting === undefined) {
				data.job_posting = parsed.pubDate || now;
				contentPayload.job_posting = data.job_posting;
			}

			contentPayload.data = data;
			contentPayload.status = "published";

			let targetItemId = existing ? existing.id : generateId("itm");
			let contentId = existing?.contentId;

			// Write content entry
			if (ctx.content) {
				try {
					if (contentId) {
						// Update CMS entry
						await ctx.content.update?.(collectionName, contentId, contentPayload);
					} else {
						// Create CMS entry
						const contentEntry = await ctx.content.create?.(collectionName, contentPayload);
						contentId = contentEntry?.id;
					}
					if (contentId && (ctx.content as any).publish) {
						try {
							await (ctx.content as any).publish(collectionName, contentId, { publishedAt: contentPayload.publishedAt });
						} catch (pubErr) {
							// Ignore
						}
					}
				} catch (contentErr) {
					ctx.log.warn("Failed to sync content entry for feed item", { guid: parsed.guid, error: String(contentErr) });
				}
			}

			// Publish via the output profile. Auto-publish only for approved
			// items; items pending approval are published later by items/approve.
			// Idempotent: reuse the prior published post id to update, not duplicate.
			let publishedContentId = existing?.publishedContentId;
			if (status === "approved" && profile && profile.mode === "publish") {
				const result = await publishItem(ctx, settings, {
					source,
					item: { ...feedItemData, contentId },
					profile,
					existingContentId: publishedContentId,
				});
				if (result.action === "created") publishedContentId = result.contentId;
				else if (result.action === "skipped") {
					ctx.log.warn("Publish skipped", { guid: parsed.guid, error: result.error });
				}
			}

			// Store feed item in plugin storage
			const storedItem: FeedItem = {
				...feedItemData,
				contentId,
				publishedContentId,
			};
			await feedItems.put(targetItemId, storedItem);

			if (existing) {
				itemsUpdated++;
			} else {
				itemsImported++;
			}
		}

		// 7. Cleanup / Truncate old items (Source limit or Settings limit)
		const importLimit = source.importLimit > 0 ? source.importLimit : settings.maxItemsPerSource;
		if (importLimit > 0) {
			const sourceItems = await feedItems.query({
				where: { sourceId },
				orderBy: { publishedAt: "desc" },
				limit: 1000,
			});

			if (sourceItems.items.length > importLimit) {
				const itemsToDelete = sourceItems.items.slice(importLimit);
				for (const item of itemsToDelete) {
					await feedItems.delete(item.id);
					const itemData = item.data as any;
					if (itemData.contentId && ctx.content) {
						try {
							await ctx.content.delete?.(collectionName, itemData.contentId);
						} catch (delErr) {
							ctx.log.warn("Failed to delete orphaned content entry", { contentId: itemData.contentId });
						}
					}
				}
			}
		}

		// Age limits cleanup
		const ageLimit = source.ageLimit > 0 ? source.ageLimit : settings.maxItemAge;
		if (ageLimit > 0) {
			const ageUnit = source.ageLimit > 0 ? source.ageLimitUnit : settings.maxItemAgeUnit;
			const limitMs = ageLimit * 60 * 60 * 1000 * (ageUnit === "days" ? 24 : 1);
			const threshold = new Date(Date.now() - limitMs).toISOString();

			const sourceItems = await feedItems.query({
				where: { sourceId },
				limit: 1000,
			});

			for (const item of sourceItems.items) {
				if (item.data.publishedAt < threshold) {
					await feedItems.delete(item.id);
					const itemData = item.data as any;
					if (itemData.contentId && ctx.content) {
						try {
							await ctx.content.delete?.(collectionName, itemData.contentId);
						} catch (delErr) {
							// Ignore
						}
					}
				}
			}
		}

		// 8. Update Source stats & fetch timestamps
		const totalCount = await feedItems.count({ sourceId });
		const nextFetchAt = new Date(Date.now() + (source.fetchInterval || settings.globalFetchInterval) * 60 * 1000).toISOString();

		const updatedSource: Source = {
			...source,
			status: "active",
			itemCount: totalCount,
			lastFetchedAt: now,
			nextFetchAt,
			lastError: undefined,
			updatedAt: now,
		};
		await sources.put(sourceId, updatedSource);

		// 9. Write Import Log
		const logId = generateId("log");
		const duration = Date.now() - start;
		const log: ImportLog = {
			sourceId,
			sourceName: source.name,
			status: "success",
			itemsFound,
			itemsImported,
			itemsSkipped,
			itemsRejected,
			itemsUpdated,
			duration,
			feedTitle,
			feedUrl: source.url,
			createdAt: now,
		};
		await importLogs.put(logId, log);

		ctx.log.info("Finished feed import", { sourceId, name: source.name, imported: itemsImported, duration });
		return log;
	} catch (err: any) {
		const duration = Date.now() - start;
		const errMsg = err instanceof Error ? err.message : String(err);

		// Update Source with error status
		const nextFetchAt = new Date(Date.now() + (source.fetchInterval || settings.globalFetchInterval) * 60 * 1000).toISOString();
		const updatedSource: Source = {
			...source,
			status: "error",
			lastFetchedAt: now,
			nextFetchAt,
			lastError: errMsg,
			updatedAt: now,
		};
		await sources.put(sourceId, updatedSource);

		// Write Error Log
		const logId = generateId("log");
		const log: ImportLog = {
			sourceId,
			sourceName: source.name,
			status: "error",
			itemsFound: 0,
			itemsImported: 0,
			itemsSkipped: 0,
			itemsRejected: 0,
			itemsUpdated: 0,
			error: errMsg,
			duration,
			feedUrl: source.url,
			createdAt: now,
		};
		await importLogs.put(logId, log);

		ctx.log.error("Feed import failed", { sourceId, name: source.name, error: errMsg });
		return log;
	}
}

/**
 * Iterates through all active feed sources that are due for fetching.
 */
export async function fetchAllPendingSources(ctx: PluginContext, settings: PluginSettings): Promise<ImportLog[]> {
	const now = new Date().toISOString();
	const sourcesCol = ctx.storage.sources as StorageCollection<Source>;

	const queryResult = await sourcesCol.query({
		where: { status: "active" },
		limit: 1000,
	});

	const pending = queryResult.items.filter((item) => {
		const src = item.data;
		return !src.nextFetchAt || src.nextFetchAt <= now;
	});

	const logs: ImportLog[] = [];
	for (const item of pending) {
		const log = await fetchAndImportFeed(item.data, ctx, settings, item.id);
		logs.push(log);
	}

	return logs;
}
