import { MAX_MONEY } from "../core/rules.js";

/** 確定した優勝の賞金だけを、一度だけ所持金へ反映する。 */
export function payTournamentPrize(value, progress, rank, amount) {
  if (rank === 1 && !progress.prizePaid) {
    const before = value.money;
    const next = Math.min(MAX_MONEY, Math.max(0, Math.round((before || 0) + amount)));
    progress.prizePaid = true;
    value.money = next;
    progress.prizeReceived = Math.max(0, next - Math.max(0, Math.round(Number(before) || 0)));
  }
}
