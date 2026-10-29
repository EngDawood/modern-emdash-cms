---
name: feedback-automatic-over-per-collection
description: User wants new CMS collections to work with zero code changes, not per-collection files
type: feedback
---

When a CMS feature applies to "a collection", build it generically so any collection created in the admin picks it up automatically.

**Why:** User rejected copying route files for the `mcp` collection: "the /mcp is just example, I plan to add more and want them automatically accepted". Then asked the same for sitemap, RSS, search and llms.txt.

**How to apply:** Route through `src/utils/routable-collection.ts` (`getRoutableCollection`, `listRoutableCollections`) instead of hard-coding collection slugs in new site-wide features.
