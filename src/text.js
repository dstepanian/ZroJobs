const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Feeds hand us HTML-encoded plain text — Remotive writes salaries as
// "&#036;120", RSS titles carry "&amp;". Telegram renders exactly what we send,
// so an entity left here reaches readers verbatim. Numeric escapes are decoded
// first: doing the named ones first would turn a double-encoded "&amp;#036;"
// into a real "$".
export const decodeEntities = (s = '') => s
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => NAMED[name]);

// Shared HTML-to-text helper for the scrapers.
export const stripHtml = (s = '') =>
  decodeEntities(
    s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|ul|ol|div|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
