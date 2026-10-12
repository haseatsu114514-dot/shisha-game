// ヘッダーでは提供を独立させ、実プレイ2回の調整は同じセルで見せる。
import { el } from "../core/util.js";

const PHASES = [
  ["pack", "パッキング", ["setup", "mix", "pack", "holes"], '<ellipse cx="18" cy="8" rx="12" ry="3"/><path d="m6 8 3 10c1 3 5 3 6 6v8h6v-8c1-3 5-3 6-6l3-10M15 27h6"/>'],
  ["heat", "炭焼き", ["place", "heat"], '<path d="m17 3 13 7v15l-13 7-13-7V10Zm0 14L4 10m13 7 13-7M17 17v15"/>'],
  ["steam", "蒸らし", ["steam"], '<path d="M18 3c3 9-4 8-2 15 4-1 6-4 6-8 8 9 7 21-5 22C3 30 5 19 10 13c-1 5 3 7 4 8-1-8 7-10 4-18Z"/>'],
  ["pull", "吸い出し", ["pull"], '<path d="M3 12h19c10 0 10-10 4-10-4 0-5 3-4 5M3 19h25c8 0 8 12 1 12-4 0-5-3-4-5M3 25h14"/>'],
  ["serve", "提供", ["serve"], '<path d="M3 20h6v12H3ZM9 23l6-5h10c5 0 5 6 0 6h-7M9 30h16l8-8M7 13h23M10 13a9 9 0 0 1 18 0M19 4V2"/>'],
  ["care", "調整", ["care", "care1", "care2"], '<path d="M4 27h27M7 24a11 11 0 0 1 22 0ZM18 9V6m-2 0h4"/>'],
];

export function buildCraftProgress(steps) {
  const available = new Set(steps.map(([id]) => id));
  if (available.has("pull")) available.add("serve");
  const phases = PHASES.filter(([, , ids]) => !steps.length || ids.some(id => available.has(id)));
  const count = el("b.bench-progress-count");
  const cells = phases.map(([phase, label, ids, icon], i) => el("span.bench-phase", { dataset: { step: phase, steps: ids.join(",") } }, [
    el("i.bench-phase-icon", { "aria-hidden": "true", html: `<svg viewBox="0 0 36 36">${icon}</svg>` }),
    el("span.bench-phase-copy", [el("small", { text: String(i + 1).padStart(2, "0") }), el("b", { text: label })]),
  ]));
  const root = el("nav.bench-progress", { "aria-label": "制作の工程" }, [count, el("div.bench-progress-track", cells)]);
  return { root, count, update(id, title) {
    const active = phases.findIndex(([, , ids]) => ids.includes(id));
    cells.forEach((cell, i) => {
      cell.classList.toggle("now", i === active);
      cell.classList.toggle("seen", i < active);
      cell.querySelector("b").textContent = i === active && phases[i][0] !== "care" ? (id === "steam" ? "蒸らし中" : title) : phases[i][1];
      if (i === active) cell.setAttribute("aria-current", "step");
      else cell.removeAttribute("aria-current");
    });
    count.textContent = `${active + 1} / ${phases.length}`;
    const currentTitle = phases[active]?.[0] === "care" ? "調整" : title;
    root.setAttribute("aria-label", `制作の工程：${currentTitle}。${active + 1} / ${phases.length}`);
  } };
}
