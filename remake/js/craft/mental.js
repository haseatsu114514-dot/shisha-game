// 薄い心拍線で心の揺れを見せる。温度・採点には触れない。状態の決め方は steam-mind.js（#2519）。
import { el } from "../core/util.js";
import { createMind, mindPressure, MIND_LABELS } from "./steam-mind.js";

export function buildMentalTrace(width, height, pressureInputs = {}) {
  const mind = createMind(mindPressure(pressureInputs));
  const caption = el("span.dodge-mental-caption", { text: "平静" });
  const trace = el("div.dodge-mental", { role: "img", "aria-label": "心は平静", dataset: { test: "mental-trace", level: "steady" } }, [
    el("span", { "aria-hidden": "true", html: `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><path class="dodge-beat-line" fill="none"/></svg>` }), caption,
  ]);
  const path = trace.querySelector("path");
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let lastDraw = -Infinity, level = "", previousHits = 0, beat = 0, beatAt = 0;
  trace.dataset.pressure = String(mind.pressure);
  const update = (time, hits) => {
    const stress = mind.tension(time);
    const next = mind.level(time);
    if (next !== level || hits !== previousHits) {
      level = next; previousHits = hits;
      trace.dataset.level = level; trace.dataset.hits = String(hits);
      caption.textContent = MIND_LABELS[level];
      trace.setAttribute("aria-label", `心の状態：${caption.textContent}。被弾${hits}回`);
    }
    trace.dataset.tension = stress.toFixed(2);
    if (time - lastDraw < .05) return level;
    lastDraw = time;
    let d = "";
    const motionTime = reduced ? 0 : time;
    // 無心は脈がゆっくり小さく、緊張するほど速く大きく乱れる。位相は積み上げて速さの変化で波を飛ばさない。
    const clear = level === "clear";
    beat += Math.max(0, motionTime - beatAt) * (clear ? 60 : 85 + stress * 90); beatAt = motionTime;
    for (let x = 0; x <= width; x += 4) {
      const phase = (x + beat) % 128;
      const pulse = -26 * Math.exp(-(((phase - 46) / 4) ** 2)) + 13 * Math.exp(-(((phase - 52) / 5) ** 2)) - 5 * Math.exp(-(((phase - 34) / 7) ** 2));
      const noise = stress * 7 * Math.sin(x * .17 + motionTime * 21) * Math.sin(x * .06 - motionTime * 13);
      const y = height * .5 + pulse * (clear ? .35 : .45 + stress * 1.55) + noise;
      d += `${x ? "L" : "M"}${x},${y.toFixed(1)}`;
    }
    path.setAttribute("d", d);
    return level;
  };
  update(0, 0);
  return { root: trace, update, hit(time, hits) {
    mind.hit(time); lastDraw = -Infinity;
    trace.classList.remove("mental-hit"); void trace.offsetWidth; trace.classList.add("mental-hit");
    return update(time, hits);
  }, recoverStep(time, hits) {
    mind.recoverStep(time);
    lastDraw = -Infinity; trace.classList.remove("mental-hit");
    return update(time, hits);
  }, cut(time, hits, words) {
    mind.cut(time, words);
    return update(time, hits);
  } };
}
