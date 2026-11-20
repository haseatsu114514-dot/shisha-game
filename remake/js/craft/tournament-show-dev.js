// 大会のショー演出（TSH）を、試合を進めずに見るための開発用の入口。
// コンソールで __remake.dev.show("vote-2") など。※今のセーブを上書きする（main.js の開発用ジャンプと同じ）。
//   vote-1 / vote-2 / vote-3 … 中間投票（票が入る進行）
//   count / count-lose        … 結果発表のカウント（優勝のプチュン／敗北のパリン）
//   final / final-lose        … 最後の投票（3人の最後の回の票 → 千須の最後の1点）
//   champion / lose           … 順位表の前の大見出しと順位表
//   interval                  … 合間のアイキャッチと、中継の枠つきの会話
//   result / result-lose      … カウント → 最後の投票 → 大見出し → 順位表を通しで
import { newGame, state, markMet, config } from "../core/state.js";
import { bgUrl, loadTournamentCraftDialogue } from "../core/data.js";
import { clearScreen, setBg, retireScreen } from "../core/ui.js";
import { showStandings, resultCountdown, suiCutin, resultTable, ch1LiveStandings } from "./result.js";
import { beginCh1Votes, castCh1Votes } from "./ch1-votes.js";
import { newSession } from "./session.js";
import { playTournamentEvent } from "./tournament-story.js";
import { voteStyleFrom } from "../core/vote-style.js";

/** 見本の一台（実際の工程の記録と同じ形）。lose は出来を落として順位を下げる。 */
function sampleCraft(lose) {
  const q = lose ? 0.8 : 1;
  const cs = newSession("tournament");
  return Object.assign(cs, {
    mix: { lemon: 8, mint: 4 }, pack: "fluffy", holes: { score: 93 * q }, heat: { score: 95 * q },
    stats: { aroma: 88 * q, taste: 86 * q, heatStability: 84 * q, burnRisk: 14, draw: 82 * q, smoke: 85 * q, craftQuality: 88 * q, duration: 80 },
    pull: { score: 92 * q, attack: !lose }, pullDone: true, care: { score: 99 * q },
    careHistory: [{ score: 99 * q, attack: !lose }, { score: lose ? 70 : 104, attack: !lose }],
    parts: { holes: 93 * q, heat: 95 * q, shisha: 88 * q, care1: 99 * q, care2: lose ? 70 : 96 }, total: lose ? 74 : 92,
  });
}

export async function playShow(name = "vote-2") {
  const [kind, option] = name.split("-");
  const lose = option === "lose" || kind === "lose";
  newGame();
  // 登場カットインは見せない（演出だけを見る入口なので、紹介済みとして始める）。
  for (const id of ["naru", "adam", "minto", "sui", "maezono", "dr_kemuri", "pakki"]) markMet(id);
  for (const id of ["naru", "adam", "minto", "sui", "maezono", "dr_kemuri", "pakki", "hajime"]) state.flags[`_intro_${id}`] = true;
  Object.assign(state, { phase: "tournament", day: 14 });
  clearScreen();
  const stage = bgUrl("bg_tournament_stage");
  await setBg(stage);
  const cs = sampleCraft(lose), attempt = state.tournament;
  attempt.rulesVersion = 2;
  beginCh1Votes(attempt, { style: voteStyleFrom(config) });
  const castThrough = (rounds) => { for (let round = 0; round < rounds; round++) castCh1Votes(attempt, round, cs); };
  if (kind === "vote") {
    const round = Math.max(1, Math.min(3, Number(option) || 2));
    castThrough(round - 1);
    return showStandings(round, cs.total, cs, attempt);
  }
  if (kind === "interval") {
    await loadTournamentCraftDialogue();
    castThrough(1);
    const standings = ch1LiveStandings(attempt), mine = standings.find((row) => row.me);
    return playTournamentEvent(cs, "interlude1", { bg: stage, live: { event: "SMOKE CROWN CUP", phase: "ROUND 1 終了", standings },
      card: { title: "INTERVAL", sub: "ROUND 1 → ROUND 2", note: `はじめ 現在${mine.rank}位 ・ ${mine.points}pt` } });
  }
  castThrough(4);
  const rank = attempt.voteAttempt.result.rank, outcome = rank === 1 ? "win" : rank <= 3 ? "close" : "lose";
  if (kind === "count" || kind === "result") { await resultCountdown(cs, outcome, attempt); retireScreen(); }
  if (kind === "final" || kind === "result") await suiCutin(rank, attempt);
  if (kind === "count" || kind === "final") return rank;
  return resultTable(cs, rank, attempt);
}
