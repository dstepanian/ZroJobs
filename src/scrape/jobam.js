import { JOBAM_INDUSTRIES } from '../sources.js';
import { stripHtml } from '../text.js';

const LISTING_URL = 'https://job.am/en/jobs?' +
  JOBAM_INDUSTRIES.map((id) => `I=${id}`).join('&');

const UA = 'Mozilla/5.0 (compatible; zrojobs/1.0; +https://t.me/zrojobs)';
const MAX_JOBS = 35;
const ESTIMATED_RECENCY_STEP_MS = 6 * 60 * 60 * 1000;

const abs = (href = '') => new URL(href, 'https://job.am').toString();

const field = (block, label) => {
  const re = new RegExp(
    `data-original-title="${label}"[\\s\\S]*?<span class="pl-1 va-middle">([\\s\\S]*?)<\\/span>`,
    'i',
  );
  return stripHtml(block.match(re)?.[1] || '');
};

const parseDeadline = (raw = '') => {
  const s = raw.trim();
  const dotted = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const slashed = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const m = dotted || slashed;
  if (!m) return '';

  const day = dotted ? Number(m[1]) : Number(m[2]);
  const month = dotted ? Number(m[2]) : Number(m[1]);
  const year = Number(m[3]);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const get = async (url) => {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`job.am ${res.status}`);
  return res.text();
};

export const fetchJobAm = async () => {
  const html = await get(LISTING_URL);
  const cards = html.split('<div class="jobs-card"').slice(1);
  const now = Date.now();

  return cards
    .map((chunk, index) => {
      const block = `<div class="jobs-card"${chunk}`;
      const href = block.match(/job-titlelink[^>]+href=['"]([^'"]+)['"]/i)?.[1];
      const id = href?.match(/-(\d+)(?:\?.*)?$/)?.[1];
      const title = stripHtml(block.match(/job-titlelink[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '');
      const company = stripHtml(block.match(/<span class="company[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '');
      const location = field(block, 'City');
      const deadlineRaw = field(block, 'Deadline');
      const salary = field(block, 'Salary');

      if (!id || !href || !title) return null;

      return {
        id: `jobam:${id}`,
        title,
        company,
        location,
        remote: /remote|հեռավար|удал[её]нн/i.test(block),
        url: abs(href),
        source: 'job.am',
        // job.am listings expose deadline, not publication date. The page is
        // ordered by recency, so stagger the first page to keep it fresh without
        // letting undated listings dominate every run forever.
        postedAt: now - (index * ESTIMATED_RECENCY_STEP_MS),
        postedAtEstimated: true, // not a real date — never stamp it 🆕
        category: 'job.am IT/product',
        salary,
        deadline: parseDeadline(deadlineRaw),
        text: [
          title,
          company && `Company: ${company}`,
          location && `Location: ${location}`,
          salary && `Salary: ${salary}`,
          deadlineRaw && `Deadline: ${deadlineRaw}`,
        ].filter(Boolean).join('\n'),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_JOBS);
};

// The listing card carries no description at all — only the detail page has the
// duties/requirements the summarizer needs, so picked jobs get one fetch each.
// The description goes first: the summary prompt only reads the opening chars.
const DESCRIPTION_RE =
  /<div class="about-container job-descr work-description[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i;

export const parseJobAmDescription = (html) =>
  stripHtml(html.match(DESCRIPTION_RE)?.[1] || '').replace(/^Նկարագրություն\s*/, '');

// Callers treat a failure as "no enrichment", never as a fatal error.
export const enrichJobAmJob = async (job) => {
  const description = parseJobAmDescription(await get(job.url));
  if (!description) return job;
  return { ...job, text: [description.slice(0, 1500), job.text].filter(Boolean).join('\n') };
};
