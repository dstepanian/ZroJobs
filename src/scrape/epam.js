import { stripHtml } from '../text.js';
import { tagForRole } from './remoteScope.js';

const LISTING_URL = 'https://careers.epam.com/en/jobs/armenia';
const BASE_URL = 'https://careers.epam.com';
const UA = 'Mozilla/5.0 (compatible; zrojobs/1.0; +https://t.me/zrojobs)';
const ACTIVE_LISTING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const nextData = (html) => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!match) throw new Error('EPAM: __NEXT_DATA__ not found (page layout changed?)');
  return JSON.parse(match[1])?.props?.pageProps;
};

export const parseEpamJobs = (html) => {
  const jobs = nextData(html)?.jobs?.jobs || [];

  return jobs
    .filter((job) => job?.uid && job?.name && job?.seo?.url)
    .filter((job) => (job.country || []).some((country) => country?.name === 'Armenia'))
    .map((job) => {
      const mode = (job.vacancy_type || '').trim();
      const skills = (job.skills || []).filter(Boolean).slice(0, 12);
      const location = mode ? `${mode} in Armenia` : 'Armenia';
      const details = job.category || {};

      return {
        id: `epam:${job.uid}`,
        title: job.name.trim(),
        company: 'EPAM',
        location,
        remote: /remote/i.test(mode),
        url: new URL(job.seo.url, BASE_URL).toString(),
        source: 'EPAM',
        postedAt: Date.parse(job.created_at || job.updated_at || '') || Date.now(),
        // EPAM's official page contains active vacancies, and many were bulk
        // published on the same day. Keep them eligible longer than ordinary
        // local-board posts; seen.json still prevents repeat publication.
        candidateWindowMs: ACTIVE_LISTING_WINDOW_MS,
        category: [job.primary_skill, job.seniority].filter(Boolean).join(', '),
        tag: tagForRole(job.name, `${job.primary_skill || ''} ${skills.join(', ')}`),
        text: [
          stripHtml(job.description || '').slice(0, 900),
          skills.length && `Skills: ${skills.join(', ')}`,
          job.seniority && `Seniority: ${job.seniority}`,
          (details.requirements || []).slice(0, 5).join('; '),
        ].filter(Boolean).join('\n'),
      };
    });
};

export const fetchEpam = async () => {
  const res = await fetch(LISTING_URL, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`EPAM ${res.status}`);
  return parseEpamJobs(await res.text());
};
