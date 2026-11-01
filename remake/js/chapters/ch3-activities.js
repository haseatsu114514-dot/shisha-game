// 会員資格を共有する東京店。地元の施設会話・人物遭遇は呼ばない。
import { DB, bgUrl } from "../core/data.js";
import { state, save } from "../core/state.js";
import { addStamina, earnStat, paidAction, earnSceneCompletion } from "../core/stats.js";
import { layers, showScreen, setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { facilityGrowth } from "../daily/spots.js";
import { readDialogues } from "../core/chapter-data.js";
import { TOKYO_GYM, TOKYO_REST_STAMINA, chapterThreeGymAvailability,
  claimChapterThreeGym, claimChapterThreeRest } from "./ch3-activity-progress.js";

export { chapterThreeGymAvailability } from "./ch3-activity-progress.js";
const IDS = ["ch3_choizap_day", "ch3_choizap_night"];
let dialogueTask = null;
let session = null;

export async function loadChapterThreeActivities() {
  if (!dialogueTask) dialogueTask = readDialogues("ch3_activities", IDS).then(dialogues => {
    for (const id of IDS) DB.dialogues[id] = dialogues[id];
    return dialogues;
  }).catch(error => { dialogueTask = null; throw error; });
  return dialogueTask;
}

/** 消費・成長・訪問記録は正常完読後だけ。中断は同じ自由時間へ戻る。 */
export async function visitChapterThreeGym(windowId, { signal = null, isCurrent = () => true } = {}) {
  if (session?.value === state || signal?.aborted || !isCurrent()
    || !chapterThreeGymAvailability(state, windowId).ok) return false;
  session?.controller.abort();
  const owner = { value: state, controller: new AbortController() };
  session = owner;
  const current = () => session === owner && owner.value === state
    && !owner.controller.signal.aborted && !signal?.aborted && isCurrent();
  const cancel = () => owner.controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  window.addEventListener("pagehide", cancel, { once: true });
  try {
    const dialogues = await loadChapterThreeActivities();
    if (!current()) return false;
    const eligible = chapterThreeGymAvailability(state, windowId);
    if (!eligible.ok) return false;
    const id = eligible.window.slot ? "ch3_choizap_night" : "ch3_choizap_day";
    await setBg(bgUrl("bg_choizap", eligible.window.slot ? "night" : "day"), { instant: true });
    if (!current()) return false;
    showScreen("none", null);
    layers.hud.replaceChildren();
    layers.hud.classList.remove("show");
    const result = await play(dialogues[id], { signal: owner.controller.signal });
    if (!current() || !result || result.cancelled) return false;
    const settled = await paidAction(() => {
      if (!current()) return false;
      const window = claimChapterThreeGym(state, windowId);
      if (!window) return false;
      addStamina(TOKYO_GYM.stamina);
      earnStat(TOKYO_GYM.stat, 4);
      earnSceneCompletion(id, owner.value);
      return true;
    }, { ...facilityGrowth(TOKYO_GYM), consumed: used => used, exp: { key: "tokyo:gym", place: "tokyo:gym" } });
    if (!settled.value || !current()) return false;
    save();
    toast("体を動かして、少し気分が整った", { kind: "good" });
    return true;
  } finally {
    signal?.removeEventListener("abort", cancel);
    window.removeEventListener("pagehide", cancel);
    owner.controller.abort();
    if (session === owner) session = null;
  }
}

/** 休養は既存の回復量だけを適用し、能力・お金を増やさない。 */
export function restChapterThreeFreeTime(windowId, { isCurrent = () => true } = {}) {
  if (session?.value === state || !isCurrent() || !claimChapterThreeRest(state, windowId)) return false;
  addStamina(TOKYO_REST_STAMINA);
  save();
  return true;
}
