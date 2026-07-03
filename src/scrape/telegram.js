import { stripHtml } from '../text.js';

// Scrape a public Telegram channel through its t.me/s/<name> preview page —
// server-rendered HTML, no bot membership or API auth needed. Returns the last
// ~20 posts; the aggregate window + seen.json take care of the rest.

const UA = 'Mozilla/5.0 (compatible; zrojobs/1.0; +https://t.me/zrojobs)';

export const fetchTelegramChannel = async (channel) => {
  const res = await fetch(`https://t.me/s/${channel}`, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`t.me/s/${channel} ${res.status}`);
  const html = await res.text();

  // Split into per-message chunks so data-post / text / datetime stay associated.
  const chunks = html.split('tgme_widget_message_wrap').slice(1);
  const jobs = [];
  for (const chunk of chunks) {
    const post = chunk.match(/data-post="([^"]+)"/)?.[1]; // "channel/12345"
    const textHtml = chunk.match(
      /<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)<\/div>/s,
    )?.[1];
    const datetime = chunk.match(/datetime="([^"]+)"/)?.[1];
    if (!post || !textHtml) continue;

    const text = stripHtml(textHtml);
    if (text.length < 40) continue; // stickers, "channel created", one-liners

    const msgId = post.split('/')[1];
    jobs.push({
      id: `tg:${post}`,
      // First line doubles as the title; Gemini rewrites it properly anyway.
      title: text.split('\n')[0].slice(0, 120),
      company: '',
      location: '',
      remote: /remote|удал[её]нн|հեռավար/i.test(text),
      url: `https://t.me/${post}`,
      source: `@${channel}`,
      postedAt: Date.parse(datetime || '') || Date.now(),
      text: text.slice(0, 600), // enough context for curation without prompt bloat
    });
  }
  return jobs;
};
