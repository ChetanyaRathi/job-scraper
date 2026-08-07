export type ExperienceLevel = "entry_level" | "mid" | "senior" | "any";
export type RoleCategory = "sde" | "ai" | "ml" | "any";
export type Ats = "greenhouse" | "lever" | "ashby";

export interface Company {
  id: string;
  name: string;
  ats: Ats;
  boardToken: string;
}

export interface ScrapedJob {
  externalId: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  url: string;
  postedAt: Date | null;
  description: string;
  experienceLevel: ExperienceLevel;
  category: RoleCategory;
}

export interface JobRow {
  id: number;
  external_id: string;
  company_id: string;
  company_name: string;
  title: string;
  location: string;
  url: string;
  posted_at: Date | null;
  description: string;
  experience_level: ExperienceLevel;
  category: RoleCategory;
  first_seen_at: Date;
  created_at: Date;
}

export interface JobFilters {
  experienceLevels: ExperienceLevel[];
  categories: RoleCategory[];
  companyIds: string[];
}
