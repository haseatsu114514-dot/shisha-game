import { modal } from "../core/ui.js";
import { retryAssistLevelFor, RETRY_ASSIST_MAX_LEVEL, RETRY_ASSIST_LOSSES_PER_LEVEL } from "../craft/retry-assist-level.js";

export function recordTournamentLoss(tournament) {
  // 同じ敗北画面の再表示では数え直さない。旧セーブの挑戦数から敗北を推測しない。
  if (tournament.lastLossAttempt !== tournament.attempts) {
    tournament.losses = (tournament.losses || 0) + 1;
    tournament.lastLossAttempt = tournament.attempts;
  }
  tournament.retryAssist = false;
}

export const offersRetryAssist = tournament => retryAssistLevelFor(tournament.losses) > 0;

/** 段に応じた問いの本文。3敗ごとに一段ずつ下がり、いちばん下の段ではそれ以上下がらないと伝える。 */
export function retryAssistBody(level) {
  const step = level >= RETRY_ASSIST_MAX_LEVEL ? "いちばん下の段で、針が最もゆっくり、判定が最も広くなります。"
    : level > 1 ? "前の段より針がゆっくり動き、判定が広がります。" : "針がゆっくり動き、判定が広がります。";
  const next = level < RETRY_ASSIST_MAX_LEVEL ? `${RETRY_ASSIST_LOSSES_PER_LEVEL}回負けるごとに、もう一段下げられます。` : "";
  return `今回だけ難易度を下げますか？（${level}段目／${RETRY_ASSIST_MAX_LEVEL}段まで）\n${step}蒸らしの雑念と調整中の冷え方も穏やかになり、体力も最大まで回復します。${next}`;
}

export async function chooseRetryAssist(tournament, isCurrent = () => true) {
  if (!isCurrent()) return null;
  const attempt = tournament.attempts;
  tournament.retryAssist = false;
  if (!offersRetryAssist(tournament)) return false;
  const assisted = await modal({
    title: "コンティニュー",
    body: retryAssistBody(retryAssistLevelFor(tournament.losses)),
    options: [
      { label: "今回だけ下げる", value: true, primary: true, test: "retry-assist-yes" },
      { label: "そのまま挑戦する", value: false, test: "retry-assist-no" },
      { label: "選択に戻る", value: null, test: "retry-assist-cancel" },
    ],
  });
  if (!isCurrent() || tournament.attempts !== attempt) return null;
  if (assisted !== true && assisted !== false) return null;
  tournament.retryAssist = assisted === true;
  return tournament.retryAssist;
}
