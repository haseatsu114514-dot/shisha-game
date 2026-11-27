// Production map.js + ui.js preview loading, prioritization, foreground pause, and zero-flash cache hit checks.
// node --experimental-vm-modules remake/test/map_preview_loading.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

class Node {
  constructor(spec, attrs = {}, children = []) {
    const parts = spec.split(".");
    this.tag = parts[0] || "div";
    this.classes = new Set(parts.slice(1));
    this.children = [];
    this.dataset = attrs.dataset ? { ...attrs.dataset } : {};
    this.attrs = {};
    this.isConnected = true;
    this.style = {
      setProperty(k, v) { this[k] = v; },
      removeProperty(k) { delete this[k]; },
      getPropertyValue(k) { return this[k] || ""; },
    };
    this.classList = {
      add: (...xs) => xs.forEach((x) => this.classes.add(x)),
      remove: (...xs) => xs.forEach((x) => this.classes.delete(x)),
      contains: (x) => this.classes.has(x),
      toggle: (x, on) => (on === undefined ? (this.classes.has(x) ? this.classes.delete(x) : this.classes.add(x)) : on ? this.classes.add(x) : this.classes.delete(x)),
    };
    const { dataset: _d, style: _s, ...rest } = Array.isArray(attrs) ? {} : attrs;
    Object.assign(this, rest);
    if (!Array.isArray(attrs) && attrs.style) Object.assign(this.style, attrs.style);
    if (Array.isArray(attrs)) children = attrs;
    this.append(...children);
  }
  append(...xs) { for (const x of xs.filter(Boolean)) { this.children.push(x); x.parent = this; } }
  prepend(...xs) { for (const x of [...xs].reverse().filter(Boolean)) { this.children.unshift(x); x.parent = this; } }
  replaceChildren(...xs) { this.children = []; this.append(...xs); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); this.isConnected = false; }
  contains(n) { return this === n || this.children.some((x) => x.contains(n)); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener() {}
  querySelectorAll(selector) {
    const out = [];
    const matches = (n) => selector.split(",").some((s) => {
      s = s.trim();
      return s.startsWith(".") && n.classes.has(s.slice(1));
    });
    const walk = (n) => { for (const c of n.children) { if (matches(c)) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  querySelector(s) {
    if (s.includes("[data-spot=")) {
      const id = s.match(/data-spot="([^"]+)"/)[1];
      const p = this.querySelectorAll(".spot-pin").find((n) => n.dataset.spot === id);
      return p?.querySelector(".shield") || null;
    }
    return this.querySelectorAll(s)[0] || null;
  }
}

const el = (spec, attrs = {}, children = []) => new Node(spec, attrs, children);
const noop = () => {};
const flush = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise(setImmediate); };

let autoResolve = true;
const pendingImages = new Map();
const imageRequests = [];
class FakeImage {
  constructor() { this.naturalWidth = 64; this.naturalHeight = 64; }
  set src(url) {
    imageRequests.push(url);
    if (autoResolve) {
      queueMicrotask(() => this.onload?.());
      return;
    }
    pendingImages.set(url, [...(pendingImages.get(url) || []), this]);
  }
  decode() { return Promise.resolve(); }
}
const resolveImage = (url) => {
  const list = pendingImages.get(url) || [];
  assert(list.length > 0, `expected pending request for ${url}`);
  const img = list.shift();
  img.onload?.();
  return img;
};

const state = {
  chapter: 2, day: 2, slot: 0, phase: "daily",
  flags: { _axe_bar_rumor_done: true },
  story: {}, met: { naru: true, adam: true, samechan: true },
  visits: {}, visitedDay: {}, spotVisits: {}, contacts: [], money: 30000, stamina: 100,
};
const DB = { dialogues: {}, manifest: { sceneProps: [] } };
let shown = null;
const idleCallbacks = [];

const context = vm.createContext({
  console, setTimeout, clearTimeout, queueMicrotask, Image: FakeImage,
  requestAnimationFrame: (cb) => { cb(); return 1; },
  requestIdleCallback: (cb) => idleCallbacks.push(cb),
  cancelAnimationFrame: noop,
  document: {
    hidden: false,
    body: new Node("body"),
    documentElement: { dataset: {} },
    getElementById: () => null,
    addEventListener: noop,
    createElementNS: (_ns, tag) => new Node(tag),
  },
  window: { addEventListener: noop },
  globalThis: {},
});

const realMapDeps = new Set(["map.js", "spot-access.js", "spot-hours.js", "map-reveals.js", "axe-bar-data.js", "axe-bar-discovery.js"]);
const uiSource = await fs.readFile(new URL("../js/core/ui.js", import.meta.url), "utf8");
const sceneArtSource = await fs.readFile(new URL("../js/core/scene-art.js", import.meta.url), "utf8");

const mapSources = new Map();
const exportsNeeded = new Map();
for (const name of [...realMapDeps, "ui.js", "scene-art.js"]) {
  const folder = name === "axe-bar-discovery.js" || name === "ui.js" || name === "scene-art.js" ? "core" : "daily";
  const src = name === "ui.js" ? uiSource : name === "scene-art.js" ? sceneArtSource
    : await fs.readFile(new URL(`../js/${folder}/${name}`, import.meta.url), "utf8");
  mapSources.set(name, src);
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
    const dep = m[2].split("/").at(-1);
    const names = exportsNeeded.get(dep) || new Set();
    m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).forEach((n) => names.add(n));
    exportsNeeded.set(dep, names);
  }
}

const overrides = {
  "util.js": { el, yen: String, $: () => null, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), nextFrame: () => Promise.resolve() },
  "bus.js": { on: noop },
  "dom-write.js": { setData: noop },
  "stage-fit.js": { syncBackdrop: noop },
  "weather.js": { isRainy: () => false, tomorrowForecast: () => null, rainScene: () => null, weatherOf: () => null, weatherSkyTone: () => "", weatherViewKind: () => "", renderWeatherLayer: noop },
  "shop-haze.js": { syncShopHaze: noop },
  "transitions.js": { cueTransition: noop, createSceneCurtain: () => null, nightToMorning: noop, isCovering: () => false, takeSceneArrival: () => ({ commitArrival: noop }), takeParkedCover: () => null, smokeArt: () => ({}), smokeIn: async () => {}, smokeOut: async () => {}, dateTypeReady: async () => true, plainDateType: noop },
  "store-logos.js": { hasStoreLogo: () => false, storeLogo: noop, allStoreLogoUrls: () => [] },
  "chapter-title-art.js": { chapterTitleArt: () => "title.webp" },
  "ui-theme.js": { uiThemeFrame: () => "frame.webp" },
  "module-loading.js": { withLoadingNotice: (p) => p },
  "loading.js": { withLoading: (fn) => fn({}), comicLoadingRequired: () => false, loadingContinues: () => false },
  "loading-context.js": { gameLoadingOptions: () => ({}) },
  "loading-prefetch.js": { loadingPrefetch: { warm: async () => true }, prepareImage: async () => true },
  "gain-notice.js": { gainSeenKey: () => null, bannerHold: () => 1000 },
  "stat-progress.js": { nextStepProgress: () => ({}) },
  "stats.js": { AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], affinityLevel: () => 0, earnStat: noop, gainAffinity: noop, STAMINA_LOW: 20 },
  "growth.js": { growthEnabled: () => false, hidaneTotal: () => 0 },
  "state.js": { state, STAT_KEYS: [], config: {}, save: noop, timeOfDay: () => (state.slot ? "night" : "day") },
  "audio.js": { SE: { click: noop, select: noop }, setRainAmbience: noop },
  "transition-kit.js": { reducedMotion: () => false },
  "scene-motions.js": { trainRide: noop },
  "train-icon.js": { TRAIN_ICON_SVG: "<svg/>" },
  "hud.js": { updateHud: noop },
  "reel.js": { mountReel: noop },
  "fortune.js": { fortuneToday: () => false },
  "spot-people.js": { spotPeople: () => [] },
  "facility-icons.js": { createMapFacilityIcon: () => null, hasFacilityIcon: () => false, FACILITY_SHEET: "facility-sheet.webp" },
  "station-travel.js": { STATION_FARE: 200, WALK_HOME_STAMINA: 10, stationDestinations: () => [], prepareStationTrip: () => null, stationArrival: noop },
  "spots.js": {
    allSpots: () => [],
    SPOT_PREVIEW: { naru: "kemurikusa", adam: "bg_eden_shop", cafe: "bg_cafe_day" },
    isUnlocked: (s) => s.id !== "cafe",
    hasNewEvent: () => false,
    spotDetailLabel: (s) => s.label,
  },
  "data.js": {
    DB,
    bgUrl: (id) => `img/backgrounds/${id}.webp`,
    sceneBg: (ref) => ({ url: ref ? `img/backgrounds/${ref}.webp` : null, tint: null }),
    faceIconUrl: () => null,
    allFaceIconUrls: () => [],
    displayName: (id) => id,
    assetUrl: (u) => u,
    img: (rel) => `img/${rel}`,
    portraitInfo: (id) => ({ src: `img/sprites/chr_${id}_normal.webp` }),
  },
};

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const src = mapSources.get(name);
  const mod = src
    ? new vm.SourceTextModule(src, { context, identifier: name })
    : new vm.SyntheticModule([...(exportsNeeded.get(name) || [])], function () {
      const vals = overrides[name] || {};
      for (const k of exportsNeeded.get(name) || []) this.setExport(k, k in vals ? vals[k] : noop);
    }, { context, identifier: name });
  modules.set(name, mod);
  return mod;
}

const uiMod = load("ui.js");
await uiMod.link((spec) => load(spec.split("/").at(-1)));
await uiMod.evaluate();
const ui = uiMod.namespace;
ui.layers.screen = el("div#screen");
ui.layers.bg = el("div#bg");
ui.layers.fx = el("div#fx");
const origShowScreen = ui.showScreen;
const mapMod = load("map.js");
await mapMod.link((spec) => load(spec.split("/").at(-1)));
await mapMod.evaluate();
const map = mapMod.namespace;

const axeSpot = { id: "axe_bar", kind: "axe", label: "斧投げBar", x: 38, y: 74, theme: "gym", preview: "bg_axe_lounge_night", openSlots: [1] };
const naruSpot = { id: "naru", kind: "rival", charId: "naru", label: "KEMURIKUSA", x: 70, y: 24, theme: "rival", preview: "kemurikusa" };
const adamSpot = { id: "adam", kind: "rival", charId: "adam", label: "EDEN", x: 46, y: 48, theme: "rival", preview: "bg_eden_shop" };
const shisharkSpot = { id: "shishark", kind: "samechan", charId: "samechan", label: "SHISHARK", x: 58, y: 38, theme: "shop", preview: "bg_shishark" };
const lockedCafe = { id: "cafe", kind: "spot", label: "喫茶こはく", x: 72, y: 45, theme: "cafe", preview: "bg_cafe_day" };

// Prime map readiness assets in fake cache so openMap starts immediately.
await Promise.all([
  ui.uiArtReady(),
  ui.storeLogosReady(),
  ui.imageReady("facility-sheet.webp", 2000, { keep: true }),
  ui.imageReady("img/backgrounds/bg_osu_map_day.webp", 2000),
]);
autoResolve = false;
imageRequests.length = 0;

const flow = map.chooseSpot({
  regions: [{ id: "home", background: "img/backgrounds/bg_osu_map_day.webp", spots: () => [axeSpot, naruSpot, adamSpot, shisharkSpot, lockedCafe] }],
});
await flush(8);
shown = ui.layers.screen.children[0];
assert(shown && shown.classes.has("map"), "map screen is open");

// 1. Warm waits for idle, then starts just one available spot preview.
assert.deepEqual(imageRequests, [], "warm makes no requests before idle");
assert.equal(idleCallbacks.length, 1);
void idleCallbacks.shift()();
assert.deepEqual(imageRequests, [
  "img/backgrounds/kemurikusa.webp",
], "warm starts just the first available spot preview");

// 2. Clicking shishark while its preview is not ready pauses warm, loads bg_shishark first, defers portrait until preview resolves.
const shisharkPin = shown.querySelectorAll(".spot-pin").find((n) => n.dataset.spot === "shishark");
shisharkPin.onclick();
let previewEl = shown.querySelector(".mi-preview");
assert(previewEl.classList.contains("loading"), "unready preview shows loading state");
assert.equal(imageRequests.includes("img/backgrounds/bg_shishark.webp"), true, "clicked preview starts immediately");
assert.equal(imageRequests.includes("img/sprites/chr_samechan_normal.webp"), false, "portrait waits for preview to finish");

// Complete the in-flight warm request. Warm must pause before the next preview.
resolveImage("img/backgrounds/kemurikusa.webp");
await flush(6);
assert.equal(imageRequests.includes("img/backgrounds/bg_eden_shop.webp"), false, "warm pauses while foreground preview is loading");

// Complete bg_shishark: preview renders, portrait starts, and warm resumes with the next available preview.
resolveImage("img/backgrounds/bg_shishark.webp");
await flush(6);
assert.equal(previewEl.classList.contains("loading"), false, "loading class removed once preview ready");
assert.equal(previewEl.dataset.sceneBg, "bg_shishark.png");
assert.equal(imageRequests.includes("img/sprites/chr_samechan_normal.webp"), true, "portrait starts right after preview finishes");
assert.equal(imageRequests.includes("img/backgrounds/bg_eden_shop.webp"), true, "warm resumes with next queued preview after foreground completes");
assert.equal(imageRequests.includes("img/backgrounds/bg_axe_lounge_night.webp"), false, "warm waits for the remaining available preview");
resolveImage("img/backgrounds/bg_eden_shop.webp");
await flush(6);
assert.equal(imageRequests.includes("img/backgrounds/bg_axe_lounge_night.webp"), true, "unavailable previews warm after available previews");

// 3. Clicking naru whose preview (kemurikusa) is already ready renders synchronously without .loading flash!
const naruPin = shown.querySelectorAll(".spot-pin").find((n) => n.dataset.spot === "naru");
naruPin.onclick();
previewEl = shown.querySelector(".mi-preview");
assert.equal(previewEl.classList.contains("loading"), false, "cached preview skips .loading flash synchronously");
assert.equal(previewEl.dataset.sceneBg, "kemurikusa.png", "cached preview renders immediately");
assert.equal(imageRequests.includes("img/sprites/chr_naru_normal.webp"), true, "cached preview immediately triggers portrait preload");

// 4. Verify locked spot is never warmed and warm finishes portraits after unavailable previews.
resolveImage("img/backgrounds/bg_axe_lounge_night.webp");
await flush(6);
assert.equal(imageRequests.includes("img/backgrounds/bg_cafe_day.webp"), false, "locked spot preview is never preloaded");
assert.equal(imageRequests.includes("img/sprites/chr_adam_normal.webp"), false, "warm waits for the first portrait already in flight");
resolveImage("img/sprites/chr_naru_normal.webp");
await flush(6);
assert.equal(imageRequests.includes("img/sprites/chr_adam_normal.webp"), true, "available spot portraits warm after previews");

// 5. Interrupting map cleanly resolves chooseSpot without hanging on pending images.
map.interruptMap("__done__");
assert.equal(await flow, "__done__");

// 6. Without requestIdleCallback, use a timer. Reopening waits for the previous warm transfer.
const originalTimer = context.setTimeout;
let runFallback;
delete context.requestIdleCallback;
context.setTimeout = (cb, ms, ...args) => {
  if (ms !== 750) return originalTimer(cb, ms, ...args);
  runFallback = cb;
};
const reopenedPreview = "img/backgrounds/qa-reopened.webp";
const reopened = map.chooseSpot({
  regions: [{ id: "home", background: "img/backgrounds/bg_osu_map_day.webp",
    spots: () => [{ ...naruSpot, previewUrl: reopenedPreview }] }],
});
await flush(8);
assert.equal(typeof runFallback, "function", "warm schedules a fallback timer");
assert(!imageRequests.includes(reopenedPreview), "warm waits for its fallback timer");
void runFallback();
await flush();
assert(!imageRequests.includes(reopenedPreview), "warm waits for the previous map's transfer");
resolveImage("img/sprites/chr_adam_normal.webp");
await flush();
assert(imageRequests.includes(reopenedPreview), "warm resumes on the reopened map");
map.interruptMap("__reopened__");
assert.equal(await reopened, "__reopened__");
for (const list of pendingImages.values()) {
  while (list.length) list.shift().onload?.();
}
await flush(4);
console.log("PASS map_preview_loading: idle scheduling, timer fallback, serial warm order, foreground pause, portrait deferral, cache hit, and clean interrupt/reopen");
// A cold map misses its initial deadline at DBG ×8. Pins belong to the map, never to the last shop.
// Keep a pending request under our control; don't depend on sleeps or a real network failure.
context.setTimeout = (cb, ms, ...args) => originalTimer(cb, (ms === 1800 || ms === 15000) ? 15 : ms, ...args);
const shopUrl = "img/backgrounds/bg_tonari_inside_day.webp";
autoResolve = true;
await ui.setBg(shopUrl, { instant: true });
autoResolve = false;
const openTestMap = (url) => map.chooseSpot({ regions: [{ id: "home", background: url, spots: () => [] }] });
const top = () => ui.layers.bg.children.at(-1);
async function waitMap() {
  for (let i = 0; i < 50; i++) {
    const node = ui.layers.screen.children[0];
    if (node?.classes.has("map") && !node.classes.has("done")) return node;
    await new Promise(resolve => setTimeout(resolve, 3));
  }
  throw new Error("map did not open");
}
async function resetShop() { ui.showScreen("shop", el("div")); await ui.setBg(shopUrl, { instant: true }); }
for (const mode of ["late", "exit", "retry"]) {
  await resetShop();
  const url = `img/backgrounds/qa-map-${mode}.webp`, flow = openTestMap(url);
  await flush();
  if (mode === "retry") pendingImages.get(url).shift().onerror();
  const root = await waitMap(), notice = root.querySelector(".map-backdrop-note"), retry = notice?.children[1];
  assert(top().classes.has("map-fallback"), "a slow/failed map must never put its pins over the previous shop");
  assert(notice && !notice.hidden);
  if (mode === "retry") { assert(!retry.hidden); retry.onclick(); assert(retry.hidden); }
  if (mode === "exit") { map.interruptMap("exit"); await flow; await resetShop(); }
  resolveImage(url);
  await flush(8);
  if (mode === "exit") assert.equal(top().dataset.sceneBg, "bg_tonari_inside_day.png", "late map must not draw after exit");
  else {
    assert.equal(top().dataset.sceneBg, `qa-map-${mode}.png`, "late or retried art replaces the placeholder");
    assert(notice.hidden);
    map.interruptMap("done"); await flow;
  }
  assert.equal(imageRequests.filter(u => u === url).length, mode === "retry" ? 2 : 1);
}
console.log("PASS map backdrop: late cold image, neutral placeholder, genuine failure/retry, stale completion after exit");
