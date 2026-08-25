// Cross-promotion between the three Zro channels.
//
// The three channels share one audience — Armenian, technical, and already
// proven willing to subscribe to a Zro channel. Someone reading a vacancy is a
// strong candidate for the AI digest, and vice versa. Until now nothing in any
// post told them the other two existed.
//
// The footer is the most-read line in a Telegram post (it's what sits above the
// view counter), and it was spending itself on the portfolio URL plus the handle
// of the channel the reader is already subscribed to. This module gives that
// line to a sibling channel instead.
//
// This file is intentionally identical in all three repos — only the `self`
// argument differs at the call site — so a channel rename is one edit copied
// three times rather than three different edits.

// The three channels, as one registry. Beyond the Telegram footer this now also
// feeds the published sites: the about page, the cross-links in every footer and
// the `sameAs` list in the structured data all read from here, so a rename or a
// new blurb is one edit rather than a hunt through the renderer.
//
// `blurbEn` exists because an answer engine asked "Armenian AI news Telegram
// channel" in English has to find a sentence it can quote in English. The
// Armenian copy alone matches only the Armenian phrasing of the question.
const CHANNELS = {
  jobs: {
    key: 'jobs',
    name: 'ZroJobs',
    handle: '@zrojob',
    site: 'https://jobs.zromek.de',
    blurbHy: 'ՏՏ և մարքեթինգի աշխատանք Հայաստանում և հեռավար',
    blurbEn: 'IT and marketing jobs in Armenia and remote, posted daily in Armenian',
  },
  crypto: {
    key: 'crypto',
    name: 'ZroCrypto',
    handle: '@zrocry',
    site: 'https://crypto.zromek.de',
    blurbHy: 'կրիպտո օրվա ամփոփում՝ հայերեն',
    blurbEn: 'daily cryptocurrency news digest in Armenian',
  },
  ai: {
    key: 'ai',
    name: 'ZroAIX',
    handle: '@zroaix',
    site: 'https://ai.zromek.de',
    blurbHy: 'AI նորություններ՝ հայերեն',
    blurbEn: 'daily artificial-intelligence news digest in Armenian',
  },
};

// Fixed order so the daily rotation is deterministic and reviewable.
const ORDER = ['jobs', 'crypto', 'ai'];

// The portfolio the three channels hang off. It is the only already-indexed
// property in the set, so it belongs in every `sameAs` list as the thing that
// ties the three otherwise-unconnected subdomains to one publisher.
const PORTFOLIO = 'https://zromek.de';

export const telegramUrl = (ch) => `https://t.me/${String(ch.handle || '').replace(/^@/, '')}`;

// Monotonic day counter (days since epoch, Yerevan). Drives stateless rotation —
// no cursor file to commit back, and the same day always renders the same pick,
// so a dry run shows exactly what the real run will post.
const dayIndex = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yerevan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return Math.floor(Date.UTC(get('year'), get('month') - 1, get('day')) / 86400000);
};

// The sibling promoted today. Alternates between the other two channels daily
// rather than always naming the same one — a footer that never changes stops
// being read after the third post.
export const siblingOfDay = (self, d = new Date()) => {
  const others = ORDER.filter((k) => k !== self);
  if (!others.length) return null;
  return CHANNELS[others[dayIndex(d) % others.length]] || null;
};

export const channelOf = (self) => CHANNELS[self] || null;

// Both siblings, in registry order. The Telegram footer rotates because it has
// one line to spend; a web page has room for both, and a crawler following two
// links between the subdomains is the whole point of listing them there.
export const siblingsOf = (self) => ORDER.filter((k) => k !== self).map((k) => CHANNELS[k]);

// Every URL that represents this publisher, for schema.org `sameAs`. Listing the
// Telegram channel next to the portfolio and the two sibling sites is what lets
// a search engine treat the handle and the domain as one entity rather than as
// four unrelated pages that happen to share a word.
export const sameAsOf = (self) => {
  const me = CHANNELS[self];
  if (!me) return [PORTFOLIO];
  return [telegramUrl(me), PORTFOLIO, ...siblingsOf(self).map((c) => c.site)];
};

// The footer block, as an array of lines to push onto a message under construction.
// Line 1 is the sibling pitch, line 2 keeps the existing portfolio + own-handle
// credit so nothing that was there before is lost.
//
// `siteUrl` and `ownHandle` come from env config and must arrive already escaped
// — this module has no escaper of its own and returns HTML-parse-mode text.
export const promoLines = (self, { siteUrl = '', ownHandle = '', date } = {}) => {
  const out = ['➖➖➖➖➖➖➖➖➖➖'];

  const sibling = siblingOfDay(self, date);
  if (sibling) {
    out.push(`📡 Նաև՝ <b>${sibling.handle}</b> — ${sibling.blurbHy}`);
  }

  const credit = [siteUrl && `<b>${siteUrl}</b>`, ownHandle].filter(Boolean).join('  |  ');
  if (credit) out.push(`⚡ ${credit}`);

  return out;
};

export { CHANNELS, ORDER, PORTFOLIO };
