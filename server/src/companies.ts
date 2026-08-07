import type { Company } from "./types.js";

/** Seed companies that publish via Greenhouse or Lever public boards. */
export const COMPANIES: Company[] = [
  { id: "stripe", name: "Stripe", ats: "greenhouse", boardToken: "stripe" },
  { id: "airbnb", name: "Airbnb", ats: "greenhouse", boardToken: "airbnb" },
  { id: "datadog", name: "Datadog", ats: "greenhouse", boardToken: "datadog" },
  { id: "figma", name: "Figma", ats: "greenhouse", boardToken: "figma" },
  { id: "notion", name: "Notion", ats: "greenhouse", boardToken: "notion" },
  { id: "cloudflare", name: "Cloudflare", ats: "greenhouse", boardToken: "cloudflare" },
  { id: "discord", name: "Discord", ats: "greenhouse", boardToken: "discord" },
  { id: "dropbox", name: "Dropbox", ats: "greenhouse", boardToken: "dropbox" },
  { id: "affirm", name: "Affirm", ats: "lever", boardToken: "affirm" },
  { id: "eventbrite", name: "Eventbrite", ats: "lever", boardToken: "eventbrite" },
];

export function getCompany(id: string): Company | undefined {
  return COMPANIES.find((c) => c.id === id);
}
