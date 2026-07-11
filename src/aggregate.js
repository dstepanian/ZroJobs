import { fetchJobs } from './fetchJobs.js';
import { loadSeen } from './seen.js';

// A job stays a candidate until it's either posted (seen.json) or too old.
// The window is wider than the daily cadence on purpose: good vacancies that
// didn't make yesterday's cut stay eligible today.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const INTERNATIONAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const INTERNATIONAL_CANDIDATE_CAP = 12;

export const aggregate = async ({ windowMs = WINDOW_MS, cap = 40 } = {}) => {
  const seen = loadSeen();
  const cutoff = Date.now() - windowMs;
  const internationalCutoff = Date.now() - INTERNATIONAL_WINDOW_MS;

  const unique = new Map();
  for (const job of await fetchJobs()) {
    if (seen[job.id]) continue;
    const jobCutoff = job.market === 'international' ? internationalCutoff : cutoff;
    if (job.postedAt < jobCutoff) continue;
    if (!unique.has(job.id)) unique.set(job.id, job);
  }

  const eligible = [...unique.values()]
    .sort((a, b) => b.postedAt - a.postedAt)
  const international = eligible
    .filter((job) => job.market === 'international')
    .slice(0, INTERNATIONAL_CANDIDATE_CAP);
  const armenia = eligible
    .filter((job) => job.market !== 'international')
    .slice(0, Math.max(0, cap - international.length));

  return [...armenia, ...international].sort((a, b) => b.postedAt - a.postedAt);
};
