// 恋人の固有場面の初読報酬（stat-design/SPEC X5）。盤の公開設定・経験値通知は既存入口に従う。
import { state } from "./state.js";
import { gainExp, growthEnabled } from "./growth.js";

export const LOVER_SCENE_EXP = 20;

/** 完読した開始台本だけを数える。jump先・中断・別セーブ・既読の旧セーブへは再付与しない。 */
export function awardLoverSceneExp(id, owner) {
  if (!owner || state !== owner || !growthEnabled()) return 0;
  const match = /^lover_(tsumugi|minto|rin|ageha|mashiro|samechan)_lv[1-5](?:_b)?$/.exec(id || "");
  const character = match?.[1] || (id === "hiyori_feelings_spoken" ? "hiyori" : null);
  if (!character || !state.lovers?.includes(character)) return 0;
  const key = `_lover_exp_${id}`;
  if (state.flags[key] || state.loverEventsSeen?.includes(id)
    || state.flags[`_${id}_reward_done`]
    || id === "hiyori_feelings_spoken" && state.flags._hiyori_feelings_spoken) return 0;
  state.flags[key] = true;
  return gainExp(LOVER_SCENE_EXP, { key: character, tag: "会話" });
}
