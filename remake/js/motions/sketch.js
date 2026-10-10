// DAY12夜のつむぎのスケッチ（ch1.js の sketchScene）。覆っている間に mid() で背景を替える。bgUrl は線画の元の絵。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

let serial = 0;

/** 背景の絵から輪郭を取り出し、線の色 ink で紙に描いたような線画にするSVGフィルタ。clear なら線以外を透明にする */
function sketchFilter(ink, { clear = false } = {}) {
  const id = `mo-sketch-${++serial}`;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16) / 255);
  const tone = clear
    ? `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  -1 0 0 0 1` // 白いところを透明に（色の上に線だけ残す）
    : `${1 - r} 0 0 0 ${r}  ${1 - g} 0 0 0 ${g}  ${1 - b} 0 0 0 ${b}  0 0 0 1 0`;
  const defs = stageSvg([svg("defs", {}, [svg("filter", { id, "color-interpolation-filters": "sRGB" }, [
    svg("feColorMatrix", { type: "saturate", values: "0" }),
    svg("feConvolveMatrix", { order: "3", kernelMatrix: "-1 -1 -1 -1 8 -1 -1 -1 -1", preserveAlpha: "true" }),
    svg("feComponentTransfer", {}, ["R", "G", "B"].map((c) => svg(`feFunc${c}`, { type: "linear", slope: "-3.2", intercept: "1" }))),
    svg("feColorMatrix", { type: "matrix", values: tone }),
  ])])]);
  defs.classList.add("mo-defs");
  return { defs, id };
}

/** 線画を一度だけ画像にしておく（ページを動かすたびに輪郭を計算し直さない）。描けない環境では null */
async function renderLines(img, filterId) {
  if (!img.naturalWidth) return null;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.filter = `url(#${filterId})`;
  if (!ctx.filter.includes(filterId)) return null;
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight); // object-fit: cover と同じ切り抜き
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  const blob = await new Promise((r) => c.toBlob(r));
  return blob ? URL.createObjectURL(blob) : null;
}

/** t=0〜ms を毎フレーム fn(t) で描く（最後に必ず fn(ms) を呼ぶ） */
function timeline(ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(ms, now - t0);
      fn(t);
      if (t < ms) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}
const easeOut = (k) => 1 - (1 - k) ** 3;
const easeIn = (k) => k * k * k;
const mix = (a, b, k) => a + (b - a) * k;

/**
 * 手に持った筆記具の絵（ペン先が原点、軸が +x）。kind: "pencil"（六角の鉛筆）| "liner"（細いペン）。
 * set(x, y, 角度, lift) で、ペン先を (x, y) に置く。lift は紙から浮いている度合い（0〜1、影が離れて少し大きくなる）。
 */
function penArt(kind, C, { size = 1 } = {}) {
  const id = `mo-pen-${++serial}`;
  const body = svg("g");
  let outline;
  if (kind === "pencil") {
    // 芯・削った木・六角の軸（上の面は明るく、下の面は暗い）・金具・消しゴム
    const scallop = "Q 43 -11.25 50 -7.5 Q 40 0 50 7.5 Q 43 11.25 50 15";
    body.append(
      svg("defs", {}, [svg("linearGradient", { id: `${id}-wood`, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg("stop", { offset: "0", "stop-color": C.woodHi }), svg("stop", { offset: "0.55", "stop-color": C.wood }), svg("stop", { offset: "1", "stop-color": C.woodLo }),
      ])]),
      svg("path", { d: `M 16 -4.8 L 50 -15 ${scallop} L 16 4.8 Z`, fill: `url(#${id}-wood)` }),
      svg("path", { d: "M 0 0 L 16 -4.8 L 16 4.8 Z", fill: C.lead }),
      svg("path", { d: "M 2 -0.4 L 15 -4.3", stroke: "#ffffff", "stroke-opacity": 0.35, "stroke-width": 1.2, "stroke-linecap": "round" }),
      svg("path", { d: `M 50 -15 ${scallop} L 236 15 L 236 -15 Z`, fill: C.body }),
      svg("path", { d: "M 50 -15 Q 43 -11.25 50 -7.5 L 236 -7.5 L 236 -15 Z", fill: C.bodyHi }),
      svg("path", { d: "M 50 7.5 Q 43 11.25 50 15 L 236 15 L 236 7.5 Z", fill: C.bodyLo }),
      svg("path", { d: "M 60 -11.6 H 228", stroke: "#ffffff", "stroke-opacity": 0.4, "stroke-width": 2, "stroke-linecap": "round" }),
      svg("rect", { x: 236, y: -15.5, width: 30, height: 31, fill: C.metal }),
      svg("rect", { x: 236, y: -15.5, width: 30, height: 8, fill: C.metalHi }),
      svg("rect", { x: 236, y: 7.5, width: 30, height: 8, fill: C.metalLo }),
      svg("path", { d: "M 242 -15.5 V 15.5 M 246 -15.5 V 15.5 M 256 -15.5 V 15.5 M 260 -15.5 V 15.5", stroke: C.metalLo, "stroke-width": 1.6 }),
      svg("path", { d: "M 266 -14 H 283 A 7 7 0 0 1 290 -7 V 7 A 7 7 0 0 1 283 14 H 266 Z", fill: C.eraser }),
      svg("path", { d: "M 266 -14 H 283 A 7 7 0 0 1 289 -10.5 L 266 -7 Z", fill: "#ffffff", "fill-opacity": 0.3 }),
    );
    outline = "M 0 0 L 50 -15 H 283 Q 290 -15 290 -8 V 8 Q 290 15 283 15 H 50 Z";
  } else {
    // 細いペン: 針のようなペン先・金属の円すい・溝のある握り・軸・クリップ・尻の蓋
    body.append(
      svg("rect", { x: 0, y: -1.1, width: 10, height: 2.2, rx: 1, fill: C.lead }),
      svg("path", { d: "M 9 -2.6 L 34 -9 L 34 9 L 9 2.6 Z", fill: C.metal }),
      svg("path", { d: "M 9 0.4 L 34 1.5 L 34 9 L 9 2.6 Z", fill: C.metalLo }),
      svg("path", { d: "M 9 -2.6 L 34 -9 L 34 -6 L 9 -1.4 Z", fill: C.metalHi }),
      svg("rect", { x: 34, y: -11, width: 72, height: 22, rx: 4, fill: C.grip }),
      svg("path", { d: Array.from({ length: 8 }, (_, i) => `M ${44 + i * 8} -11 V 11`).join(" "), stroke: C.gripHi, "stroke-width": 2 }),
      svg("rect", { x: 102, y: -12.5, width: 170, height: 25, rx: 6, fill: C.body }),
      svg("rect", { x: 102, y: -12.5, width: 170, height: 7, rx: 3, fill: C.bodyHi }),
      svg("rect", { x: 102, y: 6, width: 170, height: 6.5, rx: 3, fill: C.bodyLo }),
      svg("rect", { x: 266, y: -11, width: 14, height: 22, rx: 5, fill: C.grip }),
      svg("rect", { x: 200, y: -18.5, width: 66, height: 5, rx: 2.5, fill: C.metal }),
      svg("circle", { cx: 202, cy: -16, r: 3.6, fill: C.metalHi }),
    );
    outline = "M 0 0 L 34 -11 H 102 L 102 -12.5 H 276 Q 280 -12.5 280 -6 V 6 Q 280 12.5 276 12.5 H 102 L 34 11 Z";
  }
  const shade = svg("path", { d: outline, fill: C.shadow || "#000", "fill-opacity": 0.24, filter: `url(#${id}-blur)` });
  const g = svg("g", { opacity: 0 }, [
    svg("defs", {}, [svg("filter", { id: `${id}-blur`, x: "-20%", y: "-60%", width: "140%", height: "220%" }, [svg("feGaussianBlur", { stdDeviation: 4.5 })])]),
    shade, body,
  ]);
  function set(x, y, angle, lift = 0) {
    const s = size * (1 + 0.07 * lift);
    body.setAttribute("transform", `translate(${x} ${y}) rotate(${angle}) scale(${s})`);
    // 影は右下へ落ち、ペン先でペンと接する。浮くほど離れてぼやける
    shade.setAttribute("transform", `translate(${x + 4 + 34 * lift} ${y + 6 + 44 * lift}) rotate(${angle + 9}) scale(${s})`);
    shade.setAttribute("fill-opacity", String(0.24 - 0.1 * lift));
  }
  return { g, set, show: () => g.setAttribute("opacity", 1) };
}

// ---------------------------------------------------------------- a: スケッチ: 紙が置かれ、鉛筆が店を線画で描き、真ん中から色が広がる

const SKETCH = { bg: "#f6f1e7", deep: "#3a3a44", main: "#f2b544", mid: "#e7dfcf", light: "#ffffff" };
const PENCIL = {
  free: { lead: "#33333b", wood: "#e7c08c", woodHi: "#f6dcb4", woodLo: "#c99a63", body: "#f2b544", bodyHi: "#ffd27a", bodyLo: "#cf8f22", metal: "#c9c6d2", metalHi: "#ecebf1", metalLo: "#8f8b9e", eraser: "#f08ca0", shadow: "#3a2a10" },
  mono: { lead: "#241a4a", wood: "#ddd3f3", woodHi: "#f1ecfc", woodLo: "#b9a5ea", body: "#8f74d1", bodyHi: "#b9a5ea", bodyLo: "#6b4fb0", metal: "#c9bdf0", metalHi: "#ece6fb", metalLo: "#7a62bf", eraser: "#b9a5ea", shadow: "#241a4a" },
};

/** mid() で背景を差し替える。bgUrl はその背景の絵（線画の元） */
export async function a(mid, bgUrl) {
  const P = pick(SKETCH, { bg: "#efe9fb", deep: "#3d2a78", main: "#8f74d1", mid: "#ddd3f3" });
  const C = pick(PENCIL.free, PENCIL.mono);
  const img = new Image();
  img.src = bgUrl;
  await img.decode().catch(() => {});
  await stagePlay("sketch", async (node) => {
    const sheet = el("div.mo-sheet");
    const paper = el("div.mo-paper", { style: { backgroundColor: P.bg, "--grid": P.mid } });
    const { defs, id } = sketchFilter(P.deep);
    const lines = el("img.mo-sketch-lines", { src: bgUrl, alt: "", style: { filter: `url(#${id})` } });
    const doodles = stageSvg();
    const hand = stageSvg();
    const pencil = penArt("pencil", C);
    hand.append(pencil.g);
    sheet.append(paper, lines);
    node.append(defs, sheet, doodles, hand);
    lines.style.clipPath = "inset(0 100% 0 0)";
    // 1. 紙が少し傾いて滑り込み、置かれる（ここから先は画面を覆っているので、裏で背景を替えはじめる）
    await move(sheet, [{ transform: "translateY(105%) rotate(5deg)" }, { transform: "translateY(0) rotate(0deg)" }], 520, { easing: E.out });
    const swapped = mid ? mid() : null;
    // 2. 鉛筆が左下から浮いたまま入ってきて、紙に降りる
    const angle0 = -36;
    pencil.show();
    await timeline(360, (t) => {
      const k = easeOut(t / 360);
      pencil.set(mix(-200, 0, k), mix(H + 240, H / 2, k), mix(-52, angle0, k), 1 - k);
    });
    // 3. 上下に大きく払いながら左から右へ。ペン先が線画の描き終わりの縁にいる。動く向きへ少し傾く
    const draw = 1300;
    let tip = { x: 0, y: H / 2, a: angle0 };
    await timeline(draw, (t) => {
      const k = t / draw;
      const e = 1 - (1 - k) ** 2;
      const amp = 236 * Math.min(1, k / 0.1) * (1 - 0.12 * Math.sin(k * 7));
      const ph = k * Math.PI * 9;
      tip = { x: e * W, y: H / 2 + Math.sin(ph) * amp, a: angle0 - 6 * Math.cos(ph) * Math.min(1, k / 0.1) };
      lines.style.clipPath = `inset(0 ${100 - e * 100}% 0 0)`;
      pencil.set(tip.x, tip.y, tip.a, 0);
    });
    // 4. 描き終えた鉛筆が持ち上がり、右上へ払って出ていく。同時に四隅に小さな落書きの星
    const out = timeline(380, (t) => {
      const k = easeIn(t / 380);
      pencil.set(mix(tip.x, W + 260, k), mix(tip.y, H / 2 - 300, k), mix(tip.a, -58, k), Math.min(1, (t / 380) * 2.5));
    });
    [[90, 90], [W - 90, 110], [110, H - 100]].forEach(([x, y], i) => {
      const star = svg("path", { d: `M ${x} ${y - 22} L ${x + 6} ${y - 6} L ${x + 22} ${y} L ${x + 6} ${y + 6} L ${x} ${y + 22} L ${x - 6} ${y + 6} L ${x - 22} ${y} L ${x - 6} ${y - 6} Z`, fill: "none", stroke: P.main, "stroke-width": 4, "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
      doodles.append(star);
      move(star, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 360, { easing: E.out, delay: i * 90 });
    });
    await Promise.all([out, sleep(520), swapped]);
    // 5. 真ん中から色が広がる（紙と線画に穴が開いていく）
    move(doodles, [{ opacity: 1 }, { opacity: 0 }], 300);
    await move(sheet, [{ "--mo-hole": "0%", opacity: 1 }, { "--mo-hole": "80%", opacity: 1, offset: 0.85 }, { "--mo-hole": "120%", opacity: 0 }], 900, { easing: E.in });
  }, { cover: true });
}

// ---------------------------------------------------------------- b: スケッチブック: 表紙がめくれ、ペンが店を線画で描き、寄ると水彩がにじんで本当の色になる

const BOOK = { bg: "#2a3a48", deep: "#2b2d36", main: "#e06a52", mid: "#2f8f8a", light: "#f7f2e8", white: "#ffffff", ring: "#c9c7d3", pig: ["#f2b544", "#e06a52", "#5fb3a1", "#7aa6e0", "#f2b544", "#e9a0b4", "#5fb3a1"] };
const BOOK_MONO = { bg: "#241a4a", deep: "#3d2a78", main: "#6b4fb0", mid: "#8f74d1", light: "#efe9fb", white: "#f7f3ff", ring: "#c9bdf0", pig: ["#9a82d8", "#6b4fb0", "#b9a5ea", "#8f74d1", "#9a82d8", "#b9a5ea", "#6b4fb0"] };
const LINER = {
  free: { lead: "#2b2d36", metal: "#c9c7d3", metalHi: "#f0eff4", metalLo: "#8e8b9c", grip: "#2b2d36", gripHi: "#4a4d5a", body: "#2f8f8a", bodyHi: "#5fb3a1", bodyLo: "#1f6b67", shadow: "#101820" },
  mono: { lead: "#150e30", metal: "#c9bdf0", metalHi: "#f1ecfc", metalLo: "#8f74d1", grip: "#3d2a78", gripHi: "#5a43a0", body: "#8f74d1", bodyHi: "#b9a5ea", bodyLo: "#6b4fb0", shadow: "#150e30" },
};

/** 輪郭が少し波打つ丸（水彩のにじみ）。中心が原点 */
function blobPath(R) {
  const n = 40;
  const f = [Math.random() * 6, Math.random() * 6, Math.random() * 6];
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const r = R * (1 + 0.11 * Math.sin(3 * t + f[0]) + 0.07 * Math.sin(5 * t + f[1]) + 0.04 * Math.sin(8 * t + f[2]));
    return [Math.cos(t) * r, Math.sin(t) * r];
  });
  // 点を滑らかにつなぐ（Catmull-Rom を3次ベジェに）
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((o) => pts[(i + o + n) % n]);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

/** ペンが通る道（3段を往復。段の上で小さく波打ち、折り返しは紙の外で半円を描く）。点の列と累積の長さ */
function strokeRoute() {
  const rows = [120, 360, 600], left = -60, right = W + 60, turn = 120;
  const pts = [];
  rows.forEach((y, r) => {
    const ltr = r % 2 === 0;
    for (let s = 0; s <= 1.0001; s += 1 / 90) {
      const x = ltr ? mix(left, right, s) : mix(right, left, s);
      pts.push([x, y + 12 * Math.sin(x / 38 + r * 2)]);
    }
    if (r < rows.length - 1) {
      const cx = ltr ? right : left;
      for (let s = 1; s < 24; s++) {
        const a = -Math.PI / 2 + (s / 24) * Math.PI;
        pts.push([cx + (ltr ? 1 : -1) * Math.cos(a) * turn, y + turn + Math.sin(a) * turn]);
      }
    }
  });
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1];
  /** 道のり d の位置と進む向き */
  const at = (d) => {
    let i = 1;
    while (i < lens.length - 1 && lens[i] < d) i++;
    const k = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return { x: mix(x0, x1, k), y: mix(y0, y1, k), dx: (x1 - x0) / (lens[i] - lens[i - 1] || 1) };
  };
  return { d: `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")}`, total, at };
}

export async function b(mid, bgUrl) {
  const P = pick(BOOK, BOOK_MONO);
  const C = pick(LINER.free, LINER.mono);
  const img = new Image();
  img.src = bgUrl;
  await img.decode().catch(() => {});
  // 線画は始まる前に一度だけ用意する（動いている途中に重い計算を挟まない）
  const { defs, id: ink } = sketchFilter(P.deep, { clear: true });
  document.body.append(defs);
  const drawn = await renderLines(img, ink).catch(() => null);
  await stagePlay("sketch", async (node) => {
    const id = `mo-book-${++serial}`;
    const route = strokeRoute();
    // ページ（紙・水彩・線画）。紙と水彩は「穴」のマスクで抜け、その下の本当の背景が見える
    const reveal = svg("path", { d: route.d, fill: "none", stroke: "#fff", "stroke-width": 270, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": `${route.total} ${route.total + 600}`, "stroke-dashoffset": route.total, visibility: "hidden" });
    node.append(defs);
    const holes = svg("g");
    const wash = svg("g");
    const paperGroup = svg("g", { mask: `url(#${id}-hole)` }, [svg("rect", { x: -40, y: -40, width: W + 80, height: H + 80, fill: P.light }), wash]);
    const lineArt = svg("image", { href: drawn || bgUrl, x: 0, y: 0, width: W, height: H, preserveAspectRatio: "xMidYMid slice", mask: `url(#${id}-draw)` });
    const box = { maskUnits: "userSpaceOnUse", x: -300, y: -300, width: W + 600, height: H + 600 };
    const page = stageSvg([
      svg("defs", {}, [
        svg("mask", { id: `${id}-hole`, ...box }, [svg("rect", { ...box, fill: "#fff" }), holes]),
        svg("mask", { id: `${id}-draw`, ...box }, [reveal]),
      ]),
      paperGroup, lineArt,
    ]);
    page.classList.add("mo-book-page");
    if (!drawn) lineArt.setAttribute("filter", `url(#${ink})`);
    // 表紙（表はラベル、裏は厚紙）と上のリング
    const cover = el("div.mo-cover", [
      el("div.mo-cover-front", { style: { background: P.main } }, [el("div.mo-cover-label", { style: { color: P.main, background: P.light } }, [el("b", { text: "SKETCH BOOK" }), el("i"), el("small", { text: "No.12" })])]),
      el("div.mo-cover-back", { style: { background: P.mid } }),
    ]);
    const rings = stageSvg(Array.from({ length: 23 }, (_, i) => {
      const x = 92 + i * 50;
      return svg("g", {}, [
        svg("circle", { cx: x, cy: 22, r: 7, fill: P.bg }),
        svg("path", { d: `M ${x - 1} 24 C ${x - 4} -6, ${x + 10} -40, ${x + 7} -6`, fill: "none", stroke: P.ring, "stroke-width": 5, "stroke-linecap": "round" }),
      ]);
    }));
    rings.classList.add("mo-book-rings");
    const pen = penArt("liner", C, { size: 1.25 });
    const hand = stageSvg([pen.g]);
    hand.classList.add("mo-book-hand");
    const book = el("div.mo-book", [page, cover, rings, hand]);
    const desk = backdrop(P.bg);
    node.append(desk, book);
    const at = (y, s, r = 0) => ({ transform: `translateY(${y}px) scale(${s}) rotate(${r}deg)` });
    const S = 0.76;
    // 1. 机が暗くなり、スケッチブックが少し傾いて下から置かれる（机で覆いきったら裏で背景を替えはじめる）
    move(desk, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "linear" });
    move(book, [at(820, S, -7), at(0, S, 0)], 600, { easing: E.out });
    await sleep(220);
    const swapped = mid ? mid() : null;
    await sleep(140);
    // 2. 表紙が上へめくれる。めくれきる前にペンが左下から浮いたまま入ってくる
    SE.whoosh();
    const flipAt = performance.now();
    move(cover, [{ transform: "rotateX(0deg)" }, { transform: "rotateX(180deg)" }], 600, { easing: E.inOut });
    await sleep(Math.max(0, 320 - (performance.now() - flipAt)));
    pen.show();
    const start = route.at(0);
    await timeline(380, (t) => {
      const k = easeOut(t / 380);
      pen.set(mix(-380, start.x, k), mix(H + 260, start.y, k), mix(-58, -40, k), 1 - k);
    });
    // 3. 3段を往復しながら線画を描いていく（ペン先が描き終わりの端。折り返しは紙の外で浮く）
    const draw = 1200;
    let tip = { x: start.x, y: start.y, a: -40 };
    let lean = 0;
    await timeline(draw, (t) => {
      const k = t / draw;
      const e = k - Math.sin(2 * Math.PI * k) / (2 * Math.PI) * 0.6;
      const head = e * route.total;
      const p = route.at(head);
      lean += (p.dx - lean) * 0.25;
      const off = Math.max(0, -p.x, p.x - W) / 70;
      tip = { x: p.x, y: p.y, a: -40 - 6 * lean };
      reveal.setAttribute("stroke-dashoffset", String(route.total - head));
      reveal.setAttribute("visibility", head > 1 ? "visible" : "hidden");
      pen.set(tip.x, tip.y, tip.a, Math.min(1, off));
    });
    // 4. ペンが持ち上がって右上へ抜け、カメラがページへ寄る（ページが画面いっぱいになる）。寄りながら水彩の色が紙に落ちる
    timeline(360, (t) => {
      const k = easeIn(t / 360);
      pen.set(mix(tip.x, W + 300, k), mix(tip.y, -360, k), mix(tip.a, -60, k), Math.min(1, (t / 360) * 2.5));
    });
    move(rings, [{ opacity: 1 }, { opacity: 0 }], 300, { delay: 100 });
    const pushed = move(book, [at(0, S), at(0, 1)], 520, { easing: E.inOut });
    const spots = [[640, 380, 430], [250, 230, 470], [1040, 210, 470], [1070, 600, 450], [210, 600, 450], [640, 80, 340], [640, 690, 330]];
    const blobs = spots.map(([x, y, R], i) => {
      const shape = blobPath(R);
      const color = P.pig[i % P.pig.length];
      const tint = svg("path", { d: shape, fill: color, "fill-opacity": 0.5, stroke: color, "stroke-width": 10, "stroke-opacity": 0.85, class: "tr-scale" });
      const hole = svg("path", { d: shape, fill: "#000", transform: `translate(${x} ${y}) scale(0)` });
      wash.append(svg("g", { transform: `translate(${x} ${y})` }, [tint]));
      holes.append(hole);
      tint.style.transform = "scale(0)";
      return { tint, hole, x, y, spin: (i % 2 ? 1 : -1) * 14 };
    });
    blobs.forEach(({ tint, spin }, i) => move(tint, [{ transform: "scale(.04) rotate(0deg)" }, { transform: `scale(1.04) rotate(${spin}deg)` }], 1000, { easing: "cubic-bezier(.2,.75,.3,1)", delay: 260 + i * 70 }));
    SE.pour();
    await pushed;
    await swapped;
    desk.remove();
    // 5. 色の染みたところから、本当の店の色が出てくる（紙に穴が開く）
    // マスクの中は CSS のアニメーションだと描き直されないことがあるので、毎フレーム属性で動かす
    const opened = timeline(760 + blobs.length * 50, (t) => blobs.forEach(({ hole, x, y, spin }, i) => {
      const k = easeOut(Math.min(1, Math.max(0, (t - i * 50) / 760)));
      hole.setAttribute("transform", `translate(${x} ${y}) rotate(${spin * k}) scale(${k > 0 ? 0.02 + 0.95 * k : 0})`);
    }));
    // 6. 穴が広がるのに合わせて紙のにじみが薄れ、最後に線画が引いて元の場面に戻る
    move(paperGroup, [{ opacity: 1 }, { opacity: 0 }], 520, { easing: "ease-in", delay: 200 });
    await Promise.all([opened, move(lineArt, [{ opacity: 1 }, { opacity: 0 }], 520, { easing: "ease-in-out", delay: 320 })]);
  }, { cover: true }).finally(() => {
    defs.remove();
    if (drawn) URL.revokeObjectURL(drawn);
  });
}
