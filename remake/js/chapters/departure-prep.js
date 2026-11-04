// 遠出する章（第3章の東京・第4章のドバイ）の、出発前に地元で過ごす準備期間（VOL02・2026-11-02 オーナー指示
// 「3も4も14日　ただ遠出する章は3日前に準備期間をあげたい(実質17日)」）。
// 第2章と同じ日常ループ（daily/calendar.js の runDaily）で、地元・橙須と隣町・柚ヶ谷を行き来できる。
// 柚ヶ谷の店は第2章の通い訪問そのもの（神崎・レヰ・あげはの段階会話の続き・締めくくりも読める）。
// 準備の最後の日の夜を越えると出発の朝になり、ループが終わって章の側（出発の場面）へ戻る。
// 保存: 第3章は flags._ch3_prep、第4章は flags._ch4_prep = { startDay, days, step, departed }。日付の数え方は core/chapter-clock.js の departurePrep。
import { state, save, timeOfDay } from "../core/state.js";
import { bgUrl } from "../core/data.js";
import { CH2_CITY_NAME, HOME_CITY_NAME } from "../core/city-locations.js";
import { DEPARTURE_PREP_DAYS } from "../core/chapter-clock.js";
import { runDaily } from "../daily/calendar.js";
import { allSpots } from "../daily/spots.js";
import { trpgSpot } from "../daily/trpg.js";
import { MAP, loadChapterTwoDialogues, loadPreparationDialogues } from "./ch2-city-data.js";
import { CITY_SHOP, knownCityOutings } from "./ch2-outings.js";
import { returnCityHome } from "./ch2-commute.js";
import { PREPARATION_SPOTS, visitPreparationSpot } from "./ch2-preparation.js";

const PREP_KEYS = Object.freeze({ 3: "_ch3_prep", 4: "_ch4_prep" });
export const prepKey = chapter => PREP_KEYS[chapter];

/** 章に入った日を準備の1日目にする。現在地は地元から（第2章の柚ヶ谷を持ち込まない）。 */
export function startDeparturePrep(value) {
  value.flags[prepKey(value.chapter)] = { startDay: value.day, days: DEPARTURE_PREP_DAYS, step: 0, departed: false };
  value.flags._ch2_region = "home";
}

/** 準備期間の記録（無ければ null）。出発後も記録は残る（departed: true）。 */
export const departurePrepRecord = (value = state) => value?.flags?.[prepKey(value.chapter)] || null;

/** 出発の朝の通算日。 */
export const departurePrepEnd = (value = state) => {
  const prep = departurePrepRecord(value);
  return prep ? prep.startDay + prep.days : null;
};

/** 出発の朝に着いたか（ループを抜けた理由が LOAD・中断ではないか）。 */
export const departureMorningReached = (value = state) => {
  const end = departurePrepEnd(value);
  return end !== null && value.day >= end;
};

/** 出発を確定する。以後は準備期間の数え方をしない。 */
export function markDeparted(value = state) {
  const prep = departurePrepRecord(value);
  if (!prep) return false;
  prep.departed = true;
  value.flags._ch2_region = "home";
  return true;
}

const cityRegion = () => [...PREPARATION_SPOTS, CITY_SHOP, ...knownCityOutings(state).filter(spot => spot.kind !== "trpg"), trpgSpot()].filter(Boolean);
const atHome = spot => (spot?.region || "home") === "home";

/**
 * 準備期間の日常ループの章定義。
 * @param opts.destination 行き先の名前（「東京」「ドバイ」）。朝のカードの「〜へ発つ日まで あと◯日」
 * @param opts.nightEvents 通算日 → 夜の予定（daily/night-events.js の形）
 * @param opts.morningEvents 通算日 → { done(), run() }。その日の昼の行動を使う朝の場面（受診など）
 */
export function departurePrepDefinition({ destination, nightEvents = {}, morningEvents = {} }) {
  return {
    get untilDay() { return departurePrepEnd(state); },
    departure: true,
    dayLabel: "出発前",
    tournamentName: `${destination}へ発つ日`,
    nightEvents,
    // 昼の行動を使う朝の場面。読み終えたら昼の行動を使ったことにする（中断・LOADは未読のまま）。
    morningDeparture: async () => {
      const event = morningEvents[state.day];
      if (!event || event.done() || state.slot >= 2) return;
      const owner = state;
      await event.run();
      if (state !== owner || !event.done()) return;
      state.slot = Math.max(state.slot, 1);
      save();
    },
    beforeHomecoming: returnCityHome,
    // 地元の予定の前だけ帰る（第2章と同じ）。
    beforeNightEvent: event => allSpots().some(spot => spot.id === event.pin && atHome(spot)) ? returnCityHome() : true,
    beforeInvitation: destination => destination && atHome(destination) ? returnCityHome() : true,
    mapOptions: () => ({
      regionId: state.flags._ch2_region === "widehanga" ? "widehanga" : "home",
      regions: [
        { id: "home", label: `地元・${HOME_CITY_NAME}`, background: () => bgUrl(`bg_osu_map_${timeOfDay()}`), spots: () => allSpots().filter(spot => spot.kind !== "trpg") },
        { id: "widehanga", label: `隣町・${CH2_CITY_NAME}`, background: () => MAP[timeOfDay()], spots: cityRegion },
      ],
      onRegionChange: id => { state.flags._ch2_region = id; save(); },
    }),
    spotById: id => [...PREPARATION_SPOTS, CITY_SHOP, ...knownCityOutings(state)].find(spot => spot.id === id),
    performSpot: visitPreparationSpot,
  };
}

/** 準備期間を日常ループで回す。出発の朝（または LOAD）で戻る。柚ヶ谷の台本を先に読み込む。 */
export async function runDeparturePrep(opts) {
  await Promise.all([loadChapterTwoDialogues(), loadPreparationDialogues()]);
  state.phase = "daily";
  save();
  await runDaily(departurePrepDefinition(opts));
}
