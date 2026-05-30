# Eng. Dawood Saleh - Portfolio & EmDash CMS Project

A modern, multilingual personal portfolio website and CMS built with [Astro](https://astro.build/) and [EmDash](https://github.com/emdash-cms/emdash), deployed on Cloudflare Workers. It features an integrated Model Context Protocol (MCP) server, allowing AI agents to interact directly with the CMS content.

## Features

- **Multilingual (i18n):** Native support for Arabic (default/RTL) and English (LTR) routing and content.
- **EmDash CMS Integration:** Content is managed via EmDash and fetched dynamically using the `emdashLoader`.
- **Model Context Protocol (MCP) Server:** A built-in MCP server (`/mcp` endpoint) running on Cloudflare Workers, exposing tools for AI agents to list, create, search, and manage CMS content.
- **Cloudflare Edge Infrastructure:** Deployed using Cloudflare Workers, leveraging Durable Objects, D1, and R2 for storage and database needs.
- **Responsive & Accessible Design:** Built with modern CSS (Vanilla CSS preferred), featuring smooth scroll-reveal animations and a polished UI.
- **Capabilities/Skills Section:** Dynamic display of technical proficiencies across languages, backend, infra, AI, and more.

## Tech Stack

- **Framework:** Astro
- **CMS:** EmDash (Cloudflare Variant)
- **Runtime:** Cloudflare Workers (Node.js compatibility layer)
- **Styling:** Vanilla CSS
- **Languages:** TypeScript, HTML, Astro
- **Integration:** Model Context Protocol (MCP) SDK

## 📚 Internal Codebase Documentation

For developers working on this project, comprehensive API and architectural documentation is available in the `docs/` directory:

- [Documentation Index](./docs/README.md)
  - [Components API](./docs/components.md)
  - [Routing & Pages Architecture](./docs/routing_and_pages.md)
  - [Utilities](./docs/utilities.md)
  - [Data & State](./docs/data.md)
  - [MCP & Worker Architecture](./docs/mcp_worker.md)
  - [MCP API Reference](./docs/mcp_api_reference.md)

## Getting Started

### Prerequisites

- Node.js (v18+)
- `pnpm` package manager
- Wrangler CLI (for Cloudflare deployment)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd portfolio
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

### Development

Start the local development server:

```bash
pnpm dev
```

The site will be available at `http://localhost:4321`.

### MCP Server Access

The MCP server is exposed at the `/mcp` endpoint. It requires an authorization token defined in your environment variables (`EMDASH_TOKEN`).

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:4321/mcp
```

## Project Structure

```text
├── src/
│   ├── components/      # Reusable Astro UI components (e.g., PostCard, LanguageSwitcher)
│   ├── data/            # Static data structures (e.g., skills.ts)
│   ├── i18n/            # Translation files and localization utilities
│   ├── layouts/         # Base page layouts
│   ├── mcp/             # Model Context Protocol server implementation
│   ├── pages/           # Astro file-based routing ([locale] structure)
│   ├── utils/           # Helper functions (e.g., reading-time)
│   ├── live.config.ts   # EmDash live collection configuration
│   └── worker.ts        # Cloudflare Worker entry point
├── docs/                # Generated internal technical documentation
├── public/              # Static assets (fonts, etc.)
└── astro.config.mjs     # Astro configuration
```

## See Also

- [EmDash documentation](https://github.com/emdash-cms/emdash/tree/main/docs)
- [Astro documentation](https://docs.astro.build)
- [Model Context Protocol](https://modelcontextprotocol.io/)