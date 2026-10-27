import { DB, bgUrl } from "../core/data.js";
import { state, save } from "../core/state.js";
import { gainAffinity, ensureAffinityLevel, applyStats, paidAction } from "../core/stats.js";
import { rememberRelationship } from "../core/relationships.js";
import { layers, showScreen, setBg } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "./ch2-city-data.js";
import { chapterThreeFreeTime, completeChapterThreeFreeTime } from "./ch3-progress.js";
import { tokyoGymWindowAllowed, tokyoWindowReserved } from "../core/tokyo-clock.js";
import { MASHIRO_STORIES, selectTokyoAffinityStory, mashiroRead } from "../core/tokyo-affinity.js";

let session = null, loading = null;
export function mashiroVisitScene(value, window) {
  return window && tokyoGymWindowAllowed(value, window) && !tokyoWindowReserved(value, window)
    ? selectTokyoAffinityStory(value, window) : null;
}
async function loadStories() {
  if (!loading) loading = readDialogues("ch3_mashiro", [...MASHIRO_STORIES.map(s => s.id), "ch3_mashiro_repeat"])
    .then(dialogues => { Object.assign(DB.dialogues, dialogues); return dialogues; })
    .catch(error => { loading = null; throw error; });
  return loading;
}
// VN中に報酬・思い出を書かない。実台本の既存報酬は完読境界で一度だけ。
function deferredDialogue(source) {
  const lines = source.lines.filter(line => line.type !== "remember");
  if (source.branches || source.metadata?.add_stat || source.metadata?.add_affinity || source.metadata?.flavor_lesson
    || lines.some(line => line.type || typeof line.text !== "string")) {
    throw new Error("ましろの任意会話の形式を確認してください");
  }
  return { ...source, lines, growth_stats: undefined, metadata: { ...source.metadata, bg: "" } };
}
export async function visitTokyoMashiro(windowId, { signal = null, isCurrent = () => true } = {}) {
  if (session?.value === state || signal?.aborted || !isCurrent()) return false;
  session?.controller.abort();
  const owner = session = { value: state, controller: new AbortController() };
  const start = { chapter: state.chapter, day: state.day, slot: state.slot, stage: state.flags?._ch3_intro?.stage };
  const current = () => session === owner && owner.value === state && isCurrent()
    && !signal?.aborted && !owner.controller.signal.aborted
    && state.chapter === start.chapter && state.day === start.day && state.slot === start.slot
    && state.flags?._ch3_intro?.stage === start.stage;
  const cancel = () => owner.controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  window.addEventListener("pagehide", cancel, { once: true });
  try {
    const window = chapterThreeFreeTime(state);
    if (!current() || window?.id !== windowId) return false;
    // 加算前の訪問予定を固定。読了後に次の段階へ再抽選しない。
    const id = mashiroVisitScene(state, window);
    if (!id) return false;
    const dialogues = await loadStories();
    if (!current() || chapterThreeFreeTime(state)?.id !== windowId || mashiroVisitScene(state, window) !== id) return false;
    const dialogue = deferredDialogue(dialogues[id]);
    await setBg(bgUrl(id === "ch3_mashiro_play_2" ? "bg_hideaway" : "bg_mukai_shop"), { instant: true });
    if (!current()) return false;
    showScreen("none", null); layers.hud.replaceChildren(); layers.hud.classList.remove("show");
    const result = await play(dialogue, { signal: owner.controller.signal });
    if (!current() || !result || result.cancelled || chapterThreeFreeTime(state)?.id !== windowId
      || mashiroVisitScene(state, window) !== id) return false;
    const settled = await paidAction(() => {
      if (!current() || !completeChapterThreeFreeTime(state, windowId)) return false;
      const first = !mashiroRead(state, "ch3_mashiro_play_1");
      if (id !== "ch3_mashiro_repeat") state.flags[`_ch3_read_${id}`] = true;
      state.visits.mashiro = (state.visits.mashiro || 0) + 1;
      // 第2章の通常来店と同じ10/5。倍率・端数・恋人の絆は既存APIへ。
      gainAffinity("mashiro", first ? 10 : 5);
      if (first) ensureAffinityLevel("mashiro", 1);
      if (id === "ch3_mashiro_practice") {
        applyStats(dialogues[id].growth_stats);
        rememberRelationship("mashiro_practice");
      }
      return true;
    }, { consumed: used => used });
    if (!settled.value || owner.value !== state) return false;
    save();
    return true;
  } finally {
    signal?.removeEventListener("abort", cancel);
    window.removeEventListener("pagehide", cancel);
    owner.controller.abort();
    if (session === owner) session = null;
  }
}
