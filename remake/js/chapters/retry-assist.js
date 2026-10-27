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

export async function chooseRetryAssist(tournament, isCurrent = () => true) {
  if (!isCurrent()) return null;
  const attempt = tournament.attempts;
  tournament.retryAssist = false;
  if (!offersRetryAssist(tournament)) return false;
  const assisted = await modal({
    title: "コンティニュー",
    body: "今回だけ難易度を下げますか？\n針がゆっくり動き、判定が広がります。蒸らしの雑念と、調整中の冷え方も穏やかになります。体力も最大まで回復します。次の挑戦だけに適用します。",
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
