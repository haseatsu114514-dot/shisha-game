// キューブ炭は新授業の読了でのみ習得。既存の炭焼き授業や所有品とは別に記録する。
import { state, save } from "../core/state.js";
import { affinityLevel } from "../core/stats.js";
import { growthEnabled } from "../core/growth.js";
import { play } from "../vn/engine.js";
import { COAL_UNLOCK, hasCoalTraining } from "../craft/coals.js";

export const COAL_LESSON = "ch1_sumi_cube_coals";
// 心得の盤が有効なら、この授業は盤の授業のマスから受ける（SPEC 2.6・#1774）
export const canStudyCubeCoals = () => !!state && !growthEnabled() && affinityLevel("sumi") >= 2 && !hasCoalTraining(state.flags);

export function completeCoalLesson(student, result) {
  if (student !== state || !canStudyCubeCoals() || result?.cancelled || result?.id !== COAL_LESSON
    || !result.visited?.includes(COAL_LESSON)) return false;
  state.flags[COAL_UNLOCK.cube] = true;
  save();
  return true;
}

export async function studyCubeCoals({ signal } = {}) {
  if (!canStudyCubeCoals()) return false;
  const student = state;
  const result = await play(COAL_LESSON, { bg: "res://assets/backgrounds/bg_tonari_inside.png", signal });
  return completeCoalLesson(student, result);
}
