import { el } from "../core/util.js";
import { state, save } from "../core/state.js";
import { DB, bgUrl } from "../core/data.js";
import { modal, setBg, showScreen } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { CH2_CITY_NAME, HOME_CITY_NAME, HOME_CITY_READING } from "../core/city-locations.js";
import { STATION_FARE, prepareStationTrip } from "../daily/station-travel.js";
import { travelsBetweenCities } from "../core/travel-budget.js";
const regions = [{ id: "home" }, { id: "widehanga" }];

// #3097 PR-B: 行き帰りの電車の小品（台本は data/dialogue/ch2_city.json）。第2章の準備期間に、朝の上り・夜の下りの順に交互に一本ずつ、一日一本まで。
// 切符を買う一文はそのまま残し、続きを小品の台本に差し替える（経験値の付かない場面。運賃・保存の流れは変えない）。
// 読んだ印は台本末尾の旗で、スミさん・つむぎの後日の LIME がその旗を条件にする。
export const COMMUTE_SCENES = Object.freeze([
  { id: "ch2_commute_morning_regulars", leg: "morning", flag: "_ch2_commute_regulars" },
  { id: "ch2_commute_return_tonari", leg: "return", flag: "_ch2_commute_tonari" },
  { id: "ch2_commute_morning_doze", leg: "morning", flag: "_ch2_commute_doze" },
  { id: "ch2_commute_return_window", leg: "return", flag: "_ch2_commute_window" },
]);
const COMMUTE_DAY = "_ch2_commute_day";

/**
 * 今の行き（morning）・帰り（return）で読む小品。並びの次の一本が同じ向きの時だけ。第2章の外・同じ日の二本目・台本が無い時は null。
 * 帰りの小品は夜の電車の場面なので、昼の約束へ向かうために地元へ戻る時（slot 0）は読まない。
 */
export function commuteSceneDue(save, leg, dialogues) {
  if (save?.chapter !== 2 || save.flags?.[COMMUTE_DAY] === save.day || leg === "return" && !(save.slot >= 1)) return null;
  const next = COMMUTE_SCENES.find(scene => !save.flags?.[scene.flag]);
  return next?.leg === leg && dialogues?.[next.id]?.lines?.length ? next.id : null;
}

/** 電車の場面。小品が来ていれば、切符の一文の後に続けて読む。来ていなければ従来の短い場面のまま。 */
function ride(leg, ticket, plain) {
  const id = commuteSceneDue(state, leg, DB.dialogues);
  if (!id) return play(plain);
  state.flags[COMMUTE_DAY] = state.day;
  const scene = DB.dialogues[id];
  return play({ ...scene, lines: [ticket, ...scene.lines] });
}

export function normalizeCommuteState(value) {
  if (value.chapter !== 2 || value.flags._ch2_commute_v1) return;
  // 既に行動中の旧セーブへ、朝の選択を割り込ませない。
  if (value.flags[`_morning_${value.day}`]) value.flags._ch2_morning_departed = value.day;
  // 新ルール前に帰りの運賃を使い切った旧保存は、資産を足さず地元で再開する。
  if (value.flags._ch2_region === "widehanga" && value.money < STATION_FARE) value.flags._ch2_region = "home";
  value.flags._ch2_commute_v1 = true;
}

export async function chooseMorningCity() {
  if (state.flags._ch2_morning_departed === state.day) return;
  const owner = state, day = state.day;
  await setBg(bgUrl("bg_home", "day"), { instant: true });
  if (state !== owner || state.day !== day) return;
  showScreen("home", el("main.ch2-morning-home"));
  const canGo = state.money >= STATION_FARE * 2;
  const destination = await modal({ title: "今日はどこに行こう？", body: `${HOME_CITY_NAME}（${HOME_CITY_READING}）の自宅から出発する。${CH2_CITY_NAME}へは片道200円。帰りの切符代200円も残しておこう。${canGo ? "" : "今は往復分が足りないので、地元で過ごそう。"}`, options: [
    { label: `地元・${HOME_CITY_NAME}へ`, value: "home", test: "ch2-morning-home" },
    ...canGo ? [{ label: `${CH2_CITY_NAME}へ（片道200円）`, value: "widehanga", test: "ch2-morning-city" }] : [],
  ] });
  if (state !== owner || state.day !== day) return;
  if (destination === "widehanga") {
    const trip = prepareStationTrip(state, regions, "widehanga");
    if (!trip?.commit(state, { persist: () => { state.flags._ch2_morning_departed = day; save(); } })) return;
    const ticket = { speaker: "", face: "", text: `片道切符を200円で買い、${CH2_CITY_NAME}行きの電車に乗った。` };
    await ride("morning", ticket, { dialogue_id: "__ch2_morning_train", lines: [ticket] });
  } else {
    state.flags._ch2_region = "home";
    state.flags._ch2_morning_departed = day;
    save();
  }
}

export async function returnCityHome() {
  if (!travelsBetweenCities(state)) return true;
  const owner = state;
  if (state.flags._ch2_region === "widehanga") {
    const trip = prepareStationTrip(state, regions, "home");
    if (!trip?.commit(state, { persist: save })) throw new Error("帰宅の切符代200円が不足しています");
    const ticket = { speaker: "", face: "", text: `${CH2_CITY_NAME}の駅で、${HOME_CITY_NAME}へ戻る片道切符を200円で買った。` };
    const result = await ride("return", ticket, { dialogue_id: "__ch2_return_train", lines: [ticket, { speaker: "hajime", face: "normal", text: "今日もいろいろあったな。家に帰ろう" }] });
    if (state !== owner || !result || result.cancelled) return false;
  }
  await setBg(bgUrl("bg_home", "night"));
  return state === owner;
}

