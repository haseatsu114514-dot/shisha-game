import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
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

// 実際の章再開・復帰画面の関数を、DOMとナビゲーションだけ差し替えて検証する。
// ブラウザ内での失敗キャッシュ自体と、再読込後の起動はbrowserテストが担当する。
const ch1Source = readFileSync(new URL('../js/chapters/ch1.js', import.meta.url), 'utf8');
const recoveryStart = ch1Source.indexOf('async function resumeChapterModule(');
const recoveryEnd = ch1Source.indexOf('\nasync function dailyPart()', recoveryStart);
assert(recoveryStart >= 0 && recoveryEnd > recoveryStart);
const recoverySource = ch1Source.slice(recoveryStart, recoveryEnd);
function recoveryHarness() {
  const buttons = new Map(), events = [];
  const context = vm.createContext({
    withLoadingNotice, singleFlight, loadingNotice: () => ({}),
    requestResumeOnBoot: () => events.push('resume-on-boot'),
    location: { reload: () => events.push('reload') },
    el: (spec, attrs) => {
      const node = { ...attrs, disabled: false, focus: () => events.push(attrs.dataset.test) };
      if (attrs.dataset?.test) buttons.set(attrs.dataset.test, node);
      return node;
    },
    showScreen: name => events.push(name),
  });
  vm.runInContext(recoverySource, context);
  return { resume: context.resumeChapterModule, buttons, events };
}
{
  const h = recoveryHarness();
  let loads = 0, runs = 0, settled = false;
  // 同じ文書での再importが必ず失敗する環境でも、再読込の導線が機能する。
  const failed = Promise.reject(new Error('cached module fetch failure'));
  h.resume(() => { loads++; return failed; }, () => runs++, 'chapter')
    .then(() => { settled = true; }, () => { assert.fail('Resume must show recovery instead of rejecting'); });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'Resume remains pending until navigation');
  assert.deepEqual(h.events, ['end', 'resume-retry']);
  const retry = h.buttons.get('resume-retry'), home = h.buttons.get('resume-title');
  await retry.onclick();
  assert.deepEqual(h.events, ['end', 'resume-retry', 'resume-on-boot', 'reload']);
  assert.equal(retry.disabled, true);
  assert.equal(home.disabled, true);
  await retry.onclick();
  await home.onclick();
  assert.equal(h.events.filter(event => event === 'reload').length, 1, 'Double navigation is blocked');
  assert.equal(loads, 1, 'Do not retry the cached import in the same document');
  assert.equal(runs, 0, 'Do not start a chapter after import failure');
}
{
  const h = recoveryHarness();
  h.resume(() => Promise.reject(new Error('offline')), () => assert.fail('No module'), 'chapter');
  await new Promise(resolve => setImmediate(resolve));
  await h.buttons.get('resume-title').onclick();
  assert.deepEqual(h.events, ['end', 'resume-retry', 'reload'], 'Title navigation must not request resume');
}
{
  const h = recoveryHarness();
  assert.equal(await h.resume(() => Promise.resolve({ chapter: 2 }), module => module.chapter, 'chapter'), 2);
  assert.deepEqual(h.events, [], 'Successful resume needs no recovery screen or reload');
}

console.log('module loading: PASS (delay suppress/show/hide, failure cleanup, retry, single-flight, resume recovery navigation)');
