#!/usr/bin/env node
/**
 * Rebuild server/data/companies.json from public ATS board token lists.
 * Source: https://github.com/jeffrey840/job-board-aggregator
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "server/data/companies.json");

const SOURCES = [
  {
    ats: "greenhouse",
    url: "https://raw.githubusercontent.com/jeffrey840/job-board-aggregator/main/data/greenhouse_companies.json",
  },
  {
    ats: "lever",
    url: "https://raw.githubusercontent.com/jeffrey840/job-board-aggregator/main/data/lever_companies.json",
  },
  {
    ats: "ashby",
    url: "https://raw.githubusercontent.com/jeffrey840/job-board-aggregator/main/data/ashby_companies.json",
  },
];

function humanize(token) {
  const base = token.replace(/-(?:board|\d+)$/i, "");
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 3 && /^[a-z]+$/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

async function main() {
  const companies = [];
  const seen = new Set();

  for (const source of SOURCES) {
    console.log(`Fetching ${source.ats}...`);
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch ${source.url}: ${res.status}`);
    const tokens = await res.json();

    for (const raw of tokens) {
      if (typeof raw !== "string") continue;
      const token = raw.trim();
      if (!token || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(token)) continue;
      const key = `${source.ats}:${token.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      companies.push({
        id: key,
        name: humanize(token),
        ats: source.ats,
        boardToken: token,
      });
    }
  }

  companies.sort((a, b) => a.name.localeCompare(b.name) || a.ats.localeCompare(b.ats));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(companies));

  const counts = companies.reduce((acc, c) => {
    acc[c.ats] = (acc[c.ats] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Wrote ${companies.length} companies → ${OUT}`);
  console.log(counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
