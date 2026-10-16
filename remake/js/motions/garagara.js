// シーシャくじのガラガラ（新井式の回転抽選器）。商店街の福引きの台のように、漆塗りの六角の胴を斜め前から見せ、
// 側面の厚みは回転に合わせて毎フレーム立体として計算し直す。ハンドルを一度引いてから回し、中の玉が鳴る。
// 止まったら胴を少し送って穴を下へ向け、玉が出る。樋を転がって受け皿へ落ち、弾んで止まる。
// 玉の色が賞を表す（S＝金・A＝赤・B＝青・C＝白・ラストワン＝黒地に銀の輪）。終わると kuji.js が賞のカードを出す。
// 見た目は「本物の福引きの台」に寄せる: 落ち着いた壁とカウンター、柔らかい部屋の灯り、使い込んだ塗りと真鍮。
// 当たりの光や紙吹雪は使わず、上位は係の人が手持ちの鐘を振って知らせる。下の賞は静かに止まるだけ。
// 台と背景の配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。玉の色は意味を持つので配色によらず固定。
// 道具はすべて同じ斜めの見下ろし（正射影）で描き、動きは1本の requestAnimationFrame で時刻から決める。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { svg, stageSvg, reducedMotion, W, H } from "../core/transition-kit.js";
import { pick } from "../core/mg-kit.js";

export const BALL = { S: "#f2c14a", A: "#d9453f", B: "#3b78d8", C: "#f2efe8", LAST: "#25223f" };
const BALL_EDGE = { S: "#8a5a10", A: "#701a1a", B: "#1a3f80", C: "#a39b8e", LAST: "#07060e" };
const BALL_HI = { S: "#fbe7a8", A: "#f2a092", B: "#a9c8f2", C: "#ffffff", LAST: "#77789a" };
const LAST_RING = "#cfd3dc"; // ラストワンの玉の銀の輪

// 壁・カウンター・朱の塗りと古い真鍮（free）／紫の濃淡（mono）。緑は使わない
const FREE = {
  wallHi: "#a6896b", wall0: "#7a6350", wallLo: "#4d3c2f", shadow: "#1e130c",
  paper: "#efe8d8", ink: "#2b211c", red: "#a8382c",
  lacD: "#3a110d", lacL: "#a43b2d", spec: "#f0dccb", face: "#221511", faceHi: "#4b3228",
  brass0: "#5a4423", brass1: "#a3864e", brass2: "#d4bf92",
  stand0: "#24170f", stand1: "#4d3221", grip0: "#4f2d16", grip1: "#a5764a",
  counter0: "#3f2818", counter1: "#6d4a2e", grain: "#2c1b10", edge: "#8b6b45", felt0: "#27110e", felt1: "#46211c",
};
const MONO_SET = {
  wallHi: "#7d6eaa", wall0: "#5b4d86", wallLo: "#3b3060", shadow: "#120d22",
  paper: "#ebe5f6", ink: "#1e1838", red: "#6b4fb0",
  lacD: "#1f1640", lacL: "#7562b8", spec: "#eee9ff", face: "#150f27", faceHi: "#3a2f66",
  brass0: "#3f3370", brass1: "#9a8ad0", brass2: "#d6cdf0",
  stand0: "#130e25", stand1: "#2f2657", grip0: "#34286b", grip1: "#8b78c8",
  counter0: "#231b41", counter1: "#3c3267", grain: "#18122e", edge: "#8576c0", felt0: "#160f2b", felt1: "#2b2251",
};

// 立体の置き方。胴の中心・外接半径・奥行き、斜めに見る角度（左へ振って少し上から）
const CX = 500, CY = 282, R = 150, L = 170;
const DEG = Math.PI / 180;
const YAW = -26 * DEG, PITCH = 18 * DEG;
const FRONT = L / 2, BACK = -L / 2;
const SFRAME = FRONT + 16; // 手前の台枠
const CRANK = FRONT + 44; // ハンドルの腕
const FLOOR = -225; // 台の上面（胴の中心から下へ）
const COUNTER = 249; // カウンターの面（胴の中心から下へ）
const HW = 8; // 側面の穴の奥行きの位置
// 道具一式を少し大きく見せる（カウンターの上の一点を中心に）
const ZOOM = 1.08, ZX = CX, ZY = 560;

// 時刻（ms）。登場 → ためて引く → 1.6回転 → 止まる → 少し送って穴を下へ → 玉が出る → 樋 → 受け皿 → 止まる → カードへ
const T = {
  ant: 280, spin: 560, stop: 1900, tilt: 1990, pop: 2230, out: 2330, drop: 2440, fly: 2820, land: 2940,
  rest: 3560, accent: 3460, fade: 4080, end: 4420,
};
const TURN = 576; // 回す角度（1.6回転）
const PULL = 22; // ハンドルを引く角度
const TILT = 8; // 止まってから穴を下へ向ける角度（穴が見えなくならない程度に）
const BALL_R = 15;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
const outCubic = (k) => 1 - (1 - k) ** 3;
const outQuart = (k) => 1 - (1 - k) ** 4;
const inOutSine = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
const seg = (t, a, b) => clamp((t - a) / (b - a));

/** 胴の座標（u 右・v 上・w 手前）を見る向きへ回す */
function view(x, y, z) {
  const x1 = x * Math.cos(YAW) + z * Math.sin(YAW), z1 = -x * Math.sin(YAW) + z * Math.cos(YAW);
  return [x1, y * Math.cos(PITCH) - z1 * Math.sin(PITCH), y * Math.sin(PITCH) + z1 * Math.cos(PITCH)];
}
/** 面の座標（u 右・s 下・w 手前）→ 画面 */
const P = (u, s, w) => { const [x, y] = view(u, -s, w); return [CX + x, CY - y]; };
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
/** 奥行き w の面（胴の正面と平行）を画面へ写す行列（SVG の matrix） */
function plane(w) {
  const o = P(0, 0, w), a = P(1, 0, w), b = P(0, 1, w);
  return `matrix(${a[0] - o[0]} ${a[1] - o[1]} ${b[0] - o[0]} ${b[1] - o[1]} ${o[0]} ${o[1]})`;
}
/** 高さ s の水平面（x＝u・y＝w）を画面へ写す行列 */
function hplane(s) {
  const o = P(0, s, 0), a = P(1, s, 0), b = P(0, s, 1);
  return `matrix(${a[0] - o[0]} ${a[1] - o[1]} ${b[0] - o[0]} ${b[1] - o[1]} ${o[0]} ${o[1]})`;
}
/** 水平な円（中心 u,w・半径 r・高さ s）の画面の点列 */
const hcircle = (u, w, r, s, n = 48) => [...Array(n)].map((_, i) => P(u + r * Math.cos((i / n) * Math.PI * 2), s, w + r * Math.sin((i / n) * Math.PI * 2)));
const norm = ([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const LIGHT = norm([0.18, 0.85, 0.5]);
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const SPEC_MAX = (() => { const u = view(1, 0, 0), v = view(0, 1, 0); return Math.hypot(u[0] * HALF[0] + u[1] * HALF[1] + u[2] * HALF[2], v[0] * HALF[0] + v[1] * HALF[1] + v[2] * HALF[2]); })();

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(",")})`;
}
const mixRgb = (rgb, b, k) => {
  const A = rgb.match(/\d+/g).map(Number), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(",")})`;
};

let serial = 0;
/** グラデーションの定義を作り、url(#id) を返す */
function grad(defs, kind, attrs, stops) {
  const id = `gg-${++serial}`;
  defs.append(svg(kind, { id, ...attrs }, stops.map(([o, c, a = 1]) => svg("stop", { offset: o, "stop-color": c, "stop-opacity": a }))));
  return `url(#${id})`;
}
const line = (a, b, attrs) => svg("line", { x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1), ...attrs });

// 壁やカウンターの細かなざらつき（一度だけ作る小さな画像を敷き詰める）
let grainUrl = "";
function grainTexture() {
  if (grainUrl) return grainUrl;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const g = c.getContext("2d");
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.random() * 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainUrl = c.toDataURL();
  } catch { grainUrl = ""; }
  return grainUrl;
}

/** 壁に貼った手書きの案内（賞と玉の色）。last はラストワン賞の貼り紙 */
function posterArt(C, defs, last) {
  const x = 92, y = 66, w = 168, h = 226;
  const font = { "font-family": "Suien Gothic, sans-serif", "font-weight": 700, fill: C.ink, "text-anchor": "middle" };
  const dot = (cx, cy, k, r = 9) => svg("g", {}, [
    svg("circle", { cx, cy, r, fill: BALL[k], stroke: BALL_EDGE[k], "stroke-width": 1.2 }),
    ...(k === "LAST" ? [svg("path", { d: `M ${cx - r} ${cy} A ${r} ${r * 0.32} 0 0 0 ${cx + r} ${cy}`, fill: "none", stroke: LAST_RING, "stroke-width": 1.4, transform: `rotate(-16 ${cx} ${cy})` })] : []),
  ]);
  const body = last ? [
    svg("rect", { x: 9, y: 9, width: w - 18, height: h - 18, fill: "none", stroke: C.red, "stroke-width": 2.2 }),
    svg("text", { ...font, x: w / 2, y: 48, "font-size": 21 }, []),
    dot(w / 2, 104, "LAST", 22),
    svg("text", { ...font, x: w / 2, y: 160, "font-size": 15, "font-weight": 500 }),
    svg("text", { ...font, x: w / 2, y: 182, "font-size": 15, "font-weight": 500 }),
  ] : [
    svg("text", { ...font, x: w / 2, y: 38, "font-size": 19 }),
    line([18, 50], [w - 18, 50], { stroke: C.ink, "stroke-width": 1.2, opacity: 0.6 }),
    ...["S", "A", "B", "C"].flatMap((k, i) => [dot(48, 78 + i * 34, k), svg("text", { ...font, x: 98, y: 84 + i * 34, "font-size": 17 })]),
    svg("text", { ...font, x: w / 2, y: 210, "font-size": 12, fill: C.red }),
  ];
  const words = last ? ["ラストワン賞", "最後の1枚を", "引いた方へ"] : ["シーシャくじ", "S賞", "A賞", "B賞", "C賞", "ラストワン賞あり"];
  body.filter((n) => n.tagName === "text").forEach((n, i) => { n.textContent = words[i] || ""; });
  const paper = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0.3, y2: 1 }, [[0, C.paper], [1, mix(C.paper, C.ink, 0.1)]]);
  const tape = (tx, rot) => svg("rect", { x: tx - 18, y: -7, width: 36, height: 14, fill: C.paper, opacity: 0.55, transform: `rotate(${rot} ${tx} 0)` });
  return svg("g", { transform: `translate(${x} ${y}) rotate(${last ? 1.2 : -1.4})` }, [
    // 紙の影（壁から少し浮いている）
    svg("rect", { x: 3, y: 5, width: w, height: h, fill: C.shadow, opacity: 0.22 }),
    svg("rect", { width: w, height: h, fill: paper }),
    ...body,
    tape(18, -24), tape(w - 18, 20),
  ]);
}

/** 背景: 柔らかい灯りの壁、貼り紙、木のカウンター、ざらつき、弱い周辺減光 */
function setArt(C, defs, last) {
  const wall = svg("rect", { width: W, height: 460, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.wall0], [0.75, mix(C.wall0, C.wallLo, 0.4)], [1, C.wallLo]]) });
  // 左上の窓からのような広い明るみ
  const light = svg("rect", { width: W, height: 460, fill: grad(defs, "radialGradient", { cx: 0.3, cy: 0.05, r: 0.8 }, [[0, C.wallHi, 0.75], [1, C.wallHi, 0]]) });
  // 台が壁に落とす、ぼんやりした影
  const cast = svg("ellipse", { cx: CX + 90, cy: CY + 60, rx: 300, ry: 230, fill: grad(defs, "radialGradient", {}, [[0, C.shadow, 0.28], [1, C.shadow, 0]]) });
  const counterTop = svg("polygon", { points: pts([[0, 452], [W, 452], [W, 680], [0, 680]]), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.counter0], [1, C.counter1]]) });
  // 壁とカウンターの境の陰
  const seam = svg("rect", { x: 0, y: 452, width: W, height: 22, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.shadow, 0.45], [1, C.shadow, 0]]) });
  const grain = svg("g", { stroke: C.grain, "stroke-width": 1.1, fill: "none", opacity: 0.4 }, [468, 489, 517, 553, 597, 641].map((y, i) => svg("path", { d: `M 0 ${y} C 320 ${y - 4 + i}, 760 ${y + 5}, ${W} ${y - 2}` })));
  const front = svg("rect", { x: 0, y: 680, width: W, height: 40, fill: mix(C.counter0, C.shadow, 0.4) });
  const lip = svg("rect", { x: 0, y: 678, width: W, height: 3, fill: C.edge, opacity: 0.45 });
  const kids = [wall, light, cast, posterArt(C, defs, last), counterTop, seam, grain, front, lip];
  const tex = grainTexture();
  if (tex) {
    const patId = `gg-grain-${++serial}`;
    defs.append(svg("pattern", { id: patId, width: 160, height: 160, patternUnits: "userSpaceOnUse" }, [svg("image", { href: tex, width: 160, height: 160 })]));
    kids.push(svg("rect", { width: W, height: H, fill: `url(#${patId})`, opacity: 0.07, style: "mix-blend-mode: overlay" }));
  }
  const vignette = svg("rect", { width: W, height: H, fill: grad(defs, "radialGradient", { cx: 0.5, cy: 0.45, r: 0.75 }, [[0.6, C.shadow, 0], [1, C.shadow, 0.5]]) });
  return { back: svg("g", {}, kids), vignette };
}

/** 台: 黒漆の土台と、胴の前後で軸を受ける A 字の脚 */
function frameLeg(C, defs, w, side) {
  // 軸受け（胴の中心）から床まで、左右に開く角材。正面と右の側面を描く
  const top = [side * 12, 0], foot = [side * 112, -FLOOR];
  const wd = 9, dp = 14;
  const f = [P(top[0] - wd, top[1], w), P(top[0] + wd, top[1], w), P(foot[0] + wd, foot[1], w), P(foot[0] - wd, foot[1], w)];
  const sideFace = [P(top[0] + wd, top[1], w), P(top[0] + wd, top[1], w - dp), P(foot[0] + wd, foot[1], w - dp), P(foot[0] + wd, foot[1], w)];
  return [
    svg("polygon", { points: pts(sideFace), fill: C.stand0 }),
    svg("polygon", { points: pts(f), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.stand0], [0.5, C.stand1], [1, C.stand0]]) }),
    // 角の面取りに映る細い光
    line(P(top[0] - wd + 2, top[1] + 14, w), P(foot[0] - wd + 2, foot[1] - 4, w), { stroke: C.stand1, "stroke-width": 1.2, opacity: 0.6 }),
  ];
}
function standArt(C, defs) {
  const x0 = -165, x1 = 165, z0 = -128, z1 = 128, y0 = FLOOR, y1 = -COUNTER;
  const Q = (u, v, w) => P(u, -v, w);
  const topFace = [Q(x0, y0, z0), Q(x1, y0, z0), Q(x1, y0, z1), Q(x0, y0, z1)];
  const frontFace = [Q(x0, y0, z1), Q(x1, y0, z1), Q(x1, y1, z1), Q(x0, y1, z1)];
  const rightFace = [Q(x1, y0, z1), Q(x1, y0, z0), Q(x1, y1, z0), Q(x1, y1, z1)];
  // 接地の影（濃い芯と広い薄影）
  const contact = svg("g", { transform: hplane(COUNTER) }, [
    svg("rect", { x: x0 - 40, y: z0 - 30, width: x1 - x0 + 80, height: z1 - z0 + 60, rx: 80, fill: grad(defs, "radialGradient", {}, [[0.45, C.shadow, 0.4], [1, C.shadow, 0]]) }),
    svg("rect", { x: x0 - 4, y: z0 - 2, width: x1 - x0 + 8, height: z1 - z0 + 6, rx: 6, fill: C.shadow, opacity: 0.5 }),
  ]);
  const base = svg("g", {}, [
    contact,
    svg("polygon", { points: pts(rightFace), fill: C.stand0 }),
    svg("polygon", { points: pts(frontFace), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.stand0], [0.6, C.stand1], [1, C.stand0]]) }),
    svg("polygon", { points: pts(topFace), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, C.stand1], [1, C.stand0]]) }),
    // 胴の下にたまる陰（環境光の遮り）
    svg("ellipse", { cx: 0, cy: 0, rx: 130, ry: 70, transform: `${hplane(-FLOOR)}`, fill: grad(defs, "radialGradient", {}, [[0, C.shadow, 0.4], [1, C.shadow, 0]]) }),
    // 角は使い込まれて少し明るく擦れている
    svg("polyline", { points: pts([Q(x0, y0, z1), Q(x1, y0, z1), Q(x1, y0, z0)]), fill: "none", stroke: mix(C.stand1, C.brass1, 0.35), "stroke-width": 2 }),
    svg("polyline", { points: pts([Q(x0, y1 + 3, z1), Q(x1, y1 + 3, z1), Q(x1, y1 + 3, z0)]), fill: "none", stroke: C.brass0, "stroke-width": 1.4, opacity: 0.8 }),
  ]);
  const back = svg("g", {}, [...frameLeg(C, defs, BACK - 16, -1), ...frameLeg(C, defs, BACK - 16, 1)]);
  const frontLegs = svg("g", {}, [...frameLeg(C, defs, SFRAME, -1), ...frameLeg(C, defs, SFRAME, 1),
    // 脚をつなぐ貫と、軸受けの金具
    svg("polygon", { points: pts([P(-72, 170, SFRAME), P(72, 170, SFRAME), P(74, 184, SFRAME), P(-74, 184, SFRAME)]), fill: C.stand1 }),
    line(P(-72, 170, SFRAME), P(72, 170, SFRAME), { stroke: mix(C.stand1, C.brass1, 0.3), "stroke-width": 1.4, opacity: 0.8 }),
  ]);
  return { base, back, frontLegs };
}

// 板ごとの塗りのわずかな差と、擦れの長さ（毎回同じ）
const PANEL_TINT = [0.02, -0.03, 0.01, -0.015, 0.03, -0.02];
const PANEL_WEAR = [0.5, 0.22, 0.7, 0.35, 0.15, 0.58];

/** 胴の側面（6枚）と縁金具・穴、正面（回る面）、ハンドル */
function drumArt(C, defs) {
  const panels = [...Array(6)].map(() => svg("polygon", { "stroke-linejoin": "round" }));
  const shade = [...Array(6)].map(() => svg("polygon", { fill: "" }));
  const gloss = [...Array(6)].map(() => svg("polygon", { opacity: 0 }));
  // 手前の縁の擦れ（朱が薄れて下地の黒がのぞく、根来塗のような使い込み）
  const wear = [...Array(6)].map(() => svg("line", { stroke: C.lacD, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.35 }));
  const corners = [...Array(6)].map(() => svg("line", { stroke: C.brass1, "stroke-width": 4.5, "stroke-linecap": "round" }));
  const rims = [...Array(6)].map(() => svg("line", { stroke: C.brass0, "stroke-width": 3.5, "stroke-linecap": "round" }));
  const holeRing = svg("polygon", { fill: C.brass1, stroke: C.brass0, "stroke-width": 1.5 });
  const hole = svg("polygon", { fill: "#050202" });
  const holeLip = svg("polyline", { fill: "none", stroke: C.brass2, "stroke-width": 1.4, opacity: 0.5 });
  // 側面の奥ほど暗く（手前の縁から奥の縁へ）
  const f0 = P(0, 0, FRONT), b0 = P(0, 0, BACK);
  const depth = grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: f0[0], y1: f0[1], x2: b0[0] + (b0[0] - f0[0]) * 0.4, y2: b0[1] + (b0[1] - f0[1]) * 0.4 }, [[0, C.shadow, 0], [1, C.shadow, 0.45]]);
  shade.forEach((s) => s.setAttribute("fill", depth));
  // 塗りの柔らかい照り（手前から奥へ広くなだらかに）
  const glossFill = grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: f0[0], y1: f0[1], x2: b0[0], y2: b0[1] }, [[0, C.spec, 0.15], [0.4, C.spec, 0.35], [1, C.spec, 0]]);
  gloss.forEach((g) => g.setAttribute("fill", glossFill));
  const band = svg("g", {}, [...panels, ...shade, ...gloss, ...wear, ...rims, ...corners, holeRing, hole, holeLip]);

  // 正面（黒漆の面）。rot の中は胴と一緒に回る
  const hexPts = (r, a0 = 0) => [...Array(6)].map((_, i) => [r * Math.cos((a0 + i * 60) * DEG), r * Math.sin((a0 + i * 60) * DEG)]);
  const brass = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, mix(C.brass1, C.brass2, 0.5)], [0.5, C.brass1], [1, C.brass0]]);
  const boss = grad(defs, "radialGradient", { cx: 0.4, cy: 0.36, r: 0.8 }, [[0, mix(C.brass1, C.brass2, 0.6)], [0.6, C.brass1], [1, C.brass0]]);
  const kites = hexPts(R).map(([x, y], i, all) => {
    const prev = all[(i + 5) % 6], next = all[(i + 1) % 6];
    const d = (p) => { const dx = p[0] - x, dy = p[1] - y, l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
    const a = d(prev), b = d(next);
    return svg("g", {}, [
      svg("polygon", { points: pts([[x, y], [x + a[0] * 30, y + a[1] * 30], [x * 0.8, y * 0.8], [x + b[0] * 30, y + b[1] * 30]]), fill: brass, stroke: C.brass0, "stroke-width": 1.2 }),
      svg("circle", { cx: x * 0.9, cy: y * 0.9, r: 2.6, fill: C.brass0 }),
    ]);
  });
  // 面の中の板目（黒漆の下にうっすら見える木目）
  const grainLines = [-96, -70, -40, -12, 18, 46, 74, 100].map((y, i) => svg("path", { d: `M -150 ${y} C -60 ${y - 6 + (i % 3) * 4}, 40 ${y + 7}, 150 ${y - 3}`, fill: "none", stroke: C.faceHi, "stroke-width": 1, opacity: 0.35 }));
  const faceClip = `gg-clip-${++serial}`;
  defs.append(svg("clipPath", { id: faceClip }, [svg("polygon", { points: pts(hexPts(R - 8)) })]));
  const rot = svg("g", {}, [
    svg("polygon", { points: pts(hexPts(R)), fill: C.face }),
    // 軸のまわりの菊座（真鍮の細い花弁）
    ...[...Array(16)].map((_, i) => svg("ellipse", { cx: 0, cy: -27, rx: 4.2, ry: 10, fill: "none", stroke: C.brass1, "stroke-width": 1, opacity: 0.35, transform: `rotate(${i * 22.5})` })),
    svg("g", { "clip-path": `url(#${faceClip})` }, grainLines),
    svg("polygon", { points: pts(hexPts(R * 0.8)), fill: "none", stroke: C.brass1, "stroke-width": 1.4, opacity: 0.75 }),
    svg("polygon", { points: pts(hexPts(R * 0.74)), fill: "none", stroke: C.brass1, "stroke-width": 0.8, opacity: 0.45 }),
    // 金の細い放射と輪（蒔絵のような線）
    ...hexPts(R * 0.74).map(([x, y]) => svg("line", { x1: x * 0.36, y1: y * 0.36, x2: x, y2: y, stroke: C.brass1, "stroke-width": 1, opacity: 0.4 })),
    svg("circle", { r: R * 0.27, fill: "none", stroke: C.brass1, "stroke-width": 1.2, opacity: 0.55 }),
    svg("polygon", { points: pts(hexPts(R - 4)), fill: "none", stroke: C.brass1, "stroke-width": 8, "stroke-linejoin": "round" }),
    svg("polygon", { points: pts(hexPts(R - 9)), fill: "none", stroke: C.brass0, "stroke-width": 1.5, "stroke-linejoin": "round" }),
    ...kites,
    svg("circle", { r: 34, fill: "none", stroke: C.brass1, "stroke-width": 1.2, opacity: 0.6 }),
  ]);
  // 回らない光沢（上からの光が面に映る）
  const sheenClip = `gg-clip-${++serial}`;
  const sheenPoly = svg("polygon");
  defs.append(svg("clipPath", { id: sheenClip }, [sheenPoly]));
  const sheen = svg("g", { "clip-path": `url(#${sheenClip})` }, [
    svg("rect", { x: -R, y: -R, width: R * 2, height: R * 2, fill: grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: -R, y1: -R, x2: R * 0.6, y2: R }, [[0, C.faceHi, 0.55], [0.5, C.faceHi, 0.08], [1, C.shadow, 0.3]]) }),
  ]);
  const face = svg("g", { transform: plane(FRONT) }, [rot, sheen]);
  // 軸と真鍮の軸頭（手前の台枠の外）
  const cap = svg("g", { transform: plane(SFRAME + 4) }, [
    svg("circle", { r: 26, fill: C.stand0 }),
    svg("circle", { r: 21, fill: boss, stroke: C.brass0, "stroke-width": 1.5 }),
    svg("circle", { r: 12, fill: "none", stroke: C.brass0, "stroke-width": 1, opacity: 0.6 }),
    svg("circle", { cx: -5, cy: -6, r: 8, fill: C.brass2, opacity: 0.25 }),
  ]);
  // ハンドル: 真鍮の腕と木の握り（握りは軸と平行に手前へ伸びる）
  const ARM = { len: 98, a: -128 };
  const arm = svg("g", {}, [
    svg("line", { x1: 0, y1: 0, x2: ARM.len, y2: 0, stroke: C.brass0, "stroke-width": 15, "stroke-linecap": "round" }),
    svg("line", { x1: 0, y1: -1, x2: ARM.len, y2: -1, stroke: C.brass1, "stroke-width": 10, "stroke-linecap": "round" }),
    svg("line", { x1: 6, y1: -3, x2: ARM.len - 6, y2: -3, stroke: C.brass2, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.4 }),
    svg("circle", { r: 15, fill: boss, stroke: C.brass0, "stroke-width": 1.5 }),
  ]);
  const armRot = svg("g", {}, [arm]);
  const crank = svg("g", { transform: plane(CRANK) }, [armRot]);
  const gripShadow = svg("line", { stroke: C.shadow, "stroke-width": 27, "stroke-linecap": "round", opacity: 0.4, transform: "translate(3 4)" });
  const gripBody = svg("line", { stroke: C.grip0, "stroke-width": 23, "stroke-linecap": "round" });
  const gripMid = svg("line", { stroke: C.grip1, "stroke-width": 11, "stroke-linecap": "round", opacity: 0.85, transform: "translate(-1 -2)" });
  const gripHi = svg("line", { stroke: C.grip1, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.5, transform: "translate(-3 -6)" });
  const gripEnd = svg("ellipse", { fill: C.grip1, stroke: C.grip0, "stroke-width": 2, rx: 10, ry: 12 });
  const grip = svg("g", {}, [gripShadow, gripBody, gripMid, gripHi, gripEnd]);

  return {
    back: band, face, cap, crank, grip,
    /** 角度 th（度）で描き直す */
    pose(th) {
      const vtx = (i, w) => P(R * Math.cos((th + i * 60) * DEG), R * Math.sin((th + i * 60) * DEG), w);
      const seen = [];
      for (let k = 0; k < 6; k++) {
        const b = (th + 30 + k * 60) * DEG;
        const n = view(Math.cos(b), -Math.sin(b), 0);
        const vis = n[2] > 0.015;
        seen[k] = vis;
        panels[k].style.display = shade[k].style.display = gloss[k].style.display = rims[k].style.display = wear[k].style.display = vis ? "" : "none";
        if (!vis) continue;
        const q = pts([vtx(k, FRONT), vtx(k + 1, FRONT), vtx(k + 1, BACK), vtx(k, BACK)]);
        const lam = clamp(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        // 照りは鋭い点ではなく広くぼんやり。板ごとに塗りの色がわずかに違う
        const sp = clamp((n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]) / SPEC_MAX) ** 5;
        const base = mix(C.lacD, C.lacL, 0.2 + lam * 0.74 + PANEL_TINT[k]);
        panels[k].setAttribute("points", q);
        panels[k].setAttribute("fill", mixRgb(base, C.spec, sp * 0.18));
        shade[k].setAttribute("points", q);
        gloss[k].setAttribute("points", q);
        gloss[k].setAttribute("opacity", (0.03 + 0.1 * lam ** 2).toFixed(3));
        // 擦れ: 手前の縁から少し奥に入ったところ
        const [e1, e2] = [vtx(k, FRONT - 7), vtx(k + 1, FRONT - 7)];
        const [m1, m2] = [[lerp(e1[0], e2[0], 0.12), lerp(e1[1], e2[1], 0.12)], [lerp(e1[0], e2[0], 0.12 + PANEL_WEAR[k]), lerp(e1[1], e2[1], 0.12 + PANEL_WEAR[k])]];
        wear[k].setAttribute("x1", m1[0]); wear[k].setAttribute("y1", m1[1]); wear[k].setAttribute("x2", m2[0]); wear[k].setAttribute("y2", m2[1]);
        const [x1, y1] = vtx(k, BACK), [x2, y2] = vtx(k + 1, BACK);
        rims[k].setAttribute("x1", x1); rims[k].setAttribute("y1", y1); rims[k].setAttribute("x2", x2); rims[k].setAttribute("y2", y2);
      }
      for (let k = 0; k < 6; k++) {
        const vis = seen[k] || seen[(k + 5) % 6];
        corners[k].style.display = vis ? "" : "none";
        if (!vis) continue;
        const [x1, y1] = vtx(k, FRONT), [x2, y2] = vtx(k, BACK);
        corners[k].setAttribute("x1", x1); corners[k].setAttribute("y1", y1); corners[k].setAttribute("x2", x2); corners[k].setAttribute("y2", y2);
      }
      // 側面の穴（0番の面の中央）
      const hb = (th + 30) * DEG, ap = R * Math.cos(30 * DEG);
      const hole3 = (rr) => [...Array(18)].map((_, i) => {
        const s = (i / 18) * Math.PI * 2;
        const t = rr * Math.cos(s);
        return P(ap * Math.cos(hb) - t * Math.sin(hb), ap * Math.sin(hb) + t * Math.cos(hb), HW + rr * Math.sin(s));
      });
      for (const n of [holeRing, hole, holeLip]) n.style.display = seen[0] ? "" : "none";
      if (seen[0]) {
        holeRing.setAttribute("points", pts(hole3(BALL_R + 9)));
        hole.setAttribute("points", pts(hole3(BALL_R + 3)));
        holeLip.setAttribute("points", pts(hole3(BALL_R + 3).slice(0, 10)));
      }
      rot.setAttribute("transform", `rotate(${th.toFixed(2)})`);
      sheenPoly.setAttribute("points", pts(hexPts(R - 8, th)));
      armRot.setAttribute("transform", `rotate(${(th + ARM.a).toFixed(2)})`);
      // 握り: 腕の先から手前へ
      const ga = (th + ARM.a) * DEG;
      const gx = ARM.len * Math.cos(ga), gy = ARM.len * Math.sin(ga);
      const p1 = P(gx, gy, CRANK + 2), p2 = P(gx, gy, CRANK + 70);
      for (const n of [gripShadow, gripBody, gripMid, gripHi]) { n.setAttribute("x1", p1[0]); n.setAttribute("y1", p1[1]); n.setAttribute("x2", p2[0]); n.setAttribute("y2", p2[1]); }
      gripEnd.setAttribute("cx", p2[0]); gripEnd.setAttribute("cy", p2[1]);
      gripEnd.setAttribute("transform", `rotate(-20 ${p2[0]} ${p2[1]})`);
    },
  };
}

/** 角度 th の側面の穴（胴の座標 u,s,w と外向き nu,ns） */
function holeAt(th) {
  const hb = (th + 30) * DEG, ap = R * Math.cos(30 * DEG);
  return { u: ap * Math.cos(hb), s: ap * Math.sin(hb), w: HW, nu: Math.cos(hb), ns: Math.sin(hb) };
}
// 玉の通り道（胴の座標）。穴の出口 → 樋の上端 → 樋の下端 → 受け皿
const HOLE = holeAt(TILT);
const EXIT = [HOLE.u + HOLE.nu * (BALL_R + 5), HOLE.s + HOLE.ns * (BALL_R + 5), HW];
const CH_A = [HOLE.u + 16, HOLE.s + 42, HW]; // 樋の底（上端）
const CH_B = [CH_A[0] + 136, CH_A[1] + 54, HW + 44]; // 樋の底（下端）
const DISH = { u: CH_B[0] + 100, w: CH_B[2] + 20, r: 74, ri: 63, rim: COUNTER - 13, floor: COUNTER - 6 };
const LAND = [DISH.u - 26, DISH.floor - BALL_R, DISH.w + 2];
const REST = [DISH.u + 4, DISH.floor - BALL_R, DISH.w + 16];
const zoomed = ([x, y]) => [ZX + (x - ZX) * ZOOM, ZY + (y - ZY) * ZOOM];

/** 樋: 黒漆の外側と真鍮の縁、内側は布張り。上端は台の上の支柱、下端は細い脚で受ける */
function chuteArt(C, defs) {
  const [au, as, aw] = CH_A, [bu, bs, bw] = CH_B;
  const len = Math.hypot(bu - au, bw - aw);
  const wu = -(bw - aw) / len, ww = (bu - au) / len; // 幅の向き（水平）
  const HALFW = 18, WALL = 19;
  const at = (k, side, up = 0) => P(lerp(au, bu, k) + wu * HALFW * side, lerp(as, bs, k) - up, lerp(aw, bw, k) + ww * HALFW * side);
  const floor = [at(0, -1), at(1, -1), at(1, 1), at(0, 1)];
  const backWall = [at(0, -1), at(1, -1), at(1, -1, WALL), at(0, -1, WALL)];
  const frontWall = [at(0, 1), at(1, 1), at(1, 1, WALL), at(0, 1, WALL)];
  const endWall = [at(0, -1), at(0, 1), at(0, 1, WALL), at(0, -1, WALL)];
  const under = [at(0, 1), at(1, 1), at(1, 1, -5), at(0, 1, -5)];
  const lacq = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.lacL], [0.25, mix(C.lacD, C.lacL, 0.55)], [1, C.lacD]]);
  const felt = grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: at(0.5, -1)[0], y1: at(0.5, -1)[1], x2: at(0.5, 1)[0], y2: at(0.5, 1)[1] }, [[0, C.felt0], [0.55, C.felt1], [1, C.felt0]]);
  // 支柱（真鍮の丸棒）: 台の上と、樋の下端からカウンターへ
  const post = (k, ground) => {
    const u = lerp(au, bu, k), s = lerp(as, bs, k) + 5, w = lerp(aw, bw, k);
    const top = P(u, s, w), bot = P(u, ground, w);
    return svg("g", {}, [
      svg("ellipse", { cx: u, cy: w, rx: 9, ry: 9, fill: C.shadow, opacity: 0.35, transform: hplane(ground) }),
      line(top, bot, { stroke: C.brass0, "stroke-width": 7, "stroke-linecap": "round" }),
      line([top[0] - 1.5, top[1]], [bot[0] - 1.5, bot[1]], { stroke: C.brass1, "stroke-width": 2.5, opacity: 0.6 }),
    ]);
  };
  const kBase = (150 - au) / (bu - au);
  // 台と床に落ちる樋の影
  const shadowPts = [[0, -1], [kBase, -1], [kBase, 1], [0, 1]].map(([k, sd]) => P(lerp(au, bu, k) + wu * HALFW * sd + 18, -FLOOR, lerp(aw, bw, k) + ww * HALFW * sd));
  const back = svg("g", {}, [
    svg("polygon", { points: pts(shadowPts), fill: C.shadow, opacity: 0.25 }),
    post(kBase, -FLOOR), post(0.96, COUNTER),
    svg("polygon", { points: pts(backWall), fill: mix(C.felt0, C.felt1, 0.3) }),
    svg("polygon", { points: pts(endWall), fill: C.felt0 }),
    svg("polygon", { points: pts(floor), fill: felt }),
    line(at(0, -1, WALL), at(1, -1, WALL), { stroke: C.brass1, "stroke-width": 3, "stroke-linecap": "round" }),
  ]);
  const front = svg("g", {}, [
    svg("polygon", { points: pts(under), fill: C.lacD }),
    svg("polygon", { points: pts(frontWall), fill: lacq }),
    line(at(0, 1, WALL), at(1, 1, WALL), { stroke: C.brass1, "stroke-width": 3, "stroke-linecap": "round" }),
    line(at(0, 1, -5), at(1, 1, -5), { stroke: C.brass0, "stroke-width": 1.4, opacity: 0.8 }),
    // 端の金具
    line(at(1, -1, WALL), at(1, 1, WALL), { stroke: C.brass1, "stroke-width": 3, "stroke-linecap": "round" }),
    line(at(1, 1, WALL), at(1, 1, -5), { stroke: C.brass1, "stroke-width": 3.4, "stroke-linecap": "round" }),
    line(at(0, 1, WALL), at(0, 1, -5), { stroke: C.brass1, "stroke-width": 3.4, "stroke-linecap": "round" }),
  ]);
  /** 樋の上の位置 k（0〜1）の底の点 */
  const floorAt = (k) => [lerp(au, bu, k), lerp(as, bs, k), lerp(aw, bw, k)];
  return { back, front, floorAt, dir: norm([bu - au, bs - as, bw - aw]), len: Math.hypot(bu - au, bs - as, bw - aw) };
}

/** 受け皿: 黒漆の浅い皿に真鍮の縁、内側は布張り */
function dishArt(C, defs) {
  const { u, w, r, ri, rim, floor } = DISH;
  const top = hcircle(u, w, r, rim), bot = hcircle(u, w, r, COUNTER);
  // 胴の側面: 上の縁の左端から右端まで、手前側の弧を上下でつなぐ
  let li = 0, ri2 = 0;
  top.forEach((p, i) => { if (p[0] < top[li][0]) li = i; if (p[0] > top[ri2][0]) ri2 = i; });
  const arc = (list, from, to) => { const out = []; for (let i = from; ; i = (i + 1) % list.length) { out.push(list[i]); if (i === to) break; } return out; };
  // 手前（画面の下）側の弧を選ぶ
  const a1 = arc(top, li, ri2), a2 = arc(top, ri2, li);
  const lowerIsA1 = a1.reduce((m, p) => m + p[1], 0) / a1.length > a2.reduce((m, p) => m + p[1], 0) / a2.length;
  const frontArc = lowerIsA1 ? a1 : a2;
  const dy = bot[0][1] - top[0][1];
  const wall = [...frontArc, ...frontArc.slice().reverse().map(([x, y]) => [x, y + dy])];
  const wallFill = grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: top[li][0], y1: 0, x2: top[ri2][0], y2: 0 }, [[0, C.lacD], [0.4, mix(C.lacD, C.lacL, 0.75)], [0.55, mix(C.lacL, C.spec, 0.1)], [0.8, mix(C.lacD, C.lacL, 0.5)], [1, C.lacD]]);
  const rimFill = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.brass0], [0.35, mix(C.brass1, C.brass2, 0.4)], [0.65, C.brass1], [1, C.brass0]]);
  const feltFill = grad(defs, "radialGradient", { cx: 0.5, cy: 0.42, r: 0.62 }, [[0, C.felt1], [0.75, mix(C.felt0, C.felt1, 0.5)], [1, C.felt0]]);
  const innerShade = grad(defs, "radialGradient", { cx: 0.5, cy: 0.62, r: 0.56 }, [[0.6, C.shadow, 0], [1, C.shadow, 0.55]]);
  const back = svg("g", {}, [
    svg("circle", { cx: u + 10, cy: w + 6, r: r + 18, fill: grad(defs, "radialGradient", {}, [[0.55, C.shadow, 0.4], [1, C.shadow, 0]]), transform: hplane(COUNTER) }),
    svg("polygon", { points: pts(wall), fill: wallFill }),
    svg("circle", { cx: u, cy: w, r, fill: rimFill, transform: hplane(rim) }),
    svg("circle", { cx: u, cy: w, r: r - 3, fill: C.brass0, transform: hplane(rim) }),
    svg("circle", { cx: u, cy: w, r: ri, fill: feltFill, transform: hplane(floor) }),
    svg("circle", { cx: u, cy: w, r: ri, fill: innerShade, transform: hplane(floor) }),
  ]);
  // 手前の縁（玉より手前に来る）
  const ring64 = hcircle(u, w, r - 1.5, rim, 64), cy = P(u, rim, w)[1];
  const startAt = ring64.findIndex((p, i) => p[1] > cy && ring64[(i + 63) % 64][1] <= cy);
  const frontRim = [];
  for (let i = startAt; ring64[i % 64][1] > cy - 1 && frontRim.length < 64; i++) frontRim.push(ring64[i % 64]);
  const front = svg("g", {}, [
    svg("polyline", { points: pts(frontRim), fill: "none", stroke: C.brass1, "stroke-width": 5, "stroke-linecap": "round" }),
    svg("polyline", { points: pts(frontRim.map(([x, y]) => [x, y - 1.6])), fill: "none", stroke: C.brass2, "stroke-width": 1.6, "stroke-linecap": "round", opacity: 0.45 }),
  ]);
  return { back, front };
}

/** 玉（塗りの球）。g は位置、body は弾むときの伸び縮み（下端を支点にする）。ラストワンは黒地に銀の輪 */
function ballArt(rank, defs, C) {
  const k = BALL[rank] ? rank : "C";
  const fill = grad(defs, "radialGradient", { cx: 0.38, cy: 0.34, r: 0.8 }, [[0, BALL_HI[k]], [0.4, BALL[k]], [0.9, BALL_EDGE[k]], [1, BALL_EDGE[k]]]);
  const body = svg("g", {}, [
    svg("circle", { r: BALL_R, fill }),
    ...(k === "LAST" ? [
      // 赤道の銀の輪（手前の半分だけ見える）
      svg("path", { d: `M ${-BALL_R} 0 A ${BALL_R} ${BALL_R * 0.34} 0 0 0 ${BALL_R} 0`, fill: "none", stroke: LAST_RING, "stroke-width": 1.6, transform: "rotate(-16)" }),
    ] : []),
    // 下の照り返しと、上の柔らかい映り込み
    svg("ellipse", { cx: 2, cy: 9, rx: 8, ry: 3.5, fill: "#fff", opacity: 0.1 }),
    svg("ellipse", { cx: -5, cy: -6, rx: 5.5, ry: 3.8, fill: "#fff", opacity: k === "LAST" ? 0.35 : 0.5, transform: "rotate(-35 -5 -6)" }),
  ]);
  const g = svg("g", { opacity: 0 }, [body]);
  const shadow = svg("ellipse", { rx: 13, ry: 13, fill: C.shadow, opacity: 0 });
  return { g, body, shadow, color: BALL[k] };
}

/** 係の人の手持ちの鐘（真鍮の鐘に木の柄）。柄の上は画面の外で、手首を支点に振る */
function bellArt(C, defs) {
  const wood = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.grip0], [0.35, C.grip1], [0.75, C.grip0], [1, mix(C.grip0, C.shadow, 0.5)]]);
  const metal = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, mix(C.brass0, C.shadow, 0.35)], [0.28, mix(C.brass1, C.brass2, 0.4)], [0.5, C.brass1], [0.82, C.brass0], [1, mix(C.brass0, C.shadow, 0.5)]]);
  const inside = grad(defs, "radialGradient", { cx: 0.5, cy: 0.2, r: 0.8 }, [[0, mix(C.brass0, C.shadow, 0.75)], [1, mix(C.brass0, C.shadow, 0.25)]]);
  const MY = 236; // 鐘の口の高さ
  const mouthClip = `gg-clip-${++serial}`;
  defs.append(svg("clipPath", { id: mouthClip }, [svg("ellipse", { cx: 0, cy: MY, rx: 52, ry: 10 })]));
  const clapper = svg("g", {}, [
    line([0, MY - 50], [0, MY - 4], { stroke: mix(C.brass0, C.shadow, 0.4), "stroke-width": 3 }),
    svg("circle", { cy: MY - 2, r: 7.5, fill: C.brass0 }),
  ]);
  const swing = svg("g", {}, [
    // 木の柄（ろくろ挽きの膨らみ）と真鍮の口金
    svg("path", { d: "M -8 0 L -8 96 C -12 112, -12 128, -8 140 L 8 140 C 12 128, 12 112, 8 96 L 8 0 Z", fill: wood }),
    svg("rect", { x: -11, y: 140, width: 22, height: 10, rx: 2, fill: metal }),
    // 鐘の胴
    svg("path", { d: `M -18 150 C -30 150, -32 160, -33 176 C -34 200, -40 220, -54 ${MY} L 54 ${MY} C 40 220, 34 200, 33 176 C 32 160, 30 150, 18 150 Z`, fill: metal }),
    // 口の近くの帯（打ち出しの段）
    svg("path", { d: `M -47 ${MY - 12} C -20 ${MY - 6}, 20 ${MY - 6}, 47 ${MY - 12}`, fill: "none", stroke: C.brass0, "stroke-width": 1.5, opacity: 0.7 }),
    // 口（少し下から見上げるので中がのぞく）と舌
    svg("ellipse", { cx: 0, cy: MY, rx: 54, ry: 11, fill: inside }),
    svg("g", { "clip-path": `url(#${mouthClip})` }, [clapper]),
    svg("ellipse", { cx: 0, cy: MY, rx: 54, ry: 11, fill: "none", stroke: mix(C.brass1, C.brass2, 0.3), "stroke-width": 2.5 }),
  ]);
  const g = svg("g", { opacity: 0 }, [swing]);
  return {
    g,
    /** 位置（手首）と傾き（度）、舌の振れ（度） */
    pose(x, y, ang, clap) {
      g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(2)}) scale(1.15)`);
      clapper.setAttribute("transform", `rotate(${clap.toFixed(2)} 0 ${MY - 50})`);
    },
  };
}

/** 回転の速さの山（立ち上がりは速く、止まり際は摩擦のように長く）。0〜1 の進み具合の表 */
const SPIN_TABLE = (() => {
  const n = 400, out = [0];
  let s = 0;
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const v = (k < 0.18 ? Math.sin((Math.PI / 2) * (k / 0.18)) ** 2 : 1) * (k < 0.36 ? 1 : (1 - (k - 0.36) / 0.64) ** 1.7);
    s += v; out.push(s);
  }
  return out.map((v) => v / s);
})();
const spinAt = (k) => { const f = clamp(k) * (SPIN_TABLE.length - 1), i = Math.floor(f); return i >= SPIN_TABLE.length - 1 ? 1 : lerp(SPIN_TABLE[i], SPIN_TABLE[i + 1], f - i); };

/** 時刻 t（ms）の胴の角度。ためて引く → 回す → 止まり際に揺れ戻る → 穴を下へ送る → 玉が抜けて小さく揺れる */
function angleAt(t) {
  const start = -TURN;
  if (t < T.ant) return start;
  if (t < T.spin) return start - PULL * inOutSine(seg(t, T.ant, T.spin));
  if (t < T.stop) return start - PULL + (TURN + PULL) * spinAt(seg(t, T.spin, T.stop));
  const d = t - T.stop;
  const settle = -6 * Math.exp(-d / 110) * Math.sin((2 * Math.PI * d) / 240);
  const tilt = TILT * inOutSine(seg(t, T.tilt, T.pop));
  const jolt = t > T.pop ? -2.2 * Math.exp(-(t - T.pop) / 120) * Math.sin((2 * Math.PI * (t - T.pop)) / 200) : 0;
  return settle + tilt + jolt;
}

// 鐘の出番の長さ（ms）。手で下ろす → 振る → 上げる
const BELL = { down: 280, ring: 700, up: 320 };
const BELL_X = 1010, BELL_Y = -66; // 手首の位置（柄の上は画面の外）

/**
 * host に全面の層を置いてガラガラを回し、rank の玉を出す。終わると層を外す。
 * onHandoff は消え始めに一度呼ぶ（くじのカードを下で開いて、重ねながら受け渡す）。
 * rank が "LAST"（ラストワン賞）のときは、貼り紙がラストワン賞に変わり、最初に係の人が鐘を鳴らしてから回す。
 * 動きを減らす設定では、止まった抽選器と受け皿の玉だけを短く見せる。
 */
export async function garagara(host, rank = "C", { onHandoff } = {}) {
  const C = pick(FREE, MONO_SET);
  const reduced = reducedMotion();
  const last = rank === "LAST";
  const top = rank === "S" || last;
  const OFF = last ? 760 : 0; // ラストワンは先に鐘を鳴らすぶん遅らせる
  const defs = svg("defs");
  const set = setArt(C, defs, last);
  const stand = standArt(C, defs);
  const drum = drumArt(C, defs);
  const chute = chuteArt(C, defs);
  const dish = dishArt(C, defs);
  const ball = ballArt(rank, defs, C);
  const bell = bellArt(C, defs);
  // 回る道具一式（登場で据わり、回すと震える）と、手前に来る樋の壁・皿の縁
  const rig = svg("g", {}, [stand.base, stand.back, drum.back, drum.face, chute.back, stand.frontLegs, drum.cap, drum.crank, drum.grip, dish.back]);
  const rigFront = svg("g", {}, [chute.front, dish.front]);
  const props = svg("g", { transform: `translate(${ZX} ${ZY}) scale(${ZOOM}) translate(${-ZX} ${-ZY})` }, [rig, ball.shadow, ball.g, rigFront]);
  const cam = svg("g", {}, [set.back, props]);
  cam.style.transformBox = "view-box";
  const art = stageSvg([defs, cam, bell.g, set.vignette]);
  const node = el("div.mo-garagara", { dataset: { motion: "garagara" } }, [art]);
  node.style.background = C.wallLo;
  if (!reduced) node.style.opacity = "0";
  host.append(node);
  const restXY = P(...REST);
  const place = ([u, s, w], sx = 1, sy = 1) => {
    const [x, y] = P(u, s, w);
    ball.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    // 伸び縮みは玉の下端を支点に
    ball.body.setAttribute("transform", `translate(0 ${(BALL_R * (1 - sy)).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
  };
  /** 影: 高さ gs の面に、玉の真下から（air は宙に浮いている高さの割合） */
  const shade = ([u, , w], gs, air = 0) => {
    ball.shadow.setAttribute("transform", hplane(gs));
    ball.shadow.setAttribute("cx", (u + 3).toFixed(1));
    ball.shadow.setAttribute("cy", (w + 2).toFixed(1));
    ball.shadow.setAttribute("rx", (12 * (1 + air * 0.5)).toFixed(1));
    ball.shadow.setAttribute("ry", (12 * (1 + air * 0.5)).toFixed(1));
    ball.shadow.setAttribute("opacity", (0.45 * (1 - clamp(air) * 0.75)).toFixed(2));
  };
  let raf = 0;
  try {
    if (reduced) {
      drum.pose(TILT);
      place(REST);
      ball.g.setAttribute("opacity", 1);
      shade(REST, DISH.floor);
      if (top) { bell.pose(BELL_X, BELL_Y, 0, 0); bell.g.setAttribute("opacity", 1); SE.just(); }
      await sleep(900);
      return;
    }
    // ここから先は時刻だけで決める（音は時刻を一度だけ越えたときに鳴らす）
    const fired = new Set();
    const once = (key, at, t, fn) => { if (t >= at && !fired.has(key)) { fired.add(key); fn(); } };
    let prevTh = angleAt(0), prevT = 0, om = 0, rattle = 0;
    // 樋は少しずつ速くなる。端から出るときの速さで皿へ飛ぶ
    const rollAt = (k) => 0.55 * k + 0.45 * k * k;
    const rollSpeed = (chute.len * 1.45) / ((T.fly - T.drop) / 1000); // 端での速さ（単位/秒）
    const flyS = (T.land - T.fly) / 1000;
    const hops = [
      { t0: T.land, t1: T.land + 170, h: 24 },
      { t0: T.land + 170, t1: T.land + 280, h: 9 },
      { t0: T.land + 280, t1: T.land + 340, h: 3 },
    ];
    const settle = hops[2].t1;
    const hopAt = (k) => [lerp(LAND[0], REST[0], k), LAND[1], lerp(LAND[2], REST[2], k)];
    const HOP_K = [0, 0.42, 0.62, 0.72]; // 弾みごとの進み具合（残りは転がって止まる）
    /** 時刻 t の玉の位置 {p:[u,s,w], sc 大きさ, g 影の面の高さ, air} */
    const ballAt = (t) => {
      if (t < T.pop) return null;
      if (t < T.out) { // 穴から押し出される
        const k = outCubic(seg(t, T.pop, T.out));
        return { p: [lerp(HOLE.u, EXIT[0], k), lerp(HOLE.s, EXIT[1], k), HW], sc: lerp(0.55, 1, k), g: null };
      }
      if (t < T.drop) { // 樋の上端へ落ちる
        const k = seg(t, T.out, T.drop);
        const [fu, fs, fw] = chute.floorAt(0.02);
        return { p: [lerp(EXIT[0], fu, k), lerp(EXIT[1], fs - BALL_R, k * k), lerp(HW, fw, k)], sc: 1, g: fs, gp: [fu, fs, fw], air: 1 - k * k };
      }
      if (t < T.fly) { // 樋を転がる
        const [u, s, w] = chute.floorAt(0.02 + 0.98 * rollAt(seg(t, T.drop, T.fly)));
        return { p: [u, s - BALL_R, w], sc: 1, g: s };
      }
      if (t < T.land) { // 樋の端から皿へ
        const k = seg(t, T.fly, T.land);
        const [u0, s0, w0] = chute.floorAt(1);
        const vs = chute.dir[1] * rollSpeed * flyS;
        const c = LAND[1] - (s0 - BALL_R) - vs;
        const u = lerp(u0, LAND[0], k), w = lerp(w0, LAND[2], k);
        const inDish = Math.hypot(u - DISH.u, w - DISH.w) < DISH.ri;
        return { p: [u, s0 - BALL_R + vs * k + c * k * k, w], sc: 1, g: inDish ? DISH.floor : COUNTER, air: 1 - k };
      }
      for (let i = 0; i < hops.length; i++) {
        const hp = hops[i];
        if (t < hp.t1) {
          const k = seg(t, hp.t0, hp.t1);
          const [u, s, w] = hopAt(lerp(HOP_K[i], HOP_K[i + 1], k));
          const up = hp.h * 4 * k * (1 - k);
          return { p: [u, s - up, w], sc: 1, g: DISH.floor, air: up / 50 };
        }
      }
      // 少し転がって止まる
      return { p: hopAt(lerp(HOP_K[3], 1, outQuart(seg(t, settle, T.rest)))), sc: 1, g: DISH.floor };
    };
    // 着地の潰れと戻り（強さは落ちた高さに比例）
    const impacts = [[T.land, 0.16], [hops[0].t1, 0.08], [hops[1].t1, 0.035], [T.drop, 0.06]];
    const squash = (t) => {
      let sx = 1, sy = 1;
      for (const [at, amp] of impacts) {
        const d = (t - at) / 1000;
        if (d < 0 || d > 0.22) continue;
        const v = amp * Math.exp(-d * 22) * Math.cos(d * 48);
        sy -= v; sx += v * 0.75;
      }
      return [sx, sy];
    };
    // 鐘を鳴らす時刻（ラストワンは最初にも）。上位の玉が受け皿に落ちたところで
    const rings = top ? [...(last ? [80] : []), OFF + T.land - 40] : [];
    const HZ = 5; // 振る速さ（往復/秒）
    /** 鐘の姿勢（出番でなければ null）。i は何回目か、t は全体の時刻 */
    const bellAt = (t) => {
      for (let i = 0; i < rings.length; i++) {
        const d = t - rings[i];
        const total = BELL.down + BELL.ring + BELL.up;
        if (d < 0 || d > total) continue;
        if (d < BELL.down) { // 手で下ろす（下ろし切る手前でゆるむ）
          const k = outCubic(d / BELL.down);
          return { i, x: BELL_X, y: lerp(BELL_Y - 300, BELL_Y, k), a: -7 * (1 - k), c: 0 };
        }
        const r = d - BELL.down;
        if (r < BELL.ring) { // 手首で振る。振り始めと終わりは小さく
          const s = r / 1000, ph = 2 * Math.PI * HZ * s;
          const env = clamp(r / 90) * (1 - 0.35 * (r / BELL.ring));
          return { i, x: BELL_X + 7 * Math.sin(ph + 0.5) * env, y: BELL_Y + 3 * Math.abs(Math.sin(ph)) * env, a: 19 * Math.sin(ph) * env, c: clamp(-16 * Math.sin(ph - 0.9) * env, -11, 11), r };
        }
        const k = inOutSine((r - BELL.ring) / BELL.up); // 上げる
        return { i, x: BELL_X, y: lerp(BELL_Y, BELL_Y - 320, k), a: 4 * (1 - k) * Math.sin(k * 6), c: 0 };
      }
      return null;
    };
    const [ax, ay] = zoomed(restXY);
    const END = OFF + T.end;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        const all = now - t0;
        const t = all - OFF; // 抽選器の時刻
        // 登場: 全体がふっと見え（前のカードの上に重なって入れ替わる）、台がわずかに沈んで据わる
        const inK = seg(all, 0, 420);
        const fadeIn = smooth(seg(all, 0, 300));
        // 胴の角度と速さ。速いほど台が細かく震える
        const th = angleAt(Math.max(0, t));
        const dt = Math.max(1, all - prevT);
        om = lerp(om, ((th - prevTh) / dt) * 1000, 0.35);
        rattle += Math.abs(th - prevTh);
        prevTh = th; prevT = all;
        const tremor = clamp(Math.abs(om) / 700) * 1.1;
        const rise = 8 * (1 - outCubic(clamp(inK)));
        const shake = `translate(${(Math.sin(all * 0.09) * tremor).toFixed(2)} ${(rise + Math.cos(all * 0.13) * tremor * 0.6).toFixed(2)})`;
        rig.setAttribute("transform", shake);
        rigFront.setAttribute("transform", shake);
        drum.pose(th);
        // 中の玉が鳴る（回った角度ごとに）
        if (t >= T.spin && t < T.stop + 100 && rattle > 44) { rattle = 0; SE.crackle(); }
        else if (t < T.spin) rattle = 0;
        once("lever", T.ant, t, () => SE.reelLever());
        once("go", T.spin + 40, t, () => SE.whoosh());
        once("stop", T.stop, t, () => SE.reelStop());
        once("pop", T.pop, t, () => SE.punch());
        once("chute", T.drop, t, () => { SE.click(); SE.pour(); });
        impacts.slice(0, 3).forEach(([at], i) => once(`hit${i}`, at, t, () => SE.click()));
        // 玉と影
        const b = ballAt(t);
        if (b) {
          const [sx, sy] = squash(t);
          place(b.p, b.sc * sx, b.sc * sy);
          ball.g.setAttribute("opacity", 1);
          if (b.g != null) shade(b.gp || b.p, b.g, b.air || 0);
          else ball.shadow.setAttribute("opacity", 0);
        }
        // カメラ: 玉が受け皿へ向かうと寄る（寄り切ってから少し沈む）
        const push = inOutSine(seg(t, T.fly - 200, T.rest + 260));
        const hand = smooth(seg(t, T.fade, T.end));
        const sc = 1 + 0.22 * push + 0.07 * hand;
        cam.style.transformOrigin = `${lerp(CX + 90, ax, push).toFixed(1)}px ${lerp(H / 2 + 20, ay, push).toFixed(1)}px`;
        cam.style.transform = `scale(${sc.toFixed(4)})`;
        // 上位は係の人が手持ちの鐘を振る。下の賞は小さな音だけで静かに止まる
        const bp = bellAt(all);
        if (bp) {
          bell.pose(bp.x, bp.y, bp.a, bp.c);
          bell.g.setAttribute("opacity", 1);
          if (bp.r != null) {
            const hit = Math.floor((bp.r / 1000) * HZ * 2 + 0.5); // 振り切るたびに舌が当たる
            if (hit % 2 === 1) once(`bell${bp.i}-${hit}`, 0, 1, () => (hit === 1 ? SE.just : SE.reelWin)());
          }
        } else bell.g.setAttribute("opacity", 0);
        once("accent", T.accent, t, () => { if (!top) (rank === "A" ? SE.perfect : SE.good)(); });
        // カードへの受け渡し: 寄りながら全体が暗くほどけ、その下で賞のカードが開く
        if (onHandoff) once("handoff", T.fade + 60, t, onHandoff);
        node.style.opacity = String(fadeIn * (1 - hand));
        if (all >= END) resolve();
        else raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
  } finally {
    cancelAnimationFrame(raf);
    for (const a of node.getAnimations({ subtree: true })) a.cancel();
    node.remove();
  }
}
