// #437: design-only comparison renderer shared by the review page and crafting bench.
// Original designs, catalog approval and the GAME OVER rig stay unchanged.
import { normalizeAppearance } from "./model.js";

const NS = "http://www.w3.org/2000/svg";
// Distribution copies keep the originals' canvas and anchors; never load source artwork here.
const ARTWORK = new URL("../../img/appearance/", import.meta.url);
const svg = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

// Map two source-image anchors onto a single display axis, preserving aspect ratio.
export function axisTransform(from, to, start, length) {
  if (![from, to, start].every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
      || !Number.isFinite(length) || length <= 0) throw new Error("Invalid appearance anchors");
  const dx = to[0] - from[0], dy = to[1] - from[1], square = dx * dx + dy * dy;
  if (!square) throw new Error("Appearance axis has no length");
  const a = length * dx / square, b = -length * dy / square;
  return `matrix(${a} ${b} ${-b} ${a} ${start[0] - a * from[0] + b * from[1]} ${start[1] - b * from[0] - a * from[1]})`;
}

export function appearancePreview(current, options, source, geometry) {
  const selected = normalizeAppearance(current, options);
  const root = svg("svg", { viewBox: "0 0 640 250", role: "img", "aria-label": "ホースからハンドル、短いチップへ続く外観の比較", "data-test": "appearance-preview" });
  // One hose, a single rigid handle axis, an optional detachable tip. No chain/hose fusion.
  root.append(svg("path", { d: "M 32 66 C 56 66 46 206 99 206 C 136 206 127 102 170 102", fill: "none", stroke: "#494750", "stroke-width": 10, "stroke-linecap": "round", "data-part": "hose" }));
  const part = (category, start, length) => {
    const id = selected[category], item = source.items.find(item => item.id === id && item.approved === true && item.category === category);
    const anchors = item && geometry.items[id];
    if (!anchors) return false;
    const node = svg("image", { href: new URL(`${encodeURIComponent(item.id)}.png`, ARTWORK).href, width: item.size[0], height: item.size[1],
      transform: axisTransform(anchors.connection, anchors.end, start, length), "data-part": category, "data-id": id });
    root.append(node);
    return true;
  };
  if (!part("handle", [170, 102], 340)) {
    root.append(svg("path", { d: "M 170 102 H 510", stroke: "#b7b5b4", "stroke-width": 12, "stroke-linecap": "round", "data-part": "default-handle" }));
  }
  part("mouthpiece", [508, 102], 46);
  return root;
}
