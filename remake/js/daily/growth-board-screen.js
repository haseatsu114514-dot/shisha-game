// 心得の盤の画面（SPEC 第2版 6.2、ADDENDUM-BOARD-LAYOUT）。画像が届くまでは図形だけで描く試作（#1772 のデザインで差し替え）。
// 盤は能力ごとに3枚（上の札で入れ替え）。道は SVG、マスは HTML のボタン（キーボード・タッチで押せる）。
// 参拝の場所で内省した時（place あり）だけ灯せる。メニュー・寝る前から開いた時は見るだけで、目標は決められる（2.8）。
import { el, sleep } from "../core/util.js";
import { layers, modal, gainCard } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { emit } from "../core/bus.js";
import { state } from "../core/state.js";
import { displayName, faceIconUrl, portraitInfo } from "../core/data.js";
import { affinityLevel } from "../core/stats.js";
import { ensureGrowth, gaugeInfo, HIDANE_KEYS, lessonLearned, readyLessons } from "../core/growth.js";
import {
  BOARD_KEYS, BOARD_JA, BOARD_HEAD, BOARD_WHERE, REWARD_JA, FEATURES,
  HUB, NODES, NODE_BY_ID, boardNodes, ringsOpen, statCount, statTotal, replay, nodeStatus, commitPending,
  pathTo, pendingTowards, lessonLock, hasMet, availableCount, paymentFor,
  GRID, lessonKnown, perkOf, HIDANE_NAME, perkTotals, featuresOf, statsFilled, HUB_AT, statRatio,
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
 * 立ち絵（896×1200）の上での [目の真ん中 x, 目の高さ y, 頬から頬の幅]。札の顔の切り出し（asset_sources/ui/growth-board-20261030/faces/make_faces.py の EYES と同じ値）と、
 * 右のパネルで顔の大きさと高さをそろえて立ち絵を置くのに使う（SBD81・SBD82）
 */
const PORTRAIT_EYES = {
  sumi: [442, 198, 99], minto: [492, 375, 99], adam: [436, 218, 102], tsumugi: [423, 433, 95], naru: [454, 239, 90], rei: [440, 97, 99],
  ageha: [472, 341, 99], kumicho: [479, 136, 122], kuze: [409, 145, 95], steve: [481, 100, 122], volk: [459, 109, 88], rin: [397, 290, 99],
  hiyori: [426, 299, 104], samechan: [448, 397, 104], mashiro: [439, 404, 104], sheikh: [447, 89, 98], da_silva: [453, 80, 99], hajime: [528, 263, 90],
};
const BOARD_FACES = new Set(Object.keys(PORTRAIT_EYES));
/** 右のパネルの立ち絵: 顔の幅をこの px に、目をパネルの上からこの px に */
const PANEL_FACE_W = 82, PANEL_EYE_Y = 64;
/** 右のパネルの立ち絵の表情（SBD82）。授業は教える人、スキルははじめ。無い表情は portraitInfo が近いものに */
const PANEL_FACE = {
  "M-B1": "smile", "M-S1": "serious", "M-S2": "intense", "M-S3": "smile", "M-W1": "normal", "M-W2": "thinking", "M-W3": "excited",
  "M-W6": "smile", "M-B2": "smile", "M-S4": "smile", "M-W4": "smug", "M-B3": "smug", "M-S5": "smile", "M-W5": "serious",
  "M-S6": "smile", "M-B4": "axe_throw", "M-W7": "excited", "M-B5": "smile", "M-W8": "smug", "M-B6": "excited",
  K03: "smile", K04: "smile", K07: "serious", K08: "excited", K12: "serious", K13: "excited", K15: "smug", K06: "serious",
  K10: "serious", K16: "smug", K11: "serious", K14: "surprise", K01: "serious", K02: "smile", K05: "surprise", K17: "normal",
  K09: "smile", K18: "serious", K19: "smile", K21: "smug", K22: "normal", K23: "smug", K24: "serious",
};
const ART_FILES = ["board_glass", "screen_backdrop", "hub_body", "hub_sense", "hub_wisdom", "frame_skill", "frame_lesson", "frame_gate", "frame_peak", "frame_seal",
  "hidane_any", "hidane_body", "hidane_sense", "hidane_wisdom", "panel_frame", "wall_seal", "silhouette_unknown"];
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
export const PLACE_JA = { kannon: "観音堂", tokyo_shrine: "路地裏の神社", dubai_mosque: "モスクの回廊", inn_window: "宿の窓辺" };

let current = null;

/** 盤を開き、閉じるまで待つ。戻り値=確定したマス */
export function openBoard({ place = null } = {}) {
  if (current) return current.done;
  const g = ensureGrowth();
  const canLight = !!place;
  let pending = [];
  let board = boardOfTarget() || BOARD_KEYS[0];
  let selected = null;
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
  const stage = el("div.gb-stage", { style: { width: `${W}px`, height: `${H}px` } }, [reveal, boardSvg, nodeLayer]);
  const world = el("div.gb-world", [stage]);
  const viewport = el("div.gb-board", { dataset: { test: "board-viewport" } }, [world]);
  const zoomBar = el("div.gb-zoom", { "aria-label": "盤の倍率" });
  const boardWrap = el("div.gb-board-wrap", [viewport, zoomBar]);
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
  const view = () => replay(g, pending);
  const status = (node, v) => nodeStatus(node, g, v);

  function renderHeader() {
    const info = gaugeInfo(g);
    header.replaceChildren(
      el("h2.gb-title", { text: "心得の盤" }),
      el("div.gb-level", [
        el("b", { text: `Lv.${info.level}` }),
        el("i.gb-gauge", [el("b", { style: { width: `${Math.round(info.now * 100)}%` } })]),
        el("small", { text: info.max ? "MAX" : info.pending ? "今夜 Lv UP" : `あと${info.left}` }),
      ]),
      el("p.gb-place", { dataset: { test: "board-place" }, text: canLight ? `${PLACE_JA[place] || "静かな場所"}で内省している（時間は進まない）` : "見るだけ。灯すのは観音堂などで内省した時" }),
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
    const goal = g.target && NODE_BY_ID[g.target]?.board === board ? new Set(pathTo(g.target, v.unlocked).path) : new Set();
    const walls = [];
    // ネオンのラウンジ（GB03 の見本）: 光のにじみ・封の曇り・ガラスの煙はコードで描く（画像が来たら重ねる）
    const parts = [svg("defs", {}, [
      svg("radialGradient", { id: "gb-ember", cx: "50%", cy: "62%", r: "60%" }, [
        svg("stop", { offset: "0%", "stop-color": "#fff1b8" }), svg("stop", { offset: "45%", "stop-color": "#ffb43c" }),
        svg("stop", { offset: "100%", "stop-color": "#e86a12", "stop-opacity": "0" }),
      ]),
      svg("filter", { id: "gb-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, [svg("feGaussianBlur", { stdDeviation: "3" })]),
      svg("filter", { id: "gb-fog", x: "-50%", y: "-50%", width: "200%", height: "200%" }, [svg("feGaussianBlur", { stdDeviation: "14" })]),
      svg("filter", { id: "gb-smoke" }, [
        svg("feTurbulence", { type: "fractalNoise", baseFrequency: "0.006 0.012", numOctaves: "3", seed: "7" }),
        svg("feColorMatrix", { values: "0 0 0 0 0.75  0 0 0 0 0.7  0 0 0 0 0.85  0 0 0 0.9 -0.32" }),
      ]),
    ]), svg("rect", { x: 0, y: 0, width: W, height: H, filter: "url(#gb-smoke)", class: "gb-smoke" })];
    drawBoard = board;
    const fill = statRatio(board, v.unlocked);
    reveal.className = `gb-reveal r-${board}`;
    reveal.style.setProperty("--fill", fill.toFixed(3));
    reveal.dataset.test = "board-reveal";
    reveal.dataset.fill = String(Math.round(fill * 100));
    // 方眼のうすい点（横13×縦9）
    const [hx, hy] = hubAt();
    for (let gx = -GRID.w; gx <= GRID.w; gx++) for (let gy = -GRID.h; gy <= 0; gy++) { const p = at(gx - hx, gy - hy); parts.push(svg("circle", { cx: p.x, cy: p.y, r: 1.5, class: "gb-dot" })); }
    // まだ開いていない範囲は、ガラスが曇って沈む
    const fog = svg("g", { filter: "url(#gb-fog)", class: "gb-fog-layer" });
    for (const n of nodes) if (n.ring > open) { const p = at(n.gx, n.gy); fog.append(svg("circle", { cx: p.x, cy: p.y, r: 30, class: "gb-fog" })); }
    parts.push(fog);
    // 道（使うマスどうしだけ。紋の隣は紋とつなぐ）。消えた管は暗い管と薄いハイライト、灯った管は盤の色のにじみと白い芯
    const glow = svg("g", { filter: "url(#gb-glow)", class: "gb-glow-layer" }), cores = [];
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
        if (on) { glow.append(line("gb-tube-glow")); cores.push(line("gb-path lit")); }
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
      parts.push(svg("circle", { cx: hub.x, cy: hub.y, r: 34, class: "gb-hub-glow", filter: "url(#gb-glow)" }));
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
    const face = BOARD_FACES.has(node.who) ? `${ART_DIR}faces/${node.who}.webp` : faceIconUrl(node.who, state);
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
        return p ? placed(el("img.gb-portrait.silhouette", { src: p.src, alt: "", dataset: { who: node.who } }), node.who) : null;
      }
      const p = portraitInfo(node.who, PANEL_FACE[node.id] || "smile");
      return p ? placed(el("img.gb-portrait", { src: p.src, alt: "", dataset: { who: node.who, face: p.face, test: "board-portrait" } }), node.who) : null;
    }
    if (node.kind === "skill" && shown !== "hidden") {
      const p = portraitInfo("hajime", PANEL_FACE[node.id] || "normal");
      return p ? placed(el("img.gb-portrait", { src: p.src, alt: "", dataset: { who: "hajime", face: p.face, test: "board-portrait" } }), "hajime") : null;
    }
    return null;
  }
  /** 顔の幅と目の高さがそろうように立ち絵を置く（PORTRAIT_EYES。無い人は胸から上を真ん中に） */
  function placed(img, who) {
    const [ex, ey, fw] = PORTRAIT_EYES[who] || [448, 260, 100];
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

  function renderSide(v) {
    const node = selected ? NODE_BY_ID[selected] : null;
    if (!node || node.board !== board) { side.replaceChildren(...boardSummary(v)); return; }
    const st = status(node, v), shown = revealOf(node);
    const lines = [];
    const portrait = panelPortrait(node, shown);
    if (portrait) portrait.addEventListener("error", () => { portrait.remove(); art.classList.remove("has-portrait"); });
    // 立ち絵の無い能力・関門・極みは、右のパネルにも漢字でなくアイコンを大きく（SBD85）
    const artIcon = !portrait && root.classList.contains("has-art") && iconOf(node) && (node.kind !== "skill" || shown !== "hidden")
      ? el("img.gb-art-icon", { src: node.kind === "gate" ? `${ART_DIR}hidane_${node.board}.webp` : `${ART_DIR}icons/${iconOf(node)}.webp`, alt: "" }) : null;
    const art = el(`div.gb-art.k-${node.kind}${shown !== "open" || st === "sealed" ? ".shadow" : ""}${portrait ? ".has-portrait" : ""}${artIcon ? ".has-icon" : ""}`, { "aria-hidden": "true" }, [
      artIcon,
      el("span", { text: node.kind === "stat" ? BOARD_HEAD[node.board] : node.kind === "gate" ? "関" : node.kind === "lesson" ? (lessonKnown(node, g) ? "授" : "？") : shown === "hidden" ? "？" : node.glyph }),
      portrait || (node.kind === "lesson" ? lessonFace(node, st) : null),
      portrait && node.kind === "lesson" && !lessonKnown(node, g) ? el("b.gb-art-mystery", { text: "?" }) : null,
    ]);
    lines.push(art, el("h3.gb-p-title", { text: nodeTitle(node, shown) }));
    if (node.kind === "stat") {
      const perk = perkOf(node);
      if (perk.notable) lines.push(el("p.gb-p-quality", { dataset: { test: "board-notable" }, text: `要のマス「${perk.notable.name}」：${perk.notable.text}` }));
      lines.push(el("p", { dataset: { test: "board-perk" }, text: `このマスで：${perk.text}（${perk.tierName}${perk.notable ? "・要" : ""}）` }));
      if (node.feature) lines.push(el("p.gb-p-quality", { dataset: { test: "board-feature" }, text: `✦ 灯すと「${FEATURES[node.feature].text}」` }));
      if (node.peak) lines.push(el("p.gb-p-next", { text: statsFilled(node.board, v.unlocked) ? "盤の能力のマスを全部灯した。極みを灯せる" : "この盤の能力のマスを全部灯すと灯せる（盤を埋めたご褒美）" }));
      lines.push(el("p.gb-p-sub", { text: `効く場面：${BOARD_WHERE[node.board]}` }));
    } else if (node.kind === "gate") {
      // 色の台座（SBD89）: 色の火をはめると先へ進めて、台座の能力も手に入る
      const perk = perkOf(node);
      lines.push(el("p", { text: `${HIDANE_NAME[node.board]}をはめる台座（台座の光の色）。はめると先へ進めて、この台座の能力が手に入る。先には強いスキルや授業がある` }));
      if (perk) lines.push(el("p.gb-p-quality", { dataset: { test: "board-gate-perk" }, text: `はめると：${perk.text}（色の台座）` }));
      lines.push(el("p.gb-p-sub", { text: `${HIDANE_NAME[node.board]}を先に使う。無ければほかの色の火でもはまる。白火でははまらない` }));
    } else if (node.kind === "skill") {
      if (shown === "hidden") lines.push(el("p", { text: "物語が進むと盤に現れる" }));
      else lines.push(el("p", { text: node.text }), el("p.gb-p-sub", { text: `効く場面：${node.scene}・火種${node.cost}${shown === "next" ? "・まだ開いていない" : ""}` }));
    } else {
      const lock = lessonLock(node, v.unlocked);
      const met = lessonKnown(node, g);
      if (!met) lines.push(el("p", { dataset: { test: "board-lesson-mystery" }, text: "まだ出会っていない誰かが、ここで何かを教えてくれるらしい" }));
      else {
        lines.push(el("p.gb-p-reward", { text: `${REWARD_JA[node.reward]}：${node.text}` }));
        if (st === "sealed") lines.push(el("p.gb-p-sub", { text: node.hint }));
      }
      if (lock && met) {
        const conds = [];
        if (node.need) conds.push(met ? `${whoName(node.who)} ♥${Math.min(5, affinityLevel(node.who))}/${node.need}` : `？？？ ♥?/${node.need}`);
        lines.push(el("p.gb-p-lock", { dataset: { test: "board-lesson-lock" }, text: `錠：${conds.join("・")}` }));
      } else if (met && st !== "unlocked") lines.push(el("p.gb-p-sub", { text: "火種いらず。道が届けば灯せる" }));
    }
    lines.push(el(`p.gb-p-state.s-${st}`, { text: stateText(node, st, v) }));
    const actions = [];
    if (canLight && st === "available") actions.push(el("button.btn.primary.gb-light", { text: node.kind === "gate" ? "はめる（色の火種1）" : node.cost ? `灯す（火種${node.cost}）` : "教わる", dataset: { test: "board-light" }, onclick: () => light(node.id) }));
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
    const bars = perkTotals(board, v.unlocked).map((p) => el("div.gb-bar", { dataset: { test: `board-bar-${p.key}` } }, [
      el("span.gb-bar-name", { text: p.name }),
      el("i.gb-bar-line", { "aria-hidden": "true" }, [el("b", { style: { width: `${p.max ? Math.round((p.sum / p.max) * 100) : 0}%` } })]),
      el("span.gb-bar-sum", { text: p.text }),
    ]));
    const feats = featuresOf(board, v.unlocked);
    const out = [
      el("h3.gb-p-title", { text: `${BOARD_JA[board]}盤 ${count}/${statTotal(board)}` }),
      el("div.gb-bars", { dataset: { test: "board-bars" } }, bars),
      feats.length ? el("p.gb-p-quality", { text: feats.map((f) => `${f.on ? "✦" : "・"}${f.name}`).join("　") }) : null,
      el("p.gb-p-sub", { text: `効く場面：${BOARD_WHERE[board]}` }),
    ];
    if (g.target) {
      const t = NODE_BY_ID[g.target], route = pathTo(g.target, v.unlocked);
      out.push(el("p.gb-p-target", { dataset: { test: "board-target-line" }, text: `目標：${nodeTitle(t)}まで 火種${route.cost}` }));
    }
    out.push(el("p.gb-hint", { text: canLight ? "光っているマスが今灯せる。紋から道をたどって、欲しいスキルや授業の方へ" : "マスを押すと何が変わるかが出る。欲しいマスは「目標にする」で印をつけておける" }));
    return out.filter(Boolean);
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
      const route = pathTo(node.id, v.unlocked);
      return `まだ道がつながっていない（ここまで 火種${route.cost}）`;
    }
    if (st === "short" && node.kind === "gate") return "色の火（紅火・蒼火・翠火）が要る。節目のレベル・大会・♥5の人・遊びのご褒美でもらえる";
    if (st === "short") {
      const have = (v.hidane.any || 0) + (v.hidane[node.board] || 0);
      return `火種があと${node.cost - have}つ要る。火種は貯めておける`;
    }
    if (!canLight) return `灯せる（${payText(paymentFor(node, v.hidane, v.ctx))}）。観音堂などで内省すると灯せる`;
    return `${payText(paymentFor(node, v.hidane, v.ctx))}で払う`;
  }

  function renderFooter(v) {
    const wallet = el("div.gb-wallet", { dataset: { test: "board-wallet" } }, HIDANE_KEYS.map((k) => el(`span.gb-hidane.k-${k}${v.hidane[k] ? "" : ".zero"}`, {
      title: k === "any" ? "白火（色の台座のほか、どのマスにも）" : `${HIDANE_NAME[k]}（${BOARD_JA[k]}盤のマスと、色の台座）`,
    }, [el("i", { "aria-hidden": "true" }), el("span", { text: HIDANE_NAME[k] }), el("b", { text: String(v.hidane[k] || 0) })])));
    const actions = [];
    if (canLight && pending.length) actions.push(el("button.btn.gb-reset", { text: "取り消す", dataset: { test: "board-reset" }, onclick: () => { pending = []; SE.cancel?.(); render(); } }));
    actions.push(el("button.btn.primary.gb-decide", {
      text: pending.length ? `決定（${pending.length}）` : "閉じる", dataset: { test: "board-decide" }, onclick: () => (pending.length ? finish(true) : close()),
    }));
    footer.replaceChildren(wallet, el("p.gb-legend", [
      legend("available", "今灯せる"), legend("far", "道がまだ"), el("span", { text: "◆ 色の台座（光っている色の火をはめる）" }), legend("sealed", "授業の錠"), legend("locked", "結界の先（物語が進むと開く）"), el("span", { text: "✦ できることが増える" }),
    ]), el("div.gb-actions", actions));
  }
  function legend(st, text) { return el("span.gb-legend-item", [el(`i.s-${st}`), el("span", { text })]); }

  function render() {
    const v = view();
    pending = v.pending;
    renderHeader(); renderTabs(v); renderBoard(v); renderSide(v); renderFooter(v);
  }
  function select(id, sound) {
    selected = id;
    if (sound) SE.click?.();
    render();
    nodeLayer.querySelector(`[data-test="board-node-${id}"]`)?.focus({ preventScroll: true });
  }
  function light(id) {
    if (!canLight) return;
    pending = [...pending, id];
    SE.select?.();
    // 仮置きで隣へ自動で進む（6.2 スマホ横の基本操作）: 今取れる隣が1つだけならそれを選ぶ
    const v = view();
    const nexts = NODE_BY_ID[id].links.filter((n) => n !== HUB && status(NODE_BY_ID[n], v) === "available");
    render();
    nodeLayer.querySelector(`[data-test="board-node-${id}"]`)?.classList.add("lit-now");
    if (nexts.length === 1) select(nexts[0], false);
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
    pending = pendingTowards(g, pending, id);
    SE.select?.();
    render();
  }
  async function help() {
    await modal({
      title: "心得の盤の見方", className: "gboard-help",
      body: el("div", [
        el("p", { text: "盤は能力ごとに3枚（才能・感覚・理論）。下の紋から左・右・上へ道がのびていて、線でつながった隣のマスだけ灯せる。どの道から進んでもいい。" }),
        el("p", { text: "丸いマスは能力（主に火種1、人柄の追加マスは2）。灯すたびに少し伸びる。紋から遠いマスほど恩恵が大きい（近く×1・中ほど×2・台座の先×3）。✦のマスは灯すと、できることが1つ増える。六角形はスキル（火種2〜7）。いちばん上の極みは、その盤の能力のマスを全部灯すと灯せる。" }),
        el("p", { text: "ひし形は色の台座。色の火（紅火・蒼火・翠火）を1つはめると、その先の道が開き、台座の能力（台座の先のマスより大きい）も手に入る。台座の先には強いスキルと授業がある。白火でははまらない。" }),
        el("p", { text: "金の札は授業（火種いらず）。教えてくれる人に出会うと盤に現れる。灯したら、次にその人に会った時に相談して習う（LIME では習えない）。" }),
        el("p", { text: "白火は色の台座のほか、どのマスにも使える。色の火はその色の盤のマスと色の台座に使える。払うときは白火が先。" }),
        el("p", { text: "火種を灯せるのは、観音堂などの静かな場所で内省した時だけ（時間は進まない）。メニューからは見るだけで、欲しいマスを目標にしておける。" }),
      ]),
      options: [{ label: "閉じる", value: true, primary: true }],
    });
  }
  async function close() {
    if (pending.length) {
      const choice = await modal({
        title: "決定しますか？", body: `仮置き ${pending.length}つ`,
        options: [{ label: "決定して閉じる", value: "yes", primary: true, test: "board-confirm-yes" }, { label: "仮置きをやめて閉じる", value: "no", test: "board-confirm-no" }, { label: "戻る", value: null }],
      });
      if (!choice) return;
      return finish(choice === "yes");
    }
    return finish(false);
  }
  async function finish(commit) {
    const owner = state;
    const committed = commit ? commitPending(pending) : [];
    document.removeEventListener("keydown", onKey, true);
    root.classList.remove("show");
    await sleep(200);
    root.remove();
    current = null;
    if (owner === state && committed.length) {
      emit("hud");
      const squares = committed.filter((n) => n.kind === "stat").length;
      if (squares) gainCard({ kind: "info", badge: "火", top: "LIGHT", main: `能力の火を${squares}つ灯した` });
      const gates = committed.filter((n) => n.kind === "gate").length;
      if (gates) gainCard({ kind: "info", badge: "関", top: "BREAK", main: `色の台座に${gates}つはめた`, sub: "この先の道が開き、台座の能力が手に入った" });
      for (const node of committed) if (node.feature) gainCard({ kind: "info", badge: "✦", top: "NEW", main: FEATURES[node.feature].name, sub: FEATURES[node.feature].text });
      for (const node of committed) if (node.peak) gainCard({ kind: "info", badge: "極", top: "COMPLETE", main: `${BOARD_JA[node.board]}を極めた`, sub: "盤の能力のマスを全部灯した" });
      for (const node of committed) if (node.kind === "skill") gainCard({ kind: "info", badge: node.glyph, top: "SKILL", main: node.name, sub: node.text });
      // 授業: 今のゲームの場面がある授業はその場面を見せる（読み終えたら習得。場面が無い授業はカードで）
      for (const node of committed) if (node.kind === "lesson") await presentLesson(node);
    }
    resolveDone(committed);
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
    setTimeout(() => { fresh.clear(); if (current) render(); }, 3200);
  }
  current = { done };
  layers.fx.append(root);
  document.addEventListener("keydown", onKey, true);
  if (g.target) selected = g.target;
  render();
  setZoom(ZOOM_START); centerOnHub();
  requestAnimationFrame(() => root.classList.add("show"));
  loadBoardArt().then((ok) => { if (ok && root.isConnected) { root.classList.add("has-art"); render(); } });
  return done;
}

/** 授業を灯した時の場面（2.6）。場面のある授業（スミさんの今の特訓・授業）はそれを流す */
/** 授業を灯した時（2.6・SBD50）: 「相談できる」になる。次にその人に会った時に、はじめが相談して話を聞いて習得する */
async function presentLesson(node) {
  if (!state) return;
  const who = node.who === "sumi" ? "スミさん" : displayName(node.who, state);
  gainCard({ kind: "info", badge: "授", top: "LESSON", main: `${who}に相談できる`, sub: `「${node.name}」。次に${who}に会った時に話を聞こう` });
}

