import type { ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

export function createPlugin(): ResolvedPlugin {
	return definePlugin({
		id: "tracker-link",
		version: "0.1.0",
	});
}

export default createPlugin;
