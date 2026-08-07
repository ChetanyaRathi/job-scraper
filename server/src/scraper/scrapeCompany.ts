import { chromium, type Browser } from "playwright";
import type { Company, ScrapedJob } from "../types.js";
import { classifyCategory, classifyExperience, isTargetRole } from "./classify.js";

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

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function scrapeGreenhouse(browser: Browser, company: Company): Promise<ScrapedJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company.boardToken}/jobs?content=true`;
  const page = await browser.newPage();

  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    if (!response || !response.ok()) {
      throw new Error(`Greenhouse ${company.id}: HTTP ${response?.status()}`);
    }

    const body = (await response.json()) as { jobs?: GreenhouseJob[] };
    const jobs = body.jobs ?? [];

    return jobs
      .map((job) => {
        const description = stripHtml(job.content ?? "");
        const category = classifyCategory(job.title, description);
        const experienceLevel = classifyExperience(job.title, description);

        return {
          externalId: String(job.id),
          companyId: company.id,
          companyName: company.name,
          title: job.title,
          location: job.location?.name ?? "",
          url: job.absolute_url,
          postedAt: job.updated_at ? new Date(job.updated_at) : null,
          description: description.slice(0, 2000),
          experienceLevel,
          category,
        } satisfies ScrapedJob;
      })
      .filter((job) => isTargetRole(job.category));
  } finally {
    await page.close();
  }
}

async function scrapeLever(browser: Browser, company: Company): Promise<ScrapedJob[]> {
  const url = `https://api.lever.co/v0/postings/${company.boardToken}?mode=json`;
  const page = await browser.newPage();

  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    if (!response || !response.ok()) {
      throw new Error(`Lever ${company.id}: HTTP ${response?.status()}`);
    }

    const jobs = (await response.json()) as LeverJob[];

    return jobs
      .map((job) => {
        const description = job.descriptionPlain ?? stripHtml(job.description ?? "");
        const category = classifyCategory(job.text, description);
        const experienceLevel = classifyExperience(job.text, description);

        return {
          externalId: job.id,
          companyId: company.id,
          companyName: company.name,
          title: job.text,
          location: job.categories?.location ?? "",
          url: job.hostedUrl,
          postedAt: job.createdAt ? new Date(job.createdAt) : null,
          description: description.slice(0, 2000),
          experienceLevel,
          category,
        } satisfies ScrapedJob;
      })
      .filter((job) => isTargetRole(job.category));
  } finally {
    await page.close();
  }
}

export async function scrapeCompany(browser: Browser, company: Company): Promise<ScrapedJob[]> {
  if (company.ats === "greenhouse") {
    return scrapeGreenhouse(browser, company);
  }
  return scrapeLever(browser, company);
}

export async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}
