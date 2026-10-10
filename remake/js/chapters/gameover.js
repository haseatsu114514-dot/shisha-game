// 大会の GAME OVER 画面（TH18・TH45）。画像は使わず、ここで描く。
// 後ろの場面は色が抜けて暗く沈み、右には影絵になったシーシャ台から煙が昇る。斜めの帯に大きな「GAME OVER」、
// 左下に理由の印（焦げた=炎、冷え切った=雪の結晶、フレーバー=崩れた葉、順位=その順位）と「再挑戦しますか？」。
// 煙は理由ごとに変える: 焦げた=黒煙と火の粉、冷え切った=細い煙が途切れて止まる、フレーバー=枯れ葉のかけらが落ちる、順位=静かな煙。
import { el, clamp } from "../core/util.js";
import { buildHookahRig } from "../craft/worker.js";

export const GAME_OVER_TEXT = {
  burnt: { title: "シーシャが焦げてしまった", sub: "焦げた一台は、審査に出せない。" },
  cold: { title: "シーシャが冷え切ってしまった", sub: "冷めた一台は、もう審査に出せない。" },
  leaf: { title: "フレーバーがダメになってしまった", sub: "吸いすぎて、葉の香りが抜け切った。" },
  rank: { title: "", sub: "優勝だけが、次への切符だった。" },
};

const ICONS = {
  burnt: `<svg viewBox="0 0 32 32"><path d="M16.4 2c1.2 5.2 7.6 8.2 7.6 15.2A8 8 0 0 1 8 17.8c0-3.4 1.6-5.8 3.8-7.6-.2 3.2 1.2 5.2 3.2 5.6C14 12 14.6 6.6 16.4 2Z" fill="currentColor"/></svg>`,
  cold: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3v26M4.7 9.5l22.6 13M4.7 22.5l22.6-13M12.6 5.2 16 8.4l3.4-3.2M12.6 26.8 16 23.6l3.4 3.2M5 14.2l4.4 1.6L8.6 20M27 17.8l-4.4-1.6.8-4.2"/></svg>`,
  leaf: `<svg viewBox="0 0 32 32"><path d="M4 28C3 15 12 4 28 3c1 14-8 25-24 25Z" fill="currentColor" opacity=".9"/><path d="M5 27 26 6" stroke="#1a0f08" stroke-width="1.6"/><circle cx="17" cy="13" r="2.6" fill="#1a0f08"/><circle cx="21" cy="19" r="2.2" fill="#1a0f08"/><circle cx="25" cy="9" r="3" fill="#1a0f08"/><path d="M6 31l2-1.5 1 2zM12 31l2-2 1 2zM19 31.5l1-2 2 1z" fill="currentColor"/></svg>`,
};

let seed = 41;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** 理由ごとの煙の出方 */
const SMOKE = {
  burnt: { rate: 7, color: [104, 84, 72], alpha: .42, size: [40, 120], rise: 70, embers: true },
  cold: { rate: 3, color: [200, 204, 210], alpha: .32, size: [14, 46], rise: 46, fade: 6 },
  leaf: { rate: 3.5, color: [190, 182, 168], alpha: .3, size: [22, 70], rise: 52, crumbs: true },
  rank: { rate: 2.6, color: [210, 206, 200], alpha: .26, size: [20, 66], rise: 48 },
};

export function buildGameOver({ reason = "rank", rank = 0, onRetry, onTitle }) {
  const text = GAME_OVER_TEXT[reason] || GAME_OVER_TEXT.rank;
  const title = reason === "rank" ? `結果は${rank}位` : text.title;
  const canvas = el("canvas.go-smoke", { width: 1280, height: 720, "aria-hidden": "true" });
  const rig = buildHookahRig("go-rig");
  const letters = [..."GAME OVER"].map((ch, i) => el("span", { text: ch, style: { "--i": String(i) } }));
  const emblem = reason === "rank"
    ? el("span.go-emblem.rank", { "aria-hidden": "true" }, [el("b", { text: String(rank || "-") }), el("small", { text: "位" })])
    : el(`span.go-emblem.${reason}`, { "aria-hidden": "true", html: ICONS[reason] || "" });
  const root = el("div.end-screen.gameover", { dataset: { test: "game-over", reason } }, [
    el("div.go-veil"),
    canvas,
    el("div.go-hookah", [rig]),
    el("div.go-band", [el("div.end-title.go-title", { "aria-label": "GAME OVER" }, letters)]),
    el("div.go-info", [
      el("div.go-reason", [emblem, el("div", [el("p.go-reason-title", { text: title }), el("p.end-sub.go-reason-sub", { text: text.sub })])]),
      el("p.end-question", { text: "再挑戦しますか？" }),
      el("p.go-note", { text: "大会の頭（大会直前のデータ）から、もう一度挑戦できる。" }),
      el("div.end-actions", [
        el("button.btn.primary", { text: "再挑戦する", dataset: { test: "retry" }, onclick: onRetry }),
        el("button.btn", { text: "タイトルへ戻る", dataset: { test: "game-over-title" }, onclick: onTitle }),
      ]),
    ]),
  ]);
  requestAnimationFrame(() => runSmoke(root, canvas, rig, reason));
  return root;
}

/** シーシャ台のボウルから昇る煙。画面が片付けられたら止まる。 */
function runSmoke(root, canvas, rig, reason) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cfg = SMOKE[reason] || SMOKE.rank;
  const origin = () => {
    const stage = root.getBoundingClientRect(), bowl = rig.querySelector(".worker-bowl")?.getBoundingClientRect();
    if (!stage.width || !bowl?.width) return { x: 960, y: 330 };
    const k = 1280 / stage.width;
    return { x: (bowl.left + bowl.width / 2 - stage.left) * k, y: (bowl.top + bowl.height * .2 - stage.top) * k };
  };
  let from = origin();
  const puffs = [], bits = [];
  const started = performance.now();
  let last = started, carry = 0;
  const frame = (now) => {
    if (!canvas.isConnected) return;
    const dt = clamp((now - last) / 1000, 0, .05), t = Math.max(0, (now - started) / 1000);
    last = now;
    if (t < 1.2) from = origin();
    // 冷え切ったときは、煙がだんだん細くなって止まる。
    const rate = cfg.fade ? cfg.rate * clamp(1 - t / cfg.fade, 0, 1) : cfg.rate;
    carry += rate * dt;
    while (carry >= 1) {
      carry -= 1;
      puffs.push({ x: from.x + (rnd() - .5) * 10, y: from.y, r: cfg.size[0] * (.6 + rnd() * .5), grow: cfg.size[1], life: 0, max: 5 + rnd() * 3, sway: rnd() * 6.28, drift: (rnd() - .4) * 18 });
      if (cfg.embers && rnd() < .9) bits.push({ kind: "ember", x: from.x + (rnd() - .5) * 30, y: from.y, vx: (rnd() - .5) * 40, vy: -60 - rnd() * 80, life: 0, max: 1.6 + rnd() * 1.6 });
      if (cfg.crumbs && rnd() < .5) bits.push({ kind: "crumb", x: from.x + (rnd() - .5) * 24, y: from.y + 6, vx: (rnd() - .5) * 50, vy: -20 - rnd() * 30, life: 0, max: 2.6, spin: rnd() * 6.28 });
    }
    ctx.clearRect(0, 0, 1280, 720);
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life += dt;
      if (p.life > p.max) { puffs.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.y -= cfg.rise * dt * (1 - k * .4);
      p.x += (Math.sin(p.sway + p.life * 1.3) * 10 + p.drift) * dt;
      const r = Math.max(1, p.r + p.grow * k);
      const a = cfg.alpha * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (reduced ? .7 : 1);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const [cr, cg, cb] = cfg.color;
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life += dt;
      if (b.life > b.max) { bits.splice(i, 1); continue; }
      const k = b.life / b.max;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.kind === "ember") { b.vx += (rnd() - .5) * 30 * dt; b.vy *= .995; ctx.fillStyle = `rgba(255,${150 + 80 * (1 - k)},60,${1 - k})`; ctx.fillRect(b.x, b.y, 3, 3); }
      else { b.vy += 60 * dt; b.spin += dt * 3; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin); ctx.fillStyle = `rgba(110,72,36,${1 - k})`; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
    }
    if (!reduced || t < 4) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
