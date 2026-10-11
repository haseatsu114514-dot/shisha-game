// SF61・64: 前方だけを切る。方向入力なしは上、入力ありは四方向。
import { el } from "../core/util.js";

export const SLASH_REACH = 80;
export const SLASH_HALF_ANGLE = Math.PI * 2 / 9;
export const SLASH_RECHARGE_SECONDS = 1.8;
// #356: オーナー承認済み案A。同じ蒸らし中に斬った言葉だけを数える。
export function slashProfile(wordsCut = 0) {
  if (wordsCut >= 6) return { tier: 2, reach: 100, recharge: 1.2, next: null };
  if (wordsCut >= 3) return { tier: 1, reach: 90, recharge: 1.5, next: 6 };
  return { tier: 0, reach: SLASH_REACH, recharge: SLASH_RECHARGE_SECONDS, next: 3 };
}
const ANGLES = { u: -Math.PI / 2, r: 0, d: Math.PI / 2, l: Math.PI };

export function slashDirection(held, x = 0, y = 0) {
  const key = [...held].at(-1);
  if (key) return key;
  if (!x && !y) return "u";
  return Math.abs(x) >= Math.abs(y) ? (x > 0 ? "r" : "l") : (y > 0 ? "d" : "u");
}
export const slashAngle = direction => ANGLES[direction];

// 扇形と弾の実寸矩形の交差。長い言葉も、触れた端だけで切れる。
export function slashTouchesBullet(b, hx, hy, angle, reach = SLASH_REACH) {
  const left = b.x - hx, right = left + b.w, top = b.y - hy, bottom = top + b.h;
  const dx = Math.cos(angle), dy = Math.sin(angle), edge = Math.cos(SLASH_HALF_ANGLE);
  const inside = (x, y) => {
    const distance = Math.hypot(x, y);
    return distance <= reach + 1e-7 && x * dx + y * dy >= distance * edge - 1e-7;
  };
  if (left <= 0 && right >= 0 && top <= 0 && bottom >= 0) return true;
  if ([[left, top], [right, top], [left, bottom], [right, bottom]].some(([x, y]) => inside(x, y))) return true;
  // 両端の半径と矩形の交差（slab法）。
  for (const a of [angle - SLASH_HALF_ANGLE, angle + SLASH_HALF_ANGLE]) {
    let near = 0, far = 1;
    for (const [v, lo, hi] of [[Math.cos(a) * reach, left, right], [Math.sin(a) * reach, top, bottom]]) {
      if (Math.abs(v) < 1e-7) { if (lo > 0 || hi < 0) { far = -1; break; } }
      else { near = Math.max(near, Math.min(lo / v, hi / v)); far = Math.min(far, Math.max(lo / v, hi / v)); }
    }
    if (near <= far) return true;
  }
  // 円弧が矩形の辺を横切る場合。角も半径も入らない細長い弾を拾う。
  for (const x of [left, right]) {
    if (Math.abs(x) > reach) continue;
    const y = Math.sqrt(Math.max(0, reach * reach - x * x));
    for (const v of [y, -y]) if (v >= top && v <= bottom && inside(x, v)) return true;
  }
  for (const y of [top, bottom]) {
    if (Math.abs(y) > reach) continue;
    const x = Math.sqrt(Math.max(0, reach * reach - y * y));
    for (const v of [x, -x]) if (v >= left && v <= right && inside(v, y)) return true;
  }
  return false;
}

export const SLASH_ART = '<svg viewBox="0 0 152 152" aria-hidden="true"><circle cx="76" cy="76" r="61" fill="#201927" fill-opacity=".5" stroke="#b6a5cf" stroke-width="2"/><path d="M35 101Q76 20 123 64Q83 39 35 101Z" fill="#edc3f1"/><path d="M35 101Q76 20 123 64" fill="none" stroke="#b9edff" stroke-width="3"/><g transform="translate(0 -10)"><path d="m56 102 44-48 8-3-2 9-44 48Z" fill="#f2f2fa" stroke="#a2b9d0" stroke-width="1.5"/><path d="m49 94 21 19m-14-7-10 11m-3-2 6 6" fill="none" stroke="#d6bc8c" stroke-width="5" stroke-linecap="round"/></g></svg>';
let fxId = 0;
export function buildSlashFx(x, y, angle, reach = SLASH_REACH, hit = false, tier = 0) {
  const r = reach;
  const id = `steam-slash-${++fxId}`;
  const ink = ["#b8e9ff", "#d5abff", "#ffe0a3"][tier];
  const flecks = tier > 0 ? `<path d="M26 -43L38 -51L33 -39ZM69 38L77 30L72 45Z" fill="${ink}"/>` : "";
  return el("div.dodge-slash-fx", { "aria-hidden": "true", dataset: { test: "dodge-slash-fx", hit: String(hit), tier: String(tier) },
    style: { left: `${x}px`, top: `${y}px`, "--angle": `${angle}rad`, width: `${r * 2}px`, height: `${r * 2}px` },
    // 弧は残す。半円状の一筆を厚い根元から細い先端へ流し、左右対称の扇を避ける。
    html: `<svg viewBox="-100 -100 200 200"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${ink}" stop-opacity=".15"/><stop offset=".55" stop-color="#f4ffff"/><stop offset="1" stop-color="${ink}"/></linearGradient></defs><path d="M32 -26C48 -60 87 -55 97 -12C102 21 86 45 64 53C74 30 77 6 67 -12C60 -24 47 -31 32 -26Z" fill="url(#${id})"/><path d="M32 -26C48 -60 87 -55 97 -12C102 21 86 45 64 53" fill="none" stroke="#fff" stroke-width="${tier === 2 ? 3 : 2}"/><path d="M22 -12L49 -31L43 -16Z" fill="${ink}" fill-opacity=".4"/>${flecks}</svg>` });
}
