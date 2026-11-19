// Crops for TRPG circular face icons: same cheek-to-cheek scale and eye-line height
// for every character (and the same numbers used to write costumes/frames.json).
import { resolvePortrait } from "../core/portrait-resolver.js";
import { portraitStyle } from "../core/portrait-style.js";
import { FACE_FRAC, EYE_Y, PORTRAIT_FRAMES, NPC_FRAMES, EXTRA_PORTRAIT_FRAMES, PORTRAIT_FACE_SHIFTS } from "./face-crops-data.js";

export { FACE_FRAC, EYE_Y, PORTRAIT_FRAMES, NPC_FRAMES, EXTRA_PORTRAIT_FRAMES, PORTRAIT_FACE_SHIFTS };

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

function measuredPortraitFrame(folder, key, manifest) {
  return PORTRAIT_FRAMES[key]?.[folder] || EXTRA_PORTRAIT_FRAMES[key]?.[folder] || manifestFaceFrame(manifest, folder, key);
}

export function portraitFaceFrame(id, style = portraitStyle(), manifest = null) {
  const folder = ALIASES[id] || id;
  const key = style === "classic" ? "classic" : "new";
  return measuredPortraitFrame(folder, key, manifest) || measuredPortraitFrame(folder, "classic", manifest);
}

/** Per-expression [dx, dy] head-center shift in source 896x1200 pixels relative to normal. */
export function portraitFaceShift(id, face = "normal", style = portraitStyle()) {
  const folder = ALIASES[id] || id;
  const key = style === "classic" ? "classic" : "new";
  return PORTRAIT_FACE_SHIFTS[key]?.[folder]?.[face] || [0, 0];
}

export function npcFaceFrame(id) {
  return NPC_FRAMES[id] || null;
}

// Source-pixel landmarks in the shipped illustrations: left/right iris, nose tip,
// chin, left/right jaw. Eye spacing alone conflates head angle with zoom. Match
// their positions to normal with one scale and translation; preserve head tilt.
const HIYORI_LANDMARKS = {
  "new/hiyori/normal": [482, 289, 522, 274, 499.5, 299, 517.5, 321.5, 478.5, 304.5, 540.5, 299],
  "apple-thief/hiyori/rosa": [480, 276, 518, 262, 495.5, 285.5, 512.5, 308.5, 475, 290.5, 537, 286],
  "apple-thief/hiyori/marta": [482, 278, 522, 265, 498.5, 288, 515.5, 310.5, 479, 293.5, 540.5, 289.5],
  "shark-last-order/hiyori/otto": [483, 283, 524, 274, 498, 296, 512.5, 322, 479, 302, 539.5, 301],
  "shark-last-order/hiyori/midori": [486, 289, 526, 273, 503.5, 298, 521, 322, 482.5, 304.5, 544, 300],
  "leaf-mail/hiyori/yura": [500, 290, 544, 274, 518, 300, 535, 324.5, 497, 306, 560.5, 302.5],
  "leaf-mail/hiyori/neri": [492, 284, 530, 269, 507.5, 293, 525, 315.5, 487, 298.5, 549.5, 294],
  "new/hiyori/smile": [488, 294, 530, 276, 506.5, 301, 526, 323, 486, 306, 548, 299.5],
  "new/hiyori/surprise": [485, 293, 526, 277, 503, 304, 520.5, 329.5, 482, 311.5, 546, 307],
  "new/hiyori/sad": [484, 294, 526, 279, 502, 303.5, 519.5, 326, 480, 308, 543.5, 303.5],
  "classic/hiyori/normal": [398, 320.5, 438, 304.5, 414.5, 327, 435, 352.5, 397.5, 338, 456, 333],
  "classic/hiyori/smile": [398, 323, 438.5, 305, 414.5, 328.5, 435.5, 353, 397.5, 339.5, 456, 333.5],
  "classic/hiyori/serious": [400, 323.5, 442.5, 307.5, 417, 330, 438, 357.5, 399.5, 342.5, 458, 338.5],
  "classic/hiyori/sad": [395.5, 325.5, 436.5, 310, 410.5, 332, 431.5, 357.5, 394, 343.5, 456, 338],
  "classic/hiyori/surprise": [397.5, 317, 438.5, 301.5, 414, 325, 433, 354.5, 396, 339, 456, 333],
};
const LANDMARK_WEIGHTS = [1, 1, 1, 1.5, 0.6, 0.6];

// Optical trims in original source pixels after comparing at actual seat size.
// Otto's straighter jaw and Yura's asymmetric fringe pull the lower face left.
const OPTICAL_TRIMS = {
  "shark-last-order/hiyori/otto": [-1.6, 1.1, 1.008],
  "leaf-mail/hiyori/yura": [-0.7, 0.6, 0.99],
};

function landmarkMean(points) {
  const total = LANDMARK_WEIGHTS.reduce((a, b) => a + b, 0);
  return [0, 1].map(axis => LANDMARK_WEIGHTS.reduce((sum, weight, i) =>
    sum + weight * points[2 * i + axis], 0) / total);
}

function alignedFace(key, style) {
  const points = HIYORI_LANDMARKS[key];
  if (!points) return null;
  const reference = HIYORI_LANDMARKS[style + "/hiyori/normal"];
  const base = portraitFaceFrame("hiyori", style).face;
  const from = landmarkMean(points), to = landmarkMean(reference);
  let covariance = 0, variance = 0;
  for (let j = 0; j < points.length; j++) {
    const axis = j % 2, delta = points[j] - from[axis], weight = LANDMARK_WEIGHTS[j >> 1];
    covariance += weight * delta * (reference[j] - to[axis]);
    variance += weight * delta * delta;
  }
  const scale = covariance / variance;
  const [dx, dy, zoomDivisor] = OPTICAL_TRIMS[key] || [0, 0, 1];
  return { cx: from[0] + (base.cx - to[0]) / scale + dx,
    eye_y: from[1] + (base.eye_y - to[1]) / scale + dy, w: base.w / scale * zoomDivisor };
}

export function circleFaceStyle(frame, { face = frame?.face, offset = [0, 0] } = {}) {
  if (!face?.w) return null;
  const [srcW, srcH] = frame.src;
  return standingFrameStyle({ cx: face.cx + offset[0], eyeY: face.eye_y + offset[1], w: face.w, srcW, srcH },
    { faceFrac: FACE_FRAC, eyeFrac: EYE_Y });
}

export function costumeIconStyle(frame) {
  if (!frame) return null;
  const key = [frame.scenario, frame.character, frame.role_id].join("/");
  return circleFaceStyle(frame, { face: alignedFace(key, "new") || frame.face });
}

/** Use the style and expression actually selected by the same resolver as the image URL. */
export function faceIconStyle(id, style = portraitStyle(), manifest = null, face = "normal") {
  const asset = manifest && resolvePortrait(manifest, id, face, style);
  const actualStyle = asset?.style || style, actualFace = asset?.face || face;
  const folder = asset?.folder || ALIASES[id] || id;
  const frame = measuredPortraitFrame(folder, actualStyle, manifest);
  const measured = alignedFace([actualStyle, folder, actualFace].join("/"), actualStyle);
  return circleFaceStyle(frame, { face: measured || frame?.face,
    offset: measured ? [0, 0] : portraitFaceShift(id, actualFace, actualStyle) });
}

/**
 * 役衣装の上半身の札（行動宣言・表紙・キャラ作成・転生・カットイン）の切り出し。全員の顔が同じ大きさ・同じ目の高さに並ぶ。
 * face = 頬の幅が札の幅に占める割合、eye = 目の高さ（札の上から）。
 * damp: 絵ごとに測った頬の幅は、頬にかかる髪や顔の向きで ±20% ぶれる（実際の頭の大きさの違いは ±7% ほど）。測った値をそのまま使うと、
 *       同じキャラでも札ごとに顔が大きくなったり小さくなったりする（オーナー 2026-11-13「拡大率に統一感がない」）。
 *       そのキャラの中央値へ寄せ、測定値の違いは damp 乗の分だけ効かせる。
 * fix:  キャラごとの補正。頬へかかる髪まで幅に入る2人（サメちゃん・クラウド）と、面長で頭が小さく写る2人（アダム・スミさん）。
 */
export const BUST = Object.freeze({ face: 0.26, eye: 0.4, damp: 0.4, fix: Object.freeze({ samechan: 0.86, kuraudo: 0.78, adam: 0.9, sumi: 0.92 }) });

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

/** 物語の人物（NPC）の話者欄（232×318）の規格。PC立ち絵と同じ枠の中で、頬の幅（26%）と目の高さ（上から 33%）を揃える。 */
export const SPEAKER_NPC_BUST = Object.freeze({ face: BUST.face, eye: 0.33 });

/** Inline style placing an NPC standing portrait in `.trpg-speaker-art`, or null if unmapped. */
export function npcBustStyle(id) {
  const frame = npcFaceFrame(id);
  const face = frame?.face;
  const [srcW, srcH] = frame?.src || [];
  if (!(face?.w > 0) || !(srcW > 0) || !(srcH > 0)) return null;
  return {
    position: "absolute",
    left: "50%",
    width: `${(SPEAKER_NPC_BUST.face * srcW / face.w) * 100}%`,
    maxWidth: "none",
    height: "auto",
    aspectRatio: `${srcW} / ${srcH}`,
    top: `${SPEAKER_NPC_BUST.eye * 100}%`,
    transform: `translate(-${(face.cx / srcW) * 100}%, -${(face.eye_y / srcH) * 100}%)`,
  };
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
