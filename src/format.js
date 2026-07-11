import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';

const MONTHS_HY = [
  'հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի',
  'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի',
];

// Today's date in Yerevan, e.g. "2 հուլիսի".
export const yerevanDate = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Yerevan', day: 'numeric', month: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day').value;
  const month = Number(parts.find((p) => p.type === 'month').value);
  return `${day} ${MONTHS_HY[month - 1]}`;
};

// Today's calendar date in Yerevan as YYYY-MM-DD (used as the seen.json value).
export const yerevanISO = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yerevan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

export const esc = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TAG_EMOJI = {
  dev: '💻', qa: '🧪', design: '🎨', product: '📦',
  data: '📊', devops: '⚙️', 'other-tech': '🖥️',
};

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEATURED_FILE = path.join(ROOT, 'featured.json');
const COMPANIES_FILE = path.join(ROOT, 'companies.json');

// Load the (hand-edited) company spotlight queue, dropping any entry whose
// "until" date has passed — same expiry rule as featured listings.
export const loadCompanies = () => {
  try {
    const data = JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf8'));
    const today = yerevanISO();
    return (Array.isArray(data) ? data : []).filter((c) => !c.until || c.until >= today);
  } catch {
    return [];
  }
};

// ISO-8601 week number in Yerevan. Drives stateless weekly rotation so the
// spotlight needs no committed cursor file.
export const yerevanWeek = (d = new Date()) => {
  const iso = yerevanISO(d);
  const [y, m, day] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, day);
  const date = new Date(t);
  // Shift to the Thursday of this week, then count weeks from Jan 1.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};

// Monotonic day counter (days since epoch, Yerevan). Drives stateless daily
// rotation for the "Company of the day" footer.
const yerevanDayIndex = (d = new Date()) => {
  const [y, m, day] = yerevanISO(d).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, day) / 86400000);
};

// The company featured in today's digest footer: rotates daily through the
// hand-curated queue, limited to entries with a verified one-line `factHy`.
export const companyOfDay = (d = new Date()) => {
  const pool = loadCompanies().filter((c) => c.factHy);
  if (!pool.length) return null;
  return pool[yerevanDayIndex(d) % pool.length];
};

// Paid listings, hand-edited: [{ title, company, location, summaryHy, url, until }].
// An entry disappears automatically once its "until" date (YYYY-MM-DD) passes.
export const loadFeatured = () => {
  try {
    const data = JSON.parse(fs.readFileSync(FEATURED_FILE, 'utf8'));
    const today = yerevanISO();
    return (Array.isArray(data) ? data : []).filter((f) => !f.until || f.until >= today);
  } catch {
    return [];
  }
};

// "2026-07-31" -> "մինչև հուլիսի 31-ը", but only when the deadline is close
// enough to be an urgency signal rather than noise.
const DEADLINE_SOON_DAYS = 14;
const fmtDeadline = (iso) => {
  if (!iso) return '';
  const days = (Date.parse(iso) - Date.now()) / (24 * 60 * 60 * 1000);
  if (!(days >= 0 && days <= DEADLINE_SOON_DAYS)) return '';
  const [, m, d] = iso.split('-').map(Number);
  return `մինչև ${MONTHS_HY[m - 1]} ${d}-ը`;
};

// One job entry: title line, then a detail line with salary, one-line Armenian
// summary, near deadlines and the apply link.
const jobBlock = ({ title, company, location, remote, tag, summaryHy, salary, deadline, url, source }, marker) => {
  const who = [company, location || (remote ? 'Հեռավար' : '')].filter(Boolean).join(' · ');
  // Title itself is the link (Telegram renders it in the accent color); a single
  // ↗ glyph signals it's tappable without repeating "Դիտել →" on every row.
  const titleHtml = url
    ? `<a href="${esc(url)}"><b>${esc(title)} ↗</b></a>`
    : `<b>${esc(title)}</b>`;
  const head = `${marker} ${titleHtml}${who ? ` — ${esc(who)}` : ''}`;
  const tail = [
    salary && `💰 ${esc(salary)}`,
    summaryHy && esc(summaryHy),
    fmtDeadline(deadline),
    source === 'Remotive' && 'Remotive',
  ].filter(Boolean).join(' · ');
  return tail ? `${head}\n      ${tail}` : head;
};

// Telegram text messages cap at 4096 chars; leave slack for the entities overhead.
const TEXT_LIMIT = 3900;

// Build the daily digest (HTML parse mode). Featured (paid) listings render
// first with a star; curated jobs follow with a per-category emoji.
export const formatDigest = (jobs, { date } = {}) => {
  const out = [];
  out.push(`💼 <b>Օրվա IT աշխատատեղերը — ${date || yerevanDate()}</b>`);
  out.push('');

  const international = jobs.filter((j) => j.market === 'international');
  const armenia = jobs.filter((j) => j.market !== 'international');
  const blocks = [
    ...loadFeatured().map((f) => jobBlock(f, '⭐')),
    ...(international.length
      ? [
        '🌍 <b>Միջազգային / հեռավար աշխատատեղեր</b>',
        ...international.map((j) => jobBlock(j, '🌍')),
      ]
      : []),
    ...(armenia.length
      ? [
        '🇦🇲 <b>Հայաստանի աշխատատեղեր</b>',
        ...armenia.map((j) => jobBlock(j, TAG_EMOJI[j.tag] || '🔹')),
      ]
      : []),
  ];

  const footer = [];
  footer.push('➖➖➖➖➖➖➖➖➖➖');
  // "Company of the day": a light, verified one-liner riding along in the footer
  // — Armenian-IT-ecosystem discovery without spending a separate notification.
  const cod = companyOfDay();
  if (cod) {
    const name = cod.url
      ? `<a href="${esc(cod.url)}"><b>${esc(cod.name)}</b></a>`
      : `<b>${esc(cod.name)}</b>`;
    footer.push(`🏢 Օրվա ընկերությունը՝ ${name} — ${esc(cod.factHy)}`);
    footer.push('');
  }
  const promo = config.promoContact
    ? `  |  Առաջխաղացում՝ ${esc(config.promoContact)}`
    : '';
  const handle = config.channelHandle ? `  |  ${esc(config.channelHandle)}` : '';
  footer.push(`⚡ <b>${esc(config.siteUrl)}</b>${handle}${promo}`);

  // Add job blocks until the message would blow the Telegram limit.
  const footerLen = footer.join('\n').length;
  for (const block of blocks) {
    const current = out.join('\n').length;
    if (current + block.length + footerLen + 4 > TEXT_LIMIT) break;
    out.push(block);
    out.push('');
  }

  out.push(...footer);
  return out.join('\n');
};

// Telegram photo captions cap at 1024 chars; keep blurbs short.
const CAPTION_LIMIT = 1000;

// Build the "Employer of the week" photo caption (HTML). The title links to the
// company when a url is given; the blurb is trimmed to fit the caption cap.
export const formatSpotlight = ({ name, blurbHy, url }) => {
  const title = url
    ? `<a href="${esc(url)}"><b>${esc(name)}</b></a>`
    : `<b>${esc(name)}</b>`;
  const out = ['🏢 <b>Այս շաբաթվա գործատուն</b>', '', title];
  if (blurbHy) {
    let blurb = blurbHy.trim();
    if (blurb.length > CAPTION_LIMIT - 120) blurb = `${blurb.slice(0, CAPTION_LIMIT - 121).trimEnd()}…`;
    out.push('', esc(blurb));
  }
  out.push('', `⚡ <b>${esc(config.siteUrl)}</b>${config.channelHandle ? `  |  ${esc(config.channelHandle)}` : ''}`);
  return out.join('\n');
};
