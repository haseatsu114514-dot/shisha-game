// 家シーシャの台（#638）。スミさんの卓上台（第1章 DAY2以降の帰宅前に譲られる）と、くじの大会公式モデルの台。
// 寝る前の一服の流れは home-shisha.js。ここは台の持ち物と受け取りだけ（会話の差し込みから呼ぶので軽く保つ）。
import { DB } from "../core/data.js";
import { state, save } from "../core/state.js";
import { emit } from "../core/bus.js";
import { play } from "../vn/engine.js";

export const SUMI_RIG = "home_rig_set";   // ミャア 卓上台（試作の熟練度経験値6）
export const PRO_RIG = "home_rig_pro";    // 大会公式モデルの台（試作の熟練度経験値7.5・くじの景品）
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

/** スミさんから卓上台を受け取る（一度だけ）。DAY2の帰宅前に呼ぶ。中間準備は未受領セーブのフォールバック */
export async function giveSumiRig({ bg = null, deferSave = false } = {}) {
  if (state.owned?.includes(SUMI_RIG) && state.flags._sumi_double_apple_received) return false;
  const owner = state;
  if (DB.dialogues[RIG_SCENE]) {
    const result = await play(RIG_SCENE, bg ? { bg } : {});
    if (state !== owner || result?.cancelled) return false;
  }
  state.owned ||= [];
  if (!state.owned.includes(SUMI_RIG)) state.owned.push(SUMI_RIG);
  if (!state.flags._sumi_double_apple_received) {
    state.flavors ||= [];
    state.flavorStock ||= {};
    if (!state.flavors.includes("double_apple")) state.flavors.push("double_apple");
    state.flavorStock.double_apple = (Number(state.flavorStock.double_apple) || 0) + 50;
    state.flags._sumi_double_apple_received = true;
    emit("notice", { text: "ダブルアップルを1箱（50g）もらった" });
  }
  const name = DB.equipById?.[SUMI_RIG]?.name || "卓上台";
  emit("notice", { text: `「${name}」をもらった。体力に余裕がある夜は、寝る前に家シーシャができる` });
  if (!deferSave) save(); // 有料訪問は calendar の支払い・行動確定と同時に保存する
  return true;
}

/** DAY2から、体調を崩していない夜にお下がりを渡す。旧セーブでも次の夜に受け取れる。 */
export async function giveEarlyHomeRig() {
  if (state.chapter !== 1 || state.day < 2 || state.day >= 14 || state.restDay?.fullDay
      || state.owned?.includes(SUMI_RIG) && state.flags._sumi_double_apple_received) return;
  await giveSumiRig({ bg: "res://assets/backgrounds/bg_tonari_inside.png" });
}
