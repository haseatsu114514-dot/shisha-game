// モーショングラフィックスの部品（CI108）。アフターエフェクツのシェイプレイヤーのように、
// 線を描いて引っ込める放射線・広がる輪・図形の紙吹雪・1文字ずつ出る文字・強い緩急をまとめる。
// 配色は「紫1色（mono）」と「場面ごとの色（free）」の2系統。?mopal=free か __remake.dev.motionPalette("free") で切り替える。
// 動きは場面ごとに a／b の2パターン（?movar=b）。
import { el } from "./util.js";
import { svg, move } from "./transition-kit.js";

export const MG_EASE = {
  out: "cubic-bezier(.16,1,.3,1)", // expo out: 速く出て、静かに止まる
  in: "cubic-bezier(.7,0,.84,0)", // expo in: ためてから一気に
  inOut: "cubic-bezier(.87,0,.13,1)",
  back: "cubic-bezier(.34,1.56,.64,1)", // 少し行きすぎて戻る
};

export const MOTION_PALETTES = ["mono", "free"];
const STORE_KEY = "suien_motion_palette";
export function motionPalette() {
  const q = new URLSearchParams(location.search).get("mopal");
  if (MOTION_PALETTES.includes(q)) return q;
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (MOTION_PALETTES.includes(saved)) return saved;
  } catch { /* 保存できない環境では既定 */ }
  return "mono";
}
export function setMotionPalette(name) {
  try { localStorage.setItem(STORE_KEY, name); } catch { /* 保存できない環境 */ }
}

// 同じ場面の別パターン（a／b）。本編で使うのは場面ごとの採用（オーナー選択・CI121〜CI123）。
// 比べるときは ?movar=a|b（全場面をそろえる）か __remake.dev.motionVariant("b")。"auto" で採用に戻す
export const MOTION_VARIANTS = ["a", "b"];
export const ADOPTED_VARIANT = { door: "a", cheki: "b", tarot: "a", gift: "a", shift: "b", shark: "b", sketch: "b" };
const VARIANT_KEY = "suien_motion_variant";
export function motionVariant(scene) {
  const q = new URLSearchParams(location.search).get("movar");
  if (MOTION_VARIANTS.includes(q)) return q;
  try {
    const saved = localStorage.getItem(VARIANT_KEY);
    if (MOTION_VARIANTS.includes(saved)) return saved;
  } catch { /* 保存できない環境では採用の既定 */ }
  return ADOPTED_VARIANT[scene] || "a";
}
export function setMotionVariant(name) {
  try {
    if (MOTION_VARIANTS.includes(name)) localStorage.setItem(VARIANT_KEY, name);
    else localStorage.removeItem(VARIANT_KEY);
  } catch { /* 保存できない環境 */ }
}

/** 紫1色。濃淡だけで描く（どの場面でも共通） */
export const MONO = { bg: "#241a4a", deep: "#150e30", main: "#6b4fb0", mid: "#9a82d8", light: "#ded3f7", white: "#f7f3ff" };

/** 場面の配色を選ぶ。free は場面ごとの色、mono は紫1色（場面の都合で役割だけ入れ替えるときは mono に渡す） */
export const pick = (free, mono = {}) => (motionPalette() === "free" ? { ...MONO, ...free } : { ...MONO, ...mono });

/** 中心から放射状に、線が伸びてから根元から消える（トリムパス） */
export function burst(root, cx, cy, { n = 8, r0 = 60, r1 = 150, color = "#fff", width = 6, delay = 0, dur = 460, turn = 0 } = {}) {
  const g = svg("g", { stroke: color, "stroke-width": width, "stroke-linecap": "round" });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + turn;
    const line = svg("line", { x1: cx + Math.cos(a) * r0, y1: cy + Math.sin(a) * r0, x2: cx + Math.cos(a) * r1, y2: cy + Math.sin(a) * r1, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 });
    g.append(line);
    // 描く・引っ込める区間を分ける。全体の強い減速で中間点を一瞬で通り過ぎないようにする。
    move(line, [{ strokeDashoffset: 1, easing: "cubic-bezier(.25,1,.5,1)" }, { strokeDashoffset: 0, offset: 0.45, easing: "cubic-bezier(.5,0,.75,0)" }, { strokeDashoffset: -1 }], dur, { easing: "linear", delay });
  }
  root.append(g);
  setTimeout(() => g.remove(), delay + dur + 50);
  return g;
}

/** 衝撃波の輪。広がりながら線が細くなって消える */
export function ring(root, cx, cy, { r = 160, color = "#fff", width = 10, delay = 0, dur = 560 } = {}) {
  const c = svg("circle", { cx, cy, r, fill: "none", stroke: color, "stroke-width": width, class: "tr-scale" });
  c.style.transform = "scale(0)";
  root.append(c);
  move(c, [{ transform: "scale(0.15)", strokeWidth: width, opacity: 1 }, { transform: "scale(1)", strokeWidth: 0, opacity: 0 }], dur, { easing: MG_EASE.out, delay }).then(() => c.remove());
  return c;
}

/** 丸・三角・四角・波線の紙吹雪。重力で少し落ちながら回る */
export function confetti(root, cx, cy, { n = 18, colors = ["#fff"], spread = 300, delay = 0 } = {}) {
  const shapes = [
    (c) => svg("circle", { r: 7, fill: c }),
    (c) => svg("path", { d: "M 0 -9 L 8 6 L -8 6 Z", fill: c }),
    (c) => svg("rect", { x: -6, y: -6, width: 12, height: 12, fill: c }),
    (c) => svg("path", { d: "M -12 0 q 6 -8 12 0 t 12 0", stroke: c, "stroke-width": 4, fill: "none", "stroke-linecap": "round" }),
  ];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const d = spread * (0.5 + Math.random() * 0.6);
    const tx = Math.cos(a) * d, ty = Math.sin(a) * d;
    const piece = svg("g", { transform: `translate(${cx} ${cy})` }, [shapes[i % shapes.length](colors[i % colors.length])]);
    const inner = piece.firstChild;
    inner.setAttribute("class", "tr-scale"); // 自分の中心で回る
    root.append(piece);
    const spin = (Math.random() - 0.5) * 720;
    move(inner, [
      { transform: "translate(0px,0px) rotate(0deg) scale(0.4)", opacity: 1, easing: "cubic-bezier(.2,.7,.4,1)" },
      { transform: `translate(${tx}px,${ty}px) rotate(${spin * 0.6}deg) scale(1)`, opacity: 1, offset: 0.55, easing: "cubic-bezier(.55,.085,.68,.53)" },
      { transform: `translate(${tx * 1.1}px,${ty + 120}px) rotate(${spin}deg) scale(0.8)`, opacity: 0 },
    ], 1100 + Math.random() * 400, { easing: "linear", delay: delay + Math.random() * 80 }).then(() => piece.remove());
  }
}

/** 4つの尖ったきらめき */
export function twinkle(root, x, y, { size = 16, color = "#fff", delay = 0, dur = 700 } = {}) {
  const s = svg("path", { d: `M ${x} ${y - size} L ${x + size * 0.28} ${y - size * 0.28} L ${x + size} ${y} L ${x + size * 0.28} ${y + size * 0.28} L ${x} ${y + size} L ${x - size * 0.28} ${y + size * 0.28} L ${x - size} ${y} L ${x - size * 0.28} ${y - size * 0.28} Z`, fill: color, class: "tr-scale" });
  s.style.transform = "scale(0)";
  root.append(s);
  move(s, [{ transform: "scale(0) rotate(0deg)", easing: "cubic-bezier(.22,1,.36,1)" }, { transform: "scale(1) rotate(45deg)", offset: 0.4, easing: "cubic-bezier(.37,0,.63,1)" }, { transform: "scale(0) rotate(90deg)" }], dur, { easing: "linear", delay }).then(() => s.remove());
}

/** 1文字ずつ下から出てくる文字（行ごとにはみ出しを隠す） */
export function kinetic(text, cls = "") {
  const line = el(`span.mg-kinetic${cls ? "." + cls : ""}`);
  [...text].forEach((ch, i) => line.append(el("span.mg-char", { text: ch === " " ? " " : ch, style: { "--k": String(i) } })));
  return line;
}
export function playKinetic(line, { delay = 0, step = 28, dur = 420 } = {}) {
  const chars = [...line.querySelectorAll(".mg-char")];
  return Promise.all(chars.map((c, i) => move(c, [{ transform: "translateY(110%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], dur, { easing: MG_EASE.out, delay: delay + i * step })));
}
