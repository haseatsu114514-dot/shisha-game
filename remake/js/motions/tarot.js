// 路上占いの結果（remake_fortune_result の {"type":"motion","id":"tarot"}）。charId は占った相手（state.fortune.char）。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { state } from "../core/state.js";
import { displayName, faceIconUrl } from "../core/data.js";
import { W, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring, twinkle, kinetic, playKinetic } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

// ---------------------------------------------------------------- a: 占い: 星図の輪が描かれ、3枚の札が飛んできて、真ん中が裏返る

const TAROT = { bg: "#101a3a", deep: "#080e22", main: "#24356e", mid: "#4a5fb4", light: "#f2c14e", white: "#fff6dc" };

function tarotCard(P, i) {
  return el("div.mo-tarot-card", { style: { "--i": String(i) } }, [el("div.mo-tarot-flip", [
    el("div.mo-tarot-back", { style: { background: P.main, borderColor: P.light, "--l": P.light } }, [el("i.mo-tarot-moon"), el("b.mo-tarot-star"), el("b.mo-tarot-star.s2"), el("b.mo-tarot-star.s3")]),
  ])]);
}

export async function a(charId) {
  const P = pick(TAROT);
  await stagePlay("tarot", async (node) => {
    const back = backdrop(P.bg);
    const art = stageSvg();
    const cx = W / 2, cy = 330;
    const dial = [
      svg("circle", { cx, cy, r: 250, fill: "none", stroke: P.mid, "stroke-width": 2, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }),
      svg("circle", { cx, cy, r: 300, fill: "none", stroke: P.light, "stroke-width": 2, "stroke-dasharray": "3 12", opacity: 0.7, class: "tr-scale" }),
      svg("circle", { cx, cy, r: 205, fill: "none", stroke: P.mid, "stroke-width": 1.5, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }),
    ];
    const ticks = svg("g", {}, [...Array(12)].map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return svg("line", { x1: cx + Math.cos(a) * 258, y1: cy + Math.sin(a) * 258, x2: cx + Math.cos(a) * 280, y2: cy + Math.sin(a) * 280, stroke: P.light, "stroke-width": 3, "stroke-linecap": "round", opacity: 0 });
    }));
    art.append(...dial, ticks);
    const cards = [0, 1, 2].map((i) => tarotCard(P, i));
    const face = faceIconUrl(charId, state);
    const name = charId ? displayName(charId, state) : "その人";
    const gloss = el("i.mo-gloss");
    cards[1].firstChild.append(el("div.mo-tarot-front", { style: { background: P.white, borderColor: P.light } }, [
      el("small", { text: "THREAD OF FATE", style: { color: P.mid } }),
      el("div.mo-tarot-face", { style: { borderColor: P.light, background: P.main } }, [face ? el("img", { src: face, alt: "" }) : el("b", { text: "？" })]),
      el("b.mo-tarot-name", { text: name, style: { color: P.deep } }),
      el("small.en", { text: "縁", style: { color: P.main } }),
      gloss,
    ]));
    const title = kinetic(`${name}との縁`, "mo-tarot-title");
    title.style.color = P.white;
    node.append(back, art, ...cards, title);
    // 1. 星図の輪が描かれる
    move(back, [{ opacity: 0 }, { opacity: 1 }], 240);
    move(dial[0], [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 700, { easing: E.out });
    move(dial[2], [{ strokeDashoffset: -1 }, { strokeDashoffset: 0 }], 700, { easing: E.out, delay: 80 });
    dial[1].animate([{ transform: "rotate(0deg) scale(0.8)", opacity: 0 }, { transform: "rotate(40deg) scale(1)", opacity: 0.7 }], { duration: 2600, easing: E.out, fill: "both" });
    [...ticks.children].forEach((t, i) => move(t, [{ opacity: 0 }, { opacity: 1 }], 160, { delay: 200 + i * 30 }));
    for (let i = 0; i < 7; i++) twinkle(art, 160 + Math.random() * 960, 60 + Math.random() * 560, { color: P.light, size: 8 + Math.random() * 10, delay: 200 + i * 180, dur: 900 });
    // 2. 3枚が回りながら飛んできて扇に並ぶ
    const xs = [-230, 0, 230], rot = [-10, 0, 10];
    await Promise.all(cards.map((c, i) => move(c, [
      { transform: `translate(-50%, 520px) rotate(${rot[i] * 5}deg) scale(0.8, 1.2)` },
      { transform: `translate(calc(-50% + ${xs[i]}px), 0) rotate(${rot[i]}deg) scale(1)` }], 520, { easing: E.back, delay: 120 + i * 90 })));
    SE.tick();
    await sleep(380);
    // 3. 両端が抜けて、真ん中が持ち上がる
    move(cards[0], [{ transform: "translate(calc(-50% - 230px), 0) rotate(-10deg)", opacity: 1 }, { transform: "translate(calc(-50% - 620px), 40px) rotate(-30deg)", opacity: 0 }], 360, { easing: E.in });
    move(cards[2], [{ transform: "translate(calc(-50% + 230px), 0) rotate(10deg)", opacity: 1 }, { transform: "translate(calc(-50% + 620px), 40px) rotate(30deg)", opacity: 0 }], 360, { easing: E.in });
    await move(cards[1], [{ transform: "translate(-50%, 0) scale(1)" }, { transform: "translate(-50%, -16px) scale(1.16)" }], 300, { easing: E.out });
    // 4. くるっと裏返り、光が走る
    await move(cards[1].firstChild, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], 520, { easing: E.inOut });
    SE.just();
    ring(art, cx, cy, { r: 260, color: P.light, width: 8 });
    burst(art, cx, cy, { n: 14, r0: 230, r1: 330, color: P.light, width: 5 });
    move(gloss, [{ transform: "translateX(-140%) skewX(-20deg)" }, { transform: "translateX(240%) skewX(-20deg)" }], 520, { easing: E.inOut });
    await playKinetic(title, { delay: 120 });
    await sleep(900);
    // 5. 退場
    move(title, [{ opacity: 1 }, { opacity: 0 }], 240);
    move(art, [{ opacity: 1 }, { opacity: 0 }], 360);
    move(back, [{ opacity: 1 }, { opacity: 0 }], 420, { delay: 160 });
    await move(cards[1], [{ transform: "translate(-50%, -16px) scale(1.16) rotate(0deg)", opacity: 1 }, { transform: "translate(-50%, -40px) scale(0.6) rotate(12deg)", opacity: 0 }], 420, { easing: E.in });
  });
}

// ---------------------------------------------------------------- b: （CI109 で作る別パターン。できるまでは a と同じ）

export async function b(charId) {
  return a(charId);
}
