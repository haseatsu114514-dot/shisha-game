export function displayName(characters, id) {
  const c = characters.find(c => c.id === id);
  if (!c) return id;
  if (c.display_name) return c.display_name;
  const nickname = /（[^）]*\/\s*([^）]+)）/.exec(c.name || "");
  const outer = (c.name || id).replace(/（[^）]*）/g, "");
  return outer.includes(" / ") ? outer.split(" / ")[0].trim()
    : nickname ? nickname[1].trim() : outer.replace(/\s+/g, "");
}

export function portraitUrl(manifest, id, face = "normal") {
  const valid = manifest.portraits[id]?.faces.includes(face) ? face : "normal";
  const rel = `sprites/characters/${id}/chr_${id}_${valid}.png`;
  return (manifest.webp || []).includes(rel)
    ? new URL("../../img/" + rel.replace(/\.png$/, ".webp"), import.meta.url).href
    : new URL("../../../assets/" + rel, import.meta.url).href;
}

export function portraitTop(manifest, id, width, headY) {
  const p = manifest.portraits[id];
  if (!p) return "0px";
  return (headY - (1 - p.h - p.b) * width / p.aspect) + "px";
}

/** A painted room or, until the art exists, a tinted backdrop with the place name. */
export function sceneArt(el, scenario, cls = "") {
  const p = scenario.presentation, url = sceneUrl(scenario);
  return url ? el("img" + cls, { src: url, alt: p.sceneAlt || "" })
    : el("div" + cls + ".trpg-scene-fallback", { role: "img", "aria-label": p.sceneAlt || p.location || "",
      style: { background: p.backdrop || "linear-gradient(160deg, #1d3a44, #0c1b22 70%)" } }, el("span.trpg-scene-fallback-title", { text: p.location || "" }));
}

/** The painted room, or null while a scenario waits for its art (callers draw presentation.backdrop instead). */
export function sceneUrl(scenario) {
  return scenario.presentation.image ? new URL(scenario.presentation.image, import.meta.url).href : null;
}
