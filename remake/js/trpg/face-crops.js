// Crops for TRPG circular face icons: same cheek-to-cheek scale and eye-line height
// for every character (and the same numbers used to write costumes/frames.json).
import { portraitStyle } from "../core/portrait-style.js";
import { FACE_FRAC, EYE_Y, PORTRAIT_FRAMES, EXTRA_PORTRAIT_FRAMES, PORTRAIT_FACE_SHIFTS } from "./face-crops-data.js";

export { FACE_FRAC, EYE_Y, PORTRAIT_FRAMES, EXTRA_PORTRAIT_FRAMES, PORTRAIT_FACE_SHIFTS };

const ALIASES = { tumugi: "tsumugi", hazime: "hajime" };

function manifestFaceFrame(manifest, folder, style) {
  const ff = manifest?.faceFrames?.[style]?.[folder];
  if (!ff?.eye || !ff?.box) return null;
  const [bx, by, side] = ff.box;
  if (!(side > 0)) return null;
  const [cx, eyeY] = ff.eye;
  return {
    box: [bx, by, bx + side, by + side],
    box_exact: [bx, by, bx + side, by + side],
    src: [896, 1200],
    face: { cx, eye_y: eyeY, w: ff.unit ? ff.unit * 0.78 : side * FACE_FRAC },
  };
}

export function portraitFaceFrame(id, style = portraitStyle(), manifest = null) {
  const folder = ALIASES[id] || id;
  const key = style === "classic" ? "classic" : "new";
  return PORTRAIT_FRAMES[key]?.[folder]
    || EXTRA_PORTRAIT_FRAMES[key]?.[folder]
    || manifestFaceFrame(manifest, folder, key)
    || PORTRAIT_FRAMES.classic?.[folder]
    || EXTRA_PORTRAIT_FRAMES.classic?.[folder]
    || manifestFaceFrame(manifest, folder, "classic")
    || null;
}

/** Per-expression [dx, dy] head-center shift in source 896x1200 pixels relative to normal. */
export function portraitFaceShift(id, face = "normal", style = portraitStyle()) {
  const folder = ALIASES[id] || id;
  const key = style === "classic" ? "classic" : "new";
  return PORTRAIT_FACE_SHIFTS[key]?.[folder]?.[face] || [0, 0];
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
export function faceIconStyle(id, style = portraitStyle(), manifest = null) {
  return circleFaceStyle(portraitFaceFrame(id, style, manifest));
}

/**
 * 役衣装の上半身の札（行動宣言・表紙・キャラ作成・転生・カットイン）の切り出し。全員の顔が同じ大きさ・同じ目の高さに並ぶ。
 * face = 頬の幅が札の幅に占める割合、eye = 目の高さ（札の上から）。
 * damp: 絵ごとに測った頬の幅は、頬にかかる髪や顔の向きで ±20% ぶれる（実際の頭の大きさの違いは ±7% ほど）。測った値をそのまま使うと、
 *       同じキャラでも札ごとに顔が大きくなったり小さくなったりする（オーナー 2026-11-13「拡大率に統一感がない」）。
 *       そのキャラの中央値へ寄せ、測定値の違いは damp 乗の分だけ効かせる。
 * fix:  キャラごとの補正。頬へかかる髪まで幅に入る2人（サメちゃん・クラウド）と、面長で頭が小さく写る2人（アダム・スミさん）。
 */
export const BUST = Object.freeze({ face: 0.26, eye: 0.4, damp: 0.4, fix: Object.freeze({ samechan: 0.86, rei: 0.78, adam: 0.9, sumi: 0.92 }) });

/** キャラごとの頬の幅の中央値。frames は { "シナリオ/キャラ/役": { face } }（costumes/frames.json から作る）。 */
export function bustTypicalWidths(frames) {
  const lists = {};
  for (const [key, record] of Object.entries(frames || {})) {
    const id = key.split("/")[1], width = record?.face?.w;
    if (id && width > 0) (lists[id] ||= []).push(width);
  }
  return Object.fromEntries(Object.entries(lists).map(([id, list]) => {
    list.sort((a, b) => a - b);
    const middle = list.length >> 1;
    return [id, list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2];
  }));
}

/** 札の拡大に使う頬の幅（原画の画素）。typical はそのキャラの中央値（無ければ測った値のまま）。 */
export function bustCheekWidth(face, id, typical = null) {
  const base = typical > 0 ? typical * (face.w / typical) ** BUST.damp : face.w;
  return base * (BUST.fix[id] || 1);
}

function anchoredFrameStyle({ cx, eyeY, widthPx, srcW = 896, srcH = 1200, faceFrac, eyeFrac, forImg = false }) {
  const style = {
    position: "absolute",
    left: "50%",
    width: `${(faceFrac * srcW / widthPx) * 100}%`,
    maxWidth: "none",
    top: `${eyeFrac * 100}%`,
    transform: `translate(-${(cx / srcW) * 100}%, -${(eyeY / srcH) * 100}%)`,
  };
  if (forImg) style.height = "auto";
  return style;
}

/** Frame any role costume bust (card or speaker img) at uniform cheek scale and eye line. */
export function bustFrameStyle(face, id, typical = null, { faceFrac = BUST.face, eyeFrac = BUST.eye, forImg = false } = {}) {
  return anchoredFrameStyle({
    cx: face.cx,
    eyeY: face.eye_y,
    widthPx: bustCheekWidth(face, id, typical),
    faceFrac,
    eyeFrac,
    forImg,
  });
}

/** Frame a standing portrait img inside any rectangular box by eye line and face center. */
export function standingFrameStyle({ cx, eyeY, w, srcW = 896, srcH = 1200 }, { faceFrac = 0.245, eyeFrac = 0.35, forImg = true } = {}) {
  return anchoredFrameStyle({ cx, eyeY, widthPx: w, srcW, srcH, faceFrac, eyeFrac, forImg });
}
