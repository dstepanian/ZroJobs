import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { badges } from '../src/format.js';
import { enqueue, loadQueue, next, saveQueue } from '../src/queue.js';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'queue.json');
const HOURS = 60 * 60 * 1000;

// The queue is a real file; each test starts from a known empty one and the
// last one leaves it that way.
const reset = () => saveQueue([]);
test.afterEach(reset);
test.after(() => fs.rmSync(FILE, { force: true }));

test('enqueue appends new posts and ignores ids already waiting', () => {
  reset();
  assert.deepEqual(enqueue([{ id: 'a' }, { id: 'b' }]), { added: 2, total: 2 });
  assert.deepEqual(enqueue([{ id: 'b' }, { id: 'c' }]), { added: 1, total: 3 });
  assert.deepEqual(loadQueue().map((p) => p.id), ['a', 'b', 'c']);
});

test('enqueue drops entries that waited too long to still be worth posting', () => {
  reset();
  saveQueue([
    { id: 'stale', queuedAt: new Date(Date.now() - 48 * HOURS).toISOString() },
    { id: 'fresh', queuedAt: new Date(Date.now() - 2 * HOURS).toISOString() },
  ]);

  enqueue([{ id: 'new' }]);
  assert.deepEqual(loadQueue().map((p) => p.id), ['fresh', 'new']);
});

test('next() commits on success and keeps the post on failure', () => {
  reset();
  enqueue([{ id: 'a' }, { id: 'b' }]);

  next().commit();
  assert.deepEqual(loadQueue().map((p) => p.id), ['b']);

  next().fail();
  const [held] = loadQueue();
  assert.equal(held.id, 'b', 'a failed post stays at the head for the next tick');
  assert.equal(held.attempts, 1);
});

test('next() retires a post that keeps failing instead of blocking the queue', () => {
  reset();
  enqueue([{ id: 'bad' }, { id: 'good' }]);

  next().fail();
  next().fail();
  next().fail();
  assert.deepEqual(loadQueue().map((p) => p.id), ['good']);
});

test('next() on an empty queue returns nothing', () => {
  reset();
  assert.equal(next(), null);
});

test('badges are earned: 🆕 for a real recent date, 🔥 for a close deadline', () => {
  const iso = (days) => new Date(Date.now() + days * 24 * HOURS).toISOString().slice(0, 10);

  assert.deepEqual(badges({ postedAt: Date.now() - 2 * HOURS }), ['🆕']);
  assert.deepEqual(badges({ postedAt: Date.now() - 72 * HOURS }), []);
  assert.deepEqual(badges({ deadline: iso(2) }), ['🔥']);
  assert.deepEqual(badges({ deadline: iso(20) }), []);
  // job.am's postedAt is guessed from listing order — never stamp it new.
  assert.deepEqual(badges({ postedAt: Date.now(), postedAtEstimated: true }), []);
});
