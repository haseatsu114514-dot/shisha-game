import { el } from "../core/util.js";
import { svg } from "../core/transition-kit.js";
import { BULLS, RINGS } from "./axe-model.js";

const portrait = new URL("../../img/sprites/characters/maki/chr_maki_normal.webp", import.meta.url).href;
let dialogCount = 0;

/** A compact scoring comparison shared by the lesson and the rules panel. */
export function scoringGuide() {
  const normal = svg("svg", { viewBox: "0 0 144 144", class: "axe-coach-target-icon", role: "img", "aria-label": "通常の的。リング1〜4点、中央と外側4か所の5リングと赤い6点" });
  for (const ring of [...RINGS].reverse()) normal.append(svg("circle", { cx: 72, cy: 72, r: 62 * ring.radius,
    fill: ring.score === 6 ? "#b64435" : "#c9a16f", stroke: "#2a2019", "stroke-width": ring.score >= 5 ? 1.2 : 2 }));
  for (const bull of BULLS) for (const [radius, fill] of [[bull.outer, "#c9a16f"], [bull.inner, "#b64435"]])
    normal.append(svg("circle", { cx: 72 + bull.x * 62, cy: 72 + bull.y * 62, r: radius * 62, fill, stroke: "#2a2019", "stroke-width": 1 }));
  for (const [i, n] of ["1", "2", "3", "4"].entries()) normal.append(svg("text", { x: 72, y: 72 - 62 * [.9, .68, .47, .25][i] + 4, "text-anchor": "middle",
    fill: "#2a2019", "font-size": 9, "font-weight": 900 }, [n]));
  const blue = svg("svg", { viewBox: "0 0 144 144", class: "axe-coach-target-icon", role: "img", "aria-label": "宣言した青。外側7点、中心8点。その青以外は0点" }, [
    svg("circle", { cx: 72, cy: 72, r: 54, fill: "#74bcda", stroke: "#29546b", "stroke-width": 3 }),
    svg("circle", { cx: 72, cy: 72, r: 27, fill: "#24689e", stroke: "#b6dfed", "stroke-width": 2 }),
    svg("text", { x: 72, y: 42, "text-anchor": "middle", fill: "#172f41", "font-size": 19, "font-weight": 900 }, ["7"]),
    svg("text", { x: 72, y: 81, "text-anchor": "middle", fill: "#f4f6e9", "font-size": 26, "font-weight": 900 }, ["8"]),
  ]);
  return el("div.axe-coach-diagram", [
    el("section.axe-coach-score-normal", [normal, el("div", [el("strong", { text: "通常" }),
      el("p", { text: "リング1〜4点 · 5の円 · 赤い中心6点" }), el("small", { text: "赤は中央＋外側4か所。刃が触れた最高点" })])]),
    el("section.axe-coach-score-kill", [blue, el("div", [el("strong", { text: "宣言した青" }),
      el("p", { text: "外側7点 · 中心8点" }), el("small", { text: "その青以外は0点 · 1ゲーム2回＋落下で1回" })])]),
  ]);
}

/** The caller owns mounting, pausing the game and removing the dialog. */
export function coachDialog({ text, title, step = 1, total = 7, kind = "welcome", onNext, onSkip }) {
  const lineId = "axe-coach-line-" + ++dialogCount;
  const next = el("button.axe-button.axe-primary", { type: "button", text: ({ welcome: "レッスンをはじめる", target: "やってみる", result: "振り返る", finish: "レッスンを終える" })[kind] || "やってみる",
    dataset: { test: "axe-coach-next" }, onclick: onNext });
  const skip = el("button.axe-button.axe-coach-skip", { type: "button", text: "レッスンをやめる", dataset: { test: "axe-coach-skip" }, onclick: onSkip });
  const panel = el("section.axe-coach", { role: "dialog", "aria-modal": "true", "aria-label": title, "aria-describedby": lineId,
    dataset: { test: "axe-coach", kind } }, [
    el("div.axe-coach-card", [
      el("header.axe-coach-header", [el("div.axe-coach-portrait-frame", [el("img.axe-coach-portrait", { src: portrait, alt: "斧崎マキ" })]),
        el("div.axe-coach-identity", [el("small", { text: "斧投げBar店員" }), el("strong", { text: "斧崎マキ" })]),
        el("span.axe-coach-progress", { text: step + " / " + total, "aria-label": "レッスン " + step + " / " + total })]),
      el("div.axe-coach-scroll", { tabindex: "0" }, [el("h2.axe-coach-title", { text: title }),
        el("p.axe-coach-line", { id: lineId, text, dataset: { test: "axe-coach-line" } }), kind === "target" && scoringGuide()]),
      el("footer.axe-coach-actions", [next, skip]),
    ]),
  ]);
  panel.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); onSkip(); }
    else if (event.key === "Tab") {
      const nodes = [...panel.querySelectorAll('button:not([disabled]),[tabindex="0"]')];
      const index = nodes.indexOf(document.activeElement);
      const target = index < 0 ? event.shiftKey ? nodes.at(-1) : nodes[0] : nodes[(index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length];
      event.preventDefault(); target?.focus();
    } else if (event.repeat && (event.key === " " || event.key === "Enter")) event.preventDefault();
  });
  return panel;
}
