// サメちゃんの恋人絆。旧セーブの高Lvでも、実読了がない前段は飛ばさない。
// 台詞: lover_events.json / 本名・泳ぎの原稿: samechan.json。
import { DB } from "../core/data.js";
import { state, save } from "../core/state.js";
import { gainAffinity, bond } from "../core/stats.js";
import { play, isPlaying } from "../vn/engine.js";

let playing = false;
const stages = [1, 2, 3, 4, 5].map(level => ({ level, id: `lover_samechan_lv${level}` }));
const fragments = { 3: "samechan_future_private_swimming", 4: "samechan_future_private_name" };

/** 恋人として実際に会った私的な場面で読む、最初の未読イベント。 */
export function samechanMilestoneDue() {
  if (!state || (state.chapter || 1) < 2 || !(state.lovers || []).includes("samechan")) return null;
  const next = stages.find(stage => !(state.loverEventsSeen || []).includes(stage.id));
  if (!next || (state.loveLevel.samechan || 1) < next.level || !DB.dialogues[next.id]?.lines?.length) return null;
  // 必要な原稿がない時は止まる。後段へ飛んで秘密や報酬を埋めない。
  const fragment = fragments[next.level];
  if (fragment && !DB.dialogues[fragment]?.lines?.length) return null;
  return next.id;
}

/** 告白成立の読了後/専用デートの読了後。1回の対面につき1場面だけ。 */
export async function playSamechanMilestone() {
  if (playing || isPlaying()) return false;
  const id = samechanMilestoneDue();
  if (!id) return false;
  const owner = state, previousPrivate = bond.private;
  playing = true;
  bond.private = true;
  try {
    await play(id);
    if (state !== owner) return false;
    state.loverEventsSeen.push(id);
    const rewardKey = `_${id}_reward_done`;
    if (!state.flags[rewardKey]) {
      state.flags[rewardKey] = true;
      gainAffinity("samechan", 6); // 共通の恋人補正で通常3P。能力は自動イベントで増やさない。
    }
    save();
    return true;
  } finally {
    bond.private = previousPrivate;
    playing = false;
  }
}
