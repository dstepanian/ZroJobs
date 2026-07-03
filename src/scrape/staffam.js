import { STAFFAM_CATEGORIES } from '../sources.js';
import { stripHtml } from '../text.js';

// staff.am has no RSS, but it's a Next.js app: both the listing page and the
// job detail pages embed their data as JSON in the __NEXT_DATA__ script tag,
// so we parse that instead of the (heavily inlined-style) HTML. One listing
// request with repeated ?category= params covers every tech category at once.
const LISTING_URL = 'https://staff.am/en/jobs?' +
  STAFFAM_CATEGORIES.map((id) => `category=${id}`).join('&');

const UA = 'Mozilla/5.0 (compatible; zrojobs/1.0; +https://t.me/zrojobs)';

const nextData = (html) => {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!m) throw new Error('staff.am: __NEXT_DATA__ not found (page layout changed?)');
  return JSON.parse(m[1])?.props?.pageProps;
};

const get = async (url) => {
  const res = await fetch(url, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`staff.am ${res.status}`);
  return nextData(await res.text());
};

export const fetchStaffAm = async () => {
  const jobs = (await get(LISTING_URL))?.jobs || [];
  return jobs
    // The list interleaves ads/injected items that have no category or slug.
    .filter((j) => j?.id && j?.category?.code && j?.slug?.en)
    .map((j) => ({
      id: `staffam:${j.id}`,
      title: (j.title?.en || j.title?.am_en || '').trim(),
      company: (j.companiesStruct?.title?.en || '').trim(),
      location: (j.job_city?.title?.en || '').trim(),
      remote: !!j.is_remote,
      url: `https://staff.am/en/jobs/${j.category.code}/${j.slug.en}`,
      source: 'staff.am',
      // "2026-07-01 20:56:49" — precision beyond the day doesn't matter here.
      postedAt: Date.parse(j.activated_at?.staffam || '') || Date.now(),
      category: j.category.code,
      deadline: j.deadline || '',
    }))
    .filter((j) => j.title);
};

// "3000/6000 USD" -> "$3,000–6,000"; AMD renders with a trailing ֏.
const fmtSalary = (d) => {
  const free = (d.salary?.en || d.salary?.am || '').trim();
  const from = Number(d.salary_from) || 0;
  const to = Number(d.salary_to) || 0;
  if (!from && !to) return free;
  const n = (x) => x.toLocaleString('en-US');
  const range = from && to && from !== to ? `${n(from)}–${n(to)}` : n(from || to);
  const cur = d.salary_currency || '';
  if (cur === 'AMD') return `${range} ֏`;
  const sym = { USD: '$', EUR: '€' }[cur];
  return sym ? `${sym}${range}` : `${range} ${cur}`.trim();
};

// Fetch one job's detail page and attach the fields the digest actually uses:
// description text for the summarizer, plus salary/level shown directly.
// Callers treat a failure as "no enrichment", never as a fatal error.
export const enrichStaffAmJob = async (job) => {
  const d = (await get(job.url))?.job;
  if (!d) return job;

  const en = (o) => (o?.en || o?.am || o?.ru || '').trim();
  const skills = (d.skills || []).map((s) => s.title?.en).filter(Boolean).join(', ');
  const level = d.job_candidate_level?.title?.en || '';
  const text = [
    stripHtml(en(d.description)).slice(0, 900),
    stripHtml(en(d.required_qualifications)).slice(0, 900),
    skills && `Skills: ${skills}`,
    level && `Level: ${level}`,
  ].filter(Boolean).join('\n');

  return {
    ...job,
    text,
    salary: fmtSalary(d),
    deadline: d.deadline || job.deadline || '',
  };
};
