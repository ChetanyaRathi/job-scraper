import type { WebSocket } from "ws";
import type { ExperienceLevel, JobFilters, JobRow, RoleCategory } from "../types.js";
import { jobMatchesFilters } from "../db/jobs.js";
import type { ScrapeProgress } from "../scraper/progress.js";

interface ClientState {
  socket: WebSocket;
  filters: JobFilters;
}

function defaultFilters(): JobFilters {
  return {
    experienceLevels: ["entry_level"],
    categories: ["sde", "ai", "ml"],
    companyIds: [],
  };
}

export class Hub {
  private clients = new Map<WebSocket, ClientState>();

  add(socket: WebSocket): void {
    this.clients.set(socket, { socket, filters: defaultFilters() });
    socket.send(JSON.stringify({ type: "connected", filters: defaultFilters() }));
  }

  remove(socket: WebSocket): void {
    this.clients.delete(socket);
  }

  setFilters(socket: WebSocket, filters: Partial<JobFilters>): void {
    const client = this.clients.get(socket);
    if (!client) return;

    client.filters = {
      experienceLevels:
        (filters.experienceLevels as ExperienceLevel[] | undefined) ??
        client.filters.experienceLevels,
      categories:
        (filters.categories as RoleCategory[] | undefined) ?? client.filters.categories,
      companyIds: filters.companyIds ?? client.filters.companyIds,
    };

    socket.send(JSON.stringify({ type: "filters_updated", filters: client.filters }));
  }

  broadcastNewJobs(jobs: JobRow[]): void {
    for (const client of this.clients.values()) {
      const matched = jobs.filter((job) => jobMatchesFilters(job, client.filters));
      if (matched.length === 0) continue;

      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(
          JSON.stringify({
            type: "new_jobs",
            jobs: matched,
          })
        );
      }
    }
  }

  broadcast(message: unknown): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(payload);
      }
    }
  }

  broadcastProgress(progress: ScrapeProgress): void {
    this.broadcast({ type: "scrape_progress", progress });
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const hub = new Hub();
