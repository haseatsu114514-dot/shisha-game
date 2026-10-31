// 東京の自由時間に地図から選ぶ行き先（#1655）。「訪ねる理由」と結果を持つ一行動。
// DOMを持たない判定と確定。再生・演出は ch3-activities.js が担う。
import { chapterThreeScenes, chapterThreeProgress, completeChapterThreeFreeTime } from "./ch3-progress.js";
import { chapterThreeActivityWindow } from "./ch3-activity-progress.js";
import { tokyoWindowReserved, tokyoGymWindowAllowed } from "../core/tokyo-clock.js";

/**
 * after=この必須場面を読んでから、before=この場面を読む前まで。met=この人物と面識がある時だけ。repeat=自由時間ごとに選べる。
 * stamina は消耗（負）か回復（正）。stat は自分で選び体力を使った行動だけの成長候補。
 * bg は場所の既定と違う背景（裏口＝街の道）。toast は読了後の一言（省略時は結果から決める）。
 */
export const TOKYO_OUTINGS = Object.freeze([
  { id: "mukai_help", place: "mukai", label: "mukaiを手伝う", repeat: true, stamina: -14, money: 6000, stat: "charm",
    reason: { lost: "味が戻るまでは、煙の量と客の顔で手伝える", back: "戻った舌で、客席の調整を任せてもらう" } },
  { id: "enmaku_notes", place: "enmaku", after: "ch3_kuze_first", before: "ch3_kuze_advice", label: "煙幕に顔を出す",
    stamina: -10, stat: "insight", reason: "久世のノートに、何が書いてあるか聞きに行く" },
  { id: "enmaku_answer", place: "enmaku", after: "ch3_kuze_advice", label: "煙幕に顔を出す",
    stamina: -10, stat: "sense", reason: "どうしたいか、久世に答えを返しに行く" },
  // スティーブがmukaiへ客として来る（#1696）。タイマー越しに香りの山を逃す癖と、全国へ来た理由。店を訪ねる前だけ。
  { id: "mukai_steve", place: "mukai", before: "ch3_steve_low_heat", met: "steve", label: "mukaiで店番をする",
    stamina: -8, money: 3000, stat: "insight", reason: "配達先のスティーブが、今日は客として来るらしい" },
  { id: "steve_timer", place: "steve", after: "ch3_steve_low_heat", label: "Smoke & Glory に寄る",
    stamina: -10, stat: "technique", reason: "タイマーを置く場所を、もう一度見せてもらう" },
  { id: "park_walk", place: "park", label: "公園を歩く", repeat: true, stamina: 20,
    reason: "何も決めずに歩いて、少し体を休める" },
  // mukaiの看板猫てつこ（#1993）。撫でるか餌をあげるかを選び、体力だけ少し戻す。能力・好感度は増やさない。
  { id: "tetsuko", place: "mukai", label: "裏口のてつこに会う", repeat: true, stamina: 12, bg: "bg_street",
    toast: "てつこに、少し元気をもらった", reason: "裏口のベンチで、看板猫のてつこを構う" },
]);
export const OUTINGS_FLAG = "_ch3_outings";
const RECOVERY_SCENE = "ch3_taste_return";

/** 台本ID。手伝いは味が戻る前後、公園は昼夜で読み分ける。 */
export function outingDialogueId(value, outing, window = null) {
  if (outing.id === "mukai_help") return tasteRecovered(value) ? "ch3_outing_mukai_help" : "ch3_outing_mukai_help_lost";
  if (outing.id === "park_walk") return (window?.slot ?? value.slot) ? "ch3_outing_park_walk_night" : "ch3_outing_park_walk_day";
  return `ch3_outing_${outing.id}`;
}
export const OUTING_DIALOGUE_IDS = Object.freeze(["ch3_outing_mukai_help_lost", "ch3_outing_mukai_help",
  "ch3_outing_enmaku_notes", "ch3_outing_enmaku_answer", "ch3_outing_mukai_steve", "ch3_outing_steve_timer",
  "ch3_outing_park_walk_day", "ch3_outing_park_walk_night", "ch3_outing_tetsuko"]);

const readScene = (value, id) => {
  const index = chapterThreeScenes(value).findIndex(scene => scene.id === id);
  return index >= 0 && chapterThreeProgress(value).stage > index;
};
export const tasteRecovered = value => readScene(value, RECOVERY_SCENE);

export function outingCounts(value) {
  const record = value?.flags?.[OUTINGS_FLAG];
  return record && typeof record === "object" && !Array.isArray(record) ? record : {};
}

export const outingReason = (value, outing) => typeof outing.reason === "string" ? outing.reason
  : outing.reason[tasteRecovered(value) ? "back" : "lost"];

/** 物語の時点で行ける行き先。自由時間かどうか・体力は見ない（案内の候補に使う）。 */
export function chapterThreeOutingCandidates(value) {
  if (value?.chapter !== 3 || !value.flags?._ch3_intro) return [];
  const counts = outingCounts(value);
  return TOKYO_OUTINGS.filter(outing => (!outing.after || readScene(value, outing.after))
    && (!outing.before || !readScene(value, outing.before))
    && (!outing.met || !!value.met?.[outing.met])
    && (outing.repeat || !counts[outing.id]));
}

/** 今の自由時間で選べるか。読取のみで保存を変えない。 */
export function chapterThreeOutings(value, windowId) {
  const window = chapterThreeActivityWindow(value, windowId);
  if (!window || tokyoWindowReserved(value, window) || !tokyoGymWindowAllowed(value, window)) return [];
  return chapterThreeOutingCandidates(value).map(outing => ({ ...outing, window,
    reasonText: outingReason(value, outing),
    ok: outing.stamina >= 0 || value.stamina > 0,
    why: outing.stamina < 0 && !(value.stamina > 0) ? "体力が残っていない。今日は休もう。" : "" }));
}

/** 読了後の同期的な確定境界。自由時間を一つ閉じ、回数を記録する。主筋stageは進めない。 */
export function claimChapterThreeOuting(value, windowId, id) {
  const outing = chapterThreeOutings(value, windowId).find(item => item.id === id);
  if (!outing?.ok || !completeChapterThreeFreeTime(value, windowId)) return null;
  value.flags[OUTINGS_FLAG] = { ...outingCounts(value), [id]: (outingCounts(value)[id] || 0) + 1 };
  return outing;
}
