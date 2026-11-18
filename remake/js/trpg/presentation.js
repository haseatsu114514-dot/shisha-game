import { portraitStyle } from "../core/portrait-style.js";
import { portraitAsset, resolvePortrait } from "../core/portrait-resolver.js";
import { portraitFaceFrame, portraitFaceShift, standingFrameStyle } from "./face-crops.js";

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
  return portraitAsset(manifest, id, face, portraitStyle())?.src || "";
}

export function portraitTop(manifest, id, width, headY) {
  const p = resolvePortrait(manifest, id, "normal", portraitStyle());
  if (!p) return "0px";
  return (headY - (1 - p.h - p.b - p.topOverhang) * width / p.aspect) + "px";
}

/** Where the top of the head sits in a standing portrait, as a fraction of the image height (short characters start lower). */
export function portraitHeadTop(manifest, id) {
  const p = resolvePortrait(manifest, id, "normal", portraitStyle());
  return p ? Math.max(0, 1 - p.h - p.b - p.topOverhang) : 0.05;
}

export function portraitAx(manifest, id) {
  return resolvePortrait(manifest, id, "normal", portraitStyle())?.ax ?? 0.5;
}

/** Frame a standing portrait by measured eye line, cheek scale, and per-expression offset. */
export function portraitBoxStyle(manifest, id, { face = "normal", faceFrac = 0.245, eyeFrac = 0.35, fallbackWidth = 410, fallbackHeadY = 16 } = {}) {
  const resolved = resolvePortrait(manifest, id, face, portraitStyle());
  const style = resolved?.style || portraitStyle();
  const actualFace = resolved?.face || face || "normal";
  const frame = portraitFaceFrame(id, style, manifest);
  if (frame?.face?.w > 0) {
    const [dx, dy] = portraitFaceShift(id, actualFace, style);
    return standingFrameStyle({
      cx: frame.face.cx + dx,
      eyeY: frame.face.eye_y + dy,
      w: frame.face.w,
      srcW: frame.src?.[0] || 896,
      srcH: frame.src?.[1] || 1200,
    }, { faceFrac, eyeFrac });
  }
  return {
    position: "absolute", left: "50%", width: fallbackWidth + "px", maxWidth: "none",
    top: portraitTop(manifest, id, fallbackWidth, fallbackHeadY),
    transform: `translateX(-${portraitAx(manifest, id) * 100}%)`,
  };
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
