import { COMPANIES } from "../companies.js";
import { insertNewJobs } from "../db/jobs.js";
import type { JobRow, ScrapedJob } from "../types.js";
import { filterFreshJobs } from "./freshness.js";
import { scrapeCompany, withBrowser } from "./scrapeCompany.js";

export interface ScrapeRunResult {
  scraped: number;
  fresh: number;
  inserted: JobRow[];
  errors: { companyId: string; message: string }[];
}

export async function runScrapePipeline(
  companyIds?: string[]
): Promise<ScrapeRunResult> {
  const targets =
    companyIds && companyIds.length > 0
      ? COMPANIES.filter((c) => companyIds.includes(c.id))
      : COMPANIES;

  const allJobs: ScrapedJob[] = [];
  const errors: ScrapeRunResult["errors"] = [];

  await withBrowser(async (browser) => {
    for (const company of targets) {
      try {
        console.log(`[scraper] Scraping ${company.name}...`);
        const jobs = await scrapeCompany(browser, company);
        console.log(`[scraper] ${company.name}: ${jobs.length} matching roles`);
        allJobs.push(...jobs);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scraper] ${company.name} failed: ${message}`);
        errors.push({ companyId: company.id, message });
      }
    }
  });

  const fresh = filterFreshJobs(allJobs);
  const inserted = await insertNewJobs(fresh);

  console.log(
    `[scraper] Done — scraped=${allJobs.length} fresh=${fresh.length} new=${inserted.length}`
  );

  return {
    scraped: allJobs.length,
    fresh: fresh.length,
    inserted,
    errors,
  };
}
