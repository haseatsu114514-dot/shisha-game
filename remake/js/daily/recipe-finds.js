// 第3章以降の「新しい一台を発見する」連鎖（#2020 G）の再生。判定は daily/recipe-finds-model.js。
// 章の行き先（chapterDef.performSpot）で一服を終えた後に、その店の人と一本だけ短く話す（daily/calendar.js）。
// 居合わせる人（daily/roamers.js）と同じ形: 代金・体力・能力・好感度は来店のまま増やさず、読み終えた時だけ印を残す
// （中断・LOADでは残さない）。台詞は data/dialogue/recipe_finds.json。
import { state, save } from "../core/state.js";
import { DB } from "../core/data.js";
import { toast } from "../core/ui.js";
import { affinityLevel } from "../core/stats.js";
import { readDialogues } from "../core/chapter-data.js";
import { play, isPlaying } from "../vn/engine.js";
import { on } from "../core/bus.js";
import { recipeFindAt, recipeFindScenes, settleRecipeFind } from "./recipe-finds-model.js";

// 検査用: 店を訪ねるほかの検査の流れを変えないよう、居合わせる人と同じ切り替え（browser の support.mjs が既定で
// "suien_roamers" を "off" にする）で止める。この連鎖の検査だけ "suien_recipe_finds" を "on" にして外す。遊ぶ時は使わない。
const switchedOff = () => {
  try {
    const store = globalThis.localStorage;
    return store?.getItem("suien_recipe_finds") !== "on" && store?.getItem("suien_roamers") === "off";
  } catch { return false; }
};

let loading = null, active = false;
async function loadScenes() {
  const ids = recipeFindScenes(DB.recipes);
  if (ids.every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= readDialogues("recipe_finds", ids).then(found => { Object.assign(DB.dialogues, found); })
    .catch(error => { loading = null; throw error; });
  await loading;
}

/** 店で一服を終えた後に、ヒントか返す会話を一本読む。読み終えたら true。 */
export async function recipeFindAfterVisit(spot, { bg } = {}) {
  const owner = state;
  if (!spot?.id || active || isPlaying() || switchedOff() || owner?.phase !== "daily") return false;
  if (!recipeFindAt(owner, spot.id, DB.recipes, affinityLevel)) return false;
  try { await loadScenes(); } catch { return false; } // 寄り道の会話。読めなければ出さない（来店は済んでいる）
  if (state !== owner) return false;
  const pick = recipeFindAt(owner, spot.id, DB.recipes, affinityLevel);
  const scene = pick && DB.dialogues[pick.sceneId];
  if (!scene?.lines?.length) return false;
  // 途中でLOAD・タイトルへ戻ったら、会話を止めて何も残さない
  const controller = new AbortController();
  const unsubscribe = on("hud", () => { if (state !== owner) controller.abort(); });
  active = true;
  try {
    const result = await play(scene, { ...(bg ? { bg } : {}), signal: controller.signal });
    if (state !== owner || controller.signal.aborted || !result || result.cancelled) return false;
    settleRecipeFind(owner, pick);
    if (pick.kind === "return") toast(`📖 「${pick.recipe.name}」を、教えてくれた人に返した`, { kind: "good" });
    save();
    return true;
  } finally {
    active = false;
    unsubscribe();
    controller.abort();
  }
}
