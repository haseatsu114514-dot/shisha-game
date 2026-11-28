// 場面のモーショングラフィックスの器（#fx に画面いっぱいの層を置き、終わったら片付ける）。
// 縦画面を縦持ちで使っている間は、縦の舞台（core/motion-frame.js・VPO02）へ置く。portrait: true の演出は縦の構図で組み
// （frameOf(node) で舞台の大きさを読む）、それ以外は横の 1280×720 のまま縦の舞台の真ん中に収める。
import { el, nextFrame } from "../core/util.js";
import { holdKeys } from "../core/transition-kit.js";
import { holdCover } from "../core/transitions.js";
import { mountMotion } from "../core/motion-frame.js";

/** cover: 画面を覆っている間の背景切り替えを、別の幕なしで即時にする（ui.setBg）。portrait: 縦の舞台で縦の構図を組める演出か */
export async function stagePlay(name, run, { cover = false, portrait = false } = {}) {
  const node = el(`div.mo.mo-${name}`, { "aria-hidden": "true", dataset: { motion: name } });
  const release = cover ? holdCover() : holdKeys();
  const mounted = mountMotion(node, { portrait });
  try {
    await nextFrame();
    await run(node);
  } finally {
    // ドットなどのループとfill付きの動きもここで止め、次の場面へ持ち越さない。
    node.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    mounted.remove();
    release();
  }
}
export const backdrop = (color) => el("div.mo-back", { style: { backgroundColor: color } });
