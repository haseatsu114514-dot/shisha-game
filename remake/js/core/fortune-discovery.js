// 噂の読了と天候による出店予定。描画・直接入店の判定から予定を動かさない。
export const FORTUNE_RUMOR = "_fortune_rumor_heard";
const supported = s => !!s && [1, 2].includes(s.chapter) && Number.isInteger(s.day) && s.day > 0;
const regular = day => day % 7 === 3 || day % 7 === 6;

/** 朝・日常への復帰・噂の完読時だけ呼ぶ。晴れの出店日を逃した分は持ち越さない。 */
export function syncFortuneSchedule(s, rainy) {
  if (!supported(s) || !s.flags?.[FORTUNE_RUMOR]) return false;
  const old = s.flags._fortune_schedule;
  if (old?.day === s.day) return false;
  const schedule = old || { day: s.day - 1, postponed: null, openDay: null };
  // 旧保存に過去の出店や未読の噂を作らない。明示的な繰越だけを日跨ぎで引き継ぐ。
  for (let day = schedule.day + 1; day <= s.day; day++) {
    const due = regular(day) || schedule.postponed === day;
    schedule.openDay = null;
    if (due) {
      if (rainy(day)) schedule.postponed = day + 1;
      else { schedule.postponed = null; schedule.openDay = day; }
    }
    schedule.day = day;
  }
  s.flags._fortune_schedule = schedule;
  return true;
}

/** 表示と直接入店で共有する、副作用のない日付判定。昼・料金・利用済みは既存の入口が確認する。 */
export function fortunePresent(s, rainy = false) {
  return supported(s) && !!s.flags?.[FORTUNE_RUMOR] && !rainy
    && s.flags._fortune_schedule?.openDay === s.day;
}
