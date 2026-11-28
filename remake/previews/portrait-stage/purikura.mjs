// 縦画面C案「煙の舞台」: プリクラ（第2章 MELTY PUFF・あげはのギャル友の回の最後）を縦へ移した試作（要望台帳 VPS04）。
// 本編の流れ（data/dialogue/ch2_ageha_story.json の remake_ch2_ageha_gyaru: 「記念にプリ撮ってきなよ」→ motion purikura → 「はい、ハジメっちの分」）をそのまま縦にした。
// 演出の順・時間は本編 remake/js/motions/purikura.js と同じ（a: 撮影が主役／b: 落書きとシールが主役）:
//   撮影スタート → 3連写（ふつう・笑顔・あげはが寄ってはじめがびっくり）→ 盛り（あげはの爪が「超盛り」）→ 落書き（金のペンの星、あげはのピンクのペンのハートがよれて止まり、スタンプに持ち替える）
//   → 印刷（縦長のシールが下から出る）→ ハサミで半分こ → 片方がこちらへ。
// 縦の並べ方（十字キーと丸ボタンは置かない）: 上＝プリ機の画面を縦に組み直した物（写真の窓を上、その下の一段に 撮った写真 → 盛り → 落書きの道具 を時間で入れ替えて出す）、
//   真ん中＝台詞の帯、下（親指の届く所）＝「撮影スタート♪」の大きな札（縦の専用の札。撮影はそのあと、本編と同じくあげはが進める）。
// 写真の中は本編の縦画面と同じ新版の立ち絵（896×1200）の胸から上。シールは本編の半分こ用の縦長シール（cg_ch2_ageha_purikura_strip）。
// 落書きの線・スタンプの形は本編の写し（本編の purikura.js は試験がファイルの中身を直接読むので、分けずに写した）。本編の進行・思い出の品・保存には触れない。音は鳴らさない。
import { el } from "../../js/core/util.js";
import { svg, move } from "../../js/core/transition-kit.js";
import { MG_EASE as E } from "../../js/core/mg-kit.js";
import { loadDialogue, findDialogue, isSpeech, Telop } from "./photo-talk.mjs";

const REMAKE_IMG = new URL("../../img/", import.meta.url).href;
const STRIP = `${REMAKE_IMG}cgs/cg_ch2_ageha_purikura_strip.webp`; // 半分こ用の縦長シール1列分（640×1080）
const portrait = (id, face) => `${REMAKE_IMG}sprites/character_variants/new/${id}/chr_${id}_${face}.webp`;

// ── 本編 purikura.js の値の写し ──
const PW = 640, PH = 480; // 写真の大きさ（落書きの座標もこの画素）
// 新版の立ち絵（896×1200）の顔位置に合わせた写真の位置（%）。はじめの頭は(205,175)、あげはの頭は(440,190)あたり
const SPRITE = { hajime: { left: "-37.9%", top: "6.9%" }, ageha: { left: "-0.9%", top: "-21.5%" } };
const POSES = [
  { hajime: "normal", ageha: "normal" },
  { hajime: "smile", ageha: "smile" },
  { hajime: "surprise", ageha: "smile", lean: true },
];
// a: 撮影が主役／b: 落書きとシールが主役（時刻はms）
const PLANS = {
  a: { shots: [1000, 1950, 2900], countdown: [true, true, true], mori: 3850, menu: true, doodle: 5000, stamps: 0, gap: 100, starMs: 700, heartMs: 560, print: 7900, cut: 8900, end: 10100 },
  b: { shots: [900, 1600, 2000], countdown: [true, false, false], mori: 2500, menu: false, doodle: 3100, stamps: 6, gap: 110, starMs: 1100, heartMs: 900, print: 7100, cut: 8500, end: 9800 },
};

// ── 縦の撮影機の画面（場面の座標 720×840。上の画面の大きさに合わせて縮める） ──
const SW = 720, SH = 840;
const MACH = { x: 20, y: 20, w: 680, h: 790, border: 10 };
const VIEW = { x: 10, y: 100 };                                   // 写真の窓（撮影機の中の座標）
const ROW = (i) => 10 + i * 220;                                  // 下の一段の横の位置（3つ）
const SLOT = (i) => ({ x: ROW(i), y: 610, w: 200, h: 150 });      // 撮った写真
const MENU_Y = 640, TOOL_Y = 626;                                 // 盛りのボタン・落書きの道具
const SHEET = { w: 660, h: 557, top: 150 };                       // 印刷したシール（1列分×2）
const NAIL = { x: MACH.x + MACH.border + ROW(2) + 100 - 28, y: MACH.y + MACH.border + MENU_Y + 45 - 28 }; // あげはの爪が押す「超盛り」の真ん中

const at = (node, frames, ms, delay, { fill = "both", easing = E.out } = {}) => move(node, frames, ms, { delay, fill, easing });
/** opacity をある時刻で切り替える（その前は from、その後は to） */
const swap = (node, from, to, t) => at(node, [{ opacity: from }, { opacity: to }], 1, t, { easing: "linear" });

function spriteImg(id, face, lean) {
  return el(`img.mo-pk-sprite.${id}${lean && id === "ageha" ? ".lean" : ""}`, { src: portrait(id, face), alt: "", style: SPRITE[id] });
}
/** 立ち絵で作った1枚（終わった状態）。mori は盛ったあとの明るさ */
function shot(pose, { mori = false, glow = mori ? el("div.mo-pk-glow") : null } = {}) {
  return el(`div.mo-pk-photo${mori ? ".mori" : ""}`, [el("div.mo-pk-booth"), spriteImg("hajime", pose.hajime, pose.lean), spriteImg("ageha", pose.ageha, pose.lean), glow]);
}
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


// ---------------------------------------------------------------- 縦の撮影機の画面（本編 build・schedule を縦の座標で）

function build(plan) {
  const glow = el("div.mo-pk-glow");
  const poses = POSES.map((p, i) => shot(p, i === 2 ? { mori: true, glow } : {}));
  const ink = doodles(plan.stamps);
  const pinkPen = el("div.mo-pk-pen.pink"), goldPen = el("div.mo-pk-pen.gold");
  const count = ["3", "2", "1"].map((n) => el("span.mo-pk-count", { text: n }));
  const view = el("div.mo-pk-view", { style: { left: `${VIEW.x}px`, top: `${VIEW.y}px` } }, [...poses, ink.layer, ...count, pinkPen, goldPen]);
  const thumbs = POSES.map((p, i) => { const s = SLOT(i), t = mini(shot(p), s.w, s.h, ".mo-pk-thumb"); Object.assign(t.style, { left: `${s.x}px`, top: `${s.y}px` }); return t; });
  const menu = (plan.menu ? ["ナチュラル", "盛り", "超盛り"] : []).map((t, i) => el(`div.mo-pk-mori-btn${i === 2 ? ".pick" : ""}`, { text: t, style: { left: `${ROW(i)}px`, top: `${MENU_Y}px` } }));
  const tools = [["pink", "ペン"], ["gold", "ペン"], ["stamp", "スタンプ"]].map(([dot, label], i) => el("div.mo-pk-tool", { style: { left: `${ROW(i)}px`, top: `${TOOL_Y}px` } }, [el(`i.mo-pk-dot.${dot}`), el("span", { text: label })]));
  const pick = el("div.mo-pk-pick", { style: { left: `${ROW(0) - 8}px`, top: `${TOOL_Y - 8}px` } }); // あげはが選んでいる道具の輪
  const labels = ["撮影スタート♪", plan.menu ? "盛りレベルを選んでね♪" : "超盛りで仕上げ♪", "らくがきタイム♪"].map((t) => el("div.mo-pk-label", [el("span", { text: t })]));
  const head = el("div.mo-pk-head", labels);
  const machine = el("div.mo-pk-machine.pk-machine", [head, view, ...thumbs, ...menu, ...tools, pick]);
  const nail = el("div.mo-pk-nail", { style: { left: `${NAIL.x}px`, top: `${NAIL.y}px` } });
  // 印刷したシール: 1列分の縦長シールを2枚並べ、真ん中で切ると半分ずつ
  const half = (side) => el(`div.mo-pk-half.cg.strip.${side}`, { style: { backgroundImage: `url("${STRIP}")` } });
  const left = half("left"), right = half("right");
  const cutLine = el("div.mo-pk-cutline", { style: { left: `${SHEET.w / 2 - 1}px` } });
  const shine = el("div.mo-pk-shine");
  const bladeL = svg("g", { class: "mo-pk-blade" }, [svg("circle", { cx: -11, cy: -24, r: 9, fill: "none", stroke: "#ff3d9a", "stroke-width": 5 }), svg("path", { d: "M-6 -16 L6 36", stroke: "#cfd6e0", "stroke-width": 6, "stroke-linecap": "round" })]);
  const bladeR = svg("g", { class: "mo-pk-blade" }, [svg("circle", { cx: 11, cy: -24, r: 9, fill: "none", stroke: "#ff3d9a", "stroke-width": 5 }), svg("path", { d: "M6 -16 L-6 36", stroke: "#e9edf2", "stroke-width": 6, "stroke-linecap": "round" })]);
  const scissors = svg("svg", { class: "mo-pk-scissors", viewBox: "-30 -40 60 80", style: `left: ${SHEET.w / 2 - 30}px` }, [bladeL, bladeR, svg("circle", { cx: 0, cy: 0, r: 3, fill: "#8a94a3" })]);
  const sheet = el("div.mo-pk-sheet.cg", { style: { left: `${(SW - SHEET.w) / 2}px`, top: `${SHEET.top}px`, width: `${SHEET.w}px`, height: `${SHEET.h}px` } }, [left, right, cutLine, shine, scissors]);
  const flash = el("div.mo-pk-flash");
  const bg = el("div.mo-pk-bg");
  const twinkles = [[86, 96], [640, 130], [60, 560], [668, 600], [360, 34], [560, 812]].map(([x, y]) => el("i.mo-pk-twinkle", { style: { left: `${x}px`, top: `${y}px` } }));
  return { bg, twinkles, machine, labels, view, poses, glow, ink, pinkPen, goldPen, count, thumbs, menu, tools, pick, nail, sheet, left, right, cutLine, shine, scissors, blades: [bladeL, bladeR], flash };
}

/** 点列に沿って動く（ペン先）。WAAPIの位置キーを長さに合わせて並べる（本編の trace） */
function trace(pen, line, upTo, ms, delay) {
  const frames = [], N = 36;
  for (let i = 0; i <= N; i++) { const [x, y] = pointAt(line, (i / N) * upTo); frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, offset: i / N }); }
  return at(pen, frames, ms, delay, { easing: "linear" });
}

/** 本編の schedule と同じ時刻・動き。縦の画面では、下の一段（撮った写真・盛り・道具）は下から入り、あげはの道具の輪は横へ動く */
function schedule(ui, P) {
  at(ui.bg, [{ clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)" }], 560, 0);
  ui.twinkles.forEach((t, i) => at(t, [
    { opacity: 0, transform: "scale(0) rotate(0deg)" }, { opacity: 1, transform: `scale(${0.7 + (i % 3) * 0.25}) rotate(45deg)`, offset: 0.5 }, { opacity: 0, transform: "scale(0) rotate(90deg)" },
  ], 900, 300 + i * 260, { fill: "forwards", easing: "linear", iterations: 6 }));
  at(ui.machine, [{ opacity: 0, transform: "scale(.86) rotate(-2deg)" }, { opacity: 1, transform: "none" }], 520, 220, { easing: E.back });
  const steps = [0, P.mori, P.doodle, P.print];
  ui.labels.forEach((l, i) => at(l, [
    { opacity: 0, transform: "translateY(-14px) scale(.9)" }, { opacity: 1, transform: "none", offset: 0.12 },
    { opacity: 1, transform: "none", offset: 0.94 }, { opacity: 0, transform: "translateY(10px)" },
  ], steps[i + 1] - (i ? steps[i] : 420), i ? steps[i] : 420, { easing: "linear" }));

  // 3連写。ポーズは次の撮影の前に変わる
  const [, s2, s3] = P.shots;
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
    // 撮った1枚が、写真の窓から下の段へ縮んで落ちる
    const slot = SLOT(i), big = `translate(${VIEW.x - slot.x}px, ${VIEW.y - slot.y}px) scale(${PW / slot.w})`;
    at(ui.thumbs[i], [
      { opacity: 0, transform: big }, { opacity: 1, transform: big, offset: 0.01 }, { opacity: 1, transform: big, offset: 0.25 }, { opacity: 1, transform: "none" },
    ], 520, t + 40, { easing: E.inOut });
  });

  // 盛り: 撮った段が消え、（a は）あげはが「超盛り」を押す → 画面がふわっと明るくなる
  ui.thumbs.forEach((t) => at(t, [{ opacity: 1 }, { opacity: 0 }], 220, P.mori, { fill: "forwards" }));
  const glowAt = P.menu ? P.mori + 760 : P.mori + 200;
  if (P.menu) {
    ui.menu.forEach((b, i) => at(b, [{ opacity: 0, transform: "translateY(30px)" }, { opacity: 1, transform: "none" }], 300, P.mori + 120 + i * 70));
    at(ui.nail, [
      { opacity: 0, transform: "translate(160px, 160px)" }, { opacity: 1, transform: "none", offset: 0.6, easing: "cubic-bezier(.2,.8,.3,1)" },
      { opacity: 1, transform: "scale(.8)", offset: 0.75 }, { opacity: 1, transform: "none", offset: 0.88 }, { opacity: 0, transform: "translate(60px, 80px)" },
    ], 760, P.mori + 280, { fill: "forwards", easing: "linear" });
    at(ui.menu[2], [{ transform: "none", boxShadow: "0 0 0 0 #ff3d9a00" }, { transform: "scale(1.12)", boxShadow: "0 0 0 10px #ff3d9a66" }, { transform: "scale(1.06)", boxShadow: "0 0 0 6px #ff3d9a55" }], 260, glowAt - 60, { fill: "forwards" });
  }
  ui.menu.forEach((b) => at(b, [{ opacity: 1 }, { opacity: 0 }], 200, P.doodle - 220, { fill: "forwards" }));
  at(ui.poses[2], [{ filter: "none" }, { filter: "brightness(1.1) saturate(1.22) contrast(1.03)" }], 520, glowAt, { easing: E.out });
  at(ui.glow, [{ opacity: 0 }, { opacity: 1 }], 520, glowAt);
  at(ui.flash, [{ opacity: 0 }, { opacity: 0.7 }, { opacity: 0 }], 420, glowAt, { fill: "forwards" });

  // 落書き: 道具が並ぶ。はじめの金のペンはまっすぐ星を描き、あげはのピンクのペンはよれて途中で止まる
  ui.tools.forEach((t, i) => at(t, [{ opacity: 0, transform: "translateY(30px)" }, { opacity: 1, transform: "none" }], 300, P.doodle + i * 70));
  ui.tools.forEach((t) => at(t, [{ opacity: 1 }, { opacity: 0 }], 260, P.print, { fill: "forwards" }));
  const ink = ui.ink, d0 = P.doodle + 200, { starMs, heartMs } = P;
  at(ui.goldPen, [{ opacity: 0 }, { opacity: 1 }], 120, d0 - 120, { fill: "forwards" });
  trace(ui.goldPen, ink.starLine, 1, starMs, d0);
  at(ui.goldPen, [{ opacity: 1 }, { opacity: 0 }], 200, d0 + starMs + 80, { fill: "forwards" });
  for (const n of [ink.starEdge, ink.starInk]) at(n, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], starMs, d0, { easing: "linear" });
  const h0 = d0 + 60;
  at(ui.pinkPen, [{ opacity: 0 }, { opacity: 1 }], 120, h0 - 120, { fill: "forwards" });
  trace(ui.pinkPen, ink.heart, STOP, heartMs, h0);
  for (const n of [ink.heartEdge, ink.heartInk]) at(n, [{ strokeDashoffset: 1 }, { strokeDashoffset: 1 - STOP }], heartMs, h0, { easing: "linear" });
  // 止まったペン先が小さく震え、離れて道具の「スタンプ」へ持ち替える（震えを隠す）
  const [sx, sy] = pointAt(ink.heart, STOP);
  const jitter = [[0, 0], [2.5, -1], [-2, 1.5], [1.5, 2], [-2.5, -1], [1, -2], [0, 0]];
  at(ui.pinkPen, jitter.map(([dx, dy]) => ({ transform: `translate(${(sx + dx).toFixed(1)}px, ${(sy + dy).toFixed(1)}px)` })), 260, h0 + heartMs + 40, { fill: "forwards", easing: "linear" });
  const lift = h0 + heartMs + 340;
  const toolX = ROW(2) + 100 - VIEW.x, toolY = TOOL_Y + 52 - VIEW.y; // スタンプの道具の真ん中（写真の窓の座標）
  at(ui.pinkPen, [
    { transform: `translate(${sx}px, ${sy}px)` }, { transform: `translate(${sx + 6}px, ${sy - 14}px) rotate(-8deg)`, offset: 0.3 },
    { transform: `translate(${toolX}px, ${toolY}px)` },
  ], 420, lift, { fill: "forwards", easing: E.inOut });
  at(ui.pinkPen, [{ opacity: 1 }, { opacity: 0 }], 160, lift + 420, { fill: "forwards" });
  at(ui.pick, [{ opacity: 0, transform: "translateX(0)" }, { opacity: 1, transform: "translateX(0)" }], 160, P.doodle + 160, { fill: "forwards" });
  at(ui.pick, [{ transform: "translateX(0)" }, { transform: `translateX(${ROW(2) - ROW(0)}px)` }], 260, lift + 300, { fill: "forwards", easing: E.inOut });
  at(ui.pick, [{ opacity: 1 }, { opacity: 0 }], 200, P.print, { fill: "forwards" });
  const st0 = lift + 420, gap = P.gap;
  ink.stamps.forEach((s, i) => at(s.pop, [
    { opacity: 0, transform: "scale(0) rotate(-12deg)" }, { opacity: 1, transform: "scale(1.18) rotate(4deg)", offset: 0.6 }, { opacity: 1, transform: "none" },
  ], 300, st0 + i * gap, { easing: E.back }));

  // 印刷: 撮影機の画面が引っ込み、シールが下から出てくる → 光沢が走る
  at(ui.machine, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-40px) scale(.94)" }], 380, P.print, { fill: "forwards", easing: E.in });
  const S = SHEET;
  at(ui.sheet, [{ opacity: 0, transform: `translateY(${SH - S.top}px) rotate(4deg)` }, { opacity: 1, transform: "rotate(-2deg)" }], 640, P.print + 240, { easing: E.out });
  at(ui.shine, [{ opacity: 1, backgroundPosition: "130% 0" }, { opacity: 1, backgroundPosition: "-30% 0" }], 620, P.print + 900, { fill: "forwards", easing: E.inOut });
  // 半分こ: 真ん中の点線をハサミが下まで切り、片方がこちらへ来る
  const C = P.cut;
  at(ui.cutLine, [{ opacity: 0, transform: "scaleY(0)" }, { opacity: 1, transform: "scaleY(1)" }], 260, C, { fill: "forwards" });
  at(ui.scissors, [{ opacity: 0, transform: "translateY(-30px)" }, { opacity: 1, transform: "translateY(-30px)", offset: 0.12 }, { opacity: 1, transform: `translateY(${S.h - 40}px)`, offset: 0.9 }, { opacity: 0, transform: `translateY(${S.h - 10}px)` }], 760, C + 120, { fill: "forwards", easing: "linear" });
  ui.blades.forEach((blade, i) => at(blade, [{ transform: "rotate(0deg)" }, { transform: `rotate(${i ? 10 : -10}deg)` }, { transform: "rotate(0deg)" }], 190, C + 200, { fill: "forwards", easing: "linear", iterations: 3 }));
  at(ui.cutLine, [{ opacity: 1 }, { opacity: 0 }], 160, C + 900, { fill: "forwards" });
  at(ui.left, [{ transform: "none", opacity: 1 }, { transform: "translate(-300px, 60px) rotate(-10deg)", opacity: 0 }], 620, C + 920, { fill: "forwards", easing: E.inOut });
  at(ui.right, [{ transform: "none" }, { transform: `translate(${-S.w / 4}px, 0px) scale(1.16) rotate(2deg)` }], 620, C + 920, { fill: "forwards", easing: E.inOut });
  return { end: P.end };
}

// ---------------------------------------------------------------- 縦の画面

const ICONS = {
  pkCam: '<path d="M4 8.500A1.500 1.500 0 0 1 5.500 7h2.200l1.300-2h6l1.300 2h2.200A1.500 1.500 0 0 1 20 8.500v9A1.500 1.500 0 0 1 18.500 19h-13A1.500 1.500 0 0 1 4 17.500z"/><circle cx="12" cy="13" r="3.600"/>',
  pkGo: '<path d="M9 5.500 15.500 12 9 18.500"/>',
  pkAgain: '<path d="M4.500 12a7.500 7.500 0 1 0 2.400-5.500"/><path d="M4 4.500v4.500h4.500"/>',
};
const AGEHA = (face) => `${REMAKE_IMG}sprites/character_variants/new/ageha/chr_ageha_${["smile", "surprise", "serious", "sad"].includes(face) ? face : "normal"}.webp`;

export class PurikuraScene {
  static META = {
    id: "purikura", label: "プリクラ", acc: "#ff6db3",
    options: { name: "plan", label: "プリクラ", default: "a", values: { a: "撮影が主役", b: "落書きが主役" } },
    gallery: {
      title: "プリクラ（第2章 MELTY PUFF）",
      note: "本編のプリクラを縦へ。台詞は本編の台本（data/dialogue/ch2_ageha_story.json の remake_ch2_ageha_gyaru）、演出の順と時間は本編（motions/purikura.js）と同じ。横長だったプリ機の画面を縦に組み直し、写真の窓を上、その下の一段に 撮った写真 → 盛り → 落書きの道具 を時間で入れ替えて出す。最後の縦長のシールは本編より大きく出て、ハサミで半分こした片方がこちらへ来る。始める所だけ縦の専用の札（「撮影スタート♪」）にした。",
      shots: [
        { caption: "プリ機の前（台詞）", shot: "talk" },
        { caption: "撮影スタートの札", shot: "ready" },
        { caption: "撮影 → 盛り → 落書き → 半分こ（くり返し）", shot: "loop" },
        { caption: "半分こしたシール（会話のCGとして残る）", shot: "done" },
      ],
    },
  };

  constructor(phone, kit, opts = {}) {
    Object.assign(this, { phone, kit, el: phone.el, opts: { ...opts } });
    Object.assign(kit.ICONS, ICONS);
    this.plan = PLANS[opts.plan] ? opts.plan : "a";
    Object.assign(this, { gen: 0, resolveCtrl: null, timer: 0 });
    if (!phone.fixed) phone.extOpts.shot = null;
  }

  html() {
    const { REMAKE_IMG: IMG } = this.kit;
    return `
      <div class="pk-app">
        <section class="pk-stage" data-slot="stage">
          <img class="pk-bg" src="${IMG}backgrounds/bg_ageha_shop.webp" alt="">
          <img class="pk-ageha" data-slot="ageha" src="${AGEHA("smile")}" alt="">
          <div class="pk-host" data-slot="host"></div>
          <header class="pk-head"><span class="pk-where"><b>MELTY PUFF</b><small>入口のプリクラ機</small></span></header>
        </section>
        <section class="pt-telop off" data-slot="telop"><b class="pt-name"></b><p class="pt-text"></p><i class="pt-more" aria-hidden="true"></i></section>
        <div class="pt-ctrl" data-slot="ctrl"></div>
      </div>`;
  }

  mount() {
    const q = (sel) => this.el.querySelector(sel);
    this.refs = Object.fromEntries(["stage", "ageha", "host", "telop", "ctrl"].map((k) => [k, q(`[data-slot="${k}"]`)]));
    this.telop = new Telop(this.refs.telop, this.kit);
    this.relayout();
    loadDialogue("ch2_ageha_story").then((data) => {
      if (this.dead) return;
      const scene = findDialogue(data, "remake_ch2_ageha_gyaru");
      const i = scene?.lines.findIndex((l) => l.type === "motion" && l.id === "purikura") ?? -1;
      if (i < 0) throw new Error("remake_ch2_ageha_gyaru にプリクラの演出が見つからない");
      // 前は「記念にプリ撮ってきなよ」から、後は台詞が続く所まで
      const from = scene.lines.slice(0, i).findLastIndex((l) => isSpeech(l) && /プリ/.test(l.text) && l.speaker === "customer");
      const after = [];
      for (const l of scene.lines.slice(i + 1)) { if (!isSpeech(l)) break; after.push(l); }
      this.script = { before: scene.lines.slice(Math.max(0, from), i).filter(isSpeech), after };
      const shot = this.opts.shot;
      if (shot === "talk") this.say(this.script.before[1] || this.script.before[0], { wait: false });
      else if (shot === "ready") this.ready().then((go) => { if (go) this.play(++this.gen); });
      else if (shot === "done") this.showDone();
      else if (shot === "loop") this.loop();
      else this.run();
    }).catch((error) => {
      if (this.dead) return;
      console.warn("プリクラの台本を読めませんでした:", error);
      this.telop.say({ speaker: "", text: "台本を読み込めませんでした" }, { wait: false });
    });
  }

  destroy() { this.dead = true; this.gen += 1; this.telop?.stop(); this.resolveCtrl = null; clearTimeout(this.timer); }

  alive(gen) { return !this.dead && gen === this.gen; }

  /** 720×840 の撮影機の画面を、上の画面に収まるよう縮めて真ん中に置く */
  relayout() {
    const { stage, host } = this.refs || {};
    if (!stage) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    // 下の帯が上の画面に重なる分（photo.css の .pt-telop の margin-top 2.4rem）を除いた高さに収める
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10, room = H - 2.4 * rem - 8;
    const s = Math.min(W / SW, room / SH);
    host.style.transform = `translate(${((W - SW * s) / 2).toFixed(2)}px, ${((room - SH * s) / 2 + 4).toFixed(2)}px) scale(${s.toFixed(4)})`;
  }

  ask(html) {
    this.refs.ctrl.innerHTML = html;
    this.refs.ctrl.classList.remove("in"); void this.refs.ctrl.offsetWidth; this.refs.ctrl.classList.add("in");
    return new Promise((resolve) => { this.resolveCtrl = resolve; });
  }

  say(line, opts) {
    if (line.speaker === "ageha") this.refs.ageha.src = AGEHA(line.face);
    this.refs.ctrl.innerHTML = "";
    return this.telop.say(line, opts);
  }

  ready() {
    this.el.dataset.pkView = "";
    this.telop.hide();
    return this.ask(`<button class="pk-start" data-pk="pick" data-v="go"><span>${this.kit.icon("pkCam")}</span><b>撮影スタート♪</b></button>`);
  }

  /** 撮影機の画面を組んで、本編と同じ時刻で動かす。終わったら半分このシールを残す */
  play(gen, { finish = false } = {}) {
    const { host } = this.refs;
    host.replaceChildren();
    this.refs.ctrl.innerHTML = "";
    this.telop.hide();
    this.el.dataset.pkView = "machine";
    const plan = PLANS[this.plan];
    const ui = build(plan);
    const scene = el("div.mo-purikura.pk-scene", [ui.bg, ...ui.twinkles, ui.machine, ui.sheet, ui.nail, ui.flash]);
    host.append(scene);
    const T = schedule(ui, plan);
    if (finish) { scene.getAnimations({ subtree: true }).forEach((a) => { if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); }); this.el.dataset.pkView = "sheet"; return Promise.resolve(); }
    return new Promise((resolve) => { this.timer = setTimeout(() => { if (this.alive(gen)) this.el.dataset.pkView = "sheet"; resolve(); }, T.end); });
  }

  async run() {
    const gen = ++this.gen;
    this.refs.host.replaceChildren();
    this.el.dataset.pkView = "";
    for (const line of this.script.before) { await this.say(line); if (!this.alive(gen)) return; }
    if (await this.ready() !== "go" || !this.alive(gen)) return;
    await this.play(gen);
    if (!this.alive(gen)) return;
    for (const line of this.script.after) { await this.say(line); if (!this.alive(gen)) return; }
    this.telop.hide();
    const next = await this.ask(`<div class="pt-choices end"><button data-pk="pick" data-v="again">${this.kit.icon("pkAgain")}<span>もう一度撮る</span></button><button class="go" data-pk="pick" data-v="leave"><span>店を出る</span>${this.kit.icon("pkGo")}</button></div>`);
    if (!this.alive(gen)) return;
    if (next === "leave" && !this.phone.fixed) this.phone.setScene("map");
    else if (next === "again") { const g = ++this.gen; await this.play(g); if (this.alive(g)) this.showEnd(g); }
    else this.run();
  }

  async showEnd(gen) {
    const next = await this.ask(`<div class="pt-choices end"><button data-pk="pick" data-v="again">${this.kit.icon("pkAgain")}<span>もう一度撮る</span></button><button class="go" data-pk="pick" data-v="leave"><span>店を出る</span>${this.kit.icon("pkGo")}</button></div>`);
    if (!this.alive(gen)) return;
    if (next === "leave" && !this.phone.fixed) this.phone.setScene("map");
    else { const g = ++this.gen; await this.play(g); if (this.alive(g)) this.showEnd(g); }
  }

  showDone() {
    this.play(++this.gen, { finish: true });
    this.say(this.script.after[0], { wait: false });
  }

  async loop() {
    const gen = ++this.gen;
    await this.play(gen);
    if (!this.alive(gen) || !this.el.isConnected) return;
    this.timer = setTimeout(() => { if (this.alive(gen) && this.el.isConnected) this.loop(); }, 2200);
  }

  onClick(event) {
    const hit = event.target.closest("[data-pk]");
    if (hit && this.el.contains(hit)) {
      const resolve = this.resolveCtrl; this.resolveCtrl = null; resolve?.(hit.dataset.v); return true;
    }
    if (event.target.closest('[data-slot="telop"]') || event.target.closest('[data-slot="stage"]')) { this.telop?.tap(); return true; }
    return false;
  }

  move() {}

  pressA() {
    if (this.telop?.tap()) return;
    this.refs.ctrl.querySelector("[data-pk]")?.click();
  }

  tick() {}
}
