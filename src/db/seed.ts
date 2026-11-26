import "dotenv/config";
import { CATEGORY_DEFINITIONS } from "../lib/categories";
import { bootstrapDatabase } from "./bootstrap";
import { sqlite } from "./index";
import { SEED_FEEDS } from "./starter-feeds";

async function seed(): Promise<void> {
  const force = process.argv.includes("--force");
  const report = await bootstrapDatabase({ forceSeed: force });

  console.log(`\n  The Daily Digest — database setup\n  ${report.databasePath}\n`);

  if (report.skippedSeed) {
    console.log(
      `  ✓ Database already seeded (${report.totalFeeds} feeds). Skipping.\n` +
        `    Run \`npm run db:seed -- --force\` to add any missing starter feeds.\n`,
    );
    return;
  }

  console.log(
    `  ✓ ${report.categories} categories · ${report.seededFeeds} new sources · ${report.totalFeeds} total sources`,
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
