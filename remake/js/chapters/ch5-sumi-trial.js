// 第5章の決戦前の実制作練習（#2020 F）。閉店後の試作の会話（#1666。熱／詰め／香りを選ぶ→スミさんの返答→
// 直すか覚えるか）は残したまま、その会話を終えた後の夜の tonari で、任意で一度だけ本物のダブルアップルを
// 提供まで作り、スミさんに吸ってもらう。毎日のノルマにはしない。失敗しても進行は止めない。
// スミさんは、いちばん点の低い工程（全部よければ「文句はねえ」）を一つだけ返し、それが勝負の二台目の前の
// 地の文に一行で返る（ch5-progress.js の chapterFivePrepEcho が試作の返りの後に続ける）。
// 進行の判定・結果の分け方・場面IDはここ（画面に依存しない）。制作の呼び出しと画面は ch5-daily.js。
// 最終戦の一台目・二台目のルールと投票は変えない。

/** { result, feedbackRead }。周回では持ち越さない（core/carry.js で progression） */
export const SUMI_TRIAL_FLAG = "_ch5_sumi_trial";
/** スミさんが吸って見る工程（制作の順。同点なら先の工程）。穴あけを飛ばした一台（ロートスHMD）は穴を見ない */
export const SUMI_TRIAL_STEPS = Object.freeze(["holes", "heat", "steam", "pull"]);
/** どの工程もこの点以上なら「文句はねえ」 */
export const SUMI_TRIAL_GREAT = 80;
/** 一台の体力（第4章の宿の試作・前日リハーサルと同じ。1行動） */
export const SUMI_TRIAL_STAMINA = 16;
export const SUMI_TRIAL_RESULTS = Object.freeze(["great", ...SUMI_TRIAL_STEPS, "failed"]);
export const SUMI_TRIAL_INTRO = "ch5_sumi_trial_intro";
export const sumiTrialScene = result => `ch5_sumi_trial_${result}`;
export const sumiTrialRecallScene = result => `ch5_sumi_trial_recall_${result}`;
/** 台本の読み込み対象（ch5-progress.js の CH5_SCENE_FILES が ch5_main に足す） */
export const SUMI_TRIAL_IDS = Object.freeze([SUMI_TRIAL_INTRO,
  ...SUMI_TRIAL_RESULTS.map(sumiTrialScene), ...SUMI_TRIAL_RESULTS.map(sumiTrialRecallScene)]);
/** 同じ日の夜に「いつものtonariへ」を選んだ印（state.visitedDay。同じ夜に何度も聞かない） */
const DECLINED = "ch5_sumi_trial";

const recordOf = value => {
  const record = value?.flags?.[SUMI_TRIAL_FLAG];
  return record && typeof record === "object" && !Array.isArray(record) && SUMI_TRIAL_RESULTS.includes(record.result)
    ? record : null;
};
/** 第5章の自由行動で、閉店後の試作の会話（試す→直すか覚えるか）を終えている（_ch5.prep は練習の場面の読了後にだけある） */
const prepSettled = value => {
  const progress = value?.flags?._ch5;
  return value?.chapter === 5 && progress?.part === "free" && typeof progress.prep?.adjusted === "boolean";
};

/** まだ作っていない（作れる）か。時間帯は問わない（夜だけ出すのは sumiTrialOffered） */
export const sumiTrialOpen = value => prepSettled(value) && !recordOf(value);

/** 今の tonari で作業台を出すか: 閉店後（夜の枠）で、今夜「いつものtonariへ」を選んでいない */
export const sumiTrialOffered = value => sumiTrialOpen(value) && value.slot === 1
  && value.visitedDay?.[DECLINED] !== value.day;

/** 今夜はいつもの tonari にする（翌日の夜にまた聞く） */
export function declineSumiTrialTonight(value) {
  if (!sumiTrialOpen(value)) return false;
  value.visitedDay = value.visitedDay && typeof value.visitedDay === "object" ? value.visitedDay : {};
  value.visitedDay[DECLINED] = value.day;
  return true;
}

/** 作った一台の講評を、まだ読み終えていない（制作の後に LOAD した等）。次の tonari で講評だけ読む */
export const sumiTrialFeedbackPending = value => prepSettled(value) && recordOf(value)?.feedbackRead === false;

/**
 * スミさんが返す一点。提供できなかった（焦げ・冷え・葉切れ・中断）なら failed。
 * それ以外は、点の付いた工程のうちいちばん低いもの。全部 SUMI_TRIAL_GREAT 以上なら great。
 */
export function sumiTrialResult(cs) {
  if (!cs || cs.failed || !cs.pullDone) return "failed";
  const scored = SUMI_TRIAL_STEPS.filter(step => Number.isFinite(cs[step]?.score) && !cs[step].skipped);
  if (!scored.length) return "failed";
  const weakest = scored.reduce((low, step) => cs[step].score < cs[low].score ? step : low);
  return cs[weakest].score >= SUMI_TRIAL_GREAT ? "great" : weakest;
}

/** 作り終えた一台を一度だけ記録する（講評は未読）。二度目・自由行動の外・不明な結果は false */
export function recordSumiTrial(value, result) {
  if (!sumiTrialOpen(value) || !SUMI_TRIAL_RESULTS.includes(result)) return false;
  value.flags[SUMI_TRIAL_FLAG] = { result, feedbackRead: false };
  return true;
}

/** 講評を読み終えた */
export function finishSumiTrialFeedback(value) {
  const record = recordOf(value);
  if (!record || record.feedbackRead !== false) return false;
  record.feedbackRead = true;
  return true;
}

/** 二台目の前の場面の末尾に続ける一行（講評まで読んだ一台だけ。読んでいなければ何も足さない） */
export function sumiTrialRecall(value) {
  const record = recordOf(value);
  return record?.feedbackRead === true ? [sumiTrialRecallScene(record.result)] : [];
}
