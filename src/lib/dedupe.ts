const STOP_WORDS = new Set(
  [
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "but",
    "by",
    "for",
    "from",
    "has",
    "have",
    "how",
    "in",
    "into",
    "is",
    "it",
    "its",
    "new",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "will",
    "with",
    "your",
  ].map((word) => word),
);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

export function titleSimilarity(left: string, right: string): number {
  const a = titleTokens(left);
  const b = titleTokens(right);

  if (a.size === 0 || b.size === 0) {
    return normalizeTitle(left) === normalizeTitle(right) ? 1 : 0;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Remove syndicated/rewritten versions of the same story. Items are expected
 * to be ordered newest-first; the first occurrence wins.
 */
export function dedupeByTitle<T extends { title: string }>(
  items: readonly T[],
  threshold = 0.62,
): T[] {
  const kept: T[] = [];

  for (const item of items) {
    const duplicate = kept.some(
      (existing) => titleSimilarity(existing.title, item.title) >= threshold,
    );
    if (!duplicate) kept.push(item);
  }

  return kept;
}
