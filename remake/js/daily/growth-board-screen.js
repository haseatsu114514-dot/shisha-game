// 心得の盤の画面（SPEC 第2版 6.2、ADDENDUM-BOARD-LAYOUT）。盤の最終デザインは #2129（ネオンのラウンジ・SBD79〜90。2026-11-02 オーナー確定）。
// 盤の面・札・台座・結界・顔は #2129 を正とし、作り直さない。外枠（見出し・タブ・凡例）の紙の色は DUI17。画像が読めない時だけ図形で描く。
// 盤は能力ごとに3枚（上の札で入れ替え）。道は SVG、マスは HTML のボタン（キーボード・タッチで押せる）。
// 参拝の場所で内省した時（place あり）だけ灯せる。メニュー・寝る前から開いた時は見るだけで、目標は決められる（2.8）。
import { el, sleep } from "../core/util.js";
import { layers, modal, gainCard } from "../core/ui.js";
import { SE, createGrowthBoardAudio } from "../core/audio.js";
import { emit, on } from "../core/bus.js";
import { state, save } from "../core/state.js";
import { canRespec, prepareRespec, commitRespec } from "../core/growth-respec.js";
import { growthEnabled } from "../core/growth-mode.js";
import { grantStarterHidane, tutorialPending, startBoardTutorial, STARTER_HIDANE, STARTER_FLAG, TUTORIAL_FLAG } from "./growth-board-tutorial.js";
import { LESSON_TUNING } from "../core/growth-effects.js";
import { reducedMotion, igniteAt, runAlongPath, flyHidane, bump, commitCutIn, emberField, HIDANE_COLOR } from "./growth-fx.js";
import { openBoardHelp } from "./growth-board-help.js";
import { displayName, faceIconUrl, portraitInfo, faceFrame } from "../core/data.js";
import { portraitStyle } from "../core/portrait-style.js";
import { affinityLevel } from "../core/stats.js";
import { ensureGrowth, gaugeInfo, HIDANE_KEYS, lessonLearned, readyLessons } from "../core/growth.js";
import {
  BOARD_KEYS, BOARD_JA, BOARD_HEAD, REWARD_JA, FEATURES,
  HUB, NODES, NODE_BY_ID, boardNodes, ringsOpen, statCount, statTotal, replay, nodeStatus, commitPending,
  pathTo, pendingTowards, lessonLock, hasMet, availableCount, paymentFor, spendableHidane,
  GRID, lessonKnown, perkOf, HIDANE_NAME, perkTotals, featuresOf, statsFilled, HUB_AT, statRatio, boardRoutes, NOTABLES,
} from "../core/growth-board.js";

// ---------------------------------------------------------------- 配置（盤の領域 760×488。紋は下の端 380,452。横13×縦9 の方眼で上へ育つ。SBD62）

// 盤の世界の大きさ（SBD78）: マスの間隔 CELL を広げ、札の大きさはそのまま。のぞき窓（760×488）より大きいので、スクロールで動かす。
// 横は −GRID.w〜GRID.w、縦は −GRID.h〜0（紋の段）。まわりに余白 PAD
const CELL = 84, PAD = 64;
const W = GRID.w * 2 * CELL + PAD * 2, H = GRID.h * CELL + PAD * 2, CX = W / 2, CY = H - PAD;
const VIEW_W = 760, VIEW_H = 488;
// 紋の場所は盤ごとに違う（SBD65）。座標は紋からのずれなので、HUB_AT（方眼の座標）を足して描く
let drawBoard = "body";
const hubAt = (b = drawBoard) => HUB_AT[b].split(",").map(Number);
const at = (gx, gy) => { const [hx, hy] = hubAt(); return { x: CX + (gx + hx) * CELL, y: CY + (gy + hy) * CELL }; };
const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, children = []) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const c of children) n.append(c);
  return n;
};
/** 恩恵の文の数字だけ（「最大体力 ＋12」）。text は perkTotals の合計入りの文、sum は上書きする合計 */
const fmtPerk = (text, sum) => text.replace(/[\d.]+/, String(Math.round(sum * 10) / 10));
const payText = (pay) => Object.entries(pay).map(([k, n]) => `${HIDANE_NAME[k]}${n}`).join("＋") || "火種いらず";
/**
 * 生成画像（GB03 5.2。remake/img/ui/growth_board/*.webp）。全部読めた時だけ盤に `has-art` を付けて画像の見た目にする。
 * 読めない時は今の図形（CSS/SVG）のまま動く。画像は飾りで、規則・データは変えない（SBD72）。
 */
const ART_DIR = "img/ui/growth_board/";
/** マスのアイコン（SBD73「漢字が多いのでアイコンを」）: 恩恵・スキル・極み・色の台座。has-art の時だけ出し、漢字は下に残す */
const iconOf = (node) => node.kind === "stat" ? (node.peak ? "peak" : node.perk ? `perk_${node.perk}` : null)
  : node.kind === "skill" ? `skill_${node.id}` : node.kind === "gate" ? "gate" : null;
/**
 * 札の顔（faces/<人>.webp）がある人。asset_sources/ui/growth-board-20261030/faces/make_faces.py の WHO と同じ。
 * 札の顔と右のパネルの立ち絵は、顔アイコンと同じ顔の位置の記録（manifest の faceFrames。立ち絵ごとに測った目の高さ・顔の大きさ）で
 * 顔の大きさと高さをそろえる（SBD81・SBD82）。2026-11-06 設定で新バージョンの立ち絵を選んでいる時は、新バージョンの絵とその絵で測った記録
 * （faces/new/<人>.webp）。新バージョンの絵が無い人は、会話と同じく現行の絵
 */
const BOARD_FACES = new Set(["sumi", "minto", "adam", "tsumugi", "naru", "rei", "ageha", "kumicho", "saku", "steve", "volk", "rio",
  "hiyori", "samechan", "mashiro", "sheikh", "da_silva", "hajime", "master_hookah", "dr_kemuri"]);
/** 顔の幅 ÷ 顔の大きさ（make_faces.py の FACE_PER_UNIT と同じ） */
const BOARD_FACE_PER_UNIT = 0.87;
/** 立ち絵（896×1200）の上での [顔の中央 x, 目の高さ y, 顔の幅]。その画風で測っていなければ null */
function portraitEyes(who, style) {
  const f = faceFrame(who, style);
  return f?.eye && f.unit ? [f.eye[0], f.eye[1], f.unit * BOARD_FACE_PER_UNIT] : null;
}
/** 札の顔の画像。今の画風で測った人はその画風の顔、ほかは現行の顔 */
function boardFaceUrl(who, style = portraitStyle()) {
  if (!BOARD_FACES.has(who)) return null;
  return style !== "classic" && portraitEyes(who, style) ? `${ART_DIR}faces/${style}/${who}.webp` : `${ART_DIR}faces/${who}.webp`;
}
/** 右のパネルの立ち絵: 顔の幅をこの px に、目をパネルの上からこの px に */
const PANEL_FACE_W = 82, PANEL_EYE_Y = 64;
/** 右のパネルの立ち絵の表情（SBD82）。授業は教える人、スキルははじめ。無い表情は portraitInfo が近いものに */
const PANEL_FACE = {
  "M-B1": "smile", "M-S1": "serious", "M-S2": "intense", "M-S3": "smile", "M-W1": "normal", "M-W2": "thinking", "M-W3": "excited",
  "M-W6": "smile", "M-B2": "smile", "M-S4": "smile", "M-W4": "smug", "M-B3": "smug", "M-S5": "smile", "M-W5": "serious",
  "M-S6": "smile", "M-B4": "axe_throw", "M-W7": "excited", "M-B5": "smile", "M-W8": "smug", "M-B6": "excited", "M-S7": "smile", "M-W9": "smile",
  K03: "smile", K04: "smile", K07: "serious", K08: "excited", K12: "serious", K13: "excited", K15: "smug", K06: "serious",
  K10: "serious", K16: "smug", K11: "serious", K14: "surprise", K01: "serious", K02: "smile", K05: "surprise", K17: "normal",
  K09: "smile", K18: "serious", K19: "smile", K21: "smug", K22: "normal", K23: "smug", K24: "serious",
};
/** スキル説明の白黒漫画コマ。共用する日常スキルは同じ場面を使う（#3425・SBD129）。 */
const SKILL_ART = {
  K15: "sk_k15", K04: "sk_k04", K07: "sk_k07", K21: "sk_k21", K16: "sk_k16",
  K10: "sk_k10", K19: "sk_k19", K08: "sk_k08", K12: "sk_k12", K13: "sk_k13",
  K11: "sk_k11", K14: "sk_k14", K09: "sk_k09",
  K03: "sk_morning", K05: "sk_morning",
  K01: "sk_prep", K18: "sk_prep", K17: "sk_prep",
  K02: "sk_notebook", K24: "sk_notebook", K23: "sk_notebook",
  K06: "sk_steam_calm", K22: "sk_steam_calm",
};
const ART_FILES = ["board_glass", "screen_backdrop", "hub_body", "hub_sense", "hub_wisdom", "frame_skill", "frame_lesson", "frame_gate", "frame_peak", "frame_seal",
  "hidane_any", "hidane_body", "hidane_sense", "hidane_wisdom", "panel_frame", "wall_seal", "silhouette_unknown",
  // GB04（SBD121・SBD123）: 火種の受け皿・盤の札・マスの印の台・丸いボタン・紙の札・飾り罫
  "socket", "tab_on", "tab_dim", "tab_off", "badge_cost", "badge_check", "badge_unknown", "round_btn", "card", "title_rule"];
let artReady = null;
export function loadBoardArt() {
  if (artReady) return artReady;
  artReady = Promise.all(ART_FILES.map((name) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `${ART_DIR}${name}.webp`;
  }))).then((ok) => ok.every(Boolean)).catch(() => false);
  return artReady;
}
export const PLACE_JA = { kannon: "観音堂", tokyo_shrine: "池の弁天堂", dubai_mosque: "モスクの回廊", inn_window: "宿の窓辺" };

let current = null;

/** 盤を開き、閉じるまで待つ。戻り値=確定したマス */
export function openBoard({ place = null } = {}) {
  if (current) return current.done;
  const owner = state, original = ensureGrowth();
  // はじめて灯せる時は、最初の火種（白火）を渡して案内する（growth-board-tutorial.js・台帳 SBD）
  const hadStarter = !!owner?.flags?.[STARTER_FLAG];
  const starterGiven = place ? grantStarterHidane(owner, original) : 0;
  let stopTutorial = () => {};
  let g = original, canLight = !!place, rebuilding = null, finishing = false;
  let dismissConfirm = null;
  let offOwner = () => {};
  let pending = [];
  let board = boardOfTarget() || BOARD_KEYS[0];
  let selected = null;
  let renderedView = null;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  const header = el("div.gb-header");
  const tabs = el("div.gb-tabs", { role: "tablist" });
  const boardSvg = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "gb-svg", "aria-hidden": "true" });
  // 灯すほど盤の背景が明るくなり、奥の絵が見えてくる（SBD65。絵は reveal_<盤>.webp を後で置く。無い間は光だけ）
  const reveal = el("div.gb-reveal", { "aria-hidden": "true" });
  const nodeLayer = el("div.gb-nodes");
  // 盤は拡大して始め、ドラッグ・スクロールで動かし、Ctrl＋ホイール・つまむ・＋−で倍率を変える（2026-10-31 オーナー「もう少し拡大したところから始めたい。
  // 移動は好きにできるしスクロールで先のも見れる」SBD77）。拡大すると札が重なってずれて見えたので（SBD78）、マスの間隔を広げた世界（W×H）を
  // 等倍で始め、縮める方向だけ scale する。「全体」は盤がのぞき窓に収まる倍率
  // 演出の層（SBD104）: 火の粉・光の輪は盤の座標に置くので、拡大・移動に付いてくる。描き直しでは消さない
  const fxLayer = el("div.gb-fx", { "aria-hidden": "true" });
  const stage = el("div.gb-stage", { style: { width: `${W}px`, height: `${H}px` } }, [reveal, boardSvg, nodeLayer, fxLayer]);
  const world = el("div.gb-world", [stage]);
  const viewport = el("div.gb-board", { dataset: { test: "board-viewport" } }, [world]);
  const zoomBar = el("div.gb-zoom", { "aria-label": "盤の倍率" });
  // 盤の上をゆっくり昇る火の粉（飾り）。灯すほど増える（data-level 0〜3）。のぞき窓に重ねるだけで、押す操作は通す
  const embers = Object.assign(emberField(14), { className: "gfx-embers gb-embers" });
  const boardWrap = el("div.gb-board-wrap", [viewport, embers, zoomBar]);
  const ZOOM_MIN = Math.min(VIEW_W / W, VIEW_H / H), ZOOM_START = 1, ZOOM_MAX = 1.5;
  let zoom = ZOOM_START;
  const side = el("div.gb-side", { dataset: { test: "board-preview" }, "aria-live": "polite" });
  const footer = el("div.gb-footer");
  const root = el(`div.gboard${canLight ? ".can-light" : ".view-only"}`, { role: "dialog", "aria-label": "心得の盤", dataset: { test: "growth-board", mode: canLight ? "light" : "view" } }, [
    header,
    el("div.gb-main", [el("div.gb-left", [tabs, boardWrap]), side]),
    footer,
  ]);

  function boardOfTarget() { return g.target ? NODE_BY_ID[g.target]?.board : null; }

  /** ゲーム全体の拡縮（1280×720 を画面に合わせる transform）を割り戻す係数 */
  const gameScale = () => { const r = viewport.getBoundingClientRect(); return r.width && viewport.clientWidth ? r.width / viewport.clientWidth : 1; };
  /** 倍率を変える。anchor は盤の中で動かさない点（盤の座標。省略で見えている所の真ん中） */
  function setZoom(z, anchor = null) {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    const vw = viewport.clientWidth || VIEW_W, vh = viewport.clientHeight || VIEW_H;
    const a = anchor || { x: (viewport.scrollLeft + vw / 2) / zoom, y: (viewport.scrollTop + vh / 2) / zoom };
    zoom = next;
    world.style.width = `${Math.round(W * zoom)}px`; world.style.height = `${Math.round(H * zoom)}px`;
    stage.style.transform = `scale(${zoom})`;
    viewport.dataset.zoom = zoom.toFixed(2);
    viewport.scrollLeft = anchor ? a.x * zoom - (anchor.vx ?? vw / 2) : a.x * zoom - vw / 2;
    viewport.scrollTop = anchor ? a.y * zoom - (anchor.vy ?? vh / 2) : a.y * zoom - vh / 2;
    renderZoomBar();
  }
  /** 紋が見える所へ（開いた時・盤を切り替えた時） */
  function centerOnHub() {
    const hub = at(0, 0), vw = viewport.clientWidth || VIEW_W, vh = viewport.clientHeight || VIEW_H;
    viewport.scrollLeft = hub.x * zoom - vw / 2;
    viewport.scrollTop = hub.y * zoom - vh * 0.72;
  }
  function renderZoomBar() {
    zoomBar.replaceChildren(
      el("button.gb-icon.gb-zoom-btn", { text: "−", title: "縮小", "aria-label": "縮小", dataset: { test: "board-zoom-out" }, disabled: zoom <= ZOOM_MIN + 0.01, onclick: () => setZoom(zoom - 0.2) }),
      el("button.gb-icon.gb-zoom-btn", { text: "全体", title: "盤の全体を見る", "aria-label": "全体", dataset: { test: "board-zoom-fit" }, disabled: zoom <= ZOOM_MIN + 0.01, onclick: () => setZoom(ZOOM_MIN) }),
      el("button.gb-icon.gb-zoom-btn", { text: "＋", title: "拡大", "aria-label": "拡大", dataset: { test: "board-zoom-in" }, disabled: zoom >= ZOOM_MAX - 0.01, onclick: () => setZoom(zoom + 0.2) }),
    );
  }
  // ドラッグで動かす（マウス・ペン）。少し動いたらクリックにしない。指はブラウザのスクロールに任せ、2本指はつまんで倍率
  {
    let drag = null, pinch = null;
    viewport.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, sx: viewport.scrollLeft, sy: viewport.scrollTop, moved: false };
    });
    viewport.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      if (!drag.moved) { drag.moved = true; viewport.classList.add("dragging"); viewport.setPointerCapture?.(e.pointerId); }
      const k = 1 / (gameScale() || 1);
      viewport.scrollLeft = drag.sx - dx * k; viewport.scrollTop = drag.sy - dy * k;
    });
    const endDrag = () => { if (drag?.moved) setTimeout(() => viewport.classList.remove("dragging"), 0); drag = null; };
    viewport.addEventListener("pointerup", endDrag); viewport.addEventListener("pointercancel", endDrag);
    viewport.addEventListener("click", (e) => { if (viewport.classList.contains("dragging")) { e.stopPropagation(); e.preventDefault(); } }, true);
    viewport.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // ただのホイールはスクロールで先を見る
      e.preventDefault();
      const r = viewport.getBoundingClientRect(), k = 1 / (gameScale() || 1);
      const vx = (e.clientX - r.left) * k, vy = (e.clientY - r.top) * k;
      setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), { x: (viewport.scrollLeft + vx) / zoom, y: (viewport.scrollTop + vy) / zoom, vx, vy });
    }, { passive: false });
    viewport.addEventListener("touchstart", (e) => { if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoom }; }, { passive: true });
    viewport.addEventListener("touchmove", (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      setZoom(pinch.z * dist(e.touches) / pinch.d);
    }, { passive: false });
    viewport.addEventListener("touchend", () => { pinch = null; });
    const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  }
  // 演出用の覚え（SBD104）: 横棒の前の長さ・財布の前の数。規則や保存には関わらない
  const barSeen = new Map(), walletSeen = {};
  let barOpen = null;
  const view = () => replay(g, pending);
  const status = (node, v) => nodeStatus(node, g, v);
  // replayごとの仮置き結果に紐づける。選択だけの説明更新でも同じ道を再計算しない。
  const routesByView = new WeakMap();
  function routeTo(id, v) {
    let routes = routesByView.get(v);
    if (!routes) { routes = new Map(); routesByView.set(v, routes); }
    if (!routes.has(id)) routes.set(id, pathTo(id, v.unlocked));
    return routes.get(id);
  }

  function renderHeader() {
    const info = gaugeInfo(g);
    header.replaceChildren(
      el("h2.gb-title", { text: "心得の盤" }),
      el("div.gb-level", [
        el("b", { text: `Lv.${info.level}` }),
        el("i.gb-gauge", [el("b", { style: { width: `${Math.round(info.now * 100)}%` } })]),
        el("small", { text: info.max ? "MAX" : `あと${info.left}` }),
      ]),
      // 場所の一文は短い札にする（SBD116「文字が多い」）。全文は説明（title）と読み上げに残す
      (() => {
        const full = rebuilding ? "組み直し中（確定まで保存内容は変わらない）"
          : canRespec(original, owner) ? "組み直しは最初の自由行動または日付変更まで"
          : canLight ? `${PLACE_JA[place] || "静かな場所"}で内省している（時間は進まない）` : "見るだけ。灯すのは観音堂などで内省した時";
        const short = rebuilding ? "組み直し中" : canRespec(original, owner) ? "組み直せる" : canLight ? "灯せる" : "見るだけ";
        return el("p.gb-place", { dataset: { test: "board-place" }, title: full }, [
          el("span.gb-place-chip", { "aria-hidden": "true", text: short }), el("span.gb-sr", { text: full })]);
      })(),
      el("button.gb-icon", { text: "？", title: "見方", "aria-label": "盤の見方", dataset: { test: "board-help" }, onclick: help }),
      el("button.gb-icon", { text: "×", title: "閉じる", "aria-label": "閉じる", dataset: { test: "board-close" }, onclick: close }),
    );
  }

  function renderTabs(v) {
    tabs.replaceChildren(...BOARD_KEYS.map((k) => {
      const count = statCount(k, v.unlocked);
      const ready = canLight ? availableCount(k, g, v) : 0;
      return el(`button.gb-tab.b-${k}${k === board ? ".on" : ""}`, {
        role: "tab", "aria-selected": String(k === board), dataset: { test: `board-tab-${k}` },
        "aria-label": `${BOARD_JA[k]}盤 ${count}/${statTotal(k)}${ready ? `、今取れるマス ${ready}` : ""}`,
        onclick: () => { board = k; selected = null; SE.click?.(); render(); centerOnHub(); },
      }, [
        el("span.gb-tab-head", { text: BOARD_HEAD[k], "aria-hidden": "true" }),
        el("span.gb-tab-body", [
          el("b", { text: `${BOARD_JA[k]}盤` }), el("span.gb-tab-count", { text: ` ${count}/${statTotal(k)}` }),
          el("i.gb-tab-line", [el("b", { style: { width: `${Math.round(count / statTotal(k) * 100)}%` } })]),
        ]),
        ready ? el("em.gb-tab-ready", { text: String(ready), "aria-hidden": "true" }) : null,
        g.target && NODE_BY_ID[g.target]?.board === k ? el("em.gb-tab-target", { text: "◎", "aria-hidden": "true" }) : null,
      ]);
    }));
  }

  function renderBoard(v) {
    // 授業はいつも盤に出す。まだ分からない授業（会っていない・その章まで来ていない）は「？」の札（SBD67）
    const nodes = boardNodes(board);
    const open = ringsOpen();
    const lit = (id) => id === HUB || v.unlocked.has(id);
    const goal = g.target && NODE_BY_ID[g.target]?.board === board ? new Set(routeTo(g.target, v).path) : new Set();
    const walls = [];
    // 広い盤全体へのノイズ・ぼかしフィルターは避け、光と曇りは静的な線・グラデーションで重ねる。
    const parts = [svg("defs", {}, [
      svg("radialGradient", { id: "gb-ember", cx: "50%", cy: "62%", r: "60%" }, [
        svg("stop", { offset: "0%", "stop-color": "#fff1b8" }), svg("stop", { offset: "45%", "stop-color": "#ffb43c" }),
        svg("stop", { offset: "100%", "stop-color": "#e86a12", "stop-opacity": "0" }),
      ]),
      svg("radialGradient", { id: "gb-fog" }, [
        svg("stop", { offset: "0%", "stop-color": "#968caf", "stop-opacity": "0.08" }),
        svg("stop", { offset: "100%", "stop-color": "#968caf", "stop-opacity": "0" }),
      ]),
    ])];
    drawBoard = board;
    const fill = statRatio(board, v.unlocked);
    reveal.className = `gb-reveal r-${board}`;
    reveal.style.setProperty("--fill", fill.toFixed(3));
    reveal.dataset.test = "board-reveal";
    reveal.dataset.fill = String(Math.round(fill * 100));
    embers.dataset.level = String(fill >= 0.66 ? 3 : fill >= 0.33 ? 2 : fill > 0 ? 1 : 0);
    // 方眼のうすい点（横13×縦9）
    const [hx, hy] = hubAt();
    for (let gx = -GRID.w; gx <= GRID.w; gx++) for (let gy = -GRID.h; gy <= 0; gy++) { const p = at(gx - hx, gy - hy); parts.push(svg("circle", { cx: p.x, cy: p.y, r: 1.5, class: "gb-dot" })); }
    // まだ開いていない範囲は、ガラスが曇って沈む
    const fog = svg("g", { class: "gb-fog-layer" });
    for (const n of nodes) if (n.ring > open) { const p = at(n.gx, n.gy); fog.append(svg("circle", { cx: p.x, cy: p.y, r: 52, fill: "url(#gb-fog)" })); }
    parts.push(fog);
    // 道（使うマスどうしだけ。紋の隣は紋とつなぐ）。消えた管は暗い管と薄いハイライト、灯った管は盤の色のにじみと白い芯
    const glow = svg("g", { class: "gb-glow-layer" }), cores = [];
    const drawn = new Set();
    for (const n of nodes) {
      for (const id of n.links) {
        const key = [n.id, id].sort().join("|");
        if (drawn.has(key)) continue;
        drawn.add(key);
        const a = at(n.gx, n.gy), b = id === HUB ? at(0, 0) : at(NODE_BY_ID[id].gx, NODE_BY_ID[id].gy);
        const on = lit(n.id) && lit(id), aim = (goal.has(n.id) || lit(n.id)) && (id === HUB || goal.has(id) || lit(id)) && (goal.has(n.id) || goal.has(id));
        const closedA = n.ring > open, closedB = id !== HUB && NODE_BY_ID[id].ring > open;
        const line = (cls) => svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cls });
        if (on) {
          const provisional = pending.includes(n.id) || pending.includes(id);
          glow.append(line(`gb-tube-glow${provisional ? " pending" : ""}`)); cores.push(line(`gb-path lit${provisional ? " pending" : ""}`));
        }
        else if (closedA || closedB) parts.push(line("gb-path sealed"));
        else { parts.push(line("gb-path"), line("gb-path-hi")); if (aim) parts.push(line("gb-path aim")); }
        // 開いている所と、まだ開いていない所の境に結界（章の数は出さない。SBD42。文字の「封」はやめ、鎖の壁で「この先はまだ」を見せる。SBD74）
        if (closedA !== closedB) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, horiz = a.y === b.y;
          const wall = svg("g", { class: "gb-wall", transform: `translate(${mx} ${my})${root.classList.contains("has-art") ? "" : ` rotate(${horiz ? 90 : 0})`}`, "data-test": "board-wall" });
          // 結界は鎖を X に組んだ大きな錠（SBD79「鎖や鍵感をもっと出したい」）。道の上に置き、下に暗い丸を敷いてどの背景でも浮かせる
          wall.append(svg("circle", { cx: 0, cy: 0, r: 25, class: "gb-wall-back" }));
          if (root.classList.contains("has-art")) wall.append(svg("image", { href: `${ART_DIR}wall_seal.webp`, x: -27, y: -27, width: 54, height: 54, class: "gb-wall-art" }));
          else wall.append(svg("line", { x1: -30, y1: -6, x2: 30, y2: -6, class: "gb-seal" }), svg("line", { x1: -30, y1: 6, x2: 30, y2: 6, class: "gb-seal" }), svg("circle", { cx: 0, cy: 0, r: 7, class: "gb-seal-lock" }));
          const tip = svg("title"); tip.textContent = "この先は物語が進むと開く"; wall.prepend(tip);
          walls.push(wall);
        }
      }
    }
    parts.push(glow, ...cores, ...walls);
    const hub = at(0, 0);
    if (root.classList.contains("has-art")) {
      // 紋: 生成した輪の画像（hub_<盤>.webp）。漢字はコードで重ねる
      parts.push(svg("circle", { cx: hub.x, cy: hub.y, r: 30, class: "gb-hub gb-hub-art-base" }));
      parts.push(svg("image", { href: `${ART_DIR}hub_${board}.webp`, x: hub.x - 44, y: hub.y - 44, width: 88, height: 88, class: "gb-hub-art" }));
    } else {
      // 紋: ネオンの輪（外の太い管のにじみ＋管＋内の細い輪＋6つの短い渦）
      parts.push(svg("circle", { cx: hub.x, cy: hub.y, r: 34, class: "gb-hub-glow" }));
      parts.push(svg("circle", { cx: hub.x, cy: hub.y, r: 30, class: "gb-hub" }));
      parts.push(svg("circle", { cx: hub.x, cy: hub.y, r: 25, class: "gb-hub-inner" }));
      for (let i = 0; i < 6; i++) {
        const a0 = i * Math.PI / 3, a1 = a0 + 0.7, r = 20;
        parts.push(svg("path", { d: `M ${hub.x + r * Math.cos(a0)} ${hub.y + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${hub.x + (r - 3) * Math.cos(a1)} ${hub.y + (r - 3) * Math.sin(a1)}`, class: "gb-hub-swirl" }));
      }
    }
    parts.push(svg("circle", { cx: hub.x, cy: hub.y + 2, r: 19, fill: "url(#gb-ember)" }));
    const hubText = svg("text", { x: hub.x, y: hub.y + 8, class: "gb-hub-text" });
    hubText.textContent = BOARD_HEAD[board];
    parts.push(hubText);
    boardSvg.replaceChildren(...parts);

    nodeLayer.replaceChildren(...nodes.map((node) => {
      const p = at(node.gx, node.gy), st = status(node, v);
      const shown = revealOf(node);
      const glyph = st === "locked" && node.kind !== "stat" && node.kind !== "lesson" ? "" : node.kind === "stat" ? (node.peak ? "極" : perkOf(node)?.glyph || "") : node.kind === "gate" ? "関" : node.kind === "lesson" ? (lessonKnown(node, g) ? whoName(node.who).slice(0, 1) : "") : shown === "hidden" ? "？" : node.glyph;
      const qStep = node.feature && !g.nodes.includes(node.id);
      const sizeCls = node.kind === "skill" ? (node.cost <= 2 ? ".sz-s" : node.cost >= 7 ? ".sz-l" : ".sz-m") : "";
      const icon = iconOf(node);
      return el(`button.gb-node.${node.kind}.s-${st}${sizeCls}${node.notable ? ".notable" : ""}${fresh.has(node.id) ? ".just-opened" : ""}${node.peak ? ".peak" : ""}${node.sig ? ".sig" : ""}${selected === node.id ? ".selected" : ""}${g.target === node.id ? ".target" : ""}${goal.has(node.id) ? ".on-path" : ""}`, {
        style: { left: `${p.x}px`, top: `${p.y}px` },
        title: nodeTitle(node, shown), "aria-label": `${nodeTitle(node, shown)}（${statusWord(node, st)}）`,
        dataset: { test: `board-node-${node.id}`, status: st },
        onclick: () => select(node.id, true),
      }, [
        el("span.gb-face", { "aria-hidden": "true" }, [el("span.gb-glyph", { text: glyph }), lessonFace(node, st),
          // 漢字の代わりにアイコン（SBD73・SBD85「まだ華とか漢字のアイコンがある」）。結界の先の能力・関門・極みもアイコンを薄く出す。結界の先のスキルは中身を伏せる
          // 色の台座には、その盤の色の火（紅火・蒼火・翠火）がはまる（SBD89）。はめる前は暗いくぼみ、はめると光る
          node.kind === "gate" ? el("img.gb-gate-gem", { src: `${ART_DIR}hidane_${node.board}.webp`, alt: "", draggable: "false", loading: "lazy" }) : null,
          icon && node.kind !== "gate" && (st !== "locked" || node.kind !== "skill") ? el("img.gb-icon-img", { src: `${ART_DIR}icons/${icon}.webp`, alt: "", draggable: "false", loading: "lazy" }) : null,
        ]),
        ["unlocked", "pending"].includes(st) ? el("span.gb-node-state", { text: st === "unlocked" ? "✓" : "+", "aria-hidden": "true" }) : null,
        // ? と火種の数は、札の下の辺の真ん中に重ねる（SBD86「？丸マークも位置がちぐはぐ」。押せる箱の角に付けていたので札から離れて見えた）。
        // 札の暗さ（filter）を受けないよう札の外に置き、札の高さ（--fh）から位置を決める
        node.kind === "lesson" && !lessonKnown(node, g) ? el("span.gb-mystery", { text: "?", "aria-hidden": "true" }) : null,
        (node.kind === "skill" || node.kind === "stat" && node.cost > 1) && ["available", "short", "far"].includes(st) ? el("span.gb-cost", { "aria-hidden": "true", text: String(node.cost) }) : null,
        qStep ? el("em.gb-quality", { text: "✦", "aria-hidden": "true" }) : null,
      ]);
    }));
  }

  /**
   * 授業はその人の顔アイコン（2026-10-30 オーナー「授業はキャラの顔アイコンに」SBD64）。顔の無い人・読み込めない時は名前の1文字。
   * 会っていない人の授業は盤に出ないので、出ている授業はどれも顔を見せてよい。
   */
  function lessonFace(node, st) {
    if (node.kind !== "lesson") return null;
    const known = lessonKnown(node, g);
    // まだ分からない授業はその人の影絵（2026-10-31 オーナー「まだ先のキャラもシルエットだけ出したい」SBD75）。
    // 正体を伏せる授業（revealFlag）と顔の無い人は、誰でもない影絵（画像がある時だけ）
    // 札の顔は立ち絵から目の高さと顔の大きさをそろえて切り出したもの（SBD81。faces/<人>.webp）。無い人は顔アイコン
    const face = boardFaceUrl(node.who) || faceIconUrl(node.who, state);
    const secret = !known && (node.revealFlag || !face);
    const url = secret ? (root.classList.contains("has-art") ? `${ART_DIR}silhouette_unknown.webp` : null) : face;
    if (!url) return null;
    const img = el(`img.gb-face-icon${known ? "" : ".silhouette"}`, { src: url, alt: "", draggable: "false", loading: "lazy" });
    img.addEventListener("error", () => img.remove());
    return img;
  }

  /**
   * 右のパネルの絵（2026-10-31 オーナー「授業の説明とかの画像を入れる欄に、それぞれスキル名や内容に合ったキャラの画像を」SBD82）。
   * 授業は教えてくれる人の立ち絵、スキルははじめの立ち絵を、中身に合う表情で胸から上だけ見せる。
   * まだ分からない授業は立ち絵の影絵（正体を伏せる授業は誰でもない影絵）、まだ現れていないスキルは今までどおり「？」
   */
  function panelPortrait(node, shown) {
    if (node.kind === "lesson") {
      if (!lessonKnown(node, g)) {
        if (node.revealFlag) return root.classList.contains("has-art") ? el("img.gb-portrait.silhouette.unknown", { src: `${ART_DIR}silhouette_unknown.webp`, alt: "" }) : null;
        const p = portraitInfo(node.who, "normal");
        return p ? placed(el("img.gb-portrait.silhouette", { src: p.src, alt: "", dataset: { who: node.who } }), node.who, p.style) : null;
      }
      const p = portraitInfo(node.who, PANEL_FACE[node.id] || "smile");
      return p ? placed(el("img.gb-portrait", { src: p.src, alt: "", dataset: { who: node.who, face: p.face, test: "board-portrait" } }), node.who, p.style) : null;
    }
    if (node.kind === "skill" && shown !== "hidden") {
      const p = portraitInfo("hajime", PANEL_FACE[node.id] || "normal");
      return p ? placed(el("img.gb-portrait", { src: p.src, alt: "", dataset: { who: "hajime", face: p.face, test: "board-portrait" } }), "hajime", p.style) : null;
    }
    return null;
  }
  /** 出した立ち絵と同じ画風で測った目の高さ・顔の大きさで置く。測っていない人は胸から上を真ん中に。 */
  function placed(img, who, style = "classic") {
    const [ex, ey, fw] = portraitEyes(who, style) || [448, 260, 100];
    const k = PANEL_FACE_W / fw;
    Object.assign(img.style, { width: `${Math.round(896 * k)}px`, marginLeft: `${Math.round(-ex * k)}px`, top: `${Math.round(PANEL_EYE_Y - ey * k)}px` });
    return img;
  }

  /** 章ごとの見せ方（2.5）: open=全部 / next=名前と効果（絵は影絵）/ hidden=？？？ */
  function revealOf(node) {
    if (node.kind !== "skill") return "open";
    const open = ringsOpen();
    return node.ring <= open ? "open" : node.ring === open + 1 ? "next" : "hidden";
  }
  function nodeTitle(node, shown = revealOf(node)) {
    if (node.kind === "stat") return node.peak ? `${BOARD_JA[node.board]}のマス（極み）` : node.notable ? `要のマス「${perkOf(node)?.notable?.name}」・${perkOf(node)?.name || ""}` : `${BOARD_JA[node.board]}のマス・${perkOf(node)?.name || ""}`;
    if (node.kind === "gate") return `${BOARD_JA[node.board]}の色の台座「${perkOf(node)?.name || ""}」`;
    if (node.kind === "lesson") return lessonKnown(node, g) ? `${whoName(node.who)}の授業「${node.name}」` : "？？？の授業";
    return shown === "hidden" ? "？？？（物語が進むと盤に現れる）" : `スキル「${node.name}」`;
  }
  function whoName(who) { return who === "sumi" ? "スミさん" : displayName(who, state); }

  function statusWord(node, st) {
    return {
      unlocked: "灯してある", pending: "仮置き中", locked: "まだ開いていない", sealed: "授業の錠",
      far: "まだ道がつながっていない", short: "火種が足りない", available: canLight ? "今灯せる" : "灯せる（内省の時に）",
    }[st];
  }

  const colorReservedFor = (node, v) => node.kind !== "gate" &&
    spendableHidane(node, v.hidane, { ...v.ctx, reserve: 0 }) > spendableHidane(node, v.hidane, v.ctx);

  function targetText(id, v) {
    const target = NODE_BY_ID[id];
    if (v.pending.includes(id)) return `目標：${nodeTitle(target)} 仮置き中`;
    const route = routeTo(id, v);
    const gates = route.path.filter((step) => NODE_BY_ID[step].kind === "gate").length;
    const colors = BOARD_KEYS.reduce((sum, key) => sum + (v.hidane[key] || 0), 0);
    const missingColors = Math.max(0, gates - colors);
    const gateText = gates ? `・色の台座${gates}${v.ctx.capped ? "（白火も可）" : missingColors ? `（色火あと${missingColors}）` : ""}` : "";
    const first = route.path[0] && NODE_BY_ID[route.path[0]];
    const next = first && status(first, v);
    const reason = next === "locked" ? "・次は結界の先"
      : next === "sealed" ? "・次は授業の錠"
      : next === "short" && first.kind === "gate" ? `・次は${v.ctx.capped ? "色火か白火" : "色火"}が足りない`
      : next === "short" ? colorReservedFor(first, v) ? "・色火は台座用に確保中" : "・次は火種が足りない"
      : next === "far" ? "・次は道がまだ" : "";
    return `目標：${nodeTitle(target)}まで 火種${route.cost}${gateText}${reason}`;
  }

  function renderSide(v) {
    const node = selected ? NODE_BY_ID[selected] : null;
    if (!node || node.board !== board) { side.replaceChildren(...boardSummary(v)); return; }
    const st = status(node, v), shown = revealOf(node);
    const lines = [];
    const portrait = panelPortrait(node, shown);
    const skillArt = node.kind === "skill" && shown !== "hidden" && SKILL_ART[node.id]
      ? el("img.gb-skill-art", { src: `${ART_DIR}skill_art/${SKILL_ART[node.id]}.webp`, alt: "", dataset: { test: "board-skill-art" } }) : null;
    if (portrait) portrait.addEventListener("error", () => { portrait.remove(); art.classList.remove("has-portrait"); });
    if (skillArt) skillArt.addEventListener("error", () => {
      if (portrait) skillArt.replaceWith(portrait);
      else skillArt.remove();
      art.classList.remove("has-skill-art");
      if (portrait) art.classList.add("has-portrait");
    });
    // 立ち絵の無い能力・関門・極みは、右のパネルにも漢字でなくアイコンを大きく（SBD85）
    const artIcon = !portrait && root.classList.contains("has-art") && iconOf(node) && (node.kind !== "skill" || shown !== "hidden")
      ? el("img.gb-art-icon", { src: node.kind === "gate" ? `${ART_DIR}hidane_${node.board}.webp` : `${ART_DIR}icons/${iconOf(node)}.webp`, alt: "" }) : null;
    const art = el(`div.gb-art.k-${node.kind}${shown !== "open" || st === "sealed" ? ".shadow" : ""}${skillArt ? ".has-skill-art" : portrait ? ".has-portrait" : ""}${artIcon ? ".has-icon" : ""}`, { "aria-hidden": "true" }, [
      artIcon,
      el("span", { text: node.kind === "stat" ? BOARD_HEAD[node.board] : node.kind === "gate" ? "関" : node.kind === "lesson" ? (lessonKnown(node, g) ? "授" : "？") : shown === "hidden" ? "？" : node.glyph }),
      skillArt || portrait || (node.kind === "lesson" ? lessonFace(node, st) : null),
      portrait && node.kind === "lesson" && !lessonKnown(node, g) ? el("b.gb-art-mystery", { text: "?" }) : null,
    ]);
    lines.push(art, el("h3.gb-p-title", { text: nodeTitle(node, shown) }));
    if (node.kind === "stat") {
      const perk = perkOf(node);
      if (perk.notable) lines.push(el("p.gb-p-quality", { dataset: { test: "board-notable" }, text: `要のマス「${perk.notable.name}」：${perk.notable.text}` }));
      lines.push(el("p", { dataset: { test: "board-perk" }, text: `このマスで：${perk.text}（${perk.tierName}${perk.notable ? "・要" : ""}）` }));
      // 灯す前後の合計（REPORT P1「初めて振った効果が体感できない」）: この盤で同じ恩恵がいま幾つで、灯すと幾つになるか
      if (!node.peak && node.perk && !g.nodes.includes(node.id)) {
        // 仮置き中のマスは、そのマスを除いた合計を「いま」にする（仮置き → 決定で幾つになるかが見える）
        const base = new Set([...v.unlocked].filter((id) => id !== node.id));
        const now = perkTotals(node.board, base).find((p) => p.key === node.perk);
        const next = perkTotals(node.board, new Set([...base, node.id])).find((p) => p.key === node.perk);
        if (now && next) lines.push(el("p.gb-p-total", { dataset: { test: "board-perk-total" }, text: `${now.name}の合計：${fmtPerk(now.text, now.sum)} → ${fmtPerk(next.text, next.sum)}${st === "pending" ? "（仮置き中）" : ""}` }));
      }
      if (node.feature) lines.push(el("p.gb-p-quality", { dataset: { test: "board-feature" }, text: `✦ 灯すと「${FEATURES[node.feature].text}」` }));
      if (node.peak) lines.push(el("p.gb-p-next", { text: statsFilled(node.board, v.unlocked) ? "盤の能力のマスを全部灯した。極みを灯せる" : "この盤の能力のマスを全部灯すと灯せる（盤を埋めたご褒美）" }));
    } else if (node.kind === "gate") {
      // 色の台座（SBD89）: 色の火をはめると先へ進めて、台座の能力も手に入る
      const perk = perkOf(node);
      lines.push(el("p", { text: `${HIDANE_NAME[node.board]}をはめる台座（台座の光の色）。はめると先へ進めて、この台座の能力が手に入る。先には強いスキルや授業がある` }));
      if (perk) lines.push(el("p.gb-p-quality", { dataset: { test: "board-gate-perk" }, text: `はめると：${perk.text}（色の台座）` }));
      lines.push(el("p.gb-p-sub", { text: `${HIDANE_NAME[node.board]}を先に使う。無ければほかの色の火でもはまる。火種の獲得が上限に届いた後は白火でもはまる` }));
    } else if (node.kind === "skill") {
      if (shown === "hidden") lines.push(el("p", { text: "物語が進むと盤に現れる" }));
      else lines.push(el("p", { text: node.text }), el("p.gb-p-sub", { text: `効く場面：${node.scene}・火種${node.cost}${shown === "next" ? "・まだ開いていない" : ""}` }));
    } else {
      const lock = lessonLock(node, v.unlocked);
      const met = lessonKnown(node, g);
      if (!met) lines.push(el("p", { dataset: { test: "board-lesson-mystery" }, text: "まだ出会っていない誰かが、ここで何かを教えてくれるらしい" }));
      else {
        lines.push(el("p.gb-p-reward", { text: `${REWARD_JA[node.reward]}：${node.text}${node.id === "M-W8" ? `（総合 +${LESSON_TUNING.grapeReception}）` : ""}` }));
        if (st === "sealed") lines.push(el("p.gb-p-sub", { text: node.hint }));
      }
      if (lock && met) {
        const conds = [];
        if (node.need) conds.push(met ? `${whoName(node.who)} ♥${Math.min(5, affinityLevel(node.who))}/${node.need}` : `？？？ ♥?/${node.need}`);
        lines.push(el("p.gb-p-lock", { dataset: { test: "board-lesson-lock" }, text: `錠：${conds.join("・")}` }));
      } else if (met && st !== "unlocked") lines.push(el("p.gb-p-sub", { text: "火種いらず。道が届けば灯せる" }));
    }
    if (g.target === node.id && st !== "unlocked") lines.push(el("p.gb-p-target", { dataset: { test: "board-target-line" }, text: targetText(node.id, v) }));
    lines.push(el(`p.gb-p-state.s-${st}`, { text: stateText(node, st, v) }));
    const actions = [];
    if (canLight && st === "available") actions.push(el("button.btn.primary.gb-light", { text: node.kind === "gate" ? `はめる（${payText(paymentFor(node, v.hidane, v.ctx))}）` : node.cost ? `灯す（火種${node.cost}）` : "教わる", dataset: { test: "board-light" }, onclick: () => light(node.id) }));
    if (st === "pending") actions.push(el("button.btn.gb-undo", { text: "やめる", dataset: { test: "board-undo" }, onclick: () => unlight(node.id) }));
    if (!g.nodes.includes(node.id) && st !== "pending") {
      actions.push(el("button.btn.gb-aim", { text: g.target === node.id ? "目標をやめる" : "目標にする", dataset: { test: "board-target" }, onclick: () => toggleTarget(node.id) }));
      if (canLight && g.target === node.id && st !== "available") actions.push(el("button.btn.gb-aim", { text: "目標まで灯す", dataset: { test: "board-towards" }, onclick: () => towards(node.id) }));
    }
    side.replaceChildren(...lines, el("div.gb-side-actions", actions));
  }

  /** 何も選んでいない時（SBD63「段の概念は無くす。盤の伸びをグラフに」）: 恩恵ごとの合計の横棒と、✦のできること */
  function boardSummary(v) {
    const count = statCount(board, v.unlocked);
    const totals = perkTotals(board, v.unlocked);
    const bars = totals.map((p) => {
      // 横棒は前に見た長さから伸びる（仮置き・決定で増えた分が目で分かる。SBD104）
      const width = p.max ? Math.round((p.sum / p.max) * 100) : 0, key = `${board}:${p.key}`, was = barSeen.get(key);
      const fill = el("b", { style: { width: `${was ?? width}%` } });
      if (was != null && was !== width) requestAnimationFrame(() => { fill.style.width = `${width}%`; });
      barSeen.set(key, width);
      // 名前と長い文は出さず、アイコン・棒・数字だけ（SBD116）。文は押さえた時の説明（title）と読み上げに残す
      const icon = el("img.gb-bar-icon", { src: `${ART_DIR}icons/perk_${p.key}.webp`, alt: "", draggable: "false", loading: "lazy" });
      icon.addEventListener("error", () => icon.replaceWith(el("span.gb-bar-glyph", { text: p.glyph })));
      // 押すと、その能力の名前と今の合計が一行で出る（もう一度押すと閉じる）。アイコンの意味は「？」の「能力」のページにもある
      return el(`button.gb-bar${was != null && was < width ? ".grew" : ""}${barOpen === key ? ".open" : ""}`, { type: "button", title: `${p.name}：${p.text}`, "aria-expanded": String(barOpen === key),
        dataset: { test: `board-bar-${p.key}` }, onclick: () => { barOpen = barOpen === key ? null : key; SE.click?.(); renderSide(view()); } }, [
        el("span.gb-bar-name", [icon, el("span.gb-sr", { text: `${p.name}：${p.text}` })]),
        el("i.gb-bar-line", { "aria-hidden": "true" }, [fill]),
        el(`span.gb-bar-sum${p.sum ? "" : ".zero"}`, { "aria-hidden": "true", text: shortSum(p) }),
      ]);
    });
    const opened = totals.find((p) => `${board}:${p.key}` === barOpen);
    const feats = featuresOf(board, v.unlocked);
    const goals = nearGoals(v);
    const out = [
      el("h3.gb-p-title", { text: `${BOARD_JA[board]}盤 ${count}/${statTotal(board)}` }),
      el("div.gb-bars", { dataset: { test: "board-bars" } }, bars),
      opened ? el("p.gb-bar-note", { dataset: { test: "board-bar-note" }, "aria-live": "polite" }, [el("b", { text: opened.name }), el("span", { text: opened.text.replace(/（端数[^）]*）/, "") })]) : null,
      feats.length ? el("p.gb-feats", { title: feats.map((f) => `${f.on ? "✦" : "・"}${f.name}`).join("　") },
        feats.map((f) => el(`span.gb-feat${f.on ? ".on" : ""}`, { text: `✦ ${f.name}` }))) : null,
      // 次の目的地（SBD104）: 近い順に3つ。押すとそのマスへ動いて中身が出る（どこへ伸ばすかの手がかり）
      goals.length ? el("div.gb-goals", { dataset: { test: "board-goals" } }, [
        el("h4.gb-goals-head", { text: "近い目的地" }),
        ...goals.map(({ n, st, cost, gates }) => el(`button.gb-goal.k-${n.kind}${st === "available" ? ".ready" : ""}`, {
          type: "button", dataset: { test: `board-goal-${n.id}` }, onclick: () => { select(n.id, true); scrollToNode(n.id); },
          title: `${goalName(n)}　${goalCost(n, st, cost, gates)}`,
        }, [
          goalIcon(n),
          el("span.gb-goal-name", { text: n.kind === "gate" ? perkOf(n)?.name || "" : n.feature ? FEATURES[n.feature].name : n.notable ? NOTABLES[n.notable]?.name || "" : n.name }),
          goalFires(n, st, cost, gates),
          el("span.gb-sr", { text: goalCost(n, st, cost, gates) }),
        ])),
      ]) : null,
    ];
    if (g.target) {
      out.push(el("p.gb-p-target", { dataset: { test: "board-target-line" }, text: targetText(g.target, v) }));
    }
    // 操作の案内（光っているマス・マスを押す・目標にする）は右上の「？」（盤の見方）へ寄せた（2026-11-08 オーナー指示「説明の分量を減らす」）
    return out.filter(Boolean);
  }

  /**
   * 近い目的地（SBD104）: まだ灯していないスキル・授業・✦・要のマス・色の台座を、紋からの火種が少ない順に。
   * 結界の先と、まだ分からない授業・現れていないスキルは出さない（伏せている中身を一覧で明かさない）。
   */
  function nearGoals(v, limit = 3) {
    const route = boardRoutes(board, v.unlocked), goals = [];
    for (const n of boardNodes(board)) {
      if (v.unlocked.has(n.id) || n.peak || !(n.kind === "skill" || n.kind === "lesson" || n.kind === "gate" || n.feature || n.notable)) continue;
      const st = status(n, v);
      if (st === "locked" || (n.kind === "lesson" && !lessonKnown(n, g)) || (n.kind === "skill" && revealOf(n) !== "open")) continue;
      const r = route(n.id);
      goals.push({ n, st, cost: r.cost, gates: r.path.filter((id) => NODE_BY_ID[id].kind === "gate").length });
    }
    return goals.sort((a, b) => a.cost - b.cost || a.n.ring - b.n.ring).slice(0, limit);
  }
  const goalName = (n) => n.kind === "skill" ? `スキル「${n.name}」` : n.kind === "lesson" ? `${whoName(n.who)}の授業「${n.name}」`
    : n.kind === "gate" ? `色の台座（${perkOf(n)?.name || ""}）` : n.feature ? `✦ ${FEATURES[n.feature].name}` : `要のマス「${NOTABLES[n.notable]?.name || ""}」`;
  /** 横棒の右の短い数字（「＋12」「＋6%」「−2%」）。文は title に残す */
  const shortSum = (p) => /[＋−][\d.]+%?/.exec(p.text)?.[0] || "";
  /** 近い目的地の絵: スキルのアイコン・授業の顔・台座の色の火・能力のアイコン */
  function goalIcon(n) {
    const src = n.kind === "lesson" ? boardFaceUrl(n.who) || faceIconUrl(n.who, state)
      : n.kind === "gate" ? `${ART_DIR}hidane_${n.board}.webp` : iconOf(n) ? `${ART_DIR}icons/${iconOf(n)}.webp` : null;
    const box = el(`span.gb-goal-icon.k-${n.kind}`, { "aria-hidden": "true" }, [el("b", { text: n.kind === "lesson" ? "授" : n.kind === "gate" ? "◆" : n.feature ? "✦" : n.glyph || "要" })]);
    if (src) { const img = el("img", { src, alt: "", draggable: "false", loading: "lazy" }); img.addEventListener("error", () => img.remove()); box.append(img); }
    return box;
  }
  /** 近い目的地までの火種を、粒の絵と数で（白火＝道のり、色の火＝台座の数）。錠は♥ */
  function goalFires(n, st, cost, gates) {
    const dot = (kind, count) => el(`span.gb-goal-fire.k-${kind}`, [el("i"), el("b", { text: String(count) })]);
    const parts = [];
    if (cost - gates > 0) parts.push(dot("any", cost - gates));
    if (gates > 0) parts.push(dot(n.board, gates));
    if (st === "sealed") parts.push(el("span.gb-goal-lock", { text: `♥${n.need || ""}` }));
    if (!parts.length) parts.push(el("span.gb-goal-now", { text: "今" }));
    return el("span.gb-goal-cost", { "aria-hidden": "true" }, parts);
  }
  function goalCost(n, st, cost, gates) {
    const lock = st === "sealed" ? `・♥${n.need || ""}で開く` : "";
    if (!cost) return n.kind === "lesson" ? `火種いらず${lock || "・今教われる"}` : "今灯せる";
    return `あと火種${cost}${gates ? `（うち色の火${gates}）` : ""}${lock}`;
  }
  /** そのマスが真ん中に来るよう、盤を動かす */
  function scrollToNode(id) {
    const n = NODE_BY_ID[id];
    if (!n || n.board !== board) return;
    const p = at(n.gx, n.gy), vw = viewport.clientWidth || VIEW_W, vh = viewport.clientHeight || VIEW_H;
    const left = p.x * zoom - vw / 2, top = p.y * zoom - vh / 2;
    if (typeof viewport.scrollTo === "function") viewport.scrollTo({ left, top, behavior: reducedMotion() ? "auto" : "smooth" });
    else { viewport.scrollLeft = left; viewport.scrollTop = top; }
  }

  function stateText(node, st, v) {
    if (st === "unlocked") {
      if (node.kind !== "lesson") return "灯してある";
      const who = node.who === "sumi" ? "スミさん" : displayName(node.who, state);
      if (lessonLearned(node.id)) return "習得済み";
      if (!readyLessons(node.who).some((l) => l.id === node.id)) return `灯してある。今の周で${who}と♥${node.need}まで仲良くなると相談できる`;
      return `相談できる。次に${who}に会った時に話を聞こう`;
    }
    if (st === "pending") return "仮置き中。決定するまでは「やめる」で戻せる";
    if (st === "locked") return "結界の先。物語が進むと結界が解けて道が開く";
    if (st === "sealed") return "錠が開くと、道が届けば灯せる";
    if (st === "far" && node.peak) {
      const left = boardNodes(node.board).filter((n) => n.kind === "stat" && !n.peak && !v.unlocked.has(n.id)).length;
      return `能力のマスを全部灯すと灯せる（あと${left}マス）`;
    }
    if (st === "far") {
      const route = routeTo(node.id, v);
      return `まだ道がつながっていない（ここまで 火種${route.cost}）`;
    }
    if (st === "short" && node.kind === "gate") return v.ctx.capped ? "色の火か白火が要る。台座に使える火種がない" : "色の火（紅火・蒼火・翠火）が要る。節目のレベル・大会・♥5の人・遊びのご褒美でもらえる";
    if (st === "short") {
      const have = HIDANE_KEYS.reduce((sum, key) => sum + (v.hidane[key] || 0), 0);
      const usable = spendableHidane(node, v.hidane, v.ctx);
      return `火種があと${Math.max(0, node.cost - usable)}つ要る${have ? `（所持${have}／このマスに使える${usable}）` : ""}。${colorReservedFor(node, v) ? "色火は台座用に確保中" : "火種は貯めておける"}`;
    }
    if (!canLight) return `灯せる（${payText(paymentFor(node, v.hidane, v.ctx))}）。観音堂などで内省すると灯せる`;
    return `${payText(paymentFor(node, v.hidane, v.ctx))}で払う`;
  }

  function renderFooter(v) {
    const wallet = el("div.gb-wallet", { dataset: { test: "board-wallet" } }, HIDANE_KEYS.map((k) => el(`span.gb-hidane.k-${k}${v.hidane[k] ? "" : ".zero"}`, {
      title: k === "any" ? `白火（どの盤の通常マスにも${v.ctx.capped ? "。色の台座にも" : ""}）`
        : `${HIDANE_NAME[k]}（${v.ctx.capped ? "どの盤" : `${BOARD_JA[k]}盤`}のマスと、色の台座）`,
    }, [el("i", { "aria-hidden": "true" }), el("span.gb-sr", { text: HIDANE_NAME[k] }), el("b", { text: String(v.hidane[k] || 0) })])));
    // 数が変わった火種は一度弾む（払った・戻った が目で分かる）
    for (const [i, k] of HIDANE_KEYS.entries()) {
      const now = v.hidane[k] || 0;
      if (walletSeen[k] != null && walletSeen[k] !== now) bump(wallet.children[i]?.querySelector("b"));
      walletSeen[k] = now;
    }
    const actions = [];
    if (rebuilding) actions.push(el("button.btn", { text: "前の形に戻す", dataset: { test: "board-respec-restore" }, onclick: restoreRespec }));
    else if (canRespec(original, owner)) actions.push(el("button.btn", { text: "組み直す", dataset: { test: "board-respec" }, onclick: startRespec }));
    if (canLight && pending.length) actions.push(el("button.btn.gb-reset", { text: "取り消す", dataset: { test: "board-reset" }, onclick: () => { pending = []; SE.cancel?.(); render(); } }));
    actions.push(el("button.btn.primary.gb-decide", {
      text: rebuilding ? "組み直しを決定" : pending.length ? `決定（${pending.length}）` : "閉じる", dataset: { test: "board-decide" }, onclick: () => (pending.length || rebuilding ? finish(true) : close()),
    }));
    // 凡例（マスの状態・種類）は「？」の絵つきの見方へ移した（SBD116）
    footer.replaceChildren(wallet, el("span.gb-footer-gap"), el("div.gb-actions", actions));
  }

  function render() {
    const v = view();
    pending = v.pending;
    renderedView = v;
    renderHeader(); renderTabs(v); renderBoard(v); renderSide(v); renderFooter(v);
  }
  function startRespec() {
    if (owner !== state || finishing) return;
    const transaction = prepareRespec(original, owner);
    if (!transaction) {
      void modal({ title: "組み直し", body: "戻せる支払記録がありません。今の盤はそのまま残します。", options: [{ label: "戻る", value: null, primary: true }] });
      return;
    }
    rebuilding = transaction; g = transaction.growth; canLight = true; pending = []; selected = null;
    root.classList.add("can-light"); root.classList.remove("view-only"); root.dataset.mode = "respec";
    render();
  }
  function restoreRespec() {
    g = original; rebuilding = null; canLight = !!place; pending = []; selected = null;
    root.classList.toggle("can-light", canLight); root.classList.toggle("view-only", !canLight);
    root.dataset.mode = canLight ? "light" : "view";
    render();
  }
  function select(id, sound) {
    nodeLayer.querySelector(`[data-test="board-node-${selected}"]`)?.classList.remove("selected");
    selected = id;
    if (sound) SE.click?.();
    const node = nodeLayer.querySelector(`[data-test="board-node-${id}"]`);
    node?.classList.add("selected");
    // 選択だけでは盤・火種は変わらない。札と道を作り直さず、右の説明だけを更新する。
    renderSide(renderedView);
    node?.focus({ preventScroll: true });
  }
  function light(id) {
    if (!canLight) return;
    const nextPending = replay(g, [...pending, id]).pending;
    if (pending.includes(id) || !nextPending.includes(id)) return;
    const was = renderedView?.unlocked || new Set(g.nodes), added = nextPending.filter((p) => !pending.includes(p));
    pending = nextPending;
    SE.boardLight?.();
    // 仮置きで隣へ自動で進む（6.2 スマホ横の基本操作）: 今取れる隣が1つだけならそれを選ぶ
    const v = view();
    const nexts = NODE_BY_ID[id].links.filter((n) => n !== HUB && status(NODE_BY_ID[n], v) === "available");
    render();
    nodeLayer.querySelector(`[data-test="board-node-${id}"]`)?.classList.add("lit-now");
    lightFx(added, v, was);
    if (nexts.length === 1) select(nexts[0], false);
  }
  function inViewport(node) {
    if (!node) return false;
    const r = node.getBoundingClientRect(), w = viewport.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return x >= w.left && x <= w.left + w.width && y >= w.top && y <= w.top + w.height;
  }
  /**
   * 仮置きの演出（SBD104）: 財布の火種がマスへ飛び、灯っていた隣から道を光が走って、マスに火が入る。
   * 飾りだけ。仮置きそのものは先に済んでいて、動きを減らす設定では何も出さない。
   */
  function lightFx(ids, v, was) {
    if (reducedMotion() || !ids.length) return;
    const have = new Set(was);
    ids.forEach((id, i) => {
      const node = NODE_BY_ID[id], source = node.links.find((l) => l === HUB || have.has(l));
      have.add(id);
      if (node.board !== board) return;
      const pay = v.pays[id] || {}, kind = HIDANE_KEYS.find((k) => pay[k] > 0) || "any";
      const color = node.kind === "gate" ? HIDANE_COLOR[node.board] : node.kind === "lesson" ? "#f4d27a" : HIDANE_COLOR[kind];
      const p = at(node.gx, node.gy), from = source === HUB ? at(0, 0) : source ? at(NODE_BY_ID[source].gx, NODE_BY_ID[source].gy) : null;
      const to = nodeLayer.querySelector(`[data-test="board-node-${id}"]`);
      // 火種が飛ぶのは、マスがのぞき窓の中に見えている時だけ（見えない先へは飛ばさず、盤の中の光だけ）
      const coin = node.cost && inViewport(to) ? footer.querySelector(`.gb-hidane.k-${kind} i`) : null;
      const delay = Math.min(i, 8) * 80;
      (coin ? flyHidane(root, coin, to, { kind, delay }) : new Promise((r) => setTimeout(r, delay))).then(() => {
        if (!root.isConnected || finishing) return;
        if (from) runAlongPath(boardSvg, from, p, { color });
        igniteAt(fxLayer, p.x, p.y, { color, big: node.kind !== "stat" || !!node.notable || !!node.feature });
      });
    });
  }
  function unlight(id) {
    pending = pending.filter((p) => p !== id); // つながらなくなった先の仮置きは replay で外れる
    SE.cancel?.();
    render();
  }
  function toggleTarget(id) {
    g.target = g.target === id ? null : id;
    SE.select?.();
    emit("hud");
    render();
  }
  function towards(id) {
    const before = pending.length, was = renderedView?.unlocked || new Set(g.nodes), old = pending;
    pending = pendingTowards(g, pending, id);
    if (pending.length > before) SE.boardLight?.();
    render();
    lightFx(pending.filter((p) => !old.includes(p)), renderedView, was);
  }
  /** 「？」: 絵つきの見方（growth-board-help.js。SBD116）。選んでいるマスに合うページから開く */
  async function help() {
    const node = selected ? NODE_BY_ID[selected] : null;
    await openBoardHelp({ page: node ? (node.kind === "gate" ? "fire" : "kinds") : "flow" });
  }
  async function close() {
    if (pending.length || rebuilding) {
      const confirmation = modal({
        title: "決定しますか？", body: rebuilding ? `組み直しと仮置き${pending.length}つを決定します。やめて閉じると元の盤が残ります。` : `仮置き ${pending.length}つ`,
        options: [{ label: "決定して閉じる", value: "yes", primary: true, test: "board-confirm-yes" }, { label: "仮置きをやめて閉じる", value: "no", test: "board-confirm-no" }, { label: "戻る", value: null }],
      });
      dismissConfirm = layers.modal.querySelector('[data-test="board-confirm-no"]');
      const choice = await confirmation;
      dismissConfirm = null;
      if (!choice) return;
      return finish(choice === "yes");
    }
    return finish(false);
  }
  async function finish(commit) {
    if (finishing) return;
    finishing = true;
    stopTutorial();
    offOwner();
    if (owner !== state || !growthEnabled()) {
      commit = false;
      if (dismissConfirm?.isConnected) dismissConfirm.click();
    }
    const reset = commit && rebuilding ? commitRespec(original, rebuilding, owner) : false;
    if (rebuilding && !reset) commit = false;
    const before = new Set(original.nodes);
    const committed = commit ? commitPending(pending, owner) : [];
    if (owner === state && (reset || committed.length)) save();
    if (owner === state && committed.length) SE.boardCommit?.();
    // 決定の演出（SBD104）: 保存を済ませてから、灯したマスに順に火が入り、スキルなどはカットインで名前を出す
    if (owner === state && committed.length && growthEnabled()) await commitFx(committed);
    // 授業の会話が次の曲を選ぶ前に戻す。LOAD中は以前のセーブの曲を復活させない。
    releaseAudio(owner === state && growthEnabled());
    document.removeEventListener("keydown", onKey, true);
    root.classList.remove("show");
    await sleep(200);
    root.remove();
    current = null;
    if (owner === state && committed.length) {
      emit("hud");
      // 知らせの印は盤と同じ絵（SBD125②）。絵が読めない時は今までの字（火・関・極）のまま
      const iconUrl = (node) => iconOf(node) ? `${ART_DIR}icons/${iconOf(node)}.webp` : null;
      const squares = committed.filter((n) => n.kind === "stat");
      const perks = [...new Set(squares.filter((n) => !n.peak && n.perk).map((n) => n.perk))];
      if (squares.length) gainCard({ kind: "info", badge: "火", icon: perks.length === 1 ? `${ART_DIR}icons/perk_${perks[0]}.webp` : `${ART_DIR}hidane_any.webp`,
        top: "LIGHT", main: `能力の火を${squares.length}つ灯した`, sub: perkDeltaText(committed, before) });
      const gates = committed.filter((n) => n.kind === "gate");
      if (gates.length) gainCard({ kind: "info", badge: "関", icon: `${ART_DIR}hidane_${gates[0].board}.webp`, top: "BREAK", main: `色の台座に${gates.length}つはめた`, sub: "この先の道が開き、台座の能力が手に入った" });
      for (const node of committed) if (node.feature) gainCard({ kind: "info", badge: "✦", icon: iconUrl(node), top: "NEW", main: FEATURES[node.feature].name, sub: FEATURES[node.feature].text });
      for (const node of committed) if (node.peak) gainCard({ kind: "info", badge: "極", icon: `${ART_DIR}icons/peak.webp`, top: "COMPLETE", main: `${BOARD_JA[node.board]}を極めた`, sub: "盤の能力のマスを全部灯した" });
      for (const node of committed) if (node.kind === "skill") gainCard({ kind: "info", badge: node.glyph, icon: iconUrl(node), top: "SKILL", main: node.name, sub: node.text });
      // 授業: 今のゲームの場面がある授業はその場面を見せる（読み終えたら習得。場面が無い授業はカードで）
      for (const node of committed) if (node.kind === "lesson") await presentLesson(node);
    }
    resolveDone(committed);
  }
  /**
   * 決定の演出（SBD104）。確定と保存の後に流す飾りで、途中でセーブが入れ替わっても盤の中身は変わらない。
   * 動きを減らす設定では何もしない（待たない）。カットインは押すと次へ進む。
   */
  async function commitFx(committed) {
    if (reducedMotion() || !root.isConnected) return;
    root.classList.add("committing");
    // 決定した姿（✓）に描き直す。いちばん多く灯した盤を見せる
    const counts = {};
    for (const n of committed) counts[n.board] = (counts[n.board] || 0) + 1;
    g = original; rebuilding = null; pending = []; selected = null;
    board = BOARD_KEYS.reduce((best, k) => (counts[k] || 0) > (counts[best] || 0) ? k : best, counts[board] ? board : committed[0].board);
    render();
    const mine = committed.filter((n) => n.board === board), step = Math.min(90, 520 / Math.max(1, mine.length));
    mine.forEach((n, i) => setTimeout(() => {
      if (!root.isConnected) return;
      const p = at(n.gx, n.gy);
      igniteAt(fxLayer, p.x, p.y, { color: n.kind === "lesson" ? "#f4d27a" : HIDANE_COLOR[n.board], big: n.kind !== "stat" || !!n.notable || !!n.feature });
      nodeLayer.querySelector(`[data-test="board-node-${n.id}"]`)?.classList.add("lit-now");
    }, i * step));
    await sleep(Math.min(760, mine.length * step + 400));
    if (owner !== state || !root.isConnected) return;
    await commitCutIn(root, cutInItems(committed));
  }
  /** カットインに出すもの（大きい順に3つまで。長く待たせない）: 極み・スキル・✦・色の台座・要のマス・授業 */
  function cutInItems(committed) {
    const items = [];
    for (const n of committed) {
      if (n.peak) items.push({ rank: 0, tone: "peak", board: n.board, head: "COMPLETE", name: `${BOARD_JA[n.board]}を極めた`, text: "盤の能力のマスを全部灯した", icon: `${ART_DIR}icons/peak.webp`, glyph: "極" });
      else if (n.kind === "skill") items.push({ rank: 1, tone: "skill", board: n.board, head: "SKILL　スキルを覚えた", name: n.name, text: n.text, icon: `${ART_DIR}icons/skill_${n.id}.webp`, glyph: n.glyph });
      else if (n.kind === "gate") items.push({ rank: 3, tone: "gate", board: n.board, head: "BREAK　色の台座", name: `${HIDANE_NAME[n.board]}がはまった`, text: `${perkOf(n)?.text || ""}・この先の道が開いた`, icon: `${ART_DIR}hidane_${n.board}.webp`, glyph: "◆" });
      else if (n.kind === "lesson") items.push({ rank: 5, tone: "lesson", board: n.board, head: "LESSON　授業", name: `${whoName(n.who)}に相談できる`, text: `「${n.name}」。次に会った時に話を聞こう`, icon: boardFaceUrl(n.who) || faceIconUrl(n.who, state), glyph: "授" });
      if (n.feature) items.push({ rank: 2, tone: "feature", board: n.board, head: "NEW　できることが増えた", name: FEATURES[n.feature].name, text: FEATURES[n.feature].text, icon: iconOf(n) ? `${ART_DIR}icons/${iconOf(n)}.webp` : null, glyph: "✦" });
      else if (n.notable) items.push({ rank: 4, tone: "notable", board: n.board, head: "KEY　要のマス", name: NOTABLES[n.notable]?.name || "", text: perkOf(n)?.text || "", icon: iconOf(n) ? `${ART_DIR}icons/${iconOf(n)}.webp` : null, glyph: perkOf(n)?.glyph || "要" });
    }
    return items.sort((a, b) => a.rank - b.rank).slice(0, 3);
  }
  function onKey(e) {
    if (e.key !== "Escape" || document.querySelector("#modal.show")) return;
    e.preventDefault();
    close();
  }

  // 章が進んで初めて盤を開いた: 新しく開いた範囲のマスを光らせ、封が解けたことを知らせる（SBD42）
  const fresh = new Set();
  if (ringsOpen() > g.seenRing) {
    for (const n of NODES) if (n.ring > g.seenRing && n.ring <= ringsOpen()) fresh.add(n.id);
    const firstFresh = NODES.find((n) => fresh.has(n.id));
    if (firstFresh) board = firstFresh.board;
    g.seenRing = ringsOpen();
    const banner = el("div.gb-opened", { role: "status", dataset: { test: "board-opened" } }, [
      el("b", { text: "結界が解けた" }), el("span", { text: "心得の盤に、新しい道が開いた" }),
    ]);
    root.append(banner);
    setTimeout(() => banner.remove(), 3200);
    setTimeout(() => { fresh.clear(); if (current?.owner === owner && root.isConnected) render(); }, 3200);
  }
  current = { done, owner };
  const releaseAudio = createGrowthBoardAudio();
  offOwner = on("hud", () => { if (owner !== state || !growthEnabled()) void finish(false); });
  layers.fx.append(root);
  document.addEventListener("keydown", onKey, true);
  if (g.target) selected = g.target;
  render();
  setZoom(ZOOM_START); centerOnHub();
  requestAnimationFrame(() => root.classList.add("show"));
  if (canLight && tutorialPending(owner)) {
    stopTutorial = startBoardTutorial(root, { starterAmount: hadStarter ? STARTER_HIDANE : starterGiven,
      onDone: () => { if (owner === state) { owner.flags[TUTORIAL_FLAG] = true; save(); } } });
  }
  // 盤の絵が届いたら描き直す。読み終えた印（data-art）は、描き直しの後に触る検査が待つのに使う。
  loadBoardArt().then((ok) => {
    if (!root.isConnected) return;
    if (ok) { root.classList.add("has-art"); render(); }
    root.dataset.art = ok ? "ready" : "none";
  });
  return done;
}

/**
 * 灯した結果の一文（SPEC 6.3「盤で決定」・REPORT P1）: 盤ごとに、増えた恩恵を「最大体力 ＋8・寝た時の回復 ＋2%」の形で並べる。
 * 色の台座の能力も含む。変わらなかった恩恵は出さない。
 */
function perkDeltaText(committed, before) {
  const after = new Set([...before, ...committed.map((n) => n.id)]);
  const parts = [];
  for (const board of BOARD_KEYS) {
    if (!committed.some((n) => n.board === board && (n.kind === "stat" || n.kind === "gate"))) continue;
    const was = perkTotals(board, before), now = perkTotals(board, after);
    for (const p of now) {
      const delta = p.sum - (was.find((x) => x.key === p.key)?.sum || 0);
      if (delta > 0.001) parts.push(fmtPerk(p.text, delta));
    }
  }
  return parts.join("・");
}

/** 授業を灯した時の場面（2.6）。場面のある授業（スミさんの今の特訓・授業）はそれを流す */
/** 授業を灯した時（2.6・SBD50）: 「相談できる」になる。次にその人に会った時に、はじめが相談して話を聞いて習得する */
async function presentLesson(node) {
  if (!state) return;
  const who = node.who === "sumi" ? "スミさん" : displayName(node.who, state);
  gainCard({ kind: "info", badge: "授", top: "LESSON", main: `${who}に相談できる`, sub: `「${node.name}」。次に${who}に会った時に話を聞こう` });
}


