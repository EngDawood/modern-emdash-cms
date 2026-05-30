# Utilities API Reference

This document details the utility functions and helpers available in the `src/utils/` and `src/i18n/` directories.

## `src/utils/reading-time.ts`

Contains logic to estimate the reading time for Portable Text blocks (the standard content format used by EmDash).

**Constants**
- `WORDS_PER_MINUTE`: 200

**`extractText(blocks: PortableTextBlock[] | undefined): string`**
Extracts plain text strings from a Portable Text array, stripping all formatting and nested block types.
- Returns an empty string if no blocks are provided.

**`getReadingTime(content: PortableTextBlock[] | undefined): number`**
Calculates the estimated reading time based on the word count.
- Minimum return value is `1` minute.
- Returns a mathematical ceiling of the division by `WORDS_PER_MINUTE`.

---

## `src/i18n/utils.ts`

Core utility functions for handling internationalization and path localization.

**Types & Constants**
- `locales`: `["ar", "en"]`
- `Locale`: Type alias for the supported locales.
- `defaultLocale`: `"ar"`

**`t(key: string, locale: Locale = defaultLocale): string`**
Retrieves a translated string from `en.json` or `ar.json` based on a dot-notation key (e.g., `"hero.firstName"`).
- Features a fallback mechanism: if a key is not found in the target locale, it falls back to the `defaultLocale`.
- Returns the original key if translation is missing entirely.

**`getOtherLocale(locale: Locale): Locale`**
Returns `"en"` if the current locale is `"ar"`, and vice-versa.

**`getDir(locale: Locale): "rtl" | "ltr"`**
Returns `"rtl"` for `"ar"` and `"ltr"` for all other locales.

**`getLocaleFromPath(path: string): Locale`**
Parses a URL path to determine the active locale based on the first URL segment. Falls back to `defaultLocale` if the segment does not match a supported locale.

**`localizedPath(path: string, locale: Locale): string`**
Takes an existing path and forces it into the target locale. Replaces the first path segment if it's already localized, or prefixes the path otherwise.

**`stripLocale(path: string): string`**
Removes the locale prefix from a given path. Used mainly to find the canonical base path for language switching.
