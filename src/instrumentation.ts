/**
 * Runs once when the Next.js server (including the desktop sidecar) starts.
 * Applying migrations and seeding here means a packaged desktop app is usable
 * on first launch without a terminal.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { bootstrapDatabase } = await import("./db/bootstrap");
  const report = await bootstrapDatabase();

  const demo =
    report.demoArticles > 0
      ? ` · demo library ${report.demoArticles} stories / ${report.demoBriefings} briefings`
      : "";

  if (report.skippedSeed) {
    console.log(
      `[digest] database ready · ${report.totalFeeds} sources${demo} · ${report.databasePath}`,
    );
  } else {
    console.log(
      `[digest] database initialized · ${report.seededFeeds} starter sources${demo} · ${report.databasePath}`,
    );
  }
}
