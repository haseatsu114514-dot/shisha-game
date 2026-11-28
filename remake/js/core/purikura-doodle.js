// プリクラの「自分でらくがき」の落書き（要望台帳 VPO22・2026-11-28 オーナー「自分でスマホのキーボードで文字入れたり好きにやれるようにもしたい。
// フォントや色とかも選べて　こだわりたい人は　スタンプ入れたりとか」）。画面を持たない部品だけを置く（撮影・受け取り・ギャラリーが共通で読む）。
// 落書きは絵ではなく中身（文字・スタンプ・ペンの線）として保存し、落書き無しの写真（img/cgs/purikura-clean/）の上に SVG で描き直す。
// 座標は写真の画素（640×1080・2コマのシール）。保存の大きさを抑えるため、数と長さに上限を置く（normalizeDoodle）。
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
  return { v: 1, items, strokes }; // 何も描かずに「できた！」でも、落書き無しの写真のまま受け取る
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

/** 落書きの層（viewBox は写真の画素）。写真の上に重ねる */
export function doodleSvg(doodle, className = "pkd-layer") {
  const root = svg("svg", { viewBox: `0 0 ${DOODLE_W} ${DOODLE_H}`, class: className, "aria-hidden": "true" });
  const data = normalizeDoodle(doodle);
  if (!data) return root;
  for (const st of data.strokes) root.append(strokeNode(st));
  for (const it of data.items) root.append(itemNode(it));
  return root;
}
