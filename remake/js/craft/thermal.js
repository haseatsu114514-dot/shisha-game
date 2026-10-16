// 温度のイメージ。実際の温度だけを読み、採点・雑念・機材には干渉しない。
// 序盤は灰色→暖かい色、適温は穏やかな緑、最適温だけに静かな虹を描く。
// 超えるとだんだん火事のように黄色→赤の炎と黒煙が増え、
// 温度計の一番上で爆発して焦げる（TH06・TH12・TH13）。炎はイメージなので台やボウルには付けない（TH04）。
// 見た目は温度に沿って連続的に移り、温度帯は呼び名・陽炎・照らしの段階にだけ使う。
import { el, clamp } from "../core/util.js";
import { IDEAL, DANGER_TEMP, temperatureBands, isIdealTemperature, isOptimalTemperature, visualTemperature } from "./temperature-model.js";

// 倍率1での演出位置。判定/補間するときに一台の温度帯へ写し、危険.90以降は固定する。
// glow=作業風景を照らす色と強さ、haze=作業風景のゆらぎ(px)、smoke=台の上の煙の色と濃さ。
const BANDS = [
  { id: "cold", label: "まだぬるい", until: .30, ink: "#e8e8e8", glow: ["#ffffff", 0], haze: 0, smoke: ["#ffffff", 0] },
  { id: "warming", label: "熱が入っていく", until: IDEAL[0], ink: "#ffd9b0", glow: ["#ffb070", .12], haze: 0, smoke: ["#ffffff", 0] },
  { id: "ready", label: "適温", until: IDEAL[1], ink: "#a8eed3", glow: ["#7fe0c2", .15], haze: 0, smoke: ["#ffffff", 0] },
  { id: "hot", label: "熱が強い", until: .76, ink: "#ffd27a", glow: ["#ff8a00", .42], haze: 5, smoke: ["#ffffff", 0] },
  { id: "fire", label: "過熱", until: DANGER_TEMP, ink: "#ffcf3a", glow: ["#ff2a00", .58], haze: 6, smoke: ["#ddd7d0", .26] },
  { id: "inferno", label: "灼熱・焦げる寸前", until: Infinity, ink: "#ffd23a", glow: ["#ff1a00", .7], haze: 8, smoke: ["#cfc8c0", .42] },
];
// その一台がダメになったときの背景（焦げた／冷え切った／フレーバーが抜けた）。
const RUINED = {
  burnt: { id: "burnt", label: "シーシャが焦げてしまった", ink: "#ff7a2a", glow: ["#ff3c00", .3], haze: 0, smoke: ["#1c1210", .92] },
  cold: { id: "cold-out", label: "シーシャが冷え切ってしまった", ink: "#cfe6ff", glow: ["#9cc8ff", .16], haze: 0, smoke: ["#ffffff", 0] },
  leaf: { id: "leaf-out", label: "フレーバーがダメになってしまった", ink: "#c9b48a", glow: ["#8a7350", .14], haze: 0, smoke: ["#9a8f80", .3] },
};
const BURNT = RUINED.burnt;
const RUINED_BG = { burnt: ["#3a1d10", "#0b0503"], cold: ["#5d7487", "#18232e"], leaf: ["#4a3f31", "#161109"] };
export function thermalBand(temp, bands = temperatureBands()) {
  const t = clamp(Number.isFinite(temp) ? temp : 0, 0, 1);
  if (isOptimalTemperature(t, bands)) return { id: "optimal", label: "最適温", ink: "#ffe9ff", glow: ["#d3b9ff", .2], haze: 0, smoke: ["#ffffff", 0] };
  return BANDS.find(b => t < visualTemperature(b.until, bands) || (b.id === "ready" && t === bands.ideal[1]));
}

// 温度ごとの見た目の目印。間は線形に混ぜる。frost=冷気のきらめき（失敗時のみ）、warmth=暖かい色づき、rainbow=虹、
// halo=虹色の穏やかな炎の高さ、fire=黄色→赤の炎の濃さ、reach=その炎の届く高さ（画面比）、dark=黒煙、soft=白い煙、sparks=火の粉。
const STOPS = [
  { at: 0, bg: ["#cdcdcd", "#8e8e8e"], frost: 0, warmth: 0, rainbow: 0, halo: 0, fire: 0, reach: 0, dark: 0, soft: 0, sparks: 0 },
  { at: .30, bg: ["#d6ccc2", "#9c8d80"], frost: 0, warmth: .3, rainbow: 0, halo: 0, fire: 0, reach: 0, dark: 0, soft: .03, sparks: 0 },
  { at: .36, bg: ["#756451", "#29222a"], frost: 0, warmth: .9, rainbow: 0, halo: 0, fire: 0, reach: 0, dark: 0, soft: .07, sparks: 0 },
  { at: .415, bg: ["#b88653", "#5c3821"], frost: 0, warmth: .8, rainbow: 0, halo: 0, fire: 0, reach: 0, dark: 0, soft: .08, sparks: 0 },
  { at: IDEAL[0], bg: ["#21443e", "#101e24"], frost: 0, warmth: 0, rainbow: 0, halo: 0, fire: 0, reach: 0, dark: 0, soft: .1, sparks: 0 },
  { at: .54, bg: ["#34304d", "#141525"], frost: 0, warmth: 0, rainbow: 1, halo: .12, fire: 0, reach: 0, dark: 0, soft: .1, sparks: 0 },
  { at: IDEAL[1], bg: ["#21443e", "#101e24"], frost: 0, warmth: 0, rainbow: 0, halo: 0, fire: 0, reach: 0, dark: 0, soft: .1, sparks: 0 },
  { at: .69, bg: ["#6a2a2a", "#2a0c10"], frost: 0, warmth: 0, rainbow: 0, halo: 0, fire: .65, reach: .36, dark: .1, soft: .05, sparks: 12 },
  { at: .76, bg: ["#c4300c", "#5e0a0c"], frost: 0, warmth: 0, rainbow: 0, halo: 0, fire: 1, reach: .56, dark: .25, soft: 0, sparks: 24 },
  { at: .90, bg: ["#a40e00", "#260000"], frost: 0, warmth: 0, rainbow: 0, halo: 0, fire: 1, reach: .96, dark: .5, soft: 0, sparks: 40 },
  { at: 1, bg: ["#6a0500", "#100000"], frost: 0, warmth: 0, rainbow: 0, halo: 0, fire: 1, reach: 1.3, dark: .78, soft: 0, sparks: 48 },
];
// 黄色→赤の炎（外炎・中炎・芯）。青・紫は使わない（TH12）。
const FLAME_STOPS = [
  { at: IDEAL[1], flame: ["#ffb000", "#ffe14a", "#fff8d0"] },
  { at: .76, flame: ["#ff5a00", "#ffb000", "#fff2a0"] },
  { at: .90, flame: ["#e01800", "#ff7000", "#ffe066"] },
  { at: 1, flame: ["#b80000", "#ff4000", "#fff0a0"] },
];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mixColor = (a, b, k) => `rgb(${rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k)).join(",")})`;
function between(stops, temp, bands) {
  const t = clamp(Number.isFinite(temp) ? temp : 0, 0, 1);
  const i = Math.max(1, stops.findIndex((s) => visualTemperature(s.at, bands) >= t));
  const a = stops[i - 1], b = stops[i] ?? a, low = visualTemperature(a.at, bands), high = visualTemperature(b.at, bands);
  const k = high > low ? clamp((t - low) / (high - low), 0, 1) : 1;
  return [a, b, k];
}
export function envAt(temp, bands = temperatureBands()) {
  const [a, b, k] = between(STOPS, temp, bands), [fa, fb, fk] = between(FLAME_STOPS, temp, bands);
  const env = { bg: a.bg.map((c, i) => mixColor(c, b.bg[i], k)), flame: fa.flame.map((c, i) => mixColor(c, fb.flame[i], fk)) };
  for (const key of ["frost", "warmth", "rainbow", "halo", "fire", "reach", "dark", "soft", "sparks"]) env[key] = a[key] + (b[key] - a[key]) * k;
  // 虹は温度計の虹と同じ範囲だけ。緑の適温帯には炎・陽炎を出さない。
  if (!isOptimalTemperature(temp, bands)) { env.rainbow = 0; env.halo = 0; }
  if (isIdealTemperature(temp, bands)) { env.fire = 0; env.sparks = 0; }
  return env;
}

// 炎の舌・火の粉・煙・きらめきは、間隔も高さもまばらに一度だけ決める。描画は時刻だけで決まり、停止中は止まる。
let seed = 20261009;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const TONGUES = Array.from({ length: 32 }, (_, i) => ({
  x: (i + rnd() * 1.1 - .55) / 31, width: 18 + rnd() * 52, tall: .22 + rnd() ** 1.5 * .78,
  phase: rnd() * 6.283, speed: .65 + rnd() * .9,
}));
const SPARKS = Array.from({ length: 48 }, () => ({ x: rnd(), phase: rnd(), speed: .45 + rnd() * .9, wobble: rnd() * 6.283, size: 2 + rnd() * 3.5 }));
const PUFFS = Array.from({ length: 16 }, () => ({ x: rnd(), phase: rnd(), size: 28 + rnd() * 56, speed: .1 + rnd() * .14 }));
const CEILING = Array.from({ length: 14 }, () => ({ x: rnd(), y: rnd(), phase: rnd() * 6.283, size: 90 + rnd() * 110, speed: .02 + rnd() * .03 }));
const DEBRIS = Array.from({ length: 42 }, () => ({ angle: rnd() * 6.283, speed: .35 + rnd() * .9, size: 3 + rnd() * 9, spin: rnd() * 6.283 }));
const TWINKLES = Array.from({ length: 40 }, () => ({ x: rnd(), y: rnd(), phase: rnd() * 6.283, size: 3 + rnd() * 6, drift: rnd() }));

function sprite(size, paint) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (g) paint(g, size);
  return c;
}
let softPuff, darkPuff, charred;
function sprites() {
  const puff = (color) => sprite(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, color); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
  softPuff ??= puff("rgba(255,250,242,1)");
  darkPuff ??= puff("rgba(12,6,8,1)");
  charred ??= sprite(64, (g) => {
    g.beginPath(); g.roundRect ? g.roundRect(4, 4, 56, 56, 9) : g.rect(4, 4, 56, 56); g.fillStyle = "#1a0f0b"; g.fill();
  });
}

let hazeCount = 0;
export function buildThermalAtmosphere(host, worker, cs) {
  let bands = temperatureBands(cs);
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
    boom.style.bottom = `calc(7% + ${bowlBottom + 40}px)`;
  }
  host.prepend(canvas);
  host.append(haze);
  equipment?.prepend(picture);
  equipment?.before(glow);
  equipment?.after(boom);
  worker.footer.append(label);
  let active = false, paused = false, temp = 0, phase = "", raf = 0, last = 0, time = 0, burstAt = -1, ruined = null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** 根元から先端へ揺れながら細くなる炎の舌。calm=1で揺れの小さい穏やかな炎。 */
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
  function sparks(color, t, w, h, count, speedUp = 1) {
    ctx.fillStyle = color;
    for (const s of SPARKS.slice(0, Math.round(count))) {
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
  /** 火事の黒煙: 画面の上に溜まって、ゆっくり横へ流れる。 */
  function ceilingSmoke(t, w, h, amount) {
    for (const s of CEILING) {
      const x = ((s.x + t * s.speed) % 1.3 - .15) * w, y = (s.y * .34 - .06) * h + Math.sin(t * .6 + s.phase) * 12;
      const size = s.size * (1 + amount * .6);
      ctx.globalAlpha = amount * (.55 + .2 * Math.sin(t * .9 + s.phase));
      ctx.drawImage(darkPuff, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }
  /** 黄色→赤の炎。どの舌も画面の下から立ち、高いものは画面の上まで届く（TH11）。 */
  function fire(env, t, w, h) {
    const [outer, mid, core] = env.flame, speed = .9 + env.reach * .5;
    const layers = [[outer, 1, 1, "source-over", .92], [mid, .62, .78, "screen", .95], [core, .3, .46, "screen", .9]];
    for (const [color, wScale, hScale, mode, alpha] of layers) {
      ctx.fillStyle = color; ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha * env.fire;
      for (const g of TONGUES) {
        const flicker = .78 + .2 * Math.sin(t * 3.2 * g.speed * speed + g.phase) + .12 * Math.sin(t * 7.7 * g.speed * speed + g.phase * 2);
        tongue(g.x * w, h + 14, h * env.reach * g.tall * flicker * hScale, g.width * wScale, t, g.phase, g.speed * speed);
      }
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }
  /** 適温の虹色の炎: 高さのそろった穏やかな炎が、ゆっくり色を巡らせる（心地よい程度 TH13）。 */
  function halo(env, t, w, h) {
    const amount = Math.min(1, env.rainbow * 1.2);
    ctx.globalCompositeOperation = "screen";
    for (const [wScale, hScale, light, alpha] of [[1, 1, 60, .5], [.6, .78, 76, .5], [.28, .46, 94, .4]]) {
      for (const g of TONGUES) {
        const x = Math.round(g.x * 31) / 31, hue = (x * 360 + t * 40) % 360;
        ctx.fillStyle = `hsl(${hue}, 95%, ${light}%)`; ctx.globalAlpha = alpha * amount;
        const breathe = .9 + .1 * Math.sin(t * 1.6 + g.phase);
        tongue(x * w, h + 14, h * env.halo * .62 * breathe * hScale, 34 * wScale, t, g.phase, .7, 1);
      }
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }
  /** 参照動画の大小の四角が斜めへ流れる。序盤は色のない白、ぬるいうちに暖かく色づき、適温で虹色に巡る。 */
  function squares(env, ink, t, w, h) {
    const travelRaw = t * (12 + temp * 25), k = Math.floor(travelRaw / 90), travel = travelRaw - k * 90;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-.2); ctx.lineWidth = 4;
    for (let iy = -5; iy < 5; iy++) for (let ix = -7; ix < 8; ix++) {
      const x = ix * 90 + travel, y = iy * 90 + travel, hue = (ix - k) * 26 + (iy - k) * 44 + t * (20 + env.rainbow * 40);
      let color = ink, a = .13, b = .32;
      if (env.rainbow > .02) { color = `hsl(${hue}, 95%, ${66 + (1 - env.rainbow) * 18}%)`; a = .13 + .42 * env.rainbow; b = .32 + .48 * env.rainbow; }
      else if (env.warmth > .02) { color = `hsl(${28 + ((ix + iy) & 3) * 4}, ${40 + env.warmth * 45}%, ${86 - env.warmth * 8}%)`; a = .13 + .3 * env.warmth; b = .32 + .25 * env.warmth; }
      ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.strokeRect(x, y, 56, 56);
      ctx.globalAlpha = b; ctx.fillStyle = color; ctx.fillRect(x + 66, y + 60, 13, 13);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  /** 虹の帯（オーロラ）と瞬き。冷たいうちは同じ瞬きが白い冷気のきらめきになる。 */
  function aurora(env, t, w, h, optimal) {
    if (env.rainbow > .02) {
      ctx.globalCompositeOperation = "screen"; ctx.lineWidth = 70; ctx.lineCap = "round";
      for (let b = 0; b < 3; b++) {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsla(${i * 60 + t * 40 + b * 50}, 95%, 62%, .5)`);
        ctx.strokeStyle = g; ctx.globalAlpha = (.24 + (optimal ? .1 : 0)) * env.rainbow; ctx.beginPath();
        for (let x = -40; x <= w + 40; x += 40) {
          const y = h * (.24 + b * .18) + Math.sin(x * .006 + t * .5 + b * 2) * 44;
          x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over"; ctx.lineCap = "butt";
    }
    const glitter = Math.max(env.frost, env.rainbow * (optimal ? 1 : .7));
    if (glitter <= .02) return;
    ctx.fillStyle = env.frost > env.rainbow ? "#f4fbff" : "#ffffff";
    for (const s of TWINKLES.slice(0, optimal ? 40 : 30)) {
      const a = Math.max(0, Math.sin(t * (env.frost > env.rainbow ? 1.2 : 2.4) + s.phase)) * glitter;
      if (a < .05) continue;
      const x = s.x * w, y = ((s.y + t * .01 * s.drift * env.frost) % 1) * h, r = s.size * a;
      ctx.globalAlpha = a; ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * .25, y - r * .25); ctx.lineTo(x + r, y); ctx.lineTo(x + r * .25, y + r * .25);
      ctx.lineTo(x, y + r); ctx.lineTo(x - r * .25, y + r * .25); ctx.lineTo(x - r, y); ctx.lineTo(x - r * .25, y - r * .25); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  /** 爆発: ボウルの位置から火の玉と破片が広がり、焦げた暗い背景に煙と残り火が残る。 */
  function explosion(t, w, h) {
    const p = reduced.matches ? 1 : clamp((t - burstAt) / 1.3, 0, 1);
    const cx = w * .3, cy = h * .34;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-.2); ctx.globalAlpha = .7;
    for (let iy = -5; iy < 5; iy++) for (let ix = -7; ix < 8; ix++) ctx.drawImage(charred, ix * 90 - 4, iy * 90 - 4);
    ctx.restore(); ctx.globalAlpha = 1;
    smoke(darkPuff, t, w, h, .45);
    ceilingSmoke(t, w, h, .6);
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = "#c33a0c";
    for (const g of TONGUES.slice(0, 18)) tongue(g.x * w, h + 10, h * .18 * g.tall * (.8 + .2 * Math.sin(t * 3 + g.phase)), g.width * .7, t, g.phase, .6);
    ctx.globalCompositeOperation = "source-over";
    sparks(BURNT.ink, t, w, h, 26, .7);
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
  /** 冷え切った（霜が降りたような青灰色で、きらめきだけがゆっくり瞬く）／フレーバーが抜けた（くすんだ茶灰色に灰が落ちる）。 */
  function spoiled(kind, t, w, h) {
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-.2); ctx.lineWidth = 3;
    ctx.strokeStyle = kind === "cold" ? "#cfe6ff" : "#8a7a60"; ctx.globalAlpha = .12;
    for (let iy = -5; iy < 5; iy++) for (let ix = -7; ix < 8; ix++) ctx.strokeRect(ix * 90, iy * 90, 56, 56);
    ctx.restore(); ctx.globalAlpha = 1;
    if (kind === "cold") { aurora({ rainbow: 0, frost: 1 }, t, w, h, false); return; }
    ctx.fillStyle = "#b8ab96";
    for (const s of SPARKS) {
      const p = (t * s.speed * .12 + s.phase) % 1;
      ctx.globalAlpha = .35 * (1 - p);
      ctx.fillRect(s.x * w + Math.sin(t + s.wobble + p * 6) * 20, p * h, s.size, s.size);
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
    const burnt = ruined === "burnt", w = canvas.width, h = canvas.height, t = reduced.matches ? 0 : time;
    const env = ruined ? { bg: RUINED_BG[ruined] } : envAt(temp, bands), band = ruined ? RUINED[ruined] : thermalBand(temp, bands);
    const gradient = ctx.createLinearGradient(0, 0, w * .4, h);
    env.bg.forEach((color, i) => gradient.addColorStop(i, color));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    if (burnt) { explosion(t, w, h); return; }
    if (ruined) { spoiled(ruined, t, w, h); return; }
    squares(env, band.ink, t, w, h);
    aurora(env, t, w, h, isOptimalTemperature(temp, bands));
    if (env.soft > .01) smoke(softPuff, t, w, h, env.soft);
    if (env.dark > .01) smoke(darkPuff, t, w, h, env.dark * .5);
    if (env.halo > .01 && env.rainbow > .02) halo(env, t, w, h);
    if (env.fire > .01) fire(env, t, w, h);
    if (env.dark > .01) ceilingSmoke(t, w, h, env.dark);
    if (env.sparks >= 1) sparks(env.flame[2], t, w, h, env.sparks, .9 + env.reach * .5);
    if (!reduced.matches) shimmer(band.haze * .7, t, w, h);
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
  function paint(band) {
    phase = band.id; host.dataset.thermalBand = band.id;
    host.style.setProperty("--thermal-ink", band.ink);
    host.style.setProperty("--thermal-glow", band.glow[0]);
    host.style.setProperty("--thermal-glow-strength", band.glow[1]);
    host.style.setProperty("--thermal-smoke", band.smoke[0]);
    host.style.setProperty("--thermal-smoke-alpha", band.smoke[1]);
    label.textContent = `熱のイメージ · ${band.label}`;
    setHaze(band.haze);
    draw();
  }
  reduced.addEventListener?.("change", () => { if (active && host.isConnected) paint(ruined ? RUINED[ruined] : thermalBand(temp, bands)); });
  return {
    setStep(step) {
      active = ["steam", "pull", "care"].includes(step);
      paused = false; burstAt = -1; ruined = null; host.classList.remove("thermal-burnt", "thermal-ruined");
      host.classList.toggle("thermal-active", active);
      host.dataset.thermalPaused = "false"; label.hidden = !active;
      hazeSvg?.unpauseAnimations?.();
      if (!active) { cancelAnimationFrame(raf); raf = 0; delete host.dataset.thermalBand; setHaze(0); }
      else { phase = ""; this.update(temp); start(); }
    },
    update(value) {
      bands = temperatureBands(cs);
      temp = clamp(Number.isFinite(value) ? value : 0, 0, 1);
      canvas.dataset.temperature = temp.toFixed(4);
      if (!active || ruined) return;
      const band = thermalBand(temp, bands);
      if (phase !== band.id) paint(band);
      else if (paused) draw(); // 止まっている間も温度の変化だけは絵に返す
      // ベンチが会話から再接続された場合も再開する。
      start();
    },
    pause(value) {
      paused = value; host.dataset.thermalPaused = String(value); last = performance.now();
      value ? hazeSvg?.pauseAnimations?.() : hazeSvg?.unpauseAnimations?.();
    },
    /** その一台がダメになった背景へ切り替える。焦げたら爆発のあと煙と残り火、冷え切り・フレーバー切れはくすんだ色。工程が変わるまで続く。 */
    fail(kind) {
      if (!active || !RUINED[kind]) return;
      paused = false; ruined = kind;
      if (kind === "burnt") {
        burstAt = time;
        host.classList.add("thermal-burnt");
        boom.classList.remove("go"); void boom.offsetWidth; boom.classList.add("go");
      } else host.classList.add("thermal-ruined");
      paint(RUINED[kind]); start();
    },
    explode() { this.fail("burnt"); },
  };
}
