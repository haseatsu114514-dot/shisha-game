// 第4章ドバイの水着回（SPC18・Issue #3657）。前夜祭の日の夕方、来てくれた人たちと宿の裏の砂浜へ行く（任意で一度）。
// 顔ぶれ・出せる時・確定だけを持つ（DOMを持たない）。再生とボタンは ch4.js の renderBeach。
// - 顔ぶれは「その場に実際にいる人」だけ: 同行者（同じ便）、到着場面を読んだ別便の人（恋人版・友人版のどちらでも）、
//   会ったことのあるヌール（ドバイに住む）。好感度・渡航予定・同行の選択だけでは足さない（location_contract）。
// - 恋人かどうかでセリフは変えない。仲間の遊びとして描き、前夜の過ごし方・修羅場には数えない（present を書き換えない）。
// - 人数で尺が変わらないよう、遊べるのは CH4_BEACH_PICKS か所まで（顔ぶれが少なければ全員）。好感度・能力は付けない。
import { OVERSEAS_HEROINES, overseasCompanion } from "../core/overseas-companion.js";
import { chapterFourProgress, chapterFourArrivalsDue, CH4_ARRIVAL_SCENES, CH4_FRIEND_ARRIVAL_SCENES,
  CH4_FESTIVAL_STARTED } from "./ch4-progress.js";

/** ドバイに住んでいて、会ったことがあれば砂浜に来る人。並びは渡航してきた人の後ろ。 */
export const CH4_BEACH_RESIDENTS = Object.freeze(["noor"]);
export const CH4_BEACH_SCENES = Object.freeze({
  open: "ch4_beach_open",
  close: "ch4_beach_close",
  people: Object.freeze({
    tsumugi: "ch4_beach_tsumugi", minto: "ch4_beach_minto", rio: "ch4_beach_rio", ageha: "ch4_beach_ageha",
    mashiro: "ch4_beach_mashiro", samechan: "ch4_beach_samechan", hiyori: "ch4_beach_hiyori", noor: "ch4_beach_noor",
  }),
});
/** 台本の読み込み対象（ch4.js が FILES に使う）。 */
export const CH4_BEACH_SCENE_FILES = Object.freeze({
  ch4_beach: Object.freeze([CH4_BEACH_SCENES.open, ...Object.values(CH4_BEACH_SCENES.people), CH4_BEACH_SCENES.close]),
});
/** 砂浜の背景。専用の絵（ドバイの砂浜）が届くまでは、モスクの見える水辺の夕方を仮に使う。 */
export const CH4_BEACH_BG = "bg_dubai_map_dusk";
/** 砂浜で遊べる回数（顔ぶれが少なければ全員）。 */
export const CH4_BEACH_PICKS = 3;
const KEY = "_ch4_beach";

/** 今、砂浜にいる人（OVERSEAS_HEROINES の順、その後にドバイに住む人）。状態は変えない。 */
export function chapterFourBeachCast(value) {
  const { read } = chapterFourProgress(value);
  const { companion, supports } = overseasCompanion(value);
  const arrived = id => read[CH4_ARRIVAL_SCENES[id]] === true || read[CH4_FRIEND_ARRIVAL_SCENES[id]] === true;
  const travelers = OVERSEAS_HEROINES.filter(id => (companion && id === companion) || (supports.includes(id) && arrived(id)));
  const residents = CH4_BEACH_RESIDENTS.filter(id => !!value?.met?.[id]);
  return [...travelers, ...residents];
}

/** 遊べる回数。顔ぶれが CH4_BEACH_PICKS より少なければ全員。 */
export const chapterFourBeachPickCount = value => Math.min(CH4_BEACH_PICKS, chapterFourBeachCast(value).length);

/** 済ませた記録（{ picks }）。無ければ null。 */
export function chapterFourBeachRecord(value) {
  const raw = value?.flags?.[KEY];
  return raw && typeof raw === "object" && Array.isArray(raw.picks) ? { picks: [...raw.picks] } : null;
}

/**
 * 砂浜へ行けるか。前夜の part の間、別便の到着を読み終えた後、前夜祭が始まる前、前夜の過ごし方を記録する前、
 * まだ行っていない時だけ。誰もいなければ出さない。大会の後には出さない（任意なので、行かずに進めばそのまま）。
 */
export function chapterFourBeachDue(value) {
  const progress = chapterFourProgress(value);
  if (progress.part !== "eve" || value?.flags?._ch4_evening || chapterFourBeachRecord(value)
    || CH4_FESTIVAL_STARTED.some(id => progress.read[id] === true) || chapterFourArrivalsDue(value).length) return false;
  return chapterFourBeachCast(value).length > 0;
}

/**
 * 遊んだ相手を確定する唯一の入口（最後まで読んだ時だけ ch4.js が呼ぶ）。
 * 相手は今の顔ぶれから重ならずに、ちょうど遊べる回数だけ。好感度・能力・お金・日付・前夜の記録は変えない。
 */
export function commitChapterFourBeach(value, picks) {
  if (!chapterFourBeachDue(value)) return false;
  const cast = chapterFourBeachCast(value);
  const valid = Array.isArray(picks) && picks.length === chapterFourBeachPickCount(value)
    && new Set(picks).size === picks.length && picks.every(id => cast.includes(id));
  if (!valid) return false;
  value.flags[KEY] = { picks: [...picks] };
  return true;
}
