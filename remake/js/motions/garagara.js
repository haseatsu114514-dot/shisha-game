// シーシャくじのガラガラ（新井式の回転抽選器）。朱の漆と金の金具の六角の胴を斜め前から見せ、
// 側面の厚みは回転に合わせて毎フレーム立体として計算し直す。ハンドルを一度引いてから回し、中の玉が鳴る。
// 止まったら胴を少し送って穴を下へ向け、玉が出る。樋を転がって受け皿へ落ち、弾んで止まる。
// 玉の色が賞を表す（S＝金・A＝赤・B＝青・C＝白・ラストワン＝黒地に銀の輪）。終わると kuji.js が賞の札を出す。
//
// 2026-11-11 オーナー「ソシャゲのガチャや10連ガチャみたいなリッチな演出に」:
// - 舞台は紫の壁に紅白幕と提灯の「くじコーナー」（motions/garagara-stage.js）。抽選器は大きく、色は鮮やかに。
// - 回すあいだ火花が散り、上位の賞は玉が出る前に「溜め」が入る（暗くなって穴から賞の色の光が漏れる）。
// - 玉が受け皿に落ちると賞の色の光の輪・きらめき。S賞とラストワン賞は光の柱と紙吹雪、係の人の鐘。
// - 連続で引くと（ranks を配列で渡す）、玉が次々に出て手前の玉置きに並ぶ。並んだ色が結果の予告になる。
// - 右下の SKIP で演出を飛ばせる。動きを減らす設定では、止まった抽選器と玉だけを短く見せる。
// 道具はすべて同じ斜めの見下ろし（正射影）で描き、動きは1本の requestAnimationFrame で時刻から決める。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { svg, stageSvg, reducedMotion, calmFlash, H } from "../core/transition-kit.js";
import { stageArt, grad, mix, pts, uid, BALL, BALL_EDGE, BALL_HI, LAST_RING, RANK_LIGHT } from "./garagara-stage.js";
import { createFx } from "./kuji-fx.js";

export { BALL };

// 抽選器の色: 朱の漆・黒漆の面・磨いた金の金具（緑は使わない）
const C = {
  shadow: "#07040f",
  lacD: "#4a0b09", lacL: "#de3b22", spec: "#ffe8d6", face: "#170b11", faceHi: "#7a4660",
  brass0: "#7a5416", brass1: "#dcaa3e", brass2: "#fff0b8",
  stand0: "#120a12", stand1: "#3f2538", grip0: "#5a3016", grip1: "#cf9458",
  felt0: "#2a0b1c", felt1: "#63183a",
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

// 時刻（ms）。登場 → ためて引く → 2.6回転 → 止まる →（上位は溜め）→ 少し送って穴を下へ → 玉が出る → 樋 → 受け皿 → 止まる → 札へ
const T = {
  ant: 300, spin: 580, stop: 2060, tilt: 2150, pop: 2390, out: 2490, drop: 2600, fly: 2980, land: 3100,
  rest: 3720, accent: 3620, fade: 4140, end: 4480,
};
const HOLD_AT = T.stop + 90; // 溜めを入れる時刻（胴が止まった直後）
const TURN = 936; // 回す角度（2.6回転）
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
const mixRgb = (rgb, b, k) => {
  const A = rgb.match(/\d+/g).map(Number), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(",")})`;
};
const line = (a, b, attrs) => svg("line", { x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1), ...attrs });

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

// 板ごとの塗りのわずかな差（毎回同じ）
const PANEL_TINT = [0.02, -0.03, 0.01, -0.015, 0.03, -0.02];

/** 胴の側面（6枚）と縁金具・穴、正面（回る面）、ハンドル */
function drumArt(C, defs) {
  const panels = [...Array(6)].map(() => svg("polygon", { "stroke-linejoin": "round" }));
  const shade = [...Array(6)].map(() => svg("polygon", { fill: "" }));
  const gloss = [...Array(6)].map(() => svg("polygon", { opacity: 0 }));
  // 側面の金の細い帯（手前と奥に1本ずつ）
  const stripes = [...Array(12)].map(() => svg("line", { stroke: C.brass1, "stroke-width": 2.4, "stroke-linecap": "round", opacity: 0.8 }));
  const corners = [...Array(6)].map(() => svg("line", { stroke: C.brass1, "stroke-width": 5, "stroke-linecap": "round" }));
  const cornerHi = [...Array(6)].map(() => svg("line", { stroke: C.brass2, "stroke-width": 1.6, "stroke-linecap": "round", opacity: 0.7 }));
  const rims = [...Array(6)].map(() => svg("line", { stroke: C.brass0, "stroke-width": 3.5, "stroke-linecap": "round" }));
  const holeRing = svg("polygon", { fill: C.brass1, stroke: C.brass0, "stroke-width": 1.5 });
  const hole = svg("polygon", { fill: "#050202" });
  const holeGlow = svg("polygon", { fill: "#fff", opacity: 0 });
  const holeLip = svg("polyline", { fill: "none", stroke: C.brass2, "stroke-width": 1.4, opacity: 0.6 });
  // 側面の奥ほど暗く（手前の縁から奥の縁へ）
  const f0 = P(0, 0, FRONT), b0 = P(0, 0, BACK);
  const depth = grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: f0[0], y1: f0[1], x2: b0[0] + (b0[0] - f0[0]) * 0.4, y2: b0[1] + (b0[1] - f0[1]) * 0.4 }, [[0, C.shadow, 0], [1, C.shadow, 0.42]]);
  shade.forEach((s) => s.setAttribute("fill", depth));
  // 漆の照り（手前から奥へ帯のように）
  const glossFill = grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: f0[0], y1: f0[1], x2: b0[0], y2: b0[1] }, [[0, C.spec, 0.1], [0.28, C.spec, 0.75], [0.42, C.spec, 0.12], [1, C.spec, 0]]);
  gloss.forEach((g) => g.setAttribute("fill", glossFill));
  const band = svg("g", {}, [...panels, ...shade, ...gloss, ...stripes, ...rims, ...corners, ...cornerHi, holeRing, hole, holeGlow, holeLip]);

  // 正面: 黒漆の地に朱の六角、金の麻の葉と菊の座。rot の中は胴と一緒に回る
  const hexPts = (r, a0 = 0) => [...Array(6)].map((_, i) => [r * Math.cos((a0 + i * 60) * DEG), r * Math.sin((a0 + i * 60) * DEG)]);
  const brass = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, C.brass2], [0.35, C.brass1], [0.7, C.brass0], [1, C.brass1]]);
  const boss = grad(defs, "radialGradient", { cx: 0.38, cy: 0.34, r: 0.8 }, [[0, C.brass2], [0.5, C.brass1], [1, C.brass0]]);
  const redField = grad(defs, "radialGradient", { cx: 0.42, cy: 0.38, r: 0.75 }, [[0, mix(C.lacL, C.spec, 0.18)], [0.6, C.lacL], [1, mix(C.lacL, C.lacD, 0.7)]]);
  const kites = hexPts(R).map(([x, y], i, all) => {
    const prev = all[(i + 5) % 6], next = all[(i + 1) % 6];
    const d = (p) => { const dx = p[0] - x, dy = p[1] - y, l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
    const a = d(prev), b = d(next);
    return svg("g", {}, [
      svg("polygon", { points: pts([[x, y], [x + a[0] * 32, y + a[1] * 32], [x * 0.78, y * 0.78], [x + b[0] * 32, y + b[1] * 32]]), fill: brass, stroke: C.brass0, "stroke-width": 1.2 }),
      svg("circle", { cx: x * 0.9, cy: y * 0.9, r: 3, fill: C.brass2, stroke: C.brass0, "stroke-width": 1 }),
    ]);
  });
  // 麻の葉: 六角を6つの三角に割り、それぞれ重心から3つの頂点へ線を引く
  const RF = R * 0.76;
  const fieldPts = hexPts(RF);
  const asanoha = fieldPts.flatMap((p, i) => {
    const q = fieldPts[(i + 1) % 6], g = [(p[0] + q[0]) / 3, (p[1] + q[1]) / 3];
    return [[g, [0, 0]], [g, p], [g, q], [[0, 0], p]].map(([a, b]) => svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
  });
  const petals = [...Array(16)].map((_, i) => svg("ellipse", { cx: 0, cy: -36, rx: 6.4, ry: 15, fill: i % 2 ? C.brass1 : mix(C.brass1, C.brass2, 0.45), stroke: C.brass0, "stroke-width": 0.8, transform: `rotate(${i * 22.5})` }));
  const rot = svg("g", {}, [
    svg("polygon", { points: pts(hexPts(R)), fill: C.face }),
    svg("polygon", { points: pts(fieldPts), fill: redField, stroke: C.brass1, "stroke-width": 2.4, "stroke-linejoin": "round" }),
    svg("g", { stroke: C.brass2, "stroke-width": 1.5, "stroke-opacity": 0.62, "stroke-linecap": "round" }, asanoha),
    svg("polygon", { points: pts(hexPts(RF * 0.5, 30)), fill: "none", stroke: C.brass2, "stroke-width": 1.2, opacity: 0.5 }),
    svg("circle", { r: 54, fill: C.face, stroke: C.brass1, "stroke-width": 2 }),
    ...petals,
    svg("polygon", { points: pts(hexPts(R - 4)), fill: "none", stroke: brass, "stroke-width": 9, "stroke-linejoin": "round" }),
    svg("polygon", { points: pts(hexPts(R - 9.5)), fill: "none", stroke: C.brass0, "stroke-width": 1.4, "stroke-linejoin": "round" }),
    ...kites,
  ]);
  // 回らない光沢（上からの光が面に映る）
  const sheenClip = uid("gg-clip");
  const sheenPoly = svg("polygon");
  defs.append(svg("clipPath", { id: sheenClip }, [sheenPoly]));
  const sheen = svg("g", { "clip-path": `url(#${sheenClip})` }, [
    svg("rect", { x: -R, y: -R, width: R * 2, height: R * 2, fill: grad(defs, "linearGradient", { gradientUnits: "userSpaceOnUse", x1: -R, y1: -R, x2: R * 0.6, y2: R }, [[0, "#ffffff", 0.34], [0.32, "#ffffff", 0.05], [0.55, "#ffffff", 0], [1, C.shadow, 0.42]]) }),
    // 斜めに走る細い映り込み
    svg("polygon", { points: pts([[-R, -R * 0.18], [-R * 0.1, -R], [R * 0.16, -R], [-R, R * 0.12]]), fill: "#fff", opacity: 0.07 }),
  ]);
  const face = svg("g", { transform: plane(FRONT) }, [rot, sheen]);
  // 軸と金の軸頭（手前の台枠の外）
  const cap = svg("g", { transform: plane(SFRAME + 4) }, [
    svg("circle", { r: 26, fill: C.stand0 }),
    svg("circle", { r: 21, fill: boss, stroke: C.brass0, "stroke-width": 1.5 }),
    svg("circle", { r: 12, fill: "none", stroke: C.brass0, "stroke-width": 1, opacity: 0.6 }),
    svg("circle", { cx: -6, cy: -7, r: 7, fill: "#fff", opacity: 0.4 }),
  ]);
  // ハンドル: 金の腕と木の握り（握りは軸と平行に手前へ伸びる）
  const ARM = { len: 98, a: -128 };
  const arm = svg("g", {}, [
    svg("line", { x1: 0, y1: 0, x2: ARM.len, y2: 0, stroke: C.brass0, "stroke-width": 15, "stroke-linecap": "round" }),
    svg("line", { x1: 0, y1: -1, x2: ARM.len, y2: -1, stroke: C.brass1, "stroke-width": 10, "stroke-linecap": "round" }),
    svg("line", { x1: 6, y1: -3, x2: ARM.len - 6, y2: -3, stroke: C.brass2, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.75 }),
    svg("circle", { r: 15, fill: boss, stroke: C.brass0, "stroke-width": 1.5 }),
  ]);
  const armRot = svg("g", {}, [arm]);
  const crank = svg("g", { transform: plane(CRANK) }, [armRot]);
  const gripShadow = svg("line", { stroke: C.shadow, "stroke-width": 27, "stroke-linecap": "round", opacity: 0.4, transform: "translate(3 4)" });
  const gripBody = svg("line", { stroke: C.grip0, "stroke-width": 23, "stroke-linecap": "round" });
  const gripMid = svg("line", { stroke: C.grip1, "stroke-width": 11, "stroke-linecap": "round", opacity: 0.85, transform: "translate(-1 -2)" });
  const gripHi = svg("line", { stroke: "#ffe2bd", "stroke-width": 3.2, "stroke-linecap": "round", opacity: 0.6, transform: "translate(-3 -6)" });
  const gripEnd = svg("ellipse", { fill: C.grip1, stroke: C.grip0, "stroke-width": 2, rx: 10, ry: 12 });
  const grip = svg("g", {}, [gripShadow, gripBody, gripMid, gripHi, gripEnd]);
  const setLine = (n, a, b) => { n.setAttribute("x1", a[0]); n.setAttribute("y1", a[1]); n.setAttribute("x2", b[0]); n.setAttribute("y2", b[1]); };

  return {
    back: band, face, cap, crank, grip,
    /** 穴から漏れる光（k: 0〜1、color は賞の光） */
    glow(k, color) {
      holeGlow.setAttribute("fill", color);
      holeGlow.setAttribute("opacity", clamp(k).toFixed(3));
    },
    /** 角度 th（度）で描き直す */
    pose(th) {
      const vtx = (i, w) => P(R * Math.cos((th + i * 60) * DEG), R * Math.sin((th + i * 60) * DEG), w);
      const seen = [];
      for (let k = 0; k < 6; k++) {
        const b = (th + 30 + k * 60) * DEG;
        const n = view(Math.cos(b), -Math.sin(b), 0);
        const vis = n[2] > 0.015;
        seen[k] = vis;
        panels[k].style.display = shade[k].style.display = gloss[k].style.display = rims[k].style.display = stripes[k * 2].style.display = stripes[k * 2 + 1].style.display = vis ? "" : "none";
        if (!vis) continue;
        const q = pts([vtx(k, FRONT), vtx(k + 1, FRONT), vtx(k + 1, BACK), vtx(k, BACK)]);
        const lam = clamp(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        // 照りは広い帯。板ごとに塗りの色がわずかに違う
        const sp = clamp((n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]) / SPEC_MAX) ** 5;
        const base = mix(C.lacD, C.lacL, 0.24 + lam * 0.78 + PANEL_TINT[k]);
        panels[k].setAttribute("points", q);
        panels[k].setAttribute("fill", mixRgb(base, C.spec, sp * 0.3));
        shade[k].setAttribute("points", q);
        gloss[k].setAttribute("points", q);
        gloss[k].setAttribute("opacity", (0.05 + 0.3 * lam ** 2).toFixed(3));
        setLine(stripes[k * 2], vtx(k, FRONT - 20), vtx(k + 1, FRONT - 20));
        setLine(stripes[k * 2 + 1], vtx(k, BACK + 20), vtx(k + 1, BACK + 20));
        setLine(rims[k], vtx(k, BACK), vtx(k + 1, BACK));
      }
      for (let k = 0; k < 6; k++) {
        const vis = seen[k] || seen[(k + 5) % 6];
        corners[k].style.display = cornerHi[k].style.display = vis ? "" : "none";
        if (!vis) continue;
        const a = vtx(k, FRONT), b = vtx(k, BACK);
        setLine(corners[k], a, b);
        setLine(cornerHi[k], [a[0] - 1, a[1] - 1.2], [b[0] - 1, b[1] - 1.2]);
      }
      // 側面の穴（0番の面の中央）
      const hb = (th + 30) * DEG, ap = R * Math.cos(30 * DEG);
      const hole3 = (rr) => [...Array(18)].map((_, i) => {
        const s = (i / 18) * Math.PI * 2;
        const t = rr * Math.cos(s);
        return P(ap * Math.cos(hb) - t * Math.sin(hb), ap * Math.sin(hb) + t * Math.cos(hb), HW + rr * Math.sin(s));
      });
      for (const n of [holeRing, hole, holeGlow, holeLip]) n.style.display = seen[0] ? "" : "none";
      if (seen[0]) {
        holeRing.setAttribute("points", pts(hole3(BALL_R + 9)));
        hole.setAttribute("points", pts(hole3(BALL_R + 3)));
        holeGlow.setAttribute("points", pts(hole3(BALL_R + 3)));
        holeLip.setAttribute("points", pts(hole3(BALL_R + 3).slice(0, 10)));
      }
      rot.setAttribute("transform", `rotate(${th.toFixed(2)})`);
      sheenPoly.setAttribute("points", pts(hexPts(R - 8, th)));
      armRot.setAttribute("transform", `rotate(${(th + ARM.a).toFixed(2)})`);
      // 握り: 腕の先から手前へ
      const ga = (th + ARM.a) * DEG;
      const gx = ARM.len * Math.cos(ga), gy = ARM.len * Math.sin(ga);
      const p1 = P(gx, gy, CRANK + 2), p2 = P(gx, gy, CRANK + 70);
      for (const n of [gripShadow, gripBody, gripMid, gripHi]) setLine(n, p1, p2);
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

/** 玉（塗りの球）。g は位置、body は弾むときの伸び縮み（下端を支点にする）、halo は賞の色のにじみ。ラストワンは黒地に銀の輪 */
function ballArt(rank, defs, C) {
  const k = BALL[rank] ? rank : "C";
  const fill = grad(defs, "radialGradient", { cx: 0.36, cy: 0.32, r: 0.82 }, [[0, BALL_HI[k]], [0.38, BALL[k]], [0.86, BALL_EDGE[k]], [1, BALL_EDGE[k]]]);
  const light = RANK_LIGHT[k];
  const halo = svg("circle", { r: BALL_R * 3.4, fill: grad(defs, "radialGradient", {}, [[0, light[1], 0.95], [0.3, light[0], 0.6], [1, light[0], 0]]), opacity: 0 });
  const body = svg("g", {}, [
    svg("circle", { r: BALL_R, fill }),
    ...(k === "LAST" ? [
      // 赤道の銀の輪（手前の半分だけ見える）
      svg("path", { d: `M ${-BALL_R} 0 A ${BALL_R} ${BALL_R * 0.34} 0 0 0 ${BALL_R} 0`, fill: "none", stroke: LAST_RING, "stroke-width": 1.8, transform: "rotate(-16)" }),
    ] : []),
    // 下の照り返し、縁の光、上の映り込み
    svg("ellipse", { cx: 2, cy: 9, rx: 8, ry: 3.5, fill: "#fff", opacity: 0.14 }),
    svg("path", { d: `M ${BALL_R * 0.55} ${-BALL_R * 0.72} A ${BALL_R * 0.92} ${BALL_R * 0.92} 0 0 1 ${BALL_R * 0.86} ${BALL_R * 0.3}`, fill: "none", stroke: "#fff", "stroke-width": 1.4, "stroke-linecap": "round", opacity: k === "LAST" ? 0.35 : 0.45 }),
    svg("ellipse", { cx: -5, cy: -6, rx: 5.6, ry: 3.6, fill: "#fff", opacity: k === "LAST" ? 0.5 : 0.78, transform: "rotate(-35 -5 -6)" }),
    svg("circle", { cx: -7.5, cy: -2, r: 1.3, fill: "#fff", opacity: 0.7 }),
  ]);
  const g = svg("g", { opacity: 0 }, [halo, body]);
  const shadow = svg("ellipse", { rx: 13, ry: 13, fill: C.shadow, opacity: 0 });
  return { g, body, halo, shadow, rank: k, light };
}

/** 係の人の手持ちの鐘（真鍮の鐘に木の柄）。柄の上は画面の外で、手首を支点に振る */
function bellArt(C, defs) {
  const wood = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.grip0], [0.35, C.grip1], [0.75, C.grip0], [1, mix(C.grip0, C.shadow, 0.5)]]);
  const metal = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, mix(C.brass0, C.shadow, 0.35)], [0.28, mix(C.brass1, C.brass2, 0.4)], [0.5, C.brass1], [0.82, C.brass0], [1, mix(C.brass0, C.shadow, 0.5)]]);
  const inside = grad(defs, "radialGradient", { cx: 0.5, cy: 0.2, r: 0.8 }, [[0, mix(C.brass0, C.shadow, 0.75)], [1, mix(C.brass0, C.shadow, 0.25)]]);
  const MY = 236; // 鐘の口の高さ
  const mouthClip = uid("gg-clip");
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

/** 時刻 t（ms）の胴の角度（1回引き）。ためて引く → 回す → 止まり際に揺れ戻る → 穴を下へ送る → 玉が抜けて小さく揺れる */
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


/** 連続で引くときの玉置き（手前の細長い盆）。出た玉が順に並ぶ。座標は画面で決め、toLocal で道具の座標へ直す */
function railArt(C, defs, n, toLocal) {
  const gap = Math.min(78, 920 / n), y = 646;
  const xs = [...Array(n)].map((_, i) => 640 + (i - (n - 1) / 2) * gap);
  const [x0, y0] = toLocal([xs[0] - 46, y - 24]), [x1, y1] = toLocal([xs[n - 1] + 46, y + 24]);
  const lac = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#3d2434"], [0.5, "#1c1019"], [1, "#0d070c"]]);
  const rim = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.brass0], [0.3, C.brass1], [0.5, C.brass2], [0.7, C.brass1], [1, C.brass0]]);
  const pit = grad(defs, "radialGradient", { cx: 0.5, cy: 0.4, r: 0.6 }, [[0, "#000", 0.8], [1, "#000", 0.2]]);
  const g = svg("g", {}, [
    svg("rect", { x: x0 + 5, y: y0 + 9, width: x1 - x0, height: y1 - y0, rx: 24, fill: C.shadow, opacity: 0.55 }),
    svg("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 24, fill: lac, stroke: rim, "stroke-width": 3 }),
    svg("rect", { x: x0 + 14, y: y0 + 5, width: x1 - x0 - 28, height: 2, rx: 1, fill: "#fff", opacity: 0.16 }),
    ...xs.map((x) => { const [sx, sy] = toLocal([x, y + 5]); return svg("ellipse", { cx: sx, cy: sy, rx: 20, ry: 9, fill: pit, stroke: C.brass0, "stroke-width": 1 }); }),
  ]);
  // 並んだ数（盆の左上に「3 / 10」）
  const count = svg("text", { x: x0 + 14, y: y0 - 12, "font-family": "Suien Gothic, sans-serif", "font-weight": 800, "font-size": 24, "letter-spacing": 1, fill: C.brass2, stroke: C.shadow, "stroke-width": 4, "paint-order": "stroke", opacity: 0.95 });
  count.textContent = `0 / ${n}`;
  g.append(count);
  return { g, at: (i) => toLocal([xs[i], y - 10]), count(k) { count.textContent = `${k} / ${n}`; } };
}

/** S賞・ラストワン賞の光の柱（受け皿の玉から立ちのぼる） */
function pillarArt(defs, light) {
  const [x, y] = P(...REST);
  const up = { x1: 0, y1: 1, x2: 0, y2: 0 };
  const g = svg("g", { opacity: 0 }, [
    svg("ellipse", { cx: x, cy: y + 12, rx: 130, ry: 36, fill: grad(defs, "radialGradient", {}, [[0, light[1], 0.85], [0.5, light[0], 0.35], [1, light[0], 0]]) }),
    svg("polygon", { points: pts([[x - 34, y + 10], [x + 34, y + 10], [x + 92, y - 660], [x - 92, y - 660]]), fill: grad(defs, "linearGradient", up, [[0, light[0], 0.7], [0.6, light[0], 0.22], [1, light[0], 0]]) }),
    svg("polygon", { points: pts([[x - 10, y + 8], [x + 10, y + 8], [x + 26, y - 660], [x - 26, y - 660]]), fill: grad(defs, "linearGradient", up, [[0, light[1], 0.95], [0.7, light[1], 0.3], [1, light[1], 0]]) }),
  ]);
  return { g };
}

const isTop = (r) => r === "S" || r === "LAST";
// 賞ごとの光の強さ（落ちた瞬間の染まり・そのあとの染まり・玉のにじみ）
const MOOD = { S: [1, 0.6, 1], LAST: [1, 0.6, 1], A: [0.8, 0.34, 0.8], B: [0.42, 0.14, 0.5], C: [0, 0, 0.22] };

/**
 * host に全面の層を置いてガラガラを回し、賞の玉を出す。終わると層を外す。
 * rankOrRanks が配列（2つ以上）なら連続で引く演出になり、玉が順に出て手前の玉置きに並ぶ。
 * onHandoff は消え始めに一度呼ぶ（くじの札を下で開いて、重ねながら受け渡す）。SKIP を押した時もすぐ呼ぶ。
 * 1回引きで "LAST"（ラストワン賞）のときは、景品表がラストワン賞に変わり、最初に係の人が鐘を鳴らしてから回す。
 * 動きを減らす設定では、止まった抽選器と玉だけを短く見せる。
 */
export async function garagara(host, rankOrRanks = "C", { onHandoff } = {}) {
  const ranks = (Array.isArray(rankOrRanks) ? rankOrRanks : [rankOrRanks]).map((r) => (BALL[r] ? r : "C"));
  const multi = ranks.length > 1;
  const reduced = reducedMotion();
  const calm = calmFlash();
  const rank = ranks[0];
  const last = !multi && rank === "LAST";
  const top = !multi && isTop(rank);
  const defs = svg("defs"), backDefs = svg("defs");
  const set = stageArt(backDefs, { last });
  const stand = standArt(C, defs);
  const drum = drumArt(C, defs);
  const chute = chuteArt(C, defs);
  const dish = dishArt(C, defs);
  const balls = ranks.map((r) => ballArt(r, defs, C));
  const bell = bellArt(C, defs);
  // 道具一式の置き方: 1回引きは大きく寄せ、連続は手前の玉置きのぶん少し上へ
  const ZOOM = multi ? 1 : 1.14, ZX = CX, ZY = 560, DX = multi ? 76 : 44, DY = multi ? -26 : 4;
  const zoomed = ([x, y]) => [ZX + (x - ZX) * ZOOM + DX, ZY + (y - ZY) * ZOOM + DY];
  const toLocal = ([x, y]) => [(x - DX - ZX) / ZOOM + ZX, (y - DY - ZY) / ZOOM + ZY];
  const rail = multi ? railArt(C, defs, ranks.length, toLocal) : null;
  const pillar = pillarArt(defs, balls[0].light);
  // 回る道具一式（登場で据わり、回すと震える）と、手前に来る樋の壁・皿の縁
  const rig = svg("g", {}, [stand.base, stand.back, drum.back, drum.face, chute.back, stand.frontLegs, drum.cap, drum.crank, drum.grip, dish.back]);
  const rigFront = svg("g", {}, [chute.front, dish.front]);
  const props = svg("g", { transform: `translate(${DX} ${DY}) translate(${ZX} ${ZY}) scale(${ZOOM}) translate(${-ZX} ${-ZY})` },
    [rig, rail?.g, pillar.g, ...balls.map((b) => b.shadow), ...balls.map((b) => b.g), rigFront]);
  // 舞台は別の SVG（描くのは一度だけ）。寄りは、抽選器は SVG の中の変形（線をくっきり保つ）、舞台は要素ごとの変形で合わせる
  const backdrop = stageSvg([backDefs, set.back]);
  backdrop.classList.add("kj-back");
  const cam = svg("g", {}, [props]);
  cam.style.transformBox = "view-box";
  const art = stageSvg([defs, cam, bell.g]);
  const flash = el("div.kj-flash", { "aria-hidden": "true" });
  let skipped = false;
  const skip = el("button.kj-skip", { type: "button", text: "SKIP", "aria-label": "演出をとばす", dataset: { test: "kuji-skip" },
    onclick: (e) => { e.stopPropagation(); skipped = true; SE.click(); } });
  const node = el("div.mo-garagara", { dataset: { motion: "garagara", mode: multi ? "multi" : "single" } }, [backdrop, art, ...set.overlays, flash, ...(reduced ? [] : [skip])]);
  if (!reduced) node.style.opacity = "0";
  host.append(node);
  const fx = reduced ? null : createFx(node);
  if (fx) node.insertBefore(fx.canvas, flash);

  const placeXY = (ball, [x, y], sx = 1, sy = sx) => {
    ball.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    // 伸び縮みは玉の下端を支点に
    ball.body.setAttribute("transform", `translate(0 ${(BALL_R * (1 - sy)).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
  };
  const place = (ball, [u, s, w], sx = 1, sy = 1) => placeXY(ball, P(u, s, w), sx, sy);
  /** 影: 高さ gs の面に、玉の真下から（air は宙に浮いている高さの割合） */
  const shade = (ball, [u, , w], gs, air = 0) => {
    ball.shadow.setAttribute("transform", hplane(gs));
    ball.shadow.setAttribute("cx", (u + 3).toFixed(1));
    ball.shadow.setAttribute("cy", (w + 2).toFixed(1));
    ball.shadow.setAttribute("rx", (12 * (1 + air * 0.5)).toFixed(1));
    ball.shadow.setAttribute("ry", (12 * (1 + air * 0.5)).toFixed(1));
    ball.shadow.setAttribute("opacity", (0.45 * (1 - clamp(air) * 0.75)).toFixed(2));
  };
  // 画面の座標（粒子はカメラの外の canvas に描くので、寄りを掛けた位置へ直す）
  let camSc = 1, camOx = CX, camOy = H / 2;
  const onScreen = (local) => { const [x, y] = zoomed(local); return [camOx + (x - camOx) * camSc, camOy + (y - camOy) * camSc]; };
  const gutter = Math.max(0, ((node.clientWidth || 1280) - 1280) / 2); // ワイドステージの左右の余白（舞台の SVG は余白まで広がる）
  /** カメラ: (ox, oy) を中心に sc 倍。抽選器と舞台へ同じ寄りを掛ける */
  const aim = (sc, ox, oy) => {
    camSc = sc; camOx = ox; camOy = oy;
    cam.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
    cam.style.transform = `scale(${sc.toFixed(4)})`;
    backdrop.style.transformOrigin = `${(ox + gutter).toFixed(1)}px ${oy.toFixed(1)}px`;
    backdrop.style.transform = `scale(${sc.toFixed(4)})`;
  };
  const flashNow = (color, strength = 0.8, ms = 420) => {
    if (calm) return;
    flash.style.background = color;
    flash.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: "cubic-bezier(.2,.7,.2,1)" });
  };
  const RAIL_SC = 17 / BALL_R; // 玉置きに並んだ玉の大きさ

  let raf = 0;
  try {
    if (reduced) {
      drum.pose(TILT);
      if (multi) { rail.count(balls.length); balls.forEach((b, i) => { placeXY(b, rail.at(i), RAIL_SC); b.g.setAttribute("opacity", 1); b.halo.setAttribute("opacity", MOOD[b.rank][2] * 0.6); }); }
      else { place(balls[0], REST); balls[0].g.setAttribute("opacity", 1); shade(balls[0], REST, DISH.floor); balls[0].halo.setAttribute("opacity", MOOD[rank][2] * 0.6); }
      if (ranks.some(isTop)) { bell.pose(BELL_X, BELL_Y, 0, 0); bell.g.setAttribute("opacity", 1); SE.just(); }
      await sleep(900);
      return;
    }
    // ここから先は時刻だけで決める（音と粒子は時刻を一度だけ越えたときに出す）
    const fired = new Set();
    const once = (key, at, t, fn) => { if (t >= at && !fired.has(key)) { fired.add(key); fn(); } };
    let prevTh = 0, prevT = 0, om = 0, rattle = 0, sparkAcc = 0, kickAt = -1e9, kickAmp = 0;
    const kick = (amp, now) => { if (!calm) { kickAt = now; kickAmp = amp; } };
    /** 胴を角度 th に置き、速さから震え・残像・ふちの火花・中の玉の音を出す */
    const spinDrum = (th, all, rise, rattling) => {
      const dt = Math.max(1, all - prevT);
      om = lerp(om, ((th - prevTh) / dt) * 1000, 0.35);
      rattle = rattling ? rattle + Math.abs(th - prevTh) : 0;
      prevTh = th; prevT = all;
      const tremor = clamp(Math.abs(om) / 700) * 1.3;
      const kd = all - kickAt, kk = kd < 400 ? kickAmp * Math.exp(-kd / 90) : 0;
      const shake = `translate(${(Math.sin(all * 0.09) * tremor + kk * Math.sin(kd * 0.085)).toFixed(2)} ${(rise + Math.cos(all * 0.13) * tremor * 0.6 + kk * Math.cos(kd * 0.11)).toFixed(2)})`;
      rig.setAttribute("transform", shake);
      rigFront.setAttribute("transform", shake);
      drum.pose(th);
      if (rattle > 70) { rattle = 0; SE.crackle(); }
      sparkAcc += clamp((Math.abs(om) - 380) / 600) * dt * 0.045;
      while (sparkAcc >= 1) {
        sparkAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        const [x, y] = onScreen(P(R * Math.cos(a), R * Math.sin(a), FRONT));
        const streak = Math.random() < 0.6;
        fx.burst(x, y, { n: 1, colors: [C.brass2, "#ffffff", "#ffd27a"], kind: streak ? "streak" : "spark", speed: [180, 420], angle: a + (Math.PI / 2) * Math.sign(om || 1), spread: 0.4, gravity: 520, life: [0.2, 0.45], size: streak ? [1.4, 2.6] : [6, 13] });
      }
    };
    // 鐘（上位の賞で係の人が振る）。rings は鳴らし始める時刻（全体の時刻）
    const HZ = 5; // 振る速さ（往復/秒）
    const bellAt = (t, rings) => {
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
    const ringBell = (all, rings) => {
      const bp = bellAt(all, rings);
      if (!bp) { bell.g.setAttribute("opacity", 0); return; }
      bell.pose(bp.x, bp.y, bp.a, bp.c);
      bell.g.setAttribute("opacity", 1);
      if (bp.r != null) {
        const hit = Math.floor((bp.r / 1000) * HZ * 2 + 0.5); // 振り切るたびに舌が当たる
        if (hit % 2 === 1) once(`bell${bp.i}-${hit}`, 0, 1, () => (hit === 1 ? SE.just : SE.reelWin)());
      }
    };
    const handoff = () => { if (onHandoff) once("handoff", 0, 1, onHandoff); };

    // ---- 1回引き ----
    const playSingle = () => new Promise((resolve) => {
      const ball = balls[0], light = ball.light, mood = MOOD[rank];
      const OFF = last ? 760 : 0; // ラストワンは先に鐘を鳴らすぶん遅らせる
      const HOLD = top ? 640 : rank === "A" ? 230 : 0; // 玉が出る前の溜め
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
      const rings = top ? [...(last ? [80] : []), OFF + HOLD + T.land - 40] : [];
      const [ax, ay] = zoomed(P(...REST));
      const END = OFF + HOLD + T.end;
      const holeLocal = P(HOLE.u, HOLE.s, HW);
      let teaseAcc = 0, twinkleAcc = 0, prevAll = 0;
      const t0 = performance.now();
      SE.kujiCharge((OFF + T.stop - 200) / 1000);
      const frame = (now) => {
        const all = now - t0;
        if (skipped) { handoff(); resolve(); return; }
        const dms = all - prevAll; prevAll = all;
        const raw = all - OFF;
        const holding = HOLD > 0 && raw >= HOLD_AT && raw < HOLD_AT + HOLD;
        const held = HOLD > 0 && raw >= HOLD_AT + HOLD;
        const holdK = HOLD ? seg(raw, HOLD_AT, HOLD_AT + HOLD) : 0;
        const t = raw < HOLD_AT || !HOLD ? raw : holding ? HOLD_AT : raw - HOLD; // 抽選器の時刻（溜めのあいだは止まる）
        // 登場: 全体がふっと見え（前の札の上に重なって入れ替わる）、台がわずかに沈んで据わる
        const inK = seg(all, 0, 420);
        const fadeIn = smooth(seg(all, 0, 300));
        // カメラ: 回すあいだじわりと寄り、溜めで穴へ、玉が受け皿へ向かうと皿へ寄る（寄り切ってから少し沈む）
        const push = inOutSine(seg(t, T.fly - 200, T.rest + 260));
        const hand = smooth(seg(t, T.fade, T.end));
        const lean = 0.04 * smooth(seg(t, T.spin, T.stop)) + (holding ? 0.075 * Math.sin(Math.PI * holdK) : 0);
        aim(1 + lean * (1 - push) + 0.22 * push + 0.07 * hand, lerp(CX + 90, ax, push), lerp(H / 2 + 20, ay, push));
        // 胴の角度。溜めのあいだは小さく震える
        let th = angleAt(Math.max(0, t));
        if (holding) th += 1.6 * Math.sin(all * 0.085) * Math.sin(Math.PI * holdK);
        spinDrum(th, all, 8 * (1 - outCubic(clamp(inK))), t >= T.spin && t < T.stop + 100);
        once("lever", T.ant, t, () => SE.reelLever());
        once("go", T.spin + 40, t, () => SE.whoosh());
        once("stop", T.stop, t, () => SE.reelStop());
        // 溜め: 上位は暗くなって、穴から賞の色の光と火花が漏れる
        if (HOLD) {
          once("hold", HOLD_AT, raw, () => { if (top) { SE.heartbeat(); SE.kujiShimmer(10); } else SE.kujiShimmer(4); });
          drum.glow(holding ? holdK : held ? 1 - seg(t, T.pop, T.out + 160) : 0, light[1]);
          set.dim(top && holding ? 0.52 * Math.sin(Math.PI * Math.min(1, holdK * 1.1)) ** 0.7 : 0);
          if (holding) {
            teaseAcc += dms;
            while (teaseAcc > (top ? 55 : 80)) {
              teaseAcc -= top ? 55 : 80;
              const [hx, hy] = onScreen(holeLocal);
              fx.stars(hx, hy, { n: 1, colors: [light[1], light[0]], rx: 26 + 60 * holdK, ry: 22 + 50 * holdK, size: [8, 14 + 16 * holdK], delay: 0 });
              fx.burst(hx, hy, { n: top ? 2 : 1, colors: light, speed: [60, 220 + 200 * holdK], angle: 0.6, spread: 1.4, gravity: 120, life: [0.3, 0.7], size: [8, 18] });
            }
          }
          once("release", HOLD_AT + HOLD, raw, () => {
            if (!top) return;
            SE.kujiImpact();
            flashNow(light[1], 0.42, 320);
            kick(5, all);
            const [hx, hy] = onScreen(holeLocal);
            fx.burst(hx, hy, { n: 30, colors: light, kind: "streak", speed: [260, 620], spread: Math.PI, gravity: 200, life: [0.25, 0.5], size: [1.6, 3] });
          });
        }
        once("pop", T.pop, t, () => {
          SE.punch();
          const [hx, hy] = onScreen(holeLocal);
          fx.burst(hx, hy, { n: top ? 26 : rank === "A" ? 16 : 8, colors: light, speed: [80, 300], angle: 0.5, spread: 1.2, gravity: 320, life: [0.3, 0.7], size: [8, 18] });
        });
        once("chute", T.drop, t, () => { SE.click(); SE.pour(); });
        impacts.slice(0, 3).forEach(([at], i) => once(`hit${i}`, at, t, () => SE.click()));
        // 玉と影、賞の色のにじみ
        const b = ballAt(t);
        if (b) {
          const [sx, sy] = squash(t);
          place(ball, b.p, b.sc * sx, b.sc * sy);
          ball.g.setAttribute("opacity", 1);
          if (b.g != null) shade(ball, b.gp || b.p, b.g, b.air || 0);
          else ball.shadow.setAttribute("opacity", 0);
          const shown = top || rank === "A" ? 1 : seg(t, T.land - 40, T.land + 120);
          ball.halo.setAttribute("opacity", (mood[2] * shown * (0.82 + 0.18 * Math.sin(all * 0.011))).toFixed(3));
          // 上位の玉は光の尾を引く
          if ((top || rank === "A") && t < T.land) {
            const [bx, by] = onScreen(P(...b.p));
            fx.burst(bx, by, { n: 1, colors: light, speed: [10, 60], spread: Math.PI, gravity: 60, life: [0.25, 0.5], size: [8, 16] });
          }
        }
        // 着地: 賞の色の光の輪ときらめき。上位は光の柱・紙吹雪・画面の揺れ
        once("land", T.land, t, () => {
          const [lx, ly] = onScreen(P(...LAND));
          fx.ring(lx, ly + 12, { color: light[1], r1: 60 + 90 * mood[0], width: 4 + 6 * mood[0], life: 0.45, flat: 0.36 });
          fx.burst(lx, ly, { n: Math.round(6 + 46 * mood[0]), colors: light, speed: [90, 240 + 380 * mood[0]], angle: -Math.PI / 2, spread: 1.25, gravity: 520, life: [0.4, 1], size: [8, 20] });
          if (rank === "C") { SE.good(); return; }
          fx.stars(lx, ly - 10, { n: Math.round(3 + 12 * mood[0]), colors: [light[1], light[0]], rx: 60 + 80 * mood[0], ry: 50 + 60 * mood[0], size: [10, 30], delay: 0.5 });
          if (rank === "B") { SE.reelWin(); return; }
          fx.ring(lx, ly + 12, { color: light[0], r1: 300, width: 8, life: 0.7, flat: 0.36 });
          kick(top ? 7 : 3.5, all);
          flashNow(light[1], top ? 0.7 : 0.35, top ? 460 : 300);
          SE.kujiRare();
          if (top) { SE.kujiShimmer(14); fx.confetti([light[0], light[1], light[2], "#ffffff", "#de3b22"], { seconds: 1.6, perSecond: 52 }); }
        });
        once("accent", T.accent, t, () => { if (top) SE.crowd(1.2); });
        // 止まった玉のまわりのきらめき（上位ほど多い）
        if (t > T.land + 200 && rank !== "C") {
          twinkleAcc += dms;
          const every = top ? 90 : rank === "A" ? 150 : 300;
          while (twinkleAcc > every) {
            twinkleAcc -= every;
            const [bx, by] = onScreen(P(...REST));
            fx.stars(bx, by - 6, { n: 1, colors: [light[1], light[0]], rx: 80 + 70 * mood[0], ry: 60 + 60 * mood[0], size: [8, 22 + 10 * mood[0]], delay: 0 });
          }
        }
        // 舞台の染まり: 上位は溜めで色が差し、落ちた瞬間にいちばん強くなって落ち着く
        const landK = t >= T.land ? Math.exp(-(t - T.land) / 520) : 0;
        const base = top ? (holding ? 0.7 * holdK : held ? 0.55 : 0) : 0;
        set.mood(Math.max(base, t >= T.land ? mood[1] + (mood[0] - mood[1]) * landK : 0), light[0]);
        pillar.g.setAttribute("opacity", (top ? smooth(seg(t, T.land, T.land + 180)) * (0.78 + 0.22 * Math.sin(all * 0.013)) : 0).toFixed(3));
        ringBell(all, rings);
        // 札への受け渡し: 白く光って全体がほどけ、その下で賞の札が開く
        once("handoff", T.fade + 60, t, () => {
          flashNow("#ffffff", top ? 0.9 : rank === "A" ? 0.6 : 0.3, 380);
          onHandoff?.();
        });
        node.style.opacity = String(fadeIn * (1 - hand));
        if (all >= END) resolve();
        else raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });

    // ---- 連続で引く ----
    const playMulti = () => new Promise((resolve) => {
      const n = ranks.length;
      const best = ranks.includes("S") ? "S" : ranks.includes("LAST") ? "LAST" : ranks.includes("A") ? "A" : null;
      const bestLight = best ? RANK_LIGHT[best] : null;
      const INT = n > 6 ? 280 : 340; // 玉が出る間隔（1回転で1つ）
      const FIRST = T.spin + 760; // 最初の玉が出る時刻
      const OM = 360 / INT; // 回る速さ（度/ms）
      const popAt = (i) => FIRST + i * INT;
      const LASTPOP = popAt(n - 1);
      const RAMP = T.spin + 400, DECEL = 560;
      const lineAt = (t) => TILT + OM * (t - FIRST); // 一定の速さで回るあいだの角度（玉が出る時刻に穴が下へ来る）
      const A0 = lineAt(RAMP) - (OM * (RAMP - T.spin)) / 2;
      const angle = (t) => {
        if (t >= LASTPOP) { const d = Math.min(DECEL, t - LASTPOP); return lineAt(LASTPOP) + OM * (d - (d * d) / (2 * DECEL)); }
        if (t >= RAMP) return lineAt(t);
        if (t >= T.spin) { const d = RAMP - t; return lineAt(RAMP) - OM * d + (OM * d * d) / (2 * (RAMP - T.spin)); }
        return A0 + PULL * (1 - inOutSine(seg(t, T.ant, T.spin)));
      };
      // 玉1つの動き（出てからの ms）。穴 → 樋 → 受け皿でひと弾み → 弧を描いて玉置きへ
      const B = { out: 70, drop: 150, fly: 430, land: 530, hop: 680, go: 730, into: 1120 };
      const HOPPED = [lerp(LAND[0], REST[0], 0.6), LAND[1], lerp(LAND[2], REST[2], 0.6)];
      const fromXY = P(...HOPPED);
      const track = (i, tau) => {
        if (tau < B.out) { const k = outCubic(tau / B.out); return { p: [lerp(HOLE.u, EXIT[0], k), lerp(HOLE.s, EXIT[1], k), HW], sc: lerp(0.55, 1, k) }; }
        if (tau < B.drop) {
          const k = seg(tau, B.out, B.drop), [fu, fs, fw] = chute.floorAt(0.02);
          return { p: [lerp(EXIT[0], fu, k), lerp(EXIT[1], fs - BALL_R, k * k), lerp(HW, fw, k)], sc: 1, g: fs, gp: [fu, fs, fw], air: 1 - k * k };
        }
        if (tau < B.fly) {
          const k = seg(tau, B.drop, B.fly), [u, s, w] = chute.floorAt(0.02 + 0.98 * (0.55 * k + 0.45 * k * k));
          return { p: [u, s - BALL_R, w], sc: 1, g: s };
        }
        if (tau < B.land) {
          const k = seg(tau, B.fly, B.land), [u0, s0, w0] = chute.floorAt(1);
          return { p: [lerp(u0, LAND[0], k), lerp(s0 - BALL_R, LAND[1], k * k), lerp(w0, LAND[2], k)], sc: 1, g: DISH.floor, air: 1 - k };
        }
        if (tau < B.hop) {
          const k = seg(tau, B.land, B.hop), up = 22 * 4 * k * (1 - k);
          return { p: [lerp(LAND[0], HOPPED[0], k), LAND[1] - up, lerp(LAND[2], HOPPED[2], k)], sc: 1, g: DISH.floor, air: up / 50 };
        }
        if (tau < B.go) return { xy: fromXY, sc: 1 };
        const to = rail.at(i), k = seg(tau, B.go, B.into), e = inOutSine(k);
        const mx = (fromXY[0] + to[0]) / 2, my = Math.min(fromXY[1], to[1]) - 150;
        const q = (a, c, b) => (1 - e) * (1 - e) * a + 2 * (1 - e) * e * c + e * e * b;
        return { xy: [q(fromXY[0], mx, to[0]), q(fromXY[1], my, to[1])], sc: lerp(1, RAIL_SC, e), flying: k < 1 };
      };
      const ARRIVED = LASTPOP + B.into; // 最後の玉が並ぶ時刻
      const WAVE = ARRIVED + 140; // 並んだ玉が順にはずむ
      const END = WAVE + n * 45 + 620;
      const rings = ranks.flatMap((r, i) => (isTop(r) ? [popAt(i) + B.into - 160] : []));
      const holeLocal = P(HOLE.u, HOLE.s, HW);
      let pulseAt = -1e9, pulseColor = bestLight?.[0] || "#fff", teaseAcc = 0, prevAll = 0;
      const t0 = performance.now();
      SE.kujiCharge((FIRST - 100) / 1000);
      const frame = (now) => {
        const all = now - t0, t = all;
        if (skipped) { handoff(); resolve(); return; }
        const dms = all - prevAll; prevAll = all;
        const inK = seg(all, 0, 420);
        const fadeIn = smooth(seg(all, 0, 300));
        const hand = smooth(seg(t, END - 320, END));
        aim(1 + 0.05 * hand, CX + 140, H / 2);
        spinDrum(angle(t), all, 8 * (1 - outCubic(clamp(inK))), t >= T.spin && t < LASTPOP + DECEL);
        once("lever", T.ant, t, () => SE.reelLever());
        once("go", T.spin + 40, t, () => SE.whoosh());
        once("stop", LASTPOP + DECEL, t, () => SE.reelStop());
        // 当たりが入っている回は、玉が出る前から舞台に賞の色が差し、胴のまわりがきらめく
        if (best) {
          once("omen", T.spin + 160, t, () => { SE.kujiShimmer(best === "A" ? 5 : 12); if (best !== "A") SE.heartbeat(); });
          if (t > T.spin + 160 && t < FIRST) {
            teaseAcc += dms;
            while (teaseAcc > (best === "A" ? 110 : 60)) {
              teaseAcc -= best === "A" ? 110 : 60;
              const a = Math.random() * Math.PI * 2, rr = R * (0.9 + Math.random() * 0.5);
              const [x, y] = onScreen(P(rr * Math.cos(a), rr * Math.sin(a), FRONT));
              fx.stars(x, y, { n: 1, colors: [bestLight[1], bestLight[0]], rx: 10, ry: 10, size: [10, 26], delay: 0 });
            }
          }
        }
        balls.forEach((ball, i) => {
          const tau = t - popAt(i);
          if (tau < 0) return;
          const light = ball.light, mood = MOOD[ball.rank], hot = isTop(ball.rank);
          // 玉置きに並んだあとは、はずむ時（WAVE）のほかは描き直さない
          const waving = t > WAVE + i * 45 && t < WAVE + i * 45 + 300;
          if (tau < B.into + 60 || waving || !fired.has(`set${i}`)) {
            const b = track(i, tau);
            let sc = b.sc;
            if (waving) sc *= 1 + 0.2 * Math.sin(Math.PI * seg(t, WAVE + i * 45, WAVE + i * 45 + 260));
            if (b.xy) placeXY(ball, b.xy, sc); else place(ball, b.p, sc, sc);
            if (b.g != null) shade(ball, b.gp || b.p, b.g, b.air || 0);
            else ball.shadow.setAttribute("opacity", 0);
            if (b.flying && mood[0] > 0.7) {
              const [bx, by] = onScreen(b.xy);
              fx.burst(bx, by, { n: 1, colors: light, speed: [10, 70], spread: Math.PI, gravity: 80, life: [0.25, 0.5], size: [8, 16] });
            }
            if (tau >= B.into + 60 && !waving) fired.add(`set${i}`);
          }
          once(`show${i}`, 0, tau, () => { ball.g.setAttribute("opacity", 1); if (mood[0] > 0.7) ball.halo.setAttribute("opacity", mood[2]); });
          once(`halo${i}`, B.land, tau, () => ball.halo.setAttribute("opacity", mood[2]));
          once(`pop${i}`, 0, tau, () => {
            SE.punch();
            const [hx, hy] = onScreen(holeLocal);
            fx.burst(hx, hy, { n: hot ? 20 : ball.rank === "A" ? 12 : 5, colors: light, speed: [80, 280], angle: 0.5, spread: 1.2, gravity: 320, life: [0.25, 0.6], size: [8, 16] });
            if (hot) { SE.kujiImpact(); flashNow(light[1], 0.55, 320); kick(6, all); pulseAt = all; pulseColor = light[0]; fx.burst(hx, hy, { n: 24, colors: light, kind: "streak", speed: [240, 560], spread: Math.PI, gravity: 200, life: [0.25, 0.5], size: [1.6, 3] }); }
          });
          once(`land${i}`, B.land, tau, () => {
            SE.click();
            const [lx, ly] = onScreen(P(...LAND));
            fx.ring(lx, ly + 12, { color: light[1], r1: 50 + 60 * mood[0], width: 3 + 4 * mood[0], life: 0.35, flat: 0.36 });
          });
          once(`in${i}`, B.into, tau, () => {
            SE.kujiNote(i);
            rail.count(i + 1);
            const [sx, sy] = onScreen(rail.at(i));
            fx.ring(sx, sy, { color: light[0], r1: 30 + 22 * mood[0], width: 2 + 2 * mood[0], life: 0.4, alpha: 0.7 });
            if (ball.rank === "C") return;
            fx.stars(sx, sy - 4, { n: Math.round(1 + 9 * mood[0]), colors: [light[1], light[0]], rx: 26 + 40 * mood[0], ry: 26 + 40 * mood[0], size: [8, 24], delay: 0.3 });
            if (ball.rank === "B") return;
            fx.burst(sx, sy, { n: Math.round(22 * mood[0]), colors: light, speed: [80, 340], angle: -Math.PI / 2, spread: 1.3, gravity: 480, life: [0.4, 0.9], size: [8, 18] });
            if (hot) { SE.kujiRare(); SE.kujiShimmer(10); fx.confetti([light[0], light[1], light[2], "#ffffff", "#de3b22"], { seconds: 1.2, perSecond: 44 }); }
            else SE.perfect();
          });
        });
        once("wave", WAVE, t, () => { SE.jingle(); });
        // 舞台の染まり: 当たりの予告と、当たりの玉が出た瞬間
        const omen = best ? (best === "A" ? 0.3 : 0.5) * smooth(seg(t, T.spin + 160, FIRST - 80)) : 0;
        const pulse = Math.exp(-(all - pulseAt) / 520);
        set.mood(Math.max(omen, 0.95 * pulse), pulse > omen ? pulseColor : (bestLight?.[0] || "#fff"));
        ringBell(all, rings);
        once("handoff", END - 300, t, () => { flashNow("#ffffff", best && best !== "A" ? 0.9 : 0.5, 380); onHandoff?.(); });
        node.style.opacity = String(fadeIn * (1 - hand));
        if (all >= END) resolve();
        else raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });

    await (multi ? playMulti() : playSingle());
  } finally {
    cancelAnimationFrame(raf);
    fx?.destroy();
    for (const a of node.getAnimations({ subtree: true })) a.cancel();
    node.remove();
  }
}
