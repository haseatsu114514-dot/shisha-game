// 薄い心拍線で心の揺れを見せる。温度・採点には触れない。
import { el, clamp } from "../core/util.js";

export function buildMentalTrace(width, height) {
  const caption = el("span.dodge-mental-caption", { text: "平静" });
  const trace = el("div.dodge-mental", { role: "img", "aria-label": "心は平静", dataset: { test: "mental-trace", level: "steady" } }, [
    el("span", { "aria-hidden": "true", html: `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><path class="dodge-beat-line" fill="none"/></svg>` }), caption,
  ]);
  const path = trace.querySelector("path");
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let lastHit = -Infinity, lastDraw = -Infinity, level = "", previousHits = 0;
  const stressAt = (time, hits) => clamp((1 - (time - lastHit) / 4) + Math.min(.2, hits * .025), 0, 1);
  const update = (time, hits) => {
    const stress = stressAt(time, hits);
    const next = stress > .65 ? "shaken" : stress > .25 ? "unsteady" : "steady";
    if (next !== level || hits !== previousHits) {
      level = next; previousHits = hits;
      trace.dataset.level = level; trace.dataset.hits = String(hits);
      caption.textContent = { steady: "平静", unsteady: "ざわつく", shaken: "動揺" }[level];
      trace.setAttribute("aria-label", `心の状態：${caption.textContent}。被弾${hits}回`);
    }
    if (time - lastDraw < .05) return level;
    lastDraw = time;
    let d = "";
    const motionTime = reduced ? 0 : time;
    for (let x = 0; x <= width; x += 4) {
      const phase = (x + motionTime * (85 + stress * 90)) % 128;
      const pulse = -26 * Math.exp(-(((phase - 46) / 4) ** 2)) + 13 * Math.exp(-(((phase - 52) / 5) ** 2)) - 5 * Math.exp(-(((phase - 34) / 7) ** 2));
      const noise = stress * 7 * Math.sin(x * .17 + motionTime * 21) * Math.sin(x * .06 - motionTime * 13);
      const y = height * .62 + pulse * (.45 + stress * 1.55) + noise;
      d += `${x ? "L" : "M"}${x},${y.toFixed(1)}`;
    }
    path.setAttribute("d", d);
    return level;
  };
  update(0, 0);
  return { root: trace, update, hit(time, hits) {
    lastHit = time; lastDraw = -Infinity;
    trace.classList.remove("mental-hit"); void trace.offsetWidth; trace.classList.add("mental-hit");
    return update(time, hits);
  }, recoverStep(time, hits) {
    const stress = stressAt(time, hits);
    if (stress <= .25) return update(time, hits);
    const next = stress > .65 ? .6 : .2;
    lastHit = time - (1 + Math.min(.2, hits * .025) - next) * 4;
    lastDraw = -Infinity; trace.classList.remove("mental-hit");
    return update(time, hits);
  } };
}
