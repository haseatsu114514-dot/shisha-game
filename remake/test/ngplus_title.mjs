// node --experimental-vm-modules remake/test/ngplus_title.mjs
// NG+（Issue #1228 U10）: タイトルの周回開始導線と openNextCycleOptions。
// 実モジュール title.js を vm で読み、import（静的・動的とも）はすべてモックに差し替える。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const read = (path) => fs.readFile(new URL(path, import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
const code = await read("../js/scenes/title.js");
// vm 内で作られたオブジェクトは realm が違うため、比較前にこちらの realm へ移す
const plain = (o) => ({ ...o });

// ---------------------------------------------------------------- 軽量 DOM
function makeEl() {
  const create = (spec, props, children) => {
    let p = {}, kids = [];
    if (Array.isArray(props)) kids = props;
    else { p = props ?? {}; kids = children ?? []; }
    const [tag, ...classes] = String(spec).split(".");
    const node = {
      tag, classes, children: [], dataset: { ...(p.dataset ?? {}) }, style: {},
      text: p.text ?? null, hidden: p.hidden === true, complete: false, naturalWidth: 1,
      classList: { add() {}, remove() {}, toggle() {} },
      append(...nodes) { this.children.push(...nodes.flat(Infinity).filter((n) => n != null && n !== false)); },
      replaceChildren(...nodes) { this.children = nodes.filter((n) => n != null && n !== false); },
      addEventListener() {},
      querySelector(sel) { return findFirst(this, sel); },
      querySelectorAll(sel) { const out = []; collectAll(this, sel, out); return out; },
    };
    if (p.onclick) node.onclick = p.onclick;
    if (p.onchange) node.onchange = p.onchange;
    if (p.type) node.type = p.type;
    if (p.disabled != null) node.disabled = p.disabled;
    node.append(...kids);
    return node;
  };
  return create;
}
function matches(node, sel) {
  if (!node || typeof node !== "object") return false;
  if (sel.startsWith(".")) return node.classes?.includes(sel.slice(1));
  return node.tag === sel;
}
function findFirst(node, sel) {
  for (const child of node.children ?? []) {
    if (matches(child, sel)) return child;
    const hit = findFirst(child, sel);
    if (hit) return hit;
  }
  return null;
}
function collectAll(node, sel, out) {
  for (const child of node.children ?? []) {
    if (matches(child, sel)) out.push(child);
    collectAll(child, sel, out);
  }
}
function findByTest(node, test) {
  let hit = null;
  const walk = (n) => {
    for (const c of n.children ?? []) {
      if (c.dataset?.test === test) { hit = c; return; }
      walk(c);
      if (hit) return;
    }
  };
  walk(node);
  return hit;
}
function findByClass(node, cls) {
  let hit = null;
  const walk = (n) => {
    for (const c of n.children ?? []) {
      if (c.classes?.includes(cls)) { hit = c; return; }
      walk(c);
      if (hit) return;
    }
  };
  walk(node);
  return hit;
}

// ---------------------------------------------------------------- モック一式
function makeFixture(opts = {}) {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  const document = { body: { dataset: { screen: "" } } };
  const screens = [];
  const modalCalls = [];
  const calls = { startNextCycle: [], startNewGame: 0, smokeWipe: 0, newGame: 0, wipeSave: 0 };
  const el = makeEl();
  const difficultyForRun = function difficultyForRun() { return 0; };
  const modules = {
    "../core/util.js": { el },
    "../core/img-file.js": { imgFileUrl: (p) => `/img/${p}` },
    "../core/data.js": { DB: { manifest: {}, gallery: [] }, bgUrl: (id) => `bg:${id}` },
    "../core/gallery-progress.js": { readGalleryProgress: () => ({ clearedChapters: [] }) },
    "../core/gallery-catalog.js": { galleryEntries: () => [], galleryStats: () => ({ unlocked: 0, rate: 0 }) },
    "../core/ui.js": {
      layers: { hud: { classList: { remove() {} } } },
      showScreen: (name, root) => { screens.push({ name, root }); document.body.dataset.screen = name; },
      setBg() {},
      smokeWipe: (fn) => { calls.smokeWipe++; fn(); },
      modal: (args) => new Promise((resolve) => modalCalls.push({ args, resolve })),
    },
    "../core/state.js": {
      peekSave: () => null,
      newGame: () => { calls.newGame++; },
      wipeSave: () => { calls.wipeSave++; },
      config: {}, saveConfig() {},
      anySlotSaved: () => false,
      loadFromSlot: () => false,
      readSlot: () => opts.autoSave ?? null,
      SAVE_SLOTS: [
        { key: "suien_remake_save", label: "オートセーブ", auto: true },
        { key: "suien_remake_slot1", label: "スロット 1" },
      ],
    },
    "../core/audio.js": { playBgm() {}, stopBgm() {}, SE: { select() {} }, applyVolumes() {} },
    "../core/ngplus-difficulty.js": { difficultyForRun },
    "../core/ui-theme.js": { createUiThemeSelect: () => el("select") },
    "../chapters/ch1.js": { startNewGame: () => { calls.startNewGame++; }, resumeGame() {} },
    "./gallery.js": { openGallery: async () => {} },
    "./saves.js": { loadFlow: async () => null },
    "./title-art.js": {
      pickTitleArt: () => ({ character: "sumi", file: "sumi.webp", url: "blob:sumi", ready: true }),
      prepareTitleArt: async (art) => art,
    },
    "./title-layout.js": { mountTitleLayout() {} },
    "../core/cycle-meta.js": {
      readCycleMeta: () => (typeof opts.meta === "function" ? opts.meta() : opts.meta ?? null),
      recordCycleStarted: () => {},
    },
    "../core/cycle-start.js": {
      startNextCycle: (pkg, options) => { calls.startNextCycle.push({ pkg, options }); return { cycle: pkg.fromCycle + 1 }; },
    },
  };
  return { localStorage, document, screens, modalCalls, calls, modules, difficultyForRun, missing: opts.missing ?? [] };
}

async function loadTitle(fixture) {
  const context = vm.createContext({
    console, structuredClone,
    performance: { now: () => 0 },
    localStorage: fixture.localStorage,
    document: fixture.document,
    window: {},
  });
  const synthetic = (spec) => {
    const exportsObj = fixture.modules[spec];
    if (!exportsObj) throw new Error(`unmocked import: ${spec}`);
    const names = Object.keys(exportsObj);
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, exportsObj[name]);
    }, { context });
  };
  const mod = new vm.SourceTextModule(code, {
    context,
    importModuleDynamically: async (spec) => {
      if (fixture.missing.includes(spec)) throw new Error(`Cannot find module '${spec}'`);
      const dep = synthetic(spec);
      await dep.link(() => { throw new Error(`unexpected nested import from ${spec}`); });
      await dep.evaluate();
      return dep;
    },
  });
  await mod.link((spec) => synthetic(spec));
  await mod.evaluate();
  return mod.namespace;
}

const META = (over = {}) => ({
  version: 1, unlocked: true, trueEnds: [], highestCycleStarted: 2, lifetime: { tournamentWins: 0, tournamentAttempts: 0 },
  carryPackage: {
    fromCycleId: "cyc-a", fromCycle: 2, at: "2026-10-29T00:00:00.000Z",
    data: { stats: { technique: 55, sense: 10, guts: 10, charm: 10, insight: 10 }, statXp: {}, money: 777, flags: { _kept: true } },
  },
  ...over,
});

// ---------------------------------------------------------------- A. パッケージ展開（純粋関数）
{
  const title = await loadTitle(makeFixture());
  const f = title.startPackageFromMeta;
  assert.equal(f(null), null);
  assert.equal(f({ unlocked: false, carryPackage: META().carryPackage }), null, "未解放は null");
  assert.equal(f({ unlocked: true }), null);
  assert.equal(f({ unlocked: true, carryPackage: null }), null);
  assert.equal(f({ unlocked: true, carryPackage: { fromCycle: 0, data: {} } }), null);
  assert.equal(f({ unlocked: true, carryPackage: { fromCycle: Number.NaN, data: {} } }), null);
  assert.equal(f({ unlocked: true, carryPackage: { fromCycle: 2, data: null } }), null);
  assert.equal(f({ unlocked: true, carryPackage: { fromCycle: 2, data: [] } }), null);

  const meta = META();
  meta.carryPackage.data.fromCycle = 99; // data 側の同名値は採用しない
  const pkg = f(meta);
  assert.equal(pkg.fromCycle, 2, "外装の fromCycle が正本");
  assert.equal(pkg.money, 777);
  assert.deepEqual(pkg.stats, { technique: 55, sense: 10, guts: 10, charm: 10, insight: 10 });
  pkg.stats.technique = 1;
  assert.equal(meta.carryPackage.data.stats.technique, 55, "戻り値は複製で元を汚さない");
}

// ---------------------------------------------------------------- B. ボタンの表示条件
{
  // メタ層モジュール未着: 導線は出ない
  const fx = makeFixture({ missing: ["../core/cycle-meta.js"] });
  const title = await loadTitle(fx);
  title.showTitle();
  await flush();
  assert.equal(findByTest(fx.screens.at(-1).root, "title-next-cycle"), null);
}
{
  // 未解放: 導線は出ない
  const fx = makeFixture({ meta: { version: 1, unlocked: false, carryPackage: null } });
  const title = await loadTitle(fx);
  title.showTitle();
  await flush();
  assert.equal(findByTest(fx.screens.at(-1).root, "title-next-cycle"), null);
}
{
  // 解放済み・パッケージあり: 周回数はパッケージ由来（fromCycle + 1）
  const fx = makeFixture({ meta: META() });
  const title = await loadTitle(fx);
  title.showTitle();
  await flush();
  const btn = findByTest(fx.screens.at(-1).root, "title-next-cycle");
  assert.ok(btn, "解放済みではボタンが出る");
  assert.equal(findByClass(btn, "ti-ja").text, "3周目をはじめる");
  // 並び順: NEW GAME の次
  const menu = findByClass(fx.screens.at(-1).root, "title-menu");
  assert.deepEqual(menu.children.map((b) => b.dataset.test),
    ["title-new", "title-next-cycle", "title-load", "title-gallery", "title-config"]);
}
{
  // 解放済み・パッケージなし: ボタンは出るが開始できない
  const fx = makeFixture({ meta: META({ carryPackage: null }) });
  const title = await loadTitle(fx);
  title.showTitle();
  await flush();
  const btn = findByTest(fx.screens.at(-1).root, "title-next-cycle");
  assert.ok(btn);
  assert.equal(findByClass(btn, "ti-ja").text, "次の周目をはじめる");
  btn.onclick();
  await flush();
  assert.equal(fx.modalCalls.length, 1);
  assert.ok(String(fx.modalCalls[0].args.body).includes("保存情報を確認できないため"));
  fx.modalCalls[0].resolve(true);
  await flush();
  assert.equal(fx.calls.startNextCycle.length, 0);
}

// ---------------------------------------------------------------- C. openNextCycleOptions の流れ
{
  // 正常系: グループを1つ外し、オートセーブ確認を経て開始する
  const meta = META();
  const fx = makeFixture({ meta, autoSave: { day: 12, cycle: 1, chapter: 3 } });
  const title = await loadTitle(fx);
  const p = title.openNextCycleOptions(meta);
  await flush();
  assert.equal(fx.modalCalls.length, 1);
  assert.equal(fx.modalCalls[0].args.title, "3周目をはじめる");
  const itemsInput = findByTest(fx.modalCalls[0].args.body, "cycle-group-items");
  assert.ok(itemsInput, "4グループのトグルがある");
  for (const key of ["stats", "money", "knowledge"]) assert.ok(findByTest(fx.modalCalls[0].args.body, `cycle-group-${key}`));
  itemsInput.checked = false;
  itemsInput.onchange({ target: itemsInput });
  fx.modalCalls[0].resolve(true);
  await flush();
  assert.equal(fx.modalCalls.length, 2, "オートセーブ確認が出る");
  assert.ok(String(fx.modalCalls[1].args.body).includes("現在のオートセーブ（1周目・第3章）は上書きされます。手動セーブ枠は残ります"));
  fx.modalCalls[1].resolve(true);
  const result = await p;
  assert.deepEqual(plain(result), { started: true });
  assert.equal(fx.calls.startNextCycle.length, 1);
  const { pkg, options } = fx.calls.startNextCycle[0];
  assert.equal(pkg.fromCycle, 2);
  assert.equal(pkg.money, 777);
  assert.deepEqual(plain(options.groups), { stats: true, money: true, items: false, knowledge: true });
  assert.equal(options.onCycleStarted, fx.modules["../core/cycle-meta.js"].recordCycleStarted);
  assert.equal(options.difficultyForRun, fx.difficultyForRun);
}
{
  // オプション画面でやめる: 開始しない
  const meta = META();
  const fx = makeFixture({ meta, autoSave: { day: 12, cycle: 1, chapter: 3 } });
  const title = await loadTitle(fx);
  const p = title.openNextCycleOptions(meta);
  await flush();
  fx.modalCalls[0].resolve(false);
  assert.deepEqual(plain(await p), { started: false, reason: "cancelled" });
  assert.equal(fx.modalCalls.length, 1);
  assert.equal(fx.calls.startNextCycle.length, 0);
}
{
  // 上書き確認でやめる: 開始せず、セーブにも触らない
  const meta = META();
  const fx = makeFixture({ meta, autoSave: { day: 12, cycle: 2, chapter: 5 } });
  const title = await loadTitle(fx);
  const p = title.openNextCycleOptions(meta);
  await flush();
  fx.modalCalls[0].resolve(true);
  await flush();
  assert.ok(String(fx.modalCalls[1].args.body).includes("現在のオートセーブ（2周目・第5章）は上書きされます"));
  fx.modalCalls[1].resolve(false);
  assert.deepEqual(plain(await p), { started: false, reason: "cancelled" });
  assert.equal(fx.calls.startNextCycle.length, 0);
}
{
  // オートセーブが無ければ確認なしで開始する
  const meta = META();
  const fx = makeFixture({ meta, autoSave: null });
  const title = await loadTitle(fx);
  const p = title.openNextCycleOptions(meta);
  await flush();
  fx.modalCalls[0].resolve(true);
  assert.deepEqual(plain(await p), { started: true });
  assert.equal(fx.modalCalls.length, 1);
  assert.equal(fx.calls.startNextCycle.length, 1);
}
{
  // 表示後にパッケージが変わっていたら開始しない
  const meta = META();
  const changed = META();
  changed.carryPackage = { ...changed.carryPackage, fromCycleId: "cyc-b" };
  const fx = makeFixture({ meta: changed, autoSave: null });
  const title = await loadTitle(fx);
  const p = title.openNextCycleOptions(meta);
  await flush();
  fx.modalCalls[0].resolve(true);
  await flush();
  assert.equal(fx.modalCalls.length, 2, "変化の通知が出る");
  assert.ok(String(fx.modalCalls[1].args.body).includes("保存情報が変わったため"));
  fx.modalCalls[1].resolve(true);
  assert.deepEqual(plain(await p), { started: false, reason: "changed" });
  assert.equal(fx.calls.startNextCycle.length, 0);
}
{
  // 開始モジュール未着: 開始できない旨を出して止まる
  const meta = META();
  const fx = makeFixture({ meta, autoSave: null, missing: ["../core/cycle-start.js"] });
  const title = await loadTitle(fx);
  const p = title.openNextCycleOptions(meta);
  await flush();
  fx.modalCalls[0].resolve(true);
  await flush();
  assert.equal(fx.modalCalls.length, 2);
  assert.ok(String(fx.modalCalls[1].args.body).includes("準備ができていないため"));
  fx.modalCalls[1].resolve(true);
  assert.deepEqual(plain(await p), { started: false, reason: "unavailable" });
  assert.equal(fx.calls.startNextCycle.length, 0);
}
{
  // 二重実行の防止: 実行中は2回目を受け付けない
  const meta = META();
  const fx = makeFixture({ meta, autoSave: null });
  const title = await loadTitle(fx);
  const p1 = title.openNextCycleOptions(meta);
  await flush();
  assert.deepEqual(plain(await title.openNextCycleOptions(meta)), { started: false, reason: "busy" });
  fx.modalCalls[0].resolve(false);
  assert.deepEqual(plain(await p1), { started: false, reason: "cancelled" });
}

// ---------------------------------------------------------------- D. タイトルからの通し
{
  // ボタンを押して開始すると、newGame()/wipeSave() を経ずに opening へ進む
  const meta = META();
  const fx = makeFixture({ meta, autoSave: null });
  const title = await loadTitle(fx);
  title.showTitle();
  await flush();
  const btn = findByTest(fx.screens.at(-1).root, "title-next-cycle");
  assert.ok(btn);
  btn.onclick();
  await flush();
  assert.equal(fx.modalCalls.length, 1);
  fx.modalCalls[0].resolve(true);
  await flush();
  assert.equal(fx.calls.startNextCycle.length, 1);
  assert.equal(fx.calls.newGame, 0, "周回開始で newGame() を呼ばない");
  assert.equal(fx.calls.wipeSave, 0, "周回開始で wipeSave() を呼ばない");
  assert.equal(fx.calls.startNewGame, 1, "作成済み state のまま opening へ");
}

console.log("ngplus_title: all assertions passed");
