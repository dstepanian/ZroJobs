import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';
import { promoLines, channelOf } from './siblings.js';
import { fieldOf, roleOf } from './taxonomy.js';
import { decodeEntities } from './text.js';

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

// Strip the HTML we send to Telegram so dry-run previews read like the post.
// Entities are decoded as well as tags: a title like "Product & Design" is sent
// correctly as "Product &amp; Design" and Telegram renders the ampersand, so a
// preview that printed the escape would be reporting a bug that isn't there.
// The preview only earns its keep if it shows what subscribers actually see.
export const plain = (s = '') =>
  decodeEntities(s.replace(/<\/?b>|<a [^>]*>|<\/a>/g, ''));

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

// Location strings that only say "this job is remote" — they carry no place, so
// the post shows "Հեռավար" instead of repeating them.
const PLACELESS = /^\s*(հեռավար|remote|anywhere.*|worldwide|global|international|work from home)\s*$/i;

// A vacancy counts as remote when the scraper said so, when it came from an
// international board, or when the location is one of those markers.
const isRemote = (job) =>
  !!job.remote || job.market === 'international' || PLACELESS.test(job.location || '');

// Telegram only indexes hashtags made of letters, digits and underscores, and
// ignores ones starting with a digit — drop anything that can't be searched.
const hashtag = (s) => {
  const word = (s || '').trim().replace(/[\s\-/]+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '');
  return word && !/^\d/.test(word) ? `#${word}` : '';
};

// Cities are tagged in Armenian whatever language the source wrote them in, so
// one tag collects every posting for a city. Matched loosely on purpose: job.am
// writes districts ("Kanaker-Zeytun, Yerevan"), which still belong to #Երևան.
const CITIES_HY = [
  [/yerevan|երևան|ереван/i, 'Երևան'],
  [/gyumri|գյումրի|гюмри/i, 'Գյումրի'],
  [/vanadzor|վանաձոր|ванадзор/i, 'Վանաձոր'],
  [/armavir|արմավիր/i, 'Արմավիր'],
  [/abovyan|աբովյան/i, 'Աբովյան'],
  [/hrazdan|հրազդան/i, 'Հրազդան'],
  [/dilijan|դիլիջան/i, 'Դիլիջան'],
  [/ijevan|իջևան/i, 'Իջևան'],
  [/kapan|կապան/i, 'Կապան'],
];

// #junior / #middle / #senior, but only when the level is actually stated —
// the title first, then the "Level:"/"Seniority:" line detail pages carry.
const seniorityOf = ({ title = '', text = '' }) => {
  const stated = (text.match(/^(?:Level|Seniority):\s*(.+)$/mi) || [])[1] || '';
  for (const src of [title, stated]) {
    if (/\b(senior|sr\.?|lead|principal|staff|head|architect)\b/i.test(src)) return 'senior';
    if (/\b(middle|mid|mid-level)\b/i.test(src)) return 'middle';
    if (/\b(junior|jr\.?|intern|trainee|entry[- ]level)\b/i.test(src)) return 'junior';
  }
  return '';
};

// Hashtags are how a job stays findable after its notification scrolls away:
// the field it belongs to, then the role, the location, and the level when we
// know it. #IT alone used to do all of that work, which made a channel posting
// 10-20 vacancies a day one undifferentiated stream. The field hashtag is also
// what keeps the two feeds separable now that marketing shares the channel: a
// reader who only wants IT can follow #IT and never see the rest.
export const hashtags = (job) => {
  const tags = [fieldOf(job.tag).hashtag];
  const role = roleOf(job.tag).hashtag;
  if (role) tags.push(role);
  const remote = isRemote(job);
  const location = (job.location || '').trim();
  const city = CITIES_HY.find(([re]) => re.test(location))?.[1];
  if (city) tags.push(`#${city}`);
  else if (!remote && !/[,\s]/.test(location)) {
    // Unmapped single-word place (Sisian, Berd...). Multi-word strings would
    // only produce a tag nobody will ever search for.
    const other = hashtag(location);
    if (other) tags.push(other);
  }
  if (remote) tags.push('#remote');
  const level = seniorityOf(job);
  if (level) tags.push(`#${level}`);
  return tags.join(' ');
};

// Where the job is: city, "Հեռավար", or both. International boards are credited
// here too, since that's the only place their name still fits.
const CREDITED_SOURCES = ['Remotive', 'TON Jobs', 'We Work Remotely'];
const whereLine = (job) => {
  const location = (job.location || '').trim();
  const bits = [PLACELESS.test(location) ? '' : location, isRemote(job) && 'Հեռավար'].filter(Boolean);
  if (CREDITED_SOURCES.includes(job.source)) bits.push(job.source);
  return bits.length ? `📍 ${esc(bits.join(' · '))}` : '';
};

// A standalone post can afford a few bullets, but a card still has to be
// scannable in the notification preview.
const SUMMARY_LIMIT = 450;
const clip = (s, limit) => (s.length > limit ? `${s.slice(0, limit - 1).trimEnd()}…` : s);

// Shared body of every vacancy post: salary, where, deadline, the Armenian
// bullets. The apply link lives in the inline button, not in the text.
const detailLines = (job) => [
  // Free-text salaries arrive with stray double spaces from the boards.
  job.salary && `💰 ${esc(job.salary.replace(/\s+/g, ' ').trim())}`,
  whereLine(job),
  fmtDeadline(job.deadline) && `⏳ ${fmtDeadline(job.deadline)}`,
  // What the job is about, in Armenian, for cards the summarizer couldn't fill.
  // Better a category than a post that is nothing but a title.
  job.summaryHy
    ? esc(clip(job.summaryHy.trim(), SUMMARY_LIMIT))
    : job.tag && `🏷 ${roleOf(job.tag).hy}`,
].filter(Boolean).join('\n');

// Role + company, both bold. Sections are joined blank-line-separated and empty
// ones dropped, so a bare posting never leaves a hole in the message.
// Forwarding is this channel's growth engine, but a forward only carries
// attribution while Telegram's "Forwarded from" header survives — and most of
// the spread here is screenshots into WhatsApp and Viber groups, which carry
// nothing at all. The handle rides along on the hashtag line so a screenshot is
// still a path back to the channel. Own handle only: a vacancy post is the
// wrong place for a sibling-channel pitch, since it goes out 10-20× a day.
const tagLine = (job) => {
  const own = config.channelHandle || channelOf('jobs')?.handle || '';
  const tags = hashtags(job);
  return own ? `${tags} · ${esc(own)}` : tags;
};

const fieldLabel = (job) => {
  const field = fieldOf(job.tag);
  return field.labelHy ? `${field.labelEmoji} <b>${field.labelHy}</b>` : '';
};

const postBody = (job, head) => [
  // The field label, on the fields that have one. Only marketing does: IT is
  // what subscribers already expect from this channel, so it stays unlabelled
  // and the label reads as "this one is the other thing" rather than as
  // decoration repeated on every post.
  fieldLabel(job),
  [head, job.company && `<b>${esc(job.company)}</b>`].filter(Boolean).join('\n'),
  detailLines(job),
  tagLine(job),
].filter(Boolean).join('\n\n');

// Badges are earned, never decorative: 🆕 means the source published it within
// the day, 🔥 that the deadline is close enough to act on now. A badge that
// appears on everything stops meaning anything, so both stay narrow.
const NEW_WITHIN_MS = 24 * 60 * 60 * 1000;
const URGENT_WITHIN_DAYS = 3;

export const badges = (job) => {
  const out = [];
  // job.am has no publication date — its postedAt is an estimate from listing
  // order, which is not something to stamp "new" on.
  if (!job.postedAtEstimated && job.postedAt && Date.now() - job.postedAt < NEW_WITHIN_MS) {
    out.push('🆕');
  }
  const days = job.deadline ? (Date.parse(job.deadline) - Date.now()) / (24 * 60 * 60 * 1000) : NaN;
  if (days >= 0 && days <= URGENT_WITHIN_DAYS) out.push('🔥');
  return out;
};

// One vacancy = one message (HTML parse mode). Each post is a self-contained
// unit someone can forward to the one person it fits.
export const formatJobPost = (job) => {
  const marks = badges(job);
  const title = `${job.tag ? roleOf(job.tag).emoji : '🔹'} <b>${esc(job.title)}</b>`;
  return postBody(job, marks.length ? `${title} ${marks.join('')}` : title);
};

// The paid slot. Same skeleton as a normal post so it reads as a real vacancy,
// wrapped in a marker + label that make the sponsorship obvious.
export const formatFeaturedPost = (job) => {
  const out = ['💼 <b>Հովանավորվող</b>', postBody(job, `<b>${esc(job.title)}</b>`)];
  if (config.promoContact) {
    out.push(`➖➖➖➖➖\n💬 Ձեր աշխատատեղն այստեղ՝ ${esc(config.promoContact)}`);
  }
  return out.join('\n\n');
};

// Featured entries can carry their own image; otherwise reuse the logo already
// curated in companies.json for that employer.
const normName = (s = '') => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
export const featuredPhoto = (job) => {
  if (job.logo) return job.logo;
  const key = normName(job.company);
  if (key.length < 3) return '';
  const hit = loadCompanies().find((c) => {
    const name = normName(c.name);
    return name && c.logo && (name === key || name.startsWith(key) || key.startsWith(name));
  });
  return hit?.logo || '';
};

// The apply button — one tap from the post to the vacancy, and it keeps the
// link out of the body so the text stays clean when forwarded.
export const applyKeyboard = (url) =>
  (url ? { inline_keyboard: [[{ text: 'Դիմել', url }]] } : undefined);

// Pinned channel intro: what this is, when it posts, how to submit a vacancy.
export const formatIntro = () => {
  const out = [
    '📌 <b>ZroJobs | Աշխատանք</b>',
    '',
    'Այստեղ հրապարակվում են Հայաստանի և հեռավար թափուր աշխատատեղերը՝ '
      + 'յուրաքանչյուրը առանձին հայտարարությամբ, որպեսզի հեշտ լինի ուղարկել այն մարդուն, ում պետք է։',
    '',
    '🕙 Հրապարակվում է օրական երկու անգամ՝ 10:00 և 19:00 (Երևան)։',
    '',
    '💻 <b>ՏՏ</b>՝ #IT',
    '#dev #QA #AI #data #devops #design #product',
    '',
    '📣 <b>ՄԱՐՔԵԹԻՆԳ</b>՝ #marketing',
    '#brand #content #SMM #PR #performance',
    '',
    '📍 Ըստ վայրի և մակարդակի՝ #Երևան #remote #junior #middle #senior',
  ];
  if (config.contact) {
    out.push(
      '',
      `💼 Գործատո՞ւ եք։ Ուղարկեք ձեր աշխատատեղը՝ ${esc(config.contact)} — `
        + 'հովանավորվող հայտարարությունը հրապարակվում է առաջինը՝ ընկերության լոգոյով։',
    );
  }
  out.push('', ...promoLines('jobs', {
    siteUrl: esc(config.siteUrl),
    ownHandle: esc(config.channelHandle),
  }));
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
    // Reserve room for the title plus the three-line cross-promo footer.
    if (blurb.length > CAPTION_LIMIT - 200) blurb = `${blurb.slice(0, CAPTION_LIMIT - 201).trimEnd()}…`;
    out.push('', esc(blurb));
  }
  out.push('', ...promoLines('jobs', {
    siteUrl: esc(config.siteUrl),
    ownHandle: esc(config.channelHandle),
  }));
  return out.join('\n');
};
