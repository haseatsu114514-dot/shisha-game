// 世界大会の一瞬。会場を描き切らず、煙とトングを握る手だけを見せる。
import { el } from "../core/util.js";
import { layers, imageReady } from "../core/ui.js";
import { makingUrl } from "../core/data.js";
import { hooks } from "../vn/engine.js";
import { SE } from "../core/audio.js";

export function mountColdOpen() {
  const smoke = makingUrl("smoke_thick.png");
  const hand = makingUrl("hajime_craft_heat.png");
  const scene = el("div.cold-open.bg-img.show", { dataset: { shot: "smoke", test: "cold-open" }, "aria-hidden": "true" }, [
    el("div.co-light"),
    el("div.co-smoke-close", smoke ? [el("img", { src: smoke, alt: "", decoding: "async" }), el("img", { src: smoke, alt: "", decoding: "async" })] : []),
    el("div.co-hand-close", hand ? [el("img", { src: hand, alt: "", decoding: "async" })] : []),
    el("div.co-ember"), el("div.co-vignette"),
  ]);
  layers.bg.append(scene);
  const ready = Promise.all([smoke, hand].filter(Boolean).map(url => imageReady(url, 15000, { keep: true })));
  SE.crowd(3.2);
  const previous = hooks.onLine;
  const onLine = (id, line) => {
    previous?.(id, line);
    if (id !== "ch1_cold_open") return;
    const text = String(line.text || "");
    if (/提供されます/.test(text)) scene.dataset.shot = "hand";
    // 反応は暗く静まる煙と声で受ける。ここで未来の人物を特定しない。
    if (/誰かが呟いた/.test(text)) scene.dataset.shot = "reaction";
    if (/会場を満たして/.test(text)) scene.dataset.shot = "fill";
    if (/1年前/.test(text)) scene.classList.add("out");
  };
  hooks.onLine = onLine;
  return { ready, stop() {
    if (hooks.onLine === onLine) hooks.onLine = previous;
    scene.classList.add("out");
    setTimeout(() => scene.remove(), 900);
  } };
}
