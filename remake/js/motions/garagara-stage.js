// シーシャくじの舞台（ガラガラを置く「くじコーナー」）。紫の壁に紅白幕と提灯、艶のある黒いカウンター。
// 抽選器そのもの（motions/garagara.js）の後ろに敷く絵で、画像は使わずすべて SVG で描く。
// 舞台は動かない絵なので、抽選器とは別の SVG に置いて一度だけ描かせる（毎フレーム描き直すのは抽選器だけ。スマホで重くしない）。
// 賞の光（全面の染まり）・溜めの暗がり・周辺減光は SVG の上に重ねる div で、濃さを garagara.js が時刻で動かす。
import { el } from "../core/util.js";
import { svg, W } from "../core/transition-kit.js";

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

// 舞台の色。紫の壁・朱と白の幕・金の金具・提灯の灯り
export const STAGE = {
  wallHi: "#7a5ad6", wall0: "#33215f", wallLo: "#150c2e", shadow: "#07040f",
  paper: "#f8f1e2", ink: "#2b1d2a", red: "#cf3423", redD: "#8f1d14", white: "#f7f1e6",
  gold0: "#7a5416", gold1: "#dcaa3e", gold2: "#fff0b8",
  lampHi: "#fff7d6", lamp1: "#ffd27a", lamp2: "#f08a2e", lamp3: "#b8501c",
  counter0: "#1c1024", counter1: "#4b2b52", counterEdge: "#0f0816",
  valance: "#22133f",
};

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** 2色を混ぜる（k=0 で a、1 で b） */
export function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(k))).join(",")})`;
}
export const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

let serial = 0;
export const uid = (prefix = "gg") => `${prefix}-${++serial}`;
/** グラデーションの定義を作り、url(#id) を返す */
export function grad(defs, kind, attrs, stops) {
  const id = uid();
  defs.append(svg(kind, { id, ...attrs }, stops.map(([o, c, a = 1]) => svg("stop", { offset: o, "stop-color": c, "stop-opacity": a }))));
  return `url(#${id})`;
}

const M = 200; // ワイドステージ（#2861）で左右へ延ばす幅
const CURTAIN_Y = 104; // 紅白幕の裾

/** 壁に掛けた景品表（賞と玉の色）。last はラストワン賞の札 */
function legendArt(C, defs, last) {
  const x = 96, y = 168, w = 176, h = 236;
  const font = { "font-family": "Suien Gothic, sans-serif", "font-weight": 700, fill: C.ink, "text-anchor": "middle" };
  const dot = (cx, cy, k, r = 10) => svg("g", {}, [
    svg("circle", { cx, cy, r, fill: grad(defs, "radialGradient", { cx: 0.36, cy: 0.32, r: 0.8 }, [[0, BALL_HI[k]], [0.45, BALL[k]], [1, BALL_EDGE[k]]]) }),
    ...(k === "LAST" ? [svg("path", { d: `M ${cx - r} ${cy} A ${r} ${r * 0.32} 0 0 0 ${cx + r} ${cy}`, fill: "none", stroke: LAST_RING, "stroke-width": 1.6, transform: `rotate(-16 ${cx} ${cy})` })] : []),
  ]);
  const body = last ? [
    svg("text", { ...font, x: w / 2, y: 52, "font-size": 22 }),
    dot(w / 2, 112, "LAST", 26),
    svg("text", { ...font, x: w / 2, y: 172, "font-size": 16, "font-weight": 500 }),
    svg("text", { ...font, x: w / 2, y: 196, "font-size": 16, "font-weight": 500 }),
  ] : [
    svg("text", { ...font, x: w / 2, y: 42, "font-size": 21 }),
    svg("line", { x1: 22, y1: 56, x2: w - 22, y2: 56, stroke: C.gold1, "stroke-width": 2 }),
    ...["S", "A", "B", "C"].flatMap((k, i) => [dot(54, 84 + i * 34, k), svg("text", { ...font, x: 106, y: 91 + i * 34, "font-size": 19 })]),
    svg("text", { ...font, x: w / 2, y: 218, "font-size": 13, fill: C.red }),
  ];
  const words = last ? ["ラストワン賞", "最後の1枚を", "引いた方へ"] : ["シーシャくじ", "S賞", "A賞", "B賞", "C賞", "ラストワン賞あり"];
  body.filter((n) => n.tagName === "text").forEach((n, i) => { n.textContent = words[i] || ""; });
  const paper = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0.25, y2: 1 }, [[0, "#fffaf0"], [1, mix(C.paper, C.ink, 0.1)]]);
  const frame = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, C.gold2], [0.35, C.gold1], [0.7, C.gold0], [1, C.gold1]]);
  return svg("g", { transform: `translate(${x} ${y}) rotate(${last ? 1.2 : -1.6})` }, [
    // 吊り紐と影
    svg("path", { d: `M 26 0 L ${w / 2} -30 L ${w - 26} 0`, fill: "none", stroke: C.gold1, "stroke-width": 2, opacity: 0.85 }),
    svg("circle", { cx: w / 2, cy: -30, r: 4, fill: C.gold1 }),
    svg("rect", { x: 5, y: 8, width: w, height: h, rx: 6, fill: C.shadow, opacity: 0.4 }),
    svg("rect", { x: -5, y: -5, width: w + 10, height: h + 10, rx: 8, fill: frame }),
    svg("rect", { width: w, height: h, rx: 4, fill: paper }),
    svg("rect", { x: 7, y: 7, width: w - 14, height: h - 14, rx: 2, fill: "none", stroke: last ? C.red : C.gold1, "stroke-width": 1.4, opacity: 0.7 }),
    ...body,
  ]);
}

/** 紅白幕: 朱と白の縦縞に布のひだの陰、上に紫の水引幕と金の房 */
function curtainArt(C, defs) {
  const x0 = -M, x1 = W + M, top = 22, STRIPE = 68;
  const hem = (y, amp) => {
    let d = "";
    for (let x = x1; x >= x0; x -= 34) d += ` L ${x} ${(y + Math.sin((x / 136) * Math.PI * 2) * amp).toFixed(1)}`;
    return d;
  };
  const clipId = uid("gg-clip");
  defs.append(svg("clipPath", { id: clipId }, [svg("path", { d: `M ${x0} ${top} L ${x1} ${top}${hem(CURTAIN_Y, 5)} Z` })]));
  const stripes = [];
  for (let x = x0, i = 0; x < x1; x += STRIPE, i++) stripes.push(svg("rect", { x, y: top, width: STRIPE + 0.5, height: 100, fill: i % 2 ? C.white : C.red }));
  // ひだ: 縞より少し長い周期で暗い帯を重ねる
  const fold = grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 136, y2: 0, spreadMethod: "repeat" },
    [[0, C.shadow, 0.34], [0.22, C.shadow, 0.02], [0.5, "#ffffff", 0.1], [0.78, C.shadow, 0.04], [1, C.shadow, 0.34]]);
  const hang = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.shadow, 0.5], [0.45, C.shadow, 0.06], [1, C.shadow, 0.22]]);
  const cloth = svg("g", { "clip-path": `url(#${clipId})` }, [
    ...stripes,
    svg("rect", { x: x0, y: top, width: x1 - x0, height: 100, fill: fold }),
    svg("rect", { x: x0, y: top, width: x1 - x0, height: 100, fill: hang }),
  ]);
  // 裾の下に落ちる影（壁から少し離れて掛かっている）
  const drop = svg("rect", { x: x0, y: CURTAIN_Y - 6, width: x1 - x0, height: 70, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.shadow, 0.5], [1, C.shadow, 0]]) });
  // 水引幕（上の細い紫の帯）と金の房
  const gold = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.gold2], [0.5, C.gold1], [1, C.gold0]]);
  const swags = [], tassels = [];
  for (let x = x0 + 20; x < x1; x += 180) {
    swags.push(svg("path", { d: `M ${x} 24 Q ${x + 90} 58 ${x + 180} 24`, fill: "none", stroke: gold, "stroke-width": 3.2, "stroke-linecap": "round" }));
    tassels.push(svg("g", {}, [
      svg("circle", { cx: x, cy: 28, r: 6, fill: gold }),
      svg("path", { d: `M ${x - 6} 34 L ${x + 6} 34 L ${x + 4} 62 L ${x - 4} 62 Z`, fill: gold }),
      svg("line", { x1: x, y1: 36, x2: x, y2: 60, stroke: C.gold0, "stroke-width": 1, opacity: 0.6 }),
    ]));
  }
  const valance = svg("g", {}, [
    svg("rect", { x: x0, y: 0, width: x1 - x0, height: 26, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, mix(C.valance, C.shadow, 0.5)], [1, C.valance]]) }),
    svg("rect", { x: x0, y: 24, width: x1 - x0, height: 2.4, fill: gold }),
    ...swags, ...tassels,
  ]);
  return svg("g", {}, [drop, cloth, valance]);
}

/** 提灯（動かさない。舞台の絵は一度だけ描く）。光の輪（halo）は幕の後ろ、本体は幕の前に置くので別に返す */
function lanternArt(C, defs, x, y, s) {
  const body = grad(defs, "radialGradient", { cx: 0.5, cy: 0.46, r: 0.62 }, [[0, C.lampHi], [0.42, C.lamp1], [0.85, C.lamp2], [1, C.lamp3]]);
  const rx = 38 * s, ry = 44 * s;
  const ribs = [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72].map((k) => {
    const yy = y + ry * k, half = rx * Math.sqrt(1 - k * k);
    return svg("path", { d: `M ${x - half} ${yy} Q ${x} ${yy + 7 * s} ${x + half} ${yy}`, fill: "none", stroke: C.lamp3, "stroke-width": 1.1, opacity: 0.4 });
  });
  const cap = (cy) => svg("g", {}, [
    svg("rect", { x: x - 17 * s, y: cy - 5 * s, width: 34 * s, height: 10 * s, rx: 2, fill: "#190f17" }),
    svg("rect", { x: x - 17 * s, y: cy - 1 * s, width: 34 * s, height: 1.6, fill: C.gold1, opacity: 0.9 }),
  ]);
  const halo = svg("circle", { cx: x, cy: y, r: 190 * s, fill: grad(defs, "radialGradient", {}, [[0, C.lamp1, 0.5], [0.35, C.lamp2, 0.2], [1, C.lamp2, 0]]) });
  const lamp = svg("g", {}, [
    svg("line", { x1: x, y1: CURTAIN_Y - 8, x2: x, y2: y - ry - 4 * s, stroke: "#190f17", "stroke-width": 2 }),
    svg("ellipse", { cx: x, cy: y, rx, ry, fill: body }),
    ...ribs,
    // 上からの照り
    svg("ellipse", { cx: x - rx * 0.3, cy: y - ry * 0.34, rx: rx * 0.34, ry: ry * 0.4, fill: "#fff", opacity: 0.22 }),
    cap(y - ry), cap(y + ry),
    svg("line", { x1: x, y1: y + ry + 5 * s, x2: x, y2: y + ry + 22 * s, stroke: C.red, "stroke-width": 2.4 }),
    svg("path", { d: `M ${x - 5 * s} ${y + ry + 20 * s} L ${x + 5 * s} ${y + ry + 20 * s} L ${x + 3.5 * s} ${y + ry + 40 * s} L ${x - 3.5 * s} ${y + ry + 40 * s} Z`, fill: C.red }),
  ]);
  return { halo, lamp };
}

/** 景品の箱（リボン付き）。奥のカウンターに積んでおく。u×h の正面と、右上へ逃げる上面・右側面 */
function giftArt(defs, x, y, w, h, body, ribbon) {
  const dx = w * 0.16, dy = -w * 0.13; // 奥行きの逃げ
  const front = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, mix(body, "#ffffff", 0.16)], [1, mix(body, "#000000", 0.22)]]);
  const bx = x + w * 0.5;
  return svg("g", {}, [
    svg("ellipse", { cx: x + w * 0.56, cy: y + h + 3, rx: w * 0.62, ry: 9, fill: "#000", opacity: 0.35 }),
    svg("polygon", { points: pts([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]]), fill: mix(body, "#000000", 0.45) }),
    svg("polygon", { points: pts([[x, y], [x + dx, y + dy], [x + w + dx, y + dy], [x + w, y]]), fill: mix(body, "#ffffff", 0.3) }),
    svg("rect", { x, y, width: w, height: h, fill: front }),
    // リボン（正面の縦帯・上面へ続く帯・結び目）
    svg("rect", { x: bx - w * 0.07, y, width: w * 0.14, height: h, fill: ribbon }),
    svg("polygon", { points: pts([[bx - w * 0.07, y], [bx - w * 0.07 + dx, y + dy], [bx + w * 0.07 + dx, y + dy], [bx + w * 0.07, y]]), fill: mix(ribbon, "#ffffff", 0.25) }),
    svg("rect", { x, y: y + h * 0.46, width: w, height: h * 0.12, fill: ribbon, opacity: 0.92 }),
    svg("ellipse", { cx: bx - w * 0.13 + dx * 0.5, cy: y + dy * 0.5 - 5, rx: w * 0.15, ry: w * 0.085, fill: mix(ribbon, "#ffffff", 0.2), transform: `rotate(-20 ${bx - w * 0.13 + dx * 0.5} ${y + dy * 0.5 - 5})` }),
    svg("ellipse", { cx: bx + w * 0.15 + dx * 0.5, cy: y + dy * 0.5 - 5, rx: w * 0.15, ry: w * 0.085, fill: ribbon, transform: `rotate(18 ${bx + w * 0.15 + dx * 0.5} ${y + dy * 0.5 - 5})` }),
    svg("circle", { cx: bx + dx * 0.5, cy: y + dy * 0.5 - 3, r: w * 0.055, fill: mix(ribbon, "#000000", 0.2) }),
    svg("rect", { x, y, width: w, height: 2, fill: "#fff", opacity: 0.3 }),
  ]);
}

/** 舞台一式。back＝抽選器の後ろに敷く絵（別の SVG に入れる）、overlays＝手前に重ねる幕 */
export function stageArt(defs, { last = false } = {}) {
  const C = STAGE;
  const full = { x: -M, width: W + 2 * M };
  const wall = svg("rect", { ...full, height: 470, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, mix(C.wall0, C.wallLo, 0.35)], [0.55, C.wall0], [1, mix(C.wall0, C.wallLo, 0.55)]]) });
  // 七宝つなぎ（壁の地紋）
  const patId = uid("gg-pat");
  const ring = (cx, cy) => svg("circle", { cx, cy, r: 30, fill: "none", stroke: C.gold1, "stroke-width": 1.1 });
  defs.append(svg("pattern", { id: patId, width: 60, height: 60, patternUnits: "userSpaceOnUse" }, [ring(0, 0), ring(60, 0), ring(0, 60), ring(60, 60), ring(30, 30)]));
  const pattern = svg("rect", { ...full, y: 0, height: 470, fill: `url(#${patId})`, opacity: 0.085 });
  // 抽選器の後ろの明るみ（上からの灯りが壁に当たる）
  const glow = svg("ellipse", { cx: 600, cy: 300, rx: 560, ry: 330, fill: grad(defs, "radialGradient", {}, [[0, C.wallHi, 0.75], [0.55, C.wallHi, 0.22], [1, C.wallHi, 0]]) });
  const topLight = svg("ellipse", { cx: 600, cy: -60, rx: 420, ry: 720, fill: grad(defs, "radialGradient", {}, [[0, "#fff4dc", 0.2], [0.5, "#fff4dc", 0.07], [1, "#fff4dc", 0]]) });
  const lamps = [[52, 222, 1.05], [-104, 286, 0.9], [1016, 214, 0.9], [1196, 250, 1.1], [1362, 300, 0.9]].map(([x, y, s]) => lanternArt(C, defs, x, y, s));
  // 景品の箱（右奥）
  const gifts = svg("g", {}, [
    giftArt(defs, 1054, 372, 104, 86, "#5a3aa8", C.gold1),
    giftArt(defs, 1168, 392, 78, 66, C.white, C.red),
    giftArt(defs, 1078, 318, 62, 54, C.red, C.gold2),
    giftArt(defs, 1262, 366, 96, 92, "#1c1430", "#cfd3dc"),
  ]);
  // カウンター: 黒い漆の天板に灯りの映り込み、手前の縁に金の線
  const counterTop = svg("rect", { ...full, y: 452, height: 228, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.counter0], [0.5, mix(C.counter0, C.counter1, 0.6)], [1, C.counter1]]) });
  const seam = svg("rect", { ...full, y: 452, height: 26, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.shadow, 0.6], [1, C.shadow, 0]]) });
  const pool = svg("ellipse", { cx: 620, cy: 574, rx: 520, ry: 104, fill: grad(defs, "radialGradient", {}, [[0, "#ffe9c4", 0.24], [0.6, "#c9a8ff", 0.08], [1, "#c9a8ff", 0]]) });
  // 提灯と幕の映り込み（縦に伸びた淡い帯）
  const reflect = svg("g", { opacity: 0.5 }, [[52, C.lamp1], [1016, C.lamp1], [1196, C.lamp1]].map(([x, c]) =>
    svg("ellipse", { cx: x, cy: 500, rx: 46, ry: 60, fill: grad(defs, "radialGradient", {}, [[0, c, 0.3], [1, c, 0]]) })));
  const front = svg("rect", { ...full, y: 680, height: 40, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, mix(C.counter0, C.shadow, 0.3)], [1, C.counterEdge]]) });
  const inlay = svg("rect", { ...full, y: 676, height: 3, fill: grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: W, y2: 0 }, [[0, C.gold0], [0.3, C.gold1], [0.5, C.gold2], [0.7, C.gold1], [1, C.gold0]]) });
  const inlay2 = svg("rect", { ...full, y: 664, height: 1.2, fill: C.gold1, opacity: 0.45 });
  const back = svg("g", {}, [
    wall, pattern, glow, ...lamps.map((l) => l.halo), curtainArt(C, defs), ...lamps.map((l) => l.lamp),
    legendArt(C, defs, last), topLight, counterTop, seam, reflect, pool, gifts, front, inlay2, inlay,
  ]);
  // SVG の上に重ねる幕（合成だけで済むので軽い）: 溜めの暗がり・賞の色の染まり・周辺減光
  const dim = el("div.kj-dim", { "aria-hidden": "true" });
  const tint = el("div.kj-tint", { "aria-hidden": "true" });
  const vignette = el("div.kj-vignette", { "aria-hidden": "true" });
  return {
    back, overlays: [dim, tint, vignette],
    /** 全面を賞の色で染める（k: 0〜1） */
    mood(k, color) {
      tint.style.background = color;
      tint.style.opacity = (0.62 * k).toFixed(3);
    },
    /** 舞台を暗くする（k: 0〜1。溜めのあいだ） */
    dim(k) { dim.style.opacity = k.toFixed(3); },
  };
}
