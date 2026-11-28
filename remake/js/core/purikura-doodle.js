// プリクラの「自分でらくがき」の落書き（要望台帳 VPO22・2026-11-28 オーナー「自分でスマホのキーボードで文字入れたり好きにやれるようにもしたい。
// フォントや色とかも選べて　こだわりたい人は　スタンプ入れたりとか」）。画面を持たない部品だけを置く（撮影・受け取り・ギャラリーが共通で読む）。
// 落書きは絵ではなく中身（文字・スタンプ・ペンの線）として保存し、落書き無しの写真（img/cgs/purikura-clean/）の上に SVG で描き直す。
// 座標は写真の画素（640×1080・2コマのシール）。保存の大きさを抑えるため、数と長さに上限を置く（normalizeDoodle）。
import { img } from "./data.js";
import { homeRigFile } from "./scene-art.js";

// SVG の部品（演出の道具箱 transition-kit.js と同じ形。写真の部品から読むので、ここに小さく持つ）
const NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}, kids = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const kid of kids) if (kid) node.append(kid);
  return node;
}

export const DOODLE_W = 640, DOODLE_H = 1080;

/** 文字の書体（同梱の書体が無い字は端末の書体で出る）。まる・手書きは端末に丸ゴシックがあればそれで */
export const DOODLE_FONTS = Object.freeze([
  { id: "gothic", label: "ゴシック", family: '"Suien Gothic", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif', weight: 900 },
  { id: "maru", label: "まる", family: '"Hiragino Maru Gothic ProN", "Kosugi Maru", "M PLUS Rounded 1c", "Arial Rounded MT Bold", "Suien Gothic", sans-serif', weight: 800 },
  { id: "mincho", label: "明朝", family: '"Suien Name", "Hiragino Mincho ProN", "Yu Mincho", serif', weight: 700 },
  { id: "dot", label: "ドット", family: '"Suien Dot", "Suien Gothic", monospace', weight: 400 },
]);
/** 色（文字・ペン・スタンプの差し色） */
export const DOODLE_COLORS = Object.freeze([
  { id: "hot", hex: "#ff3d9a", label: "ショッキングピンク" }, { id: "pink", hex: "#ff9fd0", label: "ピンク" },
  { id: "red", hex: "#ff4a5a", label: "赤" }, { id: "orange", hex: "#ff9a2e", label: "オレンジ" },
  { id: "yellow", hex: "#ffd83c", label: "黄色" }, { id: "lime", hex: "#7ad83b", label: "黄緑" },
  { id: "aqua", hex: "#3ed1e6", label: "水色" }, { id: "blue", hex: "#3f7ff0", label: "青" },
  { id: "purple", hex: "#a46af2", label: "紫" }, { id: "black", hex: "#2a1420", label: "黒" }, { id: "white", hex: "#ffffff", label: "白" },
]);
/** 文字とペンのふち（プリクラらしい白ふちが既定） */
export const DOODLE_EDGES = Object.freeze([{ id: "white", hex: "#ffffff", label: "白ふち" }, { id: "black", hex: "#2a1420", label: "黒ふち" }, { id: "none", hex: null, label: "ふちなし" }]);
/** ペンの太さ（写真の画素） */
export const DOODLE_PENS = Object.freeze([{ id: "s", width: 6, label: "細" }, { id: "m", width: 12, label: "中" }, { id: "l", width: 22, label: "太" }]);

const colorHex = (id) => (DOODLE_COLORS.find((c) => c.id === id) || DOODLE_COLORS[0]).hex;
const edgeHex = (id) => (DOODLE_EDGES.find((e) => e.id === id) || DOODLE_EDGES[0]).hex;
const fontOf = (id) => DOODLE_FONTS.find((f) => f.id === id) || DOODLE_FONTS[0];

/**
 * スタンプ（100×100 の箱に描く）。fill は差し色を使う所（"c"）か固定の色。輪郭は白ふちで、写真の上でも読める。
 * 絵記号は端末で見た目が変わらないよう、絵文字は使わず図形で描く。
 */
const HEART = "M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z";
const STAR = "M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z";
const SPARKLE = "M50 4 C54 34 66 46 96 50 C66 54 54 66 50 96 C46 66 34 54 4 50 C34 46 46 34 50 4 Z";
export const DOODLE_STAMPS = Object.freeze([
  { id: "coal", label: "キューブ炭", art: "cube_charcoal" },
  { id: "bowl", label: "ハガル", art: "lotos_hagal" },
  { id: "hms", label: "HMS", art: "amaburst_hms" },
  { id: "heart", label: "ハート", parts: [{ d: HEART, fill: "c" }] },
  { id: "heart2", label: "ふちハート", parts: [{ d: HEART, fill: "#ffffff" }, { d: HEART, fill: "none", stroke: "c", width: 9 }] },
  { id: "star", label: "星", parts: [{ d: STAR, fill: "c" }] },
  { id: "sparkle", label: "キラ", parts: [{ d: SPARKLE, fill: "c" }] },
  { id: "crown", label: "王冠", parts: [{ d: "M10 78 L14 30 L34 52 L50 20 L66 52 L86 30 L90 78 Z", fill: "#ffd83c" }, { d: "M10 78 L90 78 L88 90 L12 90 Z", fill: "#ffb020" }, { d: "M46 56 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0", fill: "c" }] },
  { id: "ribbon", label: "リボン", parts: [{ d: "M50 50 L10 26 C6 24 4 28 4 32 L4 68 C4 72 6 76 10 74 Z", fill: "c" }, { d: "M50 50 L90 26 C94 24 96 28 96 32 L96 68 C96 72 94 76 90 74 Z", fill: "c" }, { d: "M40 40 h20 v20 h-20 Z", fill: "c", stroke: "#ffffff", width: 4 }] },
  { id: "bear", label: "クマ", parts: [{ d: "M14 30 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M58 30 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0", fill: "#c98a4a" }, { d: "M14 56 a36 33 0 1 0 72 0 a36 33 0 1 0 -72 0", fill: "#c98a4a" }, { d: "M36 64 a14 11 0 1 0 28 0 a14 11 0 1 0 -28 0", fill: "#f5dcc0" }, { d: "M33 50 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M59 50 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M45 60 h10 l-5 6 Z", fill: "#3a2416" }, { d: "M24 62 a5 3 0 1 0 10 0 a5 3 0 1 0 -10 0 M66 62 a5 3 0 1 0 10 0 a5 3 0 1 0 -10 0", fill: "c" }] },
  { id: "flower", label: "花", parts: [{ d: "M50 50 m-12 -26 a14 14 0 1 1 24 0 a14 14 0 1 1 13 24 a14 14 0 1 1 -8 25 a14 14 0 1 1 -24 0 a14 14 0 1 1 -8 -25 a14 14 0 1 1 3 -24 Z", fill: "c" }, { d: "M40 50 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0", fill: "#ffd83c" }] },
  { id: "lips", label: "キス", parts: [{ d: "M8 50 C20 30 34 28 50 38 C66 28 80 30 92 50 C80 74 64 82 50 82 C36 82 20 74 8 50 Z", fill: "c" }, { d: "M8 50 C30 56 70 56 92 50", fill: "none", stroke: "#ffffff", width: 4 }] },
  { id: "note", label: "音符", parts: [{ d: "M34 12 L86 4 L86 66 a14 12 0 1 1 -8 -11 L78 26 L42 32 L42 76 a14 12 0 1 1 -8 -11 Z", fill: "c" }] },
  { id: "smile", label: "にこ", parts: [{ d: "M6 50 a44 44 0 1 0 88 0 a44 44 0 1 0 -88 0", fill: "#ffd83c" }, { d: "M32 40 a5 7 0 1 0 10 0 a5 7 0 1 0 -10 0 M58 40 a5 7 0 1 0 10 0 a5 7 0 1 0 -10 0", fill: "#3a2416" }, { d: "M28 58 C36 76 64 76 72 58", fill: "none", stroke: "#3a2416", width: 6 }, { d: "M18 58 a6 4 0 1 0 12 0 a6 4 0 1 0 -12 0 M70 58 a6 4 0 1 0 12 0 a6 4 0 1 0 -12 0", fill: "c" }] },
  { id: "cat", label: "ねこ", parts: [{ d: "M10 92 L14 20 L36 40 Q50 34 64 40 L86 20 L90 92 Z", fill: "c" }, { d: "M32 62 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0 M58 62 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0 M46 74 h8 l-4 5 Z", fill: "#2a1420" }] },
]);
const stampOf = (id) => DOODLE_STAMPS.find((s) => s.id === id) || null;

/**
 * コマの背景（VPO24・オーナー「背景選んだりプリクラらしさも入れたい」）。プリ機と同じく、人物はグリーンバックで抜いた絵
 * （img/cgs/purikura-key/）を重ね、その後ろにここの柄を敷く。柄は SVG で描く（画像を増やさない）。
 * grad: 地の色（上→下、または斜め）。tile: 繰り返す模様（幅・高さ・中身）。swatch は選ぶ札の小さな見本の地の色
 */
const T = (d, fill, extra = {}) => ({ d, fill, ...extra });
const PHOTO_BACKGROUNDS = [
  ["flavor-double-apple", "ダブルアップルランド", "double-apple"],
  ["flavor-mint-glacier", "ミント氷河鉄道", "mint-glacier"],
  ["flavor-grape-aquarium", "巨峰クラゲ水族館", "grape-aquarium"],
  ["flavor-chai-desert", "チャイの砂時計砂漠", "chai-desert"],
  ["flavor-lemon-launch", "レモンソーダ発射場", "lemon-launch"],
  ["flavor-peach-onsen", "桃のお月見温泉", "peach-onsen"],
  ["nagoya-osu-kannon", "大須観音", "osu-kannon"],
  ["nagoya-osu-cat", "大須の招き猫広場", "osu-cat"],
  ["nagoya-meieki-towers", "名駅ツインタワーズ", "meieki-towers"],
  ["nagoya-meieki-clock", "名駅の金時計", "meieki-clock"],
  ["nagoya-sakae-oasis", "栄・オアシス21", "sakae-oasis"],
  ["nagoya-sakae-wheel", "栄の観覧車", "sakae-wheel"],
];
export const DOODLE_BGS = Object.freeze([
  { id: "pink", label: "ピンク", grad: ["#ffe0ef", "#ff9fcb"] },
  { id: "yumekawa", label: "ゆめかわ", grad: ["#ffc6e5", "#dcc8ff", "#c6f1ff"], diagonal: true },
  { id: "leopard", label: "ヒョウ柄", grad: ["#ff8cc6", "#ff6db3"], tile: { w: 120, h: 100, parts: [
    T("M18 20 a14 10 0 1 0 28 0 a14 10 0 1 0 -28 0", "#ffc2e0", { stroke: "#9e0f58", width: 5 }),
    T("M70 62 a12 15 0 1 0 24 0 a12 15 0 1 0 -24 0", "#ffc2e0", { stroke: "#9e0f58", width: 5 }),
    T("M86 14 a8 6 0 1 0 16 0 a8 6 0 1 0 -16 0", "#9e0f58"), T("M26 74 a7 9 0 1 0 14 0 a7 9 0 1 0 -14 0", "#9e0f58"),
  ] } },
  { id: "heart", label: "ハート", grad: ["#fff3f9", "#ffd9ec"], tile: { w: 90, h: 90, parts: [
    T(HEART, "#ff8fc7", { at: [10, 10, 0.3] }), T(HEART, "#ffb3d9", { at: [55, 52, 0.26] }),
  ] } },
  { id: "dot", label: "ドット", grad: ["#ffffff", "#fff4fa"], tile: { w: 56, h: 56, parts: [
    T("M4 14 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0", "#ff9fd0"), T("M32 42 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0", "#ff9fd0"),
  ] } },
  { id: "gingham", label: "ギンガム", grad: ["#ffffff", "#ffffff"], tile: { w: 48, h: 48, parts: [
    T("M0 0 h24 v48 h-24 Z", "#8fd0ff", { opacity: 0.45 }), T("M0 0 h48 v24 h-48 Z", "#8fd0ff", { opacity: 0.45 }),
  ] } },
  { id: "sparkle", label: "キラキラ", grad: ["#efe2ff", "#ffd6f0"], tile: { w: 100, h: 100, parts: [
    T(SPARKLE, "#ffffff", { at: [8, 10, 0.34] }), T(SPARKLE, "#ffe07a", { at: [58, 56, 0.24] }), T(SPARKLE, "#ffffff", { at: [70, 8, 0.14] }),
  ] } },
  { id: "night", label: "夜空", grad: ["#1b1450", "#5b2a8c"], tile: { w: 80, h: 80, parts: [
    T(STAR, "#fff6c2", { at: [8, 12, 0.14] }), T(SPARKLE, "#ffffff", { at: [50, 46, 0.18] }),
    T("M30 64 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0", "#ffffff"), T("M66 18 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0", "#ffffff"),
  ] } },
  { id: "sky", label: "青空", grad: ["#7fcbff", "#e3f6ff"], tile: { w: 220, h: 150, parts: [
    T("M20 60 a26 20 0 0 1 48 -6 a22 18 0 0 1 40 10 a18 14 0 0 1 -6 26 h-78 a18 15 0 0 1 -4 -30 Z", "#ffffff", { opacity: 0.92 }),
    T("M130 124 a18 14 0 0 1 34 -4 a16 13 0 0 1 28 8 a13 10 0 0 1 -4 18 h-56 a13 11 0 0 1 -2 -22 Z", "#ffffff", { opacity: 0.85 }),
  ] } },
  { id: "gold", label: "ギャル金", grad: ["#fff0a8", "#ffbe4d"], diagonal: true, tile: { w: 60, h: 60, parts: [
    T(SPARKLE, "#ffffff", { at: [6, 6, 0.2] }), T("M40 40 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0", "#fffbe6"), T("M44 10 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0", "#fff"),
  ] } },
  { id: "rainbow", label: "パステル虹", grad: ["#ffd6e8", "#ffd6e8"], tile: { w: 180, h: 180, rotate: 30, parts: [
    T("M0 0 h30 v180 h-30 Z", "#ffc2d9"), T("M30 0 h30 v180 h-30 Z", "#ffe2b8"), T("M60 0 h30 v180 h-30 Z", "#fff7b8"),
    T("M90 0 h30 v180 h-30 Z", "#c9f5c9"), T("M120 0 h30 v180 h-30 Z", "#c6e4ff"), T("M150 0 h30 v180 h-30 Z", "#e2ccff"),
  ] } },
  { id: "neon", label: "ネオン", grad: ["#140b26", "#2a1144"], tile: { w: 64, h: 64, parts: [
    T("M0 0 h64 v3 h-64 Z", "#ff3d9a", { opacity: 0.85 }), T("M0 0 h3 v64 h-3 Z", "#3ef0ff", { opacity: 0.75 }),
    T(SPARKLE, "#ff9fe0", { at: [30, 30, 0.2] }),
  ] } },
  ...PHOTO_BACKGROUNDS.map(([id, label, art]) => ({ id, label, art })),
]);
const bgOf = (id) => DOODLE_BGS.find((b) => b.id === id) || DOODLE_BGS[0];
export const DOODLE_BG_DEFAULT = "pink";

/** 保存の大きさの上限（1枚で多くても 30KB ほど）。画面（daily/purikura-studio.js）も同じ上限で描くのを止める */
export const DOODLE_LIMITS = Object.freeze({ items: 60, strokes: 80, points: 400, totalPoints: 4000, text: 24 });
const LIMITS = DOODLE_LIMITS;
const num = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const known = (list, id, fallback) => (list.some((x) => x.id === id) ? id : fallback);

/** 保存・読み込みの時に、落書きの中身を確かめて整える。形が違う（版が無い・物でない）なら null。空の落書きも落書きとして返す */
export function normalizeDoodle(value) {
  if (!value || typeof value !== "object" || value.v !== 1) return null;
  const items = [];
  for (const it of Array.isArray(value.items) ? value.items.slice(0, LIMITS.items) : []) {
    if (!it || typeof it !== "object") continue;
    const base = { x: Math.round(num(it.x, -200, DOODLE_W + 200, 320)), y: Math.round(num(it.y, -200, DOODLE_H + 200, 540)),
      s: Math.round(num(it.s, 0.3, 4, 1) * 100) / 100, r: Math.round(num(it.r, -180, 180, 0)) };
    if (it.t === "text" && typeof it.text === "string") {
      const text = [...it.text.replace(/[\u0000-\u001f\u007f]/g, "").trim()].slice(0, LIMITS.text).join("");
      if (!text) continue;
      items.push({ t: "text", ...base, text, f: known(DOODLE_FONTS, it.f, "gothic"), c: known(DOODLE_COLORS, it.c, "hot"), e: known(DOODLE_EDGES, it.e, "white") });
    } else if (it.t === "stamp" && stampOf(it.id)) {
      items.push({ t: "stamp", ...base, id: it.id, c: known(DOODLE_COLORS, it.c, "hot") });
    }
  }
  const strokes = [];
  let total = 0;
  for (const st of Array.isArray(value.strokes) ? value.strokes.slice(0, LIMITS.strokes) : []) {
    if (!st || !Array.isArray(st.p)) continue;
    const pts = [];
    for (let i = 0; i + 1 < st.p.length && pts.length < LIMITS.points * 2; i += 2) {
      const x = st.p[i], y = st.p[i + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push(Math.round(num(x, -20, DOODLE_W + 20, 0)), Math.round(num(y, -20, DOODLE_H + 20, 0)));
    }
    if (pts.length < 2 || total + pts.length / 2 > LIMITS.totalPoints) continue;
    total += pts.length / 2;
    strokes.push({ c: known(DOODLE_COLORS, st.c, "hot"), w: known(DOODLE_PENS, st.w, "m"), e: known(DOODLE_EDGES, st.e, "white"), p: pts });
  }
  // コマの背景（上のコマ・下のコマ）。知らない柄はピンク
  const bg = [0, 1].map((i) => known(DOODLE_BGS, Array.isArray(value.bg) ? value.bg[i] : null, DOODLE_BG_DEFAULT));
  return { v: 1, bg, items, strokes, ...(homeRigFile(value.rig) ? { rig: value.rig } : {}) }; // 何も描かずに「できた！」でも、選んだ背景の写真のまま受け取る
}

/** 点列を、なめらかな線の path に（2点の中点を通る2次曲線） */
export function strokePath(p) {
  if (p.length < 4) return `M${p[0]} ${p[1]} l0.1 0`;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i + 3 < p.length; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    d += ` Q${p[i]} ${p[i + 1]} ${mx} ${my}`;
  }
  return d + ` L${p[p.length - 2]} ${p[p.length - 1]}`;
}

/** ペンの1本（ふちの線の上に色の線） */
export function strokeNode(st) {
  const d = strokePath(st.p), width = (DOODLE_PENS.find((p) => p.id === st.w) || DOODLE_PENS[1]).width, edge = edgeHex(st.e);
  const line = (stroke, w) => svg("path", { d, fill: "none", stroke, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" });
  return svg("g", { class: "pkd-stroke" }, [edge ? line(edge, width + 8) : null, line(colorHex(st.c), width)]);
}

/** 文字・スタンプの1つ（x, y は真ん中。s は大きさ、r は回転） */
export function itemNode(it) {
  const g = svg("g", { class: `pkd-item pkd-${it.t}`, transform: `translate(${it.x} ${it.y}) rotate(${it.r}) scale(${it.s})` });
  if (it.t === "text") {
    const font = fontOf(it.f), edge = edgeHex(it.e);
    const attrs = { x: 0, y: 0, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 64, "font-family": font.family, "font-weight": font.weight };
    if (edge) g.append(svg("text", { ...attrs, fill: "none", stroke: edge, "stroke-width": 14, "stroke-linejoin": "round" }));
    const fill = svg("text", { ...attrs, fill: colorHex(it.c) });
    fill.textContent = it.text;
    if (edge) g.lastChild.textContent = it.text;
    g.append(fill);
  } else {
    const stamp = stampOf(it.id), c = colorHex(it.c);
    if (stamp.art) {
      g.append(svg("image", { x: -50, y: -50, width: 100, height: 100, href: `img/shop/equipment-v2/${stamp.art}.webp` }));
      return g;
    }
    const art = svg("g", { transform: "translate(-50 -50)" });
    // 白ふち（全部の形を太い白の線で一度なぞる）→ 本体
    for (const part of stamp.parts) art.append(svg("path", { d: part.d, fill: "#ffffff", stroke: "#ffffff", "stroke-width": 10, "stroke-linejoin": "round" }));
    for (const part of stamp.parts) {
      const fill = part.fill === "c" ? c : part.fill;
      art.append(svg("path", { d: part.d, fill, ...(part.stroke ? { stroke: part.stroke === "c" ? c : part.stroke, "stroke-width": part.width || 4, "stroke-linejoin": "round", "stroke-linecap": "round" } : {}) }));
    }
    g.append(art);
  }
  return g;
}

/** 撮影画面と保存した写真で共通の位置に小道具を置く。 */
export function photoRig(id) {
  const file = homeRigFile(id);
  return file ? svg("image", { x: 28, y: 796, width: 162, height: 223, href: img(`ui/scene_props/${file}`), class: "pkd-rig" }) : null;
}

/** 落書きの層（viewBox は写真の画素）。写真の上に重ねる */
export function doodleSvg(doodle, className = "pkd-layer") {
  const root = svg("svg", { viewBox: `0 0 ${DOODLE_W} ${DOODLE_H}`, class: className, "aria-hidden": "true" });
  const data = normalizeDoodle(doodle);
  if (!data) return root;
  const rig = photoRig(data.rig);
  if (rig) root.append(rig);
  for (const st of data.strokes) root.append(strokeNode(st));
  for (const it of data.items) root.append(itemNode(it));
  return root;
}

let bgSerial = 0;
/** 柄の1つを、矩形 [x, y, w, h] に敷く部品（defs と本体）。uid は同じ画面の別の SVG と id がぶつからないため */
function bgRect(id, [x, y, w, h], uid) {
  const b = bgOf(id), gid = `${uid}-g`, pid = `${uid}-p`;
  if (b.art) {
    return { defs: [], body: [svg("image", { x, y, width: w, height: h, href: `img/purikura/backgrounds/${b.art}.webp`, preserveAspectRatio: "xMidYMid slice" })] };
  }
  const stops = b.grad.map((c, i) => svg("stop", { offset: `${(i / Math.max(1, b.grad.length - 1)) * 100}%`, "stop-color": c }));
  const grad = svg("linearGradient", { id: gid, x1: 0, y1: 0, x2: b.diagonal ? 1 : 0, y2: 1 }, stops);
  const defs = [grad];
  const body = [svg("rect", { x, y, width: w, height: h, fill: `url(#${gid})` })];
  if (b.tile) {
    const t = b.tile;
    const shapes = t.parts.map((part) => {
      const [px, py, k] = part.at || [0, 0, 1];
      return svg("path", { d: part.d, fill: part.fill, ...(part.stroke ? { stroke: part.stroke, "stroke-width": part.width || 3 } : {}),
        ...(part.opacity ? { opacity: part.opacity } : {}), ...(part.at ? { transform: `translate(${px} ${py}) scale(${k})` } : {}) });
    });
    defs.push(svg("pattern", { id: pid, width: t.w, height: t.h, patternUnits: "userSpaceOnUse", x, y,
      ...(t.rotate ? { patternTransform: `rotate(${t.rotate} ${x} ${y})` } : {}) }, shapes));
    body.push(svg("rect", { x, y, width: w, height: h, fill: `url(#${pid})` }));
  }
  return { defs, body };
}

/**
 * コマの背景の層（viewBox は写真の画素）。panels はコマの位置（core/purikura-key-data.js）、bg は上・下のコマの柄。
 * 抜いた人物の絵（と、その枠）の下に敷く
 */
export function backdropSvg(bg, panels, className = "pkd-backdrop") {
  const root = svg("svg", { viewBox: `0 0 ${DOODLE_W} ${DOODLE_H}`, class: className, "aria-hidden": "true", preserveAspectRatio: "none" });
  const uid = `pkbg${++bgSerial}`;
  const defs = svg("defs");
  (panels || []).forEach((rect, i) => {
    // 抜いた所の縁を少しはみ出して敷く（はみ出しは枠の絵が隠す）
    const [x, y, w, h] = rect, out = [x - 4, y - 4, w + 8, h + 8];
    const part = bgRect((bg || [])[i] || DOODLE_BG_DEFAULT, out, `${uid}-${i}`);
    defs.append(...part.defs);
    root.append(...part.body);
  });
  root.prepend(defs);
  return root;
}

/** 選ぶ札の小さな見本（柄を四角に敷いた SVG） */
export function bgSwatch(id) {
  const root = svg("svg", { viewBox: "0 0 120 90", "aria-hidden": "true" });
  const part = bgRect(id, [0, 0, 120, 90], `pksw${++bgSerial}`);
  root.append(svg("defs", {}, part.defs), ...part.body);
  return root;
}
