// 第4章の出発前の準備3日（VOL02・Q2の更新）。日常ループと地図は chapters/departure-prep.js（第3章と共通）。
// ここは第4章だけの場面: 出発前のtonari2場面を準備1日目に読む（昼にスミさんとの特訓、夜に世界大会へ持っていく配合）。
// 「持っていく配合」の結びは「出発までの夜は…同じ配合を作り続けた」なので、残りの2日はその夜々にあたる。
// 必須の場面なので能力・好感度は付けない。読了の確定は ch4-progress.js の completeChapterFourScene だけ。
import { state } from "../core/state.js";
import { DB, bgUrl } from "../core/data.js";
import { play, hooks } from "../vn/engine.js";
import { CH4_SCENE_BG, chapterFourRead, completeChapterFourScene, recordChapterFourStrategy } from "./ch4-progress.js";

/** 読み終えたら確定する。「持っていく配合」は選んだ方針も記録する。中断・LOADは未読のまま。 */
async function readPrologueScene(id) {
  const owner = state;
  const source = DB.dialogues[id];
  if (!source) throw new Error(`台本がありません: ${id}`);
  let strategy = null;
  const previous = hooks.onChoice;
  const hook = (...args) => {
    previous?.(...args);
    if (args[0] === "ch4_strategy" && args[1] === "ch4_strategy_choice") strategy = args[2];
  };
  if (id === "ch4_strategy") hooks.onChoice = hook;
  try {
    const result = await play(source, { bg: bgUrl(CH4_SCENE_BG[id]) });
    if (state !== owner || !result || result.cancelled) return false;
    if (strategy) recordChapterFourStrategy(state, strategy);
    return completeChapterFourScene(state, id);
  } finally {
    if (hooks.onChoice === hook) hooks.onChoice = previous;
  }
}

/** 準備の記録から、1日目の昼（特訓）と夜（持っていく配合）の予定を作る。キーは通算日。 */
export function chapterFourPrepEvents(prep) {
  const firstDay = prep.startDay;
  return {
    morningEvents: {
      [firstDay]: { done: () => chapterFourRead(state, "ch4_sumi_training"), run: () => readPrologueScene("ch4_sumi_training") },
    },
    nightEvents: {
      [firstDay]: { id: "_ch4_prep_strategy", schedule: "fixed", pin: "tonari", teaser: "tonari", label: "持っていく配合",
        beat: "夜。閉店後のtonariで、世界大会へ持っていく配合を決める──",
        done: () => chapterFourRead(state, "ch4_strategy"),
        // 寝込んで昼の特訓を読めなかった日は、先に特訓から（場面の順は ch4-progress.js が守る）。
        run: async () => {
          if (!chapterFourRead(state, "ch4_sumi_training") && !await readPrologueScene("ch4_sumi_training")) return;
          await readPrologueScene("ch4_strategy");
        } },
    },
  };
}
