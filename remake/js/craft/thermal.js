// 温度のイメージ。実際の温度だけを読み、採点・雑念・機材には干渉しない。
// 参照映像の斜めの四角模様・炎・黒煙を、薄い霧→緑の適温→赤→青→紫の灼熱で画面の後ろに描く。
// 炎はイメージなので台やボウルには付けない（TH04）。温度計の一番上で爆発し、焦げた背景になる（TH06）。
import { el, clamp } from "../core/util.js";
import { IDEAL } from "./conditions.js";

// 低温は色の薄い霧、適温は緑、熱すぎると橙→赤→青→不穏な紫（2026-10-09 オーナー指定 TH02・TH05）。
// fire: 炎の色（外炎・中炎・芯）、reach: 炎の届く高さ（画面比）、speed: 揺らぎの速さ、sparks: 火の粉の数。
const BANDS = [
  { id: "cold", label: "まだぬるい", until: .30, colors: ["#e6eef1", "#c4d4db"], ink: "#ffffff", glow: ["#dcefff", 0] },
  { id: "warming", label: "熱が入っていく", until: IDEAL[0], colors: ["#d9efd6", "#a6d6b1"], ink: "#f2fff0", glow: ["#bff5cc", .1] },
  { id: "ready", label: "適温", until: IDEAL[1], colors: ["#3fd172", "#11935a"], ink: "#d2ffb8", glow: ["#5dff9a", .22] },
  { id: "hot", label: "熱が強い", until: .76, colors: ["#ffb11f", "#ef6400"], ink: "#ffe47c", glow: ["#ff8a00", .4], sparks: 14 },
  { id: "fire", label: "過熱", until: .84, colors: ["#e3200a", "#850011"], ink: "#ffcf3a", glow: ["#ff2a00", .58], sparks: 30,
    fire: { flame: ["#ff4d00", "#ffa800", "#fff2a0"], reach: .66, speed: 1, smoke: "#3a1722" } },
  { id: "blue", label: "超高温", until: .92, colors: ["#1d4fd8", "#050f45"], ink: "#9eeaff", glow: ["#2f7dff", .62], sparks: 38,
    fire: { flame: ["#1c5cff", "#45c3ff", "#e8fbff"], reach: .82, speed: 1.3, smoke: "#08102e" } },
  { id: "inferno", label: "灼熱・焦げる寸前", until: Infinity, colors: ["#7b0cb3", "#22003a"], ink: "#ff6af2", glow: ["#b42bff", .7], sparks: 48,
    fire: { flame: ["#a51cff", "#ff45d6", "#ffe6fa"], reach: 1, speed: 1.65, smoke: "#14061f" } },
];
const BURNT = { id: "burnt", label: "シーシャが焦げてしまった", colors: ["#3a1d10", "#0b0503"], ink: "#ff7a2a", glow: ["#ff3c00", .3], sparks: 26 };

export function thermalBand(temp) {
  const t = clamp(Number.isFinite(temp) ? temp : 0, 0, 1);
  // 適温の上端は温度計と同じく適温に含める。
  return BANDS.find(b => t < b.until || (b.id === "ready" && t === IDEAL[1]));
}

// 炎の舌・ちぎれた炎・火の粉・煙は、間隔も高さもまばらに一度だけ決める。描画は時刻だけで決まり、停止中は止まる。
let seed = 20261009;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const TONGUES = Array.from({ length: 30 }, (_, i) => ({
  x: (i + rnd() * 1.1 - .55) / 29, width: 16 + rnd() * 50, tall: .2 + rnd() ** 1.7 * .8,
  phase: rnd() * 6.283, speed: .65 + rnd() * .9, lift: rnd() < .3 ? rnd() * .16 : 0,
}));
const LICKS = Array.from({ length: 26 }, () => ({ x: rnd(), phase: rnd(), size: 7 + rnd() * 24, speed: .3 + rnd() * .55, drift: rnd() * 6.283 }));
const SPARKS = Array.from({ length: 48 }, () => ({ x: rnd(), phase: rnd(), speed: .45 + rnd() * .9, wobble: rnd() * 6.283, size: 2 + rnd() * 3.5 }));
const PUFFS = Array.from({ length: 16 }, () => ({ x: rnd(), phase: rnd(), size: 28 + rnd() * 56, speed: .1 + rnd() * .14 }));
const DEBRIS = Array.from({ length: 42 }, () => ({ angle: rnd() * 6.283, speed: .35 + rnd() * .9, size: 3 + rnd() * 9, spin: rnd() * 6.283 }));

export function buildThermalAtmosphere(host, worker) {
  const canvas = el("canvas.thermal-backdrop", { width: 960, height: 540, "aria-hidden": "true", dataset: { test: "thermal-background" } });
  const ctx = canvas.getContext("2d");
  const label = el("span.thermal-label", { hidden: true, dataset: { test: "thermal-label" } });
  // 台の上には煙だけ。炎は背景のイメージに任せ、ボウルは燃やさない。
  const picture = el("div.thermal-picture", { "aria-hidden": "true", html: `<svg viewBox="0 0 160 200">
    <g class="thermal-wisps" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round">
      <path d="M70 184C17 143 132 116 65 79S69 30 85 12"/>
      <path d="M92 181C143 149 53 111 109 72S103 25 118 5"/>
      <path d="M55 170C2 135 60 108 34 82"/>
    </g></svg>` });
  // 作業風景そのものも熱の色で照らす。爆発の閃光はボウルの位置から広がる。
  const glow = el("div.thermal-glow", { "aria-hidden": "true" });
  const boom = el("div.thermal-boom", { "aria-hidden": "true" });
  const equipment = worker.root.querySelector(".worker-equipment");
  const bowl = equipment?.querySelector(".worker-bowl");
  const bowlBottom = parseFloat(bowl?.style.bottom);
  if (Number.isFinite(bowlBottom)) {
    picture.style.bottom = `${bowlBottom + 36}px`;
    boom.style.bottom = `calc(15% + ${bowlBottom + 40}px)`;
  }
  host.prepend(canvas);
  equipment?.prepend(picture);
  equipment?.before(glow);
  equipment?.after(boom);
  worker.footer.append(label);
  let active = false, paused = false, temp = 0, phase = "", raf = 0, last = 0, time = 0, burstAt = -1;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** 根元から先端へ揺れながら細くなる炎の舌。 */
  function tongue(cx, base, height, width, t, phaseOf, speed) {
    const N = 8, left = [], right = [];
    for (let k = 0; k <= N; k++) {
      const f = k / N, y = base - height * f;
      const sway = (Math.sin(t * 4.4 * speed + phaseOf - f * 3.6) * .55 + Math.sin(t * 1.9 * speed + phaseOf * 1.7) * .4) * width * f * 1.15;
      const half = width * (1 - f) ** .8 * (1 + .24 * Math.sin(t * 8.6 * speed + phaseOf + f * 7));
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
  function sparks(band, t, w, h, count, speedUp = 1) {
    ctx.fillStyle = band.fire?.flame[2] ?? band.ink;
    for (const s of SPARKS.slice(0, count)) {
      const p = (t * s.speed * .3 * speedUp + s.phase) % 1;
      ctx.globalAlpha = (1 - p) * .85;
      ctx.fillRect(s.x * w + Math.sin(t * 3 + s.wobble + p * 9) * 16, h - p * h * 1.05, s.size, s.size * 1.6);
    }
    ctx.globalAlpha = 1;
  }
  function smoke(color, t, w, h, amount) {
    ctx.fillStyle = color;
    for (const s of PUFFS) {
      const p = (t * s.speed + s.phase) % 1;
      ctx.globalAlpha = amount * Math.sin(p * Math.PI);
      ctx.beginPath(); ctx.arc(s.x * w + Math.sin(t * .8 + s.phase * 9) * 30, h * .8 - p * h * .95, s.size * (.6 + p), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  /** 画面の後ろ一面で燃える。舌の間隔・高さはまばらで、ちぎれた炎が上へ昇っていく。 */
  function fire(band, t, w, h) {
    const { flame: [outer, mid, core], reach, speed } = band.fire;
    const strength = clamp((temp - .7) / .3, .3, 1);
    smoke(band.fire.smoke, t, w, h, .14 + strength * .16);
    const layers = [[outer, 1, 1, "source-over", .92], [mid, .62, .78, "screen", .95], [core, .3, .46, "screen", .9]];
    for (const [color, wScale, hScale, mode, alpha] of layers) {
      ctx.fillStyle = color; ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha;
      for (const g of TONGUES) {
        const flicker = .7 + .2 * Math.sin(t * 3.2 * g.speed * speed + g.phase) + .12 * Math.sin(t * 7.7 * g.speed * speed + g.phase * 2);
        const height = h * reach * g.tall * flicker * hScale;
        tongue(g.x * w, h + 12 - g.lift * h, height, g.width * wScale, t, g.phase, g.speed * speed);
      }
    }
    // 根元から離れた炎のかけらが、揺れながら上へ消えていく。
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = mid;
    for (const l of LICKS) {
      const p = (t * l.speed * .32 * speed + l.phase) % 1, size = l.size * (1 - p * .8);
      ctx.globalAlpha = (1 - p) * .9;
      tongue(l.x * w + Math.sin(t * 1.6 + l.drift + p * 5) * 34, h * (1 - reach * .25) - p * h * reach * .85, size * 2.6, size * .65, t, l.drift, speed);
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    sparks(band, t, w, h, band.sparks, speed);
  }
  /** 爆発: ボウルの位置から火の玉と破片が広がり、焦げた暗い背景に煙と残り火が残る。 */
  function explosion(t, w, h) {
    const p = reduced.matches ? 1 : clamp((t - burstAt) / 1.3, 0, 1);
    const cx = w * .3, cy = h * .34;
    smoke("#050302", t, w, h, .45);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "#c33a0c";
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
  function draw() {
    if (!ctx) return;
    const burnt = burstAt >= 0;
    const band = burnt ? BURNT : thermalBand(temp), w = canvas.width, h = canvas.height;
    const t = reduced.matches ? 0 : time;
    const gradient = ctx.createLinearGradient(0, 0, w * .4, h);
    band.colors.forEach((color, i) => gradient.addColorStop(i, color));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    // 大小の四角と枠が斜めへ流れる。画面全体で温度帯の色が変わる。
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-.2);
    const travel = burnt ? 0 : (t * (12 + temp * 25)) % 90;
    for (let y = -450; y < 450; y += 90) for (let x = -660; x < 660; x += 90) {
      ctx.globalAlpha = .13; ctx.strokeStyle = band.ink; ctx.lineWidth = 4;
      ctx.strokeRect(x + travel, y + travel, 56, 56);
      ctx.globalAlpha = .32; ctx.fillStyle = band.ink;
      ctx.fillRect(x + 66 + travel, y + 60 + travel, 13, 13);
    }
    ctx.restore(); ctx.globalAlpha = 1;
    if (burnt) explosion(t, w, h);
    else if (band.fire) fire(band, t, w, h);
    else if (band.sparks) sparks(band, t, w, h, band.sparks, .7);
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
  function paint(band) {
    phase = band.id; host.dataset.thermalBand = phase;
    host.style.setProperty("--thermal-ink", band.ink);
    host.style.setProperty("--thermal-glow", band.glow[0]);
    host.style.setProperty("--thermal-glow-strength", band.glow[1]);
    label.textContent = `熱のイメージ · ${band.label}`;
    draw();
  }
  return {
    setStep(step) {
      active = ["steam", "pull", "care", "trial"].includes(step);
      paused = false; burstAt = -1; host.classList.remove("thermal-burnt");
      host.classList.toggle("thermal-active", active);
      host.dataset.thermalPaused = "false"; label.hidden = !active;
      if (!active) { cancelAnimationFrame(raf); raf = 0; delete host.dataset.thermalBand; }
      else { phase = ""; this.update(temp); start(); }
    },
    update(value) {
      temp = clamp(Number.isFinite(value) ? value : 0, 0, 1);
      canvas.dataset.temperature = temp.toFixed(4);
      if (!active || burstAt >= 0) return;
      const band = thermalBand(temp);
      if (phase !== band.id) paint(band);
      // ベンチが会話から再接続された場合も再開する。
      start();
    },
    pause(value) { paused = value; host.dataset.thermalPaused = String(value); last = performance.now(); },
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
