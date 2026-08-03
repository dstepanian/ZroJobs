import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Telegram gets the post; this keeps the structured facts behind it. It's the
// only thing Google can index — t.me pages are a dead end for job queries — so
// every curated vacancy is recorded here and rendered into the public site.
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'jobs.json');

// Google requires expired postings to disappear. A vacancy leaves the site once
// its deadline passes, or after this long if it never stated one.
const KEEP_DAYS = 45;

const FIELDS = [
  'id', 'title', 'company', 'location', 'remote', 'market', 'salary',
  'summaryHy', 'deadline', 'url', 'source', 'tag', 'postedAt',
];

export const loadArchive = () => {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const saveArchive = (jobs) => {
  fs.writeFileSync(FILE, JSON.stringify(jobs, null, 2) + '\n');
  return jobs.length;
};

// A record is live while its deadline holds and it isn't older than KEEP_DAYS.
export const isLive = (job, now = Date.now()) => {
  if (job.deadline) {
    const ends = Date.parse(`${job.deadline}T23:59:59Z`);
    if (Number.isFinite(ends)) return ends >= now;
  }
  return Date.parse(job.publishedAt) >= now - KEEP_DAYS * 24 * 60 * 60 * 1000;
};

// Merge this run's curated jobs in, keeping the date we first published each
// one — that's what datePosted on the page has to reflect.
export const archive = (jobs, nowISO = new Date().toISOString()) => {
  const existing = new Map(loadArchive().map((j) => [j.id, j]));
  for (const job of jobs) {
    const record = Object.fromEntries(
      FIELDS.filter((f) => job[f] !== undefined && job[f] !== '').map((f) => [f, job[f]]),
    );
    existing.set(job.id, {
      ...record,
      publishedAt: existing.get(job.id)?.publishedAt || nowISO,
    });
  }

  const live = [...existing.values()]
    .filter((job) => isLive(job))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  saveArchive(live);
  return live.length;
};
