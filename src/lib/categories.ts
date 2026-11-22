/**
 * Shared category definitions. Slugs are stored in SQLite and used verbatim
 * by the UI (`ALL` is a virtual, client-side filter).
 */

export const CATEGORY_SLUGS = ["AI", "CYBERSEC"] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
export type CategoryFilter = "ALL" | CategorySlug;

export const CATEGORY_DEFINITIONS: ReadonlyArray<{
  slug: CategorySlug;
  name: string;
  description: string;
  color: string;
}> = [
  {
    slug: "AI",
    name: "Artificial Intelligence",
    description: "Models, research, products, and the people building them.",
    color: "#0A84FF",
  },
  {
    slug: "CYBERSEC",
    name: "Cybersecurity",
    description: "Threats, advisories, breaches, and defensive research.",
    color: "#FF453A",
  },
];

export const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  ALL: "All stories",
  AI: "AI",
  CYBERSEC: "Cybersec",
};

export const DEFAULT_BRIEFING_CATEGORY: CategoryFilter = "ALL";

export function isCategorySlug(value: string): value is CategorySlug {
  return (CATEGORY_SLUGS as readonly string[]).includes(value);
}

export function isCategoryFilter(value: string): value is CategoryFilter {
  return value === "ALL" || isCategorySlug(value);
}

/** Case-insensitive category parser; empty input means ALL. */
export function normalizeCategoryFilter(
  value: string | null | undefined,
): CategoryFilter | null {
  if (value === null || value === undefined || value.trim() === "") {
    return "ALL";
  }
  const upper = value.trim().toUpperCase();
  return isCategoryFilter(upper) ? upper : null;
}
