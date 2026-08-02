import config from './config.js';
import { applyKeyboard } from './format.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Single place that talks to the Bot API. Posting a run as many separate
// messages makes the per-channel flood limit reachable, so a 429 is retried
// once for exactly as long as Telegram asks.
const api = async (method, payload, retry = true) => {
  if (!config.token || !payload.chat_id) {
    throw new Error('TELEGRAM_BOT_TOKEN or chat id missing');
  }

  const res = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!data.ok) {
    const wait = data.parameters?.retry_after;
    if (wait && retry) {
      console.warn(`[zrojobs] flood limit — waiting ${wait}s`);
      await sleep((wait + 1) * 1000);
      return api(method, payload, false);
    }
    throw new Error(`Telegram error: ${data.description}`);
  }
  return data.result;
};

// Post one message (HTML). `replyMarkup` carries the inline apply button.
export const postToTelegram = (text, chatId = config.channel, { replyMarkup } = {}) =>
  api('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });

// Post a photo card (featured listing, company spotlight). `photo` is a URL, a
// local file path, or a reusable Telegram file_id; caption is HTML, capped by
// Telegram at 1024 chars. Callers fall back to text when the image fails.
export const postPhoto = (photo, caption, chatId = config.channel, { replyMarkup } = {}) =>
  api('sendPhoto', {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  });

// Telegram photo captions cap at 1024 chars; a post that outgrows the cap goes
// out as plain text rather than truncated.
const CAPTION_LIMIT = 1000;

// Send one queued post, preferring the photo card when the listing has a logo.
// A dead image URL must never cost us the post, so it degrades to text.
export const sendPost = async ({ text, photo, url }) => {
  const replyMarkup = applyKeyboard(url);
  if (photo && text.length <= CAPTION_LIMIT) {
    try {
      return await postPhoto(photo, text, config.channel, { replyMarkup });
    } catch (e) {
      console.warn(`[zrojobs] photo failed (${e.message}) — falling back to text`);
    }
  }
  return postToTelegram(text, config.channel, { replyMarkup });
};

// Pin a message silently (used by the intro post; the bot must be channel admin).
export const pinMessage = (messageId, chatId = config.channel) =>
  api('pinChatMessage', {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: true,
  });
