import { modal } from "../core/ui.js";

export function recordTournamentLoss(tournament) {
  // 同じ敗北画面の再表示では数え直さない。旧セーブの挑戦数から敗北を推測しない。
  if (tournament.lastLossAttempt !== tournament.attempts) {
    tournament.losses = (tournament.losses || 0) + 1;
    tournament.lastLossAttempt = tournament.attempts;
  }
  tournament.retryAssist = false;
}

export const offersRetryAssist = tournament => (tournament.losses || 0) >= 3;

export async function chooseRetryAssist(tournament) {
  tournament.retryAssist = false;
  if (!offersRetryAssist(tournament)) return false;
  const assisted = await modal({
    title: "コンティニュー",
    body: "今回だけ難易度を下げますか？\n針がゆっくり動き、判定が広がります。蒸らしの雑念と、調整中の冷え方も穏やかになります。次の挑戦だけに適用します。",
    options: [
      { label: "今回だけ下げる", value: true, primary: true, test: "retry-assist-yes" },
      { label: "そのまま挑戦する", value: false, test: "retry-assist-no" },
    ],
  });
  tournament.retryAssist = assisted === true;
  return tournament.retryAssist;
}
