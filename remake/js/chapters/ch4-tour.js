// 第4章の初日の街回り（4-1・SPC28。2026-11-15 オーナー「いろんなとこを初日はなるか恋人と回る、彼女がいたら彼女と
// （誰と行こうかって選ぶ）も候補に出す」）。ドバイの日常（版2）のDAY1の昼の行動を使う強制イベント（ch4-dubai-daily.js の slotEvent）。
// 到着の宿（ch4_arrival_inn）で会場の下見へ出たなるが、通行証が無くて門前払いされて戻ってくる（通行証は今夜の説明会で配る）。
// 同行の恋人がいれば、その人となるのどちらと回るかを選ぶ（恋人が先）。いなければなると回る。
// 金のスーク → クリーク → 夕方のモスク（外から）。どの場所の初回の場面（スパイスの試し・旅装の男・渡し舟・モスクの見学）も先取りしない。
// 好感度・能力・お金・持ち物は動かさない。読み終えた時だけ、回った相手を旗に残す。
import { OVERSEAS_HEROINES, overseasCompanion } from "../core/overseas-companion.js";
import { chapterFourDaily, chapterFourProgress } from "./ch4-progress.js";

export const CH4_TOUR_FLAG = "_ch4_tour";
export const CH4_TOUR_BG = "bg_dubai_inn_day";
export const CH4_TOUR_PARTNERS = Object.freeze(["naru", ...OVERSEAS_HEROINES]);
const byId = (ids, prefix) => Object.freeze(Object.fromEntries(ids.map(id => [id, `${prefix}${id}`])));
export const CH4_TOUR_SCENES = Object.freeze({
  open: "ch4_tour_open", alone: "ch4_tour_alone", choose: "ch4_tour_choose", naruLeaves: "ch4_tour_naru_leaves",
  ask: byId(OVERSEAS_HEROINES, "ch4_tour_ask_"),
  stay: byId(OVERSEAS_HEROINES, "ch4_tour_stay_"),
  with: byId(CH4_TOUR_PARTNERS, "ch4_tour_with_"),
});
export const CH4_TOUR_IDS = Object.freeze([CH4_TOUR_SCENES.open, CH4_TOUR_SCENES.alone, CH4_TOUR_SCENES.choose, CH4_TOUR_SCENES.naruLeaves,
  ...Object.values(CH4_TOUR_SCENES.ask), ...Object.values(CH4_TOUR_SCENES.stay), ...Object.values(CH4_TOUR_SCENES.with)]);
// 選んだ相手の続き（会話エンジンの next_id で飛ぶ先）。読み終えた時の visited で、どちらを選んだかを知る
export const CH4_TOUR_PICK = Object.freeze({ companion: "ch4_tour_pick_companion", naru: "ch4_tour_pick_naru" });

/** 一緒に回れる恋人（同じ便で来た同行者だけ。別便の人はまだ着いていない）。 */
export function chapterFourTourCompanion(value) {
  const companion = overseasCompanion(value).companion;
  return companion && OVERSEAS_HEROINES.includes(companion) && (value.lovers || []).includes(companion) ? companion : null;
}

/** 今の時間帯が街回りか（版2のDAY1の昼・自由行動・まだ回っていない）。 */
export function chapterFourTourDue(value) {
  if (!value?.flags || value.flags[CH4_TOUR_FLAG] || !chapterFourDaily(value) || value.slot !== 0) return false;
  try {
    const progress = chapterFourProgress(value);
    return progress.part === "free" && progress.day === 1;
  } catch { return false; }
}

/**
 * 読む台本。dialogues は台詞の表（DB.dialogues）、companionLabel は選択肢に出す恋人の呼び名。
 * picks は選んだ相手ごとの続き（DB.dialogues に足してから読む）。恋人がいなければ選択肢は出さず、なると回る。
 */
export function chapterFourTourScript(value, dialogues, { companionLabel = "" } = {}) {
  const lines = id => dialogues[id]?.lines || [];
  const companion = chapterFourTourCompanion(value);
  const { open, alone, choose, naruLeaves, ask, stay } = CH4_TOUR_SCENES, walk = CH4_TOUR_SCENES.with;
  if (!companion) return { script: { dialogue_id: "ch4_tour", lines: [...lines(open), ...lines(alone), ...lines(walk.naru)] }, picks: {} };
  return {
    script: { dialogue_id: "ch4_tour", lines: [...lines(open), ...lines(ask[companion]), ...lines(choose), {
      type: "choice", id: "ch4_tour_partner", choices: [
        { text: `${companionLabel}と回る`, next_id: CH4_TOUR_PICK.companion },
        { text: "なると回る", next_id: CH4_TOUR_PICK.naru },
      ] }] },
    picks: {
      [CH4_TOUR_PICK.companion]: { dialogue_id: CH4_TOUR_PICK.companion, lines: [...lines(naruLeaves), ...lines(walk[companion])] },
      [CH4_TOUR_PICK.naru]: { dialogue_id: CH4_TOUR_PICK.naru, lines: [...lines(stay[companion]), ...lines(walk.naru)] },
    },
  };
}

/** 読み終えた台本の visited から、回った相手。選ぶ前に終わった時は null。 */
export function chapterFourTourPartner(value, visited = []) {
  const companion = chapterFourTourCompanion(value);
  if (!companion) return "naru";
  if (visited.includes(CH4_TOUR_PICK.companion)) return companion;
  return visited.includes(CH4_TOUR_PICK.naru) ? "naru" : null;
}
