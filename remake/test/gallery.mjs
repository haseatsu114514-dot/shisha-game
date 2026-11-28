// node --experimental-vm-modules remake/test/gallery.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("../js/core/", import.meta.url), storage = new Map();
let failWrites = false;
const context = vm.createContext({ console, Date, Math, setTimeout, clearTimeout, localStorage: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => { if (failWrites) throw Error("storage unavailable"); storage.set(key, value); },
  removeItem: key => storage.delete(key),
} });
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const mod = new vm.SourceTextModule(fs.readFileSync(url, "utf8"), { context, identifier: url.href });
  modules.set(url.href, mod); await mod.link(s => load(new URL(s, url))); return mod;
}
const stateModule = await load(new URL("state.js", root)); await stateModule.evaluate();
const catalogModule = await load(new URL("gallery-catalog.js", root)); await catalogModule.evaluate();
const core = stateModule.namespace, g = modules.get(new URL("gallery-progress.js", root).href).namespace;
const { galleryEntries, galleryStats, galleryHint, CHAR_LABELS, GALLERY_TABS } = catalogModule.namespace;
const copy = v => JSON.parse(JSON.stringify(v));
const photo = { chapter: 2, day: 18, slot: 1, mode: "guest", people: ["hajime", "samechan"] };
// First upgraded LOAD: seed pre-feature disk data directly, without save() or a gallery scan.
{
  const legacy = core.newState();
  Object.assign(legacy, { chapter: 2, day: 19, phase: "daily" });
  legacy.flags._ch1_cleared = true;
  legacy.flags._ch2_preview_seen = true;
  legacy.keepsakes = ["minto_first_cheki"];
  legacy.flags._ageha_purikura_history = [photo];
  const earlier = core.newState();
  Object.assign(earlier, { day: 2, phase: "daily", money: 12345, stamina: 61 });
  const slot = "suien_remake_slot1", otherSlot = "suien_remake_slot2";
  const seed = () => {
    storage.clear();
    storage.set(core.SAVE_KEY, JSON.stringify(legacy));
    storage.set(slot, JSON.stringify(earlier));
    storage.set(otherSlot, JSON.stringify({ ...earlier, day: 3 }));
    storage.set("suien_remake_gallery", JSON.stringify(["cg_minto_cheki"]));
  };
  seed(); core.load();
  const owner = core.state, before = [...storage];
  assert.equal(core.loadFromSlot("missing-slot"), null);
  assert.equal(core.state, owner, "failed selection cannot replace the current owner");
  assert.deepEqual([...storage], before, "no selection leaves autosave and collection untouched");
  storage.set("broken-slot", "{broken");
  assert.equal(core.loadFromSlot("broken-slot"), null);
  assert.equal(core.state, owner, "corrupt target cannot replace the current owner");
  assert(!storage.has(g.GALLERY_PROGRESS_KEY), "invalid target does not manufacture collection records");
  const slotsBefore = [storage.get(slot), storage.get(otherSlot)];
  const loaded = core.loadFromSlot(slot);
  assert.notEqual(loaded, owner);
  assert.equal(loaded, core.state);
  assert.deepEqual([loaded.day, loaded.money, loaded.stamina], [2, 12345, 61]);
  const kept = copy(g.readGalleryProgress());
  assert.deepEqual(kept, { clearedChapters: [1], keepsakes: ["minto_first_cheki"], purikura: [photo], routeRecords: {}, completeAnnounced: false },
    "older-slot LOAD preserves legacy autosave-only photos and explicit clear before overwrite");
  assert.deepEqual([storage.get(slot), storage.get(otherSlot)], slotsBefore, "manual slots are read-only");
  assert.equal(storage.get("suien_remake_gallery"), '["cg_minto_cheki"]', "seen CGs stay untouched");
  core.loadFromSlot(slot); core.loadFromSlot(otherSlot);
  assert.deepEqual(copy(g.readGalleryProgress()), kept, "repeated older LOADs neither revoke nor duplicate records");
  seed();
  // Parseable old JSON may contain an unusable ID. Only the legacy import is best effort.
  storage.set(core.SAVE_KEY, JSON.stringify({ chapter: 2, day: 19, phase: "daily", flags: {},
    keepsakes: [{ toString: null, valueOf: null }] }));
  const previousOwner = core.state;
  assert.doesNotThrow(() => core.loadFromSlot(slot), "malformed old collection must not abort a valid LOAD");
  assert.notEqual(core.state, previousOwner);
  const written = JSON.parse(storage.get(core.SAVE_KEY));
  assert.deepEqual([written.day, written.money, written.stamina], [2, 12345, 61],
    "valid LOAD must replace the old autosave even if legacy collection import throws");
  assert.equal(storage.get(slot), JSON.stringify(earlier), "malformed legacy import cannot rewrite the source slot");
  assert.deepEqual(copy(g.readGalleryProgress()), { clearedChapters: [], keepsakes: [], purikura: [], routeRecords: {}, completeAnnounced: false },
    "malformed collection IDs cannot manufacture unlocks");
  seed(); storage.set(core.SAVE_KEY, "{broken");
  assert.doesNotThrow(() => core.loadFromSlot(slot));
  assert.deepEqual(copy(g.readGalleryProgress()), { clearedChapters: [], keepsakes: [], purikura: [], routeRecords: {}, completeAnnounced: false },
    "corrupt autosave and chapter/day alone cannot manufacture unlocks");
  seed(); failWrites = true;
  assert.doesNotThrow(() => core.loadFromSlot(slot));
  assert.deepEqual([core.state.day, core.state.money, core.state.stamina], [2, 12345, 61],
    "unavailable collection storage cannot block the existing LOAD contract");
  assert.equal(storage.get(slot), JSON.stringify(earlier));
  failWrites = false; storage.clear();
}
// 写真の日付は撮影元の章開始日でだけ補完し、保存枠を替えても失わない。
{
  const title = () => galleryEntries({ cgs: [] }, {}, g.readGalleryProgress(), []).find(e => e.photo).title;
  const owner = { chapter: 3, flags: { _ch2_day1: { startDay: 15 }, _ageha_purikura_history: [{ ...photo, day: 17 }] } };
  const id = g.purikuraId(owner.flags._ageha_purikura_history[0]);
  g.recordGalleryProgress(owner);
  assert.equal(g.readGalleryProgress().purikura[0].chapterDay, 3);
  assert.equal(g.purikuraId(g.readGalleryProgress().purikura[0]), id, "chapter DAY does not change identity");
  assert.match(title(), /第2章・DAY3 /);
  g.recordGalleryProgress({ flags: { _ageha_purikura_history: [{ ...photo, day: 17 }] } });
  assert.equal(g.readGalleryProgress().purikura.length, 1);
  assert.equal(g.readGalleryProgress().purikura[0].chapterDay, 3, "older save cannot erase enriched date");
  storage.clear();
  g.recordGalleryProgress({ flags: { _ageha_purikura_history: [{ ...photo, day: 17 }] } });
  assert.match(title(), /DAY17 /, "no start date keeps the legacy display");
  g.recordGalleryProgress(owner);
  assert.match(title(), /DAY3 /, "a later matching save enriches the same record");
  assert.equal(g.readGalleryProgress().purikura.length, 1);
  storage.clear();
  for (const startDay of [undefined, 0, -1, "15", 18]) {
    g.recordGalleryProgress({ flags: { _ch2_day1: { startDay }, _ageha_purikura_history: [{ ...photo, day: 17 }] } });
    assert.equal(g.readGalleryProgress().purikura[0].chapterDay, undefined, "unusable start date is not guessed");
  }
  storage.clear();
  for (const invalid of [0, -1, 1.5, "3", null]) {
    storage.set(g.GALLERY_PROGRESS_KEY, JSON.stringify({ purikura: [{ ...photo, chapterDay: invalid }] }));
    assert.deepEqual(copy(g.readGalleryProgress().purikura), [photo], "invalid optional date does not destroy photo");
  }
  storage.clear();
  g.recordGalleryProgress({ flags: { _ageha_purikura_history: [{ ...photo, chapterDay: 4 }], _ch2_day1: { startDay: 1 } } });
  assert.equal(g.readGalleryProgress().purikura[0].chapterDay, 4, "explicit date wins over conversion");
  g.recordGalleryProgress({ flags: { _ch2_day1: { startDay: 15 } } });
  assert.equal(g.readGalleryProgress().purikura[0].chapterDay, 4, "another save cannot redate collection-only evidence");
  storage.clear();
}
const value = core.newGame();
core.save(); assert(!storage.has(g.GALLERY_PROGRESS_KEY), "a fresh save does not create unlocks");
Object.assign(value, { chapter: 3, phase: "daily", day: 100 });
value.flags._ch2_preview_seen = true; core.save();
assert.deepEqual(copy(g.readGalleryProgress().clearedChapters), [], "chapter/day/preview do not prove a clear");
Object.assign(value, { chapter: 1, phase: "cleared" }); core.save();
assert.deepEqual(copy(g.readGalleryProgress().clearedChapters), [1], "first chapter clear records before entering chapter two");
Object.assign(value, { chapter: 2, phase: "daily" }); value.flags._ch1_cleared = true;
value.keepsakes = ["minto_first_cheki", "unrelated_keepsake"];
value.flags._ageha_purikura_history = [photo, photo, { ...photo, mode: "solo" }, { ...photo, people: ["unknown", "samechan"] }];
core.save(); const saved = storage.get(core.SAVE_KEY);
let progress = g.readGalleryProgress();
assert.equal(progress.purikura.length, 1, "only received valid photos; repeat saves do not duplicate them");
assert.deepEqual(copy(progress.keepsakes), ["minto_first_cheki"]);
value.flags._ch2_cleared = true; value.phase = "cleared"; core.save();
core.wipeSave(); core.newGame(); core.save();
progress = g.readGalleryProgress();
assert.deepEqual(copy(progress.clearedChapters), [1, 2]); assert.equal(progress.purikura.length, 1);
storage.set(core.SAVE_KEY, saved); core.load(); core.save();
assert.deepEqual(copy(g.readGalleryProgress().clearedChapters), [1, 2], "loading earlier progress cannot revoke collection unlocks");
assert.equal(core.state.money, value.money, "gallery persistence leaves gameplay resources alone");
const manifest = { cgs: ["cg_story.png", "cg_minto_first_cheki.png", "cg_ageha_first_purikura.png", "cg_story.png"] };
const comic = { id: "approved_comic", kind: "comic", title: "採用済みの漫画", approved: true, requiredChapter: 1, pages: ["img/comics/one.webp", "img/comics/two.webp"] };
const lateComic = { id: "late_comic", kind: "comic", title: "未来の漫画", approved: true, requiredChapter: 3, pages: ["img/comics/late.webp"] };
const movie = { id: "approved_movie", kind: "movie", title: "採用済みの動画", approved: true, requiredChapter: 1, src: "movies/one.webm" };
const items = [comic, lateComic, movie, { ...comic, id: "candidate", approved: false }, { ...comic, id: "missing_approval", approved: undefined },
  { ...comic, id: "missing_gate", requiredChapter: undefined }, { ...comic, id: "archive", pages: ["../asset_sources/candidate.png"] },
  null, { ...comic }];
const entries = galleryEntries(manifest, { items }, progress, new Set(["cg_story", movie.id]));
assert.deepEqual(copy(GALLERY_TABS.map(([kind]) => kind)), ["all", "still", "cheki", "purikura", "comic"]);
assert.equal(entries.filter(e => e.id === "cg_story").length, 1, "duplicate manifest ids produce one card");
assert(entries.find(e => e.id === "cg_minto_first_cheki").unlocked, "owned cheki works without a legacy seen-CG record");
assert(!entries.find(e => e.id === "cg_ageha_first_purikura").unlocked);
assert(entries.find(e => e.id === comic.id).unlocked);
assert(!entries.find(e => e.id === lateComic.id).unlocked, "a later-chapter comic remains locked");
assert.equal(entries.find(e => e.id === movie.id), undefined, "movie entries and legacy movie IDs are ignored");
assert.equal(entries.filter(e => e.kind === "comic").length, 2, "candidates, movies and invalid entries never enter the collection");
assert.equal(entries.filter(e => e.photo).length, 1);
const empty = { clearedChapters: [], keepsakes: [], purikura: [], routeRecords: {}, completeAnnounced: false };
assert(!galleryEntries(manifest, { items: [comic] }, empty, new Set()).find(e => e.id === comic.id).unlocked);
// 採用シールだけを命名・解放し、旧manifestや既見記録に候補が残っていても隠す。
const actualManifest = JSON.parse(fs.readFileSync(new URL("../data/manifest.json", import.meta.url), "utf8"));
const strip = "cg_ch2_ageha_purikura_strip";
const candidates = [strip + "_soft", strip + "_gal"];
const legacyManifest = { ...actualManifest, cgs: [...actualManifest.cgs, ...candidates.map(id => id + ".png")] };
for (const seen of [[], [strip, ...candidates]]) {
  const photos = galleryEntries(legacyManifest, {}, empty, new Set(seen)).filter(e => e.id.startsWith(strip));
  assert.equal(photos.length, 1);
  assert.equal(photos[0].id, strip);
  assert.equal(photos[0].title, "あげはと半分このプリクラ");
  assert.equal(photos[0].kind, "purikura");
  assert.equal(photos[0].unlocked, seen.includes(strip));
}
// 収集対象は正式CG＋採用済み作品。撮影記録は別の件数として扱う。
const actualCatalog = JSON.parse(fs.readFileSync(new URL("../data/gallery.json", import.meta.url), "utf8"));
const actualEntries = galleryEntries(actualManifest, actualCatalog, empty, new Set());
assert.equal(galleryHint(actualEntries.find(e => e.id === "cg_ch1_minto_casual_reveal")), "第1章・みんと");
assert.equal(galleryHint(actualEntries.find(e => e.id === "cg_ch1_sui_smile")), "第1章");
assert.equal(galleryHint(actualEntries.find(e => e.id === "cg_minto_confession")), "みんと");
assert.equal(galleryHint(actualEntries.find(e => e.id === "cg_hiyori_confession")), "");
assert.equal(galleryHint({ requiredChapter: 3, char: "minto" }), "第3章クリアで解放");
const actualStats = galleryStats(actualEntries);
const adoptedStills = [
  ["cg_ch2_kanzaki_id_check", 2, "other", "神崎煙草店の年齢確認"],
  ["cg_ch2_sofa_wet_cloth", 2, "other", "焦げ跡と濡れ布"],
  ["cg_ch2_ageha_lesson", 2, "ageha", "あげはの吸い方講座"],
  ["cg_ch2_naru_score_sheet", 2, "naru", "光る採点表"],
  ["cg_ch2_rest_notebook", 2, "other", "ノートを閉じた日"],
  ["cg_ch2_rei_earphone", 2, "other", "片耳ぶんの一曲"],
  ["cg_ch2_ageha_white_bear", 2, "ageha", "白いクマと閉店後"],
  ["cg_ch3_mashiro_no_craft_day", 3, "mashiro", "作らないと決めた昼"],
  ["cg_ch3_liars_night", 3, "other", "嘘つきたちの夜"],
  ["cg_ch3_national_ask_customer", 3, "other", "炭より先に、客の返事"],
  ["cg_ch3_half_cake", 3, "mashiro", "半分ずつのケーキ"],
  ["cg_ch3_mukai_latte_cat", 3, "other", "そっぽを向く泡の猫"],
  ["cg_ch4_traveler_chair", 4, "other", "日陰の椅子"],
  ["cg_ch4_festa_welcome", 4, "other", "FESTAの椅子と水"],
  ["cg_ch4_traveler_tongs", 4, "other", "返したトング"],
  ["cg_ch4_sheikh_reveal", 4, "other", "四つ目の台"],
  ["cg_ch4_young_sumi_water", 4, "other", "十五年前の一杯の水"],
  ["cg_ch4_noor_pencil_x", 4, "other", "消さなかった×"],
  ["cg_ch4_creek_dhow", 4, "other", "クリークの荷積み"],
  ["cg_ch5_party_toast", 5, "other", "世界一の乾杯"],
  ["cg_ch5_doctor_yunomi", 5, "other", "湯のみを包む博士"],
  ["cg_ch5_tsumugi_serves_hajime", 5, "tsumugi", "最初は、ゆっくりどうぞ"],
  ["cg_ch5_adam_two_bowls", 5, "other", "どの顔だった"],
  ["cg_ch5_regular_hose_lap", 5, "other", "今日は時間、あるから"],
  ["cg_ch5_cocreation_notes", 5, "other", "数字の隣に味の言葉"],
  ["cg_ch5_sumi_pulls_chair", 5, "other", "おかえりの椅子"],
];
const unlockedStills = galleryEntries(actualManifest, actualCatalog, empty, new Set(adoptedStills.map(([id]) => id)));
for (const [id, chapter, char, title] of adoptedStills) {
  const entry = actualEntries.find(item => item.id === id);
  assert(entry, id);
  assert.deepEqual({ chapter: entry.chapter, char: entry.char, title: entry.title, kind: entry.kind }, { chapter, char, title, kind: "still" });
  assert.equal(entry.unlocked, false, id);
  assert.equal(unlockedStills.find(item => item.id === id).unlocked, true, id);
}
// PEPPERMINTのチェキ（PFC14・15・17）。みんと・第1章・題名つきで、記念品として持てば解放される（見たCGの記録が無くても）。
const { ALL_MINTO_CHEKIS } = modules.get(new URL("minto-cheki-data.js", root).href).namespace;
assert.equal(ALL_MINTO_CHEKIS.length, 15);
for (const c of ALL_MINTO_CHEKIS) {
  const entry = actualEntries.find(item => item.id === c.cg);
  assert(entry, c.cg);
  assert.deepEqual({ chapter: entry.chapter, char: entry.char, kind: entry.kind, unlocked: entry.unlocked },
    { chapter: 1, char: "minto", kind: "cheki", unlocked: false }, c.cg);
  assert.equal(entry.title, (c.secret ? "ないしょのチェキ・" : c.twoShot ? "2ショットチェキ・" : "みんとのチェキ・") + c.label);
  const owned = galleryEntries(actualManifest, actualCatalog, g.normalizeGalleryProgress({ keepsakes: [c.id] }), new Set());
  assert.equal(owned.find(item => item.id === c.cg).unlocked, true, c.id);
}
// MELTY PUFF のプリクラ（PFC18）。第2章・プリクラの札で、撮影の記録に絵があれば解放（絵のある記録は撮影ごとの項目に重ねない）。
const { PURIKURA_PHOTOS } = modules.get(new URL("purikura-data.js", root).href).namespace;
assert.equal(PURIKURA_PHOTOS.length, 38); // PFC18・20 の32枚と私服のみんとの6枚。
for (const lover of [false, true]) {
  assert.equal(PURIKURA_PHOTOS.filter(p => p.with === "minto" && !!p.lover === lover).length, 3);
}
const purikuraChar = { minto: "minto", ageha: "ageha", tsumugi: "tsumugi", rio: "rio" };
for (const p of PURIKURA_PHOTOS) {
  const entry = actualEntries.find(item => item.id === p.cg);
  assert(entry, p.cg);
  assert.deepEqual({ chapter: entry.chapter, char: entry.char, kind: entry.kind, title: entry.title, unlocked: entry.unlocked },
    { chapter: 2, char: purikuraChar[p.with] || "other", kind: "purikura", title: p.label, unlocked: false }, p.cg);
  const shot = { chapter: 2, day: 18, slot: 1, mode: p.with === "solo" ? "solo" : p.with === "ageha" ? "pair" : "guest",
    people: p.with === "solo" ? ["hajime"] : ["hajime", p.with], cg: p.cg };
  const owned = galleryEntries(actualManifest, actualCatalog, g.normalizeGalleryProgress({ purikura: [shot] }), new Set());
  assert.equal(owned.find(item => item.id === p.cg).unlocked, true, p.cg);
  assert.equal(owned.filter(item => item.photo).length, 0, "a pictured shot is not repeated as a face photo");
}
{
  const legacy = { chapter: 2, day: 18, slot: 1, mode: "guest", people: ["hajime", "adam"] };
  const mixed = galleryEntries(actualManifest, actualCatalog, g.normalizeGalleryProgress({ purikura: [legacy, { ...legacy, day: 19, cg: "cg_not_in_manifest" }] }), new Set());
  assert.equal(mixed.filter(item => item.photo).length, 2, "shots without a manifest picture stay as face photos");
  assert.equal(g.normalizeGalleryProgress({ purikura: [{ ...legacy, cg: "../evil" }] }).purikura[0].cg, undefined, "an unsafe picture id is dropped");
}
{
  const shot = { ...photo, cg: PURIKURA_PHOTOS[0].cg, design: JSON.stringify({ v: 1, theme: "mint", marks: [] }) };
  const progress = g.normalizeGalleryProgress({ purikura: ["0123456789abcdef", "1111222233334444"].map(printId => ({ ...shot, printId })) });
  const entries = galleryEntries(actualManifest, actualCatalog, progress, new Set());
  assert.equal(entries.filter(e => e.photo?.design === shot.design).length, 2, "two edited prints on the same day survive collection merge");
}
const adoptedChekis = ALL_MINTO_CHEKIS.length + PURIKURA_PHOTOS.length; // チェキとプリクラ（どちらも manifest の写真）
assert.equal(actualManifest.cgs.length, 34 + adoptedStills.length + adoptedChekis);
assert.equal(actualEntries.filter(e => e.cg).length, 31 + adoptedStills.length + adoptedChekis, "two alternate strips and the DAY3 sketch-in-progress are excluded");
assert.equal(actualStats.total, 31 + adoptedStills.length + adoptedChekis, "current catalog has no approved additions");
assert.equal(actualStats.unlocked, 0);
assert.equal(actualStats.rate, 0);
const expectedChars = {
  minto: 5 + ALL_MINTO_CHEKIS.length, ageha: 3, tsumugi: 3, naru: 3, rio: 1, mashiro: 4, other: 12,
};
for (const p of PURIKURA_PHOTOS) expectedChars[purikuraChar[p.with] || "other"]++;
for (const [, , char] of adoptedStills) expectedChars[char]++;
for (const entry of actualEntries) assert(Object.hasOwn(CHAR_LABELS, entry.char), `${entry.id} has a character tag`);
assert.equal(actualEntries.find(e => e.id === "cg_ch3_childhood_offered_hand").char, "mashiro");
for (const [char, total] of Object.entries(expectedChars)) assert.equal(actualStats.byChar[char].total, total, char);
assert.equal(Object.values(actualStats.byChar).reduce((sum, s) => sum + s.total, 0), actualStats.total);
assert.equal(Object.values(actualStats.byKind).reduce((sum, s) => sum + s.total, 0), actualStats.total);
const fullStats = galleryStats(galleryEntries(actualManifest, actualCatalog, empty, new Set(actualEntries.map(e => e.id))));
assert.equal(fullStats.unlocked, 31 + adoptedStills.length + adoptedChekis);
assert.equal(fullStats.rate, 100);
assert.equal(g.shouldAnnounceCompletion(actualStats, empty), false);
assert.equal(g.shouldAnnounceCompletion({ total: 0, unlocked: 0 }, empty), false);
assert.equal(g.shouldAnnounceCompletion(fullStats, empty), true);
storage.clear();
assert.equal(g.readGalleryProgress().completeAnnounced, false);
g.markCompletionAnnounced();
assert.equal(g.shouldAnnounceCompletion(fullStats, g.readGalleryProgress()), false);
const announcedRaw = storage.get(g.GALLERY_PROGRESS_KEY);
g.markCompletionAnnounced();
assert.equal(storage.get(g.GALLERY_PROGRESS_KEY), announcedRaw, "100%告知は一度だけ記録");
g.recordGalleryProgress({ flags: { _ch1_cleared: true } });
assert.equal(g.readGalleryProgress().completeAnnounced, true, "他の進捗更新でも告知済みを維持");
for (const s of Object.values(fullStats.byChar)) assert.equal(s.rate, 100);
const withPhotos = galleryStats(galleryEntries(actualManifest, actualCatalog, { ...empty, purikura: [photo, { ...photo, day: 19 }] }, new Set()));
assert.deepEqual(copy(withPhotos), copy(actualStats));
assert.equal(Object.hasOwn(withPhotos, "purikuraPhotos"), false);
const thirds = [
  { kind: "still", char: "minto", unlocked: true },
  { kind: "still", char: "minto", unlocked: false },
  { kind: "still", char: "minto", unlocked: false },
];
const thirdsBefore = copy(thirds);
const partialStats = galleryStats(thirds);
assert.equal(partialStats.rate, 33);
assert.equal(partialStats.byKind.still.rate, 33);
assert.equal(partialStats.byChar.minto.rate, 33);
assert.deepEqual(thirds, thirdsBefore, "aggregation does not mutate entries");
assert.equal(galleryStats([]).rate, 0);
assert.equal(partialStats.byKind.comic.rate, 0);
assert.equal(partialStats.byKind.movie, undefined);
assert.equal(partialStats.byChar.other.rate, 0);
const adopted = galleryEntries(actualManifest, { items: [
  { ...comic, char: "ageha" }, { ...lateComic, char: "unknown" }, { ...movie, char: "unknown" },
  { ...comic, id: "not_approved", approved: false },
  { ...comic, id: "not_explicitly_approved", approved: undefined },
] }, { ...empty, clearedChapters: [1] }, new Set([movie.id]));
const adoptedStats = galleryStats(adopted);
assert.equal(adoptedStats.total, 33 + adoptedStills.length + adoptedChekis, "only approved comics add to T");
assert.equal(adoptedStats.unlocked, 1);
assert.deepEqual(copy(adoptedStats.byKind.comic), { total: 2, unlocked: 1, rate: 50 });
assert.equal(adoptedStats.byKind.movie, undefined);
assert.equal(adopted.find(e => e.id === comic.id).char, "ageha");
assert.equal(adopted.find(e => e.id === lateComic.id).char, "other");
assert.equal(adopted.find(e => e.id === movie.id), undefined);
assert.equal(entries.find(e => e.id === comic.id).char, "other", "missing character falls back to other");
assert.equal(Object.values(adoptedStats.byChar).reduce((sum, s) => sum + s.total, 0), adoptedStats.total);
console.log(`REAL DATA: raw CGs=${actualManifest.cgs.length}, total=${actualStats.total}, empty seen=${actualStats.unlocked}/${actualStats.total} (${actualStats.rate}%), all seen=${fullStats.unlocked}/${fullStats.total} (${fullStats.rate}%)`);
storage.set(g.GALLERY_PROGRESS_KEY, "{broken"); assert.deepEqual(copy(g.readGalleryProgress()), empty);
storage.set(g.GALLERY_PROGRESS_KEY, JSON.stringify({ clearedChapters: [0, 1, "2", 99], keepsakes: {}, purikura: [null] }));
assert.deepEqual(copy(g.readGalleryProgress()), { ...empty, clearedChapters: [1] });
failWrites = true; assert.doesNotThrow(() => { core.save(); core.wipeSave(); g.recordGalleryProgress(value); });
console.log("PASS: chapter-proof unlocks, old/new saves, persistent photos, approval gates, deduplication and storage failure");
