// node --experimental-vm-modules remake/test/save_transfer_progress.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const files = new Map();
let failKey = null;
const slotKey = "suien_remake_save";
const galleryKey = "suien_remake_gallery";
const progressKey = "suien_remake_gallery_progress";
const cycleKey = "suien_remake_cycle";
const ctx = vm.createContext({
  TextEncoder, TextDecoder, Uint8Array, Date, console,
  btoa, atob,
  localStorage: {
    getItem: key => files.get(key) ?? null,
    setItem: (key, value) => {
      if (key === failKey) throw Error("quota");
      files.set(key, String(value));
    },
    removeItem: key => files.delete(key),
  },
});
const synthetic = exports => new vm.SyntheticModule(Object.keys(exports), function () {
  for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
}, { context: ctx });
const stubs = new Map([
  ["../core/util.js", synthetic({ el: () => null })],
  ["../core/ui.js", synthetic({ layers: {}, toast: () => {} })],
  ["../core/state.js", synthetic({
    SAVE_SLOTS: [{ key: slotKey, label: "オート" }],
    readSlot: key => { try { return JSON.parse(files.get(key)); } catch { return null; } },
    isLoadableSave: s => s.schema === 26,
  })],
  ["./carry.js", synthetic({ buildCarryPackage: () => ({}) })],
]);
const source = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const gallery = new vm.SourceTextModule(source("../js/core/gallery-progress.js"), { context: ctx });
const cycle = new vm.SourceTextModule(source("../js/core/cycle-meta.js"), { context: ctx });
const transfer = new vm.SourceTextModule(source("../js/scenes/save-transfer.js"), { context: ctx });
await gallery.link(() => { throw Error("unexpected gallery import"); });
await cycle.link(spec => spec === "./gallery-progress.js" ? gallery : stubs.get(spec));
await transfer.link(spec => spec === "../core/gallery-progress.js" ? gallery
  : spec === "../core/cycle-meta.js" ? cycle : stubs.get(spec));
await Promise.all([gallery.evaluate(), cycle.evaluate(), transfer.evaluate()]);
const { exportSaveText, parseSaveText, applySlots } = transfer.namespace;
const put = (key, value) => files.set(key, JSON.stringify(value));
const get = key => JSON.parse(files.get(key));
const clone = () => new Map(files);
const slot = { schema: 26, day: 8, money: 700 };
const photo = { chapter: 1, day: 2, slot: 1, mode: "pair", people: ["hajime", "ageha"] };
const cycleData = (id, at, wins) => ({ version: 1, unlocked: true,
  trueEnds: [{ cycleId: id, cycle: 2, at, loversAtEnd: ["minto"] }],
  highestCycleStarted: 3,
  carryPackage: { fromCycleId: id, fromCycle: 2, at, data: { money: wins } },
  lifetime: { tournamentWins: wins, tournamentAttempts: wins + 2 },
});

// 現行ファイルを別保存領域へ往復する。
put(slotKey, slot);
put(galleryKey, ["cg_minto_cheki"]);
put(progressKey, { clearedChapters: [1], keepsakes: ["minto_first_cheki"], purikura: [photo],
  routeRecords: { minto: { becameLover: true, eventsSeen: [1], trueEndAsLover: false } } });
put(cycleKey, cycleData("cycle-a", "2026-01-01T00:00:00Z", 3));
const exported = exportSaveText();
assert.match(exported, /^SUIEN-SAVE1:/);
const imported = parseSaveText(exported);
assert(imported);
files.clear();
assert.equal(applySlots(imported), true);
assert.deepEqual(get(slotKey), slot);
assert.deepEqual(get(galleryKey), ["cg_minto_cheki"]);
assert.deepEqual(get(progressKey).clearedChapters, [1]);
assert.equal(get(progressKey).routeRecords.minto.eventsSeen[0], 1);
assert.equal(get(cycleKey).carryPackage.fromCycleId, "cycle-a");

// 移行先にある実績を消さず、同じ周回の到達は重複させない。
put(galleryKey, ["cg_ageha_first_purikura"]);
put(progressKey, { clearedChapters: [2], purikura: [{ ...photo, chapterDay: 2 }],
  routeRecords: { minto: { becameLover: false, eventsSeen: ["2b"], trueEndAsLover: true },
    ageha: { becameLover: true } } });
put(cycleKey, { ...cycleData("cycle-b", "2026-02-01T00:00:00Z", 5),
  trueEnds: [...cycleData("cycle-b", "2026-02-01T00:00:00Z", 5).trueEnds,
    { cycleId: "cycle-a", cycle: 2, at: null, loversAtEnd: ["ageha"] }] });
assert.equal(applySlots(imported), true);
assert.deepEqual(get(galleryKey), ["cg_ageha_first_purikura", "cg_minto_cheki"]);
assert.deepEqual(get(progressKey).clearedChapters, [1, 2]);
assert.deepEqual(get(progressKey).routeRecords.minto.eventsSeen, ["2b", 1]);
assert.equal(get(progressKey).routeRecords.minto.trueEndAsLover, true);
assert.equal(get(progressKey).routeRecords.ageha.becameLover, true);
assert.equal(get(progressKey).purikura[0].chapterDay, 2);
assert.deepEqual(get(cycleKey).trueEnds.map(e => e.cycleId), ["cycle-b", "cycle-a"]);
assert.deepEqual(get(cycleKey).trueEnds[1].loversAtEnd, ["ageha", "minto"]);
assert.equal(get(cycleKey).carryPackage.fromCycleId, "cycle-b");
assert.equal(get(cycleKey).lifetime.tournamentWins, 5);
const mergedOnce = clone();
assert.equal(applySlots(imported), true);
assert.deepEqual(files, mergedOnce, "repeat import is idempotent");

// 旧 SUIEN-SAVE1 は進捗なしで読み込め、既存進捗を保つ。
const oldText = "SUIEN-SAVE1:" + Buffer.from(JSON.stringify({ format: "suien-save", version: 1,
  slots: { [slotKey]: JSON.stringify(slot) } })).toString("base64");
const old = parseSaveText(oldText);
assert(old);
const beforeOld = clone();
assert.equal(applySlots(old), true);
for (const key of [galleryKey, progressKey, cycleKey]) assert.equal(files.get(key), beforeOld.get(key));

// 後半キーで保存が失敗してもスロットと進捗を戻す。
const beforeFailure = clone();
failKey = cycleKey;
assert.equal(applySlots(imported), false);
failKey = null;
assert.deepEqual(files, beforeFailure);
assert.equal(parseSaveText("SUIEN-SAVE1:@@@"), null);
const invalidProgress = "SUIEN-SAVE1:" + Buffer.from(JSON.stringify({ format: "suien-save", version: 1,
  slots: { [slotKey]: JSON.stringify(slot) }, progress: { [cycleKey]: { version: 99, unlocked: true } },
})).toString("base64");
assert.equal(parseSaveText(invalidProgress), null, "future cycle version is rejected instead of lost");
console.log("save transfer progress: PASS");
