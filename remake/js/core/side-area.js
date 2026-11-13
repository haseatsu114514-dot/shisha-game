// 左右の余白の活用（YHK・2026-11-11 オーナー決定「ボタンがあるやつ・日にちとかの」「主流なスマホに合わせる」）。
// 画面方針（#3035）はそのまま: ステージは固定 1280×720、余った分は場面背景のぼかし（#backdrop）。
// ここでは、ぼかしの上・ステージの外に層を2枚（左・右）足すだけで、ステージの中の配置は動かさない。
//   A 煙と縁    … 余白が少しでもあれば出す。
//   B 縦書きの帯 … 章・街・日付と時間帯を、ステージの端に沿った1列で。余白がステージ上 60px 以上。
//   C 親指ボタン … 会話の AUTO／SKIP／LOG／用語／設定／「次へ」、地図の LIME／MENU。余白 118px 以上のタッチ端末だけ。
// 寸法は主流のスマホ（19:9〜20:9。余白はステージ上で片側 120〜160px）に合わせてある。余白が足りない端末・PC・
// 16:9 の画面では C を出さず、ステージの中のボタンを今までどおり使う。
// 試遊ページ（camel-race.html など。共通の画面当て core/stage-fit.js を使う単体ページ）は standalone で呼び、A だけ出す
// （ゲームの状態・会話・HUD が無いので、帯とボタンは出さない）。設定「左右の余白」と「揺れ・閃光を減らす」は端末の保存を読む
// （readSettings: false なら読まない。TRPG の試遊ページは、保存領域に一切触れない決まりなので、既定の見た目で出す）。
//
// C の作り: 余白のボタンは、ステージの中の元のボタン（.vn-ctl・.hud-lime・.hud-menu）を代わりに押すだけ。
// 余白へ出している間、元のボタンは CSS（side-area.css）で隠す。元のボタンが押せない場面（モーダル・LOG・
// 演出が上に重なっている、会話中で HUD が止まっている 等）は、押す瞬間に同じ当たり判定で確かめて何もしない。
import { el } from "./util.js";
import { on } from "./bus.js";
import { onStageFit } from "./stage-fit.js";
import { state, config, CONFIG_KEY } from "./state.js";
import { chapterDay, departurePrep } from "./chapter-clock.js";
import { currentCity } from "./city-locations.js";

/** 余白の幅（ステージ上の px・片側）の段。mid から縦書きの帯、wide から親指ボタン。 */
export const SIDE_MIN = Object.freeze({ narrow: 20, mid: 60, wide: 118 });
export const sideTier = (g) => g >= SIDE_MIN.wide ? "wide" : g >= SIDE_MIN.mid ? "mid" : g >= SIDE_MIN.narrow ? "narrow" : "none";

const KANJI = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
/** 縦書き用の漢数字（0〜99。それより大きい数は算用数字のまま）。 */
export function kanjiNumber(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n < 10) return KANJI[n];
  if (n > 99) return String(n);
  const tens = Math.floor(n / 10), ones = n % 10;
  return `${tens > 1 ? KANJI[tens] : ""}十${ones ? KANJI[ones] : ""}`;
}

// 帯を出さない画面（遊んでいる最中ではない所）。章の読み込み中（ch2-loading など）も出さない。
const QUIET_SCREENS = new Set(["boot", "title", "staff-roll", "end", "preview", "ch2-error", "ch2-stop"]);
/**
 * 縦書きの帯に出す言葉。出さない場面は null。
 * 章・日付はセーブ一覧（scenes/saves.js の slotInfo）と同じ読み方、街は HUD の札と同じ（currentCity）。
 */
export function stripInfo(value, screen) {
  if (!value || !screen || QUIET_SCREENS.has(screen) || /-loading$/.test(screen)) return null;
  const day = `${kanjiNumber(chapterDay(value))}日目`;
  const when = departurePrep(value) ? `出発前${day}`
    : value.phase === "tournament" ? "大会当日"
    : value.phase === "daily" ? `${day}・${value.slot >= 1 ? "夜" : "昼"}` : day;
  return { chapter: `第${kanjiNumber(value.chapter || 1)}章`, city: currentCity(value).name, when };
}

/** 親指ボタンを出してよいか（端末の設定とは別の、開発・検査用の切り替え）。
 *  自動操作のブラウザ（navigator.webdriver）は既定で出さない: 既存のブラウザ検査はステージの中のボタンを押し、
 *  寸法を測っているため（見た目の様式の既定 core/look.js・LK09 と同じ線引き）。余白のボタンの検査は
 *  localStorage の "suien_side_pad" を "on" にして明示する（side_area.mjs）。"off" で遊ぶ端末でも止められる。 */
function padAllowed() {
  let flag = null;
  try { flag = globalThis.localStorage?.getItem("suien_side_pad"); } catch { /* 読めない環境は既定 */ }
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !(typeof navigator !== "undefined" && navigator.webdriver === true);
}
const coarsePointer = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

const html = () => document.documentElement;
let dom = null;      // { l, r, strip, chapter, city, when, pads: { id: button } }
let deps = {};
let standalone = false; // 試遊ページ: 煙と縁だけ
let geom = { k: 1, g: 0, tier: "none", key: "" };
let syncTimer = 0;

function build(viewport) {
  const side = (id) => {
    const inner = el("div.side-in", [el("i.side-smoke.a"), el("i.side-smoke.b"), el("i.side-fall"), el("i.side-rim")]);
    const node = el("div.side", { dataset: { side: id } }, [inner]);
    viewport.append(node);
    return { node, inner };
  };
  const l = side("l"), r = side("r");
  const chapter = el("small"), city = el("b"), when = el("span");
  // 縦書きの1列。読み上げは HUD・MENU・セーブ一覧が同じ内容を持つので、飾りとして扱う。
  const strip = el("p.side-strip", { "aria-hidden": "true", hidden: true, dataset: { test: "side-strip" } }, [chapter, city, el("i"), when]);
  l.inner.append(strip);
  const pads = {};
  const button = (id, name, children) => pads[id] = el("button.side-btn", {
    type: "button", "aria-label": name, dataset: { pad: id, test: `side-${id}`, live: "false" },
    onclick: (event) => press(id, event),
  }, children);
  l.inner.append(el("div.side-pad.bottom", [
    button("skip", "SKIP", [el("span", { text: "SKIP" })]),
    button("log", "LOG", [el("span", { text: "LOG" })]),
  ]));
  r.inner.append(
    el("div.side-pad.top", [
      button("glossary", "用語", [el("span", { text: "用語" })]),
      button("config", "設定", [el("span", { text: "設定" })]),
      button("lime", "LIME", [el("span.side-lime", { text: "LIME" }), el("em.side-badge", { hidden: true })]),
      button("menu", "MENU", [el("i.side-bars"), el("span", { text: "MENU" }), el("em.side-badge.fire", { hidden: true }), el("i.side-dot", { hidden: true })]),
    ]),
    el("div.side-pad.bottom", [
      button("auto", "AUTO", [el("span", { text: "AUTO" })]),
      button("next", "次へ", [el("span", { text: "次へ" })]),
    ]),
  );
  pads.auto.setAttribute("aria-pressed", "false");
  pads.skip.setAttribute("aria-pressed", "false");
  return { l: l.node, r: r.node, strip, chapter, city, when, pads };
}

// ---------------------------------------------------------------- 置き場所と段

function layout({ stage, k }) {
  if (!dom) return;
  const frame = stage.parentElement.getBoundingClientRect(), box = stage.getBoundingClientRect();
  const left = Math.max(0, box.left - frame.left), right = Math.max(0, frame.right - box.right);
  // 画面の当て直しは同じ寸法で何度も来る（ブラウザのバーの出し入れ・スクロール）。変わった時だけ置き直す。
  const key = [k, left, right, box.top - frame.top, box.height].map((v) => Math.round(v * 100)).join(",");
  if (key === geom.key) return;
  const place = (node, x, width) => {
    Object.assign(node.style, { left: `${x}px`, top: `${box.top - frame.top}px`, width: `${width}px`, height: `${box.height}px` });
    node.style.setProperty("--k", String(k));
    node.style.setProperty("--side-g", `${width / k}px`);
  };
  place(dom.l, 0, left);
  place(dom.r, box.right - frame.left, right);
  const g = Math.min(left, right) / k;
  geom = { k, g, tier: sideTier(g), key };
  applyMode();
}

/** 設定・見た目の様式・余白の段から、出す物を決める。 */
function applyMode() {
  if (!dom) return;
  const root = html();
  // DS風（retro）は自前の操作の面を持ち、ぼかし・グラデーションを使わない様式なので、余白は今までどおりにする。
  const enabled = config.sideArea !== "plain" && root.dataset.look !== "retro" && geom.tier !== "none";
  root.dataset.side = enabled ? geom.tier : "off";
  root.dataset.sidePad = enabled && !standalone && geom.tier === "wide" && coarsePointer() && padAllowed() ? "on" : "off";
  sync();
}

/** 設定を変えた時に呼ぶ（scenes/title.js の設定）。 */
export function refreshSideArea() { applyMode(); }

// ---------------------------------------------------------------- 縦書きの帯

function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
function updateStrip() {
  const info = standalone || html().dataset.side === "off" ? null : stripInfo(state, document.body.dataset.screen);
  if (dom.strip.hidden !== !info) dom.strip.hidden = !info;
  if (!info) return;
  setText(dom.chapter, info.chapter);
  setText(dom.city, info.city);
  setText(dom.when, info.when);
}

// ---------------------------------------------------------------- 親指ボタン

/** その部品の真ん中を押した時、一番手前でその部品に当たるか（モーダル・演出・pointer-events の止めを全部含めた判定）。 */
function hits(node) {
  if (!node?.isConnected) return false;
  const r = node.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!top && (top === node || node.contains(top));
}
/** 余白へ出している間に隠してある HUD のボタンを、判定の間だけ戻して確かめる（同じ処理の中なので画面には出ない）。 */
function hitsHidden(nodes) {
  const root = html();
  root.classList.add("side-probe");
  try { return nodes.map(hits); } finally { root.classList.remove("side-probe"); }
}
const vnButton = (id) => document.querySelector(`#vn .vn-ctl[data-test="vn-${id}"]`);
const hudButton = (id) => document.querySelector(`#hud .hud-right > .hud-${id}`);
/** 元の設定ボタンを一瞬戻し、モーダル・カットインに遮られていないか確かめる。 */
const vnLive = () => !!document.getElementById("vn")?.classList.contains("active")
  && !document.querySelector("#vn .vn-log.show") && hitsHidden([vnButton("config")])[0];

function setAttr(node, name, value) { if (node.getAttribute(name) !== value) node.setAttribute(name, value); }
function setBadge(node, text) {
  if (node.hidden !== !text) node.hidden = !text;
  setText(node, text || "");
}
function syncPads() {
  const { pads } = dom;
  const active = html().dataset.sidePad === "on";
  const live = { lime: false, menu: false, auto: false, skip: false, log: false, glossary: false, config: false, next: false };
  if (active) {
    if (vnLive()) {
      live.auto = live.skip = live.log = live.glossary = live.config = true;
      live.next = !document.querySelector("#vn .vn-choices")?.childElementCount;
      for (const id of ["auto", "skip"]) setAttr(pads[id], "aria-pressed", vnButton(id)?.getAttribute("aria-pressed") === "true" ? "true" : "false");
    }
    const lime = hudButton("lime"), menu = hudButton("menu");
    if ((lime || menu) && document.getElementById("hud")?.classList.contains("show")) {
      [live.lime, live.menu] = hitsHidden([lime, menu]);
      if (live.lime) {
        const count = lime.querySelector(".badge-number")?.textContent.trim() || "";
        setBadge(pads.lime.querySelector(".side-badge"), count ? `${count}${lime.querySelector(".badge-plus") ? "+" : ""}` : "");
        setAttr(pads.lime, "aria-label", lime.getAttribute("aria-label") || "LIME");
      }
      if (live.menu) {
        setBadge(pads.menu.querySelector(".side-badge"), menu.querySelector(".hidane-badge:not([hidden])")?.textContent.trim() || "");
        const dot = pads.menu.querySelector(".side-dot"), gain = !!menu.querySelector(".hud-gain");
        if (dot.hidden === gain) dot.hidden = !gain;
      }
    }
  }
  for (const [id, node] of Object.entries(pads)) setAttr(node, "data-live", String(live[id]));
}

function press(id, event) {
  if (html().dataset.sidePad !== "on") return;
  if (id === "next") { if (vnLive()) deps.advance?.(); }
  else if (id === "lime" || id === "menu") { const target = hudButton(id); if (target && hitsHidden([target])[0]) target.click(); }
  else { const target = vnButton(id); if (target && vnLive()) target.click(); }
  // 指で押した後は、キーボードの Enter／Space が会話の送りに戻るようフォーカスを残さない。
  if (event?.detail > 0) event.currentTarget?.blur?.();
  scheduleSync(0);
}

// ---------------------------------------------------------------- 追随

function sync() {
  clearTimeout(syncTimer);
  syncTimer = 0;
  if (!dom) return;
  updateStrip();
  syncPads();
}
function scheduleSync(delay = 80) {
  if (syncTimer || !dom) return;
  syncTimer = setTimeout(sync, delay);
}

/** 端末に保存した設定の読み取り（試遊ページは本編の起動を通らないので、必要な2つだけを自分で読む）。 */
function savedConfig() {
  try { return JSON.parse(globalThis.localStorage?.getItem(CONFIG_KEY) || "{}") || {}; } catch { return {}; }
}

/**
 * 余白の層を作り、画面の当て直し・場面の変化へ追随させる。
 * 本編（index.html）は advance（会話の「次へ」・vn/engine.js の tapAdvance）を渡す。
 * 試遊ページは standalone: true で、煙と縁だけ出す。端末の保存（設定）を読みたくないページは readSettings: false。
 */
export function initSideArea({ stage, advance, standalone: alone = false, readSettings = true } = {}) {
  if (dom || !stage?.parentElement) return;
  standalone = alone;
  deps = { advance };
  if (standalone && readSettings) {
    const saved = savedConfig();
    if (saved.sideArea === "plain") config.sideArea = "plain";
    html().dataset.sideCalm = saved.reduceShake ? "on" : "off";
  }
  dom = build(stage.parentElement);
  onStageFit(layout);
  layout({ stage, k: Number(stage.style.getPropertyValue("--k")) || 1 });
  if (standalone) return; // 帯・ボタンの追随（HUD・会話・場面の監視）は本編だけ
  on("hud", () => scheduleSync());
  document.addEventListener("lookchange", applyMode);
  // 場面の変化（会話の開始・終了、モーダル、HUD の出し入れ、選択肢、AUTO／SKIP の切り替え）で合わせ直す。
  // 見るのは class などの切り替えと、層の直下の出し入れだけ（会話の文字送りは 1 字ごとに中身を書き換えるので見ない）。
  const changed = (records) => {
    if (html().dataset.side !== "off" && records.some((record) => !record.target.closest?.(".side"))) scheduleSync();
  };
  new MutationObserver(changed).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "data-screen", "hidden", "aria-pressed"] });
  const layers = new MutationObserver(changed);
  for (const id of ["screen", "vn", "hud", "fx", "modal"]) {
    const layer = document.getElementById(id);
    if (layer) layers.observe(layer, { childList: true });
  }
  // 上の合図に乗らない変化（様式・絵の読み込みで後から決まる重なり など）の保険。軽い読み取りだけ。
  setInterval(() => { if (html().dataset.side !== "off") scheduleSync(0); }, 1000);
}
