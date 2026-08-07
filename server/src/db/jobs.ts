import { config } from "../config.js";
import { pool } from "./pool.js";
import { isEntryOrSde1 } from "../scraper/classify.js";
import { isUsaLocation } from "../scraper/location.js";
import type { JobFilters, JobRow, ScrapedJob } from "../types.js";

export async function insertNewJobs(jobs: ScrapedJob[]): Promise<JobRow[]> {
  const inserted: JobRow[] = [];

  for (const job of jobs) {
    const result = await pool.query<JobRow>(
      `
      INSERT INTO jobs (
        external_id, company_id, company_name, title, location, url,
        posted_at, description, experience_level, category, employment_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (company_id, external_id) DO NOTHING
      RETURNING *
      `,
      [
        job.externalId,
        job.companyId,
        job.companyName,
        job.title,
        job.location,
        job.url,
        job.postedAt,
        job.description,
        job.experienceLevel,
        job.category,
        job.employmentType,
      ]
    );

    if (result.rows[0]) {
      inserted.push(result.rows[0]);
    }
  }

  return inserted;
}

export async function getRecentJobs(
  filters: JobFilters,
  freshnessHours: number,
  limit = 200
): Promise<JobRow[]> {
  const params: unknown[] = [String(freshnessHours)];
  let idx = 2;

  // Prefer posted_at when present; otherwise use first_seen_at (public boards often omit dates).
  const where: string[] = [
    `(
      (posted_at IS NOT NULL AND posted_at >= NOW() - ($1::text || ' hours')::interval)
      OR (posted_at IS NULL AND first_seen_at >= NOW() - ($1::text || ' hours')::interval)
    )`,
  ];

  if (filters.experienceLevels.length > 0 && !filters.experienceLevels.includes("any")) {
    where.push(`experience_level = ANY($${idx++}::text[])`);
    params.push(filters.experienceLevels);
  }

  if (filters.categories.length > 0 && !filters.categories.includes("any")) {
    where.push(`category = ANY($${idx++}::text[])`);
    params.push(filters.categories);
  }

  if (filters.companyIds.length > 0) {
    where.push(`company_id = ANY($${idx++}::text[])`);
    params.push(filters.companyIds);
  }

  const fetchLimit = config.usaOnly ? Math.min(limit * 5, 1000) : limit;
  params.push(fetchLimit);

  const result = await pool.query<JobRow>(
    `
    SELECT *
    FROM jobs
    WHERE ${where.join(" AND ")}
    ORDER BY COALESCE(posted_at, first_seen_at) DESC
    LIMIT $${idx}
    `,
    params
  );

  const rows = result.rows.filter((job) => {
    if (config.usaOnly && !isUsaLocation(job.location)) return false;
    return isEntryOrSde1(job.title, job.experience_level);
  });
  return rows.slice(0, limit);
}

export function jobMatchesFilters(job: JobRow | ScrapedJob, filters: JobFilters): boolean {
  const companyId = "company_id" in job ? job.company_id : job.companyId;
  const experience =
    "experience_level" in job ? job.experience_level : job.experienceLevel;
  const category = job.category;
  const location = job.location;
  const title = job.title;

  if (config.usaOnly && !isUsaLocation(location)) {
    return false;
  }

  if (!isEntryOrSde1(title, experience)) {
    return false;
  }

  if (filters.companyIds.length > 0 && !filters.companyIds.includes(companyId)) {
    return false;
  }

  if (
    filters.experienceLevels.length > 0 &&
    !filters.experienceLevels.includes("any") &&
    !filters.experienceLevels.includes(experience)
  ) {
    return false;
  }

  if (
    filters.categories.length > 0 &&
    !filters.categories.includes("any") &&
    !filters.categories.includes(category)
  ) {
    return false;
  }

  return true;
}
