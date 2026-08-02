import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Rendered messages waiting to go out, oldest first. Curation runs twice a day
// and fills this; the drip run empties it one post at a time, so the channel
// gets a steady stream instead of ten notifications in ninety seconds.
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'queue.json');
const KEEP_HOURS = 36; // a vacancy nobody posted in a day and a half is stale
const MAX_ATTEMPTS = 3; // a permanently unsendable post must not block the queue

export const loadQueue = () => {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const saveQueue = (posts) => {
  fs.writeFileSync(FILE, JSON.stringify(posts, null, 2) + '\n');
  return posts.length;
};

// Append newly curated posts, dropping ids already waiting and entries that sat
// here too long to still be worth posting.
export const enqueue = (posts, nowISO = new Date().toISOString()) => {
  const cutoff = Date.now() - KEEP_HOURS * 60 * 60 * 1000;
  const kept = loadQueue().filter((p) => Date.parse(p.queuedAt) >= cutoff);
  const have = new Set(kept.map((p) => p.id));
  const added = posts.filter((p) => !have.has(p.id)).map((p) => ({ ...p, queuedAt: nowISO }));
  saveQueue([...kept, ...added]);
  return { added: added.length, total: kept.length + added.length };
};

// Take the next post off the queue. `commit` drops it; a failure instead counts
// an attempt and leaves it in place, until it has burned through MAX_ATTEMPTS.
export const next = () => {
  const queue = loadQueue();
  if (!queue.length) return null;
  const [post, ...rest] = queue;
  return {
    post,
    commit: () => saveQueue(rest),
    fail: () => {
      const attempts = (post.attempts || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        console.warn(`[queue] dropping ${post.id} after ${attempts} failed attempts`);
        return saveQueue(rest);
      }
      return saveQueue([{ ...post, attempts }, ...rest]);
    },
  };
};
