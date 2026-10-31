// 第3章の試作（#1654）: 聞く→作る→客とましろの反応を受け取る、を一回ずつ。
// 制作の完了と講評の既読を分けて保存し、中断後は残りの段階から再開する。
import { DB, bgUrl } from "../core/data.js";
import { state, save } from "../core/state.js";
import { setBg, showScreen, layers } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { CH3_TRIALS, CH3_TRIAL_DIALOGUE_IDS, availableChapterThreeTrials, trialRecord, trialResult,
  recordTrialPractice, finishTrialFeedback, trialFeedbackDialogue } from "./ch3-trial-progress.js";

export { availableChapterThreeTrials } from "./ch3-trial-progress.js";
const BG = "bg_mukai_shop";
let dialogueTask = null;

export function loadChapterThreeTrials() {
  dialogueTask ||= readDialogues("ch3_trials", CH3_TRIAL_DIALOGUE_IDS).then(dialogues => {
    for (const id of CH3_TRIAL_DIALOGUE_IDS) DB.dialogues[id] = dialogues[id];
    return dialogues;
  }).catch(error => { dialogueTask = null; throw error; });
  return dialogueTask;
}

async function makeTrial(trial, requireCurrent) {
  if (trial.scope === "care") {
    const { runCarePractice } = await import("../craft/practice.js");
    requireCurrent();
    const cs = await runCarePractice({ kind: "ch3_trial_care" });
    requireCurrent();
    return trialResult(trial, cs);
  }
  const [{ runFullPractice }, { computeShisha }] = await Promise.all([
    import("../craft/practice.js"), import("../craft/score.js")]);
  requireCurrent();
  const cs = await runFullPractice({ adjustments: false, kind: "ch3_trial", isCurrent: () => { requireCurrent(); return true; } });
  requireCurrent();
  if (!cs || cs.cancelled || !cs.pullDone) throw new DOMException("Trial practice interrupted", "AbortError");
  return trialResult(trial, cs, cs.failed ? null : computeShisha(cs).craftQuality);
}

/**
 * 一つの試作を最後まで進める。読み途中・制作途中の中断は false を返し、確定した段階だけ残す。
 * isCurrent は呼出し側の画面が生きているか。
 */
export async function runChapterThreeTrial(id, { signal = null, isCurrent = () => true } = {}) {
  const owner = state;
  const trial = availableChapterThreeTrials(owner).find(item => item.id === id);
  if (!trial || signal?.aborted || !isCurrent()) return false;
  const live = () => state === owner && !signal?.aborted && isCurrent();
  const requireCurrent = () => { if (!live()) throw new DOMException("Trial owner changed", "AbortError"); };
  const read = async dialogue => {
    requireCurrent();
    showScreen("none", null);
    layers.hud.replaceChildren();
    layers.hud.classList.remove("show");
    const result = await play(dialogue, { signal });
    return live() && !!result && !result.cancelled;
  };
  try {
    await loadChapterThreeTrials();
    requireCurrent();
    await setBg(bgUrl(BG), { instant: true });
    if (!trialRecord(owner, id)?.practiceDone) {
      if (!await read(DB.dialogues[trial.intro])) return false;
      const result = await makeTrial(trial, requireCurrent);
      if (!recordTrialPractice(owner, id, result)) return false;
      save();
      requireCurrent();
      await setBg(bgUrl(BG), { instant: true });
    }
    const record = trialRecord(owner, id);
    if (!await read(trialFeedbackDialogue(DB.dialogues[trial.end], record.result))) return false;
    if (!finishTrialFeedback(owner, id)) return false;
    save();
    return true;
  } catch (error) {
    if (error?.name === "AbortError" && !live()) return false;
    throw error;
  }
}

export { CH3_TRIALS };
