// シーシャくじのガラガラ（新井式の回転抽選器）。漆塗りの六角の胴を斜め前から見せ、側面の厚みは
// 回転に合わせて毎フレーム立体として計算し直す。ハンドルを一度引いてから回し、中の玉が鳴る。
// 止まると側面の穴から玉が出て、樋を転がり、受け皿で弾んで止まる。玉の色が賞を表す（S＝金・A＝赤・B＝青・C＝白）。
// 終わると kuji.js が賞のカードを出す。台と背景の配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。
// 玉の色は意味を持つので配色によらず固定。動きはすべて1本の requestAnimationFrame で時刻から決める。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { svg, stageSvg, reducedMotion, W, H } from "../core/transition-kit.js";
import { pick, ring, confetti, twinkle } from "../core/mg-kit.js";

export const BALL = { S: "#f4c542", A: "#e5484d", B: "#3b82f6", C: "#f4f1ea", LAST: "#c9a7ff" };
const BALL_EDGE = { S: "#8a5a08", A: "#7a141c", B: "#163d8c", C: "#9c9486", LAST: "#5a3aa8" };
const BALL_HI = { S: "#fff6c8", A: "#ffb4a8", B: "#bcd8ff", C: "#ffffff", LAST: "#f1e6ff" };

// 漆の朱と黒・真鍮（free）／紫の濃淡（mono）。緑は使わない
const FREE = {
  bg0: "#3a1712", bg1: "#0b0505", pat: "#e0b25a", bokeh: "#ffbf6a", spot: "#ffe6b8",
  lacD: "#2e0506", lacL: "#c8281d", spec: "#ffe9d2", face: "#170a09", faceHi: "#5a2a22",
  brass0: "#5e3f10", brass1: "#c79a3e", brass2: "#ffe9ae",
  stand0: "#100707", stand1: "#3b2420", grip0: "#5a2c12", grip1: "#c98a4f",
  counter0: "#120a07", counter1: "#4a2c1b", edge: "#c79a3e", felt0: "#0c0909", felt1: "#2c2424", glass: "#080404",
};
const MONO_SET = {
  bg0: "#2c1f5a", bg1: "#0a0716", pat: "#c9b8f0", bokeh: "#b49cf0", spot: "#efe8ff",
  lacD: "#170f33", lacL: "#7d62d2", spec: "#f5f0ff", face: "#100a22", faceHi: "#3e2f74",
  brass0: "#3e2f72", brass1: "#a893e6", brass2: "#f3eeff",
  stand0: "#0b0817", stand1: "#2e2456", grip0: "#3d2a78", grip1: "#9a82d8",
  counter0: "#0d0a1d", counter1: "#2e2257", edge: "#a893e6", felt0: "#0b0818", felt1: "#2a2150", glass: "#06041a",
};

// 立体の置き方。胴の中心・外接半径・奥行き、斜めに見る角度（左へ振って少し上から）
const CX = 470, CY = 292, R = 150, L = 170;
const DEG = Math.PI / 180;
const YAW = -26 * DEG, PITCH = 12 * DEG;
const FRONT = L / 2, BACK = -L / 2;
const SFRAME = FRONT + 16; // 手前の台枠
const CRANK = FRONT + 44; // ハンドルの腕
const FLOOR = -225; // 台の上面（胴の中心から下へ）

// 時刻（ms）。登場 → ためて引く → 1.6回転 → 止まって揺れる → 玉が出る → 樋 → 受け皿 → 光る → カードへ
const T = { ant: 300, spin: 600, stop: 2100, pop: 2230, out: 2400, roll: 2520, fly: 2820, land: 2980, rest: 3500, accent: 3520, fade: 4020, end: 4360 };
const TURN = 576; // 回す角度（1.6回転）
const PULL = 22; // ハンドルを引く角度
const BALL_R = 15;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
const outCubic = (k) => 1 - (1 - k) ** 3;
const inOutSine = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
const outBack = (k) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
const seg = (t, a, b) => clamp((t - a) / (b - a));

/** 胴の座標（u 右・v 上・w 手前）を見る向きへ回す */
function view(x, y, z) {
  const x1 = x * Math.cos(YAW) + z * Math.sin(YAW), z1 = -x * Math.sin(YAW) + z * Math.cos(YAW);
  return [x1, y * Math.cos(PITCH) - z1 * Math.sin(PITCH), y * Math.sin(PITCH) + z1 * Math.cos(PITCH)];
}
/** 面の座標（u 右・s 下・w 手前）→ 画面 */
const P = (u, s, w) => { const [x, y] = view(u, -s, w); return [CX + x, CY - y]; };
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
/** 奥行き w の面に平行な平面を画面へ写す行列（SVG の matrix） */
function plane(w) {
  const o = P(0, 0, w), a = P(1, 0, w), b = P(0, 1, w);
  return `matrix(${a[0] - o[0]} ${a[1] - o[1]} ${b[0] - o[0]} ${b[1] - o[1]} ${o[0]} ${o[1]})`;
}
const norm = ([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const LIGHT = norm([0.18, 0.85, 0.5]);
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const SPEC_MAX = (() => { const u = view(1, 0, 0), v = view(0, 1, 0); return Math.hypot(u[0] * HALF[0] + u[1] * HALF[1] + u[2] * HALF[2], v[0] * HALF[0] + v[1] * HALF[1] + v[2] * HALF[2]); })();

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(",")})`;
}

let serial = 0;
/** グラデーションの定義を作り、url(#id) を返す */
function grad(defs, kind, attrs, stops) {
  const id = `gg-${++serial}`;
  defs.append(svg(kind, { id, ...attrs }, stops.map(([o, c, a = 1]) => svg("stop", { offset: o, "stop-color": c, "stop-opacity": a }))));
  return `url(#${id})`;
}

/** 背景: 暖かいスポット、青海波の地紋、ぼけた灯り、カウンター、周辺減光 */
function setArt(C, defs) {
  const patId = `gg-pat-${++serial}`;
  const wave = (cx, cy) => svg("g", {}, [38, 28, 18, 8].map((r, i) => svg("circle", { cx, cy, r, fill: i ? "none" : C.bg1, stroke: C.pat, "stroke-width": 1.4 })));
  defs.append(svg("pattern", { id: patId, width: 80, height: 40, patternUnits: "userSpaceOnUse" }, [
    wave(0, 0), wave(80, 0), wave(40, 20), wave(0, 40), wave(80, 40),
  ]));
  const back = svg("rect", { width: W, height: H, fill: grad(defs, "radialGradient", { cx: 0.42, cy: 0.38, r: 0.75 }, [[0, C.bg0], [1, C.bg1]]) });
  const pattern = svg("rect", { width: W, height: 452, fill: `url(#${patId})`, opacity: 0.07 });
  const bokeh = [[150, 120, 46], [300, 70, 24], [1010, 110, 58], [1150, 230, 30], [880, 60, 20], [80, 300, 34], [1220, 420, 40], [700, 90, 16], [420, 170, 12]].map(([x, y, r], i) => {
    const c = svg("circle", { cx: x, cy: y, r, fill: grad(defs, "radialGradient", {}, [[0, C.bokeh, 0.34], [0.7, C.bokeh, 0.12], [1, C.bokeh, 0]]) });
    c.dataset.x = x; c.dataset.y = y; c.dataset.i = i;
    return c;
  });
  const spot = svg("polygon", { points: pts([[CX - 70, -10], [CX + 70, -10], [CX + 420, 640], [CX - 360, 640]]), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.spot, 0.2], [0.75, C.spot, 0.05], [1, C.spot, 0]]) });
  const counterTop = svg("polygon", { points: pts([[0, 452], [W, 452], [W, 680], [0, 680]]), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.counter0], [1, C.counter1]]) });
  const pool = svg("ellipse", { cx: CX + 140, cy: 560, rx: 520, ry: 110, fill: grad(defs, "radialGradient", {}, [[0, C.spot, 0.22], [1, C.spot, 0]]) });
  const grain = svg("g", { stroke: C.counter0, "stroke-width": 1.2, fill: "none", opacity: 0.55 }, [470, 492, 520, 556, 598, 644].map((y, i) => svg("path", { d: `M 0 ${y} C 320 ${y - 4 + i}, 760 ${y + 5}, ${W} ${y - 2}` })));
  const front = svg("rect", { x: 0, y: 680, width: W, height: 40, fill: C.counter0 });
  const lip = svg("rect", { x: 0, y: 678, width: W, height: 3, fill: C.edge, opacity: 0.7 });
  const motes = [...Array(14)].map((_, i) => svg("circle", { r: 1.4 + (i % 3) * 0.6, fill: C.spot, opacity: 0, "data-i": i }));
  const vignette = svg("rect", { width: W, height: H, fill: grad(defs, "radialGradient", { cx: 0.5, cy: 0.45, r: 0.72 }, [[0.55, "#000", 0], [1, "#000", 0.78]]) });
  return { back: svg("g", {}, [back, pattern, ...bokeh, counterTop, pool, grain, front, lip, spot, ...motes]), vignette, bokeh, spot, motes };
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
  ];
}
function standArt(C, defs) {
  const x0 = -165, x1 = 165, z0 = -128, z1 = 128, y0 = FLOOR, y1 = FLOOR - 24;
  const Q = (u, v, w) => P(u, -v, w);
  const topFace = [Q(x0, y0, z0), Q(x1, y0, z0), Q(x1, y0, z1), Q(x0, y0, z1)];
  const frontFace = [Q(x0, y0, z1), Q(x1, y0, z1), Q(x1, y1, z1), Q(x0, y1, z1)];
  const rightFace = [Q(x1, y0, z1), Q(x1, y0, z0), Q(x1, y1, z0), Q(x1, y1, z1)];
  const c0 = Q(0, y1, 0);
  const contact = svg("ellipse", { cx: c0[0] + 10, cy: c0[1] + 18, rx: 260, ry: 44, fill: "#000", opacity: 0.5 });
  const base = svg("g", {}, [
    contact,
    svg("polygon", { points: pts(rightFace), fill: C.stand0 }),
    svg("polygon", { points: pts(frontFace), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.stand0], [0.6, C.stand1], [1, C.stand0]]) }),
    svg("polygon", { points: pts(topFace), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, C.stand1], [1, C.stand0]]) }),
    svg("polyline", { points: pts([Q(x0, y0, z1), Q(x1, y0, z1), Q(x1, y0, z0)]), fill: "none", stroke: C.brass1, "stroke-width": 2.4 }),
  ]);
  const back = svg("g", {}, [...frameLeg(C, defs, BACK - 16, -1), ...frameLeg(C, defs, BACK - 16, 1)]);
  const frontLegs = svg("g", {}, [...frameLeg(C, defs, SFRAME, -1), ...frameLeg(C, defs, SFRAME, 1),
    // 脚をつなぐ貫と、軸受けの金具
    svg("polygon", { points: pts([P(-72, 170, SFRAME), P(72, 170, SFRAME), P(74, 184, SFRAME), P(-74, 184, SFRAME)]), fill: C.stand1 }),
    svg("line", { x1: P(-72, 170, SFRAME)[0], y1: P(-72, 170, SFRAME)[1], x2: P(72, 170, SFRAME)[0], y2: P(72, 170, SFRAME)[1], stroke: C.brass1, "stroke-width": 1.6, opacity: 0.8 }),
  ]);
  return { base, back, frontLegs };
}

/** 胴の側面（6枚）と縁金具・穴、正面（回る面）、ハンドル */
function drumArt(C, defs) {
  const panels = [...Array(6)].map(() => svg("polygon", { "stroke-linejoin": "round" }));
  const shade = [...Array(6)].map(() => svg("polygon", { fill: "" }));
  const corners = [...Array(6)].map(() => svg("line", { stroke: C.brass1, "stroke-width": 5, "stroke-linecap": "round" }));
  const rims = [...Array(6)].map(() => svg("line", { stroke: C.brass0, "stroke-width": 3.5, "stroke-linecap": "round" }));
  const holeRing = svg("polygon", { fill: C.brass1, stroke: C.brass0, "stroke-width": 1.5 });
  const hole = svg("polygon", { fill: "#050202" });
  const holeLip = svg("polyline", { fill: "none", stroke: C.brass2, "stroke-width": 1.6, opacity: 0.8 });
  // 側面の奥ほど暗く（手前の縁から奥の縁へ）
  const f0 = P(0, 0, FRONT), b0 = P(0, 0, BACK);
  const depth = grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: f0[0], y1: f0[1], x2: b0[0] + (b0[0] - f0[0]) * 0.4, y2: b0[1] + (b0[1] - f0[1]) * 0.4 }, [[0, "#000", 0], [1, "#000", 0.5]]);
  shade.forEach((s) => s.setAttribute("fill", depth));
  const band = svg("g", {}, [...panels, ...shade, ...rims, ...corners, holeRing, hole, holeLip]);

  // 正面（黒漆の面）。rot の中は胴と一緒に回る
  const hexPts = (r, a0 = 0) => [...Array(6)].map((_, i) => [r * Math.cos((a0 + i * 60) * DEG), r * Math.sin((a0 + i * 60) * DEG)]);
  const brass = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, C.brass2], [0.45, C.brass1], [1, C.brass0]]);
  const boss = grad(defs, "radialGradient", { cx: 0.38, cy: 0.34, r: 0.75 }, [[0, C.brass2], [0.5, C.brass1], [1, C.brass0]]);
  const kites = hexPts(R).map(([x, y], i, all) => {
    const prev = all[(i + 5) % 6], next = all[(i + 1) % 6];
    const d = (p) => { const dx = p[0] - x, dy = p[1] - y, l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
    const a = d(prev), b = d(next);
    return svg("g", {}, [
      svg("polygon", { points: pts([[x, y], [x + a[0] * 30, y + a[1] * 30], [x * 0.8, y * 0.8], [x + b[0] * 30, y + b[1] * 30]]), fill: brass, stroke: C.brass0, "stroke-width": 1.2 }),
      svg("circle", { cx: x * 0.9, cy: y * 0.9, r: 2.6, fill: C.brass0 }),
    ]);
  });
  // 中の玉が見える小窓（硝子）。玉は回らない座標で重力に従う
  const WIN = { r: 0.55 * R, a: 150, size: 22 };
  const wx = WIN.r * Math.cos(WIN.a * DEG), wy = WIN.r * Math.sin(WIN.a * DEG);
  const clipId = `gg-clip-${++serial}`;
  defs.append(svg("clipPath", { id: clipId }, [svg("circle", { cx: wx, cy: wy, r: WIN.size })]));
  const balls = svg("g");
  const glint = svg("ellipse", { rx: 9, ry: 5, fill: "#fff", opacity: 0.28 });
  const inner = svg("g", { "clip-path": `url(#${clipId})` }, [svg("circle", { cx: wx, cy: wy, r: WIN.size, fill: C.glass }), balls, glint]);
  const rot = svg("g", {}, [
    svg("polygon", { points: pts(hexPts(R)), fill: C.face }),
    svg("polygon", { points: pts(hexPts(R * 0.8)), fill: "none", stroke: C.brass1, "stroke-width": 1.4, opacity: 0.75 }),
    svg("polygon", { points: pts(hexPts(R * 0.74)), fill: "none", stroke: C.brass1, "stroke-width": 0.8, opacity: 0.45 }),
    // 金の細い放射と輪（蒔絵のような線）
    ...hexPts(R * 0.74).map(([x, y]) => svg("line", { x1: x * 0.36, y1: y * 0.36, x2: x, y2: y, stroke: C.brass1, "stroke-width": 1, opacity: 0.4 })),
    svg("circle", { r: R * 0.27, fill: "none", stroke: C.brass1, "stroke-width": 1.2, opacity: 0.55 }),
    svg("polygon", { points: pts(hexPts(R - 4)), fill: "none", stroke: C.brass1, "stroke-width": 8, "stroke-linejoin": "round" }),
    svg("polygon", { points: pts(hexPts(R - 9)), fill: "none", stroke: C.brass0, "stroke-width": 1.5, "stroke-linejoin": "round" }),
    ...kites,
    inner,
    svg("circle", { cx: wx, cy: wy, r: WIN.size + 3, fill: "none", stroke: brass, "stroke-width": 5 }),
    svg("circle", { r: 34, fill: "none", stroke: C.brass1, "stroke-width": 1.2, opacity: 0.6 }),
  ]);
  // 回らない光沢（上からの光が面に映る）
  const sheen = svg("polygon", { fill: grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: -R, y1: -R, x2: R * 0.6, y2: R }, [[0, C.faceHi, 0.9], [0.45, C.faceHi, 0.15], [1, "#000", 0.25]]) });
  const face = svg("g", { transform: plane(FRONT) }, [rot, sheen]);
  // 軸と真鍮の軸頭（手前の台枠の外）
  const cap = svg("g", { transform: plane(SFRAME + 4) }, [
    svg("circle", { r: 26, fill: C.stand0 }),
    svg("circle", { r: 21, fill: boss, stroke: C.brass0, "stroke-width": 1.5 }),
    svg("circle", { cx: -6, cy: -7, r: 5, fill: "#fff", opacity: 0.35 }),
  ]);
  // ハンドル: 真鍮の腕と木の握り（握りは軸と平行に手前へ伸びる）
  const ARM = { len: 98, a: -128 };
  const arm = svg("g", {}, [
    svg("line", { x1: 0, y1: 0, x2: ARM.len, y2: 0, stroke: C.brass0, "stroke-width": 15, "stroke-linecap": "round" }),
    svg("line", { x1: 0, y1: -1, x2: ARM.len, y2: -1, stroke: C.brass1, "stroke-width": 10, "stroke-linecap": "round" }),
    svg("line", { x1: 6, y1: -3, x2: ARM.len - 6, y2: -3, stroke: C.brass2, "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0.8 }),
    svg("circle", { r: 15, fill: boss, stroke: C.brass0, "stroke-width": 1.5 }),
  ]);
  const armRot = svg("g", {}, [arm]);
  const crank = svg("g", { transform: plane(CRANK) }, [armRot]);
  const gripShadow = svg("line", { stroke: "#000", "stroke-width": 27, "stroke-linecap": "round", opacity: 0.55 });
  const gripBody = svg("line", { stroke: C.grip0, "stroke-width": 23, "stroke-linecap": "round" });
  const gripMid = svg("line", { stroke: C.grip1, "stroke-width": 11, "stroke-linecap": "round", opacity: 0.85 });
  const gripHi = svg("line", { stroke: "#fff", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.35 });
  const gripEnd = svg("ellipse", { fill: C.grip1, stroke: C.grip0, "stroke-width": 2 });
  const grip = svg("g", {}, [gripShadow, gripBody, gripMid, gripHi, gripEnd]);

  // 中の玉の山（白が多く、色玉が少し）
  const pile = [];
  const rows = [[90, [0, -13, 13, -26, 26, -39, 39, -52, 52]], [72, [-7, 7, -22, 22, -37, 37]], [55, [0, -17, 17]]];
  const tints = ["C", "C", "A", "C", "B", "C", "C", "S", "C", "A", "C", "B", "C", "C", "C", "A", "C", "C"];
  rows.forEach(([r, angs]) => angs.forEach((a) => {
    const k = tints[pile.length % tints.length];
    const c = svg("circle", { r: 9.5, fill: BALL[k], stroke: BALL_EDGE[k], "stroke-width": 1.4 });
    balls.append(c);
    pile.push({ c, r, a, i: pile.length });
  }));

  return {
    back: band, face, cap, crank, grip,
    /** 角度 th（度）と角速度 om（度/秒）、経過秒 sec で描き直す */
    pose(th, om, sec) {
      const vtx = (i, w) => P(R * Math.cos((th + i * 60) * DEG), R * Math.sin((th + i * 60) * DEG), w);
      const seen = [];
      for (let k = 0; k < 6; k++) {
        const b = (th + 30 + k * 60) * DEG;
        const n = view(Math.cos(b), -Math.sin(b), 0);
        const vis = n[2] > 0.015;
        seen[k] = vis;
        panels[k].style.display = shade[k].style.display = rims[k].style.display = vis ? "" : "none";
        if (!vis) continue;
        const q = pts([vtx(k, FRONT), vtx(k + 1, FRONT), vtx(k + 1, BACK), vtx(k, BACK)]);
        const lam = clamp(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        const sp = clamp((n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]) / SPEC_MAX) ** 22;
        const base = mix(C.lacD, C.lacL, 0.16 + lam * 0.88);
        panels[k].setAttribute("points", q);
        panels[k].setAttribute("fill", sp > 0.02 ? mixRgb(base, C.spec, sp * 0.8) : base);
        shade[k].setAttribute("points", q);
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
      const hole3 = (rr) => [...Array(16)].map((_, i) => {
        const s = (i / 16) * Math.PI * 2;
        const t = rr * Math.cos(s);
        return P(ap * Math.cos(hb) - t * Math.sin(hb), ap * Math.sin(hb) + t * Math.cos(hb), 8 + rr * Math.sin(s));
      });
      for (const n of [holeRing, hole, holeLip]) n.style.display = seen[0] ? "" : "none";
      if (seen[0]) {
        holeRing.setAttribute("points", pts(hole3(BALL_R + 9)));
        hole.setAttribute("points", pts(hole3(BALL_R + 3)));
        holeLip.setAttribute("points", pts(hole3(BALL_R + 3).slice(0, 9)));
      }
      rot.setAttribute("transform", `rotate(${th.toFixed(2)})`);
      sheen.setAttribute("points", pts(hexPts(R, th)));
      armRot.setAttribute("transform", `rotate(${(th + ARM.a).toFixed(2)})`);
      // 握り: 腕の先から手前へ
      const ga = (th + ARM.a) * DEG;
      const gx = ARM.len * Math.cos(ga), gy = ARM.len * Math.sin(ga);
      const p1 = P(gx, gy, CRANK + 2), p2 = P(gx, gy, CRANK + 70);
      for (const n of [gripShadow, gripBody, gripMid, gripHi]) { n.setAttribute("x1", p1[0]); n.setAttribute("y1", p1[1]); n.setAttribute("x2", p2[0]); n.setAttribute("y2", p2[1]); }
      gripShadow.setAttribute("transform", "translate(3 4)");
      gripMid.setAttribute("transform", "translate(-1 -2)");
      gripHi.setAttribute("transform", "translate(-3 -6)");
      gripEnd.setAttribute("cx", p2[0]); gripEnd.setAttribute("cy", p2[1]);
      gripEnd.setAttribute("rx", 10); gripEnd.setAttribute("ry", 12);
      gripEnd.setAttribute("transform", `rotate(-20 ${p2[0]} ${p2[1]})`);
      // 中の玉: 回転の向きへ持ち上げられ、速いほど跳ねる。小窓は回るので、玉は回らない座標で描く
      const lift = clamp(om / 900, -1, 1) * 34;
      const jig = clamp(Math.abs(om) / 700);
      balls.setAttribute("transform", `rotate(${(-th).toFixed(2)})`);
      for (const b of pile) {
        const a = (90 - lift + b.a + Math.sin(sec * 19 + b.i * 2.1) * 7 * jig) * DEG;
        const r = b.r + Math.sin(sec * 23 + b.i * 1.3) * 5 * jig - (b.r < 60 ? 10 * jig * (0.5 + 0.5 * Math.sin(sec * 9 + b.i)) : 0);
        b.c.setAttribute("cx", (r * Math.cos(a)).toFixed(1));
        b.c.setAttribute("cy", (r * Math.sin(a)).toFixed(1));
      }
      const wa = (WIN.a + th) * DEG;
      glint.setAttribute("cx", (WIN.r * Math.cos(wa) - 7).toFixed(1));
      glint.setAttribute("cy", (WIN.r * Math.sin(wa) - 9).toFixed(1));
      glint.setAttribute("transform", `rotate(${(-th).toFixed(2)})`);
    },
  };
}
const mixRgb = (rgb, b, k) => {
  const A = rgb.match(/\d+/g).map(Number), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(",")})`;
};

/** 側面の穴の位置（画面）と、外へ向かう向き */
function holeAt(th) {
  const hb = (th + 30) * DEG, ap = R * Math.cos(30 * DEG);
  const c = P(ap * Math.cos(hb), ap * Math.sin(hb), 8);
  const o = P((ap + 30) * Math.cos(hb), (ap + 30) * Math.sin(hb), 8);
  const l = Math.hypot(o[0] - c[0], o[1] - c[1]);
  return { x: c[0], y: c[1], dx: (o[0] - c[0]) / l, dy: (o[1] - c[1]) / l };
}
// 樋と受け皿（画面座標）。止まったときの穴の下から右下へ
const HOLE = holeAt(0);
const CHUTE = { x0: HOLE.x + 30, y0: HOLE.y + 54, x1: HOLE.x + 172, y1: HOLE.y + 138 };
const TRAY = { x: CHUTE.x1 + 92, y: CHUTE.y1 + 64, rx: 86, ry: 21 };
const REST = { x: TRAY.x + 8, y: TRAY.y - 6 };

function chuteArt(C, defs) {
  const { x0, y0, x1, y1 } = CHUTE;
  const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const nx = -uy, ny = ux; // 下向きの法線
  const off = (x, y, k) => [x + nx * k, y + ny * k];
  const wood = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.stand1], [1, C.stand0]]);
  const sx = lerp(x0, x1, 0.62), sy = lerp(y0, y1, 0.62) + 14;
  const back = svg("g", {}, [
    // 支柱（台の上から樋の中ほどへ）
    svg("line", { x1: sx, y1: sy + 70, x2: sx, y2: sy, stroke: C.stand0, "stroke-width": 10 }),
    svg("line", { x1: sx, y1: sy + 70, x2: sx, y2: sy, stroke: C.brass0, "stroke-width": 3, opacity: 0.7 }),
    svg("polygon", { points: pts([off(x0, y0, -14), off(x1, y1, -14), off(x1, y1, 6), off(x0, y0, 6)]), fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, C.felt0], [0.6, C.felt1], [1, C.felt0]]) }),
    svg("line", { x1: off(x0, y0, -14)[0], y1: off(x0, y0, -14)[1], x2: off(x1, y1, -14)[0], y2: off(x1, y1, -14)[1], stroke: C.brass1, "stroke-width": 3 }),
  ]);
  const front = svg("g", {}, [
    svg("polygon", { points: pts([off(x0, y0, 6), off(x1, y1, 6), off(x1, y1, 15), off(x0, y0, 15)]), fill: wood }),
    svg("line", { x1: off(x0, y0, 15)[0], y1: off(x0, y0, 15)[1], x2: off(x1, y1, 15)[0], y2: off(x1, y1, 15)[1], stroke: C.brass0, "stroke-width": 1.6 }),
    svg("line", { x1: off(x0, y0, 6)[0], y1: off(x0, y0, 6)[1], x2: off(x1, y1, 6)[0], y2: off(x1, y1, 6)[1], stroke: C.brass2, "stroke-width": 2.4 }),
    svg("line", { x1: off(x1, y1, -14)[0], y1: off(x1, y1, -14)[1], x2: off(x1, y1, 15)[0], y2: off(x1, y1, 15)[1], stroke: C.brass1, "stroke-width": 3, "stroke-linecap": "round" }),
    svg("line", { x1: off(x0, y0, -14)[0], y1: off(x0, y0, -14)[1], x2: off(x0, y0, 15)[0], y2: off(x0, y0, 15)[1], stroke: C.brass1, "stroke-width": 3, "stroke-linecap": "round" }),
  ]);
  return { back, front, at: (s) => [x0 + (x1 - x0) * s, y0 + (y1 - y0) * s], ux, uy };
}

function trayArt(C, defs) {
  const { x, y, rx, ry } = TRAY;
  const back = svg("g", {}, [
    svg("ellipse", { cx: x + 6, cy: y + 14, rx: rx + 12, ry: ry + 9, fill: "#000", opacity: 0.5 }),
    svg("ellipse", { cx: x, cy: y + 5, rx, ry, fill: C.brass0 }),
    svg("ellipse", { cx: x, cy: y, rx, ry, fill: grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.brass0], [0.35, C.brass2], [0.6, C.brass1], [1, C.brass0]]) }),
    svg("ellipse", { cx: x, cy: y + 1, rx: rx - 9, ry: ry - 5, fill: grad(defs, "radialGradient", { cx: 0.5, cy: 0.62, r: 0.6 }, [[0, C.felt1], [1, C.felt0]]) }),
  ]);
  const front = svg("path", { d: `M ${x - rx} ${y} A ${rx} ${ry} 0 0 0 ${x + rx} ${y}`, fill: "none", stroke: C.brass2, "stroke-width": 1.6, opacity: 0.6 });
  return { back, front };
}

/** 玉（艶のある球）。g は位置、body は弾むときの伸び縮み（下端を支点にする） */
function ballArt(rank, defs) {
  const k = BALL[rank] ? rank : "C";
  const fill = grad(defs, "radialGradient", { cx: 0.36, cy: 0.32, r: 0.78 }, [[0, BALL_HI[k]], [0.32, BALL[k]], [0.86, BALL_EDGE[k]], [1, BALL_EDGE[k]]]);
  const body = svg("g", {}, [
    svg("circle", { r: BALL_R, fill }),
    svg("ellipse", { cx: 2, cy: 9, rx: 8, ry: 3.5, fill: "#fff", opacity: 0.14 }),
    svg("ellipse", { cx: -5, cy: -6, rx: 4.6, ry: 3.2, fill: "#fff", opacity: 0.9, transform: "rotate(-35 -5 -6)" }),
  ]);
  const g = svg("g", {}, [body]);
  const shadow = svg("ellipse", { rx: 15, ry: 4, fill: "#000", opacity: 0 });
  return { g, body, shadow, color: BALL[k] };
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

/** 時刻 t（ms）の胴の角度。ためて引く → 回す → 止まり際に少し揺れ戻る */
function angleAt(t) {
  const start = -TURN;
  if (t < T.ant) return start;
  if (t < T.spin) return start - PULL * inOutSine(seg(t, T.ant, T.spin));
  if (t < T.stop) return start - PULL + (TURN + PULL) * spinAt(seg(t, T.spin, T.stop));
  const d = t - T.stop;
  return -7 * Math.exp(-d / 120) * Math.sin((2 * Math.PI * d) / 260);
}

/**
 * host に全面の層を置いてガラガラを回し、rank の玉を出す。終わると層を外す。
 * onHandoff は消え始めに一度呼ぶ（くじのカードを下で開いて、重ねながら受け渡す）。
 * 動きを減らす設定では、止まった抽選器と受け皿の玉だけを短く見せる。
 */
export async function garagara(host, rank = "C", { onHandoff } = {}) {
  const C = pick(FREE, MONO_SET);
  const reduced = reducedMotion();
  const top = rank === "S" || rank === "LAST";
  const defs = svg("defs");
  const set = setArt(C, defs);
  const stand = standArt(C, defs);
  const drum = drumArt(C, defs);
  const chute = chuteArt(C, defs);
  const tray = trayArt(C, defs);
  const ball = ballArt(rank, defs);
  const glow = svg("circle", { r: 220, fill: grad(defs, "radialGradient", {}, [[0, ball.color, 0.55], [0.35, ball.color, 0.18], [1, ball.color, 0]]), opacity: 0 });
  const rays = svg("g", { opacity: 0 }, [...Array(14)].map((_, i) => {
    const a = (i / 14) * Math.PI * 2, w = i % 2 ? 0.05 : 0.09, r = i % 2 ? 260 : 380;
    return svg("polygon", { points: pts([[0, 0], [Math.cos(a - w) * r, Math.sin(a - w) * r], [Math.cos(a + w) * r, Math.sin(a + w) * r]]) });
  }));
  rays.setAttribute("fill", grad(defs, "radialGradient", { gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 380 }, [[0, BALL.S, 0.5], [0.5, BALL.S, 0.12], [1, BALL.S, 0]]));
  const fx = svg("g");
  const rig = svg("g", {}, [stand.base, stand.back, drum.back, drum.face, stand.frontLegs, drum.cap, drum.crank, drum.grip, chute.back]);
  const cam = svg("g", {}, [set.back, rig, tray.back, rays, glow, ball.shadow, ball.g, chute.front, tray.front, fx]);
  cam.style.transformBox = "view-box";
  const art = stageSvg([defs, cam, set.vignette]);
  const node = el("div.mo-garagara", { dataset: { motion: "garagara" } }, [art]);
  host.append(node);
  const place = (x, y, sx = 1, sy = 1) => {
    ball.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    // 伸び縮みは玉の下端を支点に
    ball.body.setAttribute("transform", `translate(0 ${(BALL_R * (1 - sy)).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
  };
  let raf = 0;
  try {
    if (reduced) {
      drum.pose(0, 0, 0);
      place(REST.x, REST.y);
      ball.shadow.setAttribute("cx", REST.x); ball.shadow.setAttribute("cy", REST.y + BALL_R - 1); ball.shadow.setAttribute("opacity", 0.45);
      await sleep(900);
      return;
    }
    // ここから先は時刻だけで決める（音は時刻を一度だけ越えたときに鳴らす）
    const hole = HOLE;
    const fired = new Set();
    const once = (key, at, t, fn) => { if (t >= at && !fired.has(key)) { fired.add(key); fn(); } };
    const impacts = [];
    let prevTh = angleAt(0), prevT = 0, om = 0, rattle = 0;
    // 樋の転がり（加速）と、樋の端から受け皿へ飛ぶ放物線
    const rollAt = (k) => 0.08 + 0.92 * (0.35 * k + 0.65 * k * k);
    const endV = { x: chute.ux, y: chute.uy };
    const [fx0, fy0] = chute.at(1);
    const LAND = { x: TRAY.x - 18, y: TRAY.y - 6 };
    const hops = [{ t0: T.land, t1: T.land + 200, h: 30, x0: LAND.x, x1: LAND.x + 13 }, { t0: T.land + 200, t1: T.land + 330, h: 11, x0: LAND.x + 13, x1: LAND.x + 20 }, { t0: T.land + 330, t1: T.land + 400, h: 3.5, x0: LAND.x + 20, x1: LAND.x + 23 }];
    const settleEnd = T.land + 400;
    const ballAt = (t) => {
      if (t < T.pop) return null;
      if (t < T.out) { // 穴から押し出される
        const k = outCubic(seg(t, T.pop, T.out));
        return { x: hole.x + hole.dx * BALL_R * 1.2 * k, y: hole.y + hole.dy * BALL_R * 1.2 * k, s: lerp(0.35, 1, k), sur: null };
      }
      const ox = hole.x + hole.dx * BALL_R * 1.2, oy = hole.y + hole.dy * BALL_R * 1.2;
      const [sx, sy] = chute.at(0.08);
      const ry = (x, y) => [x, y - BALL_R - 2]; // 樋の上に乗る高さ
      if (t < T.roll) { // 樋の始まりへ落ちる
        const k = seg(t, T.out, T.roll);
        const [tx, ty] = ry(sx, sy);
        return { x: lerp(ox, tx, k), y: lerp(oy, ty, k * k), s: 1, sur: [sx, sy] };
      }
      if (t < T.fly) {
        const s = rollAt(seg(t, T.roll, T.fly));
        const [cx, cy] = chute.at(s);
        const [x, y] = ry(cx, cy);
        return { x, y, s: 1, sur: [cx, cy] };
      }
      if (t < T.land) { // 樋の端から受け皿へ
        const k = seg(t, T.fly, T.land);
        const [x0, y0] = ry(fx0, fy0);
        const vy = endV.y * 520 * ((T.land - T.fly) / 1000);
        const c = LAND.y - y0 - vy;
        const x = lerp(x0, LAND.x, k), y = y0 + vy * k + c * k * k;
        return { x, y, s: 1, sur: [x, TRAY.y], air: 1 - k };
      }
      for (const hp of hops) {
        if (t < hp.t1) {
          const k = seg(t, hp.t0, hp.t1);
          return { x: lerp(hp.x0, hp.x1, k), y: LAND.y - hp.h * 4 * k * (1 - k), s: 1, sur: [lerp(hp.x0, hp.x1, k), TRAY.y], air: (hp.h * 4 * k * (1 - k)) / 60 };
        }
      }
      const k = outCubic(seg(t, settleEnd, T.rest)); // 少し転がって止まる
      return { x: lerp(LAND.x + 23, REST.x, k), y: REST.y, s: 1, sur: [lerp(LAND.x + 23, REST.x, k), TRAY.y] };
    };
    const squash = (t) => { // 着地の潰れと戻り
      let sx = 1, sy = 1;
      for (const [at, amp] of impacts) {
        const d = (t - at) / 1000;
        if (d < 0 || d > 0.32) continue;
        const v = amp * Math.exp(-d * 14) * Math.cos(d * 38);
        sy -= v; sx += v * 0.8;
      }
      return [sx, sy];
    };
    [[T.land, 0.3], [T.land + 200, 0.16], [T.land + 330, 0.07]].forEach((x) => impacts.push(x));
    const ACC = { x: REST.x, y: REST.y };
    const t0 = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        const t = now - t0;
        const sec = t / 1000;
        // 登場: 背景が灯り、台が少し下から据わる
        const inK = seg(t, 0, 420);
        cam.style.opacity = String(smooth(seg(t, 0, 260)));
        set.spot.setAttribute("opacity", String(clamp(inK * 1.6) * (t < 260 ? 0.6 + 0.4 * Math.sin(t / 22) ** 2 : 1)));
        // 胴の角度と速さ。速いほど台が細かく震える
        const th = angleAt(t);
        const dt = Math.max(1, t - prevT);
        om = lerp(om, ((th - prevTh) / dt) * 1000, 0.35);
        rattle += Math.abs(th - prevTh);
        prevTh = th; prevT = t;
        const tremor = clamp(Math.abs(om) / 700) * 1.3;
        const rise = 26 * (1 - outBack(clamp(inK)));
        rig.setAttribute("transform", `translate(${(Math.sin(t * 0.09) * tremor).toFixed(2)} ${(rise + Math.cos(t * 0.13) * tremor * 0.6).toFixed(2)})`);
        drum.pose(th, om, sec);
        if (t >= T.spin && t < T.stop + 120 && rattle > 48) { rattle = 0; SE.crackle(); }
        else if (t < T.spin) rattle = 0;
        once("lever", T.ant, t, () => SE.reelLever());
        once("go", T.spin + 60, t, () => SE.whoosh());
        once("stop", T.stop, t, () => SE.reelStop());
        once("pop", T.pop, t, () => SE.punch());
        once("roll", T.roll, t, () => SE.pour());
        impacts.forEach(([at], i) => once(`hit${i}`, at, t, () => SE.click()));
        // 玉と影
        const b = ballAt(t);
        if (b) {
          const [sx, sy] = squash(t);
          const pk = seg(t, T.accent, T.accent + 520); // 光るときに一度ふくらむ
          const pulse = 1 + (top ? 0.22 : 0.12) * Math.sin(Math.PI * clamp(pk * 1.6)) * (1 - pk * 0.5);
          place(b.x, b.y, b.s * sx * pulse, b.s * sy * pulse);
          ball.g.style.opacity = "1";
          if (b.sur) {
            const air = clamp(b.air || 0);
            ball.shadow.setAttribute("cx", (b.sur[0] + 4).toFixed(1));
            ball.shadow.setAttribute("cy", (b.sur[1] >= TRAY.y ? TRAY.y + 7 : b.sur[1] - 1).toFixed(1));
            ball.shadow.setAttribute("rx", (15 * (1 - air * 0.4)).toFixed(1));
            ball.shadow.setAttribute("opacity", (0.5 * (1 - air * 0.7)).toFixed(2));
          }
        } else ball.g.style.opacity = "0";
        // カメラ: 玉が受け皿へ向かうと寄る
        const push = smooth(seg(t, T.fly - 120, T.rest + 200));
        const hand = smooth(seg(t, T.fade, T.end));
        const sc = 1 + 0.2 * push + 0.06 * hand;
        cam.style.transformOrigin = `${lerp(CX + 80, ACC.x, push)}px ${lerp(H / 2, ACC.y, push)}px`;
        cam.style.transform = `scale(${sc.toFixed(4)})`;
        // 光の名残: 背景のぼけと、スポットの中の塵
        set.bokeh.forEach((c) => {
          const i = +c.dataset.i;
          c.setAttribute("cx", (+c.dataset.x + Math.sin(sec * 0.4 + i) * 10).toFixed(1));
          c.setAttribute("cy", (+c.dataset.y + Math.cos(sec * 0.3 + i * 1.7) * 6).toFixed(1));
        });
        set.motes.forEach((m, i) => {
          const y = 40 + ((i * 47 + sec * (14 + (i % 4) * 5)) % 520);
          m.setAttribute("cx", (CX - 120 + ((i * 89) % 300) + Math.sin(sec + i) * 14).toFixed(1));
          m.setAttribute("cy", y.toFixed(1));
          m.setAttribute("opacity", (0.45 * Math.sin((y / 560) * Math.PI) * clamp(inK)).toFixed(2));
        });
        // 当たりの光: 玉の後ろから光がふくらみ、上位は光の筋が回る
        const ak = seg(t, T.accent, T.accent + 520);
        const gk = (top ? 1 : rank === "A" ? 0.75 : 0.45) * outCubic(ak) * (1 - 0.4 * hand);
        glow.setAttribute("cx", REST.x); glow.setAttribute("cy", REST.y);
        glow.setAttribute("opacity", gk.toFixed(3));
        glow.setAttribute("transform", `translate(${REST.x} ${REST.y}) scale(${(0.4 + 0.6 * outCubic(ak) + 0.5 * hand).toFixed(3)}) translate(${-REST.x} ${-REST.y})`);
        if (top) {
          rays.setAttribute("opacity", (outCubic(ak) * (1 - hand)).toFixed(3));
          rays.setAttribute("transform", `translate(${REST.x} ${REST.y}) rotate(${(sec * 22).toFixed(2)}) scale(${(0.5 + 0.5 * outCubic(ak)).toFixed(3)})`);
        }
        once("accent", T.accent, t, () => {
          (top ? SE.just : rank === "A" ? SE.perfect : SE.good)();
          ring(fx, REST.x, REST.y, { r: top ? 230 : 120, color: top ? BALL.S : ball.color, width: top ? 8 : 5, dur: 620 });
          if (top) {
            ring(fx, REST.x, REST.y, { r: 150, color: C.brass2, width: 4, delay: 120, dur: 560 });
            confetti(fx, REST.x, REST.y - 30, { n: 26, colors: [BALL.S, "#fff3c4", "#e9b949", "#fffaf0"], spread: 300 });
            [[-140, -110], [120, -150], [-70, -200], [175, -60], [-190, -20]].forEach(([dx, dy], i) => twinkle(fx, REST.x + dx, REST.y + dy, { color: "#fff6d6", size: 20 - i * 2, delay: 80 + i * 70, dur: 620 }));
          } else if (rank === "A") {
            [[-90, -80], [100, -100]].forEach(([dx, dy], i) => twinkle(fx, REST.x + dx, REST.y + dy, { color: "#ffd6cf", size: 14, delay: 100 + i * 90, dur: 560 }));
          } else {
            twinkle(fx, REST.x - 6, REST.y - 8, { color: "#fff", size: 10, delay: 60, dur: 480 });
          }
        });
        // カードへの受け渡し: 寄りながら全体が暗くほどけ、その下で賞のカードが開く
        if (onHandoff) once("handoff", T.fade + 60, t, onHandoff);
        node.style.opacity = String(1 - hand);
        if (t >= T.end) resolve();
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
