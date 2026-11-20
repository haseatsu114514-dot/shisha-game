import { play } from "../vn/engine.js";
import { layers } from "../core/ui.js";
import { clearComments } from "./broadcast.js";
import { tournamentStoryDialogue, tournamentStoryLeadIn } from "./tournament-story-data.js";
import { liveFrame, eyecatch } from "./tournament-show.js";

/**
 * 大会の会場での会話。中継の枠（LIVE の帯・いまの順位・舞台の光）を付けて読む（TSH04）。枠は会話の間だけ出す。
 * @param options.live 枠の中身 { event, phase, standings }、またはそれを返す関数。無ければ今までどおりの会話
 */
export async function playLive(dialogue, { live = null, ...options } = {}) {
  const frame = typeof live === "function" ? live() : live;
  // 会話レイヤーの組み立ては play() の中で済む（初回の会話で作り直される）。枠はその後に足す。
  const reading = play(dialogue, options);
  const stop = frame ? liveFrame(layers.vn, frame) : null;
  try { return await reading; } finally { stop?.(); }
}

// ミニゲームの終了後／開始前にだけ呼ぶ。会話中に動く工程時計は存在しない。
export async function playTournamentEvent(cs, event, options = {}) {
  const story = cs.tournamentStory ||= { seen: [] };
  story.seen ||= [];
  if (story.seen.includes(event)) return true;
  clearComments();
  // context は台本の選択だけに使う（票・在庫は読むだけ）。play には渡さない。
  // card は合間のアイキャッチ（{ title, sub, note }）。まだ読んでいない掛け合いの前にだけ出す。
  const { context, card = null, ...playOptions } = options;
  if (card && !playOptions.signal?.aborted) await eyecatch(layers.fx, card);
  // 区切りの実況は別の場面として先に読む（途中で止めたら、次は実況から読み直す）。
  const leadIn = tournamentStoryLeadIn(cs, event);
  if (leadIn) {
    const opened = await playLive(leadIn, playOptions);
    if (!opened || opened.cancelled) return false;
  }
  const result = await playLive(tournamentStoryDialogue(cs, event, Math.random, context), playOptions);
  if (!result || result.cancelled) return false;
  story.seen.push(event);
  return true;
}
