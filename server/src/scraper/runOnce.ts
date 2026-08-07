import { runScrapePipeline } from "./pipeline.js";
import { pool } from "../db/pool.js";

async function main() {
  const result = await runScrapePipeline();
  console.log(
    JSON.stringify(
      {
        companiesAttempted: result.companiesAttempted,
        scraped: result.scraped,
        usa: result.usa,
        fresh: result.fresh,
        inserted: result.inserted.length,
        errorCount: result.errors.length,
        errorsSample: result.errors.slice(0, 10),
        sample: result.inserted.slice(0, 5).map((j) => ({
          company: j.company_name,
          title: j.title,
          category: j.category,
          level: j.experience_level,
        })),
      },
      null,
      2
    )
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
