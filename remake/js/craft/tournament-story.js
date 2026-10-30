import { play } from "../vn/engine.js";
import { clearComments } from "./broadcast.js";
import { tournamentStoryDialogue } from "./tournament-story-data.js";

// ミニゲームの終了後／開始前にだけ呼ぶ。会話中に動く工程時計は存在しない。
export async function playTournamentEvent(cs, event, options = {}) {
  const story = cs.tournamentStory ||= { seen: [] };
  story.seen ||= [];
  if (story.seen.includes(event)) return true;
  clearComments();
  // context は台本の選択だけに使う（票・在庫は読むだけ）。play には渡さない。
  const { context, ...playOptions } = options;
  const result = await play(tournamentStoryDialogue(cs, event, Math.random, context), playOptions);
  if (!result || result.cancelled) return false;
  story.seen.push(event);
  return true;
}
