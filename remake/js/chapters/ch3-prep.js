// 第3章の出発前の準備3日（VOL02）。日常ループと地図は chapters/departure-prep.js（第4章と共通）。
// ここは第3章だけの場面: 準備3日目（東京へ発つ前の日）の昼の耳鼻科と、その夜の出発前夜のtonari。
// 台詞は data/dialogue/ch3_departure.json。必須の場面なので能力・好感度は付けない（読了の印だけ）。
import { state } from "../core/state.js";
import { play } from "../vn/engine.js";

export const CH3_PREP_SCENES = Object.freeze(["ch3_prep_opening", "ch3_prep_clinic", "ch3_prep_farewell", "ch3_train_departure"]);
const BG = name => `res://assets/backgrounds/${name}.png`;

/** 最後まで読んだ時だけ印を付ける（中断・LOADは未読のまま、次に同じ場面から）。 */
async function readOnce(flag, id, bg) {
  const owner = state;
  const result = await play(id, { bg });
  if (state !== owner || !result || result.cancelled) return false;
  state.flags[flag] = true;
  return true;
}

/** 準備の記録から、最後の日（東京へ発つ前の日）の昼と夜の予定を作る。キーは通算日。 */
export function chapterThreePrepEvents(prep) {
  const lastDay = prep.startDay + prep.days - 1;
  return {
    morningEvents: {
      [lastDay]: { done: () => !!state.flags._ch3_prep_clinic,
        run: () => readOnce("_ch3_prep_clinic", "ch3_prep_clinic", BG("bg_street_day")) },
    },
    nightEvents: {
      [lastDay]: { id: "_ch3_prep_farewell", doneKeys: ["_ch3_prep_farewell"], schedule: "fixed",
        pin: "tonari", teaser: "tonari", label: "出発前夜", beat: "夜。出発の前の晩、閉店後のtonariへ──",
        done: () => !!state.flags._ch3_prep_farewell,
        run: () => readOnce("_ch3_prep_farewell", "ch3_prep_farewell", BG("bg_tonari_inside_night")) },
    },
  };
}
