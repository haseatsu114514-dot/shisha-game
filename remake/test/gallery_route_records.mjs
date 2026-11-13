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
  rio: {}, mashiro: [], tsumugi: null, other: "bad",
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

// 「恋人成立」は告白が実際に成立した時（romance.js の becomeLovers）だけ記録する。断り・同じ相手の再読・
// セーブの取り込み（読み込みや枠の走査）では記録せず、記録の保存に失敗しても交際は成立する。
{
  failWrites = false; storage.clear();
  const save = { lovers: [], loveLevel: {}, lovePts: {}, loverSince: {}, flags: {}, guilt: 0 };
  const known = {
    "../core/state.js": { state: save, save() {} },
    "../core/stats.js": { AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66] },
    "../core/bus.js": { emit() {} },
    "./date-scene.js": { relationshipDayTotal: () => 12 },
  };
  const romanceSource = fs.readFileSync(new URL("../daily/romance.js", root), "utf8");
  const imports = new Map([...romanceSource.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .map(([, names, spec]) => [spec, names.split(",").map(name => name.trim()).filter(Boolean)]));
  const romanceModule = new vm.SourceTextModule(romanceSource, { context, identifier: "romance.js" });
  await romanceModule.link(spec => spec === "../core/gallery-progress.js" ? mod
    : new vm.SyntheticModule(imports.get(spec), function () {
      for (const name of imports.get(spec)) this.setExport(name, Object.hasOwn(known[spec] || {}, name)
        ? known[spec][name] : () => { throw Error(`Unexpected port ${spec}:${name}`); });
    }, { context, identifier: spec }));
  await romanceModule.evaluate();
  const romance = romanceModule.namespace;
  unchanged(() => romance.onDialogueEnter("confession_rio_reject"));
  romance.onDialogueEnter("confession_minto_accept");
  assert.deepEqual(copy(save.lovers), ["minto"]);
  assert.deepEqual(routes(), { minto: record({ becameLover: true }) });
  unchanged(() => romance.onDialogueEnter("confession_minto_accept"));
  romance.onDialogueEnter("ch3_ageha_answer", { metadata: { set_romance: "ageha" } });
  assert.deepEqual(routes(), { minto: record({ becameLover: true }), ageha: record({ becameLover: true }) });
  storage.clear();
  g.recordGalleryProgress(save);
  assert.deepEqual(routes(), {}, "importing a save with lovers does not record 恋人成立");
  failWrites = true;
  assert.doesNotThrow(() => romance.onDialogueEnter("confession_tsumugi_accept"));
  assert(save.lovers.includes("tsumugi"), "a failed gallery write must not undo the relationship");
  failWrites = false;
  console.log("PASS: 恋人成立 is recorded once when a confession succeeds, never from declines, re-reads or save imports");
}

// 「閲覧した段階・派生」は、節目イベントの完読が確定した経路（romance.js の playLoverMilestone と
// サメちゃん専用の playSamechanMilestone）からだけ記録する（#3164 B）。API の直接呼び出しではなく、
// 実際の再生→完読確定→保存→ギャラリー読込（readGalleryProgress）までをつないで確認する。
// 中断・キャンセルでは記録せず、再読しても増殖しない。旧セーブの読み込みでは記録しない（上の節で確認済み）。
{
  failWrites = false; storage.clear(); writes = 0;
  const milestoneState = {
    chapter: 2, day: 10, slot: 2, phase: "daily", lovers: ["tsumugi", "minto", "samechan"],
    loveLevel: { tsumugi: 1, minto: 1, samechan: 1 }, lovePts: {}, loverSince: {},
    loverEventsSeen: [], flags: {}, guilt: 0, romanceChoices: {}, finales: {}, inbox: [], limeRead: [], lastDate: {},
  };
  const scene = { lines: [{ speaker: "", text: "x" }] };
  const milestoneDb = { dialogues: {
    lover_tsumugi_lv1: scene, lover_tsumugi_lv1_b: scene, lover_minto_lv1: scene, lover_samechan_lv1: scene,
  }, lover: {} };
  let playResult = {};
  const playedIds = [];
  const stubValues = {
    "../core/data.js": { DB: milestoneDb, callName: () => "相手" },
    "../core/state.js": { state: milestoneState, save() {} },
    "../core/stats.js": {
      gainAffinity() {}, releaseLoveAffinity() {}, privateBondScope: () => () => {},
      addStamina() {}, bond: { private: false }, AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66],
    },
    "../core/chapter-clock.js": { chapterDay: () => 1, departurePrep: () => false },
    "../core/bus.js": { emit() {} },
    "../core/hiyori-route.js": { hiyoriRoute: () => ({}), hiyoriFinaleReady: () => false },
    "../vn/engine.js": {
      play: async (id) => { playedIds.push(typeof id === "string" ? id : id?.dialogue_id); return playResult; },
      isPlaying: () => false,
    },
    "./date-scene.js": { dateScene() {}, dateVenue() {}, relationshipDayTotal: () => 10 },
    "./samechan-date.js": { playSamechanDate: async () => {}, samechanDateGap: () => 99, samechanDateReady: () => false },
    "../core/affinity-stages.js": { questionDoneKey: (id) => `_question_${id}` },
  };
  const loadLinked = async (file, identifier, extra = {}) => {
    const source = fs.readFileSync(new URL(file, root), "utf8");
    const imports = new Map([...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
      .map(([, names, spec]) => [spec, names.split(",").map(name => name.trim()).filter(Boolean)]));
    const module = new vm.SourceTextModule(source, { context, identifier });
    await module.link(spec => {
      if (spec === "../core/gallery-progress.js") return mod;
      if (Object.hasOwn(extra, spec)) return extra[spec];
      return new vm.SyntheticModule(imports.get(spec), function () {
        for (const name of imports.get(spec)) this.setExport(name, Object.hasOwn(stubValues[spec] || {}, name)
          ? stubValues[spec][name] : () => { throw Error(`Unexpected port ${spec}:${name}`); });
      }, { context, identifier: spec });
    });
    await module.evaluate();
    return module;
  };
  const samechanModule = await loadLinked("../daily/samechan-bonds.js", "samechan-bonds-milestone.js");
  const romanceModule2 = await loadLinked("../daily/romance.js", "romance-milestone.js",
    { "./samechan-bonds.js": samechanModule });
  const romance2 = romanceModule2.namespace;

  // 通常ルート: Lv1 の完読で段階 1、続く _b 派生の完読で "1b" が、段階と派生を区別して残る。
  assert.equal(await romance2.playLoverMilestone("tsumugi"), true);
  assert.deepEqual(playedIds, ["lover_tsumugi_lv1"]);
  assert.deepEqual(copy(milestoneState.loverEventsSeen), ["lover_tsumugi_lv1"]);
  assert.deepEqual(routes(), { tsumugi: record({ eventsSeen: [1] }) });
  assert.equal(await romance2.playLoverMilestone("tsumugi"), true);
  assert.deepEqual(routes(), { tsumugi: record({ eventsSeen: [1, "1b"] }) });
  // 未読が無ければ再生も記録もしない（保存への書き込みも無い）。
  {
    const before = storage.get(g.GALLERY_PROGRESS_KEY), count = writes;
    assert.equal(await romance2.playLoverMilestone("tsumugi"), false);
    assert.equal(storage.get(g.GALLERY_PROGRESS_KEY), before);
    assert.equal(writes, count);
  }
  // キャンセルした再生では、既読にも閲覧記録にも残らない。
  playResult = { cancelled: true };
  assert.equal(await romance2.playLoverMilestone("minto"), false);
  assert(!milestoneState.loverEventsSeen.includes("lover_minto_lv1"));
  assert.equal(routes().minto, undefined);
  // サメちゃん専用ルート: キャンセルでは記録せず、完読で段階 1 が残る。再読では増殖しない。
  assert.equal(await romance2.playLoverMilestone("samechan"), false);
  assert.equal(routes().samechan, undefined);
  playResult = {};
  assert.equal(await romance2.playLoverMilestone("samechan"), true);
  assert.deepEqual(routes().samechan, record({ eventsSeen: [1] }));
  assert.equal(await romance2.playLoverMilestone("samechan"), false);
  assert.deepEqual(routes().samechan, record({ eventsSeen: [1] }));
  console.log("PASS: 恋人節目の完読だけが閲覧した段階・派生を記録し、キャンセル・再読では増えない");
}


// #3164 A: 移行は実際の外装→parse→保存→記録の読込まで通す。state/UIのみ隔離。
{
  const files = new Map(), data = new Map();
  let failKey = null, failRead = null, persistentFailure = false, writeCount = 0;
  const ctx = vm.createContext({ console, TextEncoder, TextDecoder, atob, btoa,
    localStorage: {
      getItem: key => { if (key === failRead) throw Error("read denied"); return data.get(key) ?? null; },
      setItem: (key, value) => { writeCount++; if (key === failKey) { if (!persistentFailure) failKey = null; throw Error("quota"); } data.set(key, value); },
      removeItem: key => data.delete(key),
    },
  });
  const slots = [{ key: "suien_remake_save" }, { key: "suien_remake_slot1" }];
  const dummy = (values, name) => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context: ctx, identifier: name });
  const load = async url => {
    if (files.has(url.href)) return files.get(url.href);
    const path = url.pathname;
    const m = path.endsWith("/util.js") ? dummy({ el: () => {} }, path)
      : path.endsWith("/ui.js") ? dummy({ layers: {}, toast: () => {} }, path)
      : path.endsWith("/state.js") ? dummy({ SAVE_SLOTS: slots,
        readSlot: key => { const raw = data.get(key); return raw ? JSON.parse(raw) : null; },
        isLoadableSave: value => value.schema === 22,
      }, path)
      : path.endsWith("/carry.js") ? dummy({ buildCarryPackage: () => ({}) }, path)
      : new vm.SourceTextModule(fs.readFileSync(url, "utf8"), { context: ctx, identifier: url.href });
    files.set(url.href, m);
    await m.link(spec => load(new URL(spec, url)));
    return m;
  };
  const module = await load(new URL("../js/scenes/save-transfer.js", import.meta.url));
  await module.evaluate();
  const x = module.namespace;
  const cgKey = "suien_remake_gallery", gpKey = "suien_remake_gallery_progress", cmKey = "suien_remake_cycle";
  const saveRaw = JSON.stringify({ schema: 22, day: 8, money: 123 });
  const incomingGallery = { clearedChapters: [1, 5], keepsakes: ["minto_first_cheki"],
    purikura: [{ chapter: 1, day: 2, slot: 1, mode: "pair", people: ["hajime", "ageha"], chapterDay: 2 }],
    routeRecords: { tsumugi: { becameLover: true, eventsSeen: [1, "2b"], trueEndAsLover: true } }, completeAnnounced: true };
  const incomingCycle = { version: 1, unlocked: true, trueEnds: [{ cycleId: "source", cycle: 1, at: "2026-11-10", loversAtEnd: ["tsumugi"] }],
    highestCycleStarted: 2, carryPackage: { fromCycleId: "source", fromCycle: 1, at: "2026-11-10", data: { money: 777 } },
    lifetime: { tournamentAttempts: 6, tournamentWins: 3 } };
  const source = { suien_remake_save: saveRaw, [cgKey]: JSON.stringify(["cg_old_run"]),
    [gpKey]: JSON.stringify(incomingGallery), [cmKey]: JSON.stringify(incomingCycle) };
  Object.entries(source).forEach(([k, v]) => data.set(k, v));
  const exported = x.exportSaveText();
  assert.match(exported, /^SUIEN-SAVE2:/);
  data.clear();
  assert.equal(x.applySlots(x.parseSaveText(exported)), true);
  assert.equal(data.get("suien_remake_save"), saveRaw, "slot raw stays unchanged");
  assert.deepEqual(JSON.parse(data.get(cgKey)), ["cg_old_run"]);
  const actualGallery = files.get(new URL("../js/core/gallery-progress.js", import.meta.url).href).namespace;
  const actualCycle = files.get(new URL("../js/core/cycle-meta.js", import.meta.url).href).namespace;
  assert.deepEqual(copy(actualGallery.readGalleryProgress()), incomingGallery);
  assert.deepEqual(copy(actualCycle.readCycleMeta()), incomingCycle);

  // 移行先の独立記録は残す。古いファイルで高い周回・通算・パッケージを戻さない。
  data.set(cgKey, JSON.stringify(["cg_destination"]));
  data.set(gpKey, JSON.stringify({ clearedChapters: [2], routeRecords: {
    tsumugi: { becameLover: false, eventsSeen: [2], trueEndAsLover: false },
    minto: { becameLover: true, eventsSeen: [1], trueEndAsLover: false } } }));
  const newerPackage = { fromCycleId: "destination", fromCycle: 3, at: "2026-11-11", data: { money: 888 } };
  data.set(cmKey, JSON.stringify({ ...incomingCycle, highestCycleStarted: 4, carryPackage: newerPackage,
    trueEnds: [{ cycleId: "destination", cycle: 3, at: "2026-11-11", loversAtEnd: ["minto"] }],
    lifetime: { tournamentAttempts: 20, tournamentWins: 10 } }));
  data.set("suien_remake_config", "keep config"); data.set("suien_remake_read", "keep read");
  assert.equal(x.applySlots(x.parseSaveText(exported)), true);
  assert.deepEqual(JSON.parse(data.get(cgKey)), ["cg_destination", "cg_old_run"]);
  const merged = copy(actualGallery.readGalleryProgress()), cycle = copy(actualCycle.readCycleMeta());
  assert.deepEqual(merged.clearedChapters, [1, 2, 5]);
  assert.deepEqual(merged.routeRecords.tsumugi.eventsSeen, [2, 1, "2b"]);
  assert(merged.routeRecords.minto.becameLover);
  assert.equal(cycle.trueEnds.length, 2); assert.equal(cycle.highestCycleStarted, 4);
  assert.deepEqual(cycle.carryPackage, newerPackage);
  assert.deepEqual(cycle.lifetime, { tournamentAttempts: 20, tournamentWins: 10 });
  assert.equal(data.get("suien_remake_config"), "keep config"); assert.equal(data.get("suien_remake_read"), "keep read");
  const mergedSnapshot = [...data];
  assert.equal(x.applySlots(x.parseSaveText(exported)), true);
  assert.deepEqual([...data], mergedSnapshot, "repeat import is idempotent");

  // パッケージは新日時のみ採用し、同率・片側の日時不明では移行先を維持する。
  for (const [at, useIncoming] of [["2026-11-09", true], ["2026-11-10", false], [null, false], ["invalid", false]]) {
    const localPackage = { ...newerPackage, at };
    data.set(cmKey, JSON.stringify({ ...cycle, carryPackage: localPackage }));
    assert.equal(x.applySlots(x.parseSaveText(exported)), true);
    assert.deepEqual(copy(actualCycle.readCycleMeta()).carryPackage,
      useIncoming ? incomingCycle.carryPackage : localPackage);
  }
  data.clear(); mergedSnapshot.forEach(([k, v]) => data.set(k, v));

  const envelope = (version, extra = {}) => `SUIEN-SAVE${version}:` + Buffer.from(JSON.stringify({ format: "suien-save", version,
    slots: { suien_remake_save: saveRaw }, ...extra })).toString("base64");
  const legacy = x.parseSaveText(envelope(1));
  assert(legacy); assert.equal(legacy.progress, undefined); assert.equal(x.applySlots(legacy), true);
  assert.deepEqual([...data], mergedSnapshot, "legacy import leaves all cumulative keys alone");
  for (const progress of [null, [], { arbitrary: "[]" }, { [cgKey]: "{}" }, { [cmKey]: '{"version":999}' }, { [gpKey]: "broken" }]) {
    assert.equal(x.parseSaveText(envelope(2, { progress })), null);
    assert.deepEqual([...data], mergedSnapshot);
  }
  for (const key of ["suien_remake_save", cgKey, gpKey, cmKey]) {
    data.set("suien_remake_save", JSON.stringify({ schema: 22, day: 99 }));
    const before = [...data]; failKey = key;
    assert.equal(x.applySlots(x.parseSaveText(exported)), false, key);
    assert.deepEqual([...data], before, "all keys restored after quota failure at " + key);
  }
  failRead = cmKey; const beforeReadFailure = writeCount;
  assert.equal(x.applySlots(x.parseSaveText(exported)), false);
  assert.equal(writeCount, beforeReadFailure, "failed snapshot never starts writes");
  assert.throws(() => x.exportSaveText()); failRead = null;
  data.set(cmKey, '{"version":999}');
  const beforeFuture = [...data], beforeFutureWrites = writeCount;
  assert.equal(x.applySlots(x.parseSaveText(exported)), false, "future destination meta cannot be overwritten");
  assert.equal(writeCount, beforeFutureWrites); assert.deepEqual([...data], beforeFuture);
  assert.throws(() => x.exportSaveText());
  console.log("PASS: save transfer v2 cumulative roundtrip, union, v1 compatibility, idempotence and atomic failure");
}
