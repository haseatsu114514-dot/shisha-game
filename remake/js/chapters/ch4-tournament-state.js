// GRAND SMOKE: 一試合・一台。工程確定前の消費と確定済みの実績を分けて保存する。
import { difficultyForRun, liftRivalScore, observeRivalScore } from "../core/ngplus-difficulty.js";
import { difficultyEvidence } from "../core/cycle-start.js";

export const CH4_CONTESTANTS = Object.freeze(["hajime", "naru", "master_hookah", "sheikh"]);
export const CH4_JUDGES = Object.freeze(["nagumo", "da_silva", "emil"]);
// 2026-11-03「3・4章を難しく調整」: なるの中盤、シェイクの終盤を強める暫定値（実機調整前）。
// 配点は2/3/2/3を保持。最後40%の案は、相手の固定順位を生むため採用しない。
// 途中の旧保存は旧基準を保持し、新しい一台から版2で競う。
export const CH4_RULES_VERSION = 2;
export const CH4_LEGACY_RIVAL_CURVE = Object.freeze({
  naru: Object.freeze([86, 91, 92, 87.5]),
  master_hookah: Object.freeze([87, 87, 87, 87]),
  sheikh: Object.freeze([88, 88, 88, 88]),
});
export const CH4_RIVAL_CURVE = Object.freeze({
  naru: Object.freeze([87, 94, 94.5, 92.5]),
  master_hookah: Object.freeze([87.5, 87.5, 87.5, 87.5]),
  sheikh: Object.freeze([90, 88, 88.25, 94]),
});
// 互換用: 最後の票の値。
export const CH4_RIVAL_QUALITY = Object.freeze(Object.fromEntries(
  Object.entries(CH4_RIVAL_CURVE).map(([id, curve]) => [id, curve.at(-1)])));
export const CH4_LEGACY_SPEND = Object.freeze([2, 3, 2, 3]);
export const CH4_SPEND = Object.freeze([2, 3, 2, 3]);
export const CH4_CRAFT_STEP_COUNT = 11;
const rulesVersion = p => p.rulesVersion === undefined ? 1 : p.rulesVersion;
function rulesFor(p) {
  const version = rulesVersion(p);
  if (version !== 1 && version !== CH4_RULES_VERSION) throw new Error("世界大会の採点規則を確認できません");
  return version === 1 ? { curve: CH4_LEGACY_RIVAL_CURVE, spend: CH4_LEGACY_SPEND }
    : { curve: CH4_RIVAL_CURVE, spend: CH4_SPEND };
}
const clone = value => structuredClone(value);
// 同点時の並びは改名前（wang）の文字列順を保つ。
const tieKey = id => id === "master_hookah" ? "wang" : id;
const byTie = (a, b) => tieKey(a).localeCompare(tieKey(b));
const resources = value => clone(Object.fromEntries(["flavorStock", "stamina", "equip", "recipes", "stats"].map(key => [key, value[key]])));
const restore = (value, snapshot) => Object.assign(value, clone(snapshot));
const emptyVotes = () => Object.fromEntries(CH4_JUDGES.map(judge => [judge,
  Object.fromEntries(CH4_CONTESTANTS.map(id => [id, 0]))]));

export function chapterFourMatch(value) {
  const progress = value?.flags?._ch4;
  if (value?.chapter !== 4 || !progress) throw new Error("第4章の保存ではありません");
  const p = progress.match ||= { version: 1, rulesVersion: CH4_RULES_VERSION, step: 0, craft: null, rollback: null, entry: null,
    votes: emptyVotes(), voted: 0, result: null, history: [] };
  if (p.version !== 1 || !Number.isInteger(p.step) || p.step < 0 || p.step > CH4_CRAFT_STEP_COUNT
    || !Number.isInteger(p.voted) || p.voted < 0 || p.voted > CH4_SPEND.length || !Array.isArray(p.history)) {
    throw new Error("世界大会の制作保存を確認できません");
  }
  rulesFor(p);
  return p;
}

export function startChapterFourCraft(value, craft) {
  const p = chapterFourMatch(value);
  if (value.flags._ch4.part !== "tournament" || !value.flags._ch4.read.ch4_tournament_start || p.result) return false;
  if (p.craft) return p;
  p.entry ||= resources(value);
  p.rulesVersion = CH4_RULES_VERSION;
  p.craft = clone(craft);
  return p;
}

/** 3敗後の補助は記録済みの敗北だけを数える。旧保存の挑戦回数から敗北を推定しない。 */
export function chapterFourRetryContext(value) {
  const p = chapterFourMatch(value);
  return { attempts: p.history.length + 1, losses: p.history.filter(entry => entry?.win === false).length,
    retryAssist: false };
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
  if (parts.some(score => !Number.isFinite(score) || score < 0 || score > 100)) throw new Error("世界大会の工程成績が不足しています");
  if (round === 3 && (!Number.isFinite(craft.total) || craft.total < 0 || craft.total > 100)) throw new Error("世界大会の総合成績を確認できません");
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
  const rules = rulesFor(p), nextStep = p.step + 1;
  const round = [8, 9, 10, 11].indexOf(nextStep);
  // 検査を先に済ませ、不正な成績・持ち点で工程や一部の票だけを確定しない。
  let quality = null;
  if (!craft.failed && round >= 0) {
    if (p.voted !== round) throw new Error("世界大会の投票順が一致しません");
    const hajime = qualityAt(craft, round);
    for (const judge of CH4_JUDGES) {
      const row = p.votes?.[judge];
      if (!row || CH4_CONTESTANTS.some(id => !Number.isInteger(row[id]) || row[id] < 0)
        || CH4_CONTESTANTS.reduce((sum, id) => sum + row[id], 0)
          !== rules.spend.slice(0, round).reduce((sum, n) => sum + n, 0)) {
        throw new Error("世界大会の持ち点が不足しています");
      }
    }
    const carry = difficultyForRun(value, difficultyEvidence(value));
    quality = Object.fromEntries(Object.entries(rules.curve).map(([id, curve]) => {
      const base = curve[round];
      const lifted = liftRivalScore(base, carry, 4);
      observeRivalScore(base, carry, 4, lifted);
      return [id, lifted];
    }));
    quality.hajime = hajime;
  }
  if (!craft.failed && nextStep === CH4_CRAFT_STEP_COUNT
    && (!craft.pullDone || craft.careHistory?.length !== 2 || !Number.isFinite(craft.total))) {
    throw new Error("提供と二度の調整が未完了です");
  }
  p.craft = clone(craft);
  p.rollback = null;
  p.step = nextStep;
  if (quality) {
    p.quality = quality;
    const [first, second] = [...CH4_CONTESTANTS].sort((a, b) => p.quality[b] - p.quality[a] || byTie(a, b));
    for (const judge of CH4_JUDGES) {
      p.votes[judge][first] += rules.spend[round] - 1;
      p.votes[judge][second] += 1;
    }
    p.voted++;
  }
  if (craft.failed || p.step === CH4_CRAFT_STEP_COUNT) {
    const rows = chapterFourStandings(p);
    const rank = craft.failed ? 4 : rows.find(row => row.id === "hajime").rank;
    p.result = { rulesVersion: rulesVersion(p), win: !craft.failed && rank === 1, rank, total: craft.total, failure: craft.failed || null,
      rows, votes: clone(p.votes), parts: clone(craft.parts || {}), careHistory: clone(craft.careHistory || []) };
    p.history.push(clone(p.result));
  }
  return p;
}

export function resetChapterFourCraft(value) {
  const p = chapterFourMatch(value);
  if (!p.result || p.result.win) return false;
  if (p.entry) restore(value, p.entry);
  Object.assign(p, { rulesVersion: CH4_RULES_VERSION, step: 0, craft: null, rollback: null, result: null, voted: 0, votes: emptyVotes(), quality: null });
  return true;
}
