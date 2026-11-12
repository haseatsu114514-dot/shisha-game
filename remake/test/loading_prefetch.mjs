import assert from 'node:assert/strict';
import { createPrefetchQueue, prepareImage } from '../js/core/loading-prefetch.js';

const queue = createPrefetchQueue({ concurrency: 1, capacity: 2 });
let release, starts = 0;
const first = queue.prepare('a', () => { starts++; return new Promise(resolve => { release = resolve; }); });
assert.equal(queue.prepare('a', () => assert.fail('Duplicate preparation')), first);
const second = queue.prepare('b', () => { starts++; return 'B'; });
await Promise.resolve();
assert.equal(starts, 1, 'Concurrency bound');
assert.equal(await queue.warm('overflow', () => assert.fail('Queue overflow ran')), false);
release('A');
assert.equal(await first, 'A');
assert.equal(await second, 'B');
assert.equal(await queue.prepare('a', () => assert.fail('Cached preparation ran')), 'A');
assert.equal(await queue.prepare('c', () => 'C'), 'C');
let attempts = 0;
const retry = createPrefetchQueue();
assert.equal(await retry.warm('retry', () => { attempts++; throw new Error('offline'); }), false);
assert.equal(await retry.prepare('retry', () => { attempts++; return 'online'; }), 'online');
assert.equal(attempts, 2);
assert.throws(() => createPrefetchQueue({ concurrency: 0 }), RangeError);
console.log('loading prefetch: PASS (reuse, bounds, concurrency, failure, retry)');

// A cancelled/loading-timeout scene must release its network/decode work, while a
// successful preparation must retain the decoded image for its foreground caller.
const originalImage = globalThis.Image;
let image, decodes = 0;
globalThis.Image = class {
  constructor() { image = this; }
  removeAttribute(name) { assert.equal(name, 'src'); this.src = ''; }
  decode() { decodes++; return Promise.resolve(); }
};
try {
  const controller = new AbortController();
  const aborted = prepareImage('slow.webp', { signal: controller.signal });
  const lateLoad = image.onload;
  const rejection = assert.rejects(aborted, { name: 'AbortError' });
  controller.abort();
  await rejection;
  assert.equal(image.src, '', 'Abort releases the unused image request');
  assert.equal(image.onload, null);
  await lateLoad();
  assert.equal(decodes, 0, 'A queued load event must not decode cancelled art');

  const timeout = prepareImage('stalled.webp', { timeoutMs: 5 });
  await assert.rejects(timeout, /timed out/);
  assert.equal(image.src, '', 'Timeout releases the image request');

  const ready = prepareImage('ready.webp');
  const prepared = image;
  await image.onload();
  assert.equal(await ready, prepared);
  assert.equal(prepared.src, 'ready.webp', 'Successful image is retained');
  assert.equal(decodes, 1);
} finally {
  if (originalImage === undefined) delete globalThis.Image;
  else globalThis.Image = originalImage;
}
console.log('image preparation: PASS (abort, timeout, queued load, decoded retention)');
