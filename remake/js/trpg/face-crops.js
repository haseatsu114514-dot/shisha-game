// Crops for TRPG circular face icons: same cheek-to-cheek scale and eye-line height
// for every character (and the same numbers used to write costumes/frames.json).
import { portraitStyle } from "../core/portrait-style.js";
import { FACE_FRAC, EYE_Y, PORTRAIT_FRAMES } from "./face-crops-data.js";

export { FACE_FRAC, EYE_Y, PORTRAIT_FRAMES };

const ALIASES = { tumugi: "tsumugi", hazime: "hajime" };

export function portraitFaceFrame(id, style = portraitStyle()) {
  const folder = ALIASES[id] || id;
  const bucket = PORTRAIT_FRAMES[style] || PORTRAIT_FRAMES.new;
  return bucket?.[folder] || PORTRAIT_FRAMES.classic?.[folder] || null;
}

/**
 * Position a standing portrait so its measured face crop fills a circular (or
 * square) parent. Width / top are percentages of the parent, so the same style
 * works at 68px seats, 52px companions, and the smaller phone sizes.
 */
export function circleFaceStyle(frame) {
  if (!frame) return null;
  const box = frame.box_exact || frame.box;
  const [left, top, right] = box;
  const side = right - left;
  if (!(side > 0)) return null;
  const srcW = frame.src?.[0];
  if (!(srcW > 0)) return null;
  const cx = frame.face?.cx ?? (left + right) / 2;
  return {
    position: "absolute",
    left: "50%",
    width: `${(srcW / side) * 100}%`,
    maxWidth: "none",
    height: "auto",
    top: `${(-top / side) * 100}%`,
    transform: `translateX(-${(cx / srcW) * 100}%)`,
  };
}

/** Inline style for a TRPG circle, or null to keep the standing-portrait fallback. */
export function faceIconStyle(id, style = portraitStyle()) {
  return circleFaceStyle(portraitFaceFrame(id, style));
}
