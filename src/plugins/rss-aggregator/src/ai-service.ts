/**
 * @dawod/emdash-rss-aggregator
 *
 * AI Content Suite: summarization, rewriting, and translation backed by an
 * OpenAI-compatible chat-completions endpoint, plus a KV-backed monthly credit
 * ledger.
 *
 * Cloudflare Workers runtime only — no Node.js APIs. Every exported function is
 * defensive and never throws out to the caller: on any failure it resolves with
 * an `ok: false` result so the import pipeline keeps working when AI is down.
 */

import type { PluginContext } from "emdash";
import type { PluginSettings, CreditState, ItemTranslation } from "./types.js";

// ── Constants ──────────────────────────────────────────────────────────

const KV_CREDIT_LIMIT = "credits:limit";
const KV_CREDIT_USED = "credits:used";
const KV_CREDIT_PERIOD = "credits:period";

/** Maximum characters of input content forwarded to the model. */
const MAX_INPUT_CHARS = 6000;

// ── Local helpers ──────────────────────────────────────────────────────

/** Current accounting period in "YYYY-MM" form. */
function currentPeriod(): string {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

/** Strip HTML tags and collapse whitespace to keep prompts lean. */
function stripHtml(s: string): string {
	if (!s) return "";
	return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Strip-and-truncate input content to keep prompts within budget. */
function leanInput(s: string): string {
	const text = stripHtml(s);
	return text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
}

// ── Credit ledger ──────────────────────────────────────────────────────

/**
 * Reads the credit ledger from KV, rolling over to a fresh period when the
 * stored period is missing or stale. Never throws.
 */
export async function getCreditState(ctx: PluginContext, settings: PluginSettings): Promise<CreditState> {
	const period = currentPeriod();

	let storedLimit: number | null = null;
	let storedUsed: number | null = null;
	let storedPeriod: string | null = null;

	try {
		storedLimit = await ctx.kv.get<number>(KV_CREDIT_LIMIT);
		storedUsed = await ctx.kv.get<number>(KV_CREDIT_USED);
		storedPeriod = await ctx.kv.get<string>(KV_CREDIT_PERIOD);
	} catch (err) {
		ctx.log.warn("Failed to read credit ledger from KV", { error: String(err) });
	}

	const limit = typeof storedLimit === "number" ? storedLimit : settings.aiCreditMonthlyLimit;

	// Roll over when the period is missing or stale.
	if (storedPeriod !== period) {
		try {
			await ctx.kv.set(KV_CREDIT_USED, 0);
			await ctx.kv.set(KV_CREDIT_PERIOD, period);
		} catch (err) {
			ctx.log.warn("Failed to roll over credit period", { error: String(err) });
		}
		return { limit, used: 0, period };
	}

	const used = typeof storedUsed === "number" ? storedUsed : 0;
	return { limit, used, period };
}

/**
 * Atomically (best-effort) consumes `amount` credits. Returns ok:false without
 * incrementing when the limit would be exceeded.
 */
export async function consumeCredits(
	ctx: PluginContext,
	settings: PluginSettings,
	amount: number,
): Promise<{ ok: boolean; state: CreditState }> {
	const state = await getCreditState(ctx, settings);

	if (state.limit > 0 && state.used + amount > state.limit) {
		return { ok: false, state };
	}

	const used = state.used + amount;
	try {
		await ctx.kv.set(KV_CREDIT_USED, used);
	} catch (err) {
		ctx.log.warn("Failed to persist consumed credits", { error: String(err) });
	}

	return { ok: true, state: { ...state, used } };
}

/** Persists a new monthly credit limit and returns the refreshed state. */
export async function setCreditLimit(ctx: PluginContext, limit: number): Promise<CreditState> {
	try {
		await ctx.kv.set(KV_CREDIT_LIMIT, limit);
	} catch (err) {
		ctx.log.warn("Failed to persist credit limit", { error: String(err) });
	}
	return getCreditState(ctx, { aiCreditMonthlyLimit: limit } as PluginSettings);
}

/** Resets the consumed credit counter to 0 for the current period. */
export async function resetCredits(ctx: PluginContext): Promise<CreditState> {
	const period = currentPeriod();
	let limit = 0;
	try {
		const storedLimit = await ctx.kv.get<number>(KV_CREDIT_LIMIT);
		limit = typeof storedLimit === "number" ? storedLimit : 0;
		await ctx.kv.set(KV_CREDIT_USED, 0);
		await ctx.kv.set(KV_CREDIT_PERIOD, period);
	} catch (err) {
		ctx.log.warn("Failed to reset credits", { error: String(err) });
	}
	return { limit, used: 0, period };
}

// ── AI core ────────────────────────────────────────────────────────────

/** Outcome of an individual AI operation. */
export interface AiResult<T> {
	ok: boolean;
	value?: T;
	error?: string;
	creditsUsed: number;
}

/**
 * Issues a single chat-completion request. Returns a discriminated result and
 * never throws — all failure modes are mapped to { ok:false, error }.
 */
async function callChat(
	ctx: PluginContext,
	settings: PluginSettings,
	system: string,
	user: string,
): Promise<{ ok: boolean; text?: string; error?: string }> {
	if (!settings.aiEnabled) return { ok: false, error: "AI disabled" };
	if (!settings.aiApiKey) return { ok: false, error: "Missing AI API key" };
	if (!ctx.http) return { ok: false, error: "No network capability" };

	try {
		const response = await ctx.http.fetch(settings.aiApiEndpoint, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${settings.aiApiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: settings.aiModel,
				messages: [
					{ role: "system", content: system },
					{ role: "user", content: user },
				],
				temperature: 0.4,
			}),
			signal: AbortSignal.timeout(settings.fetchTimeout || 30000),
		});

		if (!response.ok) {
			return { ok: false, error: `AI HTTP ${response.status}` };
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const text = data.choices?.[0]?.message?.content?.trim();
		if (!text) {
			return { ok: false, error: "Empty AI response" };
		}

		return { ok: true, text };
	} catch (err) {
		return { ok: false, error: String(err) };
	}
}

/**
 * Pre-flight credit gate: returns an error string when the limit is already
 * exhausted, otherwise null. Reads but does not consume.
 */
async function creditGate(ctx: PluginContext, settings: PluginSettings): Promise<string | null> {
	const state = await getCreditState(ctx, settings);
	if (state.limit > 0 && state.used >= state.limit) {
		return "AI credit limit reached";
	}
	return null;
}

// ── AI operations ──────────────────────────────────────────────────────

/** Generates a concise plain-text TL;DR summary of an item. */
export async function summarize(
	ctx: PluginContext,
	settings: PluginSettings,
	opts: { title: string; content: string },
): Promise<AiResult<string>> {
	const blocked = await creditGate(ctx, settings);
	if (blocked) return { ok: false, error: blocked, creditsUsed: 0 };

	const words = settings.aiSummaryWords > 0 ? settings.aiSummaryWords : 50;
	const system =
		`You are an editorial assistant. Produce a concise TL;DR summary of about ${words} words. ` +
		`Return plain text only, with no preamble, labels, markdown, or quotation marks.`;
	const user = `Title: ${opts.title}\n\nContent:\n${leanInput(opts.content)}`;

	const result = await callChat(ctx, settings, system, user);
	if (!result.ok || !result.text) {
		return { ok: false, error: result.error || "Empty AI response", creditsUsed: 0 };
	}

	await consumeCredits(ctx, settings, 1);
	return { ok: true, value: result.text, creditsUsed: 1 };
}

/** Rewrites an item as original content in the supplied voice. */
export async function rewriteInVoice(
	ctx: PluginContext,
	settings: PluginSettings,
	opts: { title: string; content: string; voice: string },
): Promise<AiResult<string>> {
	const blocked = await creditGate(ctx, settings);
	if (blocked) return { ok: false, error: blocked, creditsUsed: 0 };

	const voice = (opts.voice || settings.aiOwnerVoice || "a clear, neutral editorial voice").trim();
	const system =
		`You are a skilled writer. Rewrite the supplied article as ORIGINAL content in the following voice: ${voice}. ` +
		`Preserve all facts faithfully. Do not copy phrasing from the source. ` +
		`Return clean HTML paragraphs (<p>…</p>) only, with no preamble, headings, or commentary.`;
	const user = `Title: ${opts.title}\n\nArticle:\n${leanInput(opts.content)}`;

	const result = await callChat(ctx, settings, system, user);
	if (!result.ok || !result.text) {
		return { ok: false, error: result.error || "Empty AI response", creditsUsed: 0 };
	}

	await consumeCredits(ctx, settings, 1);
	return { ok: true, value: result.text, creditsUsed: 1 };
}

/** Translates the provided fields into the BCP-47 target locale. */
export async function translate(
	ctx: PluginContext,
	settings: PluginSettings,
	opts: { title?: string; excerpt?: string; content?: string; summary?: string; targetLocale: string },
): Promise<AiResult<ItemTranslation>> {
	const blocked = await creditGate(ctx, settings);
	if (blocked) return { ok: false, error: blocked, creditsUsed: 0 };

	// Collect only the fields that were actually provided.
	const fields: Record<string, string> = {};
	if (typeof opts.title === "string" && opts.title) fields.title = stripHtml(opts.title);
	if (typeof opts.excerpt === "string" && opts.excerpt) fields.excerpt = stripHtml(opts.excerpt);
	if (typeof opts.content === "string" && opts.content) fields.content = leanInput(opts.content);
	if (typeof opts.summary === "string" && opts.summary) fields.summary = stripHtml(opts.summary);

	const providedKeys = Object.keys(fields);
	if (providedKeys.length === 0) {
		return { ok: false, error: "No fields to translate", creditsUsed: 0 };
	}

	const system =
		`You are a professional translator. Translate the provided fields into the language identified by ` +
		`the BCP-47 locale "${opts.targetLocale}". Return a STRICT JSON object containing ONLY these keys: ` +
		`${providedKeys.join(", ")}. Each value is the translated text. ` +
		`Do not add other keys, commentary, or markdown fences.`;
	const user = JSON.stringify(fields);

	const result = await callChat(ctx, settings, system, user);
	if (!result.ok || !result.text) {
		return { ok: false, error: result.error || "Empty AI response", creditsUsed: 0 };
	}

	// Strip optional ```json … ``` fences before parsing.
	let raw = result.text.trim();
	const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	if (fenceMatch) raw = fenceMatch[1].trim();

	const translation: ItemTranslation = { translatedAt: new Date().toISOString() };
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (typeof parsed.title === "string") translation.title = parsed.title;
		if (typeof parsed.excerpt === "string") translation.excerpt = parsed.excerpt;
		if (typeof parsed.content === "string") translation.content = parsed.content;
		if (typeof parsed.summary === "string") translation.summary = parsed.summary;
	} catch {
		// Parse failure — fall back to treating the whole response as content.
		translation.content = raw;
	}

	await consumeCredits(ctx, settings, 1);
	return { ok: true, value: translation, creditsUsed: 1 };
}
