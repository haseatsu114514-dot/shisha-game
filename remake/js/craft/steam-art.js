// 精神世界の奥行き・弾の軌跡・消えた雑念の粒。ゲームと同じ時刻を描き、独立したRAFや乱数抽選は持たない。
import { el, clamp } from "../core/util.js";
import { smokeUrl } from "./smoke-art.js";
import { makingUrl } from "../core/data.js";

export const HEART_ART = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 24C9 20 2.5 15.5 2.5 9.5a6 6 0 0 1 11.5-2 6 6 0 0 1 11.5 2C25.5 15.5 19 20 14 24Z" fill="#8ecfbe" fill-opacity=".3" stroke="#f0e4bb" stroke-width="1.5"/><path d="M6 8a3 3 0 0 1 5-1" fill="none" stroke="#fffce6" stroke-linecap="round"/></svg>';
export const REFRESH_ART = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5a19 19 0 1 0 17 11M34 7l8 9-11 1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 26c7-12 9 8 17-6s8 1 13-2M11 32c8-8 10 6 17-2s6 0 9-2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-dasharray="1 5"/></svg>';
export const PRECISION_ART = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M24 5v11m0 16v11M5 24h11m16 0h11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="24" cy="24" r="3" fill="currentColor"/></svg>';
export const PAD_ART = '<svg viewBox="0 0 136 136" aria-hidden="true"><circle cx="68" cy="68" r="48" stroke="currentColor" stroke-opacity=".18"/><circle cx="68" cy="68" r="43" fill="#080712" fill-opacity=".8" stroke="#736870"/><path d="M68 26V11m-6 6 6-6 6 6M110 68h15m-6-6 6 6-6 6M68 110v15m-6-6 6 6 6-6M26 68H11m6-6-6 6 6 6" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const BULLET_ART = {
  orb: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#b7a4e1" fill-opacity=".2" stroke="#e8dcff" stroke-width="1"/><circle cx="12" cy="12" r="6" fill="#d3c5ee" fill-opacity=".4"/><circle cx="11" cy="10" r="3.5" fill="#fff8e8"/><path d="M6 8a7 7 0 0 1 5-3" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round"/></svg>',
  coal: '<svg viewBox="0 0 24 24"><path d="m12 1 10 7-2 12-11 3L1 13 4 4Z" fill="#53222c" stroke="#ffbe78" stroke-width="1.2"/><path d="m4 4 8 4 10 0-7 7 5 5M12 8l-3 15M1 13l8 2 6 0" fill="none" stroke="#ff915b" stroke-width="1.4"/><path d="m6 6 5 3-2 4-4-1Z" fill="#ffbf73" fill-opacity=".75"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="#1c253e" stroke="#d5e4fb" stroke-width="1.2"/><circle cx="12" cy="12" r="8" fill="none" stroke="#8498bf" stroke-width=".7"/><path d="M12 4v2m8 6h-2m-6 8v-2m-8-6h2M12 7v5l4 2" fill="none" stroke="#e8f2ff" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5" fill="#fff"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="m12 1 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#b38456" fill-opacity=".55" stroke="#fce1a0" stroke-width="1"/><path d="m12 4 1.5 6.5L20 12l-6.5 1.5L12 20l-1.5-6.5L4 12l6.5-1.5Z" fill="#fff1c8"/></svg>',
  smoke: '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#8e76be" fill-opacity=".25" stroke="#c8b5e8" stroke-width="1"/><path d="M8 20C1 12 17 3 21 12c4 9-12 13-13 5-1-7 11-9 10-3s-7 7-8 3" fill="none" stroke="#ddd1f9" stroke-width="1.5"/><circle cx="14" cy="14" r="2" fill="#f0e4ff"/></svg>',
};

export function buildSteamWorld(width, height) {
  const canvas = el("canvas.dodge-world", { "aria-hidden": "true", dataset: { test: "steam-world" } });
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  const mist = ["left", "right"].map((key) => el(`i.dodge-mist.${key}`, {
    style: { "--mist": `url("${smokeUrl(key)}")` }, "aria-hidden": "true",
  }));
  const painting = el("div.dodge-world-art", { style: { backgroundImage: `url("${makingUrl("steam_mind_world.png")}")` }, dataset: { test: "steam-world-art" } });
  const root = el("div.dodge-world-layers", { "aria-hidden": "true" }, [painting, canvas, ...mist]);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  // 専用の固定シード。背景の粒で、弾や気候のMath.randomの順序を変えない。
  let seed = 314159;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  const motes = Array.from({ length: 52 }, () => ({ x: random() * width, y: random() * height, r: .5 + random() * 1.3, p: random() * 6.28 }));
  let lastDraw = -Infinity, burst = null;
  const draw = (time, hx, hy, bullets = [], warning = null, level = "steady") => {
    if (!ctx || time - lastDraw < .032) return;
    lastDraw = time;
    canvas.dataset.frame = time.toFixed(2);
    const t = reduced ? 0 : time, cx = width * .5, cy = height * .55;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width * .3, height);
    bg.addColorStop(0, "#17112847"); bg.addColorStop(.6, "#16192b30"); bg.addColorStop(1, "#0e0c1c44");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    const halo = ctx.createRadialGradient(cx, cy, 6, cx, cy, width * .48);
    halo.addColorStop(0, "#9d8bba26"); halo.addColorStop(.38, "#77668816"); halo.addColorStop(1, "#16122400");
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
    // 奥へ溶ける、細い金の円。判定を持つ弾よりずっと暗く描く。
    for (let i = 0; i < 4; i++) {
      const r = 65 + i * 32 + Math.sin(t * .7 + i) * 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.6, r * .6, -.18 + i * .08, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(205,185,143,${.08 - i * .012})`; ctx.lineWidth = .8; ctx.stroke();
    }
    const horizon = ctx.createLinearGradient(0, 0, width, 0);
    horizon.addColorStop(0, "#d6c49b00"); horizon.addColorStop(.5, "#cbb79828"); horizon.addColorStop(1, "#d6c49b00");
    ctx.fillStyle = horizon; ctx.fillRect(0, height * .75, width, .7);
    for (const m of motes) {
      const y = (m.y - t * (2 + m.r) % height + height) % height;
      ctx.globalAlpha = .18 + .17 * Math.sin(t * .65 + m.p);
      ctx.fillStyle = "#dcd0ae"; ctx.beginPath(); ctx.arc(m.x + Math.sin(t * .2 + m.p) * 7, y, m.r, 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 弾の芯と当たり判定はDOM。軌跡だけを奥のCanvasへ描く。
    for (const b of bullets) {
      if (b.word) continue;
      const x = b.x + b.w / 2, y = b.y + b.h / 2, speed = Math.hypot(b.vx, b.vy);
      const dx = b.vx / speed * 28, dy = b.vy / speed * 28;
      const trail = ctx.createLinearGradient(x - dx, y - dy, x, y);
      trail.addColorStop(0, "#dcd4b600"); trail.addColorStop(1, "#e5d4ad70");
      ctx.strokeStyle = trail; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x, y); ctx.stroke();
    }
    // 横なぎの予告は、入口と通れる隙間の両方を見せる。
    if (warning) {
      const y = (warning.gap - 1) * height / 9, h = height / 3;
      ctx.fillStyle = "#9edddc0b"; ctx.fillRect(0, y, width, h);
      ctx.strokeStyle = "#b5e9de55"; ctx.lineWidth = 1; ctx.setLineDash([3, 7]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.moveTo(0, y + h); ctx.lineTo(width, y + h); ctx.stroke(); ctx.setLineDash([]);
    }
    const breath = 18 + Math.sin(t * 1.35) * 4;
    ctx.strokeStyle = level === "shaken" ? "#e890a244" : "#b1dacc30";
    ctx.beginPath(); ctx.arc(hx, hy, breath, 0, Math.PI * 2); ctx.stroke();
    if (burst) {
      const p = clamp((time - burst.time) / .85, 0, 1);
      for (const particle of burst.particles) {
        ctx.globalAlpha = (1 - p) * .85;
        ctx.fillStyle = "#e4ffe9";
        const spread = reduced ? 0 : p * 35;
        ctx.beginPath(); ctx.arc(particle.x + Math.cos(particle.angle) * spread, particle.y + Math.sin(particle.angle) * spread, (1 - p) * 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (p === 1) { burst.echoes.forEach(n => n.remove()); burst = null; }
    }
  };
  draw(0, width / 2, height / 2);
  return { root, draw, dissolve(time, cleared) {
    const echoes = cleared.filter(b => b.word).map(b => el("span.dodge-thought-echo", {
      text: b.node.textContent, style: { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` },
    }));
    root.append(...echoes);
    burst = { time, echoes, particles: cleared.flatMap((b, i) => Array.from({ length: 5 }, (_, j) => ({
      x: b.x + b.w / 2, y: b.y + b.h / 2, angle: (i * 1.7 + j) * 2.4,
    }))) };
    lastDraw = -Infinity;
  } };
}
