import "dotenv/config";
import path from "node:path";
import { count } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, databasePath, sqlite } from "./index";
import { categories, feeds, type SourceType } from "./schema";
import { CATEGORY_DEFINITIONS, type CategorySlug } from "../lib/categories";

/**
 * Curated starter sources. Every URL below was checked for a valid RSS/Atom
 * response at build time. Sources are intentionally a mix of first-party labs,
 * independent reporting, security advisories, and community feeds.
 */
type SeedFeed = {
  category: CategorySlug;
  name: string;
  url: string;
  sourceType: SourceType;
};

const SEED_FEEDS: SeedFeed[] = [
  // -------------------------------------------------------------------------
  // Artificial Intelligence
  // -------------------------------------------------------------------------
  {
    category: "AI",
    name: "OpenAI",
    url: "https://openai.com/news/rss.xml",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Google Research",
    url: "https://research.google/blog/rss/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Hugging Face",
    url: "https://huggingface.co/blog/feed.xml",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "The Verge · AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "MIT Technology Review · AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "NVIDIA Blog",
    url: "https://blogs.nvidia.com/feed/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "arXiv · cs.AI",
    url: "https://rss.arxiv.org/rss/cs.AI",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Import AI",
    url: "https://importai.substack.com/feed",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "The Gradient",
    url: "https://thegradient.pub/rss/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "The Decoder",
    url: "https://the-decoder.com/feed/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Hacker News",
    url: "https://hnrss.org/frontpage",
    sourceType: "community",
  },
  {
    category: "AI",
    name: "Hacker News · AI",
    url: "https://hnrss.org/newest?q=AI",
    sourceType: "community",
  },

  // -------------------------------------------------------------------------
  // Cybersecurity
  // -------------------------------------------------------------------------
  {
    category: "CYBERSEC",
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/feed/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "CISA Advisories",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    sourceType: "advisory",
  },
  {
    category: "CYBERSEC",
    name: "Dark Reading",
    url: "https://www.darkreading.com/rss.xml",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "SecurityWeek",
    url: "https://www.securityweek.com/feed/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "The Record",
    url: "https://therecord.media/feed",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "Schneier on Security",
    url: "https://www.schneier.com/feed/atom/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "SANS Internet Storm Center",
    url: "https://isc.sans.edu/rssfeed.xml",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "Google Project Zero",
    url: "https://googleprojectzero.blogspot.com/feeds/posts/default",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "CyberScoop",
    url: "https://cyberscoop.com/feed/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "Hacker News · Security",
    url: "https://hnrss.org/newest?q=cybersecurity",
    sourceType: "community",
  },
];

async function seed(): Promise<void> {
  console.log(`\n  The Daily Digest — database setup\n  ${databasePath}\n`);

  // Apply committed migrations so `npm run db:seed` works on a fresh clone.
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  for (const definition of CATEGORY_DEFINITIONS) {
    await db
      .insert(categories)
      .values({
        name: definition.name,
        slug: definition.slug,
        color: definition.color,
      })
      .onConflictDoNothing({ target: categories.slug });
  }

  const [feedCountRow] = await db
    .select({ value: count() })
    .from(feeds)
    .all();
  const existingFeedCount = Number(feedCountRow?.value ?? 0);
  const force = process.argv.includes("--force");

  if (existingFeedCount > 0 && !force) {
    console.log(
      `  ✓ Database already seeded (${existingFeedCount} feeds). Skipping.\n` +
        `    Run \`npm run db:seed -- --force\` to add any missing starter feeds.\n`,
    );
    return;
  }

  const categoryRows = await db.select().from(categories).all();
  const categoryIdBySlug = new Map(
    categoryRows.map((category) => [category.slug, category.id]),
  );

  const feedRows = SEED_FEEDS.map((feed) => {
    const categoryId = categoryIdBySlug.get(feed.category);

    if (!categoryId) {
      throw new Error(`Missing category "${feed.category}" while seeding feeds.`);
    }

    return {
      categoryId,
      name: feed.name,
      url: feed.url,
      sourceType: feed.sourceType,
      isActive: true,
    };
  });

  const inserted = await db
    .insert(feeds)
    .values(feedRows)
    .onConflictDoNothing({ target: feeds.url })
    .returning({ id: feeds.id })
    .all();

  const totalFeedsRow = await db.select({ value: count() }).from(feeds).all();
  const totalFeeds = Number(totalFeedsRow[0]?.value ?? 0);

  console.log(
    `  ✓ ${categoryRows.length} categories · ${inserted.length} new sources · ${totalFeeds} total sources`,
  );
  for (const definition of CATEGORY_DEFINITIONS) {
    const sourceCount = SEED_FEEDS.filter(
      (feed) => feed.category === definition.slug,
    ).length;
    console.log(
      `    ${definition.slug.padEnd(9)} ${String(sourceCount).padStart(2)} starter sources`,
    );
  }
  console.log(
    `\n  Next: copy .env.example → .env, then run \`npm run dev\`.\n`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error("\n  ✕ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    sqlite.close();
  });
