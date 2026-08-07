import { COMPANIES } from "../companies.js";
import { config } from "../config.js";
import { insertNewJobs } from "../db/jobs.js";
import type { Company, JobRow, ScrapedJob } from "../types.js";
import { filterFreshJobs } from "./freshness.js";
import { filterUsaJobs } from "./location.js";
import { scrapeCompany, withApi } from "./scrapeCompany.js";

export interface ScrapeRunResult {
  scraped: number;
  usa: number;
  fresh: number;
  inserted: JobRow[];
  companiesAttempted: number;
  errors: { companyId: string; message: string }[];
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

export async function runScrapePipeline(
  companyIds?: string[]
): Promise<ScrapeRunResult> {
  let targets: Company[] =
    companyIds && companyIds.length > 0
      ? COMPANIES.filter((c) => companyIds.includes(c.id))
      : [...COMPANIES];

  if (config.scrapeLimit > 0 && (!companyIds || companyIds.length === 0)) {
    targets = targets.slice(0, config.scrapeLimit);
  }

  const allJobs: ScrapedJob[] = [];
  const errors: ScrapeRunResult["errors"] = [];
  let completed = 0;

  console.log(
    `[scraper] Starting cycle — ${targets.length} companies, concurrency=${config.scrapeConcurrency}`
  );

  await withApi(async (api) => {
    await mapPool(targets, config.scrapeConcurrency, async (company) => {
      try {
        const jobs = await scrapeCompany(api, company);
        allJobs.push(...jobs);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ companyId: company.id, message });
      } finally {
        completed += 1;
        if (completed % 250 === 0 || completed === targets.length) {
          console.log(
            `[scraper] Progress ${completed}/${targets.length} · jobs=${allJobs.length} · errors=${errors.length}`
          );
        }
      }
    });
  });

  const usaJobs = config.usaOnly ? filterUsaJobs(allJobs) : allJobs;
  const fresh = filterFreshJobs(usaJobs);
  const inserted = await insertNewJobs(fresh);

  console.log(
    `[scraper] Done — companies=${targets.length} scraped=${allJobs.length} usa=${usaJobs.length} fresh=${fresh.length} new=${inserted.length} errors=${errors.length}`
  );

  return {
    scraped: allJobs.length,
    usa: usaJobs.length,
    fresh: fresh.length,
    inserted,
    companiesAttempted: targets.length,
    errors,
  };
}
