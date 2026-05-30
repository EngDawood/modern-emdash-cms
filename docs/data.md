# Data & State

This document covers static data structures, mock data, and global state constants used throughout the application.

## `src/data/skills.ts`

Defines the core data structure used to render the skills or capabilities section of the portfolio.

**Interfaces**

```typescript
export interface Skill {
	name: string;
	level: number; // 0-100 proficiency percentage
}

export interface SkillCategory {
	skills: Skill[];
}
```

**`skillsData: Record<string, SkillCategory>`**

A dictionary mapping high-level category keys to their respective skills. Categories include:
- `languages`: TypeScript, JavaScript, Python, Java.
- `backend`: Node.js, Hono, REST APIs, Webhooks.
- `infra`: Cloudflare Workers, KV Storage, Cron Jobs, Serverless.
- `ai`: MCP Protocol, LLM Integration, Tool Use / Agents, API Design.
- `data`: Databases, Arabic NLP, Mandumah, ASJP / SHAMAA.
- `tools`: Git, Telegram Bot API, Wrangler, Vite.

This static data object allows easy iteration and rendering inside Astro components (e.g., iterating `Object.entries(skillsData)`).
