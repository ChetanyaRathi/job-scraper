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
): { total: number; matched: number; companies: Company[] } {
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
    total: COMPANIES.length,
    matched: list.length,
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

/** Well-known boards shown when the company search is empty. */
const FEATURED_TOKENS = [
  "greenhouse:stripe",
  "greenhouse:airbnb",
  "greenhouse:datadog",
  "greenhouse:figma",
  "greenhouse:cloudflare",
  "greenhouse:discord",
  "greenhouse:dropbox",
  "greenhouse:robinhood",
  "greenhouse:coinbase",
  "greenhouse:reddit",
  "greenhouse:roblox",
  "greenhouse:doordashusa",
  "greenhouse:nvidia",
  "ashby:openai",
  "ashby:anthropic",
  "lever:netflix",
  "greenhouse:block",
  "greenhouse:twitch",
  "greenhouse:pinterest",
  "greenhouse:spotify",
];

export function featuredCompanies(limit = 30): Company[] {
  const featured = FEATURED_TOKENS.map((id) => getCompany(id)).filter(
    (c): c is Company => Boolean(c)
  );
  if (featured.length >= limit) return featured.slice(0, limit);
  // fill with more recognizable names
  const extras = COMPANIES.filter(
    (c) =>
      !featured.some((f) => f.id === c.id) &&
      /^(stripe|airbnb|meta|google|amazon|microsoft|apple|uber|lyft|snap|shopify|square|block|openai|anthropic|nvidia|intel|amd|salesforce|oracle|adobe|zoom|slack|atlassian|databricks|snowflake|palantir|anduril|scale)/i.test(
        c.boardToken
      )
  );
  return [...featured, ...extras].slice(0, limit);
}
