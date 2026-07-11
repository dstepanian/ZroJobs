import config from './config.js';
import { aggregate } from './aggregate.js';
import { curate, summarize } from './curate.js';
import { enrichStaffAmJob } from './scrape/staffam.js';
import { formatDigest, yerevanISO } from './format.js';
import { postToTelegram } from './post.js';
import { markSeen } from './seen.js';

// Fetch detail pages for the picked staff.am jobs only (~10 requests, polite):
// full description for the summarizer, salary/deadline for the digest itself.
const enrich = (jobs) =>
  Promise.all(jobs.map(async (job) => {
    if (!job.id.startsWith('staffam:')) return job;
    try {
      return await enrichStaffAmJob(job);
    } catch (e) {
      console.warn(`[zrojobs] detail fetch failed for ${job.id}: ${e.message}`);
      return job;
    }
  }));

const fallbackMix = (candidates) => {
  const internationalCompanies = new Set();
  const international = candidates
    .filter((job) => job.market === 'international')
    .filter((job) => {
      const key = (job.company || job.id).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (internationalCompanies.has(key)) return false;
      internationalCompanies.add(key);
      return true;
    })
    .slice(0, config.internationalMax);
  const armenia = candidates
    .filter((job) => job.market !== 'international')
    .slice(0, Math.max(0, config.digestMax - international.length));
  return [...international, ...armenia]
    .slice(0, config.digestMax)
    .map((job) => ({ ...job, tag: job.tag || 'other-tech' }));
};

const run = async () => {
  console.log(`[zrojobs] starting${config.dry ? ' (dry run)' : ''}`);

  const candidates = await aggregate();
  console.log(`[zrojobs] ${candidates.length} new candidate jobs`);

  // No new jobs is a normal outcome (weekends, holidays) — skip quietly.
  if (!candidates.length) {
    console.log('[zrojobs] nothing new today — skipping post');
    return;
  }

  // Curate via Gemini; on failure fall back to the newest jobs uncurated so a
  // quota hiccup never silently kills the day's digest.
  let jobs;
  try {
    jobs = await curate(candidates);
    console.log(`[zrojobs] curated ${jobs.length} jobs`);
  } catch (e) {
    console.error('[zrojobs] curation failed, posting uncurated:', e.message);
    jobs = fallbackMix(candidates);
  }

  if (!jobs.length) {
    console.log('[zrojobs] curation kept no tech jobs — skipping post');
    return;
  }

  // Detail pages give the digest its salary/deadline facts either way; the
  // summary pass is a bonus that degrades to "no summaries" on failure.
  jobs = await enrich(jobs);
  try {
    jobs = await summarize(jobs);
    console.log(`[zrojobs] summarized ${jobs.filter((j) => j.summaryHy).length} of ${jobs.length}`);
  } catch (e) {
    console.warn('[zrojobs] summarize failed, posting without summaries:', e.message);
  }

  const text = formatDigest(jobs);

  if (config.dry) {
    if (config.print) {
      console.log('\n----- DIGEST PREVIEW -----\n');
      console.log(text.replace(/<\/?b>/g, ''));
      console.log('\n--------------------------\n');
    }
    console.log('[zrojobs] dry run — not posting');
    return;
  }

  const result = await postToTelegram(text);
  console.log(`[zrojobs] posted message ${result.message_id} to ${config.channel}`);

  // Only jobs actually posted count as seen — the rest stay eligible tomorrow.
  const count = markSeen(jobs.map((j) => j.id), yerevanISO());
  console.log(`[zrojobs] seen.json now tracks ${count} job(s)`);
};

run()
  .then(() => process.exit(0)) // fetch keep-alive sockets would otherwise hang the process
  .catch((e) => {
    console.error('[zrojobs] fatal:', e);
    process.exit(1);
  });
