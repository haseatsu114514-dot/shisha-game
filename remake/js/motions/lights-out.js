// A2 第2章 終幕「消灯」（#2688・#2735）。閉店後のMELTY PUFFで、店の照明が上から一本ずつ落ちて画面が暗くなり、
// あげはの座る位置にだけ暖色の小さな灯りが残ってから、独白へ（暗さはほどけて店の絵に戻る）。約1.9秒。
// 回想（sepia／flashback）とは別の「今・ここ」の暗さ。紫＋琥珀。動きを減らす設定では暗くなって戻るフェードだけ。
import { sleep } from "../core/util.js";
import { W, H, svg, stageSvg, move, COLOR } from "../core/transition-kit.js";
import { MG_EASE as E } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

const BANDS = 4;
const DARK = 0.8; // 落ちた帯の暗さ（店の絵がうっすら残る）
const AMBER = "#ffb35c";
const LAMP = { x: W / 2, y: H * 0.64 }; // ソファの位置（立ち絵の足もと寄り）

export async function play({ pace = 1, still = false } = {}) {
  await stagePlay("lights-out", async (node) => {
    const t = (ms) => Math.round(ms * pace);
    const dark = svg("rect", { x: 0, y: 0, width: W, height: H, fill: COLOR.ink, opacity: 0 });
    const defs = svg("defs", {}, [
      svg("radialGradient", { id: "mo-lamp-glow" }, [
        svg("stop", { offset: "0", "stop-color": COLOR.warm, "stop-opacity": 0.95 }),
        svg("stop", { offset: "0.35", "stop-color": AMBER, "stop-opacity": 0.45 }),
        svg("stop", { offset: "1", "stop-color": AMBER, "stop-opacity": 0 }),
      ]),
    ]);
    const lamp = svg("ellipse", { cx: LAMP.x, cy: LAMP.y, rx: 230, ry: 150, fill: "url(#mo-lamp-glow)", opacity: 0, class: "tr-scale" });
    if (still) {
      node.append(stageSvg([defs, dark, lamp]));
      move(lamp, [{ opacity: 0 }, { opacity: 0.8, offset: 0.4 }, { opacity: 0 }], 900, { easing: "linear" });
      await move(dark, [{ opacity: 0 }, { opacity: DARK, offset: 0.4 }, { opacity: 0 }], 900, { easing: "linear" });
      return;
    }
    // 上から順に落ちる照明の帯。帯の上端に照明の細い光の線があり、消える直前に一度だけ瞬く
    const h = H / BANDS;
    const bands = Array.from({ length: BANDS }, (_, i) => {
      const shade = svg("rect", { x: 0, y: i * h, width: W, height: h + 1, fill: COLOR.ink, opacity: 0 });
      const tube = svg("rect", { x: W * 0.08, y: i * h + 10, width: W * 0.84, height: 4, rx: 2, fill: COLOR.warm, opacity: 0 });
      return { shade, tube };
    });
    node.append(stageSvg([defs, ...bands.flatMap((b) => [b.shade, b.tube]), lamp]));
    for (const { shade, tube } of bands) {
      move(tube, [{ opacity: 0.9 }, { opacity: 0.25, offset: 0.25 }, { opacity: 0.8, offset: 0.45 }, { opacity: 0 }], t(220), { easing: "linear" });
      move(shade, [{ opacity: 0 }, { opacity: DARK }], t(200), { easing: E.out, delay: t(60) });
      await sleep(t(180));
    }
    await sleep(t(120));
    // 暗くなった店に、ソファの小さな灯りだけが残る
    await move(lamp, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "scale(1)" }], t(420), { easing: E.out });
    await sleep(t(320));
    // 暗さをほどいて、独白へ
    bands.forEach(({ shade }) => move(shade, [{ opacity: DARK }, { opacity: 0 }], t(520), { easing: "ease-in-out" }));
    await move(lamp, [{ opacity: 1 }, { opacity: 0 }], t(560), { easing: "ease-in-out" });
  });
}
