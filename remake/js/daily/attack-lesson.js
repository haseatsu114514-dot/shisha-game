import { state, save } from "../core/state.js";
import { affinityLevel } from "../core/stats.js";
import { growthEnabled } from "../core/growth.js";
import { play } from "../vn/engine.js";
import { ATTACK_UNLOCK, hasAttackTraining } from "../craft/attack-training.js";

export const ATTACK_LESSON = "ch1_sumi_attack";
// 盤の公開前だけ旧♥3の入口を残す。盤の授業では好感度を条件にしない。
// 心得の盤が有効なら、この授業は盤の授業のマスから受ける（SPEC 2.6・#1774）
export const canStudyAttack = () => !!state && !growthEnabled() && affinityLevel("sumi") >= 3 && !hasAttackTraining(state.flags);

export function completeAttackLesson(student, result) {
  if (student !== state || !canStudyAttack() || result?.cancelled || result?.id !== ATTACK_LESSON
    || !result.visited?.includes(ATTACK_LESSON)) return false;
  state.flags[ATTACK_UNLOCK] = true;
  save();
  return true;
}

export async function studyAttack({ signal } = {}) {
  if (!canStudyAttack()) return false;
  const student = state;
  const result = await play(ATTACK_LESSON, { bg: "res://assets/backgrounds/bg_tonari_inside.png", signal });
  return completeAttackLesson(student, result);
}
