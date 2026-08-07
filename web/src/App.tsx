import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Company, Job, JobFilters, RoleCategory } from "./types";

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
        <span className="sep">·</span>
        <span>Entry / SDE I</span>
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
  const [companyStats, setCompanyStats] = useState<Record<string, number>>({});
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Company[]>([]);
  const [companyQuery, setCompanyQuery] = useState("");
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
    void fetch("/api/companies?limit=30")
      .then((r) => r.json())
      .then(
        (data: {
          total: number;
          companies: Company[];
          stats?: Record<string, number>;
        }) => {
          setCompanyTotal(data.total);
          setCompanyStats(data.stats ?? {});
          setSuggestions(data.companies);
        }
      )
      .catch(console.error);

    void fetch("/api/scrape/status")
      .then((r) => r.json())
      .then((p) => {
        setScrapeProgress(p);
        setScraping(Boolean(p.running));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const q = companyQuery.trim();
    const handle = setTimeout(() => {
      const url = q
        ? `/api/companies?limit=40&q=${encodeURIComponent(q)}`
        : "/api/companies?limit=30";
      void fetch(url)
        .then((r) => r.json())
        .then((data: { companies: Company[] }) => setSuggestions(data.companies))
        .catch(console.error);
    }, 180);
    return () => clearTimeout(handle);
  }, [companyQuery]);

  const loadJobs = (next: JobFilters) => {
    const params = new URLSearchParams();
    params.set("experienceLevels", "entry_level");
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
              `Scrape finished — ${msg.result?.inserted ?? 0} new entry-level jobs from ${msg.result?.companiesAttempted ?? 0} boards`
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
    const locked = { ...next, experienceLevels: ["entry_level" as const] };
    setFilters(locked);
    loadJobs(locked);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_filters", filters: locked }));
    }
  };

  const selectCompany = (company: Company) => {
    if (filters.companyIds.includes(company.id)) return;
    const nextIds = [...filters.companyIds, company.id];
    setSelectedCompanies((prev) =>
      prev.some((c) => c.id === company.id) ? prev : [...prev, company]
    );
    updateFilters({ ...filters, companyIds: nextIds });
    setCompanyQuery("");
  };

  const clearCompanies = () => {
    setSelectedCompanies([]);
    updateFilters({ ...filters, companyIds: [] });
  };

  const removeCompany = (id: string) => {
    setSelectedCompanies((prev) => prev.filter((c) => c.id !== id));
    updateFilters({
      ...filters,
      companyIds: filters.companyIds.filter((c) => c !== id),
    });
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
      const data = (await res.json()) as {
        inserted?: number;
        scraped?: number;
        companiesAttempted?: number;
        jobs?: Job[];
      };
      if (data.jobs?.length) {
        setJobs((prev) => {
          const ids = new Set(prev.map((j) => j.id));
          const fresh = data.jobs!.filter((j) => !ids.has(j.id));
          return [...fresh, ...prev];
        });
      }
      const inserted = data.inserted ?? 0;
      if (inserted > 0) {
        setToast(`${inserted} new entry-level job(s)`);
      } else {
        setToast(
          `Scrape done — ${data.companiesAttempted ?? 0} companies, no new entry-level matches`
        );
      }
    } catch {
      setToast("Scrape failed");
    } finally {
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
            USA · Entry Level / SDE I · Intern & Full-time ·{" "}
            {companyTotal.toLocaleString() || "1,000+"} boards
          </p>
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

      {companyStats.total ? (
        <p className="board-stats">
          Entry Level / SDE I only · Boards {companyStats.total.toLocaleString()} · Greenhouse{" "}
          {(companyStats.greenhouse ?? 0).toLocaleString()} · Lever{" "}
          {(companyStats.lever ?? 0).toLocaleString()} · Ashby{" "}
          {(companyStats.ashby ?? 0).toLocaleString()}
        </p>
      ) : null}

      <section className="filters" aria-label="Filters">
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
          <div className="company-search">
            <input
              type="search"
              placeholder="Search boards (Stripe, OpenAI, Figma…)"
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
              aria-label="Search companies"
            />
            <button type="button" className="ghost compact" onClick={clearCompanies}>
              All companies
            </button>
          </div>

          {selectedCompanies.length > 0 && (
            <div className="chips wrap selected">
              {selectedCompanies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip on"
                  onClick={() => removeCompany(c.id)}
                  title="Remove filter"
                >
                  {c.name} ×
                </button>
              ))}
            </div>
          )}

          <div className="chips wrap suggestions">
            {suggestions
              .filter((c) => !filters.companyIds.includes(c.id))
              .slice(0, 24)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip"
                  onClick={() => selectCompany(c)}
                >
                  {c.name}
                  <span className="ats">{c.ats}</span>
                </button>
              ))}
          </div>
        </div>
      </section>

      <section className="feed columns" aria-live="polite">
        <div className="column">
          <div className="feed-head">
            <h2>Intern</h2>
            <p>
              {pending ? "Updating…" : `${internJobs.length}`} · last 24h
            </p>
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
            <p>
              {pending ? "Updating…" : `${fullTimeJobs.length}`} · Entry / SDE I
            </p>
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
