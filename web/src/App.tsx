import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Job, JobFilters, RoleCategory } from "./types";

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

function isInternJob(job: Job): boolean {
  if (job.employment_type === "intern") return true;
  return /\b(intern(ship)?|co[- ]?op|coop)\b/i.test(job.title);
}

function JobCard({ job, index }: { job: Job; index: number }) {
  return (
    <li className="job" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <div className="job-meta">
        <span className="company">{job.company_name}</span>
        <span className="sep">·</span>
        <span>{categoryLabel(job.category)}</span>
      </div>
      <a href={job.url} target="_blank" rel="noreferrer" className="job-title">
        {job.title}
      </a>
      <div className="job-foot">
        <span>{job.location || "Location n/a"}</span>
        <span>{formatWhen(job.posted_at ?? job.first_seen_at)}</span>
      </div>
    </li>
  );
}

export function App() {
  const [companyTotal, setCompanyTotal] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<{
    running: boolean;
    completed: number;
    total: number;
    jobsFound: number;
    errors: number;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wsRef = useRef<WebSocket | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const internJobs = useMemo(() => jobs.filter(isInternJob), [jobs]);
  const fullTimeJobs = useMemo(() => jobs.filter((j) => !isInternJob(j)), [jobs]);

  useEffect(() => {
    void fetch("/api/companies/stats")
      .then((r) => r.json())
      .then((stats: { total?: number }) => setCompanyTotal(stats.total ?? 0))
      .catch(console.error);

    void fetch("/api/scrape/status")
      .then((r) => r.json())
      .then((p) => {
        setScrapeProgress(p);
        setScraping(Boolean(p.running));
      })
      .catch(() => undefined);
  }, []);

  const loadJobs = (next: JobFilters) => {
    const params = new URLSearchParams();
    params.set("experienceLevels", "entry_level");
    if (next.categories.length) {
      params.set("categories", next.categories.join(","));
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
          progress?: {
            running: boolean;
            completed: number;
            total: number;
            jobsFound: number;
            errors: number;
          };
          result?: { inserted?: number; companiesAttempted?: number };
          error?: string;
        };
        if (msg.type === "scrape_progress" && msg.progress) {
          setScrapeProgress(msg.progress);
          setScraping(msg.progress.running);
        }
        if (msg.type === "scrape_done") {
          setScraping(false);
          if (msg.error) {
            setToast(msg.error);
          } else {
            setToast(
              `Scrape finished — ${msg.result?.inserted ?? 0} new jobs`
            );
            loadJobs(filtersRef.current);
          }
        }
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
    const locked = { ...next, experienceLevels: ["entry_level" as const], companyIds: [] };
    setFilters(locked);
    loadJobs(locked);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_filters", filters: locked }));
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
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        error?: string;
        progress?: {
          running: boolean;
          completed: number;
          total: number;
          jobsFound: number;
          errors: number;
        };
      };
      if (res.status === 409) {
        setToast("Scrape already running");
        if (data.progress) setScrapeProgress(data.progress);
        return;
      }
      if (data.progress) setScrapeProgress(data.progress);
      setToast("Scraping all boards…");
    } catch {
      setToast("Scrape failed");
      setScraping(false);
    }
  };

  return (
    <div className="page wide">
      <div className="atmosphere" aria-hidden />
      <header className="top">
        <div className="brand-block">
          <p className="brand">Job Scraper</p>
          <p className="tagline">
            USA entry-level & intern roles ·{" "}
            {companyTotal.toLocaleString() || "15,000+"} boards
          </p>
        </div>
        <div className="top-actions">
          <span className={`pulse status-${status}`}>
            <span className="dot" />
            {status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
          </span>
          <button type="button" className="ghost" onClick={() => void requestNotifications()}>
            Alerts
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

      <div className="simple-tracks" aria-label="Track filters">
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

      {scrapeProgress?.running || scraping ? (
        <div className="scrape-banner">
          <div className="scrape-banner-top">
            <strong>Scraping boards…</strong>
            <span>
              {scrapeProgress?.completed?.toLocaleString() ?? 0}/
              {scrapeProgress?.total?.toLocaleString() ?? "…"}
            </span>
          </div>
          <div className="scrape-bar">
            <div
              className="scrape-bar-fill"
              style={{
                width: scrapeProgress?.total
                  ? `${Math.min(100, (100 * scrapeProgress.completed) / scrapeProgress.total)}%`
                  : "8%",
              }}
            />
          </div>
        </div>
      ) : null}

      <section className="feed columns" aria-live="polite">
        <div className="column">
          <div className="feed-head">
            <h2>Intern</h2>
            <p>{pending ? "Updating…" : `${internJobs.length}`} · last 24h</p>
          </div>
          {internJobs.length === 0 ? (
            <div className="empty compact">
              <p>No intern roles yet.</p>
            </div>
          ) : (
            <ul className="job-list">
              {internJobs.map((job, i) => (
                <JobCard key={job.id} job={job} index={i} />
              ))}
            </ul>
          )}
        </div>

        <div className="column">
          <div className="feed-head">
            <h2>Full-time</h2>
            <p>{pending ? "Updating…" : `${fullTimeJobs.length}`} · Entry / SDE I</p>
          </div>
          {fullTimeJobs.length === 0 ? (
            <div className="empty compact">
              <p>No full-time entry roles yet.</p>
            </div>
          ) : (
            <ul className="job-list">
              {fullTimeJobs.map((job, i) => (
                <JobCard key={job.id} job={job} index={i} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
