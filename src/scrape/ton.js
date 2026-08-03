import { decodeEntities } from '../text.js';
import { isArmeniaAccessible, isTechnicalRole, tagForRole } from './remoteScope.js';

const LISTING_URL = 'https://jobs.ton.org/jobs';
const UA = 'Mozilla/5.0 (compatible; zrojobs/1.0; +https://t.me/zrojobs)';

const nextData = (html) => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!match) throw new Error('TON Jobs: __NEXT_DATA__ not found (page layout changed?)');
  return JSON.parse(match[1])?.props?.pageProps;
};

export const parseTonJobs = (html) => {
  const jobs = nextData(html)?.initialState?.jobs?.found || [];

  return jobs
    .filter((job) => job?.id && job?.title && job?.url)
    .filter((job) => {
      const locations = (job.searchableLocations || job.locations || []).join(', ');
      return job.workMode === 'remote' || isArmeniaAccessible(locations);
    })
    .filter((job) => isTechnicalRole(job.title, (job.skills || []).join(', ')))
    .map((job) => {
      const locations = (job.locations || job.searchableLocations || []).filter(Boolean);
      const location = locations.join(', ') || (job.workMode === 'remote' ? 'Remote' : '');
      const skills = (job.skills || []).filter(Boolean).slice(0, 10);

      return {
        id: `ton:${job.id}`,
        title: decodeEntities(job.title).trim(),
        company: decodeEntities(job.organization?.name || '').trim(),
        location,
        remote: job.workMode === 'remote' || /remote/i.test(location),
        url: new URL(job.url, LISTING_URL).toString(),
        source: 'TON Jobs',
        market: 'international',
        postedAt: Number(job.createdAt) * 1000 || Date.now(),
        category: ['TON ecosystem', ...skills].join(', '),
        tag: tagForRole(job.title, skills.join(', ')),
        text: [
          skills.length && `Skills: ${skills.join(', ')}`,
          job.seniority && `Seniority: ${job.seniority}`,
          location && `Candidate location: ${location}`,
        ].filter(Boolean).join('\n'),
      };
    });
};

export const fetchTonJobs = async () => {
  const res = await fetch(LISTING_URL, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`TON Jobs ${res.status}`);
  return parseTonJobs(await res.text());
};
