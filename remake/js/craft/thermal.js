// 温度のイメージ。実際の温度だけを読み、採点・雑念・機材には干渉しない。
// 低温は薄く、適温は気持ちいい陽炎と煙、超えると黄色→赤の炎が燃え盛り、温度計の一番上で爆発して焦げる（TH12）。
// 炎はイメージなので台やボウルには付けない（TH04）。色と適温の見せ方は3案を切り替えて比べる（TH07〜TH09）。
import { el, clamp } from "../core/util.js";
import { IDEAL } from "./conditions.js";

// 温度帯の区切りと呼び名は全案共通。適温の端点は温度計と同じ。
const BANDS = [
  { id: "cold", label: "まだぬるい", until: .30 },
  { id: "warming", label: "熱が入っていく", until: IDEAL[0] },
  { id: "ready", label: "適温", until: IDEAL[1] },
  { id: "hot", label: "熱が強い", until: .76 },
  { id: "fire", label: "過熱", until: .90 },
  { id: "inferno", label: "灼熱・焦げる寸前", until: Infinity },
];
export function thermalBand(temp) {
  const t = clamp(Number.isFinite(temp) ? temp : 0, 0, 1);
  return BANDS.find(b => t < b.until || (b.id === "ready" && t === IDEAL[1]));
}

// 適温を超えてからの炎は全案共通で、黄色と赤だけ（青・紫はやめる TH12）。どの炎も画面の下から立ち、
// 高いものは画面の上まで届く（TH11）。flame=外炎・中炎・芯、reach=届く高さ（画面比）、calm=1で揃った穏やかな炎。
const FLAMES = {
  hot: { flame: ["#ff9a00", "#ffd21a", "#fff6c0"], reach: .5, speed: .95, calm: .3, smoke: "#4a2414" },
  fire: { flame: ["#e81e00", "#ff7a00", "#ffe066"], reach: .92, speed: 1.15, calm: 0, smoke: "#3a1722" },
  inferno: { flame: ["#d00000", "#ff5200", "#fff1a0"], reach: 1.25, speed: 1.5, calm: 0, smoke: "#1e0806" },
};
const SHARED_HOT = {
  fire: { colors: ["#e3200a", "#850011"], ink: "#ffcf3a", glow: ["#ff2a00", .58], sparks: 34, fire: FLAMES.fire, heat: 1 },
  inferno: { colors: ["#8e0800", "#240000"], ink: "#ffd23a", glow: ["#ff1a00", .7], sparks: 48, fire: FLAMES.inferno, heat: 1 },
};
// 台の上の煙と陽炎（作業風景のゆらぎ、px）は全案共通。適温は白くやわらかい煙で、熱が入っている感じだけを出す。
const AIR = {
  cold: { smoke: ["#ffffff", .15], haze: 0 }, warming: { smoke: ["#fffaf2", .3], haze: 1.5 },
  ready: { smoke: ["#fff3e6", .6], haze: 4 }, hot: { smoke: ["#ffe2c8", .65], haze: 5 },
  fire: { smoke: ["#ffd6b8", .7], haze: 6 }, inferno: { smoke: ["#ffe0c8", .72], haze: 8 },
  burnt: { smoke: ["#1c1210", .92], haze: 0 },
};

/** 3案。motif: coal=シーシャの炭の角が赤→白く熾る／squares=参照動画の四角模様／rainbow=適温で虹色に揺らめく。 */
export const THERMAL_STYLES = {
  ember: {
    label: "炭火", motif: "coal",
    bands: {
      cold: { colors: ["#ece9e4", "#cdc7c0"], ink: "#ffffff", coal: "#d6d0c9", glow: ["#ffd9b8", 0], heat: 0 },
      warming: { colors: ["#cbc2b9", "#8e827a"], ink: "#fff3e8", coal: "#6f655f", glow: ["#ff7a3a", .12], heat: .38 },
      ready: { colors: ["#3c2a22", "#150c08"], ink: "#ffb26b", coal: "#2b201c", glow: ["#ff7a2a", .3], heat: .78, softSmoke: .13 },
      hot: { colors: ["#5c2210", "#230a04"], ink: "#ffc27a", coal: "#2f1810", glow: ["#ff6a00", .42], heat: .92, sparks: 16, fire: FLAMES.hot, softSmoke: .1 },
      ...SHARED_HOT,
    },
  },
  rainbow: {
    label: "虹", motif: "squares",
    bands: {
      cold: { colors: ["#eef0f6", "#d3d8e6"], ink: "#ffffff", glow: ["#e6ecff", 0] },
      warming: { colors: ["#f2e7f6", "#cde2f5"], ink: "#ffffff", glow: ["#e3d4ff", .1], pastel: true },
      ready: { colors: ["#231b4d", "#0c0922"], ink: "#ffffff", glow: ["#c08bff", .28], rainbow: true, softSmoke: .1 },
      hot: { colors: ["#ffb11f", "#ef6400"], ink: "#ffe47c", glow: ["#ff8a00", .42], sparks: 16, fire: FLAMES.hot },
      ...SHARED_HOT,
    },
  },
  steady: {
    label: "炎の強さ", motif: "squares",
    bands: {
      cold: { colors: ["#f4efe7", "#ddd3c6"], ink: "#ffffff", glow: ["#ffe2c2", 0], sparks: 8 },
      warming: { colors: ["#f7d8b6", "#e6a676"], ink: "#fff1e0", glow: ["#ffb070", .12], fire: { ...FLAMES.hot, reach: .13, speed: .55, calm: 1 } },
      ready: { colors: ["#ff9e46", "#c6421a"], ink: "#ffe0a8", glow: ["#ff9a3a", .3], fire: { ...FLAMES.hot, reach: .3, speed: .7, calm: 1 }, softSmoke: .1 },
      hot: { colors: ["#ff7a1a", "#b5260a"], ink: "#ffd27a", glow: ["#ff6a00", .44], sparks: 18, fire: { ...FLAMES.hot, reach: .48, calm: .2 } },
      ...SHARED_HOT,
    },
  },
};
export const DEFAULT_THERMAL_STYLE = "ember";
const BURNT = { id: "burnt", label: "シーシャが焦げてしまった", colors: ["#3a1d10", "#0b0503"], ink: "#ff7a2a", coal: "#1a0f0b", glow: ["#ff3c00", .3], sparks: 26, heat: .2 };

// 比較用: URLの ?thermal=rainbow などで案を切り替える。開発用フックからも変えられる。
let styleId = (() => {
  try { const id = new URLSearchParams(location.search).get("thermal"); return THERMAL_STYLES[id] ? id : DEFAULT_THERMAL_STYLE; } catch { return DEFAULT_THERMAL_STYLE; }
})();
const listeners = new Set();
export const thermalStyle = () => styleId;
export function setThermalStyle(id) {
  if (!THERMAL_STYLES[id]) return false;
  styleId = id; listeners.forEach((fn) => fn());
  return true;
}

// 炎の舌・ちぎれた炎・火の粉・煙・炭は、間隔も高さもまばらに一度だけ決める。描画は時刻だけで決まり、停止中は止まる。
let seed = 20261009;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const TONGUES = Array.from({ length: 32 }, (_, i) => ({
  x: (i + rnd() * 1.1 - .55) / 31, width: 18 + rnd() * 52, tall: .22 + rnd() ** 1.5 * .78,
  phase: rnd() * 6.283, speed: .65 + rnd() * .9,
}));
const SPARKS = Array.from({ length: 48 }, () => ({ x: rnd(), phase: rnd(), speed: .45 + rnd() * .9, wobble: rnd() * 6.283, size: 2 + rnd() * 3.5 }));
const PUFFS = Array.from({ length: 16 }, () => ({ x: rnd(), phase: rnd(), size: 28 + rnd() * 56, speed: .1 + rnd() * .14 }));
const DEBRIS = Array.from({ length: 42 }, () => ({ angle: rnd() * 6.283, speed: .35 + rnd() * .9, size: 3 + rnd() * 9, spin: rnd() * 6.283 }));
const TWINKLES = Array.from({ length: 34 }, () => ({ x: rnd(), y: rnd(), phase: rnd() * 6.283, size: 3 + rnd() * 6 }));
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

/** 一度だけ描いて使い回す小さな絵（炭の体・縁の熾り・白熱した角・やわらかい煙）。 */
function sprite(size, paint) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (g) paint(g, size);
  return c;
}
const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
const coalBodies = new Map();
function coalBody(color) {
  if (!coalBodies.has(color)) coalBodies.set(color, sprite(64, (g) => {
    roundRect(g, 4, 4, 56, 56, 9); g.fillStyle = color; g.fill();
    const shade = g.createLinearGradient(4, 4, 60, 60);
    shade.addColorStop(0, "rgba(255,255,255,.10)"); shade.addColorStop(1, "rgba(0,0,0,.28)");
    g.fillStyle = shade; g.fill();
    for (let i = 0; i < 26; i++) { g.fillStyle = i % 2 ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.12)"; g.fillRect(8 + hash(i, 1) * 46, 8 + hash(i, 2) * 46, 2, 2); }
  }));
  return coalBodies.get(color);
}
let edgeSprite, cornerSprite, softPuff, darkPuff;
function sprites() {
  edgeSprite ??= sprite(84, (g) => {
    g.shadowColor = "#ff3a00"; g.shadowBlur = 12; g.strokeStyle = "#ff5a1e"; g.lineWidth = 3.5;
    roundRect(g, 14, 14, 56, 56, 9); g.stroke(); g.stroke();
  });
  cornerSprite ??= sprite(36, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "#fffcee"); r.addColorStop(.3, "#ffe39a"); r.addColorStop(.62, "rgba(255,110,30,.55)"); r.addColorStop(1, "rgba(255,60,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
  const puff = (color) => sprite(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, color); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
  softPuff ??= puff("rgba(255,250,242,1)");
  darkPuff ??= puff("rgba(12,6,10,1)");
}

let hazeCount = 0;
export function buildThermalAtmosphere(host, worker) {
  const canvas = el("canvas.thermal-backdrop", { width: 960, height: 540, "aria-hidden": "true", dataset: { test: "thermal-background" } });
  const ctx = canvas.getContext("2d");
  const warp = document.createElement("canvas");
  warp.width = canvas.width; warp.height = canvas.height;
  const warpCtx = warp.getContext("2d");
  const label = el("span.thermal-label", { hidden: true, dataset: { test: "thermal-label" } });
  // 台の上には煙だけ。炎は背景のイメージに任せ、ボウルは燃やさない。
  const picture = el("div.thermal-picture", { "aria-hidden": "true", html: `<svg viewBox="0 0 160 200">
    <g class="thermal-wisps" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round">
      <path d="M70 184C17 143 132 116 65 79S69 30 85 12"/>
      <path d="M92 181C143 149 53 111 109 72S103 25 118 5"/>
      <path d="M55 170C2 135 60 108 34 82"/>
    </g></svg>` });
  // 適温あたりから作業風景がゆらぐ陽炎。強さは温度帯で変え、停止中・動きを減らす設定では止める。
  const hazeId = `thermal-haze-${++hazeCount}`;
  const haze = el("div.thermal-haze-defs", { "aria-hidden": "true", html: `<svg width="0" height="0"><filter id="${hazeId}" x="-4%" y="-4%" width="108%" height="108%">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.042" numOctaves="1" seed="7" result="noise">
      <animate attributeName="baseFrequency" dur="3.6s" values="0.011 0.042;0.013 0.058;0.011 0.042" repeatCount="indefinite"/>
    </feTurbulence>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"/>
  </filter></svg>` });
  const hazeSvg = haze.querySelector("svg"), displace = haze.querySelector("feDisplacementMap");
  const glow = el("div.thermal-glow", { "aria-hidden": "true" });
  const boom = el("div.thermal-boom", { "aria-hidden": "true" });
  const stage = worker.root.querySelector(".bench-worker-stage");
  const equipment = worker.root.querySelector(".worker-equipment");
  const bowlBottom = parseFloat(equipment?.querySelector(".worker-bowl")?.style.bottom);
  if (Number.isFinite(bowlBottom)) {
    picture.style.bottom = `${bowlBottom + 36}px`;
    boom.style.bottom = `calc(15% + ${bowlBottom + 40}px)`;
  }
  host.prepend(canvas);
  host.append(haze);
  equipment?.prepend(picture);
  equipment?.before(glow);
  equipment?.after(boom);
  worker.footer.append(label);
  let active = false, paused = false, temp = 0, phase = "", raf = 0, last = 0, time = 0, burstAt = -1;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const look = () => (burstAt >= 0 ? BURNT : { ...THERMAL_STYLES[styleId].bands[thermalBand(temp).id], id: thermalBand(temp).id, label: thermalBand(temp).label });

  /** 根元から先端へ揺れながら細くなる炎の舌。 */
  function tongue(cx, base, height, width, t, phaseOf, speed, calm = 0) {
    const N = 8, left = [], right = [], wild = 1 - calm * .7;
    for (let k = 0; k <= N; k++) {
      const f = k / N, y = base - height * f;
      const sway = (Math.sin(t * 4.4 * speed + phaseOf - f * 3.6) * .55 + Math.sin(t * 1.9 * speed + phaseOf * 1.7) * .4) * width * f * 1.15 * wild;
      const half = width * (1 - f) ** .8 * (1 + .24 * wild * Math.sin(t * 8.6 * speed + phaseOf + f * 7));
      left.push([cx + sway - half, y]); right.unshift([cx + sway + half, y]);
    }
    const points = left.concat(right);
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i], [nx, ny] = points[i + 1];
      ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    ctx.lineTo(...points.at(-1)); ctx.closePath(); ctx.fill();
  }
  function sparks(look, t, w, h, count, speedUp = 1) {
    ctx.fillStyle = look.fire?.flame[2] ?? look.ink;
    for (const s of SPARKS.slice(0, count)) {
      const p = (t * s.speed * .3 * speedUp + s.phase) % 1;
      ctx.globalAlpha = (1 - p) * .85;
      ctx.fillRect(s.x * w + Math.sin(t * 3 + s.wobble + p * 9) * 16, h - p * h * 1.05, s.size, s.size * 1.6);
    }
    ctx.globalAlpha = 1;
  }
  function smoke(puff, t, w, h, amount) {
    for (const s of PUFFS) {
      const p = (t * s.speed + s.phase) % 1, size = s.size * (.6 + p) * 2.4;
      ctx.globalAlpha = amount * Math.sin(p * Math.PI);
      ctx.drawImage(puff, s.x * w + Math.sin(t * .8 + s.phase * 9) * 30 - size / 2, h * .8 - p * h * .95 - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }
  /** 画面の後ろで燃える。どの舌も画面の下から立つ。calmが高いほど高さの揃った穏やかな炎、低いほどまばらに燃え盛る。 */
  function fire(look, t, w, h) {
    const { flame: [outer, mid, core], reach, speed, calm = 0 } = look.fire;
    if (calm < .5) smoke(darkPuff, t, w, h, .1 + reach * .22);
    const layers = [[outer, 1, 1, "source-over", .92], [mid, .62, .78, "screen", .95], [core, .3, .46, "screen", .9]];
    for (const [color, wScale, hScale, mode, alpha] of layers) {
      ctx.fillStyle = color; ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha;
      for (const g of TONGUES) {
        const tall = g.tall + (.62 - g.tall) * calm, jitter = 1 - calm * .75;
        const flicker = .78 + (.2 * Math.sin(t * 3.2 * g.speed * speed + g.phase) + .12 * Math.sin(t * 7.7 * g.speed * speed + g.phase * 2)) * jitter;
        const height = h * reach * tall * flicker * hScale;
        const x = calm ? g.x + ((Math.round(g.x * 31) / 31) - g.x) * calm : g.x;
        tongue(x * w, h + 14, height, (g.width + (34 - g.width) * calm) * wScale, t, g.phase, g.speed * speed, calm);
      }
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    if (look.sparks) sparks(look, t, w, h, look.sparks, speed);
  }
  /** 参照動画の大小の四角が斜めへ流れる。虹の案は適温で色相が巡り、淡い案は柔らかく色づく。 */
  function squares(look, t, w, h) {
    const travelRaw = t * (12 + temp * 25), k = Math.floor(travelRaw / 90), travel = travelRaw - k * 90;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-.2); ctx.lineWidth = 4;
    for (let iy = -5; iy < 5; iy++) for (let ix = -7; ix < 8; ix++) {
      const x = ix * 90 + travel, y = iy * 90 + travel;
      let color = look.ink, a = .13, b = .32;
      if (look.rainbow) { color = `hsl(${(ix - k) * 26 + (iy - k) * 44 + t * 60}, 95%, 66%)`; a = .55; b = .8; }
      else if (look.pastel) { color = `hsl(${(ix - k) * 26 + (iy - k) * 44 + t * 20}, 70%, 88%)`; a = .5; b = .6; }
      ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.strokeRect(x, y, 56, 56);
      ctx.globalAlpha = b; ctx.fillStyle = color; ctx.fillRect(x + 66, y + 60, 13, 13);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  /** シーシャの炭。温度が上がるほど、ばらばらに縁が赤く熾り、角から白く熱が回る（TH08）。 */
  function coals(look, t, w, h) {
    const heat = look.heat ?? 0, body = coalBody(look.coal ?? "#2b201c");
    const travelRaw = t * (5 + temp * 12), k = Math.floor(travelRaw / 90), travel = travelRaw - k * 90;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-.2);
    for (let iy = -5; iy < 5; iy++) for (let ix = -7; ix < 8; ix++) {
      const x = ix * 90 + travel, y = iy * 90 + travel, id1 = hash(ix - k, iy - k), id2 = hash(iy - k, ix - k);
      ctx.globalAlpha = heat ? 1 : .55;
      ctx.drawImage(body, x - 4, y - 4);
      ctx.drawImage(body, x + 62, y + 56, 20, 20);
      const ember = clamp((heat - id1 * .45) / .4, 0, 1) * (.8 + .2 * Math.sin(t * (.6 + id2 * .7) + id1 * 6.28));
      if (ember <= .01) continue;
      ctx.globalAlpha = ember; ctx.drawImage(edgeSprite, x - 14, y - 14);
      const white = clamp((ember - .5) / .5, 0, 1);
      if (white <= .01) continue;
      ctx.globalAlpha = white;
      for (const [cx, cy] of [[0, 0], [56, 0], [0, 56], [56, 56]]) ctx.drawImage(cornerSprite, x + cx - 18, y + cy - 18);
      ctx.drawImage(cornerSprite, x + 62, y + 56, 20, 20);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  /** 虹の案の適温: 淡いオーロラの帯と瞬き。 */
  function aurora(t, w, h) {
    ctx.globalCompositeOperation = "screen"; ctx.lineWidth = 70; ctx.lineCap = "round";
    for (let b = 0; b < 3; b++) {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsla(${i * 60 + t * 40 + b * 50}, 95%, 62%, .5)`);
      ctx.strokeStyle = g; ctx.globalAlpha = .28; ctx.beginPath();
      for (let x = -40; x <= w + 40; x += 40) {
        const y = h * (.28 + b * .2) + Math.sin(x * .006 + t * .5 + b * 2) * 44;
        x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    for (const s of TWINKLES) {
      const a = Math.max(0, Math.sin(t * 2.4 + s.phase));
      if (a < .05) continue;
      const x = s.x * w, y = s.y * h, r = s.size * a;
      ctx.globalAlpha = a; ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * .25, y - r * .25); ctx.lineTo(x + r, y); ctx.lineTo(x + r * .25, y + r * .25);
      ctx.lineTo(x, y + r); ctx.lineTo(x - r * .25, y + r * .25); ctx.lineTo(x - r, y); ctx.lineTo(x - r * .25, y - r * .25); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.lineCap = "butt";
  }
  /** 爆発: ボウルの位置から火の玉と破片が広がり、焦げた暗い背景に煙と残り火が残る。 */
  function explosion(t, w, h) {
    const p = reduced.matches ? 1 : clamp((t - burstAt) / 1.3, 0, 1);
    const cx = w * .3, cy = h * .34;
    smoke(darkPuff, t, w, h, .45);
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = "#c33a0c";
    for (const g of TONGUES.slice(0, 18)) tongue(g.x * w, h + 10, h * .18 * g.tall * (.8 + .2 * Math.sin(t * 3 + g.phase)), g.width * .7, t, g.phase, .6);
    ctx.globalCompositeOperation = "source-over";
    sparks(BURNT, t, w, h, BURNT.sparks, .7);
    if (p >= 1) return;
    const radius = Math.hypot(w, h) * (.08 + p * 1.05);
    const ball = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    ball.addColorStop(0, `rgba(255, 255, 240, ${1 - p})`);
    ball.addColorStop(.25, `rgba(255, 214, 90, ${(1 - p) * .95})`);
    ball.addColorStop(.6, `rgba(255, 92, 20, ${(1 - p) * .8})`);
    ball.addColorStop(1, "rgba(120, 20, 0, 0)");
    ctx.fillStyle = ball; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1 - p; ctx.strokeStyle = "#fff4c2"; ctx.lineWidth = 10 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(cx, cy, radius * .78, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#2a120a";
    for (const d of DEBRIS) {
      const r = d.speed * p * w * .9;
      ctx.save(); ctx.translate(cx + Math.cos(d.angle) * r, cy + Math.sin(d.angle) * r + p * p * 120); ctx.rotate(d.spin + p * 9);
      ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size * .6); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  /** 背景の陽炎: 横の帯ごとに少しずらし、熱い空気越しに見ているようにゆらす。 */
  function shimmer(amount, t, w, h) {
    if (!warpCtx || amount <= 0) return;
    warpCtx.clearRect(0, 0, w, h); warpCtx.drawImage(canvas, 0, 0);
    for (let y = 0; y < h; y += 6) {
      const dx = Math.sin(y * .045 + t * 3.4) * amount + Math.sin(y * .013 - t * 1.7) * amount * .6;
      ctx.drawImage(warp, 0, y, w, 6, dx, y, w, 6);
    }
  }
  function draw() {
    if (!ctx) return;
    sprites();
    const burnt = burstAt >= 0, style = THERMAL_STYLES[styleId], now = look(), w = canvas.width, h = canvas.height;
    const t = reduced.matches ? 0 : time;
    const gradient = ctx.createLinearGradient(0, 0, w * .4, h);
    now.colors.forEach((color, i) => gradient.addColorStop(i, color));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    if (style.motif === "coal" || burnt) coals(now, burnt ? 0 : t, w, h); else squares(now, t, w, h);
    if (now.rainbow) aurora(t, w, h);
    if (now.softSmoke) smoke(softPuff, t, w, h, now.softSmoke);
    if (burnt) explosion(t, w, h);
    else if (now.fire) fire(now, t, w, h);
    else if (now.sparks) sparks(now, t, w, h, now.sparks, .7);
    if (!burnt && !reduced.matches) shimmer((AIR[now.id]?.haze ?? 0) * .7, t, w, h);
  }
  function loop(now) {
    raf = 0;
    if (!active || !host.isConnected || host.classList.contains("done")) return;
    if (!paused && !document.hidden && now - last >= 33) {
      time += Math.min(.1, (now - last) / 1000); last = now; draw();
    }
    raf = requestAnimationFrame(loop);
  }
  function start() { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function setHaze(px) {
    const on = active && px > 0 && !reduced.matches;
    displace?.setAttribute("scale", String(on ? px : 0));
    if (stage) stage.style.filter = on ? `url(#${hazeId})` : "";
    host.dataset.thermalHaze = on ? String(px) : "0";
  }
  function paint(now) {
    phase = `${styleId}:${now.id}`; host.dataset.thermalBand = now.id; host.dataset.thermalStyle = styleId;
    const air = AIR[now.id] ?? AIR.cold;
    host.style.setProperty("--thermal-ink", now.ink);
    host.style.setProperty("--thermal-glow", now.glow[0]);
    host.style.setProperty("--thermal-glow-strength", now.glow[1]);
    host.style.setProperty("--thermal-smoke", air.smoke[0]);
    host.style.setProperty("--thermal-smoke-alpha", air.smoke[1]);
    label.textContent = `熱のイメージ · ${now.label}`;
    setHaze(air.haze);
    draw();
  }
  const restyle = () => { if (!host.isConnected) { listeners.delete(restyle); return; } if (active) paint(look()); };
  listeners.add(restyle);
  reduced.addEventListener?.("change", restyle);
  return {
    setStep(step) {
      active = ["steam", "pull", "care", "trial"].includes(step);
      paused = false; burstAt = -1; host.classList.remove("thermal-burnt");
      host.classList.toggle("thermal-active", active);
      host.dataset.thermalPaused = "false"; label.hidden = !active;
      hazeSvg?.unpauseAnimations?.();
      if (!active) { cancelAnimationFrame(raf); raf = 0; delete host.dataset.thermalBand; setHaze(0); }
      else { phase = ""; this.update(temp); start(); }
    },
    update(value) {
      temp = clamp(Number.isFinite(value) ? value : 0, 0, 1);
      canvas.dataset.temperature = temp.toFixed(4);
      if (!active || burstAt >= 0) return;
      if (phase !== `${styleId}:${thermalBand(temp).id}`) paint(look());
      // ベンチが会話から再接続された場合も再開する。
      start();
    },
    pause(value) {
      paused = value; host.dataset.thermalPaused = String(value); last = performance.now();
      value ? hazeSvg?.pauseAnimations?.() : hazeSvg?.unpauseAnimations?.();
    },
    /** 温度計の一番上で爆発する。背景は焦げたまま、工程が変わるまで煙と残り火が続く。 */
    explode() {
      if (!active) return;
      paused = false; burstAt = time;
      host.classList.add("thermal-burnt");
      boom.classList.remove("go"); void boom.offsetWidth; boom.classList.add("go");
      paint(BURNT); start();
    },
  };
}
