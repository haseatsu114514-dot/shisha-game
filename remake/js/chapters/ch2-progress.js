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

// オーナー承認: DAY8夜だけサメがTRPGに参加できる。通常の勤務や入部条件は変えない。
// 既存保存の明示的な個別予定を上書きせず、再開しても同じ予定を重複登録しない。
export function scheduleChapterTwoTrpgNight(value, startDay) {
  if (value?.chapter !== 2 || !Number.isInteger(startDay) || startDay < 1
    || value.day > startDay + 7 || !value.trpg) return false;
  const shifts = value.trpg.shifts ||= [];
  const day = startDay + 7;
  if (shifts.some(shift => shift.id === "samechan" && shift.chapter === 2 && shift.day === day && shift.slot === 1)) return false;
  shifts.push({ id: "samechan", chapter: 2, day, slot: 1, busy: false });
  return true;
}

export function cityVisits(value) {
  const ids = ["ageha", "kumicho", "rei", "c_station"];
  return new Set(ids.filter(id => value.flags[`_ch2_city_visit_${id}`]));
}

export function recordCityVisit(value, id) {
  value.flags[`_ch2_city_visit_${id}`] = true;
  if (id !== "c_station") value.flags._ch2_city_met_shop = true;
}
