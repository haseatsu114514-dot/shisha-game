// 実章runnerと共通actionをlinkし、章ごとのcurrent・test名・例外画面も検証する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createChapterActions } from "../js/core/chapter-actions.js";

const read = url => readFileSync(url, "utf8");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
for (const [chapter, prefix, log, retry] of [
  [3, "ch3-intro", "[ch3 intro]", "reload"], [4, "ch4", "[ch4]", "retry"], [5, "ch5", "[ch5]", "retry"],
]) {
  const errors = [], screens = [];
  const state = { chapter };
  const node = (selector, attrs = {}, children = []) => ({ selector,
    ...(Array.isArray(attrs) ? { children: attrs } : { ...attrs, children }) });
  const bindings = {
    state, el: node, MUKAI_DELIVERY_STEPS: [], CH3_STORY_DIALOGUE_FILES: {}, CH4_SCENE_FILES: {},
    layers: { hud: { replaceChildren() {}, classList: { remove() {}, toggle() {} } } },
    showScreen: (name, root) => screens.push({ name, root }),
  };
  const context = vm.createContext({ console: { error: (...args) => errors.push(args) } });
  const url = new URL(`../js/chapters/ch${chapter}.js`, import.meta.url);
  const source = read(url);
  const required = new Map([...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .map(m => [m[2], m[1].split(",").map(s => s.trim())]));
  const runner = new vm.SourceTextModule(source + `
    export { button, perform };
    export function owner() { return session = { state, active: true, busy: false }; }
  `, { context });
  let stateModule;
  await runner.link(async spec => {
    if (spec === "../core/chapter-actions.js") {
      const helper = new vm.SourceTextModule(read(new URL(spec, url)), { context });
      await helper.link(() => new vm.SyntheticModule(["el"], function () { this.setExport("el", node); }, { context }));
      return helper;
    }
    const names = required.get(spec);
    const stub = new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, bindings[name] ?? (() => {}));
    }, { context });
    if (spec === "../core/state.js") stateModule = stub;
    return stub;
  });
  await runner.evaluate();
  const api = runner.namespace;
  let owner = api.owner(), calls = 0;
  const pending = deferred();
  const button = api.button(owner, "続ける", "continue", () => { calls++; return pending.promise; });
  assert.equal(button.selector, "button.btn");
  assert.equal(button.type, "button");
  assert.equal(button.text, "続ける");
  assert.equal(button.dataset.test, `${prefix}-continue`);
  assert.equal(api.button(owner, "進む", "next", () => {}, true).selector, "button.btn.primary");
  const first = button.onclick();
  assert.equal(owner.busy, true);
  await button.onclick();
  assert.equal(calls, 1, "連打で二重実行しない");
  pending.resolve(); await first;
  assert.equal(owner.busy, false);
  await api.perform(owner, () => { calls++; });
  assert.equal(calls, 2, "完了後は再度実行できる");

  api.owner();
  await button.onclick();
  assert.equal(calls, 2, "古いsessionのボタンは実行しない");
  owner = api.owner(); owner.active = false;
  await api.perform(owner, () => { calls++; });
  assert.equal(calls, 2, "停止済みownerは実行しない");
  owner = api.owner(); stateModule.setExport("state", { chapter });
  await api.perform(owner, () => { calls++; });
  assert.equal(calls, 2, "保存読込でstateが置換されたownerは実行しない");
  stateModule.setExport("state", state);

  for (const asyncError of [false, true]) {
    owner = api.owner();
    const error = new Error("controlled failure");
    await api.perform(owner, () => { if (asyncError) return Promise.reject(error); throw error; });
    assert.equal(owner.busy, false, "例外後にbusyを解除する");
    assert.deepEqual(errors.at(-1), [log, error]);
    const screen = screens.at(-1);
    assert.equal(screen.name, prefix);
    assert.equal(screen.root.dataset.test, `${prefix}-error`);
    const walk = n => [n, ...(n.children || []).filter(Boolean).flatMap(walk)];
    assert(walk(screen.root).some(n => n.dataset?.test === `${prefix}-${retry}`), "章固有の再試行test名を保持");
    await api.perform(owner, () => { calls++; });
  }
  for (const invalidate of [() => api.owner(), old => { old.active = false; },
    () => stateModule.setExport("state", { chapter })]) {
    owner = api.owner();
    const pending = deferred(), before = [errors.length, screens.length];
    const running = api.perform(owner, () => pending.promise);
    invalidate(owner); pending.reject(new Error("stale failure")); await running;
    assert.equal(owner.busy, false);
    assert.deepEqual([errors.length, screens.length], before, "無効sessionの遅い例外はログ・画面へ出さない");
    stateModule.setExport("state", state);
  }
}
// エラー表示自身が失敗してもfinallyでbusyを解除する。
const owner = { busy: false }, error = new Error("render failed");
const { perform } = createChapterActions({ current: () => true, logName: "test",
  renderError: () => { throw error; } });
const originalError = console.error;
try {
  console.error = () => {};
  await assert.rejects(perform(owner, () => { throw new Error("action failed"); }), error);
} finally { console.error = originalError; }
assert.equal(owner.busy, false);

// 第2章の移設前からある、クリック時のowner取得と画面全体のbusy状態を固定する。
{
  const state = { chapter: 2 }, errors = [], screens = [], attributes = new Map();
  const buttons = [{ dataset: { locked: "true" }, disabled: true }, { dataset: {}, disabled: false }];
  const node = (selector, attrs = {}, children = []) => ({ selector,
    ...(Array.isArray(attrs) ? { children: attrs } : { ...attrs, children }) });
  const screen = { setAttribute: (key, value) => attributes.set(key, value),
    querySelectorAll: () => buttons, querySelector: () => null };
  const bindings = { state, el: node, layers: { screen, hud: { replaceChildren() {} } },
    showScreen: (name, root) => screens.push({ name, root }) };
  const context = vm.createContext({ console: { error: (...args) => errors.push(args) },
    requestAnimationFrame: callback => callback() });
  const url = new URL("../js/chapters/ch2.js", import.meta.url);
  const source = read(url);
  const required = new Map([...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .map(m => [m[2], m[1].split(",").map(s => s.trim())]));
  const runner = new vm.SourceTextModule(source + `
    export { button, perform };
    export function owner() { return session = { state, active: true, busy: false }; }
  `, { context });
  let stateModule;
  await runner.link(async spec => {
    if (spec === "../core/chapter-actions.js") {
      const helper = new vm.SourceTextModule(read(new URL(spec, url)), { context });
      await helper.link(() => new vm.SyntheticModule(["el"], function () { this.setExport("el", node); }, { context }));
      return helper;
    }
    const names = required.get(spec);
    const stub = new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, bindings[name] ?? (() => {}));
    }, { context });
    if (spec === "../core/state.js") stateModule = stub;
    return stub;
  });
  await runner.evaluate();
  const api = runner.namespace;
  await api.perform(() => { throw new Error("sessionが無いときは実行しない"); });
  let active = api.owner(), calls = 0;
  const delayed = deferred();
  const button = api.button("続ける", "continue", () => { calls++; return delayed.promise; });
  const explicitDisabled = api.button("閉じる", "disabled", () => {}, false, true);
  assert.equal(button.dataset.test, "ch2-main-continue");
  assert.equal(button.disabled, false);
  assert.equal(explicitDisabled.disabled, true);
  buttons.push(explicitDisabled);
  assert.equal(api.button("進む", "next", () => {}, true).selector, "button.btn.primary");
  const running = button.onclick();
  assert.equal(active.busy, true);
  assert.equal(attributes.get("aria-busy"), "true");
  assert(buttons.every(item => item.disabled), "画面上の全ボタンを止める");
  await button.onclick();
  assert.equal(calls, 1, "第2章の連打で二重実行しない");
  delayed.resolve(); await running;
  assert.equal(active.busy, false);
  assert.equal(attributes.get("aria-busy"), "false");
  assert.deepEqual(buttons.map(item => item.disabled), [true, false, false], "復帰時はlockedだけ無効。明示disabledは再評価しない");

  active = api.owner();
  await button.onclick();
  assert.equal(calls, 2, "第2章のボタンはクリック時のsessionで実行する");
  active.active = false;
  await api.perform(() => { calls++; });
  assert.equal(calls, 2);
  active = api.owner(); stateModule.setExport("state", { chapter: 2 });
  await api.perform(() => { calls++; });
  assert.equal(calls, 2, "LOAD相当のstate交代では実行しない");
  stateModule.setExport("state", state);

  active = api.owner();
  const stale = deferred(), before = [errors.length, screens.length];
  const staleRun = api.perform(() => stale.promise);
  api.owner(); stale.reject(new Error("stale failure")); await staleRun;
  assert.equal(active.busy, true, "旧sessionの後処理はbusyを変えない");
  assert.deepEqual([errors.length, screens.length], before);

  active = api.owner();
  const oldState = deferred(), stateBefore = [errors.length, screens.length];
  const oldStateRun = api.perform(() => oldState.promise);
  stateModule.setExport("state", { chapter: 2 });
  oldState.reject(new Error("state replaced")); await oldStateRun;
  assert.equal(active.busy, true, "LOAD相当の交代後は旧ownerを解除しない");
  assert.deepEqual([errors.length, screens.length], stateBefore);
  stateModule.setExport("state", state);

  active = api.owner();
  const failure = new Error("action failed");
  await api.perform(() => { throw failure; });
  assert.deepEqual(errors.at(-1), ["[ch2]", failure]);
  assert.equal(screens.at(-1).name, "ch2-error");
  assert.equal(active.busy, false);
  assert.equal(attributes.get("aria-busy"), "false");
  const walk = item => [item, ...(item.children || []).filter(Boolean).flatMap(walk)];
  assert(walk(screens.at(-1).root).some(item => item.dataset?.test === "ch2-main-retry"));
}
console.log("chapter actions: chapter 2–5 DOM/test names, single action, stale sessions and error recovery PASS");
