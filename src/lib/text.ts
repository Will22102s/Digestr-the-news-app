const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
  middot: "·",
  bull: "•",
  deg: "°",
  euro: "€",
  pound: "£",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : _match;
    })
    .replace(/&#(\d+);/g, (_match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : _match;
    })
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name: string) => {
      return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    });
}

/** Strip HTML and feed boilerplate from a content snippet. */
export function cleanText(input: string | undefined | null): string {
  if (!input) return "";

  return decodeEntities(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/Article URL:\s*\S+/gi, " ")
    .replace(/Comments URL:\s*\S+/gi, " ")
    .replace(/Points:\s*\d+/gi, " ")
    .replace(/#\s*Comments:\s*\d+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateAtWord(
  input: string,
  maxLength: number,
): string {
  const text = input.trim();
  if (text.length <= maxLength) return text;

  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  const body = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${body.trimEnd()}…`;
}

export function buildSnippet(
  item: {
    contentSnippet?: string;
    summary?: string;
    content?: string;
  },
  maxLength = 300,
): string {
  const raw =
    cleanText(item.contentSnippet) ||
    cleanText(item.summary) ||
    cleanText(item.content);

  return truncateAtWord(raw, maxLength);
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Average adult reading speed for editorial prose. */
export function estimateReadTimeMinutes(
  markdown: string,
  wordsPerMinute = 225,
): number {
  const words = markdownToPlainText(markdown)
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.round(words / wordsPerMinute));
}

export function countWords(markdown: string): number {
  return markdownToPlainText(markdown).split(/\s+/).filter(Boolean).length;
}

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatPublishedDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}
