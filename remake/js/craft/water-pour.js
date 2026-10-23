// 水入れミニゲーム（試遊）の計算部分。描画・入力・音は持たない。
// 座標は hookah_base 原画（1280×1133）のピクセル。yは下向き。
// 水量は「ガラス内側の断面積（px²）」で持ち、波の見た目とは分けて判定する。

// ガラスの内側（縁の厚みを除いた輪郭）。[y, 左x, 右x]。原画の不透明部分から24px内側。
const PROFILE = [
  [95, 522, 752], [150, 518, 754], [170, 528, 744], [190, 534, 739], [210, 533, 739], [230, 539, 734],
  [270, 544, 729], [330, 544, 729], [350, 544, 734], [370, 539, 734], [390, 533, 739], [410, 528, 748],
  [430, 518, 758], [450, 502, 774], [470, 487, 789], [490, 462, 813], [510, 430, 845], [530, 399, 876],
  [550, 370, 908], [570, 350, 927], [590, 331, 944], [610, 316, 962], [630, 302, 972], [650, 290, 985],
  [670, 281, 993], [690, 277, 999], [710, 272, 1003], [730, 267, 1007], [790, 267, 1007], [810, 272, 1003],
  [830, 277, 998], [850, 286, 989], [870, 294, 980], [890, 307, 967], [910, 324, 952], [930, 345, 931],
  [950, 370, 904],
];

export const POUR = Object.freeze({
  image: { w: 1280, h: 1133 },
  // 卓に接するボトル底の右端。傾けるときはここを支点にする。
  pivot: { x: 637, y: 640 },
  mouth: { left: [522, 95], right: [752, 95] },
  // 目安線を引く範囲（胴の上側）。ここより上は首が細く、水位が一気に上がる。
  targetRange: [575, 690],
  pxPerMm: 4.25, // 内側の高さ855px ≒ 20cm
  totalMl: 900,
  pourRate: 32000, // px²/秒（全開時）
  maxTilt: 62 * Math.PI / 180,
  // 目安線からのズレ（mm）
  grades: [[1, "perfect", "ぴったり"], [2.5, "great", "いい感じ"], [5, "good", "ほぼ目安"]],
});

/** ガラス内側の多角形（原画座標・時計回り）。 */
export const interior = Object.freeze([
  ...PROFILE.map(([y, l]) => [l, y]),
  ...PROFILE.slice().reverse().map(([y, , r]) => [r, y]),
].map(p => Object.freeze(p)));

export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export const capacityArea = polygonArea(interior);

/** 支点まわりに角度θ（正＝右へ倒す・時計回り）だけ回した点。 */
export function rotate([x, y], theta, pivot = POUR.pivot) {
  const dx = x - pivot.x, dy = y - pivot.y, c = Math.cos(theta), s = Math.sin(theta);
  return [pivot.x + dx * c - dy * s, pivot.y + dx * s + dy * c];
}

export function rotatedInterior(theta) {
  return theta ? interior.map(p => rotate(p, theta)) : interior.map(p => [p[0], p[1]]);
}

/** 水平線 y=h より下（y>=h）にある多角形の面積。 */
export function areaBelow(points, h) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ina = a[1] >= h, inb = b[1] >= h;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (h - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, h]);
    }
  }
  return out.length >= 3 ? polygonArea(out) : 0;
}

/** その傾きで面積volumeの水が作る水面の高さ（世界座標のy）。 */
export function surfaceY(volume, theta = 0, points = rotatedInterior(theta)) {
  let top = Infinity, bottom = -Infinity;
  for (const [, y] of points) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  if (volume <= 0) return bottom;
  if (volume >= capacityArea) return top;
  let lo = top, hi = bottom;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (areaBelow(points, mid) > volume) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 口の低い側の縁（世界座標）。 */
export function lip(theta) {
  const l = rotate(POUR.mouth.left, theta), r = rotate(POUR.mouth.right, theta);
  return l[1] > r[1] ? l : r;
}

/** その傾きでこぼれずに入っていられる水の量。 */
export function holdable(theta, points = rotatedInterior(theta)) {
  return areaBelow(points, lip(theta)[1]);
}

/** 立てた状態の水位y（原画座標）に対応する水量。 */
export const volumeAtLevel = y => areaBelow(interior, y);

export const toMl = area => area / capacityArea * POUR.totalMl;

/** 実水量と目安線のズレ（mm、正＝多い）。波は含めない。 */
export function levelErrorMm(volume, targetY) {
  return (targetY - surfaceY(volume, 0)) / POUR.pxPerMm;
}

export function gradePour(errorMm) {
  const abs = Math.abs(errorMm);
  const hit = POUR.grades.find(([limit]) => abs <= limit);
  if (hit) return { kind: hit[1], label: hit[2], errorMm };
  return { kind: "miss", label: errorMm > 0 ? "入れすぎ" : "足りない", errorMm };
}

export function formatError(errorMm) {
  const v = Math.round(errorMm * 10) / 10;
  if (Math.abs(v) < .05) return "±0.0mm";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}mm`;
}

/** 0〜1の乱数から、目安線の高さを決める。 */
export function pickTarget(random = Math.random) {
  const [a, b] = POUR.targetRange;
  return Math.round(a + (b - a) * random());
}
