import { useEffect, useRef, useState, useTransition } from "react";
import type { Company, ExperienceLevel, Job, JobFilters, RoleCategory } from "./types";

const DEFAULT_FILTERS: JobFilters = {
  experienceLevels: ["entry_level"],
  categories: ["sde", "ai", "ml"],
  companyIds: [],
};

function toggleInList<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Recently";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function categoryLabel(c: RoleCategory): string {
  return { sde: "SDE", ai: "AI", ml: "ML", any: "Any" }[c];
}

function levelLabel(l: ExperienceLevel): string {
  return {
    entry_level: "Entry Level",
    mid: "Mid",
    senior: "Senior",
    any: "Any",
  }[l];
}

export function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [scraping, setScraping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wsRef = useRef<WebSocket | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    void fetch("/api/companies")
      .then((r) => r.json())
      .then((data: Company[]) => setCompanies(data))
      .catch(console.error);
  }, []);

  const loadJobs = (next: JobFilters) => {
    const params = new URLSearchParams();
    if (next.experienceLevels.length) {
      params.set("experienceLevels", next.experienceLevels.join(","));
    }
    if (next.categories.length) {
      params.set("categories", next.categories.join(","));
    }
    if (next.companyIds.length) {
      params.set("companyIds", next.companyIds.join(","));
    }

    startTransition(() => {
      void fetch(`/api/jobs?${params}`)
        .then((r) => r.json())
        .then((data: { jobs: Job[] }) => setJobs(data.jobs))
        .catch(console.error);
    });
  };

  useEffect(() => {
    loadJobs(filters);
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("live");
      ws.send(JSON.stringify({ type: "set_filters", filters: filtersRef.current }));
    };

    ws.onclose = () => setStatus("offline");
    ws.onerror = () => setStatus("offline");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type: string;
          jobs?: Job[];
        };
        if (msg.type === "new_jobs" && msg.jobs?.length) {
          setJobs((prev) => {
            const ids = new Set(prev.map((j) => j.id));
            const fresh = msg.jobs!.filter((j) => !ids.has(j.id));
            return [...fresh, ...prev];
          });
          const count = msg.jobs.length;
          const label = count === 1 ? "1 new job" : `${count} new jobs`;
          setToast(label);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Job Scraper", {
              body: `${label} matching your filters`,
            });
          }
        }
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const updateFilters = (next: JobFilters) => {
    setFilters(next);
    loadJobs(next);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_filters", filters: next }));
    }
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setToast("Notifications already enabled");
      return;
    }
    const perm = await Notification.requestPermission();
    setToast(perm === "granted" ? "Notifications enabled" : "Notifications blocked");
  };

  const scrapeNow = async () => {
    setScraping(true);
    try {
      const body =
        filters.companyIds.length > 0 ? { companyIds: filters.companyIds } : {};
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { inserted?: Job[]; scraped?: number };
      if (data.inserted?.length) {
        setJobs((prev) => {
          const ids = new Set(prev.map((j) => j.id));
          const fresh = data.inserted!.filter((j) => !ids.has(j.id));
          return [...fresh, ...prev];
        });
        setToast(`${data.inserted.length} new job(s) found`);
      } else {
        setToast(`Scrape done — ${data.scraped ?? 0} roles checked, no new matches`);
      }
    } catch {
      setToast("Scrape failed");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden />
      <header className="top">
        <div className="brand-block">
          <p className="brand">Job Scraper</p>
          <p className="tagline">Live careers feed for Entry Level · SDE · AI · ML</p>
        </div>
        <div className="top-actions">
          <span className={`pulse status-${status}`}>
            <span className="dot" />
            {status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
          </span>
          <button type="button" className="ghost" onClick={() => void requestNotifications()}>
            Enable alerts
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void scrapeNow()}
            disabled={scraping}
          >
            {scraping ? "Scraping…" : "Scrape now"}
          </button>
        </div>
      </header>

      <section className="filters" aria-label="Filters">
        <div className="filter-group">
          <h2>Level</h2>
          <div className="chips">
            {(["entry_level", "mid", "senior"] as ExperienceLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                className={filters.experienceLevels.includes(level) ? "chip on" : "chip"}
                onClick={() =>
                  updateFilters({
                    ...filters,
                    experienceLevels: toggleInList(filters.experienceLevels, level),
                  })
                }
              >
                {levelLabel(level)}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <h2>Track</h2>
          <div className="chips">
            {(["sde", "ai", "ml"] as RoleCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                className={filters.categories.includes(cat) ? "chip on" : "chip"}
                onClick={() =>
                  updateFilters({
                    ...filters,
                    categories: toggleInList(filters.categories, cat),
                  })
                }
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group companies">
          <h2>Companies</h2>
          <div className="chips wrap">
            <button
              type="button"
              className={filters.companyIds.length === 0 ? "chip on" : "chip"}
              onClick={() => updateFilters({ ...filters, companyIds: [] })}
            >
              All
            </button>
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                className={filters.companyIds.includes(c.id) ? "chip on" : "chip"}
                onClick={() =>
                  updateFilters({
                    ...filters,
                    companyIds: toggleInList(filters.companyIds, c.id),
                  })
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="feed" aria-live="polite">
        <div className="feed-head">
          <h2>Live feed</h2>
          <p>
            {pending ? "Updating…" : `${jobs.length} role${jobs.length === 1 ? "" : "s"}`} · last
            24h
          </p>
        </div>

        {jobs.length === 0 ? (
          <div className="empty">
            <p>No matching jobs yet.</p>
            <p className="muted">
              Hit <strong>Scrape now</strong> or wait for the 10-minute scheduler.
            </p>
          </div>
        ) : (
          <ul className="job-list">
            {jobs.map((job, i) => (
              <li key={job.id} className="job" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="job-meta">
                  <span className="company">{job.company_name}</span>
                  <span className="sep">·</span>
                  <span>{categoryLabel(job.category)}</span>
                  <span className="sep">·</span>
                  <span>{levelLabel(job.experience_level)}</span>
                </div>
                <a href={job.url} target="_blank" rel="noreferrer" className="job-title">
                  {job.title}
                </a>
                <div className="job-foot">
                  <span>{job.location || "Location n/a"}</span>
                  <span>{formatWhen(job.posted_at ?? job.first_seen_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
