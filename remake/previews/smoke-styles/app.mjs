// 煙の見本（docs/owner_requests.md の KMR）: 場面・描き方・色を切り替えて、煙の描き方を見比べるページの本体。
// 提案用の見本で、本編のコードは読み込まず、本編にも接続していない。
import { createFluid } from "./fluid.mjs";
import { createPuffs } from "./puffs.mjs";
import { createLegacy } from "./legacy.mjs";

const PI = Math.PI;
const $ = (id) => document.getElementById(id);
const img = (path) => new URL(path, import.meta.url).href;

// ゲームの絵（remake/img）と、それを細かいドット絵に変換した見本用の絵（make_pixel_art.py が作る）。
// 非公開ページへ出すときは、置き場所だけ差し替える。
const ART = {
  paint: {
    shop: img("../../img/backgrounds/bg_tonari_inside_night.webp"),
    stage: img("../../img/backgrounds/bg_tournament_stage.webp"),
    sumi: img("../../img/sprites/characters/sumi/chr_sumi_normal.webp"),
    minto: img("../../img/sprites/characters/minto/chr_minto_normal.webp"),
    tsumugi: img("../../img/sprites/characters/tsumugi/chr_tsumugi_normal.webp"),
  },
  dot: {
    shop: img("./img/dot_bg_shop.webp"),
    stage: img("./img/dot_bg_stage.webp"),
    sumi: img("./img/dot_sumi.webp"),
    minto: img("./img/dot_minto.webp"),
    tsumugi: img("./img/dot_tsumugi.webp"),
  },
};

// ---------------------------------------------------------------- 描き方・色

const STYLES = [
  { id: "now", name: "いま", note: "ぼかした丸を拡大して消す", engine: "legacy" },
  { id: "fine", name: "繊細ドット", note: "もこもこの房を、細かい升目と白に近い4色で", engine: "puff", mode: "fine", stepped: true, dots: true },
  { id: "real", name: "リアル", note: "空気の流れを計算。店の灯りを拾う", engine: "fluid", look: "real" },
  { id: "dot", name: "ドット×リアル", note: "流れを計算した煙を、升目と淡い色の段で", engine: "fluid", look: "pixel", stepped: true, dots: true },
  { id: "cel", name: "セル画", note: "同じ煙を3色と細い線で塗る", engine: "fluid", look: "cel", stepped: true },
  { id: "moku", name: "ドット絵もくもく", note: "はっきりした色と輪郭線の、もこもこ", engine: "puff", mode: "bold", stepped: true, dots: true },
  { id: "mokuS", name: "アニメもくもく", note: "もこもこを、なめらかな線で", engine: "puff", mode: "smooth", stepped: true },
];
const STYLE = Object.fromEntries(STYLES.map((s) => [s.id, s]));

const TINTS = [
  { id: "white", name: "しろ", colors: [[.93, .91, .96]] },
  { id: "lav", name: "ラベンダー", colors: [[.80, .71, .97]] },
  { id: "mint", name: "ミント", colors: [[.70, .93, .84]] },
  { id: "peach", name: "もも", colors: [[.99, .76, .79]] },
  { id: "neon", name: "2色（ピンク×水色）", colors: [[1, .56, .80], [.50, .84, 1]] },
];

// ---------------------------------------------------------------- 場面
// 吐く口（emitter）: x・y は画面に対する 0〜1（y は下向き）、angle は吐く向き（右が0・上が -π/2）、
// 速さ・半径は「画面の高さ＝1」。rate は流体へ足す煙の量、puffRate は「もくもく」の丸の数（毎秒）。

// 会話の相手。mouth は立ち絵の絵の中での口の位置（幅・高さに対する割合）
const CHARS = [
  { id: "minto", name: "みんと", mouth: [.543, .319] },
  { id: "sumi", name: "スミさん", mouth: [.491, .191] },
  { id: "tsumugi", name: "つむぎ", mouth: [.484, .381] },
];
// 立ち絵は 高さ150%・上3%・左右中央に置く（index.html の .chara と同じ）。絵の縦横比は 896:1200
const mouthOf = (id) => { const [u, v] = (CHARS.find((c) => c.id === id) || CHARS[0]).mouth; return { x: .5 + (u - .5) * (1.5 * 896 / 1200) / (16 / 9), y: .03 + v * 1.5 }; };

const SCENES = {
  first: {
    name: "吸い出しの山場", sub: "自分が吐いた煙が、画面の下から満ちて晴れる", bg: "shop", period: 5.4,
    fluid: { dyeFade: .42, velFade: 1.5, buoy: .05, vort: 34, turb: .09, densK: 2.4, wind: [0, .01] },
    puff: { life: 2.5, buoy: .05, drag: 1.7, turb: .12 },
    start(add) {
      add({ kind: "first", x: .5, y: 1.0, angle: -PI / 2, spread: 1.3, speed: 1.05, radius: .09, width: .9, dur: 1.1, rate: 62, splats: 5,
        puffRate: 44, puffSize: .115, puffWidth: .5, puffSpread: 1.0, puffSpeed: 1.0 });
    },
  },
  chara: {
    name: "会話の相手が吐く", sub: "立ち絵の口元から、細く出て広がる", bg: "shop", chara: true, period: 5.2,
    fluid: { dyeFade: .3, velFade: 1.3, buoy: .06, vort: 30, turb: .08, densK: 3, wind: [.01, .01] },
    puff: { life: 2.5, buoy: .028, drag: 1.9, turb: .09, hold: .45 },
    start(add) {
      add({ kind: "mouth", ...mouthOf(state.chara), angle: -.3, spread: .34, sway: .16, speed: .62, radius: .014, width: .006, dur: 1.6, rate: 62, push: 10, dyeWide: 1.5, splats: 3,
        puffRate: 19, puffSize: .05, puffSpeed: .5, puffSpread: .85 });
    },
  },
  haze: {
    name: "店に漂う煙", sub: "席で吐かれた煙が、灯りの下をゆっくり流れる", bg: "shop", ambient: true, prewarm: 6,
    fluid: { dyeFade: .035, velFade: .5, buoy: .02, vort: 12, turb: .12, densK: 1.9, dotGain: .8, wind: [.014, 0] },
    puff: { life: 5, buoy: .022, drag: 1.4, turb: .09, hold: .35 },
    seats: [[.165, .50], [.47, .455], [.705, .49], [.33, .47]],
    tick(add, st, dt) {
      st.wait = (st.wait ?? .2) - dt;
      if (st.wait > 0) return;
      st.wait = 1.1 + Math.random() * 1.8;
      const [x, y] = this.seats[Math.floor(Math.random() * this.seats.length)];
      add({ kind: "seat", x, y, angle: -PI / 2 + (Math.random() - .5) * 1.5, spread: .7, sway: .3, speed: .3, radius: .022, width: .012, dur: 2.2, rate: 15, push: 7, splats: 2, puffRate: 7, puffSize: .05, puffSpeed: .2, puffSpread: 1.2 });
    },
  },
  cover: {
    name: "画面を覆う", sub: "煙で覆って、晴れると次の場面", bg: "shop", period: 4.6, swapAt: 1.0,
    fluid: { dyeFade: .05, velFade: .8, buoy: .06, vort: 26, turb: .1, densK: 3.4, solid: true, wind: [0, .02] },
    puff: { life: 1.9, buoy: .05, drag: 2.2, turb: .1, hold: .62, solid: true, fade: false },
    start(add) {
      // 下の列が吹き上げ、少し遅れて中段の列が上半分を埋める（流体）。もくもくは下から昇る横一列。
      for (let i = 0; i < 6; i++) {
        add({ kind: "cover", lead: i === 0, x: .07 + i * .172, y: 1.0, angle: -PI / 2 + (i - 2.5) * .1, spread: 1.1, sway: .35, speed: 2.5, radius: .12, width: .16, dur: 1.25, rate: 170, push: 15, splats: 3,
          puffRate: 19, puffSize: .19, puffSpeed: .25, puffWidth: .2, puffEven: true, env: "flat", move: (e, u) => { e.puffY = 1.04 - Math.min(1, u * 1.7) * 1.02; } });
      }
      for (let i = 0; i < 5; i++) {
        add({ kind: "cover", x: .1 + i * .2, y: .56, angle: -PI / 2 + (i - 2) * .25, spread: 2.4, sway: .5, speed: 1.3, radius: .13, width: .2, dur: .7, delay: .28, rate: 150, push: 9, splats: 3, env: "flat" });
      }
    },
    tick() {
      // 覆ったあとは早く晴らす
      if (engines.fluid) engines.fluid.params.dyeFade = sceneTime > 1.2 ? 2.6 : .05;
    },
  },
};

// ---------------------------------------------------------------- 状態

const state = { scene: "chara", right: "fine", left: "", tint: "white", world: "dot", chara: "minto", zoom: false, dot: 2, fps: 12, split: .5, paused: false };
const engines = { fluid: null };          // 流体は左右で1つを共有
const sides = { left: {}, right: {} };    // { style, puff, legacy, canvas }
let emitters = [], sceneTime = 0, sceneState = {}, swapped = false, fluidFailed = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const stageEl = $("stage"), fluidCanvas = $("fluid");
const tint = () => TINTS.find((t) => t.id === state.tint) || TINTS[0];

function ensureFluid() {
  if (engines.fluid || fluidFailed) return engines.fluid;
  const coarse = matchMedia("(pointer: coarse)").matches;
  engines.fluid = createFluid(fluidCanvas, coarse ? { simH: 108, dyeH: 432 } : { simH: 144, dyeH: 648 });
  if (!engines.fluid) { fluidFailed = true; $("nogl").hidden = false; return null; }
  loadBgTexture();
  return engines.fluid;
}

const bgImages = {};
function loadBgTexture() {
  const name = () => `${state.world}/${swapped ? "stage" : SCENES[state.scene].bg}`;
  const key = name(), [world, id] = key.split("/");
  const im = bgImages[key] || (bgImages[key] = Object.assign(new Image(), { src: ART[world][id] }));
  const apply = () => { if (engines.fluid && name() === key) engines.fluid.setBackground(im); };
  if (im.complete && im.naturalWidth) apply(); else im.addEventListener("load", apply, { once: true });
}

/** 左右それぞれの描き方に合わせて、必要な層（もくもくのキャンバス・いまの面）を用意する */
function setupSide(name) {
  const side = sides[name], style = STYLE[state[name]], host = $(name === "left" ? "sideL" : "sideR");
  side.style = style;
  if (side.puffKey !== (style?.engine === "puff" ? style.id : "")) {
    side.canvas?.remove(); side.puff = null; side.canvas = null; side.puffKey = "";
    if (style?.engine === "puff") {
      side.canvas = document.createElement("canvas");
      side.canvas.className = style.mode === "smooth" ? "puff" : "puff dots";
      host.append(side.canvas);
      side.puff = createPuffs(side.canvas, { mode: style.mode });
      side.puffKey = style.id;
    }
  }
  if (style?.engine === "legacy" && !side.legacy) side.legacy = createLegacy(host);
  if (style?.engine !== "legacy" && side.legacy) { side.legacy.destroy(); side.legacy = null; }
  if (style?.engine === "fluid") ensureFluid();
  applyScene(false);
}

const activeEngines = () => {
  const list = [];
  const useFluid = Object.values(sides).some((s) => s.style?.engine === "fluid") && engines.fluid;
  if (useFluid) list.push(engines.fluid);
  for (const s of Object.values(sides)) { if (s.puff) list.push(s.puff); if (s.legacy) list.push(s.legacy); }
  return list;
};

function sizeLayers() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  if (!w) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.min(1600, Math.round(w * dpr));
  engines.fluid?.resize(cw, Math.round(cw * 9 / 16));
  for (const s of Object.values(sides)) {
    if (!s.puff) continue;
    // なめらかな方は 960×540 に描いて、ブラウザのなめらかな拡大に任せる
    if (s.style.mode === "smooth") s.puff.resize(960, 540);
    else s.puff.resize(Math.round(1280 / state.dot), Math.round(720 / state.dot));
  }
  stageEl.style.setProperty("--k", String(w / 1280));
}

/** 絵柄（いまの絵／ドット絵）と会話の相手を、背景と立ち絵へ反映する */
function applyArt() {
  const art = ART[state.world];
  $("bgA").style.backgroundImage = `url("${art.shop}")`;
  $("bgB").style.backgroundImage = `url("${art.stage}")`;
  $("chara").src = art[state.chara];
  stageEl.classList.toggle("dotworld", state.world === "dot");
}

/** 寄り（2倍）: 口元と、そこから出る煙が画面に収まる位置を中心にする。くらべている間は使わない */
function applyZoom() {
  const sc = SCENES[state.scene], on = state.zoom && !state.left;
  const m = sc.chara ? mouthOf(state.chara) : state.scene === "first" ? { x: .45, y: .8 } : { x: .45, y: .55 };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  stageEl.style.setProperty("--zx", `${clamp((m.x - .2) * 2) * 100}%`);
  stageEl.style.setProperty("--zy", `${clamp((m.y - .3) * 2) * 100}%`);
  stageEl.classList.toggle("zoom", on);
}

/** 場面の空気の性質と色を、いま使っている全部の描き方へ入れる。restart で煙を消して最初から */
function applyScene(restart) {
  const sc = SCENES[state.scene], colors = tint().colors;
  if (engines.fluid) Object.assign(engines.fluid.params, { shadowK: 1.5, sceneLight: .7, dotGain: 1.5, solid: false }, sc.fluid, { wind: [...sc.fluid.wind] });
  for (const s of Object.values(sides)) {
    if (s.puff) { Object.assign(s.puff.params, { hold: .5, solid: false, fade: true }, sc.puff); s.puff.setColors(colors); }
    if (s.legacy) { s.legacy.setColors(colors); s.legacy.setAmbient(!!sc.ambient); }
  }
  sizeLayers();
  if (!restart) return;
  emitters = []; sceneTime = 0; sceneState = {}; swapped = false;
  for (const e of activeEngines()) e.clear();
  $("bgB").classList.remove("show");
  $("chara").hidden = !sc.chara;
  loadBgTexture();
  if (sc.ambient && engines.fluid) engines.fluid.seedHaze(colors[0], .55);
  sc.start?.(addEmitter);
  // 漂う煙は、開いた時点でもう店に煙がある状態から始める
  for (let t = 0; t < (sc.prewarm || 0); t += 1 / 20) advance(1 / 20);
  drawAll(true);
}

function addEmitter(e) {
  e.t = -(e.delay || 0); e.colors = tint().colors; e.angle0 = e.angle; e.phase = Math.random() * 6.28;
  emitters.push(e);
  for (const eng of activeEngines()) eng.begin?.(e);
}

const envelope = (e, u) => e.env === "flat" ? 1 : u < .28 ? .35 + .65 * (u / .28) : 1 - .7 * ((u - .28) / .72);

function advance(dt) {
  const sc = SCENES[state.scene], list = activeEngines();
  sceneTime += dt;
  sc.tick?.(addEmitter, sceneState, dt, sceneTime);
  if (sc.period && sceneTime >= sc.period) {
    sceneTime = 0; sceneState = {};
    sc.start?.(addEmitter);
  }
  // 画面を覆う場面: 覆っている間に背景を入れ替える（1回ごとに 店 ⇄ 大会の舞台）
  if (sc.swapAt && sceneTime >= sc.swapAt && !sceneState.swapDone) {
    sceneState.swapDone = true; swapped = !swapped;
    $("bgB").classList.toggle("show", swapped);
    loadBgTexture();
  }
  for (const e of emitters) {
    e.t += dt;
    const u = e.t / e.dur;
    if (u >= 1 || u < 0) continue;
    e.move?.(e, u);
    if (e.sway) e.angle = e.angle0 + Math.sin(e.t * 5.3 + e.phase) * e.sway;
    const k = envelope(e, u);
    for (const eng of list) eng.emit(e, k, dt);
  }
  emitters = emitters.filter((e) => e.t < e.dur);
  for (const eng of list) eng.step(dt);
}

// ---------------------------------------------------------------- 描画

let lastHold = 0;
function drawAll(force) {
  const now = performance.now();
  const tick = force || now - lastHold >= 1000 / state.fps - 2;
  if (tick) lastHold = now;
  const colors = tint().colors, single = !state.left;
  const fluidParts = [];
  for (const [name, x0, x1] of [["left", 0, single ? 0 : state.split], ["right", single ? 0 : state.split, 1]]) {
    const s = sides[name];
    if (!s.style || x1 <= x0) continue;
    if (s.style.engine === "fluid" && engines.fluid) {
      fluidParts.push({ look: s.style.look, x0, x1, stepped: !!s.style.stepped && state.fps < 60, px: state.dot, tintA: colors[0], tintB: colors[1] || colors[0] });
    }
    if (s.puff && (tick || state.fps >= 60)) s.puff.draw();
  }
  if (engines.fluid) {
    if (tick && fluidParts.some((p) => p.stepped)) engines.fluid.hold();
    engines.fluid.render(fluidParts);
  }
}

let last = 0, acc = 0, frames = 0, fpsAt = 0;
const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - last) / 1000 || 0);
  last = now;
  if (state.paused || document.hidden) return;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 3) { advance(STEP); acc -= STEP; n++; }
  if (acc > STEP * 3) acc = 0;
  drawAll(false);
  frames++;
  if (now - fpsAt >= 1000) { $("fps").textContent = `${Math.round(frames * 1000 / (now - fpsAt))} コマ/秒で動作中`; frames = 0; fpsAt = now; }
}

// ---------------------------------------------------------------- 操作

function layoutSplit() {
  const single = !state.left, pct = single ? 0 : state.split * 100;
  $("sideL").style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  $("sideR").style.clipPath = `inset(0 0 0 ${pct}%)`;
  $("divider").hidden = single; $("tagL").hidden = single;
  $("divider").style.left = `${pct}%`;
  $("tagL").textContent = STYLE[state.left]?.name || "";
  $("tagR").textContent = STYLE[state.right].name;
}

function chips(host, items, get, set, label) {
  host.replaceChildren(...items.map((it) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.dataset.id = String(it.id);
    b.append(label(it));
    b.addEventListener("click", () => { set(it.id); sync(); });
    return b;
  }));
  host.sync = () => { for (const b of host.children) b.setAttribute("aria-pressed", String(b.dataset.id === String(get()))); };
}

function sync() {
  for (const id of ["scenes", "styles", "compare", "tints", "dots", "fpsChips", "worlds", "charas", "zooms"]) $(id).sync?.();
  $("charaRow").classList.toggle("off", !SCENES[state.scene].chara);
  $("zoomRow").classList.toggle("off", !!state.left);
  applyZoom();
  const st = [STYLE[state.right], STYLE[state.left]].filter(Boolean);
  $("dotRow").classList.toggle("off", !st.some((s) => s.dots));
  $("fpsRow").classList.toggle("off", !st.some((s) => s.stepped));
  $("sceneSub").textContent = SCENES[state.scene].sub;
  $("pause").textContent = state.paused ? "動かす" : "止める";
  layoutSplit();
}

const text = (t, cls) => { const s = document.createElement("span"); s.textContent = t; if (cls) s.className = cls; return s; };

function buildControls() {
  chips($("scenes"), Object.entries(SCENES).map(([id, s]) => ({ id, ...s })), () => state.scene, (id) => { state.scene = id; applyScene(true); }, (s) => text(s.name));
  chips($("styles"), STYLES.filter((s) => s.id !== "now"), () => state.right, (id) => { state.right = id; if (state.left === id) state.left = "now"; setupSide("right"); setupSide("left"); applyScene(true); },
    (s) => { const f = document.createDocumentFragment(); f.append(text(s.name, "chip-name"), text(s.note, "chip-note")); return f; });
  chips($("compare"), [{ id: "", name: "くらべない" }, ...STYLES], () => state.left, (id) => { if (id === state.right) return; state.left = id; setupSide("left"); applyScene(true); }, (s) => text(s.name));
  chips($("tints"), TINTS, () => state.tint, (id) => { state.tint = id; applyScene(true); }, (t) => {
    const f = document.createDocumentFragment(), dot = document.createElement("i");
    dot.className = "swatch";
    dot.style.background = t.colors.length > 1 ? `linear-gradient(90deg, rgb(${t.colors[0].map((v) => v * 255)}) 50%, rgb(${t.colors[1].map((v) => v * 255)}) 50%)` : `rgb(${t.colors[0].map((v) => v * 255)})`;
    f.append(dot, text(t.name));
    return f;
  });
  chips($("worlds"), [{ id: "dot", name: "ドット絵" }, { id: "paint", name: "いまの絵" }], () => state.world, (id) => { state.world = id; applyArt(); loadBgTexture(); }, (w) => text(w.name));
  chips($("charas"), CHARS, () => state.chara, (id) => { state.chara = id; applyArt(); applyScene(true); }, (c) => text(c.name));
  chips($("zooms"), [{ id: "0", name: "ぜんたい" }, { id: "1", name: "口元に寄る（2倍）" }], () => (state.zoom && !state.left ? "1" : "0"), (id) => { state.zoom = id === "1"; if (state.zoom && state.left) { state.left = ""; setupSide("left"); applyScene(true); } }, (z) => text(z.name));
  chips($("dots"), [2, 3, 4, 6].map((id) => ({ id, name: { 2: "細かい", 3: "ふつう", 4: "粗い", 6: "とても粗い" }[id] })), () => state.dot, (id) => { state.dot = id; sizeLayers(); }, (d) => text(d.name));
  chips($("fpsChips"), [60, 24, 12, 8].map((id) => ({ id, name: id === 60 ? "なめらか" : `毎秒${id}コマ` })), () => state.fps, (id) => { state.fps = id; }, (d) => text(d.name));

  $("again").addEventListener("click", () => applyScene(true));
  $("pause").addEventListener("click", () => { state.paused = !state.paused; sync(); });

  // 画面をタップ: そこから吐く。境目のつまみはドラッグで左右に動かす。
  let dragging = false;
  const setSplit = (ev) => {
    const r = stageEl.getBoundingClientRect();
    state.split = Math.max(.06, Math.min(.94, (ev.clientX - r.left) / r.width));
    layoutSplit();
  };
  $("divider").addEventListener("pointerdown", (ev) => { dragging = true; $("divider").setPointerCapture(ev.pointerId); ev.stopPropagation(); ev.preventDefault(); });
  $("divider").addEventListener("pointermove", (ev) => { if (dragging) setSplit(ev); });
  for (const type of ["pointerup", "pointercancel"]) $("divider").addEventListener(type, () => { dragging = false; });
  $("divider").addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    state.split = Math.max(.06, Math.min(.94, state.split + (ev.key === "ArrowLeft" ? -.04 : .04)));
    layoutSplit(); ev.preventDefault();
  });
  stageEl.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("#divider")) return;
    const r = $("world").getBoundingClientRect(); // 寄りの拡大もここに反映されている
    const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    addEmitter({ kind: "tap", x, y, angle: -PI / 2 + (x - .5) * .9, spread: .55, speed: .8, radius: .024, width: .014, dur: .8, rate: 16, splats: 2, puffRate: 44, puffSize: .05 });
    $("hint").classList.add("seen");
  });
}

function start() {
  applyArt();
  buildControls();
  setupSide("right"); setupSide("left");
  new ResizeObserver(() => { sizeLayers(); drawAll(true); }).observe(stageEl);
  sync();
  applyScene(true);
  // 「動きを減らす」設定では止めた状態から始める（「動かす」で再生できる）
  if (reducedMotion.matches) { for (let t = 0; t < 1.1; t += STEP) advance(STEP); drawAll(true); state.paused = true; sync(); }
  requestAnimationFrame(frame);
}

// 動作確認用（ヘッドレスの撮影で時間を進める）
window.smokeStyles = { state, advance(sec) { for (let t = 0; t < sec; t += STEP) advance(STEP); drawAll(true); }, set(patch) { Object.assign(state, patch); applyArt(); setupSide("right"); setupSide("left"); sync(); applyScene(true); } };

start();
