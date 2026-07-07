import config from './config.js';

// Post the digest to the Telegram channel via the Bot API (no deps).
export const postToTelegram = async (text, chatId = config.channel) => {
  if (!config.token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN or chat id missing');
  }

  const res = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
  return data.result;
};

// Post a photo card (company spotlight). `photo` is a URL, a local file path,
// or a reusable Telegram file_id; caption is HTML, capped by Telegram at 1024
// chars. Kept separate from the digest so a failure here can't affect it.
export const postPhoto = async (photo, caption, chatId = config.channel) => {
  if (!config.token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN or chat id missing');
  }

  const res = await fetch(`https://api.telegram.org/bot${config.token}/sendPhoto`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo,
      caption,
      parse_mode: 'HTML',
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
  return data.result;
};
