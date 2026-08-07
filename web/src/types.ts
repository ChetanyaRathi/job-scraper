export type ExperienceLevel = "entry_level" | "mid" | "senior" | "any";
export type RoleCategory = "sde" | "ai" | "ml" | "any";

export interface Company {
  id: string;
  name: string;
  ats: string;
}

export interface Job {
  id: number;
  external_id: string;
  company_id: string;
  company_name: string;
  title: string;
  location: string;
  url: string;
  posted_at: string | null;
  description: string;
  experience_level: ExperienceLevel;
  category: RoleCategory;
  first_seen_at: string;
  created_at: string;
}

export interface JobFilters {
  experienceLevels: ExperienceLevel[];
  categories: RoleCategory[];
  companyIds: string[];
}
