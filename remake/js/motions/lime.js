// 実際の連絡先交換を読んだ直後だけ。氏名・アイコンは本編と同じ呼び名を使う。
import { el, sleep } from "../core/util.js";
import { state } from "../core/state.js";
import { displayName, faceIconUrl } from "../core/data.js";
import { imageReady } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { move, svg, stageSvg } from "../core/transition-kit.js";
import { stagePlay, backdrop } from "./stage.js";

export async function exchange(charId, context = null) {
  const name = displayName(charId, state, { context });
  const face = faceIconUrl(charId, state, { context });
  const ready = face && await imageReady(face, 3000);
  await stagePlay("lime", async (node) => {
    const card = (label, picture) => el("div.mo-lime-card", [
      picture ? el("img", { src: picture, alt: "" }) : el("span.mo-lime-avatar", { text: "始" }),
      el("b", { text: label }),
      el("span", { text: "LIME" }),
    ]);
    const own = card("はじめ"), other = card(name, ready ? face : null);
    const cards = el("div.mo-lime-cards", [own, other]);
    const line = svg("path", { d: "M480 350 C560 310 720 390 800 350", fill: "none", stroke: "#b9e6d4", "stroke-width": 5, pathLength: 1, "stroke-dasharray": 1 });
    const art = stageSvg([line]);
    const title = el("div.mo-lime-title", [el("small", { text: "LIME" }), el("strong", { text: "連絡先がつながった" })]);
    node.append(backdrop("#171225ee"), art, cards, title);
    await Promise.all([
      move(own, [{ transform: "translateX(-180px) rotate(-8deg)", opacity: 0 }, { transform: "none", opacity: 1 }], 620),
      move(other, [{ transform: "translateX(180px) rotate(8deg)", opacity: 0 }, { transform: "none", opacity: 1 }], 620),
    ]);
    SE.phone();
    await move(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 500);
    await move(title, [{ transform: "translateY(12px)", opacity: 0 }, { transform: "none", opacity: 1 }], 360);
    await sleep(1100);
    await move(node, [{ opacity: 1 }, { opacity: 0 }], 380);
  });
}
