// 蒸らし ── 雑念を躱す（CLAUDE.md: 蒸らしミニゲームは雑念弾幕。「覚悟＋締め」には戻さない）
// 選んだ蒸らし時間のあいだ、飛んでくる雑念（言葉の弾）を心(♥)で避け続ける。被弾が少ないほど良い。
import { el, sleep, clamp, rand, pick } from "../core/util.js";
import { countdown, shake } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { tier01 } from "../core/stats.js";
import { stepPanel, refreshRig, benchRig } from "./session.js";
import { autoSkill, resultCard, keys, popStamp } from "./common.js";
import { craftConditions } from "./conditions.js";

export const DODGE_WORDS = [
  "手元、見られてる……", "時間が足りないかも", "隣の煙、もう上がってる",
  "失敗したらどうしよう", "パッキーの野次", "審査員の視線", "炭、熾きてたかな",
  "詰めすぎたか？", "灰、落ちないか", "客の咳ばらい", "温度、大丈夫か",
  "香り、飛んでないか", "手が、汗ばむ", "時計の秒針", "深呼吸、わすれてた",
  "ボウル、熱いな", "煙、薄い気がする", "スミさんなら…", "隣のジャスト音",
];
// 分数 → 実際に避ける秒数
const DURATION = { 3: 7, 5: 10, 8: 13, 10: 16 };

export async function runSteamDodge(cs) {
  const tutorial = cs.mode === "tutorial";
  const min = cs.steamMin || 5;
  const rainy = craftConditions(cs).rainy;
  const panel = stepPanel("steam", `蒸らし ── ${min}分${rainy ? "（雨：熱が入りづらい）" : ""}`, "ドラッグ（または矢印キー）で心を動かして、雑念を躱す。待つのも仕事のうち");
  const W = 620, H = 380;
  const box = el("div.dodge", { style: { width: `${W}px`, height: `${H}px` }, dataset: { test: "dodge" } });
  const heart = el("div.dodge-heart", { text: "♥" });
  const timer = el("div.dodge-timer");
  const hitsEl = el("div.dodge-hits");
  box.append(heart);
  panel.append(el("div.steam", [el("div.dodge-hud", [timer, hitsEl]), box]));
  benchRig()?.bubble(true);

  const dur = DURATION[min] * (tutorial ? 0.7 : 1);
  const hitR = 11 * (1 - 0.2 * tier01("guts"));
  const spawnEvery = (tutorial ? 1.2 : 0.8) * (1 + 0.35 * tier01("insight")); // 洞察★で雑念が湧きにくい
  let hx = W / 2, hy = H / 2;
  let hits = 0;
  let inv = 0;
  const bullets = [];
  const keysDown = new Set();

  const moveTo = (x, y) => {
    hx = clamp(x, 14, W - 14);
    hy = clamp(y, 14, H - 14);
  };
  const toLocal = (e) => {
    const r = box.getBoundingClientRect();
    const k = r.width / W;
    return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
  };
  box.addEventListener("pointerdown", (e) => { box.setPointerCapture(e.pointerId); moveTo(...toLocal(e)); });
  box.addEventListener("pointermove", (e) => { if (e.buttons || e.pointerType === "mouse") moveTo(...toLocal(e)); });
  const unkey = keys({
    ArrowLeft: () => keysDown.add("l"), ArrowRight: () => keysDown.add("r"), ArrowUp: () => keysDown.add("u"), ArrowDown: () => keysDown.add("d"),
  });
  const up = (e) => keysDown.delete({ ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d" }[e.key]);
  window.addEventListener("keyup", up);

  const spawn = () => {
    const word = pick(DODGE_WORDS);
    const node = el("div.dodge-word", { text: word });
    box.append(node);
    const side = Math.floor(rand(0, 4));
    const speed = rand(120, 210) * (tutorial ? 0.7 : 1);
    let x, y, vx, vy;
    // 端から、心のいるあたりへ向けて斜めに飛ばす
    if (side === 0) { x = -160; y = rand(10, H - 30); }
    else if (side === 1) { x = W + 10; y = rand(10, H - 30); }
    else if (side === 2) { x = rand(0, W - 120); y = -30; }
    else { x = rand(0, W - 120); y = H + 10; }
    const ang = Math.atan2(hy + rand(-60, 60) - y, hx + rand(-60, 60) - x);
    vx = Math.cos(ang) * speed;
    vy = Math.sin(ang) * speed;
    bullets.push({ node, x, y, vx, vy, w: word.length * 15 + 16, h: 24 });
  };

  await countdown();
  const auto = autoSkill();
  if (auto) {
    await sleep(200);
    hits = auto === "good" ? 0 : 4;
  } else {
    await new Promise((resolve) => {
      let last = performance.now();
      const t0 = last;
      let nextSpawn = 0.3;
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = (now - t0) / 1000;
        if (keysDown.size) {
          const v = 260 * dt;
          moveTo(hx + (keysDown.has("r") ? v : 0) - (keysDown.has("l") ? v : 0), hy + (keysDown.has("d") ? v : 0) - (keysDown.has("u") ? v : 0));
        }
        heart.style.transform = `translate(${hx - 14}px, ${hy - 14}px)`;
        if (t > nextSpawn && t < dur - 0.8) { spawn(); nextSpawn = t + spawnEvery * rand(0.6, 1.2) * (1 - 0.35 * (t / dur)); }
        inv = Math.max(0, inv - dt);
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.node.style.transform = `translate(${b.x}px, ${b.y}px)`;
          const cx = clamp(hx, b.x, b.x + b.w);
          const cy = clamp(hy, b.y, b.y + b.h);
          if (!inv && (hx - cx) ** 2 + (hy - cy) ** 2 < hitR * hitR) {
            hits++;
            inv = 0.9;
            heart.classList.remove("hit");
            void heart.offsetWidth;
            heart.classList.add("hit");
            SE.hit();
            shake(box, 260);
          }
          if (b.x < -300 || b.x > W + 300 || b.y < -80 || b.y > H + 80) { b.node.remove(); bullets.splice(i, 1); }
        }
        timer.textContent = `残り ${Math.max(0, Math.ceil((dur - t) * (min / dur)))} 分`;
        hitsEl.textContent = hits ? `雑念に呑まれた ×${hits}` : "集中できている";
        if (t >= dur) return resolve();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  }
  unkey();
  window.removeEventListener("keyup", up);
  bullets.forEach((b) => b.node.remove());
  const score = clamp(100 - hits * 14, 0, 100);
  cs.steam = { min, hits, score, warmingFactor: rainy ? 0.85 : 1 };
  refreshRig();
  popStamp(panel, hits === 0 ? "無心" : hits <= 2 ? "持ちこたえた" : "雑念まみれ", hits === 0 ? "just" : hits <= 2 ? "good" : "bad", "50%", "40%");
  await sleep(400);
  await resultCard(panel, {
    title: "蒸らし 結果",
    lines: [
      rainy ? "雨の日は熱の立ち上がりが少し遅い。吸い出しで温度を確かめよう" : "",
      `${min}分蒸らした。${hits === 0 ? "最後まで一度も揺れなかった" : `雑念に${hits}回つかまった`}`,
      min >= 8 ? "じっくり待った分、甘さと余韻が開きそうだ" : min <= 3 ? "早めの立ち上げ。温度合わせは忙しくなる" : "基本の蒸らし。香りの輪郭は残りやすい",
    ],
  });
}
