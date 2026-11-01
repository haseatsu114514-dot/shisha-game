// 場面カードの章は時計の進行を各runnerが持つ。再表示や旧セーブの再開では夜を作らない。
import { state } from "./state.js";
import { presentNight } from "./growth.js";

export async function chapterGrowthNight(owner, isCurrent, options = {}) {
  if (!isCurrent()) return false;
  const previousDay = owner.growthDay ?? state.day;
  owner.growthDay = state.day;
  if (state.day > previousDay) {
    await presentNight(options);
    if (!isCurrent()) return false;
  }
  return true;
}
