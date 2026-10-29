// 周回メタ層（Issue #1228、NGPLUS-DESIGN.md §3.2・§7・§8.2、SPEC U2）。
// セーブ枠（suien_remake_save）とは別キーに、周回を跨ぐ解放・真エンド到達履歴・
// 最新の引き継ぎパッケージ・通算値だけを置く。真エンドの到達判定そのものはしない
// （#517 / 判断 D7）。ここへの書き込みは recordTrueEnd / recordCycleStarted の
// 明示的な通知だけで起き、load・移行・章クリア記録からは決して書かない。
import { buildCarryPackage } from "./carry.js";
import { recordRouteTrueEnd } from "./gallery-progress.js";

export const CYCLE_META_KEY = "suien_remake_cycle";
export const CYCLE_META_VERSION = 1;

const charIdValid = id => typeof id === "string" && /^[a-z][a-z0-9_]*$/.test(id);
const cycleIdValid = id => typeof id === "string" && id.length > 0;
const cycleValid = n => Number.isInteger(n) && n >= 1;
const countValid = n => Number.isInteger(n) && n >= 0;
const list = value => Array.isArray(value) ? value : [];
const unique = value => [...new Set(value)];

export function emptyCycleMeta() {
  return {
    version: CYCLE_META_VERSION,
    unlocked: false,
    trueEnds: [],
    highestCycleStarted: 1,
    carryPackage: null,
    lifetime: { tournamentWins: 0, tournamentAttempts: 0 },
  };
}

function trueEndEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!cycleIdValid(value.cycleId) || !cycleValid(value.cycle)) return null;
  return {
    cycleId: value.cycleId,
    cycle: value.cycle,
    at: typeof value.at === "string" ? value.at : null,
    loversAtEnd: unique(list(value.loversAtEnd).filter(charIdValid)),
  };
}

function carryPackage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!cycleIdValid(value.fromCycleId) || !cycleValid(value.fromCycle)) return null;
  if (!value.data || typeof value.data !== "object" || Array.isArray(value.data)) return null;
  return {
    fromCycleId: value.fromCycleId,
    fromCycle: value.fromCycle,
    at: typeof value.at === "string" ? value.at : null,
    data: value.data,
  };
}

/** 保存内容を検証して正規化する。未対応 version や欠損は初期形として読む（推測で補わない）。 */
export function normalizeCycleMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyCycleMeta();
  if (value.version !== CYCLE_META_VERSION) return emptyCycleMeta();
  const lifetime = value.lifetime && typeof value.lifetime === "object" && !Array.isArray(value.lifetime)
    ? value.lifetime : {};
  return {
    version: CYCLE_META_VERSION,
    unlocked: value.unlocked === true,
    trueEnds: list(value.trueEnds).map(trueEndEntry).filter(Boolean),
    highestCycleStarted: cycleValid(value.highestCycleStarted) ? value.highestCycleStarted : 1,
    carryPackage: carryPackage(value.carryPackage),
    lifetime: {
      tournamentWins: countValid(lifetime.tournamentWins) ? lifetime.tournamentWins : 0,
      tournamentAttempts: countValid(lifetime.tournamentAttempts) ? lifetime.tournamentAttempts : 0,
    },
  };
}

/** メタ層を読む。読み込みだけでは保存しない。壊れた保存でも例外にしない。 */
export function readCycleMeta() {
  let value;
  try { value = JSON.parse(localStorage.getItem(CYCLE_META_KEY) || "null"); } catch { /* 初回・保存不可 */ }
  return normalizeCycleMeta(value);
}

/** メタ層を検証して保存し、成否を返す。 */
export function saveCycleMeta(meta) {
  try {
    localStorage.setItem(CYCLE_META_KEY, JSON.stringify(normalizeCycleMeta(meta)));
    return true;
  } catch {
    return false;
  }
}

/**
 * その周回で確定している大会の試行・勝利の通算材料を、記録済みの値だけから数える。
 * 試行数は各章の正本カウンタ（第1章 state.tournament、第2・3章は各章の進行、第4章 flags._ch4）の合計。
 * 勝利数は試行単位の勝敗履歴が残る第2・3章の history だけを数える。第1章は lastRank しか残らず、
 * 第4章は結果が物語で固定され履歴を持たないため、推定では補わない（SPEC U2 の確認点）。
 */
function tournamentTotalsForCycle(s) {
  const attemptsOf = value => countValid(value) ? value : 0;
  const winsOf = history => list(history).filter(r => r && typeof r === "object" && r.win === true).length;
  const ch2 = s?.flags?._ch2_tournament, ch3 = s?.flags?._ch3_tournament, ch4 = s?.flags?._ch4;
  return {
    tournamentAttempts: attemptsOf(s?.tournament?.attempts)
      + attemptsOf(ch2?.attempts) + attemptsOf(ch3?.attempts) + attemptsOf(ch4?.attempts),
    tournamentWins: winsOf(ch2?.history) + winsOf(ch3?.history),
  };
}

/**
 * 真エンド到達の明示的な通知を受ける（解放・到達記録・引き継ぎパッケージ作成）。
 * SCHEMA 22 の有効な cycleId・cycle が必須で、不備を推測で補わない。
 * 同一 cycleId の再通知では到達履歴と通算値を増やさず、パッケージだけを最新化する。
 * 戻り値はメタ層の保存成否。ギャラリー進行層（別キー）へのルート記録も冪等に行う。
 */
export function recordTrueEnd(state) {
  try {
    if (!state || typeof state !== "object") return false;
    if (!cycleIdValid(state.cycleId) || !cycleValid(state.cycle)) return false;
    const at = new Date().toISOString();
    const loversAtEnd = unique(list(state.lovers).filter(charIdValid));
    const meta = readCycleMeta();
    const isNewCycle = !meta.trueEnds.some(e => e.cycleId === state.cycleId);
    const next = {
      ...meta,
      unlocked: true,
      carryPackage: {
        fromCycleId: state.cycleId,
        fromCycle: state.cycle,
        at,
        data: buildCarryPackage(state),
      },
    };
    if (isNewCycle) {
      const totals = tournamentTotalsForCycle(state);
      next.trueEnds = [...meta.trueEnds, { cycleId: state.cycleId, cycle: state.cycle, at, loversAtEnd }];
      next.lifetime = {
        tournamentWins: meta.lifetime.tournamentWins + totals.tournamentWins,
        tournamentAttempts: meta.lifetime.tournamentAttempts + totals.tournamentAttempts,
      };
    }
    const ok = saveCycleMeta(next);
    // 進行層は別キーで集合型の記録のため、片方だけ成功した後の再通知でも重複しない。
    try { recordRouteTrueEnd(loversAtEnd); } catch { /* 進行層の失敗はメタ記録を妨げない */ }
    return ok;
  } catch {
    return false;
  }
}

/**
 * 周回開始の通知を受ける（#1248 の options.onCycleStarted 接続先）。
 * highestCycleStarted だけを最大値で更新し、解放・到達履歴・パッケージ・通算値は変えない。
 */
export function recordCycleStarted(started) {
  try {
    if (!started || typeof started !== "object" || !cycleValid(started.cycle)) return false;
    const meta = readCycleMeta();
    if (started.cycle <= meta.highestCycleStarted) return true;
    return saveCycleMeta({ ...meta, highestCycleStarted: started.cycle });
  } catch {
    return false;
  }
}
