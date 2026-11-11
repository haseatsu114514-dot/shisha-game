// 通いの続きの小さな出来事（chapters/visit-chains.js）を読む。台詞の読み込みと、一段を読む間だけの選択・条件の受け持ち。
// 代金・体力・能力・好感度・行動の消費は各章の行き先の処理が決める（その行き先のいつもの来店と同じ値）。
import { state } from "../core/state.js";
import { DB } from "../core/data.js";
import { hooks } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { VISIT_CHAINS_FILE, VISIT_CHAIN_DIALOGUE_IDS, chainStageAt, chainCondition, recordChainStage } from "./visit-chains.js";

let loading = null;
/** 台詞を一度だけ読み込む。失敗したら次の呼び出しで読み直す（呼び出し側は失敗をいつもの会話で受ける）。 */
export async function loadVisitChains() {
  if (VISIT_CHAIN_DIALOGUE_IDS.every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= readDialogues(VISIT_CHAINS_FILE, VISIT_CHAIN_DIALOGUE_IDS).then(found => { Object.assign(DB.dialogues, found); })
    .catch(error => { loading = null; throw error; });
  await loading;
}

/** この行き先で今読める段（台詞を読み込んでから返す。読めなければ null で、いつもの会話へ）。 */
export async function chainVisitDue(place, value = state) {
  if (!chainStageAt(value, place)) return null;
  try { await loadVisitChains(); } catch { return null; }
  if (state !== value) return null;
  const due = chainStageAt(value, place);
  return due && DB.dialogues[due.stage.id]?.lines?.length ? due : null;
}

/**
 * 一段を読む。read(id) は各章の読み方（背景・HUD）で台本を再生し、読み終えたら true を返す。
 * 読む間だけ、選んだ答え（stage.choice の行）を拾い、台本の条件 chain_pick・chain_fact に答える。
 * 読み終えた時だけ段と答えを記録する（中断・LOADは何も残さない）。facts はその場で決まる事実（実際の制作の結果など）。
 */
export async function playChainStage(due, read, { facts = {} } = {}) {
  const owner = state;
  const { id: chainId, stage } = due || {};
  if (!chainId || !stage) return false;
  const pending = {};
  const previousChoice = hooks.onChoice, previousCondition = hooks.evalCondition;
  const choiceHook = (...args) => {
    previousChoice?.(...args);
    const [, choiceId, branch] = args;
    if (stage.choice && choiceId === stage.choice && stage.picks.includes(branch)) pending[stage.id] = branch;
  };
  const conditionHook = line => {
    const answer = chainCondition(owner, line, { pending, facts });
    return answer === undefined ? previousCondition?.(line) : answer;
  };
  hooks.onChoice = choiceHook;
  hooks.evalCondition = conditionHook;
  let done = false;
  try { done = await read(stage.id); }
  finally {
    if (hooks.onChoice === choiceHook) hooks.onChoice = previousChoice;
    if (hooks.evalCondition === conditionHook) hooks.evalCondition = previousCondition;
  }
  return !!done && state === owner && recordChainStage(owner, chainId, stage.id, pending[stage.id] ?? null);
}
