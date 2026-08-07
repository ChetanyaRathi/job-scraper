import type { ExperienceLevel, RoleCategory } from "../types.js";

const ENTRY_PATTERNS =
  /\b(entry[- ]?level|junior|jr\.?|new grad|new[- ]grad|university grad|early career|associate engineer|intern)\b/i;

const SENIOR_PATTERNS =
  /\b(senior|sr\.?|staff|principal|lead|manager|director|head of|vp\b|chief)\b/i;

const ML_TITLE =
  /\b(machine learning|ml engineer|ml scientist|deep learning|nlp engineer|computer vision|research scientist)\b/i;

const AI_TITLE =
  /\b(artificial intelligence|\bai engineer\b|\bai research\b|llm|generative ai|genai|prompt engineer)\b/i;

const SDE_TITLE =
  /\b(software engineer|software developer|sde\b|swe\b|backend engineer|frontend engineer|front[- ]end engineer|full[- ]?stack|platform engineer|infrastructure engineer|devops|site reliability|sre\b|ios engineer|android engineer|mobile engineer|security engineer|data engineer)\b/i;

export function classifyExperience(title: string, description: string): ExperienceLevel {
  const text = `${title} ${description.slice(0, 400)}`;
  if (ENTRY_PATTERNS.test(title) || ENTRY_PATTERNS.test(text)) return "entry_level";
  if (SENIOR_PATTERNS.test(title)) return "senior";
  if (/\b(mid[- ]?level|intermediate)\b/i.test(title)) return "mid";
  return "any";
}

export function classifyCategory(title: string, _description: string): RoleCategory {
  // Title-first to avoid marketing copy mentioning "AI" pulling in sales/ops roles.
  if (ML_TITLE.test(title)) return "ml";
  if (AI_TITLE.test(title)) return "ai";
  if (SDE_TITLE.test(title)) return "sde";
  return "any";
}

/** Keep only SDE / AI / ML roles for the product feed. */
export function isTargetRole(category: RoleCategory): boolean {
  return category === "sde" || category === "ai" || category === "ml";
}
