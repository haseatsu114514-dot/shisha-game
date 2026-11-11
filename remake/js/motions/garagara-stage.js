// シーシャくじの舞台: いま居る Dr.fookah の店内を背に、レジのカウンターへ置いた福引きの抽選器（ガラガラ）。
// 2026-11-11 オーナー「CSS感がすごいので画像生成も含めて作りたい。お店の雰囲気と祭り感が合わないかも」:
// - 紅白幕・提灯の祭りの飾りはやめ、店の素材（くるみ材・黒い鉄・くすんだ真鍮・黒板）に合わせた。
// - 後ろは、その店の背景そのもの（今の場面の絵をぼかして暗くする）。店ごとに景色が変わる。
// - 道具は1つずつ別の部品（kuji-art.js の差し込み口）。描いた絵が届けば差し替わり、無いあいだは下の下絵を出す。
// 部品は正面から見た絵で、胴は回転（CSS の変形）だけで動かす。毎フレームの描き直しをしないのでスマホでも軽い。
import { el } from "../core/util.js";
import { svg } from "../core/transition-kit.js";
import { artPart } from "./kuji-art.js";

// 玉の色が賞を表す（S＝金・A＝赤・B＝青・C＝白・ラストワン＝黒地に銀の輪）。配色は意味を持つので固定
export const BALL = { S: "#f7c648", A: "#e2443c", B: "#3f82ea", C: "#f6f3ec", LAST: "#2a2648" };
export const BALL_EDGE = { S: "#8a5a10", A: "#701a1a", B: "#173a80", C: "#a39b8e", LAST: "#07060e" };
export const BALL_HI = { S: "#fff3c0", A: "#ffb3a4", B: "#b9d6ff", C: "#ffffff", LAST: "#8b8cc0" };
export const LAST_RING = "#d8dce6"; // ラストワンの玉の銀の輪
/** 賞ごとの光の色（演出の光・紙吹雪・札の枠）。[主・明るい側・差し色] */
export const RANK_LIGHT = {
  S: ["#ffcf4a", "#fff6d0", "#ff8a3c"],
  A: ["#ff5a4e", "#ffd9c9", "#ffb02e"],
  B: ["#4f9bff", "#d6ebff", "#7fe3ff"],
  C: ["#e9e4f5", "#ffffff", "#cdbdf2"],
  LAST: ["#b8a5ff", "#f1f2f8", "#6f7cff"],
};

// 店の素材の色
export const SHOP = {
  wood0: "#2f1c11", wood1: "#5b3a22", wood2: "#8a5d37", wood3: "#b98a58",
  steel0: "#141316", steel1: "#2b292f", steel2: "#5d5963",
  brass0: "#7a5a22", brass1: "#c9a24a", brass2: "#f3dc9a",
  felt0: "#1d2a25", felt1: "#33473d", shadow: "#0a0706",
};

// 道具の置き場所（抽選器まわりの座標。ステージ 1280×720 にそのまま置き、演出側で寄せ方を決める）
export const AX = 540, AY = 292; // 胴の軸
export const R = 150; // 胴（六角）の外接半径
export const BALL_R = 16;
export const EXIT = [AX + R * 0.73, AY + R * 0.62]; // 玉が出る所（胴の右下のふち）
export const TRAY = { x: 872, y: 598 }; // 受け皿の中心
export const LAND = [TRAY.x - 26, TRAY.y - BALL_R - 3]; // 玉が落ちる所
export const REST = [TRAY.x + 6, TRAY.y - BALL_R - 1]; // 玉が止まる所

const DEG = Math.PI / 180;
const hexPts = (r, a0 = 0) => [...Array(6)].map((_, i) => [r * Math.cos((a0 + i * 60) * DEG), r * Math.sin((a0 + i * 60) * DEG)]);
export const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
let serial = 0;
export const uid = (prefix = "kj") => `${prefix}-${++serial}`;
/** グラデーションの定義を作り、url(#id) を返す */
export function grad(defs, kind, attrs, stops) {
  const id = uid();
  defs.append(svg(kind, { id, ...attrs }, stops.map(([o, c, a = 1]) => svg("stop", { offset: o, "stop-color": c, "stop-opacity": a }))));
  return `url(#${id})`;
}
/** 下絵の SVG（viewBox の箱いっぱいに描く） */
const sketchSvg = (box, kids) => svg("svg", { viewBox: box, class: "kj-sketch" }, kids);

// ---- 下絵（描いた絵が届くまでの仮の絵） ----

/** 胴の正面: くるみの板6枚を合わせた六角、黒い鉄の帯と角金具、真鍮の鋲と軸頭、玉の出口の小さな真鍮の蓋 */
function drumSketch() {
  const C = SHOP, defs = svg("defs");
  const v = hexPts(R);
  const planks = v.map((p, i) => {
    const q = v[(i + 1) % 6], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const fill = grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: mid[0], y2: mid[1] }, i % 2 ? [[0, C.wood2], [1, C.wood1]] : [[0, C.wood3], [1, C.wood2]]);
    // 木目: 外の辺に平行な細い線
    const grain = [0.38, 0.55, 0.72, 0.86].map((k) => svg("line", { x1: p[0] * k, y1: p[1] * k, x2: q[0] * k, y2: q[1] * k, stroke: C.wood0, "stroke-width": 1.2, "stroke-opacity": 0.22 }));
    return svg("g", {}, [svg("polygon", { points: pts([[0, 0], p, q]), fill }), ...grain]);
  });
  const seams = v.map((p) => svg("line", { x1: 0, y1: 0, x2: p[0], y2: p[1], stroke: C.wood0, "stroke-width": 2.4, "stroke-opacity": 0.75 }));
  const brackets = v.map(([x, y], i) => {
    const prev = v[(i + 5) % 6], next = v[(i + 1) % 6];
    const d = (p) => { const dx = p[0] - x, dy = p[1] - y, l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
    const a = d(prev), b = d(next);
    return svg("g", {}, [
      svg("polygon", { points: pts([[x, y], [x + a[0] * 40, y + a[1] * 40], [x * 0.74, y * 0.74], [x + b[0] * 40, y + b[1] * 40]]), fill: C.steel1, stroke: C.steel0, "stroke-width": 1.4 }),
      svg("circle", { cx: x * 0.88, cy: y * 0.88, r: 3.4, fill: C.brass1, stroke: C.brass0, "stroke-width": 1 }),
    ]);
  });
  // 玉の出口の蓋（回っているのが分かる目印）
  const hatch = svg("g", { transform: "rotate(30)" }, [
    svg("rect", { x: 78, y: -17, width: 40, height: 34, rx: 5, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, C.brass2], [0.5, C.brass1], [1, C.brass0]]), stroke: C.brass0, "stroke-width": 1.4 }),
    svg("circle", { cx: 98, cy: 0, r: 8, fill: C.steel0 }),
  ]);
  const hub = grad(defs, "radialGradient", { cx: 0.38, cy: 0.34, r: 0.8 }, [[0, C.brass2], [0.5, C.brass1], [1, C.brass0]]);
  return sketchSvg(`${-R - 4} ${-R - 4} ${R * 2 + 8} ${R * 2 + 8}`, [defs,
    ...planks, ...seams,
    svg("polygon", { points: pts(hexPts(R * 0.5, 30)), fill: "none", stroke: C.wood0, "stroke-width": 1.6, "stroke-opacity": 0.35 }),
    hatch,
    svg("polygon", { points: pts(hexPts(R - 6)), fill: "none", stroke: C.steel1, "stroke-width": 12, "stroke-linejoin": "round" }),
    svg("polygon", { points: pts(hexPts(R - 1.5)), fill: "none", stroke: C.steel2, "stroke-width": 1.4, "stroke-linejoin": "round", "stroke-opacity": 0.7 }),
    ...brackets,
    svg("circle", { r: 40, fill: C.steel1, stroke: C.steel0, "stroke-width": 1.5 }),
    ...[...Array(8)].map((_, i) => svg("circle", { cx: 32 * Math.cos(i * 45 * DEG), cy: 32 * Math.sin(i * 45 * DEG), r: 2.6, fill: C.brass1 })),
    svg("circle", { r: 24, fill: hub, stroke: C.brass0, "stroke-width": 1.5 }),
  ]);
}

/** A字の脚（黒い鉄の角材に、真鍮の軸受け）。箱 330×330、軸受けは上から 18 の中央 */
function frameSketch() {
  const C = SHOP, defs = svg("defs");
  const steel = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.steel0], [0.45, C.steel2], [0.6, C.steel1], [1, C.steel0]]);
  const leg = (side) => {
    const top = [150 + side * 8, 18], foot = [150 + side * 112, 322];
    return svg("g", {}, [
      svg("polygon", { points: pts([[top[0] - 9, top[1]], [top[0] + 9, top[1]], [foot[0] + 10, foot[1]], [foot[0] - 10, foot[1]]]), fill: steel }),
      svg("line", { x1: top[0] - 4, y1: top[1] + 12, x2: foot[0] - 5, y2: foot[1] - 6, stroke: C.steel2, "stroke-width": 1.4, "stroke-opacity": 0.55 }),
      svg("rect", { x: foot[0] - 20, y: 318, width: 40, height: 10, rx: 2, fill: C.steel0 }),
    ]);
  };
  return sketchSvg("-15 0 330 330", [defs,
    svg("polygon", { points: pts([[82, 222], [218, 222], [224, 240], [76, 240]]), fill: steel }),
    leg(-1), leg(1),
    svg("circle", { cx: 150, cy: 18, r: 18, fill: C.steel1, stroke: C.steel0, "stroke-width": 1.5 }),
    svg("circle", { cx: 150, cy: 18, r: 9, fill: C.brass1, stroke: C.brass0, "stroke-width": 1.2 }),
  ]);
}

/** 土台の板（くるみ材）。箱 440×64 */
function baseSketch() {
  const C = SHOP, defs = svg("defs");
  return sketchSvg("0 0 440 64", [defs,
    svg("ellipse", { cx: 224, cy: 54, rx: 230, ry: 10, fill: C.shadow, opacity: 0.5 }),
    svg("polygon", { points: pts([[34, 6], [406, 6], [432, 36], [8, 36]]), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.wood1], [1, C.wood2]]) }),
    svg("polygon", { points: pts([[8, 36], [432, 36], [432, 54], [8, 54]]), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.wood1], [1, C.wood0]]) }),
    svg("line", { x1: 8, y1: 36.5, x2: 432, y2: 36.5, stroke: C.wood3, "stroke-width": 1.6, "stroke-opacity": 0.8 }),
    ...[[18, 45], [422, 45]].map(([x, y]) => svg("circle", { cx: x, cy: y, r: 3.2, fill: C.brass1 })),
  ]);
}

/** ハンドル（真鍮の腕と、こちらを向いた木の握り）。箱 280×280 の中心が軸 */
function handleSketch() {
  const C = SHOP, defs = svg("defs");
  const brass = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.brass2], [0.5, C.brass1], [1, C.brass0]]);
  const knob = grad(defs, "radialGradient", { cx: 0.38, cy: 0.34, r: 0.8 }, [[0, C.wood3], [0.55, C.wood2], [1, C.wood0]]);
  return sketchSvg("-140 -140 280 280", [defs,
    svg("rect", { x: -6, y: -9, width: 112, height: 18, rx: 9, fill: brass, stroke: C.brass0, "stroke-width": 1.4 }),
    svg("circle", { r: 16, fill: brass, stroke: C.brass0, "stroke-width": 1.4 }),
    svg("circle", { r: 5, fill: C.brass0 }),
    svg("circle", { cx: 104, cy: 0, r: 21, fill: knob, stroke: C.wood0, "stroke-width": 1.6 }),
    svg("ellipse", { cx: 98, cy: -7, rx: 8, ry: 5, fill: "#fff", opacity: 0.22 }),
  ]);
}

/** 受け皿（くるみの縁に、濃い緑の布張り）。箱 220×84 */
function traySketch() {
  const C = SHOP, defs = svg("defs");
  return sketchSvg("0 0 220 84", [defs,
    svg("ellipse", { cx: 114, cy: 60, rx: 112, ry: 20, fill: C.shadow, opacity: 0.45 }),
    svg("path", { d: "M 14 36 A 96 27 0 0 0 206 36 L 206 52 A 96 27 0 0 1 14 52 Z", fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.wood0], [0.4, C.wood2], [0.6, C.wood3], [1, C.wood0]]) }),
    svg("ellipse", { cx: 110, cy: 36, rx: 96, ry: 27, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.wood1], [0.5, C.wood3], [1, C.wood1]]), stroke: C.wood0, "stroke-width": 1.2 }),
    svg("ellipse", { cx: 110, cy: 37, rx: 84, ry: 21, fill: grad(defs, "radialGradient", { cx: 0.5, cy: 0.4, r: 0.65 }, [[0, C.felt1], [1, C.felt0]]) }),
    svg("path", { d: "M 26 37 A 84 21 0 0 1 194 37", fill: "none", stroke: C.shadow, "stroke-width": 4, "stroke-opacity": 0.35 }),
  ]);
}

/** 玉の下絵（塗りの球）。ラストワンは黒地に銀の輪 */
function ballSketch(k) {
  const defs = svg("defs");
  const fill = grad(defs, "radialGradient", { cx: 0.36, cy: 0.32, r: 0.82 }, [[0, BALL_HI[k]], [0.38, BALL[k]], [0.86, BALL_EDGE[k]], [1, BALL_EDGE[k]]]);
  return sketchSvg("-17 -17 34 34", [defs,
    svg("circle", { r: 16, fill }),
    ...(k === "LAST" ? [svg("path", { d: "M -16 0 A 16 5.4 0 0 0 16 0", fill: "none", stroke: LAST_RING, "stroke-width": 1.9, transform: "rotate(-16)" })] : []),
    svg("ellipse", { cx: 2, cy: 9.5, rx: 8.5, ry: 3.6, fill: "#fff", opacity: 0.14 }),
    svg("ellipse", { cx: -5.4, cy: -6.4, rx: 6, ry: 3.8, fill: "#fff", opacity: k === "LAST" ? 0.5 : 0.78, transform: "rotate(-35 -5.4 -6.4)" }),
    svg("circle", { cx: -8, cy: -2, r: 1.4, fill: "#fff", opacity: 0.7 }),
  ]);
}

/** 玉。node を動かし、halo は賞の色のにじみ */
export function ballPart(rank) {
  const k = BALL[rank] ? rank : "C";
  const node = artPart(`ball-${k.toLowerCase()}`, "kj-ball-s", () => ballSketch(k));
  const halo = el("i.kj-ball-halo", { style: { "--kj-halo": RANK_LIGHT[k][0], "--kj-halo-hi": RANK_LIGHT[k][1] } });
  node.prepend(halo);
  return { node, halo, rank: k, light: RANK_LIGHT[k] };
}

/** カウンターに立てた小さな黒板（賞と玉の色）。last はラストワン賞の案内 */
function signPart(last) {
  const rows = last
    ? [el("b.kj-sign-title", { text: "ラストワン賞" }), el("div.kj-sign-big", [ballPart("LAST").node]), el("span.kj-sign-note", { text: "最後の1枚を引いた方へ" })]
    : [el("b.kj-sign-title", { text: "シーシャくじ" }),
      ...["S", "A", "B", "C"].map((k) => el("div.kj-sign-row", [ballPart(k).node, el("span", { text: `${k}賞` })])),
      el("span.kj-sign-note", { text: "ラストワン賞あり" })];
  const node = artPart("sign", "kj-sign", () => el("i.kj-sign-board"));
  node.append(el("div.kj-sign-text", rows));
  return node;
}

/** 連続で引くときの玉置き（手前の細長い木の盆）。n 個の玉が順に並ぶ */
export function railPart(n) {
  const gap = Math.min(78, 920 / n), y = 652, width = (n - 1) * gap + 92, left = 640 - width / 2;
  const xs = [...Array(n)].map((_, i) => 640 + (i - (n - 1) / 2) * gap);
  const count = el("b.kj-rail-count", { text: `0 / ${n}` });
  const node = artPart("rail", "kj-rail", () => el("i.kj-rail-wood", xs.map((x) => el("i.kj-rail-pit", { style: { left: `${x - left - 20}px` } }))));
  Object.assign(node.style, { left: `${left}px`, top: `${y - 24}px`, width: `${width}px` });
  node.append(count);
  return { node, at: (i) => [xs[i], y - 12], count(k) { count.textContent = `${k} / ${n}`; } };
}

/** いまの場面の背景（その店の絵）を写して、ぼかして暗くした後ろの景色にする */
export function shopBackdrop() {
  const node = el("div.kj-bg", { "aria-hidden": "true" });
  const now = document.querySelector("#bg .bg-img.show") || document.querySelector("#bg .bg-img:last-child");
  if (now) {
    const copy = now.cloneNode(true);
    copy.removeAttribute("data-tint");
    copy.className = "kj-bg-img";
    node.append(copy);
  }
  return node;
}

/**
 * 舞台一式。scene＝カメラで寄る層に入れる部品（後ろの店・カウンター・黒板・抽選器・受け皿）、
 * overlays＝手前に重ねる幕（溜めの暗がり・賞の色の染まり・周辺減光）。
 * drum は回す胴（--th に角度を入れる）、handle は一緒に回るハンドル、rig は震えさせる抽選器の束。
 */
export function stageParts({ last = false } = {}) {
  // 胴の厚み: 同じ六角を奥（右上）へ7枚ずらして重ねる
  const sides = [...Array(7)].map((_, i) => el("i.kj-drum-side", { style: { "--i": String(7 - i) } }));
  const face = artPart("drum", "kj-drum-face", drumSketch);
  const drum = el("div.kj-drum", { style: { left: `${AX}px`, top: `${AY}px` } }, [...sides, face, el("i.kj-drum-sheen")]);
  const farFrame = artPart("frame", "kj-frame", frameSketch);
  farFrame.classList.add("kj-frame-far");
  const nearFrame = artPart("frame", "kj-frame", frameSketch);
  const base = artPart("base", "kj-base", baseSketch);
  const handle = artPart("handle", "kj-handle", handleSketch);
  const tray = artPart("tray", "kj-tray", traySketch);
  const exitGlow = el("i.kj-exit-glow", { style: { left: `${EXIT[0]}px`, top: `${EXIT[1]}px` } });
  const rig = el("div.kj-rig", [el("i.kj-ground.kj-ground-base"), base, farFrame, drum, exitGlow, nearFrame, handle]);
  const counter = artPart("counter", "kj-counter", () => el("i.kj-counter-wood"));
  const pillar = el("i.kj-pillar", { style: { left: `${REST[0]}px`, top: `${REST[1] + 14}px` } });
  const dim = el("div.kj-dim", { "aria-hidden": "true" });
  const tint = el("div.kj-tint", { "aria-hidden": "true" });
  const vignette = el("div.kj-vignette", { "aria-hidden": "true" });
  return {
    scene: [shopBackdrop(), el("i.kj-toplight"), counter, signPart(last)],
    machine: [rig, el("i.kj-ground.kj-ground-tray"), tray, pillar],
    overlays: [dim, tint, vignette],
    rig, drum, handle, pillar, exitGlow,
    /** 全面を賞の色で染める（k: 0〜1） */
    mood(k, color) {
      tint.style.background = color;
      tint.style.opacity = (0.5 * k).toFixed(3);
    },
    /** 舞台を暗くする（k: 0〜1。溜めのあいだ） */
    dim(k) { dim.style.opacity = k.toFixed(3); },
  };
}
