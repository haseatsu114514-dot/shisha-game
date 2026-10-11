// 場面のモーショングラフィックスの器（#fx に画面いっぱいの層を置き、終わったら片付ける）。
import { el, nextFrame } from "../core/util.js";
import { holdKeys } from "../core/transition-kit.js";
import { holdCover } from "../core/transitions.js";

const fxHost = () => document.getElementById("fx");

/** cover: 画面を覆っている間の背景切り替えを、別の幕なしで即時にする（ui.setBg） */
export async function stagePlay(name, run, { cover = false } = {}) {
  const node = el(`div.mo.mo-${name}`, { "aria-hidden": "true", dataset: { motion: name } });
  const release = cover ? holdCover() : holdKeys();
  fxHost().append(node);
  try {
    await nextFrame();
    await run(node);
  } finally {
    // ドットなどのループとfill付きの動きもここで止め、次の場面へ持ち越さない。
    node.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    node.remove();
    release();
  }
}
export const backdrop = (color) => el("div.mo-back", { style: { backgroundColor: color } });
