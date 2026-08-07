import { Router } from "express";
import { COMPANY_STATS, COMPANIES, getCompany, searchCompanies } from "../companies.js";
import { config } from "../config.js";
import { getRecentJobs } from "../db/jobs.js";
import { runScrapePipeline } from "../scraper/pipeline.js";
import type { Ats, ExperienceLevel, JobFilters, RoleCategory } from "../types.js";
import { hub } from "../ws/hub.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    clients: hub.clientCount,
    companies: COMPANY_STATS.total,
    scrapeIntervalMinutes: config.scrapeIntervalMinutes,
    freshnessHours: config.freshnessHours,
    scrapeConcurrency: config.scrapeConcurrency,
  });
});

apiRouter.get("/companies", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limit = Number(req.query.limit ?? 50);
  const ats = typeof req.query.ats === "string" ? (req.query.ats as Ats) : undefined;
  const ids = typeof req.query.ids === "string" ? req.query.ids.split(",").filter(Boolean) : [];

  if (ids.length > 0) {
    const companies = ids.map((id) => getCompany(id)).filter(Boolean);
    res.json({ total: COMPANY_STATS.total, companies, stats: COMPANY_STATS });
    return;
  }

  const result = searchCompanies(q, Number.isFinite(limit) ? limit : 50, ats);
  res.json({ ...result, stats: COMPANY_STATS });
});

apiRouter.get("/companies/stats", (_req, res) => {
  res.json(COMPANY_STATS);
});

apiRouter.get("/jobs", async (req, res) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const jobs = await getRecentJobs(filters, config.freshnessHours);
    res.json({ jobs, filters });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

apiRouter.post("/scrape", async (req, res) => {
  try {
    const companyIds = Array.isArray(req.body?.companyIds)
      ? (req.body.companyIds as string[])
      : undefined;
    const result = await runScrapePipeline(companyIds);
    if (result.inserted.length > 0) {
      hub.broadcastNewJobs(result.inserted);
    }
    res.json({
      scraped: result.scraped,
      fresh: result.fresh,
      inserted: result.inserted.length,
      companiesAttempted: result.companiesAttempted,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 50),
      jobs: result.inserted.slice(0, 100),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scrape failed" });
  }
});

function parseFilters(query: Record<string, unknown>): JobFilters {
  const asList = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === "string" && value.length > 0) {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  return {
    experienceLevels: asList(query.experienceLevels) as ExperienceLevel[],
    categories: asList(query.categories) as RoleCategory[],
    companyIds: asList(query.companyIds),
  };
}

// Keep COMPANIES referenced for type side-effects / readiness
void COMPANIES;
