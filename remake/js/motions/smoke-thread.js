// A1 第1章 コールドオープン → 章題（#2688・#2735）。一年後の会場の煙が一筋に細くなって上へ抜け、章題の白いもやへつながる。
// 約0.8秒。暗転の上に線を描くだけで、背景は替えない。動きを減らす設定では白いもやの薄いフェードだけ。
import { sleep } from "../core/util.js";
import { W, H, svg, stageSvg, move, COLOR } from "../core/transition-kit.js";
import { MG_EASE as E } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

const CX = W / 2;
// 下の会場の煙から立ちのぼる一筋（ゆるいS字で上の外まで）
const THREAD = `M ${CX - 40} ${H + 40} C ${CX + 90} ${H * 0.72}, ${CX - 110} ${H * 0.45}, ${CX + 10} ${H * 0.24} S ${CX - 30} ${-10}, ${CX} -60`;

function haze() {
  return svg("ellipse", { cx: CX, cy: -40, rx: W * 0.7, ry: H * 0.42, fill: COLOR.warm, opacity: 0, filter: "url(#mo-thread-blur)" });
}

export async function play({ pace = 1, still = false } = {}) {
  await stagePlay("smoke-thread", async (node) => {
    const defs = svg("defs", {}, [
      svg("filter", { id: "mo-thread-blur", x: "-50%", y: "-50%", width: "200%", height: "200%" }, [svg("feGaussianBlur", { stdDeviation: 46 })]),
      svg("filter", { id: "mo-thread-soft", x: "-20%", y: "-5%", width: "140%", height: "110%" }, [svg("feGaussianBlur", { stdDeviation: 2.2 })]),
    ]);
    const top = haze();
    if (still) {
      node.append(stageSvg([defs, top]));
      await move(top, [{ opacity: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0 }], 600, { easing: "linear" });
      return;
    }
    const t = (ms) => Math.round(ms * pace);
    // 広い煙の残り（下）・細る一筋・抜けた先のもや（上）
    const base = svg("ellipse", { cx: CX - 40, cy: H + 30, rx: 360, ry: 120, fill: COLOR.lav, opacity: 0.32, filter: "url(#mo-thread-blur)", class: "tr-scale" });
    const glow = svg("path", { d: THREAD, fill: "none", stroke: COLOR.lav, "stroke-width": 26, "stroke-linecap": "round", opacity: 0.22, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1, filter: "url(#mo-thread-blur)" });
    const line = svg("path", { d: THREAD, fill: "none", stroke: COLOR.warm, "stroke-width": 7, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "0.42 1", "stroke-dashoffset": 0.42, filter: "url(#mo-thread-soft)" });
    node.append(stageSvg([defs, base, glow, line, top]));
    // 1. 下の煙が細って一筋になる
    move(base, [{ opacity: 0.32, transform: "scaleX(1)" }, { opacity: 0, transform: "scaleX(0.2)" }], t(460), { easing: E.out });
    // 2. 一筋が上へ抜ける（線の頭が上の外へ、尾も追って消える）
    move(glow, [{ strokeDashoffset: 1 }, { strokeDashoffset: -0.2 }], t(620), { easing: E.inOut });
    move(line, [{ strokeDashoffset: 0.42, strokeWidth: 7 }, { strokeDashoffset: -1, strokeWidth: 3 }], t(620), { easing: E.inOut });
    await sleep(t(380));
    // 3. 抜けた先で、章題の白いもやへ
    await move(top, [{ opacity: 0 }, { opacity: 0.55, offset: 0.55 }, { opacity: 0 }], t(440), { easing: "linear" });
  });
}
