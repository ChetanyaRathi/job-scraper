import type { ScrapedJob } from "../types.js";
import { config } from "../config.js";

export function isFresh(job: ScrapedJob, now = new Date()): boolean {
  if (!job.postedAt) {
    // Public boards often omit dates — keep for first insert; DB first_seen_at handles retention.
    return true;
  }

  const ageMs = now.getTime() - job.postedAt.getTime();
  const maxAgeMs = config.freshnessHours * 60 * 60 * 1000;
  return ageMs <= maxAgeMs;
}

export function filterFreshJobs(jobs: ScrapedJob[]): ScrapedJob[] {
  return jobs.filter((job) => isFresh(job));
}
