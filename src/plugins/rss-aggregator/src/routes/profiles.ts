import type { RouteContext } from "emdash";
import { PluginRouteError } from "emdash";
import type { OutputProfile, CreateOutputProfileInput, UpdateOutputProfileInput } from "../types.js";
import { outputProfiles, generateId } from "../utils.js";

export const profileRoutes = {
	"output-profiles": {
		handler: async (ctx: RouteContext) => {
			const result = await outputProfiles(ctx).query({
				orderBy: { createdAt: "desc" } as any,
				limit: 200,
			});
			return {
				items: result.items.map((i) => ({ id: i.id, ...i.data })),
			};
		},
	},

	"output-profiles/create": {
		handler: async (ctx: RouteContext) => {
			const input = ctx.input as CreateOutputProfileInput;

			if (!input.name?.trim()) {
				throw PluginRouteError.badRequest("Output profile name is required");
			}
			if (input.mode !== "internal" && input.mode !== "publish") {
				throw PluginRouteError.badRequest(`Invalid mode "${input.mode}"; must be "internal" or "publish"`);
			}
			if (input.mode === "publish" && !input.collection?.trim()) {
				throw PluginRouteError.badRequest("collection is required when mode is \"publish\"");
			}

			const now = new Date().toISOString();
			const id = generateId("opf");

			const profile: OutputProfile = {
				...input,
				createdAt: now,
				updatedAt: now,
			};

			await outputProfiles(ctx).put(id, profile);
			return { success: true, id, profile };
		},
	},

	"output-profiles/update": {
		handler: async (ctx: RouteContext) => {
			const { id, ...updates } = ctx.input as UpdateOutputProfileInput & { id: string };

			const existing = await outputProfiles(ctx).get(id);
			if (!existing) {
				throw PluginRouteError.notFound(`Output profile "${id}" not found`);
			}

			if (updates.mode !== undefined && updates.mode !== "internal" && updates.mode !== "publish") {
				throw PluginRouteError.badRequest(`Invalid mode "${updates.mode}"; must be "internal" or "publish"`);
			}

			const effectiveMode = updates.mode ?? existing.mode;
			if (effectiveMode === "publish") {
				const effectiveCollection = updates.collection ?? existing.collection;
				if (!effectiveCollection?.trim()) {
					throw PluginRouteError.badRequest("collection is required when mode is \"publish\"");
				}
			}

			const updated: OutputProfile = {
				...existing,
				...updates,
				updatedAt: new Date().toISOString(),
			};

			await outputProfiles(ctx).put(id, updated);
			return { success: true, profile: updated };
		},
	},

	"output-profiles/delete": {
		handler: async (ctx: RouteContext) => {
			const { id } = ctx.input as { id: string };
			await outputProfiles(ctx).delete(id);
			return { success: true };
		},
	},
};
