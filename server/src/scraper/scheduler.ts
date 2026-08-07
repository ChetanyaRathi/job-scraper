import { config } from "../config.js";
import type { JobRow } from "../types.js";
import { runScrapePipeline } from "./pipeline.js";

export type NewJobsHandler = (jobs: JobRow[]) => void;

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startScheduler(onNewJobs: NewJobsHandler): void {
  const intervalMs = config.scrapeIntervalMinutes * 60 * 1000;

  const tick = async () => {
    if (running) {
      console.log("[scheduler] Previous run still in progress — skipping");
      return;
    }
    running = true;
    try {
      const result = await runScrapePipeline();
      if (result.inserted.length > 0) {
        onNewJobs(result.inserted);
      }
    } catch (err) {
      console.error("[scheduler] Run failed:", err);
    } finally {
      running = false;
    }
  };

  if (config.scrapeOnStart) {
    void tick();
  }

  timer = setInterval(() => void tick(), intervalMs);
  console.log(`[scheduler] Running every ${config.scrapeIntervalMinutes} minute(s)`);
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
