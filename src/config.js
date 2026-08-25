import 'dotenv/config';

const config = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  channel: process.env.TELEGRAM_CHANNEL,
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  channelHandle: process.env.CHANNEL_HANDLE || process.env.TELEGRAM_CHANNEL || '',
  siteUrl: process.env.SITE_URL || 'zromek.de',
  // Where the generated job site is published — canonical URLs and the sitemap
  // are absolute, so this has to match the real host exactly.
  siteBaseUrl: process.env.SITE_BASE_URL || 'https://jobs.zromek.de',
  promoContact: process.env.PROMO_CONTACT || '',
  // Handle an employer writes to submit a vacancy (intro post, featured footer).
  contact: process.env.CONTACT_HANDLE || process.env.PROMO_CONTACT || '',
  digestMin: Number(process.env.DIGEST_MIN || 5),
  digestMax: Number(process.env.DIGEST_MAX || 10),
  internationalMin: Number(process.env.INTERNATIONAL_MIN || 2),
  internationalMax: Number(process.env.INTERNATIONAL_MAX || 4),
  // Marketing has roughly as much open local supply as the whole IT feed, so
  // left uncapped it would take over a digest the subscribers joined for IT.
  // This is a ceiling, never a quota: a run with no good marketing job posts
  // none rather than reaching for a weak one.
  marketingMax: Number(process.env.MARKETING_MAX || 3),
  // CLI flags
  dry: process.argv.includes('--dry'),
  print: process.argv.includes('--print'),
};

// GitHub Pages drops a custom domain that was set only in Settings → Pages the
// next time an artifact deploys, so the host has to ship as a CNAME file inside
// site/. Derived from siteBaseUrl rather than added as a second variable, so the
// domain still has exactly one source of truth.
config.siteHost = (() => {
  try { return new URL(config.siteBaseUrl).hostname; } catch { return ''; }
})();

export default config;
