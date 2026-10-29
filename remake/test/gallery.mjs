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
const { galleryEntries, galleryStats, galleryHint, CHAR_LABELS } = catalogModule.namespace;
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
const movie = { id: "approved_movie", kind: "movie", title: "採用済みの動画", approved: true, requiredChapter: 3, src: "movies/one.webm" };
const items = [comic, movie, { ...comic, id: "candidate", approved: false }, { ...comic, id: "missing_approval", approved: undefined },
  { ...comic, id: "missing_gate", requiredChapter: undefined }, { ...comic, id: "archive", pages: ["../asset_sources/candidate.png"] },
  { ...movie, id: "outside", src: "https://example.test/movie.mp4" }, null, { ...comic }];
const entries = galleryEntries(manifest, { items }, progress, new Set(["cg_story"]));
assert.equal(entries.filter(e => e.id === "cg_story").length, 1, "duplicate manifest ids produce one card");
assert(entries.find(e => e.id === "cg_minto_first_cheki").unlocked, "owned cheki works without a legacy seen-CG record");
assert(!entries.find(e => e.id === "cg_ageha_first_purikura").unlocked);
assert(entries.find(e => e.id === comic.id).unlocked);
assert(!entries.find(e => e.id === movie.id).unlocked, "a later-chapter movie remains locked");
assert.equal(entries.filter(e => ["comic", "movie"].includes(e.kind)).length, 2, "candidates and invalid entries never enter the collection");
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
assert.equal(galleryHint(actualEntries.find(e => e.id === "cg_ch1_nagumo_smile")), "第1章");
assert.equal(galleryHint(actualEntries.find(e => e.id === "cg_minto_confession")), "みんと");
assert.equal(galleryHint(actualEntries.find(e => e.id === "cg_hiyori_confession")), "");
assert.equal(galleryHint({ requiredChapter: 3, char: "minto" }), "第3章クリアで解放");
const actualStats = galleryStats(actualEntries);
assert.equal(actualManifest.cgs.length, 30);
assert.equal(actualEntries.filter(e => e.cg).length, 27, "two alternate strips and the DAY3 sketch-in-progress are excluded");
assert.equal(actualStats.total, 27, "current catalog has no approved additions");
assert.equal(actualStats.unlocked, 0);
assert.equal(actualStats.rate, 0);
const expectedChars = {
  minto: 5, ageha: 3, tsumugi: 3, naru: 3, rin: 1, mashiro: 4, other: 8,
};
for (const entry of actualEntries) assert(Object.hasOwn(CHAR_LABELS, entry.char), `${entry.id} has a character tag`);
assert.equal(actualEntries.find(e => e.id === "cg_ch3_childhood_offered_hand").char, "mashiro");
for (const [char, total] of Object.entries(expectedChars)) assert.equal(actualStats.byChar[char].total, total, char);
assert.equal(Object.values(actualStats.byChar).reduce((sum, s) => sum + s.total, 0), actualStats.total);
assert.equal(Object.values(actualStats.byKind).reduce((sum, s) => sum + s.total, 0), actualStats.total);
const fullStats = galleryStats(galleryEntries(actualManifest, actualCatalog, empty, new Set(actualEntries.map(e => e.id))));
assert.equal(fullStats.unlocked, 27);
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
assert.deepEqual(copy(withPhotos), { ...copy(actualStats), purikuraPhotos: 2 });
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
assert.equal(partialStats.byKind.movie.rate, 0);
assert.equal(partialStats.byChar.other.rate, 0);
const adopted = galleryEntries(actualManifest, { items: [
  { ...comic, char: "ageha" }, { ...movie, char: "unknown" },
  { ...comic, id: "not_approved", approved: false },
  { ...comic, id: "not_explicitly_approved", approved: undefined },
] }, { ...empty, clearedChapters: [1] }, new Set());
const adoptedStats = galleryStats(adopted);
assert.equal(adoptedStats.total, 29, "only approved comic and movie add to T");
assert.equal(adoptedStats.unlocked, 1);
assert.deepEqual(copy(adoptedStats.byKind.comic), { total: 1, unlocked: 1, rate: 100 });
assert.deepEqual(copy(adoptedStats.byKind.movie), { total: 1, unlocked: 0, rate: 0 });
assert.equal(adopted.find(e => e.id === comic.id).char, "ageha");
assert.equal(adopted.find(e => e.id === movie.id).char, "other");
assert.equal(entries.find(e => e.id === comic.id).char, "other", "missing character falls back to other");
assert.equal(Object.values(adoptedStats.byChar).reduce((sum, s) => sum + s.total, 0), adoptedStats.total);
console.log(`REAL DATA: raw CGs=${actualManifest.cgs.length}, total=${actualStats.total}, empty seen=${actualStats.unlocked}/${actualStats.total} (${actualStats.rate}%), all seen=${fullStats.unlocked}/${fullStats.total} (${fullStats.rate}%)`);
storage.set(g.GALLERY_PROGRESS_KEY, "{broken"); assert.deepEqual(copy(g.readGalleryProgress()), empty);
storage.set(g.GALLERY_PROGRESS_KEY, JSON.stringify({ clearedChapters: [0, 1, "2", 99], keepsakes: {}, purikura: [null] }));
assert.deepEqual(copy(g.readGalleryProgress()), { ...empty, clearedChapters: [1] });
failWrites = true; assert.doesNotThrow(() => { core.save(); core.wipeSave(); g.recordGalleryProgress(value); });
console.log("PASS: chapter-proof unlocks, old/new saves, persistent photos, approval gates, deduplication and storage failure");
