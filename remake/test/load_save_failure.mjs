// node --experimental-vm-modules remake/test/load_save_failure.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const files = new Map();
let failAutoSave = false;
const context = vm.createContext({ console, localStorage: {
  getItem(key) { return files.get(key) ?? null; },
  setItem(key, value) {
    if (failAutoSave && key === "suien_remake_save") throw new Error("保存失敗を注入");
    files.set(key, String(value));
  },
} });
const modules = new Map();
async function moduleAt(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const module = new vm.SourceTextModule(fs.readFileSync(url, "utf8"), {
    context, identifier: url.href,
  });
  modules.set(url.href, module);
  await module.link(path => moduleAt(new URL(path, url)));
  return module;
}
const module = await moduleAt(new URL("../js/core/state.js", import.meta.url));
await module.evaluate();
const core = module.namespace;
const manualKey = core.SAVE_SLOTS[1].key;
const originalAuto = JSON.stringify({ day: 3 });
const originalManual = JSON.stringify({ day: 10 });
files.set(core.SAVE_KEY, originalAuto);
files.set(manualKey, originalManual);

// 手動LOAD失敗では、参照も内容も元の状態を維持する。
const previous = core.load();
const previousJSON = JSON.stringify(previous);
failAutoSave = true;
assert.equal(core.loadFromSlot(manualKey), null);
assert.strictEqual(core.state, previous);
assert.equal(JSON.stringify(core.state), previousJSON);
assert.equal(files.get(core.SAVE_KEY), originalAuto);
assert.equal(files.get(manualKey), originalManual);

// タイトルで現在のstateが無い場合も、失敗後はnullのまま。
core.setState(null);
assert.equal(core.loadFromSlot(manualKey), null);
assert.equal(core.state, null);
assert.equal(core.save(), false);

// 正常時は選んだ枠をオート枠へ書き継ぎ、再起動相当のLOADでも維持する。
failAutoSave = false;
const selected = core.loadFromSlot(manualKey);
assert(selected);
assert.strictEqual(core.state, selected);
assert.equal(selected.day, 10);
assert.equal(files.get(core.SAVE_KEY), JSON.stringify(selected));
assert.equal(files.get(manualKey), originalManual);
assert.equal(core.load().day, 10);

// オート枠自身は書き込み不可でも既存データで再開できる。
files.set(core.SAVE_KEY, originalAuto);
failAutoSave = true;
const auto = core.loadFromSlot(core.SAVE_KEY);
assert(auto);
assert.strictEqual(core.state, auto);
assert.equal(auto.day, 3);
assert.equal(files.get(core.SAVE_KEY), originalAuto);

// save()は書き込みの成否をbooleanで返す。
assert.equal(core.save(), false);
assert.equal(files.get(core.SAVE_KEY), originalAuto);
failAutoSave = false;
assert.equal(core.save(), true);
assert.equal(files.get(core.SAVE_KEY), JSON.stringify(core.state));
console.log("PASS: 手動LOADの保存失敗・状態復元、正常LOAD、オートLOAD、saveの成否");
