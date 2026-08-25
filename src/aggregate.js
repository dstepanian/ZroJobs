import { fetchJobs } from './fetchJobs.js';
import { isSalesRole } from './scrape/remoteScope.js';
import { loadSeen } from './seen.js';

// A job stays a candidate until it's either posted (seen.json) or too old.
// The window is wider than the daily cadence on purpose: good vacancies that
// didn't make yesterday's cut stay eligible today.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const INTERNATIONAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const INTERNATIONAL_CANDIDATE_CAP = 18;

// Keep the model's source pool varied. Without this, one large board can occupy
// every candidate slot and make smaller official/company boards vanish.
export const takeSourceDiverse = (jobs, cap) => {
  const queues = new Map();
  for (const job of jobs) {
    const key = job.source || 'unknown';
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(job);
  }

  const selected = [];
  while (selected.length < cap && queues.size) {
    for (const [source, queue] of queues) {
      const job = queue.shift();
      if (job) selected.push(job);
      if (!queue.length) queues.delete(source);
      if (selected.length >= cap) break;
    }
  }
  return selected;
};

export const aggregate = async ({ windowMs = WINDOW_MS, cap = 40 } = {}) => {
  const seen = loadSeen();
  const cutoff = Date.now() - windowMs;
  const internationalCutoff = Date.now() - INTERNATIONAL_WINDOW_MS;

  const unique = new Map();
  for (const job of await fetchJobs()) {
    if (seen[job.id]) continue;
    // Adding the marketing sections brought their neighbours along: staff.am and
    // job.am file account-management and sales roles beside the marketing ones.
    // This channel does not post sales, so they are dropped here rather than at
    // the end. Gemini never spends tokens judging them, and the uncurated
    // fallback path (which does no judging at all) cannot post one by accident.
    if (isSalesRole(job.title)) continue;
    const jobCutoff = job.candidateWindowMs
      ? Date.now() - job.candidateWindowMs
      : job.market === 'international' ? internationalCutoff : cutoff;
    if (job.postedAt < jobCutoff) continue;
    if (!unique.has(job.id)) unique.set(job.id, job);
  }

  const eligible = [...unique.values()]
    .sort((a, b) => b.postedAt - a.postedAt);
  const international = eligible
    .filter((job) => job.market === 'international');
  const diverseInternational = takeSourceDiverse(international, INTERNATIONAL_CANDIDATE_CAP);
  const armenia = takeSourceDiverse(
    eligible.filter((job) => job.market !== 'international'),
    Math.max(0, cap - diverseInternational.length),
  );

  return [...armenia, ...diverseInternational].sort((a, b) => b.postedAt - a.postedAt);
};
