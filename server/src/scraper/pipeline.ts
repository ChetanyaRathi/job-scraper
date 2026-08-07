import { COMPANIES } from "../companies.js";
import { config } from "../config.js";
import { insertNewJobs } from "../db/jobs.js";
import type { Company, JobRow, ScrapedJob } from "../types.js";
import { filterFreshJobs } from "./freshness.js";
import { filterUsaJobs } from "./location.js";
import {
  beginScrapeProgress,
  endScrapeProgress,
  tickScrapeProgress,
} from "./progress.js";
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
  const insertedAll: JobRow[] = [];
  const errors: ScrapeRunResult["errors"] = [];
  let completed = 0;
  let pendingFlush: ScrapedJob[] = [];

  const flush = async () => {
    if (pendingFlush.length === 0) return;
    const batch = pendingFlush;
    pendingFlush = [];
    const usaJobs = config.usaOnly ? filterUsaJobs(batch) : batch;
    const fresh = filterFreshJobs(usaJobs);
    const inserted = await insertNewJobs(fresh);
    insertedAll.push(...inserted);
    return inserted;
  };

  console.log(
    `[scraper] Starting cycle — ${targets.length} companies, concurrency=${config.scrapeConcurrency}`
  );
  beginScrapeProgress(targets.length);

  try {
    await withApi(async (api) => {
      await mapPool(targets, config.scrapeConcurrency, async (company) => {
        try {
          const jobs = await scrapeCompany(api, company);
          allJobs.push(...jobs);
          pendingFlush.push(...jobs);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ companyId: company.id, message });
        } finally {
          completed += 1;
          if (completed % 50 === 0 || completed === targets.length) {
            tickScrapeProgress({
              completed,
              jobsFound: allJobs.length,
              errors: errors.length,
            });
          }
          if (completed % 250 === 0 || completed === targets.length) {
            console.log(
              `[scraper] Progress ${completed}/${targets.length} · jobs=${allJobs.length} · errors=${errors.length}`
            );
          }
        }
      });
    });

    await flush();

    console.log(
      `[scraper] Done — companies=${targets.length} scraped=${allJobs.length} new=${insertedAll.length} errors=${errors.length}`
    );

    return {
      scraped: allJobs.length,
      usa: insertedAll.length,
      fresh: insertedAll.length,
      inserted: insertedAll,
      companiesAttempted: targets.length,
      errors,
    };
  } finally {
    endScrapeProgress();
  }
}
