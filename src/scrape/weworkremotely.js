import { stripHtml } from '../text.js';
import { isArmeniaAccessible, isTechnicalRole, tagForRole } from './remoteScope.js';

const FEEDS = [
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-product-jobs.rss',
  'https://weworkremotely.com/categories/remote-design-jobs.rss',
  'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
];
const UA = 'Mozilla/5.0 (compatible; zrojobs/1.0; +https://t.me/zrojobs)';
const MAX_JOBS = 60;

const decodeXml = (value = '') => value
  .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;|&#0?39;/g, "'")
  .replace(/&amp;/g, '&')
  .trim();

const field = (item, name) => decodeXml(
  item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '',
);

const splitTitle = (value) => {
  const separator = value.indexOf(': ');
  if (separator < 1) return { company: '', title: value.trim() };
  return {
    company: value.slice(0, separator).trim(),
    title: value.slice(separator + 2).trim(),
  };
};

export const parseWwrFeed = (xml) => xml
  .match(/<item>[\s\S]*?<\/item>/gi)?.map((item) => {
    const combinedTitle = field(item, 'title');
    const { company, title } = splitTitle(combinedTitle);
    const region = field(item, 'region');
    const category = field(item, 'category');
    const link = field(item, 'link') || field(item, 'guid');
    const description = stripHtml(decodeXml(field(item, 'description')));
    const skills = field(item, 'skills');
    const type = field(item, 'type');

    if (!title || !link || !isArmeniaAccessible(region)) return null;
    if (!isTechnicalRole(title, category)) return null;

    const slug = new URL(link).pathname.split('/').filter(Boolean).pop();
    return {
      id: `wwr:${slug}`,
      title,
      company,
      location: region || 'Remote',
      remote: true,
      url: link,
      source: 'We Work Remotely',
      market: 'international',
      postedAt: Date.parse(field(item, 'pubDate')) || Date.now(),
      category,
      tag: tagForRole(title, category),
      text: [
        description.slice(0, 1400),
        skills && `Skills: ${skills}`,
        region && `Candidate location: ${region}`,
        type && `Job type: ${type}`,
      ].filter(Boolean).join('\n'),
    };
  }).filter(Boolean) || [];

export const fetchWeWorkRemotely = async () => {
  const pages = await Promise.all(FEEDS.map(async (url) => {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseWwrFeed(await res.text());
    } catch (error) {
      console.warn(`[zrojobs] WWR feed failed (${url}): ${error.message}`);
      return [];
    }
  }));

  const unique = new Map();
  for (const job of pages.flat()) {
    if (!unique.has(job.id)) unique.set(job.id, job);
  }
  return [...unique.values()]
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, MAX_JOBS);
};
