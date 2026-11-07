// 章の要所の一度きりのモーショングラフィックス（#2688 A3・A5・A6・A8）。紫とラベンダーの面と線、画像は使わない。顔は描かない。
// どれも見せるだけで、保存・進行・票には触れない。動きを減らす設定・テストの高速送りでは何もしない（mid() だけ行う）。
import { el, sleep, nextFrame } from "../core/util.js";
import { W, H, COLOR, EASE, svg, stageSvg, move, reducedMotion } from "../core/transition-kit.js";
import { holdCover } from "../core/transitions.js";

const fx = () => document.getElementById("fx");
const skip = () => reducedMotion() || !!(window.__remake?.vnTest?.turbo || window.__remake?.craftTest?.auto);
const layer = (cls, data) => el(`div.mo-moment.${cls}`, { "aria-hidden": "true", dataset: { moment: data } });

/** 覆う型の共通部分: 入力を止め、片付けを必ず行う */
async function covering(node, body) {
  const host = fx();
  if (!host) return body(null);
  const unhold = holdCover();
  host.append(node);
  try { return await body(node); } finally { node.remove(); unhold(); }
}

// ---------------------------------------------------------------- A3 落ち葉の波（第3章の公園の回想 → 現在）

function leafPath(scale = 1) {
  const s = scale;
  return `M 0 ${-60 * s} C ${46 * s} ${-36 * s}, ${46 * s} ${36 * s}, 0 ${60 * s} C ${-46 * s} ${36 * s}, ${-46 * s} ${-36 * s}, 0 ${-60 * s} Z`;
}

/** 色の抜けた回想の上を、葉の形の紫の面が数枚ゆっくり横へ流れて覆い、流れ去ると色のついた現在（約1.6秒）。mid() は覆っている間に背景を替える */
export async function leafWave(mid) {
  if (skip() || !fx()) { await mid?.(); return; }
  const node = layer("mo-leaves", "leaves");
  const leaves = [];
  const fills = [COLOR.deep, COLOR.purple, "#4b3690", COLOR.lav];
  for (let i = 0; i < 9; i++) {
    const g = svg("g", { transform: `translate(${-260 - (i % 3) * 120} ${60 + i * 78}) rotate(${-30 + i * 11})` }, [
      svg("path", { d: leafPath(5.4 + (i % 3) * 0.8), fill: fills[i % fills.length] }),
    ]);
    leaves.push(g);
  }
  const art = stageSvg(leaves);
  node.append(art);
  await covering(node, async () => {
    const runs = leaves.map((g, i) => move(g, [{ transform: "translateX(0) rotate(0deg)" }, { transform: `translateX(${W + 260}px) rotate(${i % 2 ? 24 : -24}deg)` }],
      780, { easing: EASE.in, delay: i * 30 }));
    await Promise.all(runs);
    const cover = el("div.mo-leaves-cover");
    node.append(cover);
    await mid?.();
    await nextFrame(); await nextFrame();
    art.remove();
    const out = stageSvg(leaves.map((g) => { g.style.transform = ""; return g; }));
    node.append(out);
    move(cover, [{ opacity: 1 }, { opacity: 0 }], 600, { easing: "ease-out", delay: 120 });
    await Promise.all(leaves.map((g, i) => move(g, [{ transform: `translateX(${W + 260}px)` }, { transform: `translateX(${2 * W + 700}px) rotate(${i % 2 ? 50 : -50}deg)` }],
      720, { easing: EASE.out, delay: i * 25 })));
  });
}

// ---------------------------------------------------------------- A5 龍の煙（第4章の前夜祭）

/** 煙のリボンがS字に二度うねって輪になり、金の縁で一瞬止まってから散る（約1.8秒）。鱗や顔は描かない */
export async function dragonSmoke() {
  if (skip() || !fx()) return;
  const node = layer("mo-dragon", "dragon");
  const d = "M 120 600 C 300 380, 480 640, 640 420 S 980 200, 1080 360 C 1180 520, 920 600, 840 470 C 780 370, 900 300, 980 340";
  const blur = svg("path", { d, fill: "none", stroke: "#f4eefc", "stroke-width": 44, "stroke-linecap": "round", "stroke-dasharray": 2600, "stroke-dashoffset": 2600, filter: "url(#mo-dragon-blur)", opacity: 0.75 });
  const core = svg("path", { d, fill: "none", stroke: "#ffffff", "stroke-width": 8, "stroke-linecap": "round", "stroke-dasharray": 2600, "stroke-dashoffset": 2600, opacity: 0.9 });
  const gold = svg("path", { d, fill: "none", stroke: "#f6dcaf", "stroke-width": 3, "stroke-linecap": "round", "stroke-dasharray": 2600, "stroke-dashoffset": 2600, opacity: 0 });
  const art = stageSvg([
    svg("defs", {}, [svg("filter", { id: "mo-dragon-blur", x: "-20%", y: "-20%", width: "140%", height: "140%" }, [svg("feGaussianBlur", { stdDeviation: 10 })])]),
    blur, core, gold,
  ]);
  node.append(el("div.mo-dragon-dim"), art);
  await covering(node, async () => {
    const draw = [{ strokeDashoffset: 2600 }, { strokeDashoffset: 0 }];
    move(blur, draw, 1000, { easing: EASE.inOut });
    await move(core, draw, 1000, { easing: EASE.inOut });
    gold.style.strokeDashoffset = "0";
    await move(gold, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], 420);
    await Promise.all([blur, core].map((p) => move(p, [{ opacity: Number(p.getAttribute("opacity")), strokeWidth: p === blur ? 44 : 8 }, { opacity: 0, strokeWidth: p === blur ? 110 : 2 }], 520, { easing: "ease-out" })));
  });
}

// ---------------------------------------------------------------- A6 走査（第1章の優勝の夜の「???」・第5章の挑戦状と9000）

/** 横線のノイズとずれが短く走り、見出し from が to に置き換わる（約0.6秒）。from を空にすると to だけが乱れて出る */
export async function scanGlitch({ from = "", to = "???" } = {}) {
  if (skip() || !fx()) return;
  const node = layer("mo-scan", "scan");
  const slices = [];
  for (let i = 0; i < 9; i++) {
    const top = (i * 11 + 3) % 92, height = 2 + (i * 7) % 8;
    const slice = el("i.mo-scan-slice", { style: { top: `${top}%`, height: `${height}%` } });
    slices.push(slice);
  }
  const bar = el("i.mo-scan-bar");
  const label = el("div.mo-scan-label", { text: from || to });
  node.append(...slices, el("div.mo-scan-lines"), bar, label);
  await covering(node, async () => {
    slices.forEach((s, i) => move(s, [{ transform: "translateX(0)" }, { transform: `translateX(${(i % 2 ? 1 : -1) * (3 + i % 4)}%)` }, { transform: "translateX(0)" }], 360, { easing: "steps(4)" }));
    move(bar, [{ top: "-10%" }, { top: "100%" }], 380, { easing: "linear" });
    move(label, [{ transform: "translate(-50%, -50%)", filter: "none" }, { transform: "translate(-51.5%, -50%)", filter: "drop-shadow(4px 0 0 #f06aae) drop-shadow(-4px 0 0 #9fd8ff)" }, { transform: "translate(-50%, -50%)", filter: "none" }], 360, { easing: "steps(4)" });
    await sleep(190);
    label.textContent = to;
    await sleep(380);
    await move(node, [{ opacity: 1 }, { opacity: 0 }], 220);
  });
}

// ---------------------------------------------------------------- A8 混ざる煙（第5章のフィナーレ → スタッフロール）

/** 出会った人の色の細い煙が下から立ちのぼり、途中で絡んで一本の紫になって上へ抜ける（約2.5秒）。暗い面のまま終わる */
export async function mixedSmoke(colors = []) {
  if (skip() || !fx()) return;
  const list = (colors.length ? colors : [COLOR.lav, COLOR.pink, "#f6dcaf", "#9fb8ff"]).slice(0, 8);
  const node = layer("mo-mixed", "finale");
  const n = list.length;
  const strands = list.map((c, i) => {
    const x0 = 220 + (840 / Math.max(1, n - 1)) * i;
    const d = `M ${x0} 760 C ${x0} 600, ${640 + (x0 - 640) * 0.5} 520, ${640 + (x0 - 640) * 0.15} 380 S 640 220, 640 -20`;
    return svg("path", { d, fill: "none", stroke: c, "stroke-width": 5, "stroke-linecap": "round", "stroke-dasharray": 1100, "stroke-dashoffset": 1100, opacity: 0.9 });
  });
  const one = svg("path", { d: "M 640 400 C 620 300, 660 200, 640 -20", fill: "none", stroke: COLOR.purple, "stroke-width": 14, "stroke-linecap": "round", "stroke-dasharray": 500, "stroke-dashoffset": 500 });
  node.append(el("div.mo-mixed-dark"), stageSvg([...strands, one]));
  await covering(node, async () => {
    await move(node.firstChild, [{ opacity: 0 }, { opacity: 1 }], 500, { easing: "ease-in" });
    await Promise.all(strands.map((p, i) => move(p, [{ strokeDashoffset: 1100 }, { strokeDashoffset: 0 }], 1300, { easing: EASE.inOut, delay: i * 70 })));
    await move(one, [{ strokeDashoffset: 500, opacity: 0 }, { strokeDashoffset: 0, opacity: 1 }], 500, { easing: EASE.out });
    strands.forEach((p) => move(p, [{ opacity: 0.9 }, { opacity: 0 }], 400));
    await move(one, [{ opacity: 1, strokeWidth: 14 }, { opacity: 0, strokeWidth: 2 }], 600, { easing: "ease-in" });
  });
}
