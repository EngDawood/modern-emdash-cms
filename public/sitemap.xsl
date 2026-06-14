<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  exclude-result-prefixes="sitemap xhtml">

  <xsl:output method="html" version="5.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Sitemap — engdawood.com</title>
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 14px;
            line-height: 1.6;
            background: #f8f5ef;
            color: #1a1a1a;
            min-height: 100vh;
          }

          header {
            background: #6b1438;
            color: #f8f5ef;
            padding: 2.5rem 2rem;
            border-bottom: 3px solid #4a0d26;
          }

          header h1 {
            font-size: 1.5rem;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin-bottom: 0.25rem;
          }

          header p {
            font-size: 0.85rem;
            opacity: 0.75;
            font-family: "JetBrains Mono", "Fira Mono", monospace;
          }

          main {
            max-width: 1100px;
            margin: 2rem auto;
            padding: 0 1.5rem;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 4px rgba(0,0,0,0.08);
          }

          thead {
            background: #f0ebe3;
          }

          th {
            padding: 0.75rem 1rem;
            text-align: left;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #666;
            border-bottom: 1px solid #e0d8ce;
          }

          tbody tr {
            border-bottom: 1px solid #f0ebe3;
            transition: background 0.1s;
          }

          tbody tr:last-child { border-bottom: none; }

          tbody tr:hover { background: #faf8f5; }

          td {
            padding: 0.65rem 1rem;
            vertical-align: middle;
          }

          td.url {
            max-width: 700px;
            word-break: break-all;
          }

          td.url a {
            color: #6b1438;
            text-decoration: none;
            font-size: 0.85rem;
          }

          td.url a:hover { text-decoration: underline; }

          td.lastmod {
            white-space: nowrap;
            color: #888;
            font-size: 0.8rem;
            font-family: "JetBrains Mono", "Fira Mono", monospace;
          }

          td.langs {
            white-space: nowrap;
            font-size: 0.75rem;
            color: #999;
            font-family: "JetBrains Mono", "Fira Mono", monospace;
          }

          .badge {
            display: inline-block;
            padding: 0.1rem 0.45rem;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 600;
            background: #f0ebe3;
            color: #6b1438;
            margin-right: 2px;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>XML Sitemap</h1>
          <p>
            <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/>
            <xsl:text> URLs indexed</xsl:text>
          </p>
        </header>
        <main>
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Alternates</th>
                <th>Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td class="url">
                    <a href="{sitemap:loc}">
                      <xsl:value-of select="sitemap:loc"/>
                    </a>
                  </td>
                  <td class="langs">
                    <xsl:for-each select="xhtml:link">
                      <span class="badge">
                        <xsl:value-of select="@hreflang"/>
                      </span>
                    </xsl:for-each>
                  </td>
                  <td class="lastmod">
                    <xsl:value-of select="sitemap:lastmod"/>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </main>
      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>
