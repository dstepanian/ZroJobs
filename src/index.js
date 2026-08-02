import config from './config.js';
import { aggregate } from './aggregate.js';
import { curate, summarize } from './curate.js';
import { enrichJobAmJob } from './scrape/jobam.js';
import { enrichLinkedInJob } from './scrape/linkedin.js';
import { enrichStaffAmJob } from './scrape/staffam.js';
import {
  featuredPhoto, formatFeaturedPost, formatJobPost, loadFeatured, plain, yerevanISO,
} from './format.js';
import { enqueue } from './queue.js';
import { loadSeen, markSeen } from './seen.js';

// Boards whose listing pages carry no description — without a detail fetch the
// summarizer has nothing to say and the post ends up as a bare title.
const ENRICHERS = {
  'staffam:': enrichStaffAmJob,
  'jobam:': enrichJobAmJob,
  'linkedin:': enrichLinkedInJob,
};

// Fetch detail pages for the picked jobs only (one request each, ~10 per run):
// full description for the summarizer, salary/deadline/seniority for the post.
const enrich = (jobs) =>
  Promise.all(jobs.map(async (job) => {
    const enricher = ENRICHERS[Object.keys(ENRICHERS).find((p) => job.id.startsWith(p))];
    if (!enricher) return job;
    try {
      return await enricher(job);
    } catch (e) {
      console.warn(`[zrojobs] detail fetch failed for ${job.id}: ${e.message}`);
      return job;
    }
  }));

const fallbackMix = (candidates) => {
  const internationalCompanies = new Set();
  const internationalLimit = Math.min(
    config.internationalMin,
    config.internationalMax,
    config.digestMax,
  );
  const international = candidates
    .filter((job) => job.market === 'international')
    .filter((job) => {
      const key = (job.company || job.id).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (internationalCompanies.has(key)) return false;
      internationalCompanies.add(key);
      return true;
    })
    .slice(0, internationalLimit);
  const armenia = candidates
    .filter((job) => job.market !== 'international')
    .slice(0, Math.max(0, config.digestMax - international.length));
  return [...international, ...armenia]
    .slice(0, config.digestMax)
    .map((job) => ({ ...job, tag: job.tag || 'other-tech' }));
};

// Paid listings live in featured.json, not in the job feed, so they get their
// own seen.json key. The date in the key is what stops the same listing being
// queued twice in one day while still letting it run again tomorrow.
const featuredId = (f, today) => {
  const slug = (f.url || `${f.company} ${f.title}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `featured:${slug.slice(0, 80)}:${today}`;
};

// The run's messages, in send order: paid listings first, then curated jobs.
const buildPosts = (jobs, today) => {
  const seen = loadSeen();
  const featured = loadFeatured()
    .map((f) => ({
      id: featuredId(f, today),
      text: formatFeaturedPost(f),
      photo: featuredPhoto(f),
      url: f.url,
    }))
    .filter((p) => !seen[p.id]);
  return [...featured, ...jobs.map((job) => ({
    id: job.id,
    text: formatJobPost(job),
    url: job.url,
  }))];
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

  // One message per vacancy: five posts are five shareable units, each fully
  // relevant to someone, instead of one digest relevant to almost nobody. They
  // go into the queue rather than out in a burst — src/drip.js releases them one
  // at a time so the channel gets a steady stream through the day.
  const today = yerevanISO();
  const posts = buildPosts(jobs, today);

  if (config.dry) {
    if (config.print) {
      posts.forEach((post, i) => {
        console.log(`\n----- POST ${i + 1} -----\n`);
        if (post.photo) console.log(`[photo] ${post.photo}`);
        console.log(plain(post.text));
        if (post.url) console.log(`\n[button] Դիմել → ${post.url}`);
      });
    }
    console.log(`\n[zrojobs] dry run — ${posts.length} post(s), not queued`);
    return;
  }

  // Seen at queue time, not at send time: a queued job is handled, and the next
  // curation run must not pick it again while it waits its turn.
  const { added, total } = enqueue(posts);
  markSeen(posts.map((p) => p.id), today);
  console.log(`[zrojobs] queued ${added} new post(s) — ${total} waiting`);
  console.log(`[zrojobs] seen.json now tracks ${Object.keys(loadSeen()).length} job(s)`);
};

run()
  .then(() => process.exit(0)) // fetch keep-alive sockets would otherwise hang the process
  .catch((e) => {
    console.error('[zrojobs] fatal:', e);
    process.exit(1);
  });
