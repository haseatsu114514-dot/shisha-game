import { el } from "./util.js";

/** 店の案内役。面識・好感度・行動は変更しない。 */
export function venueHost(id, text, { characters, manifest }) {
  const person = Array.isArray(characters) ? characters.find(c => c.id === id) : characters[id];
  const name = person?.display_name || person?.name || id;
  const frame = el("div.venue-host-portrait", { "aria-hidden": "true" });
  const portrait = manifest.portraits[id];
  if (portrait) {
    const rel = `sprites/characters/${id}/chr_${id}_normal.png`;
    const src = (manifest.webp || []).includes(rel)
      ? new URL("../../img/" + rel.replace(/\.png$/, ".webp"), import.meta.url).href
      : new URL("../../../assets/" + rel, import.meta.url).href;
    frame.append(el("img", { src, alt: "", decoding: "async", style: {
      top: `${6 - (1 - portrait.h - portrait.b) * 260 / portrait.aspect}px`,
      transform: `translateX(-${portrait.ax * 100}%)`,
    } }));
  }
  return el("aside.venue-host", { dataset: { test: "venue-host-" + id }, "aria-label": name }, [
    frame, el("div.venue-host-copy", [el("small", { text: person?.affiliation || "" }),
      el("strong", { text: name }), el("p", { text, dataset: { test: "venue-host-line" } })]),
  ]);
}
