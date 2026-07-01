import { fetchJobs } from './fetchJobs.js';
import { loadSeen } from './seen.js';

// A job stays a candidate until it's either posted (seen.json) or too old.
// The window is wider than the daily cadence on purpose: good vacancies that
// didn't make yesterday's cut stay eligible today.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const aggregate = async ({ windowMs = WINDOW_MS, cap = 40 } = {}) => {
  const seen = loadSeen();
  const cutoff = Date.now() - windowMs;

  const unique = new Map();
  for (const job of await fetchJobs()) {
    if (seen[job.id]) continue;
    if (job.postedAt < cutoff) continue;
    if (!unique.has(job.id)) unique.set(job.id, job);
  }

  return [...unique.values()]
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, cap);
};
