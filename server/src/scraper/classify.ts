import type { EmploymentType, ExperienceLevel, RoleCategory } from "../types.js";

const INTERN_PATTERNS =
  /\b(intern(ship)?|co[- ]?op|coop)\b/i;

const SENIOR_OR_ABOVE =
  /\b(senior|sr\.?|staff|principal|lead|manager|director|head of|vp\b|chief|sde\s*(ii|iii|iv|2|3|4)|swe\s*(ii|iii|iv|2|3|4)|software engineer\s*(ii|iii|iv|2|3|4)|engineer\s*(ii|iii|iv|2|3|4)|mid[- ]?level|intermediate|\bii\b|\biii\b)\b/i;

const ENTRY_OR_SDE1 =
  /\b(entry[- ]?level|junior|jr\.?|new[- ]?grad|recent[- ]?grad|university|college grad|early[- ]?career|associate engineer|associate software|sde\s*i\b|sde\s*1\b|swe\s*i\b|swe\s*1\b|software engineer\s*i\b|software engineer\s*1\b|engineer\s*i\b|engineer\s*1\b|level\s*1\b|graduate|graduating|class of 202[4-9]|0\s*[-–—to]+\s*[12]\s*years?|[01]\+?\s*years?\s*(of\s*)?experience)\b/i;

const ML_TITLE =
  /\b(machine learning|ml engineer|ml scientist|deep learning|nlp engineer|computer vision|research scientist)\b/i;

const AI_TITLE =
  /\b(artificial intelligence|ai engineer|ai research|llm|generative ai|genai|prompt engineer)\b/i;

const SDE_TITLE =
  /\b(software engineer|software developer|sde\b|swe\b|backend engineer|frontend engineer|front[- ]end engineer|full[- ]?stack|platform engineer|infrastructure engineer|devops|site reliability|sre\b|ios engineer|android engineer|mobile engineer|security engineer|data engineer|systems engineer)\b/i;

export function classifyEmploymentType(title: string): EmploymentType {
  return INTERN_PATTERNS.test(title) ? "intern" : "full_time";
}

export function classifyExperience(title: string, description: string): ExperienceLevel {
  if (INTERN_PATTERNS.test(title)) return "entry_level";
  if (SENIOR_OR_ABOVE.test(title)) return "senior";
  if (ENTRY_OR_SDE1.test(title)) return "entry_level";

  const snippet = description.slice(0, 600);
  if (ENTRY_OR_SDE1.test(snippet) && !SENIOR_OR_ABOVE.test(title)) return "entry_level";
  if (/\b(mid[- ]?level|intermediate)\b/i.test(title)) return "mid";
  return "any";
}

export function classifyCategory(title: string, _description: string): RoleCategory {
  if (ML_TITLE.test(title)) return "ml";
  if (AI_TITLE.test(title)) return "ai";
  if (SDE_TITLE.test(title)) return "sde";
  if (
    INTERN_PATTERNS.test(title) &&
    /\b(software|sde|swe|engineer|engineering|developer|devops|sre|platform|data|ai|ml|machine learning|computer science|cs)\b/i.test(
      title
    )
  ) {
    if (ML_TITLE.test(title) || /\bml\b/i.test(title)) return "ml";
    if (/\bai\b/i.test(title)) return "ai";
    return "sde";
  }
  return "any";
}

export function isTargetRole(category: RoleCategory): boolean {
  return category === "sde" || category === "ai" || category === "ml";
}

/** Only interns + entry-level / SDE I full-time roles. */
export function isEntryOrSde1(title: string, experienceLevel: ExperienceLevel): boolean {
  if (SENIOR_OR_ABOVE.test(title)) return false;
  if (INTERN_PATTERNS.test(title)) return true;
  if (experienceLevel === "entry_level") return true;
  if (ENTRY_OR_SDE1.test(title)) return true;
  return false;
}
