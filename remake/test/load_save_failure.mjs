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
const bus = (await moduleAt(new URL("../js/core/bus.js", import.meta.url))).namespace;
const notifications = [];
bus.on("hud", () => notifications.push({ state: core.state, raw: files.get(core.SAVE_KEY) }));
const manualKey = core.SAVE_SLOTS[1].key;
const originalAuto = JSON.stringify({ day: 3 });
const originalManual = JSON.stringify({ day: 10 });
files.set(core.SAVE_KEY, originalAuto);
files.set(manualKey, originalManual);

// 手動LOAD失敗では、参照も内容も元の状態を維持する。
const previous = core.load();
const previousJSON = JSON.stringify(previous);
failAutoSave = true;
notifications.length = 0;
assert.equal(core.loadFromSlot(manualKey), null);
assert.strictEqual(core.state, previous);
assert.equal(JSON.stringify(core.state), previousJSON);
assert.equal(files.get(core.SAVE_KEY), originalAuto);
assert.equal(files.get(manualKey), originalManual);

assert.deepEqual(notifications, [], "失敗LOADは現在ownerを失効させるhudを発行しない");
// 同じ画面からLOADを再試行しても元データと購読者を維持する。
assert.equal(core.loadFromSlot(manualKey), null);
assert.strictEqual(core.state, previous);
assert.equal(JSON.stringify(previous), previousJSON);
assert.deepEqual(notifications, []);

// 移行による拒否と移行中の例外でも、保存前に失敗してownerを公開しない。
const invalidKey = "suien_remake_slot2";
for (const raw of [JSON.stringify({ day: 1, schema: core.SCHEMA + 1 }), "migration-throws"]) {
  files.set(invalidKey, raw);
  vm.runInContext(`
    globalThis.originalParse = JSON.parse;
    JSON.parse = function(raw) {
      if (raw === "migration-throws") return { day: 1, get schema() { throw new Error("migration failure"); } };
      return originalParse(raw);
    };
  `, context);
  try { assert.equal(core.loadFromSlot(invalidKey), null); }
  finally { vm.runInContext("JSON.parse = originalParse; delete globalThis.originalParse;", context); }
  assert.strictEqual(core.state, previous);
  assert.equal(JSON.stringify(previous), previousJSON);
  assert.equal(files.get(core.SAVE_KEY), originalAuto);
  assert.equal(files.get(manualKey), originalManual);
  assert.equal(files.get(invalidKey), raw);
  assert.deepEqual(notifications, []);
}

// タイトルで現在のstateが無い場合も、失敗後はnullのまま。
core.setState(null);
notifications.length = 0;
assert.equal(core.loadFromSlot(manualKey), null);
assert.equal(core.state, null);
assert.equal(core.save(), false);
assert.deepEqual(notifications, []);
core.setState(previous);
notifications.length = 0;

// 正常時は選んだ枠をオート枠へ書き継ぎ、再起動相当のLOADでも維持する。
failAutoSave = false;
const selected = core.loadFromSlot(manualKey);
assert(selected);
assert.strictEqual(core.state, selected);
assert.equal(selected.day, 10);
assert.equal(notifications.length, 1);
assert.strictEqual(notifications[0].state, selected);
assert.equal(notifications[0].raw, JSON.stringify(selected), "hud時点で書き継ぎ済み");
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

// 外部JSON用validatorは移行後・保存前に動き、拒否時は保存と公開stateを保持する。
failAutoSave = false;
const validatedBefore = core.state;
const validatedJSON = JSON.stringify(validatedBefore);
const autoBeforeValidation = files.get(core.SAVE_KEY);
for (const result of ["false", "throw"]) {
  const raw = JSON.stringify({ ...core.newState(), schema: 25, chapter: 4, day: 50, phase: "daily", flags: {} });
  files.set(invalidKey, raw);
  notifications.length = 0;
  let calls = 0;
  assert.equal(core.loadFromSlot(invalidKey, { validate(candidate) {
    calls++;
    assert.equal(candidate.schema, core.SCHEMA, "validator receives migrated candidate");
    assert.equal(candidate.chapter, 4);
    if (result === "throw") throw new Error("invalid chapter progress");
    return false;
  } }), null);
  assert.equal(calls, 1);
  assert.strictEqual(core.state, validatedBefore);
  assert.equal(JSON.stringify(core.state), validatedJSON);
  assert.equal(files.get(core.SAVE_KEY), autoBeforeValidation);
  assert.equal(files.get(invalidKey), raw);
  assert.deepEqual(notifications, []);
}
let accepted = false;
assert(core.loadFromSlot(invalidKey, { validate(candidate) { accepted = candidate.schema === core.SCHEMA; } }));
assert(accepted, "valid migrated candidate may be accepted");

// 旧版の既定を移行し、新版で選び直した既読のみは保持する。
assert.equal(core.loadConfig().skipSeenOnly, false);
files.set(core.CONFIG_KEY, '{"skipSeenOnly":true,"textSpeed":4}');
assert.equal(core.loadConfig().skipSeenOnly, false);
files.set(core.CONFIG_KEY, '{"skipRangeVersion":1,"skipSeenOnly":true}');
assert.equal(core.loadConfig().skipSeenOnly, true);
files.set(core.CONFIG_KEY, '{"skipSeenOnly":false}');
assert.equal(core.loadConfig().skipSeenOnly, false);

// 既存の枠1を残し、増えた枠にも個別に書き込める。
assert.equal(core.SAVE_SLOTS.length, 4);
assert.equal(core.SAVE_SLOTS[0].key, core.SAVE_KEY);
assert.equal(manualKey, "suien_remake_slot1");
const retiredKeys = ["suien_remake_slot2", "suien_remake_slot3"];
for (const key of retiredKeys) files.set(key, originalManual);
const newSlots = core.SAVE_SLOTS.slice(2);
for (const [index, { key }] of newSlots.entries()) {
  core.state.money = 1000 + index;
  assert(core.saveToSlot(key));
}
assert.equal(files.get(manualKey), originalManual);
for (const key of retiredKeys) assert.equal(files.get(key), originalManual);
for (const [index, { key }] of newSlots.entries()) {
  assert.equal(core.loadFromSlot(key)?.money, 1000 + index);
}
assert.equal(core.loadFromSlot(manualKey)?.day, 10);

// 表示したスナップショットの内容で同一性を判定し、表示後の上書きには追従しない。
const [newSlot2, newSlot3] = newSlots.map(({ key }) => key);
files.set(newSlot3, JSON.stringify({ ...core.state, savedAt: Number.MAX_SAFE_INTEGER }));
const entry = core.peekLatestSaveEntry();
assert.equal(entry.key, newSlot3);
assert.equal(core.peekLatestSave().savedAt, entry.data.savedAt);
const replaced = [];
bus.on("state-replaced", ({ sourceRaw, previousAutoRaw, autoResume }) => replaced.push({ sourceRaw, previousAutoRaw, autoResume }));
const initialAuto = core.currentAutoSaveSource();
assert(core.loadFromSlot(entry.key, { expectedRaw: entry.raw }));
assert.deepEqual(replaced.at(-1), { sourceRaw: entry.raw, previousAutoRaw: initialAuto, autoResume: false });
const rewrittenAuto = core.currentAutoSaveSource();
assert(core.loadFromSlot(entry.key));
assert.deepEqual(replaced.at(-1), { sourceRaw: entry.raw, previousAutoRaw: rewrittenAuto, autoResume: false });
assert(core.loadFromSlot(newSlot2));
assert.notEqual(replaced.at(-1).sourceRaw, entry.raw);
const beforeRejected = core.state;
files.set(newSlot3, JSON.stringify({ ...entry.data, day: entry.data.day + 1 }));
assert.equal(core.loadFromSlot(entry.key, { expectedRaw: entry.raw }), null);
assert.equal(core.state, beforeRejected);
assert.equal(replaced.length, 3);

console.log("PASS: LOADの保存失敗・状態復元・原文照合、最新枠、AUTO・手動3枠の互換性、SKIP既定値と保存済み設定");
