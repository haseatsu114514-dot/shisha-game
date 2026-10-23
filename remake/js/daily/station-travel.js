// 駅の確定処理。演出や待機より先に、運賃と既存の現在地を一緒に保存する。
export const STATION_FARE = 200;
const CONNECTED_CITIES = new Set(["home", "widehanga"]);

export function stationDestinations(value, regions = [], from = value?.flags?._ch2_region) {
  if (!(value?.chapter >= 2) || !value.flags?._ch2_preparation_started
    || !CONNECTED_CITIES.has(from) || !regions.some(r => r.id === from && r.unlocked !== false)) return [];
  return regions.filter(r => CONNECTED_CITIES.has(r.id) && r.id !== from && r.unlocked !== false);
}

/** 1回の確認画面につき1つ。キャンセル/LOAD/日付変更後の古い確定は使えない。 */
export function prepareStationTrip(value, regions, destination) {
  const from = value?.flags?._ch2_region;
  if (!stationDestinations(value, regions, from).some(r => r.id === destination)) return null;
  const chapter = value.chapter, day = value.day, slot = value.slot;
  let consumed = false;
  return {
    from, to: destination, fare: STATION_FARE,
    cancel() { consumed = true; },
    commit(current, { active = true, persist = () => {} } = {}) {
      if (consumed || !active || current !== value || current.chapter !== chapter
        || current.day !== day || current.slot !== slot || current.flags._ch2_region !== from
        || !stationDestinations(current, regions, from).some(r => r.id === destination)) return false;
      if (!Number.isFinite(current.money) || current.money < STATION_FARE) return false;
      consumed = true;
      // 同期区間。中断後に再開しても、保存済み現在地から再徴収しない。
      current.money -= STATION_FARE;
      current.flags._ch2_region = destination;
      persist();
      return true;
    },
  };
}

/** 将来の独自乗車演出の接続点。料金/保存は完了済み。標準は通常の背景transition。 */
export async function stationArrival(trip, transition) {
  await transition({ from: trip.from, to: trip.to, fare: trip.fare });
}
