// node --experimental-vm-modules remake/test/gallery_route_records.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("../js/core/", import.meta.url), storage = new Map();
let failWrites = false, writes = 0;
const context = vm.createContext({ console, localStorage: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => {
    writes++;
    if (failWrites) throw Error("storage unavailable");
    storage.set(key, value);
  },
} });
const mod = new vm.SourceTextModule(fs.readFileSync(new URL("gallery-progress.js", root), "utf8"), { context });
await mod.link(() => { throw Error("unexpected import"); });
await mod.evaluate();
const g = mod.namespace;
const copy = v => JSON.parse(JSON.stringify(v));
const read = () => copy(g.readGalleryProgress());
const routes = () => read().routeRecords;
const record = (values = {}) => ({ becameLover: false, eventsSeen: [], trueEndAsLover: false, ...values });
const unchanged = fn => {
  const before = storage.get(g.GALLERY_PROGRESS_KEY), count = writes;
  fn();
  assert.equal(storage.get(g.GALLERY_PROGRESS_KEY), before);
  assert.equal(writes, count, "unchanged notifications must not write");
};

// 各通知は対応する項目だけを記録し、他の実績を推測しない。
assert.deepEqual(routes(), {});
g.recordRouteLover("minto");
assert.deepEqual(routes(), { minto: record({ becameLover: true }) });
unchanged(() => g.recordRouteLover("minto"));
g.recordRouteEvent("ageha", 2);
assert.deepEqual(routes(), {
  minto: record({ becameLover: true }), ageha: record({ eventsSeen: [2] }),
});
g.recordRouteTrueEnd(["naru"]);
assert.deepEqual(routes(), {
  minto: record({ becameLover: true }), ageha: record({ eventsSeen: [2] }),
  naru: record({ trueEndAsLover: true }),
});
assert.deepEqual(read().clearedChapters, [5]);
unchanged(() => g.recordRouteTrueEnd(["naru", "naru"]));
g.recordRouteEvent("ageha", "2b");
g.recordRouteEvent("ageha", "2");
assert.deepEqual(routes().ageha.eventsSeen, [2, "2b", "2"]);
unchanged(() => {
  g.recordRouteEvent("ageha", 2);
  g.recordRouteEvent("ageha", "2b");
  g.recordRouteEvent("ageha", "2");
});
g.recordRouteLover("ageha");
g.recordRouteTrueEnd(["ageha", "minto", "ageha"]);
assert.deepEqual(routes(), {
  minto: record({ becameLover: true, trueEndAsLover: true }),
  ageha: record({ becameLover: true, eventsSeen: [2, "2b", "2"], trueEndAsLover: true }),
  naru: record({ trueEndAsLover: true }),
});
assert.deepEqual(read().clearedChapters, [5]);
unchanged(() => g.recordRouteTrueEnd(["minto", "naru", "ageha"]));

// 汎用 state の取り込みは従来の明示クリアと写真だけ。
const photo = { chapter: 1, day: 2, slot: 1, mode: "pair", people: ["hajime", "ageha"] };
const state = {
  lovers: ["minto"], loverEventsSeen: { minto: [1, 2, "2b"] }, finales: { minto: true },
  flags: { _ch1_cleared: true, _ageha_purikura_history: [photo] },
  keepsakes: ["minto_first_cheki"],
};
const kept = routes();
g.recordGalleryProgress(state);
assert.deepEqual(routes(), kept, "state import preserves route records");
storage.clear();
g.recordGalleryProgress(state);
assert.deepEqual(read(), {
  clearedChapters: [1], keepsakes: ["minto_first_cheki"],
  purikura: [{ ...photo, chapterDay: 2 }], routeRecords: {}, completeAnnounced: false,
});
unchanged(() => g.recordGalleryProgress(state));

// 不正な引数は保存も行わない。
storage.clear();
for (const id of [null, undefined, 1, "", "Minto", "a-b", "_minto", "a b", {}, []]) {
  unchanged(() => {
    g.recordRouteLover(id);
    g.recordRouteEvent(id, 2);
  });
}
for (const stage of [NaN, Infinity, -Infinity, "", null, undefined, true, {}, []]) {
  unchanged(() => g.recordRouteEvent("minto", stage));
}
for (const value of [null, undefined, "minto", 1, {}]) {
  unchanged(() => g.recordRouteTrueEnd(value));
}
g.recordRouteTrueEnd(["Bad-ID", null]);
assert.deepEqual(routes(), {}, "invalid IDs do not create route records");
assert.deepEqual(read().clearedChapters, [5]);
unchanged(() => g.recordRouteTrueEnd([]));
storage.clear();
g.recordRouteTrueEnd([]);
assert.deepEqual(read().clearedChapters, [5], "a true end without lovers still clears chapter five");
assert.deepEqual(routes(), {});
g.recordRouteLover("constructor");
assert.deepEqual(routes(), { constructor: record({ becameLover: true }) });

// 保存値の型・フラグ・段階を正規化し、空の記録は除く。
for (const value of [[], ["minto"], "minto", 2, true, null]) {
  storage.set(g.GALLERY_PROGRESS_KEY, JSON.stringify({ routeRecords: value }));
  assert.doesNotThrow(() => g.readGalleryProgress());
  assert.deepEqual(routes(), {});
}
storage.set(g.GALLERY_PROGRESS_KEY, JSON.stringify({ routeRecords: {
  minto: { becameLover: true, eventsSeen: [2, "2b", "2", 2, "2b", null, "", true, {}, [], 0, -1, 1.5, " "],
    trueEndAsLover: 1 },
  ageha: { becameLover: 1, eventsSeen: "2", trueEndAsLover: true },
  naru: { becameLover: "true", eventsSeen: [null, ""], trueEndAsLover: false },
  rin: {}, mashiro: [], tsumugi: null, other: "bad",
  "Bad-ID": { becameLover: true },
} }));
assert.deepEqual(routes(), {
  minto: record({ becameLover: true, eventsSeen: [2, "2b", "2", 0, -1, 1.5, " "] }),
  ageha: record({ trueEndAsLover: true }),
});
storage.set(g.GALLERY_PROGRESS_KEY,
  '{"routeRecords":{"minto":{"eventsSeen":[1e999,-1e999,2,"2",2]}}}');
assert.deepEqual(routes(), { minto: record({ eventsSeen: [2, "2"] }) });
storage.set(g.GALLERY_PROGRESS_KEY, "{broken");
assert.doesNotThrow(() => g.readGalleryProgress());
assert.deepEqual(routes(), {});

// 保存の失敗で通知や既存の取り込みを妨げない。
storage.clear();
failWrites = true;
for (const notify of [
  () => g.recordRouteLover("minto"),
  () => g.recordRouteEvent("ageha", "2b"),
  () => g.recordRouteTrueEnd(["minto", "ageha"]),
  () => g.recordGalleryProgress(state),
]) assert.doesNotThrow(notify);
assert.equal(storage.has(g.GALLERY_PROGRESS_KEY), false);
console.log("PASS: explicit route records, strict stage identity, normalization, preservation and storage failure");
