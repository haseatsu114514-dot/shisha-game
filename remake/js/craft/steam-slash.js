// #356: オーナーの追加指定で、移動入力にかかわらず上側の前方へ固定。
import { el } from "../core/util.js";

export const SLASH_REACH = 80;
export const SLASH_HALF_ANGLE = Math.PI * 2 / 9;
export const SLASH_RECHARGE_SECONDS = 1.8;
// #356: オーナー承認済み案A。被弾までに続けて斬った言葉のコンボを数える。
export function slashProfile(wordsCut = 0) {
  if (wordsCut >= 6) return { tier: 2, reach: 100, recharge: 1.2, next: null };
  if (wordsCut >= 3) return { tier: 1, reach: 90, recharge: 1.5, next: 6 };
  return { tier: 0, reach: SLASH_REACH, recharge: SLASH_RECHARGE_SECONDS, next: 3 };
}
const ANGLES = { u: -Math.PI / 2, r: 0, d: Math.PI / 2, l: Math.PI };

export const slashAngle = direction => ANGLES[direction];
// 描画する刃と、切断面の向きを求める軌道は同じ曲線を使う。
const SLASH_CURVE = [
  [[32, -26], [48, -60], [87, -55], [97, -12]],
  [[97, -12], [102, 21], [86, 45], [64, 53]],
];
const SLASH_PATH = SLASH_CURVE.map(([p0, p1, p2, p3], i) => `${i ? "" : `M${p0.join(" ")}`}C${p1.join(" ")} ${p2.join(" ")} ${p3.join(" ")}`).join("");

// 扇形と弾の実寸矩形の交差。長い言葉も、触れた端だけで切れる。
export function slashTouchesBullet(b, hx, hy, angle, reach = SLASH_REACH, halfAngle = SLASH_HALF_ANGLE) {
  const left = b.x - hx, right = left + b.w, top = b.y - hy, bottom = top + b.h;
  const dx = Math.cos(angle), dy = Math.sin(angle), edge = Math.cos(halfAngle);
  const inside = (x, y) => {
    const distance = Math.hypot(x, y);
    return distance <= reach + 1e-7 && x * dx + y * dy >= distance * edge - 1e-7;
  };
  if (left <= 0 && right >= 0 && top <= 0 && bottom >= 0) return true;
  if ([[left, top], [right, top], [left, bottom], [right, bottom]].some(([x, y]) => inside(x, y))) return true;
  // 両端の半径と矩形の交差（slab法）。
  for (const a of [angle - halfAngle, angle + halfAngle]) {
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
    html: `<svg viewBox="-100 -100 200 200"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${ink}" stop-opacity=".15"/><stop offset=".55" stop-color="#f4ffff"/><stop offset="1" stop-color="${ink}"/></linearGradient></defs><path d="${SLASH_PATH}C74 30 77 6 67 -12C60 -24 47 -31 32 -26Z" fill="url(#${id})"/><path d="${SLASH_PATH}" fill="none" stroke="#fff" stroke-width="${tier === 2 ? 3 : 2}"/><path d="M22 -12L49 -31L43 -16Z" fill="${ink}" fill-opacity=".4"/>${flecks}</svg>` });
}

/** 刃の近い位置の接線で文字を二分する。文字自体の回転はローカル座標へ戻す。 */
export function wordCutGeometry(b, hx, hy, angle, reach = SLASH_REACH, rotation = 0) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const c = Math.cos(angle), s = Math.sin(angle);
  let nearest = Infinity, tangent = [c, s];
  for (const points of SLASH_CURVE) for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 1 - t;
    const point = [0, 1].map(k => u ** 3 * points[0][k] + 3 * u * u * t * points[1][k] + 3 * u * t * t * points[2][k] + t ** 3 * points[3][k]);
    const derivative = [0, 1].map(k => 3 * u * u * (points[1][k] - points[0][k]) + 6 * u * t * (points[2][k] - points[1][k]) + 3 * t * t * (points[3][k] - points[2][k]));
    const x = hx + (point[0] * c - point[1] * s) * reach / 100;
    const y = hy + (point[0] * s + point[1] * c) * reach / 100;
    const distance = (x - cx) ** 2 + (y - cy) ** 2;
    if (distance < nearest) { nearest = distance; tangent = [derivative[0] * c - derivative[1] * s, derivative[0] * s + derivative[1] * c]; }
  }
  const length = Math.hypot(...tangent), wx = -tangent[1] / length, wy = tangent[0] / length;
  const cr = Math.cos(rotation), sr = Math.sin(rotation);
  const normal = { x: wx * cr + wy * sr, y: -wx * sr + wy * cr };
  const corners = [[0, 0], [b.w, 0], [b.w, b.h], [0, b.h]];
  const side = ([x, y]) => (x - b.w / 2) * normal.x + (y - b.h / 2) * normal.y;
  const halves = [1, -1].map(sign => {
    const polygon = [];
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i], next = corners[(i + 1) % corners.length], va = side(a) * sign, vn = side(next) * sign;
      if (va >= 0) polygon.push(a);
      if ((va >= 0) !== (vn >= 0)) {
        const t = va / (va - vn);
        polygon.push([a[0] + (next[0] - a[0]) * t, a[1] + (next[1] - a[1]) * t]);
      }
    }
    return polygon;
  });
  return { normal, halves };
}

// 元の文字列と回転を保ち、切断面に垂直な方向へ判定のない破片を離す。
export function buildWordCutFx(b, hx, hy, angle, reach = SLASH_REACH) {
  const matrix = new DOMMatrix(b.node.style.transform || "none");
  const cut = wordCutGeometry(b, hx, hy, angle, reach, Math.atan2(matrix.b, matrix.a));
  const polygon = points => `polygon(${points.map(([x, y]) => `${(x * 100 / b.w).toFixed(3)}% ${(y * 100 / b.h).toFixed(3)}%`).join(",")})`;
  return el("div.dodge-word-cut", { "aria-hidden": "true", style: {
    left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`,
    transform: `matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},0,0)`, transformOrigin: b.node.style.transformOrigin || "center",
    "--cut-gradient-angle": `${Math.atan2(cut.normal.x, -cut.normal.y)}rad`,
  } }, cut.halves.map((points, i) => {
    const sign = i ? -1 : 1;
    return el(`span.dodge-cut-half.${i ? "lower" : "upper"}`, { text: b.node.textContent, style: {
      clipPath: polygon(points), "--cut-x": `${cut.normal.x * sign * 14}px`, "--cut-y": `${cut.normal.y * sign * 14}px`,
      "--cut-still-x": `${cut.normal.x * sign * 2}px`, "--cut-still-y": `${cut.normal.y * sign * 2}px`, "--cut-turn": `${sign * 6}deg`,
    } });
  }));
}

/** 大きな噛みつきは周囲の矩形と円の交差。見た目と同じ半径を使う。 */
export function sharkPulseTouchesBullet(b,x,y,radius) {
  const nx=Math.max(b.x,Math.min(x,b.x+b.w)),ny=Math.max(b.y,Math.min(y,b.y+b.h));
  return Math.hypot(nx-x,ny-y)<=radius;
}

export function buildSharkFx(x,y,angle,reach,pulse=false) {
  return el("div.dodge-slash-fx.shark-bite",{"aria-hidden":"true",dataset:{test:"shark-bite",pulse:String(pulse)},
    style:{left:`${x}px`,top:`${y}px`,"--angle":`${angle}rad`,width:`${reach*2}px`,height:`${reach*2}px`},
    html:`<svg viewBox="-100 -100 200 200">${pulse?'<circle r="100" fill="#a0e5f51c" stroke="#a6e7f7" stroke-width="3"/>':""}<path d="M-12 -80Q90 -92 97 -4L78 -17 69 -1 60 -20 49 -5 40 -27 27 -13 18 -37 5 -25Z" fill="#87bfd8" stroke="#e1f6ff" stroke-width="3"/><path d="M-12 80Q90 92 97 4L78 17 69 1 60 20 49 5 40 27 27 13 18 37 5 25Z" fill="#bed9e5" stroke="#e1f6ff" stroke-width="3"/></svg>`});
}
