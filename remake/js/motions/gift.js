// 締めくくりの贈り物（bonds.playFinale・専用ハガルを受け取る前）。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { state } from "../core/state.js";
import { DB, displayName, makingUrl } from "../core/data.js";
import { W, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring, confetti, twinkle, kinetic, playKinetic } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

// ---------------------------------------------------------------- a: 贈り物: 箱が落ちて弾み、リボンがほどけ、紙吹雪の中からハガル

const GIFT = { bg: "#4e1420", deep: "#270a10", main: "#e2403c", mid: "#ffd6a5", light: "#ffd166", white: "#fffaf0" };

/** 場面ごとの色では、リボンを贈り主の色にする（登場カットインと同じ配色）。紫1色では null */
function pickRibbon(from) {
  return pick({ ribbon: DB.manifest?.introArt?.[from]?.color || "" }).ribbon || null;
}

/** gear: data/equipment.json の贈り物の1件（gift.from が贈り主） */
export async function a(gear) {
  const from = gear.gift?.from;
  const P = pick(GIFT);
  const ribbon = pickRibbon(from) || P.main;
  const art = makingUrl("bowl_empty_clay.png");
  await stagePlay("gift", async (node) => {
    const back = backdrop(P.bg);
    const spot = el("i.mo-spot", { style: { background: `radial-gradient(circle, ${P.mid}55, transparent 62%)` } });
    const fxArt = stageSvg();
    const rays = el("div.mo-rays", { style: { "--c": `${P.light}55` } });
    const hagar = art ? el("img.mo-gift-item", { src: art, alt: "" }) : el("b.mo-gift-item");
    const lid = el("div.mo-gift-lid", { style: { background: P.white } }, [el("i.mo-gift-band", { style: { background: ribbon } })]);
    const loops = ["l", "r"].map((s) => el(`i.mo-gift-loop.${s}`, { style: { borderColor: ribbon } }));
    const box = el("div.mo-gift-box", { style: { background: P.white } }, [el("i.mo-gift-band", { style: { background: ribbon } })]);
    const pack = el("div.mo-gift-pack", [rays, hagar, box, lid, ...loops]);
    const giver = el("small.mo-gift-from", { text: `${displayName(from, state)}から`, style: { color: P.mid } });
    const title = kinetic(gear.name, "mo-gift-title");
    title.style.color = P.white;
    const caption = el("div.mo-gift-name", [giver, title]);
    node.append(back, spot, pack, fxArt, caption);
    move(back, [{ opacity: 0 }, { opacity: 1 }], 260);
    move(spot, [{ transform: "translate(-50%,-50%) scale(0.3)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], 700, { easing: E.out });
    // 1. 伸びながら落ちて、着地でつぶれる
    await move(pack, [{ transform: "translate(-50%, -680px) scale(0.9, 1.18)" }, { transform: "translate(-50%, 0) scale(1, 1)" }], 440, { easing: E.in });
    SE.pugo();
    burst(fxArt, W / 2 - 140, 548, { n: 3, r0: 10, r1: 50, color: P.light, width: 5, turn: Math.PI * 0.8 });
    burst(fxArt, W / 2 + 140, 548, { n: 3, r0: 10, r1: 50, color: P.light, width: 5, turn: -Math.PI * 0.15 });
    await move(pack, [{ transform: "translate(-50%, 0) scale(1.16, 0.84)" }, { transform: "translate(-50%, 0) scale(0.95, 1.06)" }, { transform: "translate(-50%, 0) scale(1)" }], 340, { easing: "ease-out" });
    // 2. リボンが揺れてほどける
    await Promise.all(loops.map((l, i) => move(l, [{ transform: `rotate(${i ? 30 : -30}deg)` }, { transform: `rotate(${i ? 40 : -40}deg)` }, { transform: `rotate(${i ? 26 : -26}deg)` }, { transform: `rotate(${i ? 30 : -30}deg)` }], 300)));
    loops.forEach((l, i) => move(l, [{ transform: `rotate(${i ? 30 : -30}deg)`, opacity: 1 }, { transform: `translate(${i ? 220 : -220}px, -160px) rotate(${i ? 260 : -260}deg) scale(0.4)`, opacity: 0 }], 480, { easing: E.out }));
    pack.querySelectorAll(".mo-gift-band").forEach((b) => move(b, [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], 260, { easing: E.in, delay: 120 }));
    await sleep(320);
    // 3. ふたが跳ね、紙吹雪と光の中からハガル
    SE.puka();
    move(lid, [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 }, { transform: "translate(170px,-300px) rotate(34deg)", opacity: 0 }], 560, { easing: E.out });
    confetti(fxArt, W / 2, 380, { n: 22, colors: [ribbon, P.light, P.white, P.mid], spread: 330 });
    burst(fxArt, W / 2, 330, { n: 12, r0: 120, r1: 230, color: P.light, width: 6, delay: 60 });
    ring(fxArt, W / 2, 330, { r: 240, color: P.white, width: 8, delay: 40 });
    move(rays, [{ opacity: 0, transform: "translate(-50%,-50%) scale(0.3) rotate(0deg)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(40deg)" }], 900, { easing: E.out });
    await move(hagar, [{ transform: "translate(-50%, 40px) scale(0.3)", opacity: 0 }, { transform: "translate(-50%, -150px) scale(1)", opacity: 1 }], 600, { easing: E.back });
    [[-170, -30], [170, -60], [-120, -210], [150, -230]].forEach(([dx, dy], i) => twinkle(fxArt, W / 2 + dx, 380 + dy, { color: P.light, size: 16, delay: i * 120 }));
    move(giver, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], 300, { easing: E.out });
    await playKinetic(title, { step: 22 });
    await sleep(1100);
    // 4. 退場
    move(caption, [{ opacity: 1 }, { opacity: 0 }], 280);
    move(back, [{ opacity: 1 }, { opacity: 0 }], 420, { delay: 120 });
    move(spot, [{ opacity: 1 }, { opacity: 0 }], 360);
    await move(pack, [{ transform: "translate(-50%, 0) scale(1)", opacity: 1 }, { transform: "translate(-50%, 30px) scale(0.85)", opacity: 0 }], 420, { easing: E.in });
  });
}

// ---------------------------------------------------------------- b: （CI109 で作る別パターン。できるまでは a と同じ）

export async function b(gear) {
  return a(gear);
}
