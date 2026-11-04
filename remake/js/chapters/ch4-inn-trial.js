// 第4章ドバイの宿の試作。進行判定と講評の分岐は画面に依存しない。
export const INN_TRIAL_FLAG = "_ch4_inn_trial";
export const INN_TRIAL_IDS = Object.freeze(["ch4_inn_trial_intro", "ch4_inn_trial_good", "ch4_inn_trial_rough", "ch4_inn_trial_failed"]);

/** DAY3〜8の一度きりの試作。制作後に講評を中断した保存は日付を越えても再開できる。 */
export function innTrialDue(value) {
  if (value?.chapter !== 4 || value.phase !== "daily" || value.flags?._ch4?.part !== "free") return false;
  const trial = value.flags?.[INN_TRIAL_FLAG];
  if (trial?.result) return trial.feedbackRead !== true;
  const day = value.day - value.flags._ch4.startDay + 1;
  return day >= 3 && day <= 8;
}

/** 第1章の中間講評と同じ平均68を境にする。制作失敗は独立した講評へ。 */
export function innTrialResult(cs, craftQuality = null) {
  if (cs?.failed) return "failed";
  const scores = [cs?.holes?.score, cs?.heat?.score, craftQuality].filter(Number.isFinite);
  const average = scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length);
  return average >= 68 ? "good" : "rough";
}
