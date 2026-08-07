import cors from "cors";
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { COMPANY_STATS } from "./companies.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { apiRouter } from "./routes/api.js";
import { startScheduler } from "./scraper/scheduler.js";
import { hub } from "./ws/hub.js";
import type { JobFilters } from "./types.js";

async function main() {
  // Ensure DB is reachable before serving traffic
  await pool.query("SELECT 1");

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", apiRouter);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    hub.add(socket);

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          filters?: Partial<JobFilters>;
        };
        if (msg.type === "set_filters" && msg.filters) {
          hub.setFilters(socket, msg.filters);
        }
      } catch {
        // ignore malformed client messages
      }
    });

    socket.on("close", () => hub.remove(socket));
  });

  startScheduler((jobs) => {
    console.log(`[ws] Broadcasting ${jobs.length} new job(s) to ${hub.clientCount} client(s)`);
    hub.broadcastNewJobs(jobs);
  });

  server.listen(config.port, () => {
    console.log(`API + WebSocket listening on http://localhost:${config.port}`);
    console.log(`WebSocket endpoint: ws://localhost:${config.port}/ws`);
    console.log(
      `Companies configured: ${COMPANY_STATS.total} (greenhouse=${COMPANY_STATS.greenhouse}, lever=${COMPANY_STATS.lever}, ashby=${COMPANY_STATS.ashby})`
    );
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
