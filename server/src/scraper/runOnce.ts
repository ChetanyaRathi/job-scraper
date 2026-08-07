import { runScrapePipeline } from "./pipeline.js";
import { pool } from "../db/pool.js";

async function main() {
  const result = await runScrapePipeline();
  console.log(
    JSON.stringify(
      {
        scraped: result.scraped,
        fresh: result.fresh,
        inserted: result.inserted.length,
        errors: result.errors,
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
