import { TELEGRAM_CHANNELS } from './sources.js';
import { fetchStaffAm } from './scrape/staffam.js';
import { fetchJobAm } from './scrape/jobam.js';
import { fetchLinkedIn } from './scrape/linkedin.js';
import { fetchRemotive } from './scrape/remotive.js';
import { fetchTelegramChannel } from './scrape/telegram.js';

// Run every source adapter in parallel; a failing source logs and contributes
// nothing instead of killing the digest.
export const fetchJobs = async () => {
  const adapters = [
    ['staff.am', fetchStaffAm],
    ['job.am', fetchJobAm],
    ['LinkedIn', fetchLinkedIn],
    ['Remotive', fetchRemotive],
    ...TELEGRAM_CHANNELS.map((ch) => [`@${ch}`, () => fetchTelegramChannel(ch)]),
  ];

  const results = await Promise.all(
    adapters.map(async ([name, fn]) => {
      try {
        const jobs = await fn();
        console.log(`[zrojobs] ${name}: ${jobs.length} jobs`);
        const market = name === 'Remotive' ? 'international' : 'armenia';
        return jobs.map((job) => ({ ...job, market: job.market || market }));
      } catch (e) {
        console.error(`[zrojobs] ${name} failed: ${e.message}`);
        return [];
      }
    }),
  );

  return results.flat();
};
