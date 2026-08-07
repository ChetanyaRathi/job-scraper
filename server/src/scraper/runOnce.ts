import { runScrapePipeline } from "./pipeline.js";
import { pool } from "../db/pool.js";

async function main() {
  const result = await runScrapePipeline();
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
