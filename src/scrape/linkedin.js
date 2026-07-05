import { LINKEDIN_QUERIES } from '../sources.js';
import { stripHtml } from '../text.js';

const BASE_URL = 'https://www.linkedin.com/jobs/search/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const MAX_PER_QUERY = 12;
const MAX_TOTAL = 45;

const searchUrl = (keywords) => {
  const url = new URL(BASE_URL);
  url.searchParams.set('keywords', keywords);
  url.searchParams.set('location', 'Yerevan, Armenia');
  url.searchParams.set('f_TPR', 'r604800');
  return url.toString();
};

const cleanUrl = (href = '') => {
  const url = new URL(href.replace(/&amp;/g, '&'));
  url.search = '';
  return url.toString();
};

const field = (block, className) => stripHtml(
  block.match(new RegExp(`<[^>]+class="${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'))?.[1] || '',
);

const parsePage = (html, query) => html
  .split('data-entity-urn="urn:li:jobPosting:')
  .slice(1)
  .map((chunk) => {
    const id = chunk.match(/^(\d+)/)?.[1];
    const block = chunk.split('</li>')[0];
    const href = block.match(/href="([^"]+)"/i)?.[1];
    const title = field(block, 'base-search-card__title');
    const company = field(block, 'base-search-card__subtitle');
    const location = field(block, 'job-search-card__location');
    const listedAt = block.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] || '';

    if (!id || !href || !title) return null;

    const searchable = `${title}\n${location}\n${block}`;
    return {
      id: `linkedin:${id}`,
      title,
      company,
      location,
      remote: /remote|hybrid/i.test(searchable),
      url: cleanUrl(href),
      source: 'LinkedIn',
      postedAt: Date.parse(listedAt) || Date.now(),
      category: query,
      text: [
        title,
        company && `Company: ${company}`,
        location && `Location: ${location}`,
        query && `LinkedIn search: ${query}`,
      ].filter(Boolean).join('\n'),
    };
  })
  .filter(Boolean)
  .slice(0, MAX_PER_QUERY);

export const fetchLinkedIn = async () => {
  const pages = await Promise.all(LINKEDIN_QUERIES.map(async (query) => {
    try {
      const res = await fetch(searchUrl(query), {
        headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`LinkedIn ${res.status}`);
      return parsePage(await res.text(), query);
    } catch (e) {
      console.warn(`[zrojobs] LinkedIn query "${query}" failed: ${e.message}`);
      return [];
    }
  }));

  const unique = new Map();
  for (const job of pages.flat()) {
    if (!unique.has(job.id)) unique.set(job.id, job);
  }

  return [...unique.values()]
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, MAX_TOTAL);
};
