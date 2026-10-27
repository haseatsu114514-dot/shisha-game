import assert from 'node:assert/strict';
import { withLoadingNotice, singleFlight } from '../js/core/module-loading.js';

const defer = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

// 遅延: delayMs 以内に終われば通知を一切出さない（速い読み込みでスピナーを点滅させない）。
{
  let shown = 0, hidden = 0;
  const value = await withLoadingNotice(Promise.resolve('fast'), { delayMs: 1000, onShow: () => shown++, onHide: () => hidden++ });
  assert.equal(value, 'fast');
  assert.equal(shown, 0, 'No notice for a quick load');
  assert.equal(hidden, 0);
}

// 遅延: delayMs を超えたら通知を一度出し、完了で必ず消す。
{
  let shown = 0, hidden = 0;
  const gate = defer();
  const task = withLoadingNotice(gate.promise, { delayMs: 10, onShow: () => shown++, onHide: () => hidden++ });
  await new Promise(r => setTimeout(r, 30));
  assert.equal(shown, 1, 'Notice shown after the delay');
  assert.equal(hidden, 0, 'Still waiting');
  gate.resolve('late');
  assert.equal(await task, 'late');
  assert.equal(hidden, 1, 'Notice removed on completion');
}

// 失敗: 通信断を模した reject でも通知を片付け、例外はそのまま投げ直す。
{
  let shown = 0, hidden = 0;
  const gate = defer();
  const task = withLoadingNotice(gate.promise, { delayMs: 10, onShow: () => shown++, onHide: () => hidden++ });
  await new Promise(r => setTimeout(r, 30));
  gate.reject(new Error('offline'));
  await assert.rejects(task, /offline/);
  assert.equal(shown, 1);
  assert.equal(hidden, 1, 'Notice removed even on failure');
}

// 再試行: 一度失敗しても同じ呼び出し口でそのまま読み込み直せる。
{
  let attempts = 0;
  const load = () => withLoadingNotice(
    attempts++ === 0 ? Promise.reject(new Error('offline')) : Promise.resolve('ch2'),
    { delayMs: 1000 },
  );
  await assert.rejects(load(), /offline/);
  assert.equal(await load(), 'ch2');
  assert.equal(attempts, 2);
}

// 二重読込の防止: 実行中の再呼び出しは loader を走らせず undefined を返す。
{
  let runs = 0;
  const gate = defer();
  const run = singleFlight(() => { runs++; return gate.promise; });
  const first = run();
  assert.equal(await run(), undefined, 'Concurrent call is ignored');
  assert.equal(runs, 1, 'Loader not run twice');
  gate.resolve('done');
  assert.equal(await first, 'done');
  // 終わったら同じ関数で再試行できる。
  assert.equal(await run(), 'done');
  assert.equal(runs, 2);
}

// 二重読込の防止: 失敗後も running を戻すので再試行できる。
{
  let runs = 0;
  const run = singleFlight(() => { runs++; return runs === 1 ? Promise.reject(new Error('offline')) : Promise.resolve('ok'); });
  await assert.rejects(run(), /offline/);
  assert.equal(await run(), 'ok');
  assert.equal(runs, 2);
}

console.log('module loading: PASS (delay suppress/show/hide, failure cleanup, retry, single-flight)');
