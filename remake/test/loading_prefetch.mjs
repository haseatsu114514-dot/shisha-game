import assert from 'node:assert/strict';
import { createPrefetchQueue, prepareImage, warmInBackground } from '../js/core/loading-prefetch.js';

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


// A slow background job cannot start the next job; each boundary yields and
// rechecks ownership/visibility. Failures must not become unhandled rejections.
{
  const starts = [], yields = [];
  let finish, current = true;
  const run = warmInBackground([
    () => { starts.push(1); return new Promise(r => { finish = r; }); },
    () => starts.push(2),
  ], { isCurrent: () => current, yieldTask: () => new Promise(r => yields.push(r)) });
  assert.equal(starts.length, 0);
  yields.shift()();
  await Promise.resolve();
  assert.deepEqual(starts, [1]);
  assert.equal(yields.length, 0, 'second job waits for first');
  current = false; finish(); await run;
  assert.deepEqual(starts, [1], 'new scene cancels remaining speculation');
  for (const flag of ['isHidden', 'saveData']) {
    await warmInBackground([() => assert.fail(flag)], { [flag]: () => true, yieldTask: async () => {} });
  }
  await warmInBackground([() => { throw Error('offline'); }, () => starts.push(3)], { yieldTask: async () => {} });
  assert.deepEqual(starts, [1, 3], 'optional failure does not stop later tasks');
}
console.log('background preparation: PASS (yield, serial, stale, hidden, save-data, failure)');

// The actual race loader used by the race entrance (visit/page), tutorial and START must share
// optional art as well as the core art. Previously each call decoded it again.
{
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL('../js/minigames/camel-race.js', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export function loadCamelArt()'), source.indexOf('/** 4頭それぞれの4コマに'));
  const files = { camel: ['camel'], jockey: 'jockey', suv: 'suv', wheel: 'wheel', track: 'track',
    balloon: 'balloon', dust: ['dust'], words: { start: 'start' }, pole: 'pole', sand: 'sand',
    posts: { start: 'post' }, rivalSuvs: ['rival'], marker: 'marker', road: 'road' };
  let requests = 0;
  class Image { set src(value) { requests++; } decode() { return Promise.resolve(); } }
  const loader = runInNewContext(`let artTask = null; ${body.replace('export ', '')}; loadCamelArt`, {
    Image, ART_FILES: files, imgFileUrl: s => s, groundTiles: () => ({}), camelSkins: () => ({}),
  });
  const first = loader(), count = requests;
  assert(count > 10, 'fixture includes optional artwork');
  assert.equal(loader(), first, 'same promise while preparing');
  const value = await first;
  assert(value.camel, 'core art prepared');
  assert.equal(await loader(), value, 'same decoded art after completion');
  assert.equal(requests, count, 'no repeated optional image requests/decodes');
}
console.log('camel preparation: PASS (optional/core art share one preparation)');
