// つむぎの取材・コンテスト。一章の本筋だけで♥2まで。個別訪問と恋愛の答えは別に残す。
import { state, save } from "../core/state.js";
import { ensureAffinityLevel } from "../core/stats.js";
import { play } from "../vn/engine.js";
import { hasContact } from "../daily/spots.js";
import { TSUMUGI_STORY } from "../daily/tsumugi-schedule.js";
export { TSUMUGI_STORY } from "../daily/tsumugi-schedule.js";

/** 途中の旧セーブでも、未読の場面を実際に読んでから進める。訪問回数から既読を作らない。 */
export async function playTsumugiStory(untilDay, { sketch = null, deferFlags = [] } = {}) {
  if (state.chapter !== 1) return;
  // 過去の交換は覚えるが、新しい取材の話をしたことにはしない。
  if (hasContact("tsumugi")) state.flags._lime_contact_tsumugi = true;
  if (state.met.tsumugi || (state.story.tsumugi || 0) > 0) state.flags._met_tsumugi = true;
  for (const step of TSUMUGI_STORY) {
    if (step.day > untilDay) break;
    // 休養で予定を繰り越した場面は、ロードだけで読了・完了にしない。
    if (!state.flags[step.flag] && deferFlags.includes(step.flag)) break;
    const unread = !state.flags[step.flag];
    if (unread) {
      if (step.dialogue === "ch1_tsumugi_sketch" && sketch) await sketch();
      else await play(step.dialogue);
      state.flags[step.flag] = true;
      state.flags._tsumugi_story_day = `${state.chapter}:${state.day}`;
    }
    const gained = step.level ? ensureAffinityLevel("tsumugi", step.level) : 0;
    hasContact("tsumugi");
    // 再開時の補完も、次の行動を選ぶ前に保存する。
    if (unread || gained) save();
  }
}
