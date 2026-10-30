// タイトル直後の先読みで、店ロゴをアイドル時へ遅らせる分離を検証する。
// node --experimental-vm-modules remake/test/warmup_defer.mjs
// 既定の warmUiArt() は従来どおり店ロゴまで即時に読み、deferStores のときだけ
// アイドルコールバックまで店ロゴを始めない。途中で通常呼び出しが来たら即時に切り替わる。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const STORE_URLS = ["assets/ui/store_logos/tonari.png", "assets/ui/store_logos/kemurikusa.png"];
const FACE_URLS = ["img/faces/face_sumi.webp", "img/faces/face_naru.webp"];

// 会話用フォントは起動時の preload から外し、同時呼び出しと失敗後の再試行を検証する。
{
  const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<link[^>]+rel="preload"[^>]+ZenOldMincho-Name-Bold\.woff2/);
  const source = await fs.readFile(new URL("../js/core/vn-fonts.js", import.meta.url), "utf8");
  const calls = [];
  let fail = false;
  const context = vm.createContext({ document: { fonts: { load: (font, sample) => {
    calls.push([font, sample]);
    return fail ? Promise.reject(new Error("font unavailable")) : Promise.resolve([]);
  } } } });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => { throw new Error("unexpected font loader import"); });
  await module.evaluate();
  const { loadVnFonts } = module.namespace;
  const first = loadVnFonts();
  assert.equal(loadVnFonts(), first, "concurrent calls share one Promise");
  await first;
  assert.equal(loadVnFonts(), first, "completed load stays cached");
  assert.deepEqual(calls.map(([font]) => font), ['700 20px "Suien Name"', '400 20px "Suien Blue Mincho"']);
  assert(calls.every(([, sample]) => /[一-龯ぁ-ん]/.test(sample)));

  const retryContext = vm.createContext({ document: { fonts: { load: (font) => {
    calls.push([font]);
    return fail ? Promise.reject(new Error("font unavailable")) : Promise.resolve([]);
  } } } });
  const retryModule = new vm.SourceTextModule(source, { context: retryContext });
  await retryModule.link(() => { throw new Error("unexpected font loader import"); });
  await retryModule.evaluate();
  fail = true;
  await assert.rejects(retryModule.namespace.loadVnFonts(), /font unavailable/);
  fail = false;
  await retryModule.namespace.loadVnFonts();
  assert.equal(calls.length, 6, "both faces retry after a failed attempt");

  const noFonts = new vm.SourceTextModule(source, { context: vm.createContext({}) });
  await noFonts.link(() => { throw new Error("unexpected font loader import"); });
  await noFonts.evaluate();
  await noFonts.namespace.loadVnFonts();
}

async function loadUi() {
  const requested = [], idle = [];
  class Image {
    set src(url) { requested.push(url); queueMicrotask(() => this.onload?.()); }
    decode() { return Promise.resolve(); }
  }
  const context = vm.createContext({
    Image, console, setTimeout, clearTimeout, queueMicrotask,
    document: { hidden: false, documentElement: { dataset: {} }, addEventListener() {} },
    window: { addEventListener() {} },
    requestIdleCallback: (fn) => { idle.push(fn); return idle.length; },
  });
  const module = new vm.SourceTextModule(
    await fs.readFile(new URL("../js/core/ui.js", import.meta.url), "utf8"), { context });
  const stubs = {
    "util.js": { $: () => null, el: () => ({}), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), nextFrame: () => Promise.resolve() },
    "bus.js": { on: () => {} },
    "audio.js": { SE: {}, setRainAmbience: () => {} },
    "state.js": { state: {}, STAT_KEYS: [] },
    "data.js": { DB: {}, displayName: () => "", faceIconUrl: () => "", allFaceIconUrls: () => FACE_URLS, assetUrl: (u) => u },
    "stats.js": { AFFINITY_RANK_PTS: [], step: () => 1 },
    "stat-progress.js": { nextStepProgress: () => ({}), stepOfValue: () => 1 },
    "scene-art.js": { renderSceneArt: () => {}, sceneArtUrls: () => [] },
    "weather.js": { rainScene: () => {}, weatherSkyTone: () => "", weatherViewKind: () => "", renderWeatherLayer: () => {} },
    "transitions.js": { createSceneCurtain: () => {}, nightToMorning: () => {}, isCovering: () => false, takeSceneArrival: () => null },
    "store-logos.js": { allStoreLogoUrls: () => STORE_URLS },
    "chapter-title-art.js": { chapterTitleArt: () => "img/ui/chapter_title_ch1.webp" },
    "ui-theme.js": { uiThemeFrame: () => "img/ui/frame.webp" },
    "module-loading.js": { withLoadingNotice: (p) => p },
    "loading-prefetch.js": {
      prepareImage: (url) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = url;
      }),
      loadingPrefetch: { warm: (_key, prepare) => Promise.resolve().then(prepare).then(Boolean, () => false) },
    },
  };
  await module.link((specifier) => {
    const name = specifier.split("/").at(-1);
    const exports = stubs[name];
    assert(exports, `unstubbed import: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
    }, { context });
  });
  await module.evaluate();
  return { ui: module.namespace, requested, idle };
}
const storeRequests = (requested) => requested.filter((u) => STORE_URLS.includes(u));

// 既定: 店ロゴも含めて即時に読む（従来どおり）。2回呼んでも二重に読まない。
{
  const { ui, requested } = await loadUi();
  await ui.warmUiArt();
  assert(FACE_URLS.every((u) => requested.includes(u)), "face icons are warmed");
  assert.deepEqual(storeRequests(requested).sort(), [...STORE_URLS].sort(), "store logos are warmed by default");
  const count = requested.length;
  await ui.warmUiArt();
  assert.equal(requested.length, count, "second call requests nothing new");
}

// deferStores: アイドルまでは店ロゴを始めず、本体の絵は先に読み終える。
{
  const { ui, requested, idle } = await loadUi();
  await ui.warmUiArt({ deferStores: true });
  assert(FACE_URLS.every((u) => requested.includes(u)), "core art is warmed first");
  assert.deepEqual(storeRequests(requested), [], "store logos wait for idle");
  assert.equal(idle.length, 1, "one idle callback is scheduled");
  idle[0]();
  await ui.warmStoreLogos();
  assert.deepEqual(storeRequests(requested).sort(), [...STORE_URLS].sort(), "idle starts the store logos");
}

// 遅延の予約後に通常呼び出しが来たら、その場で店ロゴを始める。
{
  const { ui, requested, idle } = await loadUi();
  const deferred = ui.warmUiArt({ deferStores: true });
  await ui.warmUiArt();
  assert.deepEqual(storeRequests(requested).sort(), [...STORE_URLS].sort(), "plain call starts logos immediately");
  idle.forEach((fn) => fn());
  await deferred;
  assert.equal(storeRequests(requested).length, STORE_URLS.length, "idle callback does not double-load");
}

// 待機の分離: uiArtReady はコアだけを待ち、店ロゴの待機は storeLogosReady の役目（マップが両方呼ぶ）。
{
  const { ui, requested } = await loadUi();
  await ui.warmUiArt({ deferStores: true });
  await ui.uiArtReady();
  assert.deepEqual(storeRequests(requested), [], "uiArtReady does not start store logos");
  await ui.storeLogosReady();
  assert.deepEqual(storeRequests(requested).sort(), [...STORE_URLS].sort(), "storeLogosReady starts and waits for logos");
  assert.equal(ui.storeLogosReady(), null, "once loaded, storeLogosReady does not wait");
}

// main.js 側の配線: タイトル直後は deferStores で呼び、大会ステージは逐次先読みから外れてアイドル行き。
{
  const main = await fs.readFile(new URL("../js/main.js", import.meta.url), "utf8");
  assert.match(main, /warmUiArt\(\{ deferStores: true \}\)/);
  const bgsLine = main.match(/const bgs = \[([^\]]*)\]/);
  assert(bgsLine && !bgsLine[1].includes("bg_tournament_stage"), "stage bg left the sequential warm list");
  assert.match(main, /requestIdleCallback\(warmStage, \{ timeout: 8000 \}\)/);
  assert.match(main, /imageReady\(bgUrl\("bg_tournament_stage"\), 8000\)/);
  const warmUpSource = main.slice(main.indexOf("async function warmUp()"), main.indexOf("// テスト・デバッグ用フック"));
  assert(warmUpSource.includes("loadVnFonts().catch(() => {})"));
  let started = 0;
  const warmUp = vm.runInNewContext(`${warmUpSource}\nwarmUp`, {
    loadDeferredDialogues: () => Promise.resolve(),
    loadCinemaDialogue: () => Promise.resolve(),
    loadTournamentCraftDialogue: () => Promise.resolve(),
    loadVnFonts: () => { started++; return new Promise(() => {}); },
    warmUiArt: () => Promise.resolve(),
    imageReady: () => Promise.resolve(),
    bgUrl: (name) => name,
    portraitInfo: () => null,
    makingUrl: (name) => name,
    requestIdleCallback: () => {},
  });
  await warmUp();
  assert.equal(started, 1, "warmUp starts the fonts without waiting for them");

  const engine = await fs.readFile(new URL("../js/vn/engine.js", import.meta.url), "utf8");
  const entry = engine.slice(engine.indexOf("export function play("), engine.indexOf("function sceneBgm("));
  assert.match(entry, /const fontsReady = loadVnFonts\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(entry, /const assetsReady = Promise\.all\(\[fontsReady, bgReady/);
  assert(entry.indexOf("const assetsReady") < entry.indexOf("next();"), "first line starts after the font gate");
}

console.log("[warmup defer] PASS: store logos defer to idle only on the title path; stage bg deferred in main.js");
