import { el } from "../core/util.js";
import { state, save } from "../core/state.js";
import { DB, bgUrl } from "../core/data.js";
import { modal, setBg, showScreen, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { CH2_CITY_NAME, HOME_CITY_NAME } from "../core/city-locations.js";
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

function rideToYuzugaya() {
  const ticket = { speaker: "", face: "", text: `片道切符を200円で買い、${CH2_CITY_NAME}行きの電車に乗った。` };
  return ride("morning", ticket, { dialogue_id: "__ch2_morning_train", lines: [ticket] });
}

/** 朝の街選択を省いた日も、昼に駅から出れば従来の電車の小品を読める。 */
export async function readMorningStationCommute({ to }) {
  if (to !== "widehanga" || state.slot !== 0 || !(state.flags._ch2_stay_local_since < state.day)) return;
  if (!commuteSceneDue(state, "morning", DB.dialogues)) return;
  const owner = state;
  const result = await rideToYuzugaya();
  if (state === owner && result && !result.cancelled) save();
}

export async function chooseMorningCity(morningNotices = () => []) {
  if (state.flags._ch2_morning_departed === state.day) return;
  const owner = state, day = state.day;
  const home = state.flags._ch2_region === "home";
  const canGo = state.money >= STATION_FARE * 2;
  const sameCity = home && state.flags._ch2_last_yuzugaya_day === day - 1;
  const notices = sameCity ? morningNotices() : [];
  const shortcut = sameCity && canGo && state.slot === 0 && !notices.length
    && !commuteSceneDue(state, "morning", DB.dialogues);
  if (home && state.flags._ch2_stay_local_since < day && !shortcut) {
    state.flags._ch2_morning_departed = day;
    save();
    return;
  }
  await setBg(bgUrl("bg_home", "day"), { instant: true });
  if (state !== owner || state.day !== day) return;
  showScreen("home", el("main.ch2-morning-home"));
  const fareNotice = `${CH2_CITY_NAME}へは片道200円。帰りの切符代も200円必要。${canGo ? "" : "今は往復分が足りない。"}`;
  const localNotice = `${CH2_CITY_NAME}へは地元の地図の駅からも行ける。`;
  const destination = await modal({ title: "今日はどこに行こう？", body: [
    ...notices, shortcut ? "帰りの切符代も200円必要。" : fareNotice + localNotice,
  ].join("<br>"), options: [
    { label: `地元・${HOME_CITY_NAME}で過ごす`, value: "home", test: "ch2-morning-home" },
    ...canGo ? [{
      label: shortcut ? `前回と同じ街・${CH2_CITY_NAME}へ（片道200円）` : `${CH2_CITY_NAME}へ（片道200円）`,
      value: "widehanga", primary: shortcut, test: shortcut ? "ch2-morning-repeat" : "ch2-morning-city",
    }] : [],
  ] });
  if (state !== owner || state.day !== day) return;
  if (destination === "widehanga") {
    const trip = prepareStationTrip(state, regions, "widehanga");
    if (!trip?.commit(state, { persist: () => {
      state.flags._ch2_morning_departed = day;
      state.flags._ch2_last_yuzugaya_day = day;
      save();
    } })) return;
    if (!shortcut) await rideToYuzugaya();
  } else {
    state.flags._ch2_region = "home";
    state.flags._ch2_stay_local_since = day;
    state.flags._ch2_morning_departed = day;
    save();
  }
}

export async function returnCityHome() {
  if (!travelsBetweenCities(state)) return true;
  const owner = state;
  let walked = false;
  if (state.flags._ch2_region === "widehanga") {
    const trip = prepareStationTrip(state, regions, "home");
    if (!trip) return false;
    walked = trip.walkable();
    if (!trip.commit(state, { persist: save, walk: walked })) return false;
    if (!walked) {
      const ticket = { speaker: "", face: "", text: `${CH2_CITY_NAME}の駅で、${HOME_CITY_NAME}へ戻る片道切符を200円で買った。` };
      const result = await ride("return", ticket, { dialogue_id: "__ch2_return_train", lines: [ticket, { speaker: "hajime", face: "normal", text: "今日もいろいろあったな。家に帰ろう" }] });
      if (state !== owner || !result || result.cancelled) return false;
    }
  }
  await setBg(bgUrl("bg_home", "night"));
  if (state !== owner) return false;
  if (walked) toast(`歩いて${HOME_CITY_NAME}へ帰った。かなり疲れた`);
  return true;
}

