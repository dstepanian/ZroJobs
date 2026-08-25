import { createHash } from 'node:crypto';
import config from './config.js';
import { esc } from './format.js';
import { ABOUT } from './about.js';
import { CHANNELS, PORTFOLIO, sameAsOf, siblingsOf, telegramUrl } from './siblings.js';

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

// On a domain root the home page has two URLs — "/" and "/index.html" — and
// serving identical bytes at both splits the page's own ranking signal. Every
// internal reference to the home page goes through "/" instead.
const home = () => `${config.siteBaseUrl.replace(/\/$/, '')}/`;

// Salary only reaches the structured data when it parses cleanly. Our own
// formatters produce "$3,000–6,000" and "250,000 ֏"; anything a board wrote
// freehand is shown as text on the page but left out of the markup, because a
// wrong salary in Google Jobs is worse than none.
// Written as about/index.html so the public URL is a clean /about/ — the same
// reason the home page is referenced as "/" rather than "/index.html".
export const aboutPath = 'about/index.html';
const aboutUrl = () => absolute('about/');

// This channel's own entry in the shared registry — the same object the Telegram
// footer rotates through, so the handle on the site and the handle in the post
// can never drift apart. It is also the fallback when CHANNEL_HANDLE is unset,
// which previously defaulted to a handle that is not this channel.
const me = CHANNELS[ABOUT.self];
const ownHandle = () => config.channelHandle || me.handle;
const channelUrl = () => `https://t.me/${ownHandle().replace('@', '')}`;

// One Organization node for the whole site. `sameAs` is the load-bearing part:
// it is what tells a search engine that this domain, the Telegram handle, the
// portfolio and the two sibling sites are one entity rather than five pages that
// happen to share a word.
export const organizationLd = () => ({
  '@type': 'Organization',
  '@id': `${home()}#channel`,
  name: me.name,
  alternateName: me.handle,
  url: home(),
  description: ABOUT.leadEn,
  inLanguage: 'hy',
  areaServed: 'AM',
  sameAs: sameAsOf(ABOUT.self),
});

export const websiteLd = () => ({
  '@type': 'WebSite',
  '@id': `${home()}#website`,
  name: `${me.name} — ${ABOUT.descriptionHy}`,
  url: home(),
  inLanguage: 'hy',
  publisher: { '@id': `${home()}#channel` },
});

// FAQPage over the Armenian Q&A. Each pair is written to stand alone, because a
// retrieval system quotes the answer without the question's surrounding page.
export const faqLd = () => ({
  '@type': 'FAQPage',
  '@id': `${aboutUrl()}#faq`,
  inLanguage: 'hy',
  mainEntity: ABOUT.faqHy.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
});

const graph = (...nodes) => ({ '@context': 'https://schema.org', '@graph': nodes });

// Two outbound links per page to the sibling subdomains. Three sites that never
// reference each other are three unrelated one-page domains as far as a crawler
// is concerned; linked, they are one small property with a shared publisher.
const siblingFooter = () => `<p>Քույր ալիքներ՝ ${siblingsOf(ABOUT.self).map((c) =>
  `<a href="${esc(`${c.site}/`)}">${esc(c.name)} ${esc(c.handle)}</a> — ${esc(c.blurbHy)}`)
  .join(' · ')}</p>`;

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
<header><a href="${esc(home())}">ZroJobs — աշխատանք Հայաստանում</a></header>
${body}
<footer>
<p>Ամեն օր նոր հայտարարություններ Telegram-ում՝ <a href="${esc(channelUrl())}">${esc(ownHandle())}</a> ·
<a href="${esc(aboutUrl())}">Ալիքի մասին</a></p>
${siblingFooter()}
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
  title: 'ZroJobs — աշխատանք Հայաստանում',
  head: `<script type="application/ld+json">
${ld(graph(organizationLd(), websiteLd()))}
</script>`,
  description: `${jobs.length} ակտիվ թափուր աշխատատեղ Հայաստանում և հեռավար՝ ամեն օր թարմացվող։`,
  canonical: home(),
  body: `
<h1>Թափուր աշխատատեղեր</h1>
<p class="company">${jobs.length} ակտիվ հայտարարություն</p>
<ul class="jobs">
${jobs.map((job) => `<li>
  <a href="${esc(absolute(jobPath(job)))}">${esc(job.title)}</a>
  <p>${esc([job.company, job.location, job.salary].filter(Boolean).join(' · '))}</p>
</li>`).join('\n')}
</ul>`,
});

// The one page on the site that describes the channel in prose rather than
// listing a vacancy. Bilingual on purpose: the Armenian half is for readers, the
// English half is so the same facts are retrievable when the question is asked
// in English, which is how most of these questions actually get typed.
export const renderAbout = () => layout({
  title: `${ABOUT.titleHy} | ${me.name}`,
  description: ABOUT.descriptionHy,
  canonical: aboutUrl(),
  head: `<script type="application/ld+json">
${ld(graph(organizationLd(), websiteLd(), faqLd()))}
</script>`,
  body: `
<h1>${esc(ABOUT.titleHy)}</h1>
<p>${esc(ABOUT.leadHy)}</p>
<p><a href="${esc(channelUrl())}"><strong>${esc(ownHandle())}</strong> — բաժանորդագրվել Telegram-ում</a></p>
${ABOUT.sectionsHy.map((sec) => `<h2>${esc(sec.h)}</h2>
<p>${esc(sec.p)}</p>`).join('\n')}

<h2>Հաճախ տրվող հարցեր</h2>
${ABOUT.faqHy.map((item) => `<article>
<h3>${esc(item.q)}</h3>
<p>${esc(item.a)}</p>
</article>`).join('\n')}

<h2>Քույր ալիքները</h2>
<ul class="jobs">
${siblingsOf(ABOUT.self).map((c) => `<li><a href="${esc(`${c.site}/`)}">${esc(c.name)} ${esc(c.handle)}</a>
  <p>${esc(c.blurbHy)}</p></li>`).join('\n')}
</ul>

<section lang="en">
<h2>${esc(ABOUT.titleEn)}</h2>
<p>${esc(ABOUT.leadEn)}</p>
<p>${esc(ABOUT.audienceEn)}</p>
<ul class="jobs">
${[CHANNELS[ABOUT.self], ...siblingsOf(ABOUT.self)].map((c) => `<li><a href="${esc(telegramUrl(c))}">${esc(c.name)} ${esc(c.handle)}</a>
  <p>${esc(c.blurbEn)}</p></li>`).join('\n')}
</ul>
<p>Published by <a href="${esc(PORTFOLIO)}">zromek.de</a>.</p>
</section>`,
});

export const renderSitemap = (jobs) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[home(), aboutUrl(), ...jobs.map((j) => absolute(jobPath(j)))]
    .map((url) => `  <url><loc>${esc(url)}</loc></url>`).join('\n')}
</urlset>
`;

// Every crawler that matters, named explicitly.
//
// `User-agent: *` already allows all of them, so this looks redundant — it isn't.
// A bot that finds its own name in robots.txt obeys that group and ignores the
// wildcard entirely, so naming them makes the permission survive any future edit
// to the wildcard group. Google-Extended is the load-bearing one: it has no
// crawler of its own and exists purely as a token controlling whether Gemini and
// AI Overviews may use what Googlebot already fetched. Silence there is not the
// same as yes for every surface, and being quotable in an AI answer is the point.
const CRAWLERS = [
  'Googlebot', 'Google-Extended', 'Bingbot',
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'PerplexityBot', 'Perplexity-User',
  'Applebot', 'Applebot-Extended',
  'CCBot', 'Amazonbot', 'meta-externalagent', 'DuckAssistBot',
];

export const renderRobots = () => `${['*', ...CRAWLERS]
  .map((ua) => `User-agent: ${ua}\nAllow: /`)
  .join('\n\n')}

Sitemap: ${absolute('sitemap.xml')}
`;

// https://llmstxt.org — a plain-language map of the site for a model reading it
// directly rather than through a search index. The site is dozens of vacancy
// pages that each describe one role; this is the one file that says what the
// channel is and which handle the vacancies come from, without HTML in the way.
export const renderLlms = (jobs) => `# ${me.name}

> ${ABOUT.leadEn}

${ABOUT.audienceEn}

- Telegram: ${me.handle} (${telegramUrl(me)})
- Language: Armenian (hy)
- Publisher: zromek.de (${PORTFOLIO})
- Open vacancies right now: ${jobs.length}

## About

- [${ABOUT.titleEn}](${aboutUrl()}): what the channel is, who it is for, how to submit a vacancy, in Armenian and English.

## Sister channels

${siblingsOf(ABOUT.self).map((c) => `- [${c.name} ${c.handle}](${c.site}/): ${c.blurbEn}. Telegram: ${telegramUrl(c)}`).join('\n')}

## Open vacancies

${jobs.slice(0, 50).map((job) => `- [${job.title}](${absolute(jobPath(job))}): ${[job.company, job.location, job.salary].filter(Boolean).join(' · ')}`).join('\n')}
`;
