import { state, save } from "../core/state.js";
import { affinityLevel } from "../core/stats.js";
import { play } from "../vn/engine.js";
import { ATTACK_UNLOCK, hasAttackTraining } from "../craft/attack-training.js";

export const ATTACK_LESSON = "ch1_sumi_attack";
// ♥2はキューブ炭、♥5は友情の締めくくり。空いている♥3に独立した特訓を置く。
export const canStudyAttack = () => !!state && affinityLevel("sumi") >= 3 && !hasAttackTraining(state.flags);

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
