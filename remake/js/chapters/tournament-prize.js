import { MAX_MONEY } from "../core/rules.js";

/** 確定した優勝の賞金だけを、一度だけ所持金へ反映する。 */
export function payTournamentPrize(value, progress, rank, amount) {
  if (rank === 1 && !progress.prizePaid) {
    progress.prizePaid = true;
    value.money = Math.min(MAX_MONEY, Math.max(0, Math.round((value.money || 0) + amount)));
  }
}
