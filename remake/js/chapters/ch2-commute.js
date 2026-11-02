import { el } from "../core/util.js";
import { state, save } from "../core/state.js";
import { bgUrl } from "../core/data.js";
import { modal, setBg, showScreen } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { CH2_CITY_NAME, HOME_CITY_NAME, HOME_CITY_READING } from "../core/city-locations.js";
import { STATION_FARE, prepareStationTrip } from "../daily/station-travel.js";
import { travelsBetweenCities } from "../core/travel-budget.js";
const regions = [{ id: "home" }, { id: "widehanga" }];

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
    await play({ dialogue_id: "__ch2_morning_train", lines: [{ speaker: "", face: "", text: `片道切符を200円で買い、${CH2_CITY_NAME}行きの電車に乗った。` }] });
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
    const result = await play({ dialogue_id: "__ch2_return_train", lines: [{ speaker: "", face: "", text: `${CH2_CITY_NAME}の駅で、${HOME_CITY_NAME}へ戻る片道切符を200円で買った。` }, { speaker: "hajime", face: "normal", text: "今日もいろいろあったな。家に帰ろう" }] });
    if (state !== owner || !result || result.cancelled) return false;
  }
  await setBg(bgUrl("bg_home", "night"), { instant: true });
  return state === owner;
}

