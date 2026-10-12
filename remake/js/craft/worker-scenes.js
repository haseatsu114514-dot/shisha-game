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
async function readyImage(img, url) {
  if (!url || !await imageReady(url, 15000, { keep: true })) return false;
  img.src = url;
  if (!img.decode) return true;
  let timer;
  try {
    return await Promise.race([
      img.decode().then(() => true, () => false),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), 15000); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function buildWorkerActions() {
  const entries = Object.entries(WORKER_SCENES).map(([key, scene]) => ({
    key, scene, loaded: false,
    img: el("img.worker-action", { alt: "", hidden: true, draggable: false, dataset: { scene: key } }),
  }));
  const root = el("div.worker-actions", { "aria-hidden": "true" }, entries.map(e => e.img));
  const ready = Promise.all(entries.map(async entry => {
    entry.loaded = await readyImage(entry.img, makingUrl(entry.scene.file));
  }));
  return { root, ready, show(key) {
    const current = entries.find(e => e.key === key && e.loaded);
    entries.forEach(e => { e.img.hidden = e !== current; });
    return current?.scene || null;
  } };
}
