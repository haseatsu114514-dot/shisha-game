// 章の入りと物語の要所の、一度きりの絵（#2688 A1・A2・A3・A5・A6・A7・A8／#2735）。中身は remake/js/motions/ の場面ごとのファイル。
// 型は scene-motions.js と同じ（使うときに読む・stagePlay の器・覆っている間は入力を止める）。採否はオーナーが実プレイで決めるので、
// 場面ごとに ENABLED の1つを false にすれば、その場面だけ前の見せ方（何も出さない／背景をそのまま替える）に戻る。
// SKIP中は飛ばさず半分の速さで見せる（#1081 H05）。テストの高速送り（vnTest.turbo）では省く。動きを減らす設定ではフェードだけ。
// 顔・画像は使わず SVG の図形だけ。緑は使わない。保存・既読・分岐・好感度には触れない。
import { state } from "./state.js";
import { reducedMotion } from "./transition-kit.js";

export const ENABLED = {
  smokeThread: true, // A1 第1章 コールドオープン → 章題: 会場の煙が一筋になって上へ抜ける
  lightsOut: true, // A2 第2章 終幕: 閉店後のMELTY PUFFの照明が上から落ち、灯りが一つ残る
  leafWave: true, // A3 第3章 章頭の公園の回想 → 現在: 落ち葉の面が横へ流れて覆う
  dragonSmoke: true, // A5 第4章 前夜祭: 王煙楼の龍の煙
  scan: true, // A6 第1章 優勝の夜の「？？？」／第5章 SHISHA-9000 の名: 走査
  seatLights: true, // A7 第5章 二本勝負の挙手: 席の灯り（数字は出さない）
  mixingSmoke: true, // A8 第5章 フィナーレ → スタッフロール: 混ざる煙
};

const LOAD = {
  smokeThread: () => import("../motions/smoke-thread.js"),
  lightsOut: () => import("../motions/lights-out.js"),
  leafWave: () => import("../motions/leaf-wave.js"),
  dragonSmoke: () => import("../motions/dragon-smoke.js"),
  scan: () => import("../motions/scan.js"),
  seatLights: () => import("../motions/seat-lights.js"),
  mixingSmoke: () => import("../motions/mixing-smoke.js"),
};

/** SKIP中は半分の長さ。動きの長さに掛ける */
export const storyPace = () => (document.body.classList.contains("vn-skip") ? 0.5 : 1);

/** 場面の演出を一つ再生する。mid(): 覆っている間に背景を替える（演出を出さないときもそのまま呼ぶ）。出したら true */
async function run(name, opts = {}, mid = null) {
  const owner = state;
  const skip = !ENABLED[name] || window.__remake?.vnTest?.turbo; // engine の vnTest は window.__remake 経由（循環 import を避ける）
  const mod = skip ? null : await LOAD[name]().catch((e) => { console.error(e); return null; });
  if (!mod || state !== owner) { await mid?.(); return false; } // 読み込み中のLOADから、前のセーブの演出を始めない
  await mod.play({ ...opts, mid, pace: storyPace(), still: reducedMotion() });
  return true;
}

export const smokeThread = () => run("smokeThread");
export const lightsOut = () => run("lightsOut");
export const leafWave = (mid) => run("leafWave", {}, mid);
export const dragonSmoke = () => run("dragonSmoke");
export const scanName = (label) => run("scan", { label });
/** tally: chapterFiveVoteTally の一台目・二台目の挙手（はじめ／9000） */
export const seatLights = (tally) => run("seatLights", { tally });
/** colors: 出会った人のテーマ色 */
export const mixingSmoke = (colors) => run("mixingSmoke", { colors });

/** A6 の LIME 版: 開いた端末の見出しだけを走査して置き換える。会話の進行は止めない */
export function scanHeader(header) {
  if (!ENABLED.scan || !header || reducedMotion() || window.__remake?.vnTest?.turbo) return;
  LOAD.scan().then((mod) => mod.header(header, { pace: storyPace() })).catch((e) => console.error(e));
}
