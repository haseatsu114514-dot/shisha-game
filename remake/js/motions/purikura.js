// プリクラ（MELTY PUFF・#939）。あげはのギャル友の回の最後に、入口のプリクラ機で二人で撮る。
// 撮影スタート → 3連写（ふつう・笑顔・あげはが寄ってはじめがびっくり）→ 盛り → 落書き → 印刷 → ハサミで半分こ。
// a は撮影が主役（毎回3・2・1、盛りを選ぶ）、b は落書きとシールが主役（撮影はさっと、スタンプ多め）。?movar=b で比べる。
// 落書きで、あげはのペンの線だけがゆっくりよれ、途中でペンを置いてスタンプに持ち替える（手の震え。演出の中では誰も触れない）。
// 撮影から落書きまでは立ち絵の胸から上で写す。最後に出てくるシールは、半分こ用の縦長シール（cg_ch2_ageha_purikura_strip）があれば2枚並べて、
// 無ければ #921 で作った4コマのCG（cg_ageha_first_purikura）を、どちらも無ければ立ち絵の写真と落書きの2×2を使う（オーナー決定 2026-10-24）。
// DOMの初期値は「撮り終えた画面」。動きは最初にまとめて予約し、fill で途中の見た目を作る。
import { el, sleep } from "../core/util.js";
import { state } from "../core/state.js";
import { cgUrl, portraitInfo } from "../core/data.js";
import { imageReady } from "../core/ui.js";
import { SE, playBgm, currentBgm, preloadBgm } from "../core/audio.js";
import { move, svg } from "../core/transition-kit.js";
import { MG_EASE as E } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

export const PURIKURA_CG = "cg_ageha_first_purikura";
// 撮影ごとに3曲から等確率で一つ。日常の乱数・保存状態には触れない。
export const PURIKURA_BGM = ["bgm_purikura", "bgm_purikura_b", "bgm_purikura_d"];
// 半分こ用の縦長シール1列分（640×1080・CG制作プラン #16）。あれば同じ絵を2枚並べて真ん中で切る（#15より優先）
export const PURIKURA_STRIP = "cg_ch2_ageha_purikura_strip";
// 印刷したシールの大きさ（場面の座標）。1列分×2、4コマ（960×1440）、代用は写真の2×2
const SHEET = { strip: { w: 616, h: 520, top: 100 }, cg: { w: 374, h: 560, top: 80 }, sprites: { w: 534, h: 480, top: 120 } };
const PW = 640, PH = 480; // 写真の大きさ（落書きの座標もこの画素）
// 立ち絵（896×1200）を写真に置く位置（%）。はじめの頭は(205,175)、あげはの頭は(440,190)あたり
const SPRITE = {
  hajime: { left: "-45.6%", top: "-10%" },
  ageha: { left: "-0.9%", top: "-21.5%" },
};
const POSES = [
  { hajime: "normal", ageha: "normal" },
  { hajime: "smile", ageha: "smile" },
  { hajime: "surprise", ageha: "smile", lean: true },
];
// 撮影画面の中の位置（機械の枠の中）。purikura.css と同じ値
const VIEW = { x: 60, y: 100 }; // 写真の窓
const TOOL_X = 740; // 右の列（撮った写真・盛りのボタン・落書きの道具）
const SLOT = (i) => ({ x: TOOL_X, y: 100 + i * 165, w: 200, h: 150 }); // 撮った写真の列

// a: 撮影が主役／b: 落書きとシールが主役（時刻はms）
export const PLANS = {
  a: { shots: [1000, 1950, 2900], countdown: [true, true, true], mori: 3850, menu: true, doodle: 5000, stamps: 0, gap: 100, starMs: 700, heartMs: 560, print: 7900, cut: 8900, end: 10100 },
  b: { shots: [900, 1600, 2000], countdown: [true, false, false], mori: 2500, menu: false, doodle: 3100, stamps: 6, gap: 110, starMs: 1100, heartMs: 900, print: 7100, cut: 8500, end: 9800 },
};

const at = (node, frames, ms, delay, { fill = "both", easing = E.out } = {}) => move(node, frames, ms, { delay, fill, easing });
/** opacity をある時刻で切り替える（その前は from、その後は to） */
const swap = (node, from, to, t) => at(node, [{ opacity: from }, { opacity: to }], 1, t, { easing: "linear" });

function spriteImg(id, face, lean) {
  const src = portraitInfo(id, face)?.src;
  return el(`img.mo-pk-sprite.${id}${lean && id === "ageha" ? ".lean" : ""}`, { src, alt: "", style: SPRITE[id] });
}

/** 立ち絵で作った1枚（終わった状態）。mori は盛ったあとの明るさ */
function shot(pose, { mori = false, glow = mori ? el("div.mo-pk-glow") : null } = {}) {
  return el(`div.mo-pk-photo${mori ? ".mori" : ""}`, [
    el("div.mo-pk-booth"),
    spriteImg("hajime", pose.hajime, pose.lean),
    spriteImg("ageha", pose.ageha, pose.lean),
    glow,
  ]);
}
/** CGが無いときの仕上がり: 立ち絵の3枚目を盛ったものに落書きを重ねた1枚 */
const finished = (extra) => el("div.mo-pk-print", [shot(POSES[2], { mori: true }), doodles(extra).layer]);
/** 640×480 の部品を小さな枠に縮めて置く */
const mini = (node, w, h, cls = "") => el(`div.mo-pk-mini${cls}`, { style: { width: `${w}px`, height: `${h}px` } }, [
  el("div.mo-pk-mini-in", { style: { transform: `scale(${w / PW})` } }, [node]),
]);

// ---------------------------------------------------------------- 落書き

/** ハートの線。ゆっくり不規則によれる（手の震え）。点列と長さの累積を返す */
function shakyHeart(cx, cy, s, amp, stop) {
  const pts = [];
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    // 法線方向へのよれ。周期の違う2つの波で、規則的に見えないようにする
    const dx = 48 * Math.sin(t) ** 2 * Math.cos(t), dy = 13 * Math.sin(t) - 10 * Math.sin(2 * t) - 6 * Math.sin(3 * t) - 4 * Math.sin(4 * t);
    const len = Math.hypot(dx, dy) || 1;
    // 描き進むほど強くなる（止まる位置で最大）
    const grow = 0.3 + 0.7 * Math.min(1, i / N / stop);
    const w = amp * grow * (0.62 * Math.sin(7.3 * t + 0.6) + 0.38 * Math.sin(12.9 * t + 1.9));
    pts.push([cx + x * s - (dy / len) * w, cy + y * s + (dx / len) * w]);
  }
  return withLength(pts);
}
function star(cx, cy, r) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? 0.45 : 1;
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
  }
  return withLength(pts);
}
function withLength(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum.at(-1), d: "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L") };
}
/** 線の先頭から割合 k の位置 */
function pointAt(line, k) {
  const target = line.len * k;
  const i = Math.max(1, line.cum.findIndex((c) => c >= target));
  const a = line.pts[i - 1], b = line.pts[i], seg = line.cum[i] - line.cum[i - 1] || 1, u = (target - line.cum[i - 1]) / seg;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

const STOP = 0.58; // あげはのハートが止まるところ（線の割合）
const HEART = "M0 -6 C-6 -16 -22 -12 -20 2 C-18 12 -6 18 0 24 C6 18 18 12 20 2 C22 -12 6 -16 0 -6 Z";
const stamp = (x, y, kids, cls = "") => {
  const pop = svg("g", { class: `mo-pk-pop${cls}` }, kids);
  return { node: svg("g", { transform: `translate(${x} ${y})` }, [pop]), pop };
};
const outlined = (shape, attrs, fill, line = "#fff", width = 7) => [
  svg(shape, { ...attrs, fill: "none", stroke: line, "stroke-width": width, "stroke-linejoin": "round", "stroke-linecap": "round" }),
  svg(shape, { ...attrs, fill }),
];
const word = (text, size, fill, extra = {}) => svg("text", {
  class: "mo-pk-word", "font-size": size, fill, stroke: "#fff", "stroke-width": Math.round(size / 4.2),
  "paint-order": "stroke", "stroke-linejoin": "round", ...extra,
}, [text]);
function gummy(color) {
  return [
    svg("circle", { cx: 0, cy: -16, r: 11, fill: color }), svg("circle", { cx: -8, cy: -25, r: 5, fill: color }), svg("circle", { cx: 8, cy: -25, r: 5, fill: color }),
    svg("ellipse", { cx: 0, cy: 6, rx: 13, ry: 15, fill: color }),
    svg("circle", { cx: -12, cy: -2, r: 5, fill: color }), svg("circle", { cx: 12, cy: -2, r: 5, fill: color }),
    svg("circle", { cx: -8, cy: 19, r: 6, fill: color }), svg("circle", { cx: 8, cy: 19, r: 6, fill: color }),
    svg("ellipse", { cx: -4, cy: -19, rx: 3, ry: 4, fill: "#ffffffb0" }),
  ];
}
function bearFace() {
  return [
    svg("circle", { cx: -15, cy: -14, r: 9, fill: "#ffd3e6", stroke: "#fff", "stroke-width": 4 }),
    svg("circle", { cx: 15, cy: -14, r: 9, fill: "#ffd3e6", stroke: "#fff", "stroke-width": 4 }),
    svg("circle", { cx: 0, cy: 0, r: 20, fill: "#ffd3e6", stroke: "#fff", "stroke-width": 4 }),
    svg("circle", { cx: -7, cy: -3, r: 2.6, fill: "#3b2433" }), svg("circle", { cx: 7, cy: -3, r: 2.6, fill: "#3b2433" }),
    svg("ellipse", { cx: 0, cy: 6, rx: 6, ry: 4.5, fill: "#fff6fa" }), svg("circle", { cx: 0, cy: 5, r: 2, fill: "#3b2433" }),
  ];
}
const sparkle = (r, fill) => svg("path", { d: `M0 ${-r} L${r * 0.28} ${-r * 0.28} L${r} 0 L${r * 0.28} ${r * 0.28} L0 ${r} L${-r * 0.28} ${r * 0.28} L${-r} 0 L${-r * 0.28} ${-r * 0.28} Z`, fill });

/** 落書きの層（終わった状態）。live は撮影画面で動かす部品も返す */
function doodles(extra = 0) {
  const heart = shakyHeart(548, 118, 3.7, 6.5, STOP);
  const starLine = star(92, 318, 34);
  const heartInk = svg("path", { d: heart.d, fill: "none", stroke: "#ff3d9a", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 - STOP });
  const heartEdge = svg("path", { d: heart.d, fill: "none", stroke: "#fff", "stroke-width": 13, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 - STOP });
  const starInk = svg("path", { d: starLine.d, fill: "none", stroke: "#ffc93c", "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1 });
  const starEdge = svg("path", { d: starLine.d, fill: "none", stroke: "#fff", "stroke-width": 12, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1 });
  // スタンプ（押す順）。最初のハートが、よれた線の上に重なる
  const stamps = [
    stamp(548, 116, outlined("path", { d: HEART, transform: "scale(3.3)" }, "#ff4fa3", "#fff", 3)),
    stamp(26, 64, [word("ハジメっち♡", 40, "#ff3d9a")]),
    stamp(0, 0, [
      svg("path", { d: "M150 420 C190 400 205 360 196 320", fill: "none", stroke: "#fff", "stroke-width": 12, "stroke-linecap": "round" }),
      svg("path", { d: "M150 420 C190 400 205 360 196 320", fill: "none", stroke: "#ffc93c", "stroke-width": 6, "stroke-linecap": "round" }),
      svg("path", { d: "M182 330 L196 316 L208 334", fill: "none", stroke: "#fff", "stroke-width": 12, "stroke-linecap": "round", "stroke-linejoin": "round" }),
      svg("path", { d: "M182 330 L196 316 L208 334", fill: "none", stroke: "#ffc93c", "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" }),
      word("答え合わせ係", 30, "#ff8a1f", { x: 18, y: 454 }),
    ]),
    stamp(474, 452, [word("あげ↑", 50, "#ff3d9a")]),
    stamp(404, 66, outlined("path", { d: "M-26 12 L-30 -14 L-14 0 L0 -20 L14 0 L30 -14 L26 12 Z" }, "#ffd23f", "#fff", 6)),
    stamp(603, 268, gummy("#ff4a5ecc")),
    stamp(322, 84, bearFace()),
    stamp(250, 238, [sparkle(16, "#fff")]),
    stamp(612, 392, [sparkle(20, "#ffe36e")]),
    stamp(32, 196, [sparkle(13, "#fff")]),
  ];
  // b は落書きが主役なので、スタンプを足す
  const more = [
    stamp(560, 196, gummy("#ffffffdd")),
    stamp(146, 128, outlined("path", { d: HEART, transform: "scale(.9)" }, "#ff7fc0", "#fff", 4)),
    stamp(470, 300, [sparkle(12, "#fff")]),
    stamp(280, 438, outlined("path", { d: HEART, transform: "scale(1.1)" }, "#ff4fa3", "#fff", 4)),
    stamp(66, 252, [sparkle(10, "#ffe36e")]),
    stamp(366, 168, [sparkle(11, "#fff")]),
  ].slice(0, extra);
  const layer = svg("svg", { class: "mo-pk-ink", viewBox: `0 0 ${PW} ${PH}` }, [
    starEdge, starInk, heartEdge, heartInk, ...[...stamps, ...more].map((s) => s.node),
  ]);
  return { layer, heart, starLine, heartInk, heartEdge, starInk, starEdge, stamps: [...stamps, ...more] };
}

// ---------------------------------------------------------------- 画面

function build(art, plan) {
  const glow = el("div.mo-pk-glow");
  const poses = POSES.map((p, i) => shot(p, i === 2 ? { mori: true, glow } : {}));
  const ink = doodles(plan.stamps);
  const pinkPen = el("div.mo-pk-pen.pink"), goldPen = el("div.mo-pk-pen.gold");
  const count = ["3", "2", "1"].map((n) => el("span.mo-pk-count", { text: n }));
  const view = el("div.mo-pk-view", [...poses, ink.layer, ...count, pinkPen, goldPen]);
  const thumbs = POSES.map((p, i) => { const s = SLOT(i); return mini(shot(p), s.w, s.h, ".mo-pk-thumb"); });
  thumbs.forEach((t, i) => Object.assign(t.style, { left: `${SLOT(i).x}px`, top: `${SLOT(i).y}px` }));
  const menu = (plan.menu ? ["ナチュラル", "盛り", "超盛り"] : []).map((t, i) => el(`div.mo-pk-mori-btn${i === 2 ? ".pick" : ""}`, { text: t, style: { top: `${120 + i * 120}px` } }));
  const tools = [
    el("div.mo-pk-tool", { style: { top: "120px" } }, [el("i.mo-pk-dot.pink"), el("span", { text: "ペン" })]),
    el("div.mo-pk-tool", { style: { top: "250px" } }, [el("i.mo-pk-dot.gold"), el("span", { text: "ペン" })]),
    el("div.mo-pk-tool", { style: { top: "380px" } }, [el("i.mo-pk-dot.stamp"), el("span", { text: "スタンプ" })]),
  ];
  const pick = el("div.mo-pk-pick"); // あげはが選んでいる道具の輪
  const labels = ["撮影スタート♪", plan.menu ? "盛りレベルを選んでね♪" : "超盛りで仕上げ♪", "らくがきタイム♪"].map((t) => el("div.mo-pk-label", [el("span", { text: t })]));
  const head = el("div.mo-pk-head", labels);
  const machine = el("div.mo-pk-machine", [head, view, ...thumbs, ...menu, ...tools, pick]);
  const nail = el("div.mo-pk-nail");
  // 印刷したシール。真ん中で切ると半分ずつ（CGは4コマを左右に、代用は2列×2段を1列ずつ）
  const size = SHEET[art.kind];
  const half = (side) => (art.url
    ? el(`div.mo-pk-half.cg${art.kind === "strip" ? ".strip" : ""}.${side}`, { style: { backgroundImage: `url("${art.url}")` } })
    : el(`div.mo-pk-half.${side}`, [mini(finished(plan.stamps), 240, 180), mini(finished(plan.stamps), 240, 180)]));
  const left = half("left"), right = half("right");
  const cutLine = el("div.mo-pk-cutline", { style: { left: `${size.w / 2 - 1}px` } });
  const shine = el("div.mo-pk-shine");
  // 刃先が下（切り進む向き）。持ち手の輪は上
  const bladeL = svg("g", { class: "mo-pk-blade" }, [svg("circle", { cx: -11, cy: -24, r: 9, fill: "none", stroke: "#ff3d9a", "stroke-width": 5 }), svg("path", { d: "M-6 -16 L6 36", stroke: "#cfd6e0", "stroke-width": 6, "stroke-linecap": "round" })]);
  const bladeR = svg("g", { class: "mo-pk-blade" }, [svg("circle", { cx: 11, cy: -24, r: 9, fill: "none", stroke: "#ff3d9a", "stroke-width": 5 }), svg("path", { d: "M6 -16 L-6 36", stroke: "#e9edf2", "stroke-width": 6, "stroke-linecap": "round" })]);
  const scissors = svg("svg", { class: "mo-pk-scissors", viewBox: "-30 -40 60 80", style: `left: ${size.w / 2 - 30}px` }, [bladeL, bladeR, svg("circle", { cx: 0, cy: 0, r: 3, fill: "#8a94a3" })]);
  const sheet = el(`div.mo-pk-sheet${art.url ? ".cg" : ""}`, { style: { left: `${(1280 - size.w) / 2}px`, top: `${size.top}px`, width: `${size.w}px`, height: `${size.h}px` } }, [left, right, cutLine, shine, scissors]);
  const flash = el("div.mo-pk-flash");
  const bg = el("div.mo-pk-bg");
  const twinkles = [[120, 120], [1150, 160], [90, 560], [1190, 600], [640, 40], [1000, 680]].map(([x, y]) =>
    el("i.mo-pk-twinkle", { style: { left: `${x}px`, top: `${y}px` } }));
  return { size, bg, twinkles, machine, head, labels, view, poses, glow, ink, pinkPen, goldPen, count, thumbs, menu, tools, pick, nail, sheet, left, right, cutLine, shine, scissors, blades: [bladeL, bladeR], flash };
}

/** 点列に沿って動く（ペン先）。WAAPIの位置キーを長さに合わせて並べる */
function trace(pen, line, upTo, ms, delay) {
  const frames = [];
  const N = 36;
  for (let i = 0; i <= N; i++) {
    const k = (i / N) * upTo;
    const [x, y] = pointAt(line, k);
    frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, offset: i / N });
  }
  return at(pen, frames, ms, delay, { easing: "linear" });
}

function schedule(ui, plan) {
  const P = plan;
  // 入場: ピンクが丸く広がり、機械の画面が弾んで出る
  at(ui.bg, [{ clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)" }], 560, 0);
  ui.twinkles.forEach((t, i) => at(t, [
    { opacity: 0, transform: "scale(0) rotate(0deg)" }, { opacity: 1, transform: `scale(${0.7 + (i % 3) * 0.25}) rotate(45deg)`, offset: 0.5 }, { opacity: 0, transform: "scale(0) rotate(90deg)" },
  ], 900, 300 + i * 260, { fill: "forwards", easing: "linear", iterations: 6 }));
  at(ui.machine, [{ opacity: 0, transform: "scale(.86) rotate(-2deg)" }, { opacity: 1, transform: "none" }], 520, 220, { easing: E.back });
  // 見出し（段階ごとに入れ替える）
  const steps = [0, P.mori, P.doodle, P.print];
  ui.labels.forEach((l, i) => at(l, [
    { opacity: 0, transform: "translateY(-14px) scale(.9)" }, { opacity: 1, transform: "none", offset: 0.12 },
    { opacity: 1, transform: "none", offset: 0.94 }, { opacity: 0, transform: "translateY(10px)" },
  ], steps[i + 1] - (i ? steps[i] : 420), i ? steps[i] : 420, { easing: "linear" }));

  // 3連写。ポーズは次の撮影の前に変わる
  const [, s2, s3] = P.shots;
  // 重ねた3枚のうち、後ろの撮影のポーズほど上。出る時刻まで隠す（1つの要素の opacity は1回だけ予約する）
  swap(ui.poses[1], 0, 1, s2 - 60);
  swap(ui.poses[2], 0, 1, s3 - 60);
  const snap = [];
  P.shots.forEach((s, i) => {
    let t = s;
    if (P.countdown[i]) {
      ui.count.forEach((c, n) => at(c, [
        { opacity: 0, transform: "scale(1.7)" }, { opacity: 1, transform: "scale(1)", offset: 0.35 }, { opacity: 1, transform: "scale(1)", offset: 0.8 }, { opacity: 0, transform: "scale(.9)" },
      ], 240, s + n * 240, { fill: "forwards", easing: "linear" }));
      t = s + 760;
    }
    snap.push(t);
    at(ui.flash, [{ opacity: 0.95 }, { opacity: 0 }], 320, t, { fill: "forwards", easing: E.out });
    // 撮った1枚が、写真の窓から右の列へ縮んで飛ぶ
    const slot = SLOT(i);
    const big = `translate(${VIEW.x - slot.x}px, ${VIEW.y - slot.y}px) scale(${PW / slot.w})`;
    at(ui.thumbs[i], [
      { opacity: 0, transform: big }, { opacity: 1, transform: big, offset: 0.01 }, { opacity: 1, transform: big, offset: 0.25 },
      { opacity: 1, transform: "none" },
    ], 520, t + 40, { easing: E.inOut });
  });

  // 盛り: 撮った列が消え、（a は）あげはが「超盛り」を押す → 画面がふわっと明るくなる
  ui.thumbs.forEach((t) => at(t, [{ opacity: 1 }, { opacity: 0 }], 220, P.mori, { fill: "forwards" }));
  const glowAt = P.menu ? P.mori + 760 : P.mori + 200;
  if (P.menu) {
    ui.menu.forEach((b, i) => at(b, [{ opacity: 0, transform: "translateX(30px)" }, { opacity: 1, transform: "none" }], 300, P.mori + 120 + i * 70));
    at(ui.nail, [
      { opacity: 0, transform: "translate(160px, 160px)" }, { opacity: 1, transform: "none", offset: 0.6, easing: "cubic-bezier(.2,.8,.3,1)" },
      { opacity: 1, transform: "scale(.8)", offset: 0.75 }, { opacity: 1, transform: "none", offset: 0.88 }, { opacity: 0, transform: "translate(60px, 80px)" },
    ], 760, P.mori + 280, { fill: "forwards", easing: "linear" });
    at(ui.menu[2], [{ transform: "none", boxShadow: "0 0 0 0 #ff3d9a00" }, { transform: "scale(1.12)", boxShadow: "0 0 0 10px #ff3d9a66" }, { transform: "scale(1.06)", boxShadow: "0 0 0 6px #ff3d9a55" }], 260, glowAt - 60, { fill: "forwards" });
  }
  ui.menu.forEach((b) => at(b, [{ opacity: 1 }, { opacity: 0 }], 200, P.doodle - 220, { fill: "forwards" }));
  // 盛る前の3枚目（明るさなし）→ 盛ったあと
  const third = ui.poses[2];
  at(third, [{ filter: "none" }, { filter: "brightness(1.1) saturate(1.22) contrast(1.03)" }], 520, glowAt, { easing: E.out });
  at(ui.glow, [{ opacity: 0 }, { opacity: 1 }], 520, glowAt);
  at(ui.flash, [{ opacity: 0 }, { opacity: 0.7 }, { opacity: 0 }], 420, glowAt, { fill: "forwards" });

  // 落書き: 道具が並ぶ。はじめの金のペンはまっすぐ星を描き、あげはのピンクのペンはよれて途中で止まる
  ui.tools.forEach((t, i) => at(t, [{ opacity: 0, transform: "translateX(30px)" }, { opacity: 1, transform: "none" }], 300, P.doodle + i * 70));
  ui.tools.forEach((t) => at(t, [{ opacity: 1 }, { opacity: 0 }], 260, P.print, { fill: "forwards" }));
  const ink = ui.ink;
  const d0 = P.doodle + 200;
  const { starMs, heartMs } = P;
  at(ui.goldPen, [{ opacity: 0 }, { opacity: 1 }], 120, d0 - 120, { fill: "forwards" });
  trace(ui.goldPen, ink.starLine, 1, starMs, d0);
  at(ui.goldPen, [{ opacity: 1 }, { opacity: 0 }], 200, d0 + starMs + 80, { fill: "forwards" });
  for (const n of [ink.starEdge, ink.starInk]) at(n, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], starMs, d0, { easing: "linear" });
  const h0 = d0 + 60, stopAt = STOP;
  at(ui.pinkPen, [{ opacity: 0 }, { opacity: 1 }], 120, h0 - 120, { fill: "forwards" });
  trace(ui.pinkPen, ink.heart, stopAt, heartMs, h0);
  for (const n of [ink.heartEdge, ink.heartInk]) at(n, [{ strokeDashoffset: 1 }, { strokeDashoffset: 1 - stopAt }], heartMs, h0, { easing: "linear" });
  // 止まったペン先が小さく震え、離れて道具の「スタンプ」へ持ち替える（震えを隠す）
  const [sx, sy] = pointAt(ink.heart, stopAt);
  const jitter = [[0, 0], [2.5, -1], [-2, 1.5], [1.5, 2], [-2.5, -1], [1, -2], [0, 0]];
  at(ui.pinkPen, jitter.map(([dx, dy]) => ({ transform: `translate(${(sx + dx).toFixed(1)}px, ${(sy + dy).toFixed(1)}px)` })), 260, h0 + heartMs + 40, { fill: "forwards", easing: "linear" });
  const lift = h0 + heartMs + 340;
  const toolX = TOOL_X + 100 - VIEW.x, toolY = 380 + 34 - VIEW.y;
  at(ui.pinkPen, [
    { transform: `translate(${sx}px, ${sy}px)` }, { transform: `translate(${sx + 6}px, ${sy - 14}px) rotate(-8deg)`, offset: 0.3 },
    { transform: `translate(${toolX}px, ${toolY}px)` },
  ], 420, lift, { fill: "forwards", easing: E.inOut });
  at(ui.pinkPen, [{ opacity: 1 }, { opacity: 0 }], 160, lift + 420, { fill: "forwards" });
  at(ui.pick, [{ opacity: 0, transform: "translateY(0)" }, { opacity: 1, transform: "translateY(0)" }], 160, P.doodle + 160, { fill: "forwards" });
  at(ui.pick, [{ transform: "translateY(0)" }, { transform: "translateY(260px)" }], 260, lift + 300, { fill: "forwards", easing: E.inOut });
  at(ui.pick, [{ opacity: 1 }, { opacity: 0 }], 200, P.print, { fill: "forwards" });
  // スタンプがポンポン押される。最初のハートが、よれた線を覆う
  const st0 = lift + 420, gap = P.gap;
  ink.stamps.forEach((s, i) => at(s.pop, [
    { opacity: 0, transform: "scale(0) rotate(-12deg)" }, { opacity: 1, transform: "scale(1.18) rotate(4deg)", offset: 0.6 }, { opacity: 1, transform: "none" },
  ], 300, st0 + i * gap, { easing: E.back }));

  // 印刷: 機械が引っ込み、シールが下から出てくる → 光沢が走る
  at(ui.machine, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-40px) scale(.94)" }], 380, P.print, { fill: "forwards", easing: E.in });
  const S = ui.size;
  at(ui.sheet, [{ opacity: 0, transform: `translateY(${760 - S.top}px) rotate(4deg)` }, { opacity: 1, transform: "rotate(-2deg)" }], 640, P.print + 240, { easing: E.out });
  at(ui.shine, [{ opacity: 1, backgroundPosition: "130% 0" }, { opacity: 1, backgroundPosition: "-30% 0" }], 620, P.print + 900, { fill: "forwards", easing: E.inOut });
  // 半分こ: 真ん中の点線をハサミが下まで切り、片方がこちらへ来る
  const C = P.cut;
  at(ui.cutLine, [{ opacity: 0, transform: "scaleY(0)" }, { opacity: 1, transform: "scaleY(1)" }], 260, C, { fill: "forwards" });
  at(ui.scissors, [{ opacity: 0, transform: "translateY(-30px)" }, { opacity: 1, transform: "translateY(-30px)", offset: 0.12 }, { opacity: 1, transform: `translateY(${S.h - 40}px)`, offset: 0.9 }, { opacity: 0, transform: `translateY(${S.h - 10}px)` }], 760, C + 120, { fill: "forwards", easing: "linear" });
  ui.blades.forEach((blade, i) => at(blade, [{ transform: "rotate(0deg)" }, { transform: `rotate(${i ? 10 : -10}deg)` }, { transform: "rotate(0deg)" }], 190, C + 200, { fill: "forwards", easing: "linear", iterations: 3 }));
  at(ui.cutLine, [{ opacity: 1 }, { opacity: 0 }], 160, C + 900, { fill: "forwards" });
  at(ui.left, [{ transform: "none", opacity: 1 }, { transform: "translate(-300px, 60px) rotate(-10deg)", opacity: 0 }], 620, C + 920, { fill: "forwards", easing: E.inOut });
  at(ui.right, [{ transform: "none" }, { transform: `translate(${-S.w / 4}px, 0px) scale(1.16) rotate(2deg)` }], 620, C + 920, { fill: "forwards", easing: E.inOut });
  return { snap, glowAt, lift, stamps: ink.stamps.map((_, i) => st0 + i * gap), print: P.print, cut: C, end: P.end };
}

export async function shoot(variant = "a") {
  const owner = state;
  const music = PURIKURA_BGM[Math.floor(Math.random() * PURIKURA_BGM.length)];
  const plan = PLANS[variant] || PLANS.a;
  const strip = cgUrl(PURIKURA_STRIP), sheetCg = strip ? null : cgUrl(PURIKURA_CG);
  const art = strip ? { kind: "strip", url: strip } : sheetCg ? { kind: "cg", url: sheetCg } : { kind: "sprites", url: null };
  const urls = [...new Set([...POSES.flatMap((p) => [portraitInfo("hajime", p.hajime)?.src, portraitInfo("ageha", p.ageha)?.src]), art.url].filter(Boolean))];
  // 画像と並行して用意する。取得に失敗しても撮影を止めない。
  void preloadBgm(music);
  await Promise.all(urls.map((u) => imageReady(u, 3000)));
  if (state !== owner) return;
  await stagePlay("purikura", async (node) => {
    if (state !== owner) return;
    const ui = build(art, plan);
    const scene = el("div.mo-pk-scene", { style: {
      position: "absolute", left: "50%", top: "50%", width: "1280px", height: "720px", transformOrigin: "center",
    } }, [ui.bg, ...ui.twinkles, ui.machine, ui.sheet, ui.nail, ui.flash]);
    const fit = () => {
      const scale = Math.min(node.clientWidth / 1280, node.clientHeight / 720);
      scene.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    node.append(backdrop("#1a0f1d"), scene);
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(node);
    const previousMusic = currentBgm();
    playBgm(music);
    try {
      const T = schedule(ui, plan);
      // 音（予約した動きと同じ時刻に鳴らす）
      const cues = [
        ...plan.shots.flatMap((s, i) => (plan.countdown[i] ? [0, 1, 2].map((n) => [s + n * 240, "tick"]) : [])),
        ...T.snap.map((t) => [t, "punch"]),
        [T.glowAt, "just"],
        ...T.stamps.slice(0, 4).map((t) => [t, "select"]),
        [T.print + 240, "whoosh"],
        [T.cut + 200, "crackle"], [T.cut + 580, "crackle"],
      ].sort((a, b) => a[0] - b[0]);
      let now = 0;
      for (const [t, name] of cues) {
        await sleep(t - now);
        now = t;
        if (state !== owner) return;
        SE[name]?.();
      }
      await sleep(T.end - now);
      await move(node, [{ opacity: 1 }, { opacity: 0 }], 420, { fill: "forwards" });
    } finally {
      resize.disconnect();
      // LOADや別場面への切替で鳴り始めた曲は上書きしない。
      if (state === owner && currentBgm() === music) playBgm(previousMusic);
    }
  });
}

export const a = () => shoot("a");
export const b = () => shoot("b");
