// 第3章の回復後に置く試作（#1654）。久世・スティーブから聞いたことを、mukaiの作業台で一度ずつ確かめる。
// DOMを持たない進行判定。再生・制作・保存は ch3-trials.js が担う。
import { chapterThreeScenes, chapterThreeProgress } from "./ch3-progress.js";

// after=この必須場面を読み終えてから。scope=full は調整なしの通し制作、care は提供後の調整2回だけ。
export const CH3_TRIALS = Object.freeze([
  { id: "kuze", after: "ch3_kuze_advice", scope: "full", label: "炭の順番を試す",
    intro: "ch3_trial_kuze_intro", end: "ch3_trial_kuze_end" },
  { id: "steve", after: "ch3_steve_low_heat", scope: "care", label: "待つ調整を試す",
    intro: "ch3_trial_steve_intro", end: "ch3_trial_steve_end" },
]);
export const CH3_TRIAL_DIALOGUE_IDS = Object.freeze(CH3_TRIALS.flatMap(trial => [trial.intro, trial.end]));
export const trialFlag = id => `_ch3_trial_${id}`;
// 講評を分ける境界。第1章の中間講評・リハーサルと同じ値。
export const TRIAL_GOOD_SCORE = 68;

const RESULTS = new Set(["good", "rough", "failed"]);

/** 保存済みの記録。形が崩れた古い値は未着手として扱い、保存は書き換えない。 */
export function trialRecord(value, id) {
  const record = value?.flags?.[trialFlag(id)];
  return record && typeof record === "object" && !Array.isArray(record) ? record : null;
}

export const trialFinished = (value, id) => trialRecord(value, id)?.feedbackRead === true;

/**
 * 今のカードで選べる試作。前提場面を読み終え、本筋の場面がまだ残っている（大会前）間だけ。
 * 読取のみで保存を変えない。
 */
export function availableChapterThreeTrials(value) {
  if (value?.chapter !== 3 || !value.flags?._ch3_intro) return [];
  const progress = chapterThreeProgress(value);
  const scenes = chapterThreeScenes(value);
  if (progress.stage >= scenes.length) return [];
  return CH3_TRIALS.filter(trial => {
    const index = scenes.findIndex(scene => scene.id === trial.after);
    return index >= 0 && progress.stage > index && !trialFinished(value, trial.id);
  });
}

const average = values => {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, item) => sum + item, 0) / finite.length : 0;
};

/** 制作結果から講評の分岐を決める。scoreは呼出し側で計算した通し制作の品質（調整のみなら省略）。 */
export function trialResult(trial, cs, craftQuality = null) {
  if (!cs || cs.failed) return "failed";
  const care = (cs.careHistory || []).filter(Boolean).map(result => result.score);
  const score = trial.scope === "care" ? average(care)
    : average([cs.holes?.score, cs.heat?.score, craftQuality]);
  return score >= TRIAL_GOOD_SCORE ? "good" : "rough";
}

/** 制作の完了を一度だけ記録する。講評前に中断しても、同じ試作を作り直させない。 */
export function recordTrialPractice(value, id, result) {
  if (!RESULTS.has(result) || !CH3_TRIALS.some(trial => trial.id === id)) return false;
  const record = trialRecord(value, id) || {};
  if (record.practiceDone) return false;
  value.flags[trialFlag(id)] = { ...record, practiceDone: true, result, day: value.day };
  return true;
}

export function finishTrialFeedback(value, id) {
  const record = trialRecord(value, id);
  if (!record?.practiceDone || record.feedbackRead) return false;
  record.feedbackRead = true;
  return true;
}

/** 講評は結果の分岐を先に読み、共通の締めへ続ける（第1章の中間講評と同じ組み方）。 */
export function trialFeedbackDialogue(dialogue, result) {
  const branch = dialogue?.branches?.[result];
  return branch ? { ...dialogue, lines: [...branch, ...dialogue.lines], branches: {} } : dialogue;
}
