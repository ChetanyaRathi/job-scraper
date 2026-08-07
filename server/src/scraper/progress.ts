export interface ScrapeProgress {
  running: boolean;
  completed: number;
  total: number;
  jobsFound: number;
  errors: number;
  startedAt: string | null;
  finishedAt: string | null;
}

let state: ScrapeProgress = {
  running: false,
  completed: 0,
  total: 0,
  jobsFound: 0,
  errors: 0,
  startedAt: null,
  finishedAt: null,
};

type Listener = (progress: ScrapeProgress) => void;
const listeners = new Set<Listener>();

export function getScrapeProgress(): ScrapeProgress {
  return { ...state };
}

export function onScrapeProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  const snapshot = getScrapeProgress();
  for (const listener of listeners) listener(snapshot);
}

export function beginScrapeProgress(total: number): void {
  state = {
    running: true,
    completed: 0,
    total,
    jobsFound: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  emit();
}

export function tickScrapeProgress(update: {
  completed?: number;
  jobsFound?: number;
  errors?: number;
}): void {
  state = { ...state, ...update, running: true };
  emit();
}

export function endScrapeProgress(): void {
  state = {
    ...state,
    running: false,
    finishedAt: new Date().toISOString(),
  };
  emit();
}
