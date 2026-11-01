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
console.log("chapter actions: chapter 3–5 DOM/test names, single action, stale sessions and error recovery PASS");
