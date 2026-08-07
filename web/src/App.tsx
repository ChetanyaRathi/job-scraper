import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Job, JobFilters, RoleCategory } from "./types";

type Step = "scrape" | "scraping" | "choose" | "results";
type JobType = "intern" | "full_time";

const DEFAULT_FILTERS: JobFilters = {
  experienceLevels: ["entry_level"],
  categories: ["sde", "ai", "ml"],
  companyIds: [],
};

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
  const [step, setStep] = useState<Step>("scrape");
  const [jobType, setJobType] = useState<JobType | null>(null);
  const [companyTotal, setCompanyTotal] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [scrapeProgress, setScrapeProgress] = useState<{
    running: boolean;
    completed: number;
    total: number;
    jobsFound: number;
    errors: number;
  } | null>(null);
  const [lastInserted, setLastInserted] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wsRef = useRef<WebSocket | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const visibleJobs = useMemo(() => {
    if (!jobType) return [];
    return jobType === "intern" ? jobs.filter(isInternJob) : jobs.filter((j) => !isInternJob(j));
  }, [jobs, jobType]);

  useEffect(() => {
    void fetch("/api/companies/stats")
      .then((r) => r.json())
      .then((stats: { total?: number }) => setCompanyTotal(stats.total ?? 0))
      .catch(console.error);

    void fetch("/api/scrape/status")
      .then((r) => r.json())
      .then((p) => {
        setScrapeProgress(p);
        if (p.running) setStep("scraping");
      })
      .catch(() => undefined);
  }, []);

  const loadJobs = () => {
    const params = new URLSearchParams();
    params.set("experienceLevels", "entry_level");
    params.set("categories", filtersRef.current.categories.join(","));

    startTransition(() => {
      void fetch(`/api/jobs?${params}`)
        .then((r) => r.json())
        .then((data: { jobs: Job[] }) => setJobs(data.jobs))
        .catch(console.error);
    });
  };

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
          if (msg.progress.running) setStep("scraping");
        }

        if (msg.type === "scrape_done") {
          if (msg.error) {
            setToast(msg.error);
            setStep("scrape");
            return;
          }
          setLastInserted(msg.result?.inserted ?? 0);
          setToast(`Scrape finished — ${msg.result?.inserted ?? 0} new jobs`);
          loadJobs();
          setJobType(null);
          setStep("choose");
        }

        if (msg.type === "new_jobs" && msg.jobs?.length) {
          setJobs((prev) => {
            const ids = new Set(prev.map((j) => j.id));
            const fresh = msg.jobs!.filter((j) => !ids.has(j.id));
            return [...fresh, ...prev];
          });
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

  const scrapeNow = async () => {
    setStep("scraping");
    setJobType(null);
    setJobs([]);
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
        setStep("scraping");
        return;
      }
      if (data.progress) setScrapeProgress(data.progress);
      setToast("Scraping all boards…");
    } catch {
      setToast("Scrape failed");
      setStep("scrape");
    }
  };

  const chooseType = (type: JobType) => {
    setJobType(type);
    if (jobs.length === 0) loadJobs();
    setStep("results");
  };

  return (
    <div className="page narrow">
      <div className="atmosphere" aria-hidden />
      <header className="top simple">
        <div className="brand-block">
          <p className="brand">Job Scraper</p>
          <p className="tagline">
            USA · Entry Level / SDE I · {companyTotal.toLocaleString() || "15,000+"} boards
          </p>
        </div>
        <span className={`pulse status-${status}`}>
          <span className="dot" />
          {status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
        </span>
      </header>

      {step === "scrape" && (
        <section className="hero-step">
          <h1>Start by scraping</h1>
          <p>Pull fresh USA entry-level roles from company career boards.</p>
          <button type="button" className="primary big" onClick={() => void scrapeNow()}>
            Scrape jobs
          </button>
        </section>
      )}

      {step === "scraping" && (
        <section className="hero-step">
          <h1>Scraping boards…</h1>
          <p>Hang tight — this can take a few minutes across all companies.</p>
          <div className="scrape-banner plain">
            <div className="scrape-banner-top">
              <strong>Progress</strong>
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
                    : "10%",
                }}
              />
            </div>
          </div>
        </section>
      )}

      {step === "choose" && (
        <section className="hero-step">
          <h1>What are you looking for?</h1>
          <p>
            Scrape complete
            {lastInserted !== null ? ` · ${lastInserted} new jobs saved` : ""}. Pick one to view.
          </p>
          <div className="choice-row">
            <button type="button" className="choice" onClick={() => chooseType("intern")}>
              <span className="choice-title">Intern</span>
              <span className="choice-sub">Internships & co-ops</span>
            </button>
            <button type="button" className="choice" onClick={() => chooseType("full_time")}>
              <span className="choice-title">Full-time</span>
              <span className="choice-sub">Entry Level / SDE I</span>
            </button>
          </div>
          <button type="button" className="ghost" onClick={() => void scrapeNow()}>
            Scrape again
          </button>
        </section>
      )}

      {step === "results" && jobType && (
        <section className="feed single" aria-live="polite">
          <div className="feed-head results-head">
            <div>
              <h2>{jobType === "intern" ? "Intern roles" : "Full-time roles"}</h2>
              <p>
                {pending ? "Updating…" : `${visibleJobs.length} roles`} · last 30 days · Entry / SDE I
              </p>
            </div>
            <div className="results-actions">
              <button type="button" className="ghost" onClick={() => setStep("choose")}>
                Change type
              </button>
              <button type="button" className="ghost" onClick={() => void scrapeNow()}>
                Scrape again
              </button>
            </div>
          </div>

          {visibleJobs.length === 0 ? (
            <div className="empty">
              <p>No {jobType === "intern" ? "intern" : "full-time entry"} roles found yet.</p>
              <p className="muted">Try scraping again or switch type.</p>
            </div>
          ) : (
            <ul className="job-list">
              {visibleJobs.map((job, i) => (
                <JobCard key={job.id} job={job} index={i} />
              ))}
            </ul>
          )}
        </section>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
