// 東京の自由時間に地図から選んだ行き先を再生し、読了後に一枠だけ確定する（#1655）。
import { DB, bgUrl } from "../core/data.js";
import { state, save } from "../core/state.js";
import { addStamina, addMoney, earnStat, gainAffinity, paidAction, earnSceneCompletion } from "../core/stats.js";
import { layers, showScreen, setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { OUTING_DIALOGUE_IDS, chapterThreeOutings, claimChapterThreeOuting, outingDialogueId } from "./ch3-outing-progress.js";
import { consultLessons } from "../core/growth.js";

export { chapterThreeOutings } from "./ch3-outing-progress.js";
let outingTask = null;
let session = null;

export function loadChapterThreeOutings() {
  if (!outingTask) outingTask = readDialogues("ch3_outings", OUTING_DIALOGUE_IDS).then(dialogues => {
    for (const id of OUTING_DIALOGUE_IDS) DB.dialogues[id] = dialogues[id];
    return dialogues;
  }).catch(error => { outingTask = null; throw error; });
  return outingTask;
}

// 地図の行き先ごとの背景。公園とmukaiの裏口（てつこ）は専用の絵ができるまで街の道で代用する（仮）。
const OUTING_BG = { mukai: "bg_mukai_shop", enmaku: "bg_yohaku_shop", steve: "bg_steve_shop", park: "bg_street" };
/** その店で会える授業の先生（心得の盤 SBD70: 授業は会って相談した時だけ習う） */
const OUTING_TEACHER = { mukai: "mashiro", enmaku: "kuze", steve: "steve" };
// 店の手伝いは仕事の鍵。人に会いに行く回は、店が変わってもその人の鍵で数える（SPEC 1.3）。
const OUTING_EXP = {
  mukai_help: { key: "tokyo:mukai_help", place: "tokyo:mukai_help" },
  enmaku_notes: { key: "kuze", person: "kuze" }, enmaku_answer: { key: "kuze", person: "kuze" },
  mukai_steve: { key: "steve", person: "steve" }, steve_timer: { key: "steve", person: "steve" },
};

/** 地図で選んだ行き先（#1655）。消費・成長・記録は正常完読後だけ。中断は同じ自由時間へ戻る。 */
export async function visitChapterThreeOuting(windowId, id, { signal = null, isCurrent = () => true } = {}) {
  if (session?.value === state || signal?.aborted || !isCurrent()) return false;
  const owner = { value: state, controller: new AbortController() };
  session = owner;
  const current = () => session === owner && owner.value === state
    && !owner.controller.signal.aborted && !signal?.aborted && isCurrent();
  const cancel = () => owner.controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  window.addEventListener("pagehide", cancel, { once: true });
  try {
    const dialogues = await loadChapterThreeOutings();
    if (!current()) return false;
    const outing = chapterThreeOutings(state, windowId).find(item => item.id === id);
    if (!outing?.ok) return false;
    const night = !!outing.window.slot;
    const bg = outing.bg || OUTING_BG[outing.place];
    const bgRef = bg === "bg_street" ? bgUrl(night ? "bg_street_night" : "bg_street_day") : bgUrl(bg, night ? "night" : "day");
    await setBg(bgRef, { instant: true });
    if (!current()) return false;
    showScreen("none", null);
    layers.hud.replaceChildren();
    layers.hud.classList.remove("show");
    const result = await play(dialogues[outingDialogueId(state, outing, outing.window)], { signal: owner.controller.signal });
    if (!current() || !result || result.cancelled) return false;
    const settled = await paidAction(() => {
      if (!current() || !claimChapterThreeOuting(state, windowId, id)) return false;
      addStamina(outing.stamina);
      if (outing.money) addMoney(outing.money);
      if (outing.stat) earnStat(outing.stat, 4);
      if (OUTING_EXP[id]) earnSceneCompletion(result.id, owner.value);
      for (const [who, pts] of Object.entries(outing.affinity || {})) gainAffinity(who, pts);
      return true;
    }, { consumed: used => used && !!outing.stat, exp: OUTING_EXP[id] || null });
    if (!settled.value || !current()) return false;
    save();
    // 心得の盤で灯した授業があれば、その店で相談して習う（盤が無効な時は何もしない）
    if (OUTING_TEACHER[outing.place] && current()) await consultLessons(OUTING_TEACHER[outing.place], { bg: bgRef, signal: owner.controller.signal });
    if (!current()) return true;
    toast(outing.toast || (outing.money ? `日当 +${outing.money.toLocaleString()}円`
      : outing.stamina > 0 ? "少し体が休まった" : "訪ねてよかった"), { kind: "good" });
    return true;
  } finally {
    signal?.removeEventListener("abort", cancel);
    window.removeEventListener("pagehide", cancel);
    owner.controller.abort();
    if (session === owner) session = null;
  }
}
