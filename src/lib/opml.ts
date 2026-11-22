import { XMLParser } from "fast-xml-parser";
import {
  CATEGORY_DEFINITIONS,
  type CategorySlug,
} from "./categories";
import { escapeXml } from "./text";
import { feedHostname, normalizeFeedUrl } from "./url";

export type OpmlSourceType = "rss" | "community" | "advisory";

export type OpmlSource = {
  name: string;
  url: string;
  categorySlug: CategorySlug;
  sourceType: OpmlSourceType;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function attribute(record: UnknownRecord, key: string): string | undefined {
  const value = record[`@_${key}`];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

function resolveCategory(value: string | undefined): CategorySlug | null {
  if (!value) return null;
  const normalized = value.toLowerCase();

  if (
    /cyber|security|infosec|threat|malware|vulnerab|privacy/.test(normalized)
  ) {
    return "CYBERSEC";
  }
  if (
    /artificial intelligence|machine learning|deep learning|\bai\b|\bml\b|\bllms?\b/.test(
      normalized,
    )
  ) {
    return "AI";
  }

  return null;
}

function inferSourceType(url: string, label: string | undefined): OpmlSourceType {
  const haystack = `${url} ${label ?? ""}`.toLowerCase();
  if (haystack.includes("hnrss.org") || haystack.includes("news.ycombinator")) {
    return "community";
  }
  if (haystack.includes("cisa.gov") || haystack.includes("advisory")) {
    return "advisory";
  }
  return "rss";
}

/**
 * Parse nested OPML outlines. Supports category folders, category attributes,
 * and flat lists. Returns only entries with a readable http(s) feed URL.
 */
export function parseOpml(xml: string): OpmlSource[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    isArray: (name) => name === "outline",
  });

  const document = asRecord(parser.parse(xml));
  const opml = asRecord(document?.opml);
  const body = asRecord(opml?.body);

  if (!body) {
    throw new Error("This file does not contain an OPML <body>.");
  }

  const sources: OpmlSource[] = [];
  const seen = new Set<string>();

  const walk = (
    outlines: unknown[],
    inheritedCategory: CategorySlug | null,
  ): void => {
    for (const rawOutline of outlines) {
      const outline = asRecord(rawOutline);
      if (!outline) continue;

      const title =
        attribute(outline, "title") ??
        attribute(outline, "text") ??
        attribute(outline, "name");
      const xmlUrl = attribute(outline, "xmlUrl") ?? attribute(outline, "url");
      const categoryLabel = attribute(outline, "category") ?? title;
      const category =
        resolveCategory(categoryLabel) ?? inheritedCategory ?? "AI";

      if (xmlUrl) {
        let normalizedUrl: string;
        try {
          normalizedUrl = normalizeFeedUrl(xmlUrl);
        } catch {
          continue;
        }

        if (seen.has(normalizedUrl)) continue;
        seen.add(normalizedUrl);

        sources.push({
          name: title || feedHostname(normalizedUrl),
          url: normalizedUrl,
          categorySlug: category,
          sourceType: inferSourceType(normalizedUrl, title),
        });
      } else {
        walk(
          asArray(outline.outline),
          resolveCategory(title) ?? category,
        );
      }
    }
  };

  walk(asArray(body.outline), null);
  return sources;
}

function resolveExportCategory(slug: string): CategorySlug {
  return slug === "CYBERSEC" ? "CYBERSEC" : "AI";
}

/** Serialize sources into a clean, re-importable OPML 2.0 document. */
export function buildOpml(
  sources: Array<{
    name: string;
    url: string;
    categorySlug: string;
  }>,
): string {
  const grouped = new Map<CategorySlug, typeof sources>();

  for (const definition of CATEGORY_DEFINITIONS) {
    grouped.set(definition.slug, []);
  }

  for (const source of sources) {
    const slug = resolveExportCategory(source.categorySlug);
    grouped.get(slug)?.push(source);
  }

  const folders = CATEGORY_DEFINITIONS.map((definition) => {
    const feeds = (grouped.get(definition.slug) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((feed) => {
        const name = escapeXml(feed.name);
        const url = escapeXml(feed.url);
        return `      <outline type="rss" text="${name}" title="${name}" xmlUrl="${url}" category="${definition.slug}" />`;
      })
      .join("\n");

    return [
      `    <outline text="${escapeXml(definition.name)}" title="${escapeXml(definition.name)}" category="${definition.slug}">`,
      feeds,
      "    </outline>",
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    "    <title>The Daily Digest — Sources</title>",
    `    <dateCreated>${new Date().toUTCString()}</dateCreated>`,
    "  </head>",
    "  <body>",
    folders,
    "  </body>",
    "</opml>",
    "",
  ].join("\n");
}
