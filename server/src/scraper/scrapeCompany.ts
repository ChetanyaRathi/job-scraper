import { request, type APIRequestContext } from "playwright";
import type { Company, ScrapedJob } from "../types.js";
import {
  classifyCategory,
  classifyEmploymentType,
  classifyExperience,
  isEntryOrSde1,
  isTargetRole,
} from "./classify.js";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
}

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  categories?: { location?: string; commitment?: string; team?: string };
  descriptionPlain?: string;
  description?: string;
}

interface AshbyJob {
  id: string;
  title: string;
  jobUrl?: string;
  applyUrl?: string;
  location?: string;
  publishedAt?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  return decodeEntities(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toScraped(
  company: Company,
  input: {
    externalId: string;
    title: string;
    location: string;
    url: string;
    postedAt: Date | null;
    description: string;
  }
): ScrapedJob | null {
  const category = classifyCategory(input.title, input.description);
  if (!isTargetRole(category)) return null;

  const experienceLevel = classifyExperience(input.title, input.description);
  if (!isEntryOrSde1(input.title, experienceLevel)) return null;

  return {
    externalId: input.externalId,
    companyId: company.id,
    companyName: company.name,
    title: input.title,
    location: input.location,
    url: input.url,
    postedAt: input.postedAt,
    description: input.description.slice(0, 2000),
    experienceLevel,
    category,
    employmentType: classifyEmploymentType(input.title),
  };
}

async function scrapeGreenhouse(
  api: APIRequestContext,
  company: Company
): Promise<ScrapedJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company.boardToken}/jobs`;
  const response = await api.get(url, { timeout: 30_000 });
  if (!response.ok()) {
    throw new Error(`HTTP ${response.status()}`);
  }

  const body = (await response.json()) as { jobs?: GreenhouseJob[] };
  return (body.jobs ?? [])
    .map((job) =>
      toScraped(company, {
        externalId: String(job.id),
        title: job.title,
        location: job.location?.name ?? "",
        url: job.absolute_url,
        postedAt: job.updated_at ? new Date(job.updated_at) : null,
        description: stripHtml(job.content ?? ""),
      })
    )
    .filter((job): job is ScrapedJob => job !== null);
}

async function scrapeLever(api: APIRequestContext, company: Company): Promise<ScrapedJob[]> {
  const url = `https://api.lever.co/v0/postings/${company.boardToken}?mode=json`;
  const response = await api.get(url, { timeout: 30_000 });
  if (!response.ok()) {
    throw new Error(`HTTP ${response.status()}`);
  }

  const jobs = (await response.json()) as LeverJob[];
  return jobs
    .map((job) =>
      toScraped(company, {
        externalId: job.id,
        title: job.text,
        location: job.categories?.location ?? "",
        url: job.hostedUrl,
        postedAt: job.createdAt ? new Date(job.createdAt) : null,
        description: job.descriptionPlain ?? stripHtml(job.description ?? ""),
      })
    )
    .filter((job): job is ScrapedJob => job !== null);
}

async function scrapeAshby(api: APIRequestContext, company: Company): Promise<ScrapedJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company.boardToken}?includeCompensation=true`;
  const response = await api.get(url, { timeout: 30_000 });
  if (!response.ok()) {
    throw new Error(`HTTP ${response.status()}`);
  }

  const body = (await response.json()) as {
    jobs?: AshbyJob[];
    jobPostings?: AshbyJob[];
  };
  const jobs = body.jobs ?? body.jobPostings ?? [];

  return jobs
    .map((job) =>
      toScraped(company, {
        externalId: String(job.id),
        title: job.title,
        location: job.location ?? "",
        url: job.jobUrl ?? job.applyUrl ?? `https://jobs.ashbyhq.com/${company.boardToken}`,
        postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
        description: job.descriptionPlain ?? stripHtml(job.descriptionHtml ?? ""),
      })
    )
    .filter((job): job is ScrapedJob => job !== null);
}

export async function scrapeCompany(
  api: APIRequestContext,
  company: Company
): Promise<ScrapedJob[]> {
  if (company.ats === "greenhouse") return scrapeGreenhouse(api, company);
  if (company.ats === "ashby") return scrapeAshby(api, company);
  return scrapeLever(api, company);
}

export async function withApi<T>(fn: (api: APIRequestContext) => Promise<T>): Promise<T> {
  const api = await request.newContext({
    userAgent: "job-scraper/1.0 (+https://github.com/ChetanyaRathi/job-scraper)",
    timeout: 30_000,
  });
  try {
    return await fn(api);
  } finally {
    await api.dispose();
  }
}
