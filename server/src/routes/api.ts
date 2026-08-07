import { Router } from "express";
import { COMPANIES } from "../companies.js";
import { config } from "../config.js";
import { getRecentJobs } from "../db/jobs.js";
import { runScrapePipeline } from "../scraper/pipeline.js";
import type { ExperienceLevel, JobFilters, RoleCategory } from "../types.js";
import { hub } from "../ws/hub.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    clients: hub.clientCount,
    scrapeIntervalMinutes: config.scrapeIntervalMinutes,
    freshnessHours: config.freshnessHours,
  });
});

apiRouter.get("/companies", (_req, res) => {
  res.json(
    COMPANIES.map((c) => ({
      id: c.id,
      name: c.name,
      ats: c.ats,
    }))
  );
});

apiRouter.get("/jobs", async (req, res) => {
  try {
    const filters = parseFilters(req.query);
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
    res.json(result);
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
