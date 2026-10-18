// 家シーシャの台（#638）。スミさんの卓上台（第1章 DAY7 の中間準備＝中盤の修行のあとに譲られる）と、くじの大会公式モデルの台。
// 寝る前の一服の流れは home-shisha.js。ここは台の持ち物と受け取りだけ（会話の差し込みから呼ぶので軽く保つ）。
import { DB } from "../core/data.js";
import { state, save } from "../core/state.js";
import { emit } from "../core/bus.js";
import { play } from "../vn/engine.js";

export const SUMI_RIG = "home_rig_set";   // ミャア 卓上台（伸び 0.5P）
export const PRO_RIG = "home_rig_pro";    // 大会公式モデルの台（伸び 0.75P・くじの景品）
export const RIG_SCENE = "ch1_sumi_home_rig";
const FALLBACK_GROWTH = { [SUMI_RIG]: 0.5, [PRO_RIG]: 0.75 };

/** 家で使う台（両方あれば伸びのいい大会公式モデル）。なければ null */
export function homeRig(s = state) {
  const owned = s?.owned || [];
  const id = [PRO_RIG, SUMI_RIG].find((rig) => owned.includes(rig));
  if (!id) return null;
  const gear = DB.equipById?.[id];
  return { id, name: gear?.name || id, growth: Number(gear?.home_growth) || FALLBACK_GROWTH[id] };
}

/** スミさんから卓上台を受け取る（一度だけ）。中間準備の最後に呼ぶ */
export async function giveSumiRig({ bg = null, deferSave = false } = {}) {
  if (state.owned?.includes(SUMI_RIG)) return false;
  const owner = state;
  if (DB.dialogues[RIG_SCENE]) {
    const result = await play(RIG_SCENE, bg ? { bg } : {});
    if (state !== owner || result?.cancelled) return false;
  }
  state.owned ||= [];
  if (!state.owned.includes(SUMI_RIG)) state.owned.push(SUMI_RIG);
  const name = DB.equipById?.[SUMI_RIG]?.name || "卓上台";
  emit("notice", { text: `「${name}」をもらった。寝る前に家で一服できる（自分の葉を12g使う）` });
  if (!deferSave) save(); // 有料訪問は calendar の支払い・行動確定と同時に保存する
  return true;
}
