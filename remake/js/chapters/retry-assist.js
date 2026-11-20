import { modal } from "../core/ui.js";
import { retryAssistLevelFor, RETRY_ASSIST_LOSSES_PER_LEVEL } from "../craft/retry-assist-level.js";

export function recordTournamentLoss(tournament) {
  // 同じ敗北画面の再表示では数え直さない。旧セーブの挑戦数から敗北を推測しない。
  if (tournament.lastLossAttempt !== tournament.attempts) {
    tournament.losses = (tournament.losses || 0) + 1;
    tournament.lastLossAttempt = tournament.attempts;
  }
  tournament.retryAssist = false;
  tournament.retryAssistLevel = 0;
}

export const offersRetryAssist = tournament => retryAssistLevelFor(tournament.losses) > 0;

const EASY = "イージー：針がゆっくり動き、判定が広がります。";
const VERY_EASY = "ベリーイージー：針がとてもゆっくり動き、判定が大きく広がります。";
const SHARED = "蒸らしの雑念と調整中の冷え方も穏やかになり、体力も最大まで回復します。";
const BR = "<br>"; // 本文は HTML として入る（core/ui.js の modal）。行ごとに改行する

/** 選べる段に応じた問いの本文。3敗でイージー、6敗でベリーイージーも選べる（WIN13）。 */
export function retryAssistBody(level, losses = 0) {
  if (level >= 2) return ["今回だけ難易度を下げますか？", EASY, VERY_EASY, `どちらも${SHARED.replace("も穏やか", "が穏やか")}`].join(BR);
  const more = Math.max(1, RETRY_ASSIST_LOSSES_PER_LEVEL * 2 - (Number(losses) || 0));
  return ["今回だけ難易度を下げますか？", `${EASY}${SHARED}`, `あと${more}回負けると、ベリーイージーも選べます。`].join(BR);
}

/** 選べる段の選択肢。いちばんやさしい段を先頭（決定キー）に置く。 */
export function retryAssistOptions(level) {
  return [
    ...(level >= 2 ? [{ label: "ベリーイージーで挑戦", value: 2, primary: true, test: "retry-assist-yes" },
      { label: "イージーで挑戦", value: 1, test: "retry-assist-easy" }]
      : [{ label: "イージーで挑戦", value: 1, primary: true, test: "retry-assist-yes" }]),
    { label: "ノーマルで挑戦", value: 0, test: "retry-assist-no" },
    { label: "選択に戻る", value: null, test: "retry-assist-cancel" },
  ];
}

export async function chooseRetryAssist(tournament, isCurrent = () => true) {
  if (!isCurrent()) return null;
  const attempt = tournament.attempts;
  tournament.retryAssist = false;
  tournament.retryAssistLevel = 0;
  if (!offersRetryAssist(tournament)) return false;
  const level = retryAssistLevelFor(tournament.losses);
  const chosen = await modal({
    title: "コンティニュー",
    body: retryAssistBody(level, tournament.losses),
    options: retryAssistOptions(level),
  });
  if (!isCurrent() || tournament.attempts !== attempt) return null;
  if (!Number.isInteger(chosen) || chosen < 0 || chosen > level) return null;
  tournament.retryAssist = chosen > 0;
  tournament.retryAssistLevel = chosen;
  return tournament.retryAssist;
}
