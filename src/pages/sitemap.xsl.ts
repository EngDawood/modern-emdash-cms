import type { APIRoute } from "astro";

// Human-readable stylesheet for /sitemap.xml. Browsers apply this XSLT and show
// the styled table below; crawlers ignore it and read the raw <urlset> XML, so
// the hreflang alternates and SEO payload are untouched. Served from an SSR
// route (not public/) so it returns 200 with text/xsl instead of being caught
// by the locale redirect middleware.
const stylesheet = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title>XML Sitemap — engdawood.com</title>
        <style>
          :root {
            --oxblood: #6b1438;
            --bone: #f8f5ef;
            --ink: #1a1715;
            --muted: #8a7f76;
            --line: #e4ddd2;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: var(--bone);
            color: var(--ink);
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
            line-height: 1.5;
          }
          .wrap { max-width: 1080px; margin: 0 auto; padding: 56px 24px 96px; }
          header { border-bottom: 2px solid var(--oxblood); padding-bottom: 20px; margin-bottom: 8px; }
          .kicker {
            font-family: ui-monospace, "JetBrains Mono", "SFMono-Regular", monospace;
            font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
            color: var(--oxblood); margin: 0 0 10px;
          }
          h1 { font-family: "Playfair Display", Georgia, serif; font-size: 34px; font-weight: 700; margin: 0; }
          .meta {
            font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 13px;
            color: var(--muted); margin-top: 12px;
          }
          .meta strong { color: var(--ink); font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 28px; font-size: 14px; }
          thead th {
            text-align: left; font-family: ui-monospace, "JetBrains Mono", monospace;
            font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
            color: var(--muted); font-weight: 600; padding: 10px 14px; border-bottom: 1px solid var(--line);
          }
          tbody td { padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
          tbody tr:hover { background: rgba(107, 20, 56, 0.04); }
          .num { color: var(--muted); font-family: ui-monospace, monospace; font-size: 12px; width: 48px; }
          a { color: var(--oxblood); text-decoration: none; word-break: break-all; }
          a:hover { text-decoration: underline; }
          .lang { white-space: nowrap; }
          .badge {
            display: inline-block; font-family: ui-monospace, monospace; font-size: 11px;
            text-transform: uppercase; letter-spacing: 0.05em; color: var(--oxblood);
            border: 1px solid var(--line); border-radius: 4px; padding: 1px 6px; margin-right: 4px;
          }
          .date { color: var(--muted); font-family: ui-monospace, monospace; font-size: 12px; white-space: nowrap; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <header>
            <p class="kicker">XML Sitemap</p>
            <h1>engdawood.com</h1>
          </header>
          <p class="meta">
            <strong><xsl:value-of select="count(s:urlset/s:url)"/></strong> URLs ·
            generated for search engines · this styled view is for humans only.
          </p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>URL</th>
                <th>Languages</th>
                <th>Last modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="s:urlset/s:url">
                <tr>
                  <td class="num"><xsl:value-of select="position()"/></td>
                  <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                  <td class="lang">
                    <xsl:for-each select="xhtml:link">
                      <span class="badge"><xsl:value-of select="@hreflang"/></span>
                    </xsl:for-each>
                  </td>
                  <td class="date"><xsl:value-of select="s:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>`;

export const GET: APIRoute = () =>
	new Response(stylesheet, {
		headers: {
			"Content-Type": "text/xsl; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
