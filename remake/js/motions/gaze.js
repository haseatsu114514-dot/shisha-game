// 修羅場の「視線」カットイン（2026-11-11 オーナー「最後の修羅場は演出をしっかり」）。
// その場にいる恋人たちの目元の帯が、左右から一本ずつ重い音で差し込まれ、全員の視線がはじめに刺さる（2人で約1.6秒、8人で約2.6秒）。
// 既存の立ち絵をそのまま縮尺して切り抜くだけで、加筆・回転はしない。目の位置は manifest の faceFrames（顔アイコンと同じ計測）。
// 見せるだけで、保存・進行には触れない。動きを減らす設定・テストの高速送りでは何もしない。
import { el, sleep, clamp } from "../core/util.js";
import { W, H, EASE, move, reducedMotion } from "../core/transition-kit.js";
import { holdCover } from "../core/transitions.js";
import { DB, portraitInfo, faceFrame } from "../core/data.js";
import { SE } from "../core/audio.js";

// 視線に使う表情（無い人は normal へ落ちる）。つむぎは目に影の落ちる顔、みんとは私服の栞の、笑っていない顔
export const GAZE_FACES = Object.freeze({ tsumugi: "evil", minto: "ura_sad", rio: "serious", ageha: "serious",
  mashiro: "serious", samechan: "serious", hiyori: "serious", noor: "normal" });
const SPRITE_W = 896; // 立ち絵の原画の幅（目の位置はこの幅での画素）
// manifest の faceFrames にその画風の計測がまだ無い人の、目の位置と顔の大きさ（原画 896×1200 から測った値）。
// tools/make_face_icons.py の計測が manifest に入れば、そちらが先に使われる
const EXTRA_FRAMES = { new: { noor: { eye: [406, 172], unit: 122 } } };
const GAP = 10;

const fx = () => document.getElementById("fx");
const skip = () => reducedMotion() || !!window.__remake?.vnTest?.turbo;

/** 帯の高さ（人数が増えるほど細くする。舞台 1280×720 の画素）。短い版（brief）は細くして、画面の上半分に軽く出す */
export const gazeBandHeight = (count, brief = false) =>
  clamp(Math.floor(((brief ? 420 : H - 120) - GAP * (count - 1)) / Math.max(1, count)), brief ? 54 : 62, brief ? 96 : 150);

/**
 * 一人ぶんの帯の置き方（純粋）。目の高さが帯の中央、目の左右の中央が cx に来るように立ち絵を縮尺する。
 * frame は faceFrame()（{ eye: [x, y], unit }）。
 */
export function gazeBandArt(frame, bandHeight, cx) {
  const scale = bandHeight / (frame.unit * 0.62); // 帯の高さに、眉の上から鼻先までが入る寄り
  return { width: SPRITE_W * scale, left: cx - frame.eye[0] * scale, top: bandHeight / 2 - frame.eye[1] * scale };
}

/** 出せる人だけの並び（立ち絵と目の位置がそろっている人）。cast は ID か { id, remote, face } の配列 */
export function gazeCast(cast = []) {
  const seen = new Set();
  return cast.map(entry => typeof entry === "string" ? { id: entry } : entry).filter(entry => {
    if (!entry?.id || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).map(entry => {
    const face = entry.face || GAZE_FACES[entry.id] || "serious"; // face: その場の姿に合わせた指定（店に立つみんとは営業の顔）
    const framed = (style) => {
      const info = portraitInfo(entry.id, face, style);
      const frame = info && (faceFrame(info.folder, info.style) || EXTRA_FRAMES[info.style]?.[info.folder]);
      return frame?.eye && frame.unit ? { info, frame } : null;
    };
    // 今の画風で目の位置が分からない人は、現行の立ち絵とその計測で出す（別の画風の計測を当てない）
    const found = framed() || framed("classic");
    return found ? { ...entry, src: found.info.src, frame: found.frame, color: DB.manifest.introArt?.[found.info.folder]?.color || "#dcd1f4" } : null;
  }).filter(Boolean).slice(0, 8);
}

const loaded = (src) => new Promise((resolve) => {
  const image = new Image();
  const done = (ok) => resolve(ok ? image : null);
  image.onload = () => done(true);
  image.onerror = () => done(false);
  image.src = src;
  setTimeout(() => done(false), 4000);
});

/**
 * 恋人たちの視線が刺さる。cast: その場にいる恋人（ID か { id, remote }）。2人に満たなければ何もしない。
 * brief: プチ修羅場の短い版（約0.9秒）。帯が細く、暗転が浅く、心音を鳴らさない。最後の修羅場の重い版と見分けがつくようにする
 */
export async function gaze(cast = [], { brief = false } = {}) {
  const host = fx();
  const list = skip() || !host ? [] : gazeCast(cast);
  if (list.length < 2) return;
  const images = await Promise.all(list.map(entry => loaded(entry.src)));
  const shown = list.filter((_, i) => images[i]);
  if (shown.length < 2 || !host.isConnected) return;
  const bandHeight = gazeBandHeight(shown.length, brief);
  const total = bandHeight * shown.length + GAP * (shown.length - 1);
  const top = brief ? Math.max(24, (H - 220 - total) / 2) : (H - total) / 2; // 短い版は台詞欄にかけない
  const node = el(`div.mo-gaze${brief ? ".brief" : ""}`, { "aria-hidden": "true", dataset: { count: String(shown.length) } });
  const dim = el("div.mo-gaze-dim");
  const bands = shown.map((entry, i) => {
    const fromLeft = i % 2 === 0;
    const art = gazeBandArt(entry.frame, bandHeight, W / 2 + (fromLeft ? -150 : 150)); // 一本ごとに左右へずらす
    const image = el("img.mo-gaze-art", { alt: "", draggable: "false", src: entry.src,
      style: { width: `${art.width}px`, left: `${art.left}px`, top: `${art.top}px` } });
    return el(`div.mo-gaze-band${entry.remote ? ".remote" : ""}`, {
      dataset: { gaze: entry.id, side: fromLeft ? "left" : "right" },
      style: { top: `${top + i * (bandHeight + GAP)}px`, height: `${bandHeight}px`, "--gaze": entry.color, opacity: "0" },
    }, [image, entry.remote ? el("i.mo-gaze-scan") : null]);
  });
  node.append(dim, ...bands);
  const unhold = holdCover();
  host.append(node);
  try {
    move(dim, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "ease-out" });
    await sleep(120);
    for (const band of bands) {
      const from = band.dataset.side === "left" ? -1 : 1;
      SE.hit();
      move(band, [{ opacity: 1, transform: `translateX(${from * 104}%)` }, { opacity: 1, transform: `translateX(${from * -1.2}%)`, offset: 0.8 },
        { opacity: 1, transform: "translateX(0)" }], 260, { easing: EASE.out });
      // 差し込まれた後は、目元へゆっくり寄り続ける（止め絵にしない）
      move(band.firstChild, [{ transform: "scale(1)" }, { transform: "scale(1.07)" }], 2600, { easing: "linear" });
      await sleep(brief ? 110 : shown.length > 4 ? 140 : 190);
    }
    if (brief) await sleep(420);
    else {
      await sleep(260);
      SE.heartbeat();
      await sleep(760);
    }
    await Promise.all([
      ...bands.map((band, i) => move(band, [{ opacity: 1, transform: "scaleY(1)" }, { opacity: 0, transform: "scaleY(0)" }], 170, { easing: EASE.in, delay: i * 18 })),
      move(dim, [{ opacity: 1 }, { opacity: 0 }], 260, { easing: "ease-in" }),
    ]);
  } finally {
    node.remove();
    unhold();
  }
}
