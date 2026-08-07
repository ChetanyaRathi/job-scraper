import { readFileSync } from "node:fs";
import path from "node:path";
import type { Ats, Company } from "./types.js";

function loadCompanies(): Company[] {
  const candidates = [
    path.join(process.cwd(), "server/data/companies.json"),
    path.join(process.cwd(), "data/companies.json"),
  ];

  for (const file of candidates) {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as Company[];
      return raw.filter(
        (c) =>
          c &&
          typeof c.id === "string" &&
          typeof c.boardToken === "string" &&
          (c.ats === "greenhouse" || c.ats === "lever" || c.ats === "ashby")
      );
    } catch {
      // try next path
    }
  }

  throw new Error(
    "Could not load server/data/companies.json. Run: npm run companies:build"
  );
}

export const COMPANIES: Company[] = loadCompanies();

const byId = new Map(COMPANIES.map((c) => [c.id, c]));

export function getCompany(id: string): Company | undefined {
  return byId.get(id);
}

export function searchCompanies(
  query = "",
  limit = 50,
  ats?: Ats
): { total: number; companies: Company[] } {
  const q = query.trim().toLowerCase();
  let list = COMPANIES;

  if (ats) {
    list = list.filter((c) => c.ats === ats);
  }

  if (q) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.boardToken.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }

  return {
    total: list.length,
    companies: list.slice(0, Math.min(Math.max(limit, 1), 500)),
  };
}

export const COMPANY_STATS = COMPANIES.reduce(
  (acc, c) => {
    acc[c.ats] = (acc[c.ats] ?? 0) + 1;
    return acc;
  },
  { greenhouse: 0, lever: 0, ashby: 0, total: 0 } as Record<string, number>
);

COMPANY_STATS.total = COMPANIES.length;
