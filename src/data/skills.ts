export interface Skill {
	name: string;
	level: number; // 0-100 proficiency percentage
}

export interface SkillCategory {
	skills: Skill[];
}

export const skillsData: Record<string, SkillCategory> = {
	languages: {
		skills: [
			{ name: "TypeScript", level: 92 },
			{ name: "JavaScript", level: 95 },
			{ name: "Python", level: 75 },
			{ name: "Java", level: 65 },
		],
	},
	backend: {
		skills: [
			{ name: "Node.js", level: 93 },
			{ name: "Hono", level: 88 },
			{ name: "REST APIs", level: 90 },
			{ name: "Webhooks", level: 85 },
		],
	},
	infra: {
		skills: [
			{ name: "Cloudflare Workers", level: 90 },
			{ name: "KV Storage", level: 85 },
			{ name: "Cron Jobs", level: 80 },
			{ name: "Serverless", level: 90 },
		],
	},
	ai: {
		skills: [
			{ name: "MCP Protocol", level: 95 },
			{ name: "LLM Integration", level: 88 },
			{ name: "Tool Use / Agents", level: 85 },
			{ name: "API Design", level: 90 },
		],
	},
	data: {
		skills: [
			{ name: "Databases", level: 78 },
			{ name: "Arabic NLP", level: 82 },
			{ name: "Mandumah", level: 95 },
			{ name: "ASJP / SHAMAA", level: 90 },
		],
	},
	tools: {
		skills: [
			{ name: "Git", level: 90 },
			{ name: "Telegram Bot API", level: 92 },
			{ name: "Wrangler", level: 88 },
			{ name: "Vite", level: 78 },
		],
	},
};
