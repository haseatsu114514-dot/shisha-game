// 斧投げBarの10投ゲームの三段階（#3779。2026-11-20 オーナー「各ミニゲームに三段階の難易度を追加」「火種の報酬をつけたい」）。
// DOM・保存に触れない。段は WATL のリーグの部門そのもの: 初級＝レク・中級＝アマ・上級＝プロ（minigames/axe-model.js の DIVISIONS）。
// 投げる物理・揺れ・点の数え方は変えず、当てた後に閉じる的だけが部門で違う。3投練習は段の外（今どおりレクの決まり）。
// 解放・記録・上級クリアの白火は core/play-tiers.js の共通の型。クリアの線は TIER_GAMES.axe.clear（初級はB・中級と上級はAランク以上）。
// 線を段で変えるのは、部門の差が閉じ方だけで、Bでは「ふつう」の腕がどの部門もほぼ100%になるため（2026-11-20 計測。docs/spec/axe_throw.md）。
import { rankOf } from "../minigames/axe-challenges.js";
import { MODES } from "../minigames/axe-model.js";
import { TIERS, tierLockNote } from "../core/play-tiers.js";

/** 段 → 部門。 */
export const AXE_TIER_DIVISION = Object.freeze({ easy: "rec", normal: "am", hard: "pro" });
/** 段ごとのクリアの線（このランク以上）。 */
export const AXE_TIER_PASS = Object.freeze({ easy: ["S", "A", "B"], normal: ["S", "A"], hard: ["S", "A"] });

/**
 * 確定した結果がクリアした段（無ければ null）。数えるのは Bar のソロの10投（mode "league"）を完走して、初級（レク）は B 以上
 * （axe-challenges.js の RANKS、満点の .45 以上）、中級（アマ）・上級（プロ）は A 以上（.62 以上）だけ。3投練習・中断・ひよりとの対戦・レッスンは数えない。
 */
export function axeTierClear(result) {
  if (!result || result.completed !== true || result.mode !== "league" || result.opponent || result.tutorial) return null;
  if (result.throwCount !== MODES.league.throws || result.throws?.length !== MODES.league.throws || !(result.maximum > 0) || !Number.isFinite(result.total)) return null;
  const tier = TIERS.find((t) => AXE_TIER_DIVISION[t] === result.division);
  return tier && AXE_TIER_PASS[tier].includes(rankOf(result.total, result.maximum)) ? tier : null;
}

/** 閉じた段の札に出す開き方（全ミニゲーム共通の core/play-tiers.js の tierLockNote）。初級は空。 */
export const axeTierLock = tierLockNote;

/**
 * 10投ゲームの段ごとの自己ベスト（#4195 M-35「自己ベストは段ごと」）。records.league.bests[部門] を正とし、
 * 段ごとの記録が無い旧保存は、部門の分かる自己ベスト・前回の記録だけから読む（部門の無い古い記録は段に振り分けない）。読むだけ。
 */
export function axeTierBests(league) {
  const out = {};
  const keep = (entry) => {
    const tier = TIERS.find((t) => AXE_TIER_DIVISION[t] === entry?.division);
    if (!tier || !Number.isFinite(entry?.total)) return;
    if (!out[tier] || entry.total > out[tier].total) out[tier] = entry;
  };
  for (const entry of Object.values(league?.bests && typeof league.bests === "object" ? league.bests : {})) keep(entry);
  keep(league?.best); keep(league?.last);
  return out;
}
