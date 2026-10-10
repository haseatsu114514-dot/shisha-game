// サメちゃんとの夜道の出会い（kafuka.js の playKafukaEncounter）。覆っている間に mid() で SHISHARK の店先へ替える。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, ring, confetti } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

// ---------------------------------------------------------------- a: サメちゃん: 3枚の波が重なって満ち、サメが横切り、波が引いて次の場面

const SHARK = { bg: "#0b3c5d", deep: "#062437", main: "#22b8cf", mid: "#7fe3f0", light: "#e8fbff", white: "#ffffff", fish: "#0a2233" };

function sharkShape(color) {
  const tail = svg("path", { d: "M -150 0 L -230 -62 Q -214 0 -230 62 Z", fill: color });
  const body = svg("path", { d: "M 170 6 C 120 -46, 10 -62, -90 -34 C -130 -22, -150 -8, -158 0 C -150 8, -128 22, -90 30 C 10 52, 120 44, 170 6 Z", fill: color });
  const fin = svg("path", { d: "M -10 -52 L 34 -120 L 46 -46 Z", fill: color });
  const flip = svg("path", { d: "M 30 30 L 0 82 L 70 34 Z", fill: color });
  const eye = svg("circle", { cx: 128, cy: -6, r: 5, fill: "#ffffff" });
  return { g: svg("g", {}, [tail, flip, body, fin, eye]), tail };
}

/** mid(): 画面を覆っている間に次の背景（SHISHARK の店先）へ替える */
export async function a(mid) {
  const P = pick(SHARK, { fish: "#120a2a" });
  await stagePlay("shark", async (node) => {
    const wave = (amp) => {
      let d = `M -80 0 `;
      for (let x = -80; x < W + 160; x += 160) d += `q 40 ${-amp} 80 0 t 80 0 `;
      return d + `L ${W + 160} ${H + 1000} L -80 ${H + 1000} Z`;
    };
    const layers = [[P.mid, 26], [P.main, 20], [P.bg, 16]].map(([fill, amp]) => {
      const g = svg("g", {}, [svg("path", { d: wave(amp), fill })]);
      g.style.transform = `translateY(${H + 60}px)`;
      return g;
    });
    const bubbles = svg("g");
    const fx = svg("g");
    const { g: shark, tail } = sharkShape(P.fish);
    const sharkPos = svg("g", { transform: `translate(-320 ${H / 2})` }, [shark]);
    const trail = svg("g", { stroke: P.light, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.8 });
    const art = stageSvg([...layers, bubbles, trail, sharkPos, fx]);
    const caustics = el("div.mo-caustics", { style: { "--c": P.light } });
    node.append(art, caustics);
    const sway = layers.map((g, i) => g.firstChild.animate([{ transform: "translateX(0)" }, { transform: "translateX(-160px)" }], { duration: 800 + i * 260, iterations: Infinity }));
    // 1. 3枚の波が少しずつずれて満ちる
    SE.bubbling();
    await Promise.all(layers.map((g, i) => move(g, [{ transform: `translateY(${H + 60}px)` }, { transform: "translateY(-40px)" }], 560, { easing: E.in, delay: i * 90 })));
    move(caustics, [{ opacity: 0 }, { opacity: 1 }], 300);
    if (mid) await mid();
    for (let i = 0; i < 24; i++) {
      const r = 4 + Math.random() * 13;
      const b = svg("circle", { cx: Math.random() * W, cy: H + 20, r, fill: "none", stroke: P.light, "stroke-width": 2.5, opacity: 0.85 });
      bubbles.append(b);
      b.animate([{ transform: "translate(0,0)" }, { transform: `translate(${(Math.random() - 0.5) * 60}px, ${-(H * (0.7 + Math.random() * 0.6))}px)` }], { duration: 1200 + Math.random() * 600, delay: Math.random() * 500, easing: "ease-out", fill: "both" });
    }
    // 2. サメが尾を振って横切る（後ろに流れる線）
    tail.style.transformBox = "fill-box";
    tail.style.transformOrigin = "right center";
    const wag = tail.animate([{ transform: "rotate(-15deg)" }, { transform: "rotate(15deg)" }], { duration: 200, iterations: Infinity, direction: "alternate" });
    const swim = move(sharkPos, [{ transform: `translate(-320px, ${H / 2 + 24}px)` }, { transform: `translate(${W / 2}px, ${H / 2 - 12}px)`, offset: 0.55 }, { transform: `translate(${W + 340}px, ${H / 2 + 10}px)` }], 1150, { easing: "cubic-bezier(.3,.1,.6,1)" });
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const x = 200 + i * 260, y = H / 2 - 30 + (i % 2) * 60;
        const line = svg("line", { x1: x, y1: y, x2: x - 180, y2: y, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 });
        trail.append(line);
        move(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0, offset: 0.4 }, { strokeDashoffset: -1 }], 420, { easing: E.out }).then(() => line.remove());
      }, 120 + i * 200);
    }
    setTimeout(() => ring(fx, W / 2 + 120, H / 2 - 10, { r: 120, color: P.light, width: 6 }), 640);
    await swim;
    wag.cancel();
    // 3. 波が手前から順に引き、しぶきが上がる
    SE.bubbling();
    move(caustics, [{ opacity: 1 }, { opacity: 0 }], 260);
    [180, 520, 860, 1120].forEach((x) => confetti(fx, x, 40, { n: 5, colors: [P.light, P.mid], spread: 140 }));
    await Promise.all([...layers].reverse().map((g, i) => move(g, [{ transform: "translateY(-40px)" }, { transform: `translateY(${H + 80}px)` }], 520, { easing: E.in, delay: i * 90 })));
    sway.forEach((a) => a.cancel());
  }, { cover: true });
}

// ---------------------------------------------------------------- b: （CI109 で作る別パターン。できるまでは a と同じ）

export async function b(mid) {
  return a(mid);
}
