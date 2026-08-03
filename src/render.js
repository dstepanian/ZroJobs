import { createHash } from 'node:crypto';
import config from './config.js';
import { esc } from './format.js';

// Slugs must survive Armenian and Russian titles, so a short digest of the id
// carries uniqueness and the title is a best-effort readable prefix. The digest
// rather than the id itself: some boards use the full title as their id, which
// put the title in the URL twice and made it read as keyword stuffing.
export const slug = (job) => {
  const words = (job.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .filter(Boolean)
    .slice(0, 6)
    .join('-');
  const digest = createHash('sha1').update(job.id).digest('hex').slice(0, 8);
  return words ? `${words}-${digest}` : `job-${digest}`;
};

export const jobPath = (job) => `jobs/${slug(job)}.html`;
const absolute = (p) => `${config.siteBaseUrl.replace(/\/$/, '')}/${p}`;

// Salary only reaches the structured data when it parses cleanly. Our own
// formatters produce "$3,000–6,000" and "250,000 ֏"; anything a board wrote
// freehand is shown as text on the page but left out of the markup, because a
// wrong salary in Google Jobs is worse than none.
const CURRENCIES = { $: 'USD', '€': 'EUR', '֏': 'AMD' };
export const parseSalary = (raw = '') => {
  const text = raw.replace(/\s+/g, ' ').trim();
  const symbol = Object.keys(CURRENCIES).find((s) => text.includes(s));
  if (!symbol) return null;

  const numbers = [...text.matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, '')));
  if (!numbers.length || numbers.length > 2 || numbers.some((n) => !n)) return null;

  const [min, max = min] = numbers;
  if (max < min) return null;
  return { currency: CURRENCIES[symbol], min, max };
};

// Armenia is the only market this channel serves, so a remote job is remote for
// an applicant here — that's what applicantLocationRequirements has to say.
const jobLocation = (job) => {
  const city = job.location && !/^(հեռավար|remote)$/i.test(job.location) ? job.location : '';
  if (!city && job.remote) return {};
  return {
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(city ? { addressLocality: city } : {}),
        addressCountry: 'AM',
      },
    },
  };
};

const description = (job) => {
  const lines = [
    job.summaryHy,
    job.salary && `Աշխատավարձ՝ ${job.salary}`,
    job.location && `Վայրը՝ ${job.location}`,
  ].filter(Boolean).join('\n');
  return `<p>${esc(lines || job.title).replace(/\n/g, '<br>')}</p>`;
};

// https://developers.google.com/search/docs/appearance/structured-data/job-posting
export const jobPostingLd = (job) => {
  const salary = job.salary ? parseSalary(job.salary) : null;
  const remote = job.remote || job.market === 'international';
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: description(job),
    identifier: { '@type': 'PropertyValue', name: job.company || job.source, value: job.id },
    datePosted: (job.publishedAt || new Date().toISOString()).slice(0, 10),
    ...(job.deadline ? { validThrough: `${job.deadline}T23:59:59+04:00` } : {}),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company || job.source || 'Չնշված',
    },
    ...jobLocation(job),
    ...(remote
      ? {
        jobLocationType: 'TELECOMMUTE',
        applicantLocationRequirements: { '@type': 'Country', name: 'Armenia' },
      }
      : {}),
    ...(salary
      ? {
        baseSalary: {
          '@type': 'MonetaryAmount',
          currency: salary.currency,
          value: {
            '@type': 'QuantitativeValue',
            ...(salary.min === salary.max
              ? { value: salary.min }
              : { minValue: salary.min, maxValue: salary.max }),
            unitText: 'MONTH',
          },
        },
      }
      : {}),
    directApply: false,
    url: absolute(jobPath(job)),
  };
};

// JSON-LD sits inside <script>, where the only dangerous sequence is a literal
// closing tag; escaping the slash keeps the payload valid JSON either way.
const ld = (data) => JSON.stringify(data, null, 2).replace(/<\//g, '<\\/');

const layout = ({ title, description: desc, canonical, head = '', body }) => `<!doctype html>
<html lang="hy">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<style>
:root { color-scheme: light dark; --fg: #10131a; --muted: #5b6472; --line: #e3e7ee; --bg: #fff; --accent: #2563eb; }
@media (prefers-color-scheme: dark) {
  :root { --fg: #e8ebf2; --muted: #98a2b3; --line: #262b36; --bg: #0e1116; --accent: #7aa2f7; }
}
* { box-sizing: border-box; }
body { margin: 0 auto; padding: 2rem 1.25rem 4rem; max-width: 46rem; background: var(--bg); color: var(--fg);
  font: 1rem/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: var(--accent); }
header { border-bottom: 1px solid var(--line); padding-bottom: 1rem; margin-bottom: 1.5rem; }
header a { text-decoration: none; font-weight: 700; font-size: 1.15rem; color: var(--fg); }
h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 .35rem; }
.company { color: var(--muted); margin: 0 0 1.25rem; font-size: 1.05rem; }
ul.jobs { list-style: none; padding: 0; margin: 0; }
ul.jobs li { border-bottom: 1px solid var(--line); padding: .9rem 0; }
ul.jobs a { font-weight: 600; text-decoration: none; }
ul.jobs p { margin: .2rem 0 0; color: var(--muted); font-size: .92rem; }
dl { display: grid; grid-template-columns: auto 1fr; gap: .4rem 1rem; margin: 0 0 1.5rem; }
dt { color: var(--muted); }
dd { margin: 0; }
.summary { white-space: pre-line; margin: 0 0 1.75rem; }
.apply { display: inline-block; background: var(--accent); color: #fff; text-decoration: none;
  padding: .7rem 1.4rem; border-radius: .5rem; font-weight: 600; }
footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--muted); font-size: .9rem; }
</style>
${head}
</head>
<body>
<header><a href="${esc(absolute('index.html'))}">ZroJobs — IT աշխատանք Հայաստանում</a></header>
${body}
<footer>
<p>Ամեն օր նոր հայտարարություններ Telegram-ում՝ <a href="https://t.me/${esc((config.channelHandle || '').replace('@', ''))}">${esc(config.channelHandle || 'ZroJobs')}</a></p>
</footer>
</body>
</html>
`;

const factRows = (job) => [
  job.company && ['Ընկերություն', esc(job.company)],
  job.location && ['Վայրը', esc(job.location)],
  job.salary && ['Աշխատավարձ', esc(job.salary)],
  job.deadline && ['Վերջնաժամկետ', esc(job.deadline)],
  job.source && ['Աղբյուրը', esc(job.source)],
].filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('\n');

export const renderJobPage = (job) => layout({
  title: `${job.title}${job.company ? ` — ${job.company}` : ''} | ZroJobs`,
  description: (job.summaryHy || `${job.title} ${job.company || ''}`).replace(/\n/g, ' ').slice(0, 155),
  canonical: absolute(jobPath(job)),
  head: `<script type="application/ld+json">\n${ld(jobPostingLd(job))}\n</script>`,
  body: `
<h1>${esc(job.title)}</h1>
<p class="company">${esc(job.company || job.source || '')}</p>
<dl>
${factRows(job)}
</dl>
${job.summaryHy ? `<p class="summary">${esc(job.summaryHy)}</p>` : ''}
<p><a class="apply" href="${esc(job.url)}" rel="nofollow noopener" target="_blank">Դիմել</a></p>
<p><small>Հայտարարությունը հրապարակվել է ${esc((job.publishedAt || '').slice(0, 10))}։
Ամբողջական նկարագրությունը՝ գործատուի էջում։</small></p>`,
});

export const renderIndex = (jobs) => layout({
  title: 'ZroJobs — IT աշխատանք Հայաստանում',
  description: `${jobs.length} ակտիվ IT թափուր աշխատատեղ Հայաստանում և հեռավար՝ ամեն օր թարմացվող։`,
  canonical: absolute('index.html'),
  body: `
<h1>IT թափուր աշխատատեղեր</h1>
<p class="company">${jobs.length} ակտիվ հայտարարություն</p>
<ul class="jobs">
${jobs.map((job) => `<li>
  <a href="${esc(absolute(jobPath(job)))}">${esc(job.title)}</a>
  <p>${esc([job.company, job.location, job.salary].filter(Boolean).join(' · '))}</p>
</li>`).join('\n')}
</ul>`,
});

export const renderSitemap = (jobs) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[absolute('index.html'), ...jobs.map((j) => absolute(jobPath(j)))]
    .map((url) => `  <url><loc>${esc(url)}</loc></url>`).join('\n')}
</urlset>
`;

export const renderRobots = () => `User-agent: *
Allow: /
Sitemap: ${absolute('sitemap.xml')}
`;
