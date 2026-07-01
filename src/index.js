import config from './config.js';
import { aggregate } from './aggregate.js';
import { curate } from './curate.js';
import { formatDigest, yerevanISO } from './format.js';
import { postToTelegram } from './post.js';
import { markSeen } from './seen.js';

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
    jobs = candidates.slice(0, config.digestMax).map((j) => ({ ...j, tag: 'other-tech', summaryHy: '' }));
  }

  if (!jobs.length) {
    console.log('[zrojobs] curation kept no tech jobs — skipping post');
    return;
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
