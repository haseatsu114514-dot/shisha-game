import { modal } from "../core/ui.js";
import { retryAssistLevelFor } from "../craft/retry-assist-level.js";

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

/** コンティニュー画面で選べるいちばんやさしい段（0: 聞かない・1: イージーまで・2: ベリーイージーまで）。 */
export const retryAssistOffer = tournament => retryAssistLevelFor(tournament?.losses);

/**
 * コンティニュー画面（gameover.js）で選んだ難易度を、次の一台だけに記録する（WIN14）。
 * 選べない段や想定外の値はノーマル。戻り値は救済の有無。
 */
export function applyRetryAssistChoice(tournament, level) {
  const offered = retryAssistOffer(tournament);
  const chosen = Number.isInteger(level) && level > 0 && level <= offered ? level : 0;
  tournament.retryAssist = chosen > 0;
  tournament.retryAssistLevel = chosen;
  return tournament.retryAssist;
}

/** 選べる段の選択肢。いちばんやさしい段を先頭（決定キー）に置く。名前だけで、効き目の説明は出さない。 */
export function retryAssistOptions(level) {
  return [
    ...(level >= 2 ? [{ label: "ベリーイージー", value: 2, primary: true, test: "retry-assist-yes" },
      { label: "イージー", value: 1, test: "retry-assist-easy" }]
      : [{ label: "イージー", value: 1, primary: true, test: "retry-assist-yes" }]),
    { label: "ノーマル", value: 0, test: "retry-assist-no" },
  ];
}

/**
 * コンティニュー画面を通らずに大会の一台を始める時だけ使う問い（第4章で、画面の選択を持たない旧保存）。
 * 「選択に戻る」で取り消せる。
 */
export async function chooseRetryAssist(tournament, isCurrent = () => true) {
  if (!isCurrent()) return null;
  const attempt = tournament.attempts;
  tournament.retryAssist = false;
  tournament.retryAssistLevel = 0;
  if (!offersRetryAssist(tournament)) return false;
  const level = retryAssistLevelFor(tournament.losses);
  const chosen = await modal({
    title: "コンティニュー",
    body: "難易度を下げる？",
    options: [...retryAssistOptions(level), { label: "選択に戻る", value: null, test: "retry-assist-cancel" }],
  });
  if (!isCurrent() || tournament.attempts !== attempt) return null;
  if (!Number.isInteger(chosen) || chosen < 0 || chosen > level) return null;
  tournament.retryAssist = chosen > 0;
  tournament.retryAssistLevel = chosen;
  return tournament.retryAssist;
}
