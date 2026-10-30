// 第4章（ドバイ）の大会前夜を、data/story_routes.json の選択関数（core/story-routes.js）へつなぐ
// DOMを持たないアダプタ（#1895）。第3章の ch3-story-wiring.js に倣う。再生・保存・UIは ch4.js が担う。
import { selectStoryEvening } from "../core/story-routes.js";
import { overseasCompanion } from "../core/overseas-companion.js";
import { chapterFourProgress } from "./ch4-progress.js";

// loadDialogues が読む追加分（ファイル→場面ID）。第4章で再生しうる前夜デート（全員）と、重なった予定の保留。
// 第3章のスティーブの茶化し（near_conflict）は第4章では選ばれないので読まない。
export const CH4_EVENING_DIALOGUE_FILES = Object.freeze({
  tournament_dates: Object.freeze(["tournament_date_tsumugi", "tournament_date_minto", "tournament_date_rin",
    "tournament_date_ageha", "tournament_date_mashiro", "tournament_date_samechan", "tournament_date_hiyori"]),
  relationship_conflicts: Object.freeze(["tournament_evening_overlap"]),
});

// 前夜の場面の背景。ドバイの夜の街の専用背景が無いので既存 bg の流用（仮置き bg、#1177 でドバイ素材に差し替え）。
export const CH4_EVENING_BG = "bg_street_night";

/**
 * 前夜の context（location_contract 準拠）。好感度・渡航予定だけから恋人や到着を作らない。
 * - present: 出発前に選んだ同行者（同じ便で来ている）と、別便の応援のうち到着場面（routes.romance[id].arrival）を
 *   読み終えた人。到着の記録が無い別便の人は、その場に出さない（到着場面の接続は #1712・#516 側）。
 * - selected/accepted: 前夜の約束。第4章にはLIMEの予約が無いので、前夜カードで本人を誘った時だけ渡す。
 * - unresolved: 常に空。重なった予定は保留し、本格的な修羅場はエンディング後（第3章と同じ）。
 */
export function chapterFourEveningContext(routes, value, selected = null) {
  const { companion, supports } = overseasCompanion(value);
  const { read } = chapterFourProgress(value);
  const present = [companion, ...supports.filter(id => read[routes.romance[id]?.arrival] === true)]
    .filter((id, index, all) => id && all.indexOf(id) === index);
  return { present, selected, accepted: selected ? [selected] : [], unresolved: [] };
}

export function selectChapterFourEvening(routes, value, selected = null) {
  return selectStoryEvening(routes, value, chapterFourEveningContext(routes, value, selected));
}

/** 前夜に誘える恋人。同じ場所にいる恋人がちょうど1人で、その人とのデートが成立する時だけ（それ以外は null）。 */
export function chapterFourEveningPartner(routes, value) {
  if (selectChapterFourEvening(routes, value).kind !== "rest") return null;
  const lovers = new Set(value.lovers || []);
  const local = chapterFourEveningContext(routes, value).present.filter(id => lovers.has(id));
  return local.length === 1 && selectChapterFourEvening(routes, value, local[0]).kind === "date" ? local[0] : null;
}

/** 前夜の解決記録（保存用。flags._ch4_evening）。deferred は第3章の茶化し専用なので第4章では常に空。 */
export const chapterFourEveningRecord = result => ({ kind: result.kind, participants: [...result.participants] });
