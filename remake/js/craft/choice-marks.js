// 工程で比較するものを、そのまま小さい断面図／俯瞰図にする。装飾のみ（名前・選択状態はボタン側）。
import { el } from "../core/util.js";

function mark(shapes) {
  return el("i.craft-choice-mark", { "aria-hidden": "true",
    html: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>` });
}

export function packingMark(kind, locked) {
  const layers = { fluffy: [19], normal: [18, 23], firm: [16, 20, 24] }[kind];
  const leaves = layers.map(y => `<path d="M12 ${y} q4 -3 8 0 t8 0 t8 0"/>`).join("");
  const lock = locked ? '<rect x="31" y="31" width="12" height="10" rx="2"/><path d="M34 31v-3a3 3 0 0 1 6 0v3"/>' : "";
  return mark(`<path d="M7 15l3 11q2 5 12 6v5h5v-5q8-1 11-7l3-10"/>${leaves}${lock}`);
}

export function coalLayoutMark(count) {
  const spots = count === 3 ? [[24,12],[13,30],[35,30]] : [[15,15],[33,15],[15,33],[33,33]];
  return mark('<circle cx="24" cy="24" r="21" opacity=".6"/>' + spots.map(([x,y]) =>
    `<rect x="${x-5}" y="${y-5}" width="10" height="10" rx="2" fill="currentColor" transform="rotate(18 ${x} ${y})"/>`).join(""));
}

export function holePatternMark(rings) {
  const dots = rings.flatMap(({ r, targets }) => Array.from({ length: targets }, (_, i) => {
    const a = 2 * Math.PI * i / targets - Math.PI / 2;
    return `<circle cx="${(24+19*r*Math.cos(a)).toFixed(2)}" cy="${(24+19*r*Math.sin(a)).toFixed(2)}" r="1.25" stroke="none" fill="currentColor"/>`;
  })).join("");
  return mark(`<circle cx="24" cy="24" r="21" opacity=".65"/>${dots}`);
}

/** アルミを付けるか（PHN）: 付ける＝穴の並んだ面、付けない＝通気の切れ込みのある蓋。 */
export function foilMark(on) {
  if (on) return holePatternMark([{ r: .78, targets: 12 }, { r: .46, targets: 6 }]);
  const slots = [0, 60, 120, 180, 240, 300].map(a => `<path d="M24 9v7" transform="rotate(${a} 24 24)"/>`).join("");
  return mark(`<circle cx="24" cy="24" r="21" opacity=".65"/><circle cx="24" cy="24" r="6"/>${slots}`);
}

/** 炭の組み合わせ（PHN）: 同じ炭＝同じ四角3つ、混ぜる＝1つだけ大きい四角（キューブ）。 */
export function coalMixMark(mixed, count = 3) {
  const spots = count === 3 ? [[24,12],[13,30],[35,30]] : [[15,15],[33,15],[15,33],[33,33]];
  return mark('<circle cx="24" cy="24" r="21" opacity=".6"/>' + spots.map(([x,y], i) => {
    const big = mixed && i === 0, half = big ? 6.5 : 4.5;
    return `<rect x="${x-half}" y="${y-half}" width="${half*2}" height="${half*2}" rx="${big ? 1 : 2.5}" ${big ? 'fill="currentColor"' : 'fill="none"'} transform="rotate(18 ${x} ${y})"/>`;
  }).join(""));
}
