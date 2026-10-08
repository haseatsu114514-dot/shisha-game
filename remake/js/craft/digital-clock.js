// 数字を焼き込まず、実際の時刻を七つの液晶セグメントで描く。
import { el } from "../core/util.js";
import { clockTime } from "./steam-time.js";

const DIGITS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
const SEGMENTS = {
  a: "M6 2h28l4 4-4 4H6L2 6Z", b: "m38 8 4 4v20l-4 4-4-4V12Z",
  c: "m38 38 4 4v20l-4 4-4-4V42Z", d: "M6 64h28l4 4-4 4H6l-4-4Z",
  e: "m2 38 4 4v20l-4 4-4-4V42Z", f: "m2 8 4 4v20l-4 4-4-4V12Z",
  g: "M6 33h28l4 4-4 4H6l-4-4Z",
};

export function buildDigitalClock(cls, { live = false, label = "蒸らし時間", test = "" } = {}) {
  const accessible = el("span.clock-value");
  const art = el("span.clock-art", { "aria-hidden": "true", html: `<svg viewBox="0 0 215 76" focusable="false">${[2, 52, 122, 172].map((x) => `<g transform="translate(${x} 0)">${Object.entries(SEGMENTS).map(([id, d]) => `<path class="segment" data-segment="${id}" d="${d}"/>`).join("")}</g>`).join("")}<circle class="colon" cx="108" cy="25" r="3"/><circle class="colon" cx="108" cy="50" r="3"/></svg>` });
  const root = el(`output.digital-clock.${cls}`, { "aria-label": label, "aria-live": live ? "polite" : "off", dataset: { test } }, [accessible, art]);
  const positions = [...art.querySelectorAll("g")];
  let value = "";
  return { root, update(seconds) {
    const next = clockTime(seconds);
    if (next === value) return;
    value = next; accessible.textContent = value;
    root.setAttribute("aria-label", `${label}：${Math.floor(seconds / 60)}分${seconds % 60}秒`);
    [...value.replace(":", "")].forEach((digit, index) => {
      positions[index].querySelectorAll("path").forEach((p) => p.classList.toggle("on", DIGITS[Number(digit)].includes(p.dataset.segment)));
    });
  } };
}
