import "dotenv/config";

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export const config = {
  databaseUrl: env("DATABASE_URL", "postgresql://jobscraper:jobscraper@localhost:5432/jobscraper"),
  port: Number(env("PORT", "3001")),
  scrapeIntervalMinutes: Number(env("SCRAPE_INTERVAL_MINUTES", "10")),
  // Entry/new-grad roles stay open for weeks; 24h is too aggressive.
  freshnessHours: Number(env("FRESHNESS_HOURS", "720")),
  scrapeOnStart: env("SCRAPE_ON_START", "true") === "true",
  /** Parallel company fetches per scrape cycle */
  scrapeConcurrency: Number(env("SCRAPE_CONCURRENCY", "40")),
  /** Optional cap for a cycle (0 = all configured companies) */
  scrapeLimit: Number(env("SCRAPE_LIMIT", "0")),
  /** Only keep USA / US-remote roles */
  usaOnly: env("USA_ONLY", "true") === "true",
};
