// くじの演出の粒子（火花・きらめき・紙吹雪・光の輪・ほこり）。1枚の canvas に描き、光るものは加算で重ねる。
// 座標はステージ（1280×720）の単位。ワイドステージでは canvas が左右の余白まで広がるので、原点を余白のぶんずらす。
// 動きを減らす設定では作らない（呼び出し側が createFx を呼ばない）。
import { el } from "../core/util.js";

const TAU = Math.PI * 2;
const MAX = 460; // 粒の上限（スマホでも重くならない数）
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];

// 光の粒の元絵（色ごとに1枚）。白い芯のまわりに色のにじみ
const sprites = new Map();
function glow(color) {
  let s = sprites.get(color);
  if (s) return s;
  s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d");
  const fill = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  fill.addColorStop(0, "#ffffff");
  fill.addColorStop(0.18, color);
  fill.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha = 0.95;
  g.fillStyle = fill;
  g.fillRect(0, 0, 64, 64);
  sprites.set(color, s);
  return s;
}

/**
 * host に粒子の層を足す。返り値の burst / ring / star / confetti / motes で粒を出し、destroy で片付ける。
 * 時間は自分で進める（requestAnimationFrame）。slow(k) で全体の時間の進みを変えられる（当たりの一瞬の溜め）。
 */
export function createFx(host, { className = "kj-fx" } = {}) {
  const canvas = el("canvas", { class: className, "aria-hidden": "true" });
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let parts = [], raf = 0, prev = 0, ox = 0, rate = 1, alive = true, blank = true;
  let ambient = null, rain = null;

  function fit() {
    const w = Math.max(1, host.clientWidth || 1280), h = Math.max(1, host.clientHeight || 720);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ox = (w - 1280) / 2;
  }
  const add = (p) => { if (parts.length < MAX) parts.push(p); };

  function draw(p) {
    const k = p.age / p.life; // 0→1
    const fade = p.fadeIn ? Math.min(1, k / p.fadeIn) * (1 - k) ** (p.ease || 1) : (1 - k) ** (p.ease || 1);
    const x = p.x + ox;
    if (p.kind === "spark" || p.kind === "mote") {
      const size = p.size * (p.kind === "mote" ? 1 : 0.5 + 0.5 * (1 - k));
      const tw = p.kind === "mote" ? 0.55 + 0.45 * Math.sin(p.age * p.tw + p.ph) : 1;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, fade * p.alpha * tw);
      ctx.drawImage(glow(p.color), x - size / 2, p.y - size / 2, size, size);
    } else if (p.kind === "star") {
      // 十字のきらめき: ふくらんで消える
      const s = p.size * Math.sin(Math.PI * Math.min(1, k * 1.05)) ** 0.8;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, p.alpha * (1 - k * 0.4));
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot + p.age * p.spin);
      ctx.fillStyle = p.color;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.09, -s * 0.09, s * 0.62, 0);
        ctx.quadraticCurveTo(s * 0.09, s * 0.09, 0, s); ctx.quadraticCurveTo(-s * 0.09, s * 0.09, -s * 0.62, 0);
        ctx.quadraticCurveTo(-s * 0.09, -s * 0.09, 0, -s);
        ctx.fill();
        ctx.rotate(Math.PI / 2);
      }
      ctx.restore();
      ctx.globalAlpha = Math.max(0, p.alpha * (1 - k) * 0.8);
      ctx.drawImage(glow(p.color), x - s, p.y - s, s * 2, s * 2);
    } else if (p.kind === "ring") {
      const r = p.r0 + (p.r1 - p.r0) * (1 - (1 - k) ** 3);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, (1 - k) * p.alpha);
      ctx.strokeStyle = p.color;
      // 細い線ではなく、にじんだ光の帯にする（外側へ行くほど太く薄く）
      for (const [w, a] of [[p.width * 3.2, 0.16], [p.width * 1.7, 0.3], [p.width * 0.7, 1]]) {
        ctx.globalAlpha = Math.max(0, (1 - k) * p.alpha * a);
        ctx.lineWidth = Math.max(0.5, w * (1 - k * 0.6));
        ctx.beginPath();
        ctx.ellipse(x, p.y, r, r * (p.flat || 1), 0, 0, TAU);
        ctx.stroke();
      }
    } else if (p.kind === "streak") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, fade * p.alpha);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, p.y);
      ctx.lineTo(x - p.vx * p.len, p.y - p.vy * p.len);
      ctx.stroke();
    } else if (p.kind === "confetti") {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 4) * p.alpha);
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot + p.age * p.spin);
      ctx.scale(1, Math.cos(p.age * p.flip + p.ph)); // ひらひら裏返る
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      ctx.restore();
    }
  }

  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - (prev || now)) / 1000) * rate;
    prev = now;
    fit();
    if (ambient) {
      ambient.acc += dt * ambient.rate;
      while (ambient.acc >= 1) {
        ambient.acc -= 1;
        add({ kind: "mote", x: rnd(-ox - 20, 1300 + ox), y: rnd(60, 660), vx: rnd(-8, 8), vy: rnd(-14, -4), g: 0, drag: 0,
          size: rnd(5, 13), color: pickOf(ambient.colors), alpha: rnd(0.25, 0.6), life: rnd(2.4, 4.6), age: 0, fadeIn: 0.25, tw: rnd(2, 5), ph: rnd(0, TAU) });
      }
    }
    if (rain) {
      rain.left -= dt;
      rain.acc += dt * rain.rate;
      while (rain.acc >= 1) {
        rain.acc -= 1;
        add({ kind: "confetti", x: rnd(-ox - 40, 1320 + ox), y: -20, vx: rnd(-40, 40), vy: rnd(120, 260), g: 60, drag: 0.4, sway: rnd(20, 60),
          size: rnd(9, 17), color: pickOf(rain.colors), alpha: 1, life: rnd(3.2, 4.6), age: 0, rot: rnd(0, TAU), spin: rnd(-3, 3), flip: rnd(5, 11), ph: rnd(0, TAU) });
      }
      if (rain.left <= 0) rain = null;
    }
    // 粒が無いあいだは描かない（何も変わらない canvas を毎フレーム合成させない）
    if (!parts.length) {
      if (!blank) { ctx.clearRect(0, 0, canvas.width, canvas.height); blank = true; }
      raf = requestAnimationFrame(frame);
      return;
    }
    blank = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let n = 0;
    for (const p of parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      if (p.age < 0) { parts[n++] = p; continue; } // 出番待ち（stars の delay）
      if (p.kind !== "ring") {
        const drag = Math.max(0, 1 - (p.drag || 0) * dt);
        p.vx *= drag; p.vy = p.vy * drag + (p.g || 0) * dt;
        p.x += (p.vx + (p.sway ? Math.sin(p.age * 2.2 + p.ph) * p.sway : 0)) * dt;
        p.y += p.vy * dt;
      }
      draw(p);
      parts[n++] = p;
    }
    parts.length = n;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    canvas,
    /** 中心から粒を飛ばす。angle±spread（ラジアン）の向きへ speed[min,max]（px/秒） */
    burst(x, y, { n = 18, colors = ["#fff"], kind = "spark", speed = [80, 320], angle = -Math.PI / 2, spread = Math.PI, gravity = 260, drag = 1.6, life = [0.4, 0.9], size = [10, 22], alpha = 1 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = angle + rnd(-spread, spread), v = rnd(speed[0], speed[1]);
        add({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity, drag, size: rnd(size[0], size[1]), color: pickOf(colors), alpha,
          life: rnd(life[0], life[1]), age: 0, ease: 1.4, len: 0.035, rot: rnd(0, TAU), spin: rnd(-4, 4), flip: rnd(6, 12), ph: rnd(0, TAU), sway: kind === "confetti" ? rnd(10, 40) : 0 });
      }
    },
    /** 十字のきらめきを範囲（中心 x,y・半径 rx,ry）に散らす */
    stars(x, y, { n = 6, colors = ["#fff"], rx = 60, ry = 60, size = [10, 26], life = [0.45, 0.9], delay = 0.5 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), d = Math.sqrt(Math.random());
        add({ kind: "star", x: x + Math.cos(a) * rx * d, y: y + Math.sin(a) * ry * d, vx: 0, vy: -6, g: 0, drag: 0, size: rnd(size[0], size[1]), color: pickOf(colors), alpha: 1,
          life: rnd(life[0], life[1]), age: -rnd(0, delay), rot: rnd(-0.3, 0.3), spin: rnd(-0.6, 0.6) });
      }
    },
    /** 広がる光の輪（flat で楕円にして床の上の輪にする） */
    ring(x, y, { color = "#fff", r0 = 8, r1 = 140, width = 8, life = 0.5, alpha = 0.9, flat = 1 } = {}) {
      add({ kind: "ring", x, y, r0, r1, width, color, alpha, life, age: 0, flat });
    },
    /** 灯りの中を漂うほこり（colors を渡すと出し続け、null で止める） */
    motes(colors, perSecond = 9) { ambient = colors ? { colors, rate: perSecond, acc: 0 } : null; },
    /** 上から降る紙吹雪（seconds のあいだ） */
    confetti(colors, { seconds = 2.4, perSecond = 46 } = {}) { rain = { colors, rate: perSecond, acc: 0, left: seconds }; },
    slow(k = 1) { rate = k; },
    clear() { parts = []; ambient = rain = null; },
    destroy() { alive = false; cancelAnimationFrame(raf); canvas.remove(); parts = []; },
  };
}
