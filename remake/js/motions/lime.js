// 実際の連絡先交換を読んだ直後だけ。氏名・アイコンは本編と同じ呼び名を使う。
import { el, sleep } from "../core/util.js";
import { state } from "../core/state.js";
import { displayName, faceIconUrl } from "../core/data.js";
import { imageReady } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { move, svg, stageSvg } from "../core/transition-kit.js";
import { stagePlay, backdrop } from "./stage.js";

export async function exchange(charId, context = null, { still = false } = {}) {
  const owner = state;
  const name = displayName(charId, state, { context });
  const face = faceIconUrl(charId, state, { context });
  const ready = face && await imageReady(face, 3000);
  if (state !== owner) return;
  await stagePlay("lime", async (node) => {
    // stagePlayも最初のフレームを待つため、画面を組む直前にLOADを再確認する。
    if (state !== owner) return;
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
    // 採用済み1280×720の構図を保ち、DSの可変stageでも全体を収める。
    const scene = el("div.mo-lime-scene", { style: {
      position: "absolute", left: "50%", top: "50%", width: "1280px", height: "720px",
      transformOrigin: "center",
    } }, [art, cards, title]);
    const fit = () => {
      const scale = Math.min(node.clientWidth / 1280, node.clientHeight / 720);
      scene.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    node.append(backdrop("#171225ee"), scene);
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(node);
    try {
      if (still) {
        // 動きを減らす設定: 完成した画面をそのまま見せて消す。
        SE.phone();
        await sleep(1500);
        return;
      }
      await Promise.all([
        move(own, [{ transform: "translateX(-180px) rotate(-8deg)", opacity: 0 }, { transform: "none", opacity: 1 }], 620),
        move(other, [{ transform: "translateX(180px) rotate(8deg)", opacity: 0 }, { transform: "none", opacity: 1 }], 620),
      ]);
      SE.phone();
      await move(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 500);
      await move(title, [{ transform: "translateY(12px)", opacity: 0 }, { transform: "none", opacity: 1 }], 360);
      await sleep(1100);
      await move(node, [{ opacity: 1 }, { opacity: 0 }], 380);
    } finally {
      resize.disconnect();
    }
  });
}
