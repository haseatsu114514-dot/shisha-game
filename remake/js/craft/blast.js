// 画面全体の大爆発（TH17）。ボウルの位置から白い閃光→画面を呑む火の玉→衝撃波と火の粉・破片が飛び、
// 煙を残して消える。下の作業台は焦げた背景のまま残る。動きを減らす設定では閃光だけにする。
import { el, clamp } from "../core/util.js";
import { layers } from "../core/ui.js";

let seed = 70913;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PUFFS = Array.from({ length: 46 }, () => ({ angle: rnd() * 6.283, speed: .35 + rnd() * .75, size: 60 + rnd() * 120, hue: rnd() }));
const DEBRIS = Array.from({ length: 70 }, () => ({ angle: rnd() * 6.283, speed: .4 + rnd() * 1.1, size: 4 + rnd() * 14, spin: rnd() * 6.283, ember: rnd() < .45 }));
const SMOKE = Array.from({ length: 22 }, () => ({ angle: rnd() * 6.283, speed: .15 + rnd() * .35, size: 140 + rnd() * 160 }));
const ease = (t) => 1 - (1 - t) ** 3;

/** origin: ステージ座標（1280×720）での爆心。戻り値は演出が終わると解決する。 */
export function screenBlast(origin = { x: 385, y: 240 }, { reduced = false, ms = 1800 } = {}) {
  const W = 1280, H = 720;
  const canvas = el("canvas.screen-blast", { width: W, height: H, "aria-hidden": "true", dataset: { test: "screen-blast" } });
  layers.fx?.append(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx || reduced) {
    canvas.classList.add("still");
    return new Promise((r) => setTimeout(() => { canvas.remove(); r(); }, reduced ? 450 : 0));
  }
  const reach = Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y));
  const started = performance.now();
  return new Promise((resolve) => {
    const frame = (now) => {
      const p = clamp((now - started) / ms, 0, 1);
      ctx.clearRect(0, 0, W, H);
      const fade = p < .55 ? 1 : 1 - (p - .55) / .45;
      // 火の玉: 一瞬で画面いっぱいに広がる。
      const r = reach * 1.25 * ease(clamp(p / .32, 0, 1)) + 20;
      const ball = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, r);
      ball.addColorStop(0, `rgba(255,255,245,${fade})`);
      ball.addColorStop(.18, `rgba(255,236,150,${fade})`);
      ball.addColorStop(.45, `rgba(255,140,30,${.96 * fade})`);
      ball.addColorStop(.75, `rgba(210,40,10,${.9 * fade})`);
      ball.addColorStop(1, `rgba(60,8,0,${.75 * fade})`);
      ctx.fillStyle = ball; ctx.fillRect(0, 0, W, H);
      // 渦巻く火の塊が外へ流れる。
      ctx.globalCompositeOperation = "screen";
      for (const f of PUFFS) {
        const d = ease(p) * reach * f.speed * 1.4, size = f.size * (.6 + p * 1.4);
        const x = origin.x + Math.cos(f.angle) * d, y = origin.y + Math.sin(f.angle) * d - p * 60;
        const g = ctx.createRadialGradient(x, y, 0, x, y, size);
        g.addColorStop(0, `rgba(255,${200 + f.hue * 55},${80 + f.hue * 60},${.75 * fade})`);
        g.addColorStop(1, "rgba(255,80,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // 黒煙が残って広がる。
      for (const s of SMOKE) {
        const d = ease(p) * reach * s.speed, size = s.size * (.5 + p);
        const x = origin.x + Math.cos(s.angle) * d, y = origin.y + Math.sin(s.angle) * d - p * 90;
        const g = ctx.createRadialGradient(x, y, 0, x, y, size);
        g.addColorStop(0, `rgba(20,10,8,${.55 * clamp((p - .25) / .3, 0, 1) * (1 - clamp((p - .7) / .3, 0, 1))})`);
        g.addColorStop(1, "rgba(20,10,8,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
      }
      // 衝撃波の輪が二重に抜ける。
      for (const [delay, width] of [[0, 18], [.12, 8]]) {
        const q = clamp((p - delay) / .45, 0, 1);
        if (q <= 0 || q >= 1) continue;
        ctx.globalAlpha = 1 - q; ctx.strokeStyle = "#fff7d6"; ctx.lineWidth = width * (1 - q) + 2;
        ctx.beginPath(); ctx.arc(origin.x, origin.y, reach * 1.3 * ease(q), 0, Math.PI * 2); ctx.stroke();
      }
      // 破片と火の粉。重力で落ちながら飛ぶ。
      for (const d of DEBRIS) {
        const dist = d.speed * ease(p) * reach * 1.1;
        const x = origin.x + Math.cos(d.angle) * dist, y = origin.y + Math.sin(d.angle) * dist + p * p * 260;
        ctx.globalAlpha = (1 - p) * (d.ember ? 1 : .9);
        ctx.fillStyle = d.ember ? "#ffd27a" : "#2a120a";
        ctx.save(); ctx.translate(x, y); ctx.rotate(d.spin + p * 10);
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size * (d.ember ? .45 : .7)); ctx.restore();
      }
      ctx.globalAlpha = 1;
      // 最初の一瞬は真っ白。
      if (p < .07) { ctx.fillStyle = `rgba(255,255,255,${1 - p / .07})`; ctx.fillRect(0, 0, W, H); }
      if (p < 1) requestAnimationFrame(frame);
      else { canvas.remove(); resolve(); }
    };
    requestAnimationFrame(frame);
  });
}
