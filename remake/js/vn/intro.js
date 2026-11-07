// 初登場カットイン: キャラが名乗って名前が出たあと、最初に一度だけ「名前・二つ名・一言」を全画面で出す。
// 文言の正本は data/characters.json の intro_cutin（なぎさは samechan.json の profile）。
//   { title: 二つ名, line: 一言（「／」は2行にする時の改行位置）, face: 立ち絵の表情, color: 差し色,
//     motion: 動きの型 sharp/soft/still/bounce, name: "alias"=フルネームを伏せる（ネタバレになる相手）, display_name: 名前（下記） }
// 載せる言葉は名前・二つ名・一言＋小さく好きなフレーバー。初対面の顔だけを書く（2026-10-31）
// 名前の出し方（NAMES-1106「カットインの名前表示ルール」2026-11-06 オーナー策定）: intro_cutin.display_name に書く。
//   本名タイプはフルネーム（あだ名がある人は「本名（あだ名）」）、通り名タイプは通り名。漢字には「漢字《よみ》」でふりがな。
//   display_name_after: { flag, display_name } は、その到達フラグが立った後の名前（みんとは本名を聞いた後に木成頼栞）
// 既読は flags._intro_<id>。明示的な未知版は _intro_<id>_<variant> へ分ける。
import { el, sleep } from "../core/util.js";
import { DB, displayName, portraitInfo, img } from "../core/data.js";
import { state, markMet, config } from "../core/state.js";
import { layers, imageReady } from "../core/ui.js";
import { SE } from "../core/audio.js";

import { mountIntro } from "./intro-fit.js";

import { motifs } from "./intro-motifs.js";
import { illustratedIntro, layoutIntro, animateIntro, exitIntro, flavorTag, plainLine, motionOf, MOTIONS, nameNode, plainName } from "./intro-art.js";
import { introFlavor } from "./intro-flavors.js";
import { graphicIntro } from "./intro-graphic.js";
import { createTransition, measureStanding } from "./intro-transition.js";

export const introSeenKey = (id, variant = "") => `_intro_${id}${variant ? `_${variant}` : ""}`;
const introOf = (id, variant = "") => DB.characters[id]?.[variant ? `intro_cutin_${variant}` : "intro_cutin"] || null;

/** このキャラのカットインを今出すべきか（データがあり・未見で・名前が「？？？」でない） */
export function needsIntro(id) {
  // 主人公は通常会話に立ち絵を出さず、冒頭の指定した一箇所だけで紹介する。
  if (!id || id === "hajime" || !introOf(id) || state.flags[introSeenKey(id)]) return false;
  return displayName(id, state) !== "？？？";
}

/** 出さずに「見た」ことにする（テストの高速送り用） */
export function markIntroSeen(id, variant = "") {
  if (introOf(id, variant)) state.flags[introSeenKey(id, variant)] = true;
}

/**
 * カットインに出す名前。source はふりがな・空き入りの書き方、main は文字だけ。
 * データに名前の無い人（パッキー・SHISHA-9000 など）は会話の名前欄と同じ呼び名
 */
export function introName(id, variant = "", override = {}) {
  const intro = { ...introOf(id, variant), ...override };
  const after = intro.display_name_after;
  const source = (after?.flag && state.flags[after.flag] && after.display_name) || intro.display_name || displayName(id, state);
  return { source, main: plainName(source) };
}

/** 1行に収める字の大きさ（半角は約半分の幅で数える） */
function fitSize(text, width, max) {
  const em = [...text].reduce((n, ch) => n + (/[\x20-\x7e]/.test(ch) ? 0.55 : 1), 0) * 1.04;
  return Math.min(max, Math.floor(width / Math.max(1, em)));
}

/** 立ち絵を胸から上で大きく切り取る（manifest の本体の高さ h・下余白 b・足元の横位置 ax を使う） */
function framePortrait(img, p) {
  const show = p.folder === "pakki" ? 0.95 : 1.55; // 画面に収める本体の割合（パッキーは全身）
  const hPct = (show / p.h) * 100;
  img.style.height = `${hPct}%`;
  img.style.top = `${-(1 - p.b - p.h) * hPct + 6}%`;
  img.style.setProperty("--ax", `${-(p.ax * 100)}%`);
}

/**
 * 初登場は最後まで見せる。クリック・Enter・SKIPでも表示時間を短くしない。
 * @param opts.onAppear 画像が出た時の場面処理（本人の登場に合わせるBGMなど）
 */
export async function playIntro(id, { onAppear = null, override = {}, variant = "" } = {}) {
  const intro = { ...introOf(id, variant), ...override };
  if (!introOf(id, variant)) return;
  if (variant !== "unknown") markMet(id);
  markIntroSeen(id, variant);
  const { source: nameSource, main } = introName(id, variant, override);
  const standingInfo = portraitInfo(id, intro.face || "normal");
  // 登場カットインの配置は現行原画用。会話の画風設定と独立して選ぶ。
  let p = portraitInfo(id, intro.face || "normal", "classic");
  let art = DB.manifest.introArt?.[id];
  const graphic = art && p ? graphicIntro(id, config.introArtStyle) : null;
  if (graphic) {
    // 新しい絵柄: 人物は専用の一枚絵、配置は共通。背景は描き直した分だけ差し替える
    p = { ...p, src: graphic.portrait, face: "graphic" };
    art = { ...art, frames: { graphic: graphic.frame } };
  }
  if (art && p) {
    const background = graphic?.background || img(art.background);
    await Promise.all([
      imageReady(p.src, 15000), imageReady(background, 15000),
      document.fonts.load('900 150px "Intro Gothic"', main).catch(() => []),
      document.fonts.load('700 38px "Intro Gothic"', `${intro.title}${intro.line}${nameSource}`).catch(() => []),
    ]);
    const host = illustratedIntro(id, variant, intro, nameSource, p, art, background);
    host.dataset.art = graphic ? "graphic" : "classic"; // ひより専用の明るい配色は旧絵柄（白い背景）だけ
    const motion = motionOf(intro);
    // 立ち絵からの「変身」のつなぎ（グラフィック絵柄のときだけ。既定 none は今まで通り）
    const standingRect = graphic ? measureStanding(id, layers.fx) : null;
    const transition = createTransition(graphic ? (override.transition ?? config.introTransition ?? "none") : "none", {
      id, fx: layers.fx, host, frame: graphic?.frame, config,
      standing: standingRect && standingInfo ? { rect: standingRect, p: standingInfo } : null,
      colors: { color: art.color, secondary: art.secondary, shadow: art.shadow },
      mount: () => mountIntro(host, layers.fx),
    });
    const animations = [];
    let unmount = null;
    try {
      unmount = await transition.enter();
      const twoLines = layoutIntro(host, id, variant, intro);
      animations.push(...animateIntro(host, id, motion, { sound: (cue) => introSound(motion, cue), skip: transition.skip }));
      host.classList.remove("ci-staged");
      onAppear?.();
      introSound(motion, "appear");
      await holdIntro(host, { motion, twoLines, exit: transition.exit ? () => transition.exit() : null });
    } finally {
      animations.forEach((animation) => animation.cancel());
      transition.cancel();
      unmount?.();
    }
    return;
  }
  const portrait = p ? el("img.ci-portrait", { src: p.src, alt: "", draggable: "false" }) : el("div.ci-portrait.none", { text: [...main][0] || "？" });
  if (p) {
    framePortrait(portrait, p);
    await imageReady(p.src, 15000);
  }
  const motif = { hajime: "smoke", adam: "duality", naru: "stripes", dr_kemuri: "science", samechan: "shark", sui: "stripes", maezono: "duality", pakki: "duality" }[id] || "smoke";
  const pattern = el("div.ci-motif", { "aria-hidden": "true" });
  pattern.innerHTML = `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">${motifs[motif]}</svg>`;
  const host = el("div.cutin", { dataset: { char: id }, style: `--ci: ${intro.color || "var(--gold)"}` }, [
    el("div.ci-left-field"),
    el("div.ci-halftone"),
    pattern,
    el("div.ci-band"),
    el("div.ci-band.b2"),
    el("div.ci-band.b3"),
    flavorTag(introFlavor(id, variant)),
    portrait,
    el("div.ci-meta", [
      el("div.ci-title", { text: intro.title || "" }),
      nameNode("div.ci-name", nameSource, { style: `font-size: ${fitSize(main, 570, 116)}px` }),
    ].filter(Boolean)),
    intro.line ? el("div.ci-line", { text: `「${plainLine(intro.line)}」`, style: `font-size: ${fitSize(`「${plainLine(intro.line)}」`, 575, 30)}px` }) : null,
  ].filter(Boolean));
  const unmount = mountIntro(host, layers.fx);
  try {
    onAppear?.();
    SE.select();
    await holdIntro(host, { motion: motionOf(intro), legacy: true });
  } finally {
    unmount();
  }
}

/** 型ごとの音。余韻は場面のBGMだけにする */
function introSound(motion, cue) {
  if (cue === "reduced") return SE.select();
  if (motion === "bounce" && cue === "appear") { SE.select(); setTimeout(() => SE.select(), 120); }
  if (cue !== "name") return;
  if (motion === "sharp") SE.stamp();
  else if (motion === "still") SE.hit();
}

/** 一言が2行の時は400ms長く見せる */
export const introHoldMs = (motion, twoLines = false) => (MOTIONS[motion] || MOTIONS.sharp).hold + (twoLines ? 400 : 0);

async function holdIntro(host, { motion = "sharp", twoLines = false, legacy = false, exit = null } = {}) {
  await sleep(30);
  host.classList.add("in");
  const onTap = (e) => { e.preventDefault(); e.stopPropagation(); };
  const onKey = (e) => {
    if (!["Enter", " ", "Control"].includes(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation();
  };
  host.addEventListener("pointerup", onTap);
  window.addEventListener("keydown", onKey, true);
  try {
    await sleep(introHoldMs(motion, twoLines));
    if (legacy) { host.classList.add("out"); await sleep(280); }
    else if (exit) await exit();
    else await sleep(exitIntro(host, motion));
  } finally {
    window.removeEventListener("keydown", onKey, true);
    host.remove();
  }
}
