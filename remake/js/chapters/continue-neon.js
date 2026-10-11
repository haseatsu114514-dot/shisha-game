// CONTINUE専用のベクター装飾。描画ループを追加せず、既存の期限からリングを更新する。
import { el } from "../core/util.js";

let nextId = 0;
const svg = (name, attrs = {}, children = []) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  node.append(...children);
  return node;
};

export function createNeonClock(count) {
  const id = `go-ring-${++nextId}`, circumference = 2 * Math.PI * 87;
  const progress = svg("circle", { class: "go-ring-progress", cx: 110, cy: 110, r: 87,
    fill: "none", stroke: `url(#${id})`, "stroke-width": 2,
    "stroke-dasharray": circumference, "stroke-dashoffset": 0,
    transform: "rotate(-100 110 110)" });
  const ticks = Array.from({ length: 28 }, (_, i) => svg("path", {
    d: `M 110 ${i % 7 === 0 ? 11 : 14} L 110 19`,
    transform: `rotate(${i * 360 / 28} 110 110)`,
  }));
  const ring = svg("svg", { class: "go-count-ring", viewBox: "0 0 220 220", "aria-hidden": "true" }, [
    svg("defs", {}, [svg("linearGradient", { id, x1: "0%", y1: "0%", x2: "100%", y2: "100%" }, [
      svg("stop", { offset: "0%", "stop-color": "#ff7dc0" }),
      svg("stop", { offset: "50%", "stop-color": "#f9efff" }),
      svg("stop", { offset: "100%", "stop-color": "#9064ff" }),
    ])]),
    svg("circle", { class: "go-ring-track", cx: 110, cy: 110, r: 87, fill: "none" }),
    svg("g", { class: "go-ring-ticks", fill: "none" }, ticks), progress,
    svg("path", { class: "go-ring-crosshair", d: "M 2 110 H 28 M 192 110 H 218 M 110 2 V 28 M 110 192 V 218", fill: "none" }),
    svg("path", { class: "go-ring-glint", d: "M 197 93 l 2 13 12 2 -12 2 -2 13 -2 -13 -12 -2 12 -2 Z" }),
  ]);
  const clock = el("span.go-clock", { "aria-hidden": "true" }, [ring, count]);
  return { clock, setProgress: elapsed => progress.setAttribute("stroke-dashoffset", String(circumference * elapsed)) };
}

export function createNeonAtmosphere() {
  const slash = svg("svg", { class: "go-title-slash", viewBox: "0 0 960 150", "aria-hidden": "true" }, [
    svg("path", { d: "M 0 145 L 845 16 L 956 0 M 98 137 L 765 36 M 195 114 L 402 79", fill: "none",
      stroke: "#dbd9ff", "stroke-width": 1.2 }),
    svg("path", { d: "M 55 138 L 303 95 L 195 121 Z M 685 43 L 920 6 L 901 12 Z", fill: "#eeecff" }),
  ]);
  return [el("div.go-atmosphere", { "aria-hidden": "true" }, [
    el("div.go-spotlight"), el("div.go-smoke.go-smoke-left"), el("div.go-smoke.go-smoke-right"), el("div.go-dust"),
  ]), slash];
}
