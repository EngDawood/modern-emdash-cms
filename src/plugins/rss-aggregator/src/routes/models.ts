import type { RouteContext } from "emdash";
import { PluginRouteError } from "emdash";
import type { Model, CreateModelInput, UpdateModelInput } from "../types.js";
import { models, generateId } from "../utils.js";
import { testModelConnection, setModelSecret, getModelSecret, deleteModelSecret } from "../ai-service.js";

export const modelRoutes = {
	models: {
		handler: async (ctx: RouteContext) => {
			const result = await models(ctx).query({
				orderBy: { createdAt: "desc" } as any,
				limit: 200,
			});
			return {
				items: result.items.map((i) => ({ id: i.id, ...i.data })),
			};
		},
	},

	"models/create": {
		handler: async (ctx: RouteContext) => {
			const input = ctx.input as CreateModelInput & { apiKey?: string };

			if (!input.name?.trim()) {
				throw PluginRouteError.badRequest("Model name is required");
			}
			if (!input.endpoint?.trim()) {
				throw PluginRouteError.badRequest("Model endpoint is required");
			}
			if (!input.modelId?.trim()) {
				throw PluginRouteError.badRequest("Model modelId is required");
			}
			if (!input.apiKey?.trim()) {
				throw PluginRouteError.badRequest("API key is required");
			}

			const test = await testModelConnection(ctx, {
				endpoint: input.endpoint,
				modelId: input.modelId,
				apiKey: input.apiKey,
				headers: input.headers,
			});

			if (!test.ok) {
				throw PluginRouteError.badRequest("Model test failed: " + (test.error || ("HTTP " + test.status)));
			}

			const now = new Date().toISOString();
			const id = generateId("mdl");

			const record: Model = {
				name: input.name,
				endpoint: input.endpoint,
				modelId: input.modelId,
				provider: input.provider,
				headers: input.headers,
				hasKey: true,
				verifiedAt: now,
				lastTestStatus: "ok",
				createdAt: now,
				updatedAt: now,
			};

			await models(ctx).put(id, record);
			await setModelSecret(ctx, id, input.apiKey);

			return { success: true, id, model: record };
		},
	},

	"models/update": {
		handler: async (ctx: RouteContext) => {
			const { id, ...updates } = ctx.input as UpdateModelInput & { id: string; apiKey?: string };

			const existing = await models(ctx).get(id);
			if (!existing) {
				throw PluginRouteError.notFound(`Model "${id}" not found`);
			}

			// Determine whether a connection field changed (requires re-test).
			const endpointChanged = updates.endpoint !== undefined && updates.endpoint !== existing.endpoint;
			const modelIdChanged = updates.modelId !== undefined && updates.modelId !== existing.modelId;
			const headersChanged = updates.headers !== undefined && JSON.stringify(updates.headers) !== JSON.stringify(existing.headers);
			const apiKeyChanged = updates.apiKey !== undefined && updates.apiKey.trim() !== "";
			const connectionChanged = endpointChanged || modelIdChanged || headersChanged || apiKeyChanged;

			let verifiedAt = existing.verifiedAt;
			let lastTestStatus = existing.lastTestStatus;

			if (connectionChanged) {
				const effectiveApiKey = updates.apiKey?.trim() || await getModelSecret(ctx, id);
				if (!effectiveApiKey) {
					throw PluginRouteError.badRequest("No API key set");
				}

				const effectiveEndpoint = updates.endpoint ?? existing.endpoint;
				const effectiveModelId = updates.modelId ?? existing.modelId;
				const effectiveHeaders = updates.headers ?? existing.headers;

				const test = await testModelConnection(ctx, {
					endpoint: effectiveEndpoint,
					modelId: effectiveModelId,
					apiKey: effectiveApiKey,
					headers: effectiveHeaders,
				});

				if (!test.ok) {
					throw PluginRouteError.badRequest("Model test failed: " + (test.error || ("HTTP " + test.status)));
				}

				verifiedAt = new Date().toISOString();
				lastTestStatus = "ok";

				if (apiKeyChanged) {
					await setModelSecret(ctx, id, updates.apiKey!.trim());
				}
			}

			// Extract apiKey from updates before spreading into the record.
			const { apiKey: _apiKey, ...safeUpdates } = updates as typeof updates & { apiKey?: string };

			const updated: Model = {
				...existing,
				...safeUpdates,
				...(apiKeyChanged ? { hasKey: true } : {}),
				verifiedAt,
				lastTestStatus,
				updatedAt: new Date().toISOString(),
			};

			await models(ctx).put(id, updated);
			return { success: true, model: updated };
		},
	},

	"models/delete": {
		handler: async (ctx: RouteContext) => {
			const { id } = ctx.input as { id: string };
			await models(ctx).delete(id);
			await deleteModelSecret(ctx, id);
			return { success: true };
		},
	},

	"models/test": {
		handler: async (ctx: RouteContext) => {
			const input = ctx.input as {
				id?: string;
				endpoint?: string;
				modelId?: string;
				apiKey?: string;
				headers?: Record<string, string>;
			};

			// Resolve the API key: from input, or from KV if an id is given.
			let apiKey = input.apiKey?.trim() || null;
			if (!apiKey && input.id) {
				apiKey = await getModelSecret(ctx, input.id);
			}

			// Resolve endpoint and modelId: from input, else from the stored record.
			let endpoint = input.endpoint?.trim() || null;
			let modelId = input.modelId?.trim() || null;

			if (input.id && (!endpoint || !modelId)) {
				const record = await models(ctx).get(input.id);
				if (record) {
					if (!endpoint) endpoint = record.endpoint;
					if (!modelId) modelId = record.modelId;
				}
			}

			if (!endpoint || !modelId || !apiKey) {
				return { ok: false, error: "Missing endpoint, modelId, or key" };
			}

			return await testModelConnection(ctx, {
				endpoint,
				modelId,
				apiKey,
				headers: input.headers,
			});
		},
	},
};
