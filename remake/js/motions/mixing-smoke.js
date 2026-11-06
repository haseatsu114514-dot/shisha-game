// A8 第5章 フィナーレ → スタッフロール「混ざる煙」（#2688・#2735）。出会った人のテーマ色（登場カットインの色）の細い煙が
// 下から数本立ちのぼり、途中で絡んで一本の紫になり、その煙が画面の中央で横に伸びてスタッフロールの最初の行の位置で消える。約2.5秒。
// 「混ざったままで、俺だった」。色は呼ぶ側が渡す（緑は除いてある）。動きを減らす設定では、紫の一本の薄いフェードだけ。
import { sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move, COLOR } from "../core/transition-kit.js";
import { MG_EASE as E, MONO } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

const MEET = { x: W / 2, y: 330 }; // 煙が一本になる所
const LINE_Y = H / 2; // スタッフロールの最初の行が出る高さ
const MAX = 7;

/** i 本目の煙: 下の x0 から、互いに一度ずつ交差して MEET へ */
function strand(i, n) {
  const x0 = W / 2 + (n > 1 ? (i / (n - 1) - 0.5) : 0) * 760;
  const sway = (i % 2 ? 1 : -1) * (120 + (i * 37) % 90);
  return `M ${x0.toFixed(1)} ${H + 30} C ${(x0 + sway).toFixed(1)} ${H * 0.78}, ${(MEET.x - sway * 1.2).toFixed(1)} ${H * 0.62}, ${MEET.x} ${MEET.y}`;
}

export async function play({ colors = [], pace = 1, still = false } = {}) {
  const tones = (colors.length ? colors : [COLOR.lav, COLOR.pink, COLOR.warm]).slice(0, MAX);
  await stagePlay("mixing-smoke", async (node) => {
    const t = (ms) => Math.round(ms * pace);
    const back = svg("rect", { x: 0, y: 0, width: W, height: H, fill: COLOR.ink, opacity: 0 });
    const defs = svg("defs", {}, [svg("filter", { id: "mo-mix-soft", x: "-20%", y: "-20%", width: "140%", height: "140%" }, [svg("feGaussianBlur", { stdDeviation: 3 })])]);
    const strands = tones.map((color, i) => svg("path", {
      d: strand(i, tones.length), fill: "none", stroke: color, "stroke-width": 8, "stroke-linecap": "round", opacity: 0.9,
      filter: "url(#mo-mix-soft)", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1,
    }));
    // 一本になった紫の煙: MEET から少し上って、中央の行の高さで左右へ伸びる
    const rise = svg("path", { d: `M ${MEET.x} ${MEET.y} C ${MEET.x + 40} ${MEET.y - 50}, ${MEET.x - 40} ${LINE_Y - 30}, ${MEET.x} ${LINE_Y - 60}`, fill: "none",
      stroke: COLOR.purple, "stroke-width": 12, "stroke-linecap": "round", filter: "url(#mo-mix-soft)", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 });
    const row = svg("rect", { x: W / 2 - 260, y: LINE_Y - 64, width: 520, height: 8, rx: 4, fill: MONO.light, opacity: 0, class: "tr-scale", filter: "url(#mo-mix-soft)" });
    row.style.transform = "scaleX(0)";
    node.append(stageSvg([defs, back, ...strands, rise, row]));
    if (still) {
      rise.setAttribute("stroke-dashoffset", 0);
      await move(back, [{ opacity: 0 }, { opacity: 1 }], 300, { easing: "linear" });
      await move(rise, [{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], 900, { easing: "linear" });
      return;
    }
    // 0. 場面が暗く沈む（スタッフロールの黒へ）
    await move(back, [{ opacity: 0 }, { opacity: 1 }], t(300), { easing: "linear" });
    // 1. 出会った人の色の煙が、下から少しずつずれて立ちのぼり、絡んで一点に集まる
    SE.whoosh();
    const draw = [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }];
    strands.forEach((p, i) => move(p, draw, t(900), { easing: "cubic-bezier(.3,.1,.3,1)", delay: t(i * 50) }));
    await sleep(t(900 + (strands.length - 1) * 50));
    // 2. 一本の紫になる（色の煙は根元から引いていく）
    strands.forEach((p) => move(p, [{ strokeDashoffset: 0, opacity: 0.9 }, { strokeDashoffset: -1, opacity: 0.4 }], t(520), { easing: E.in }));
    await move(rise, draw, t(460), { easing: E.out });
    // 3. その煙が横に伸びて、最初の行の位置で淡く消える
    move(rise, [{ opacity: 1 }, { opacity: 0 }], t(360), { easing: "linear" });
    await move(row, [{ transform: "scaleX(0)", opacity: 0.9 }, { transform: "scaleX(1)", opacity: 0.9, offset: 0.55 }, { transform: "scaleX(1.06)", opacity: 0 }], t(620), { easing: E.out });
  });
}
