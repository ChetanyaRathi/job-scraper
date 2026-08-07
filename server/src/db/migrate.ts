import { pool } from "./pool.js";

const sql = `
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  external_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  description TEXT NOT NULL DEFAULT '',
  experience_level TEXT NOT NULL DEFAULT 'any',
  category TEXT NOT NULL DEFAULT 'any',
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, external_id)
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'full_time';

CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_jobs_first_seen_at ON jobs (first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs (company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs (category);
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON jobs (experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs (employment_type);
`;

async function migrate() {
  await pool.query(sql);

  // Backfill employment_type from titles for existing rows
  await pool.query(`
    UPDATE jobs
    SET employment_type = CASE
      WHEN title ~* '(intern(ship)?|co[- ]?op|coop)' THEN 'intern'
      ELSE 'full_time'
    END
  `);

  console.log("Migration complete.");
  await pool.end();
}

migrate().catch(async (err) => {
  console.error("Migration failed:", err);
  await pool.end();
  process.exit(1);
});
