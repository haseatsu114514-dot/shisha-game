// 工程の行動素材だけを管理する。判定・温度・時計・入力はここへ持ち込まない。
import { el } from "../core/util.js";
import { makingUrl } from "../core/data.js";
import { imageReady } from "../core/ui.js";

export const WORKER_SCENES = Object.freeze({
  mix: { file: "hajime_craft_mix.png", description: "タッパーの香りを前に、はじめが考えている" },
  pack: { file: "hajime_craft_pack.png", description: "はじめの手がハガルに葉をほぐして詰めている" },
  holes: { file: "hajime_craft_holes.png", description: "掌でハガルを支え、張ったアルミに針で小穴を開けている" },
  heat: { file: "hajime_craft_heat.png", description: "トングを持ったはじめが炭の焼け具合を待っている" },
  pull: { file: "hajime_craft_pull_rest.png", description: "はじめがホースの硬いハンドルと吸い口を持ち、煙を確かめている" },
  inhale: { file: "hajime_craft_pull.png", description: "はじめがハンドル先端の吸い口から吸っている" },
});

export function workerSceneKey(step, draw) {
  if (["pull", "care", "serve"].includes(step)) return draw ? "inhale" : "pull";
  return WORKER_SCENES[step] ? step : null;
}

// 画面へ出す Image 自体も decode する。先読みの別 Image が終わっただけで
// ミニゲームを始めない。失敗・15秒超過ではその一台の間は既存絵へ戻す。
export async function readyWorkerImage(img, url) {
  if (!url || !await imageReady(url, 15000, { keep: true })) return false;
  if (img.getAttribute("src") !== url) img.src = url;
  let timer;
  let finishLoad;
  try {
    const decoded = typeof img.decode === "function"
      ? Promise.resolve().then(() => img.decode()).then(() => true, () => false)
      : new Promise(resolve => {
        finishLoad = () => resolve(img.complete && img.naturalWidth > 0);
        img.addEventListener("load", finishLoad);
        img.addEventListener("error", finishLoad);
        if (img.complete) finishLoad();
      });
    return await Promise.race([
      decoded,
      new Promise(resolve => { timer = setTimeout(() => resolve(false), 15000); }),
    ]);
  } finally {
    clearTimeout(timer);
    if (finishLoad) {
      img.removeEventListener("load", finishLoad);
      img.removeEventListener("error", finishLoad);
    }
  }
}

export function buildWorkerActions() {
  const entries = Object.entries(WORKER_SCENES).map(([key, scene]) => ({
    key, scene, loaded: false,
    img: el("img.worker-action", { alt: "", hidden: true, draggable: false, dataset: { scene: key } }),
  }));
  const root = el("div.worker-actions", { "aria-hidden": "true" }, entries.map(e => e.img));
  const ready = Promise.all(entries.map(async entry => {
    entry.loaded = await readyWorkerImage(entry.img, makingUrl(entry.scene.file));
  }));
  return { root, ready, show(key) {
    const current = entries.find(e => e.key === key && e.loaded);
    entries.forEach(e => { e.img.hidden = e !== current; });
    return current?.scene || null;
  } };
}
