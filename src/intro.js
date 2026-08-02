import config from './config.js';
import { formatIntro, plain } from './format.js';
import { pinMessage, postToTelegram } from './post.js';

// One-off: post the channel intro and pin it, so a first-time visitor sees what
// this channel is and how to submit a vacancy before scrolling any jobs.
// Run again after changing the copy — Telegram pins the newest message.
const run = async () => {
  console.log(`[intro] starting${config.dry ? ' (dry run)' : ''}`);

  if (!config.contact) {
    // Without a contact handle the post can't tell employers where to write —
    // still useful, but worth saying out loud.
    console.warn('[intro] CONTACT_HANDLE/PROMO_CONTACT not set — no submission handle in the post');
  }

  const text = formatIntro();

  if (config.dry) {
    if (config.print) {
      console.log('\n----- INTRO PREVIEW -----\n');
      console.log(plain(text));
      console.log('\n-------------------------\n');
    }
    console.log('[intro] dry run — not posting');
    return;
  }

  const result = await postToTelegram(text);
  console.log(`[intro] posted message ${result.message_id} to ${config.channel}`);

  // Pinning needs the bot to be a channel admin; a missing right shouldn't look
  // like the post itself failed.
  try {
    await pinMessage(result.message_id);
    console.log('[intro] pinned');
  } catch (e) {
    console.error(`[intro] posted but not pinned (${e.message}) — pin it manually`);
  }
};

run()
  .then(() => process.exit(0)) // fetch keep-alive sockets would otherwise hang the process
  .catch((e) => {
    console.error('[intro] fatal:', e);
    process.exit(1);
  });
