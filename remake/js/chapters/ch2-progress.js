// 永続状態の境界。第1章をクリアした状態だけを、一度だけ次章へ進める。
export function advanceToChapterTwo(value) {
  if (!value || value.chapter !== 1 || value.phase !== "cleared") return false;
  value.flags._ch1_cleared = true;
  value.flags._elapsed_calendar = true;
  value.chapter = 2;
  value.day += 1;
  value.slot = 0;
  value.phase = "opening";
  value.statsAtChapterStart = { ...value.stats };
  value.flags._ch2_day1 = { startDay: value.day, stage: "departure", titleSeen: false };
  return true;
}

export function dayOneProgress(value) {
  // 未接続時代の手動ch2保存も既存資産を維持する。読了は推測しない。
  return value.flags._ch2_day1 ||= { startDay: value.day, stage: "departure", titleSeen: false };
}

export function cityVisits(value) {
  const ids = ["ageha", "kumicho", "rei", "c_station"];
  return new Set(ids.filter(id => value.flags[`_ch2_city_visit_${id}`]));
}

export function recordCityVisit(value, id) {
  value.flags[`_ch2_city_visit_${id}`] = true;
  if (id !== "c_station") value.flags._ch2_city_met_shop = true;
}
