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

// Coordinates are iris centres read from the shipped art (896 × 1200). The six
// costumes use the new Hiyori drawing even when the table uses classic portraits.
// Printed costume cheek scans can include hair; two matching eyes recover scale
// and translation without changing the pose or stretching the illustration.
const VERIFIED_EYES = {
  "new/hiyori/smile": [488, 294, 530, 276],
  "new/hiyori/surprise": [485, 293, 526, 277],
  "new/hiyori/sad": [484, 294, 526, 279],
  "apple-thief/hiyori/rosa": [480, 276, 518, 262],
  "apple-thief/hiyori/marta": [482, 278, 522, 265],
  "leaf-mail/hiyori/yura": [500, 290, 544, 274],
  "leaf-mail/hiyori/neri": [492, 284, 530, 269],
  "shark-last-order/hiyori/otto": [483, 283, 524, 274],
  "shark-last-order/hiyori/midori": [486, 289, 526, 273],
};

export function circleFaceStyle(frame, { eyes, reference, offset = [0, 0] } = {}) {
  if (!frame?.face?.w) return null;
  let { cx, eye_y: eyeY, w } = frame.face;
  if (eyes && reference?.eye_l && reference?.eye_r) {
    const [lx, ly, rx, ry] = eyes;
    const scale = (rx - lx) / (reference.eye_r[0] - reference.eye_l[0]);
    cx = (lx + rx) / 2 + (reference.cx - (reference.eye_l[0] + reference.eye_r[0]) / 2) * scale;
    eyeY = (ly + ry) / 2;
    w = reference.w * scale;
  }
  const [srcW, srcH] = frame.src;
  return standingFrameStyle({ cx: cx + offset[0], eyeY: eyeY + offset[1], w, srcW, srcH },
    { faceFrac: FACE_FRAC, eyeFrac: EYE_Y });
}

export function costumeIconStyle(frame) {
  if (!frame) return null;
  const key = [frame.scenario, frame.character, frame.role_id].join("/");
  const eyes = VERIFIED_EYES[key];
  return circleFaceStyle(frame, { eyes, reference: eyes && portraitFaceFrame(frame.character, "new")?.face });
}

/** Use the style and expression actually selected by the same resolver as the image URL. */
export function faceIconStyle(id, style = portraitStyle(), manifest = null, face = "normal") {
  const asset = manifest && resolvePortrait(manifest, id, face, style);
  const actualStyle = asset?.style || style, actualFace = asset?.face || face;
  const folder = asset?.folder || ALIASES[id] || id;
  const frame = measuredPortraitFrame(folder, actualStyle, manifest);
  const eyes = VERIFIED_EYES[[actualStyle, folder, actualFace].join("/")];
  return circleFaceStyle(frame, { eyes, reference: frame?.face,
    offset: eyes ? [0, 0] : portraitFaceShift(id, actualFace, actualStyle) });
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
