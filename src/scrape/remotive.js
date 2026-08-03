import { decodeEntities, stripHtml } from '../text.js';
import { isArmeniaAccessible, tagForRole } from './remoteScope.js';

// Remotive publishes a public JSON feed for sharing remote jobs, with the
// original Remotive link kept on every listing. Keep only technical categories
// and locations broad enough to be realistic for candidates in Armenia.
const API_URL = 'https://remotive.com/api/remote-jobs?limit=200';
const MAX_JOBS = 60;
const TECH_CATEGORY = /software development|design|product|devops|data science|data and analytics|quality assurance|\bqa\b|artificial intelligence|information technology/i;
export const fetchRemotive = async () => {
  const res = await fetch(API_URL, {
    headers: { 'user-agent': 'zrojobs/1.0 (+https://t.me/zrojobs)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Remotive ${res.status}`);

  const data = await res.json();
  return (Array.isArray(data?.jobs) ? data.jobs : [])
    .filter((job) => job?.id && job?.url && job?.title)
    .filter((job) => TECH_CATEGORY.test(job.category || ''))
    .filter((job) => isArmeniaAccessible(job.candidate_required_location || ''))
    .map((job) => {
      const scope = (job.candidate_required_location || '').trim();
      const description = stripHtml(job.description || '');
      return {
        id: `remotive:${job.id}`,
        title: decodeEntities(job.title).trim(),
        company: decodeEntities(job.company_name || '').trim(),
        location: scope || 'Remote',
        remote: true,
        url: job.url,
        source: 'Remotive',
        market: 'international',
        postedAt: Date.parse(job.publication_date || '') || Date.now(),
        category: job.category,
        tag: tagForRole(job.title, job.category),
        // Remotive writes salaries HTML-encoded ("&#036;120 - &#036;170 /hour").
        salary: decodeEntities(job.salary || '').trim(),
        text: [
          description.slice(0, 1400),
          scope && `Candidate location: ${scope}`,
          job.job_type && `Job type: ${job.job_type}`,
        ].filter(Boolean).join('\n'),
      };
    })
    .slice(0, MAX_JOBS);
};
