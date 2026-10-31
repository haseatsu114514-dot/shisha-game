// GRAND SMOKE: 一試合・一台。工程確定前の消費と確定済みの実績を分けて保存する。
import { difficultyForRun, liftRivalScore, observeRivalScore } from "../core/ngplus-difficulty.js";
import { difficultyEvidence } from "../core/cycle-start.js";

export const CH4_CONTESTANTS = Object.freeze(["hajime", "naru", "master_hookah", "sheikh"]);
export const CH4_JUDGES = Object.freeze(["nagumo", "da_silva", "emil"]);
export const CH4_RIVAL_QUALITY = Object.freeze({ naru: 86, master_hookah: 87, sheikh: 88 });
export const CH4_SPEND = Object.freeze([2, 3, 2, 3]);
export const CH4_CRAFT_STEP_COUNT = 11;
const clone = value => structuredClone(value);
// 旧保存の内部名 wang（王煙楼）は master_hookah へ読み替える（#2031）。読み替えはこの別名だけ。
const LEGACY_ID = Object.freeze({ wang: "master_hookah" });
// 同点時の並びは改名前（wang）の文字列順を保つ。
const tieKey = id => id === "master_hookah" ? "wang" : id;
const byTie = (a, b) => tieKey(a).localeCompare(tieKey(b));
const renameKeys = obj => obj && typeof obj === "object" && !Array.isArray(obj)
  ? Object.fromEntries(Object.entries(obj).map(([key, v]) => [LEGACY_ID[key] || key, v])) : obj;
function migrateResult(result) {
  if (!result || typeof result !== "object") return;
  if (Array.isArray(result.rows)) for (const row of result.rows) if (row && LEGACY_ID[row.id]) row.id = LEGACY_ID[row.id];
  if (result.votes) result.votes = Object.fromEntries(Object.entries(result.votes).map(([judge, row]) => [judge, renameKeys(row)]));
}
function migrateLegacyIds(p) {
  if (p.votes) p.votes = Object.fromEntries(Object.entries(p.votes).map(([judge, row]) => [judge, renameKeys(row)]));
  if (p.quality) p.quality = renameKeys(p.quality);
  migrateResult(p.result);
  for (const entry of p.history || []) migrateResult(entry);
}
const resources = value => clone(Object.fromEntries(["flavorStock", "stamina", "equip", "recipes", "stats"].map(key => [key, value[key]])));
const restore = (value, snapshot) => Object.assign(value, clone(snapshot));
const emptyVotes = () => Object.fromEntries(CH4_JUDGES.map(judge => [judge,
  Object.fromEntries(CH4_CONTESTANTS.map(id => [id, 0]))]));

export function chapterFourMatch(value) {
  const progress = value?.flags?._ch4;
  if (value?.chapter !== 4 || !progress) throw new Error("第4章の保存ではありません");
  const p = progress.match ||= { version: 1, step: 0, craft: null, rollback: null, entry: null,
    votes: emptyVotes(), voted: 0, result: null, history: [] };
  if (p.version !== 1 || !Number.isInteger(p.step) || p.step < 0 || p.step > CH4_CRAFT_STEP_COUNT
    || !Number.isInteger(p.voted) || p.voted < 0 || p.voted > CH4_SPEND.length || !Array.isArray(p.history)) {
    throw new Error("世界大会の制作保存を確認できません");
  }
  migrateLegacyIds(p);
  return p;
}

export function startChapterFourCraft(value, craft) {
  const p = chapterFourMatch(value);
  if (value.flags._ch4.part !== "tournament" || !value.flags._ch4.read.ch4_tournament_start || p.result) return false;
  if (p.craft) return p;
  p.entry ||= resources(value);
  p.craft = clone(craft);
  return p;
}

export function recoverChapterFourStep(value) {
  const p = chapterFourMatch(value);
  if (p.rollback) { restore(value, p.rollback); p.rollback = null; }
  return p;
}

export function beginChapterFourStep(value) {
  const p = chapterFourMatch(value);
  if (!p.craft || p.result || p.step >= CH4_CRAFT_STEP_COUNT) throw new Error("世界大会の工程を開始できません");
  p.rollback ||= resources(value);
  return clone(p.craft);
}

function qualityAt(craft, round) {
  // アルミなしのHMS（ロートス等）は穴あけ成績を持たない（score: null）。共通finalizeの
  // 重み再配分と同じく、スキップ時は穴あけを平均から除く。
  const parts = [craft.heat?.score];
  if (!craft.holes?.skipped) parts.unshift(craft.holes?.score);
  if (round >= 1) parts.push(craft.servedQuality);
  if (round >= 2) parts.push(craft.careHistory?.[0]?.score);
  if (round >= 3) parts.push(craft.careHistory?.[1]?.score);
  if (parts.some(score => !Number.isFinite(score))) throw new Error("世界大会の工程成績が不足しています");
  // 最終投票は共通finalizeの5工程各20%と熟練度等の既存加点を使う。
  return round === 3 ? craft.total : parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function chapterFourStandings(p) {
  const points = Object.fromEntries(CH4_CONTESTANTS.map(id => [id,
    CH4_JUDGES.reduce((sum, judge) => sum + p.votes[judge][id], 0)]));
  return [...CH4_CONTESTANTS].sort((a, b) => points[b] - points[a]
    || (p.quality?.[b] || 0) - (p.quality?.[a] || 0) || byTie(a, b))
    .map((id, index) => ({ id, rank: index + 1, points: points[id] }));
}

export function finishChapterFourStep(value, craft) {
  const p = chapterFourMatch(value);
  if (!p.rollback || p.result || p.step >= CH4_CRAFT_STEP_COUNT) throw new Error("世界大会の工程を確定できません");
  p.craft = clone(craft);
  p.rollback = null;
  p.step++;
  const round = [8, 9, 10, 11].indexOf(p.step);
  if (!craft.failed && round >= 0) {
    if (p.voted !== round) throw new Error("世界大会の投票順が一致しません");
    const carry = difficultyForRun(value, difficultyEvidence(value));
    p.quality = Object.fromEntries(Object.entries(CH4_RIVAL_QUALITY).map(([id, base]) => {
      const lifted = liftRivalScore(base, carry, 4);
      observeRivalScore(base, carry, 4, lifted);
      return [id, lifted];
    }));
    p.quality.hajime = qualityAt(craft, round);
    const [first, second] = [...CH4_CONTESTANTS].sort((a, b) => p.quality[b] - p.quality[a] || byTie(a, b));
    for (const judge of CH4_JUDGES) {
      p.votes[judge][first] += CH4_SPEND[round] - 1;
      p.votes[judge][second] += 1;
    }
    p.voted++;
  }
  if (craft.failed || p.step === CH4_CRAFT_STEP_COUNT) {
    if (!craft.failed && (!craft.pullDone || craft.careHistory?.length !== 2 || !Number.isFinite(craft.total))) {
      throw new Error("提供と二度の調整が未完了です");
    }
    const rows = chapterFourStandings(p);
    const rank = craft.failed ? 4 : rows.find(row => row.id === "hajime").rank;
    p.result = { win: !craft.failed && rank === 1, rank, total: craft.total, failure: craft.failed || null,
      rows, votes: clone(p.votes), parts: clone(craft.parts || {}), careHistory: clone(craft.careHistory || []) };
    p.history.push(clone(p.result));
  }
  return p;
}

export function resetChapterFourCraft(value) {
  const p = chapterFourMatch(value);
  if (!p.result || p.result.win) return false;
  if (p.entry) restore(value, p.entry);
  Object.assign(p, { step: 0, craft: null, rollback: null, result: null, voted: 0, votes: emptyVotes(), quality: null });
  return true;
}
