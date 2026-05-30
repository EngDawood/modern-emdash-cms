# Components API Reference

This document provides a detailed technical reference for the Astro UI components located in `src/components/`.

## `LanguageSwitcher.astro`

A UI component that allows users to toggle between supported locales (e.g., English to Arabic). It automatically determines the opposite locale and generates the correct URL for the current page in that locale.

**Props**
| Prop | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `locale` | `Locale` | Yes | The current active locale (e.g., `"en"` or `"ar"`). |
| `class` | `string` | No | Additional CSS classes for styling. |

**Behavior**
- Uses `getOtherLocale` to switch `locale`.
- Extracts the current path using `stripLocale` and appends the new locale.
- Renders as an `<a>` tag with appropriate ARIA labels for accessibility.

---

## `PostCard.astro`

A card component used to display blog posts or articles. It supports featured images, reading time, publication dates, and author bylines.

**Props**
| Prop | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | `string` | Yes | The title of the post. |
| `excerpt` | `string` | No | A short summary of the post content. |
| `featuredImage` | `MediaValue \| string` | No | The main image for the post. |
| `href` | `string` | Yes | The URL the card links to. |
| `date` | `Date` | No | The publication date. |
| `readingTime` | `number` | No | Estimated reading time in minutes. |
| `tags` | `Array<{ slug: string; label: string }>` | No | A list of tags associated with the post. |
| `bylines` | `ContentBylineCredit[]` | No | Author credits (supports avatars and display names). |

**Behavior**
- Displays up to 2 tags.
- Renders an author avatar and name if `bylines` are provided. Handles multiple authors gracefully with a `+X` indicator.
- Automatically formats the `date` to a readable `en-US` string ("MMM D, YYYY").
- Falls back to a placeholder `div` if `featuredImage` is not present.

---

## `ProjectCard.astro`

A card component for displaying portfolio projects or case studies.

**Props**
| Prop | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | `string` | Yes | The project title. |
| `summary` | `string` | No | A brief summary of the project. |
| `featuredImage` | `MediaValue \| string` | Yes | The main project image. |
| `href` | `string` | Yes | The link to the project details. |
| `client` | `string` | No | The client name. |
| `year` | `string` | No | The year the project was completed. |
| `categories` | `string[]` | No | List of project categories. |
| `tags` | `string[]` | No | Additional tags. |

**Behavior**
- Combines `categories` and `tags` into a single `allTags` array for display.
- Implements an overlay hover effect ("View Project") over the image.
- Employs serif typography for titles and a clean layout for metadata (`client` · `year`).

---

## `TagList.astro`

A simple, reusable component that renders a list of clickable tags.

**Props**
| Prop | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `tags` | `Array<{ slug: string; label: string }>` | Yes | Array of tag objects containing a slug (for the URL) and a display label. |
| `class` | `string` | No | Additional CSS classes for the root `<ul>` element. |

**Behavior**
- If the `tags` array is empty, it renders nothing.
- Links point to `/tag/${tag.slug}`.
- Uses a flexbox layout with wrapping and simple hover transitions.
