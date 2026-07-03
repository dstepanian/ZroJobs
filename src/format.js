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

const esc = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TAG_EMOJI = {
  dev: '💻', qa: '🧪', design: '🎨', product: '📦',
  data: '📊', devops: '⚙️', 'other-tech': '🖥️',
};

const FEATURED_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'featured.json');

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
const jobBlock = ({ title, company, location, remote, tag, summaryHy, salary, deadline, url }, marker) => {
  const who = [company, location || (remote ? 'Հեռավար' : '')].filter(Boolean).join(' · ');
  const head = `${marker} <b>${esc(title)}</b>${who ? ` — ${esc(who)}` : ''}`;
  const tail = [
    salary && `💰 ${esc(salary)}`,
    summaryHy && esc(summaryHy),
    fmtDeadline(deadline),
    url && `<a href="${esc(url)}">Դիտել →</a>`,
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

  const blocks = [
    ...loadFeatured().map((f) => jobBlock(f, '⭐')),
    ...jobs.map((j) => jobBlock(j, TAG_EMOJI[j.tag] || '🔹')),
  ];

  const footer = [];
  footer.push('➖➖➖➖➖➖➖➖➖➖');
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
