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
const { galleryEntries } = catalogModule.namespace;
const copy = v => JSON.parse(JSON.stringify(v));
const photo = { chapter: 2, day: 18, slot: 1, mode: "guest", people: ["hajime", "samechan"] };
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
const empty = { clearedChapters: [], keepsakes: [], purikura: [] };
assert(!galleryEntries(manifest, { items: [comic] }, empty, new Set()).find(e => e.id === comic.id).unlocked);
storage.set(g.GALLERY_PROGRESS_KEY, "{broken"); assert.deepEqual(copy(g.readGalleryProgress()), empty);
storage.set(g.GALLERY_PROGRESS_KEY, JSON.stringify({ clearedChapters: [0, 1, "2", 99], keepsakes: {}, purikura: [null] }));
assert.deepEqual(copy(g.readGalleryProgress()), { ...empty, clearedChapters: [1] });
failWrites = true; assert.doesNotThrow(() => { core.save(); core.wipeSave(); g.recordGalleryProgress(value); });
console.log("PASS: chapter-proof unlocks, old/new saves, persistent photos, approval gates, deduplication and storage failure");
