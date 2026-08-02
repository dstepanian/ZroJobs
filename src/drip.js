import config from './config.js';
import { plain } from './format.js';
import { sendPost } from './post.js';
import { next } from './queue.js';

// Release one queued vacancy. Runs on a short cron, so an empty queue is the
// normal case for most of the day — it exits quietly and costs nothing.
const run = async () => {
  const item = next();
  if (!item) {
    console.log('[drip] queue empty — nothing to post');
    return;
  }

  const { post, commit, fail } = item;

  if (config.dry) {
    if (config.print) {
      console.log('\n----- NEXT POST -----\n');
      if (post.photo) console.log(`[photo] ${post.photo}`);
      console.log(plain(post.text));
      if (post.url) console.log(`\n[button] Դիմել → ${post.url}`);
      console.log('\n---------------------\n');
    }
    console.log('[drip] dry run — queue untouched');
    return;
  }

  // Drop from the queue only once Telegram has accepted it; a failure leaves the
  // post in place for the next tick, and fail() retires it after a few tries.
  try {
    const result = await sendPost(post);
    const left = commit();
    console.log(`[drip] posted message ${result.message_id} (${post.id}) — ${left} left`);
  } catch (e) {
    fail();
    throw new Error(`post failed for ${post.id}: ${e.message}`);
  }
};

run()
  .then(() => process.exit(0)) // fetch keep-alive sockets would otherwise hang the process
  .catch((e) => {
    console.error('[drip] fatal:', e.message);
    process.exit(1);
  });
