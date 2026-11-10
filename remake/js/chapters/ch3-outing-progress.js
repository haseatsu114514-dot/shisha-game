// 東京の自由時間に地図から選ぶ行き先（#1655）。「訪ねる理由」と結果を持つ一行動。
// DOMを持たない判定と確定。再生・演出は ch3-activities.js が担う。
import { chapterThreeScenes, chapterThreeProgress, completeChapterThreeFreeTime } from "./ch3-progress.js";
import { chapterThreeActivityWindow } from "./ch3-activity-progress.js";
import { tokyoWindowReserved, tokyoGymWindowAllowed } from "../core/tokyo-clock.js";
import { visitAffinity } from "../core/stats.js";

/**
 * after=この必須場面を読んでから、before=この場面を読む前まで。met=この人物と面識がある時だけ。repeat=自由時間ごとに選べる。
 * stamina は消耗（負）か回復（正）。stat は自分で選び体力を使った行動だけの成長候補。
 * affinityWith は任意の外出で好感度が付く相手。台本には報酬行を置かず、確定時に outingAffinity で付ける。
 * talks は通うたびに読む台本（1回目は先頭、2回目からは残りを巡回）。reasonAgain は2回目からの理由。
 * regular は通いの行き先。同じ場所に一度きりの行き先がある間は出さない（そちらを先に読む）。
 * bg は場所の既定と違う背景（裏口＝街の道）。toast は読了後の一言（省略時は結果から決める）。
 *
 * 好感度のつり合い（2026-11-02 オーナー指定・台帳 AFB02）: 第3章でも、ライバル3人のうち2人を多少寄り道しても
 * ♥5にできるように、綾取の煙幕とスティーブ（客として来るmukai・Smoke & Glory）に何度でも通える。値は第1・2章と同じ
 * visitAffinity（一度きりの話と通いの1回目は段階会話の +16、通いの2回目からは小会話の +8）。本筋の場面には付けない。
 */
export const TOKYO_OUTINGS = Object.freeze([
  { id: "mukai_help", place: "mukai", label: "mukaiを手伝う", repeat: true, stamina: -14, money: 6000, stat: "charm",
    reason: { lost: "味が戻るまでは、煙の量と客の顔で手伝える", back: "戻った舌で、客席の調整を任せてもらう" } },
  // 綾取の好感度は煙幕への外出で付く（#2028・AFB02）。♥1でLIME交換の任意場面が開く（ch3-story-wiring.js）。
  { id: "enmaku_notes", place: "enmaku", after: "ch3_saku_first", before: "ch3_saku_advice", label: "煙幕に顔を出す",
    stamina: -10, stat: "insight", affinityWith: "saku", reason: "綾取のノートに、何が書いてあるか聞きに行く" },
  { id: "enmaku_answer", place: "enmaku", after: "ch3_saku_advice", label: "煙幕に顔を出す",
    stamina: -10, stat: "sense", affinityWith: "saku", reason: "どうしたいか、綾取に答えを返しに行く" },
  // 煙幕に通う（AFB02）。一度きりの話を読み終えてから、何度でも寄れる。
  { id: "enmaku_visit", place: "enmaku", after: "ch3_saku_first", label: "煙幕で一服する", repeat: true, regular: true,
    talks: ["ch3_outing_enmaku_visit", "ch3_outing_enmaku_visit_b", "ch3_outing_enmaku_visit_c", "ch3_outing_enmaku_visit_d"],
    stamina: -10, stat: "insight", affinityWith: "saku", reason: "綾取の店で、少し一緒に過ごす" },
  // スティーブがmukaiへ客として来る（#1696）。タイマー越しに香りの山を逃す癖と、全国へ来た理由。店を訪ねる前まで
  // 何度でも来る（AFB02。2回目からは合図を試す回と、客の顔の回を交互）。
  { id: "mukai_steve", place: "mukai", before: "ch3_steve_low_heat", met: "steve", label: "mukaiで店番をする", repeat: true,
    talks: ["ch3_outing_mukai_steve", "ch3_outing_mukai_steve_b", "ch3_outing_mukai_steve_c"],
    stamina: -8, money: 3000, stat: "insight", affinityWith: "steve",
    reason: "配達先のスティーブが、今日は客として来るらしい", reasonAgain: "スティーブが、また客として来るらしい" },
  // 味の会話（#2028）。マウンテンミストを低い熱で待つ一台。
  { id: "steve_timer", place: "steve", after: "ch3_steve_low_heat", label: "Smoke & Glory に寄る",
    stamina: -10, stat: "technique", affinityWith: "steve", reason: "タイマーを置く場所を、もう一度見せてもらう" },
  // Smoke & Glory に通う（AFB02）。味の会話の後に、何度でも寄れる。
  { id: "steve_visit", place: "steve", after: "ch3_steve_low_heat", label: "Smoke & Glory で一服する", repeat: true, regular: true,
    talks: ["ch3_outing_steve_visit", "ch3_outing_steve_visit_b", "ch3_outing_steve_visit_c"],
    stamina: -10, stat: "technique", affinityWith: "steve", reason: "スティーブの店で、少し一緒に過ごす" },
  { id: "park_walk", place: "park", label: "公園を歩く", repeat: true, stamina: 20,
    reason: "何も決めずに歩いて、少し体を休める" },
  // mukaiの看板猫てつこ（#1993）。体力だけ少し戻す。能力・好感度は増やさない。
  // 通うほど懐いていく（2026-11-02 オーナー「てつこは店の裏で世話したい」）: 素っ気ない→ブラシ→待っている→自分から寄ってくる、
  // その後は懐いた後の場面を巡回する（stages の順に読み、尽きたら loop を回す）。
  { id: "tetsuko", place: "mukai", label: "裏口のてつこに会う", repeat: true, stamina: 12, bg: "bg_street",
    stages: ["ch3_outing_tetsuko", "ch3_outing_tetsuko_brush", "ch3_outing_tetsuko_wait", "ch3_outing_tetsuko_trust"],
    loop: ["ch3_outing_tetsuko_lap", "ch3_outing_tetsuko_belly", "ch3_outing_tetsuko_door"],
    toast: "てつこに、少し元気をもらった", reason: "裏口のベンチで、看板猫のてつこを構う" },
]);
export const OUTINGS_FLAG = "_ch3_outings";
const RECOVERY_SCENE = "ch3_taste_return";

/** 台本ID。手伝いは味が戻る前後、公園は昼夜、通う行き先は回数で読み分ける。 */
export function outingDialogueId(value, outing, window = null) {
  if (outing.stages?.length) {
    const count = outingCounts(value)[outing.id] || 0;
    return count < outing.stages.length ? outing.stages[count] : outing.loop[(count - outing.stages.length) % outing.loop.length];
  }
  if (outing.talks?.length) {
    const count = outingCounts(value)[outing.id] || 0;
    return count === 0 || outing.talks.length === 1 ? outing.talks[0] : outing.talks[1 + (count - 1) % (outing.talks.length - 1)];
  }
  if (outing.id === "mukai_help") return tasteRecovered(value) ? "ch3_outing_mukai_help" : "ch3_outing_mukai_help_lost";
  if (outing.id === "park_walk") {
    const base = `ch3_outing_park_walk_${(window?.slot ?? value.slot) ? "night" : "day"}`;
    const count = outingCounts(value)[outing.id] || 0;
    // 初回の散歩は残し、再訪は昼夜それぞれの小さな日常2本を巡回する（#3097）。
    return count ? `${base}_${count % 2 ? "b" : "c"}` : base;
  }
  return `ch3_outing_${outing.id}`;
}
export const OUTING_DIALOGUE_IDS = Object.freeze(["ch3_outing_mukai_help_lost", "ch3_outing_mukai_help",
  "ch3_outing_enmaku_notes", "ch3_outing_enmaku_answer", "ch3_outing_mukai_steve", "ch3_outing_steve_timer",
  "ch3_outing_park_walk_day", "ch3_outing_park_walk_night", "ch3_outing_tetsuko",
  "ch3_outing_tetsuko_brush", "ch3_outing_tetsuko_wait", "ch3_outing_tetsuko_trust",
  "ch3_outing_tetsuko_lap", "ch3_outing_tetsuko_belly", "ch3_outing_tetsuko_door",
  "ch3_outing_enmaku_visit", "ch3_outing_enmaku_visit_b", "ch3_outing_enmaku_visit_c",
  "ch3_outing_mukai_steve_b", "ch3_outing_mukai_steve_c", "ch3_outing_steve_visit", "ch3_outing_steve_visit_b",
  "ch3_outing_enmaku_visit_d", "ch3_outing_steve_visit_c",
  ...["day", "night"].flatMap(time => ["b", "c"].map(suffix => `ch3_outing_park_walk_${time}_${suffix}`))]);

/**
 * この外出で付く好感度（人物ID→pt。確定の前に呼ぶ）。一度きりの話と通いの1回目は段階会話、通いの2回目からは小会話（AFB02）。
 */
export function outingAffinity(value, outing) {
  if (!outing?.affinityWith) return {};
  const again = !!outing.talks && (outingCounts(value)[outing.id] || 0) > 0;
  return { [outing.affinityWith]: visitAffinity(again ? "talk" : "story", value) };
}

const readScene = (value, id) => {
  const index = chapterThreeScenes(value).findIndex(scene => scene.id === id);
  return index >= 0 && chapterThreeProgress(value).stage > index;
};
export const tasteRecovered = value => readScene(value, RECOVERY_SCENE);

export function outingCounts(value) {
  const record = value?.flags?.[OUTINGS_FLAG];
  return record && typeof record === "object" && !Array.isArray(record) ? record : {};
}

export const outingReason = (value, outing) => outing.reasonAgain && outingCounts(value)[outing.id] ? outing.reasonAgain
  : typeof outing.reason === "string" ? outing.reason : outing.reason[tasteRecovered(value) ? "back" : "lost"];

/** 物語の時点で行ける行き先。自由時間かどうか・体力は見ない（案内の候補に使う）。 */
export function chapterThreeOutingCandidates(value) {
  if (value?.chapter !== 3 || !value.flags?._ch3_intro) return [];
  const counts = outingCounts(value);
  const open = TOKYO_OUTINGS.filter(outing => (!outing.after || readScene(value, outing.after))
    && (!outing.before || !readScene(value, outing.before))
    && (!outing.met || !!value.met?.[outing.met])
    && (outing.repeat || !counts[outing.id]));
  // 通いの行き先は、同じ場所の一度きりの話を読み終えてから（読める話がある間はそちらだけ）。
  return open.filter(outing => !outing.regular || !open.some(other => other.place === outing.place && !other.repeat));
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

