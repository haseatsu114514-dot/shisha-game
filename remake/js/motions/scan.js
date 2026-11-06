// A6「走査」（#2688・#2735）。横線のノイズとずれが0.5秒走り、見出しだけが置き換わる。正体不明・記録・データの合図。
// 第1章 優勝の夜の LIME「？？？」は見出し（header）だけ、第5章 SHISHA-9000 の名乗りは画面全体（play）。第1章で蒔き、第5章で回収する。
// 色は淡いラベンダーと紫（LIME の UI 色・緑は使わない）。動きを減らす設定では header は出さず、play は名前の薄いフェードだけ。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move, COLOR } from "../core/transition-kit.js";
import { MG_EASE as E, MONO } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

const GLYPHS = "01#%&*+=<>/▮▯░▒";
const SCAN_MS = 500;

/** text を、乱れた記号から左の字ほど先に確定させて ms で表示し切る */
function scramble(node, text, ms) {
  const chars = [...text];
  const t0 = performance.now();
  return new Promise((resolve) => {
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const fixed = Math.floor(p * chars.length);
      node.textContent = chars.map((c, i) => (i < fixed || c === " " ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
      if (p < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/** 横に走るノイズの線（y はランダム・太さもまちまち） */
function noiseLines(n, w, h, color) {
  return Array.from({ length: n }, () => {
    const y = Math.random() * h, th = 1 + Math.random() * 5;
    return svg("rect", { x: -40, y: y.toFixed(1), width: w + 80, height: th.toFixed(1), fill: color, opacity: 0 });
  });
}

/** 画面全体: 走査の線が流れ、中央に名前が乱れてから確定する */
export async function play({ label = "", pace = 1, still = false } = {}) {
  await stagePlay("scan", async (node) => {
    const t = (ms) => Math.round(ms * pace);
    const veil = svg("rect", { x: 0, y: 0, width: W, height: H, fill: COLOR.ink, opacity: 0 });
    const sweep = svg("rect", { x: 0, y: -24, width: W, height: 24, fill: MONO.light, opacity: 0 });
    const lines = noiseLines(18, W, H, MONO.light);
    const name = el("div", { text: still ? label : "", style: {
      position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap",
      fontSize: "88px", fontWeight: "900", letterSpacing: "0.08em", color: MONO.white, fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      textShadow: `4px 0 0 ${COLOR.purple}, -4px 0 0 ${COLOR.pink}`, opacity: 0,
    } });
    node.append(stageSvg([veil, ...lines, sweep]), name);
    if (still) {
      move(veil, [{ opacity: 0 }, { opacity: 0.55, offset: 0.3 }, { opacity: 0 }], 900, { easing: "linear" });
      await move(name, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], 900, { easing: "linear" });
      return;
    }
    // 1. ノイズが走り、名前が乱れて現れる（0.5秒）
    move(veil, [{ opacity: 0 }, { opacity: 0.6 }], t(140), { easing: "linear" });
    move(sweep, [{ opacity: 0.5, transform: "translateY(0)" }, { opacity: 0.2, transform: `translateY(${H + 48}px)` }], t(SCAN_MS), { easing: "linear" });
    lines.forEach((line) => {
      const dx = (Math.random() - 0.5) * 160;
      move(line, [{ opacity: 0, transform: "translateX(0)" }, { opacity: 0.55, transform: `translateX(${dx}px)`, offset: 0.3 }, { opacity: 0.25, transform: `translateX(${-dx / 2}px)`, offset: 0.7 }, { opacity: 0, transform: "translateX(0)" }], t(SCAN_MS), { easing: "steps(6)", delay: Math.random() * t(120) });
    });
    SE.whoosh();
    name.style.opacity = "1";
    move(name, [
      { transform: "translate(calc(-50% + 18px),-50%) skewX(-12deg)" }, { transform: "translate(calc(-50% - 12px),-50%) skewX(8deg)", offset: 0.35 },
      { transform: "translate(calc(-50% + 6px),-50%) skewX(-3deg)", offset: 0.7 }, { transform: "translate(-50%,-50%)" },
    ], t(SCAN_MS), { easing: "steps(5)" });
    await scramble(name, label, t(SCAN_MS));
    // 2. 確定した名前を少しだけ見せて、消える
    await sleep(t(560));
    move(veil, [{ opacity: 0.6 }, { opacity: 0 }], t(260), { easing: "linear" });
    await move(name, [{ opacity: 1, transform: "translate(-50%,-50%) scaleY(1)" }, { opacity: 0, transform: "translate(-50%,-50%) scaleY(0.05)" }], t(260), { easing: E.in });
  });
}

/** LIME の見出しだけ: 名前が乱れた記号に置き換わってから確定する。本物の名前の文字は書き換えない（見た目を重ねるだけ） */
export async function header(header, { pace = 1 } = {}) {
  const name = header.querySelector(".lime-name");
  if (!name || !name.isConnected) return;
  const ms = Math.round(SCAN_MS * pace);
  const box = header.getBoundingClientRect(), r = name.getBoundingClientRect();
  if (!box.width || !r.width) return;
  const k = box.width / (header.offsetWidth || box.width);
  if (getComputedStyle(header).position === "static") header.style.position = "relative";
  const cs = getComputedStyle(name);
  const ghost = el("span", { "aria-hidden": "true", style: {
    position: "absolute", left: `${(r.left - box.left) / k}px`, top: `${(r.top - box.top) / k}px`, whiteSpace: "nowrap", pointerEvents: "none",
    font: cs.font, color: cs.color, textShadow: `2px 0 0 ${COLOR.purple}, -2px 0 0 ${COLOR.lav}`,
  } });
  const art = svg("svg", { viewBox: `0 0 100 ${Math.max(10, box.height / k)}`, preserveAspectRatio: "none", "aria-hidden": "true",
    style: "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden" });
  const lines = noiseLines(7, 100, Math.max(10, box.height / k), MONO.light);
  art.append(...lines);
  header.append(art, ghost);
  name.style.opacity = "0";
  lines.forEach((line) => move(line, [{ opacity: 0 }, { opacity: 0.7, offset: 0.3 }, { opacity: 0.3, offset: 0.7 }, { opacity: 0 }], ms, { easing: "steps(5)", delay: Math.random() * ms * 0.3 }));
  move(ghost, [{ transform: "translateX(6px)" }, { transform: "translateX(-4px)", offset: 0.4 }, { transform: "translateX(2px)", offset: 0.75 }, { transform: "translateX(0)" }], ms, { easing: "steps(5)" });
  try {
    await scramble(ghost, name.textContent || "", ms);
  } finally {
    name.style.opacity = "";
    art.remove(); ghost.remove();
  }
}
