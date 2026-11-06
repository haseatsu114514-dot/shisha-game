import { play } from "../vn/engine.js";
import { clearComments } from "./broadcast.js";
import { tournamentStoryDialogue, tournamentStoryLeadIn } from "./tournament-story-data.js";

// ミニゲームの終了後／開始前にだけ呼ぶ。会話中に動く工程時計は存在しない。
export async function playTournamentEvent(cs, event, options = {}) {
  const story = cs.tournamentStory ||= { seen: [] };
  story.seen ||= [];
  if (story.seen.includes(event)) return true;
  clearComments();
  // context は台本の選択だけに使う（票・在庫は読むだけ）。play には渡さない。
  // onDialogue は本編の台本が決まったところで呼ぶ（第4章の視点の帯・#2688 A20）。
  const { context, onDialogue, ...playOptions } = options;
  // 区切りの実況は別の場面として先に読む（途中で止めたら、次は実況から読み直す）。
  const leadIn = tournamentStoryLeadIn(cs, event);
  if (leadIn) {
    const opened = await play(leadIn, playOptions);
    if (!opened || opened.cancelled) return false;
  }
  const dialogue = tournamentStoryDialogue(cs, event, Math.random, context);
  if (onDialogue) await onDialogue(dialogue);
  const result = await play(dialogue, playOptions);
  if (!result || result.cancelled) return false;
  story.seen.push(event);
  return true;
}
