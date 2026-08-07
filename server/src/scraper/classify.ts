import type { ExperienceLevel, RoleCategory } from "../types.js";

const ENTRY_PATTERNS =
  /\b(entry[- ]?level|junior|jr\.?|new grad|new[- ]grad|university|graduate|intern|early career|associate)\b/i;

const SENIOR_PATTERNS =
  /\b(senior|sr\.?|staff|principal|lead|manager|director|head of)\b/i;

const AI_PATTERNS =
  /\b(ai|artificial intelligence|llm|generative|genai|prompt engineer|chatbot)\b/i;

const ML_PATTERNS =
  /\b(machine learning|ml engineer|deep learning|nlp|computer vision|data scientist|research scientist)\b/i;

const SDE_PATTERNS =
  /\b(software|sde|swe|backend|front[- ]?end|full[- ]?stack|platform|infrastructure|devops|sre|mobile|ios|android|engineer)\b/i;

export function classifyExperience(title: string, description: string): ExperienceLevel {
  const text = `${title} ${description}`;
  if (ENTRY_PATTERNS.test(text)) return "entry_level";
  if (SENIOR_PATTERNS.test(text)) return "senior";
  if (/\b(mid[- ]?level|intermediate)\b/i.test(text)) return "mid";
  return "any";
}

export function classifyCategory(title: string, description: string): RoleCategory {
  const text = `${title} ${description}`;
  if (ML_PATTERNS.test(text)) return "ml";
  if (AI_PATTERNS.test(text)) return "ai";
  if (SDE_PATTERNS.test(text)) return "sde";
  return "any";
}

/** Keep only SDE / AI / ML roles for the product feed. */
export function isTargetRole(category: RoleCategory): boolean {
  return category === "sde" || category === "ai" || category === "ml";
}
