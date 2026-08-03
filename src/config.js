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
  siteBaseUrl: process.env.SITE_BASE_URL || 'https://dstepanian.github.io/ZroJobs',
  promoContact: process.env.PROMO_CONTACT || '',
  // Handle an employer writes to submit a vacancy (intro post, featured footer).
  contact: process.env.CONTACT_HANDLE || process.env.PROMO_CONTACT || '',
  digestMin: Number(process.env.DIGEST_MIN || 5),
  digestMax: Number(process.env.DIGEST_MAX || 10),
  internationalMin: Number(process.env.INTERNATIONAL_MIN || 2),
  internationalMax: Number(process.env.INTERNATIONAL_MAX || 4),
  // CLI flags
  dry: process.argv.includes('--dry'),
  print: process.argv.includes('--print'),
};

export default config;
