// Per-session goals, heat streaks and the final rank. Read-only over resolved shots:
// nothing here changes scoring, the opponent or saved progress.
import { POWER, totalOf } from "./axe-model.js";

const sweet = shot => shot.power >= POWER.sweetMin && shot.power <= POWER.sweetMax;
const bulls = shots => shots.filter(s => s.outcome === "bull").length;
const outerBulls = shots => shots.filter(s => s.outcome === "bull" && s.zone?.cluster && s.zone.cluster !== "center").length;
const kills = shots => shots.filter(s => s.outcome === "killshot").length;
const killRows = shots => new Set(shots.filter(s => s.outcome === "killshot").map(s => s.called?.split("-")[0])).size;
function bestRun(shots, min) {
  let best = 0, run = 0;
  for (const shot of shots) { run = shot.score >= min ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}
// Each check returns { value, goal } and optionally failed. "end" goals only clear when the session finishes.
const counter = (label, goal, read) => ({ label, goal, read: shots => ({ value: read(shots), goal }) });
export const CHALLENGES = {
  "first-stick": { ...counter("1投目を刺して得点する", 1, s => Number(s[0]?.score > 0)), short: "初投で得点" },
  bull: { ...counter("赤い中心に1回当てる", 1, bulls), short: "ブル×1" },
  "bull-3": { ...counter("赤い中心に3回当てる", 3, bulls), short: "ブル×3" },
  "outer-bull": { ...counter("外側の赤い中心に当てる", 1, outerBulls), short: "外側ブル" },
  "outer-bull-2": { ...counter("外側の赤い中心に2回当てる", 2, outerBulls), short: "外側ブル×2" },
  kill: { ...counter("キルショットを1回決める", 1, kills), short: "キル×1" },
  "kill-2": { ...counter("キルショットを2回決める", 2, kills), short: "キル×2" },
  "kill-both": { ...counter("上と下、両方の高さでキルを決める", 2, killRows), short: "上下キル" },
  "sweet-all": { label: "全投、回転を緑の帯で放す", short: "全投グリーン", goal: 1, end: true,
    read: s => ({ value: 0, goal: 1, failed: s.some(shot => !sweet(shot)) }) },
  "no-drop": { label: "1回も落とさずに完走する", short: "落下ゼロ", goal: 1, end: true,
    read: s => ({ value: 0, goal: 1, failed: s.some(shot => !shot.stuck) }) },
  "run-2x4": { ...counter("2投続けて4点以上", 2, s => Math.min(2, bestRun(s, 4))), short: "4点以上×2連" },
  "run-3x5": { ...counter("3投続けて5点以上", 3, s => Math.min(3, bestRun(s, 5))), short: "5点以上×3連" },
  "total-12": { ...counter("合計12点以上", 12, s => Math.min(12, totalOf(s))), short: "12点以上" },
  "total-40": { ...counter("合計40点以上", 40, s => Math.min(40, totalOf(s))), short: "40点以上" },
  "average-5": { label: "平均5点以上で完走する", short: "平均5点", goal: 1, end: true,
    read: s => ({ value: 0, goal: 1, failed: s.length > 0 && totalOf(s) / s.length < 5 && s.length >= 10 }) },
};
const POOLS = {
  practice: [["first-stick", "bull"], ["sweet-all", "no-drop"], ["run-2x4", "total-12", "kill"]],
  league: [["bull-3", "outer-bull-2", "kill"], ["no-drop", "kill-2", "kill-both"], ["run-3x5", "total-40", "average-5"]],
};

/** One goal from each tier, so a set always mixes aim, control and endurance. */
export function pickChallenges(mode, seed = 0) {
  const pool = POOLS[mode === "practice" ? "practice" : "league"];
  let n = (Number(seed) >>> 0) || 1;
  return pool.map(tier => { n = Math.imul(n ^ n >>> 13, 0x5bd1e995) >>> 0; return tier[n % tier.length]; });
}

/** state: "done" | "failed" | "open". A finished session settles "end" goals that never failed. */
export function evaluateChallenges(ids, shots, finished = false) {
  return ids.map(id => {
    const c = CHALLENGES[id], r = c.read(shots);
    const reached = c.end ? finished && !r.failed && shots.length > 0 : r.value >= r.goal;
    const state = reached ? "done" : r.failed || finished ? "failed" : "open";
    return { id, label: c.label, short: c.short, state, value: c.end ? (reached ? 1 : 0) : r.value, goal: r.goal, end: !!c.end };
  });
}

/** Current run of throws scoring 5 or more. Two or more lights the heat display. */
export function heatOf(shots) {
  let run = 0;
  for (let i = shots.length - 1; i >= 0 && shots[i].score >= 5; i--) run++;
  return run;
}

const RANKS = [["S", .8], ["A", .62], ["B", .45], ["C", .25], ["D", 0]];
export function rankOf(total, max) {
  const ratio = max > 0 ? total / max : 0;
  return RANKS.find(([, min]) => ratio >= min)[0];
}

/** A short title that names what the session was good at, not only the number. */
export function titleOf(shots, max) {
  const total = totalOf(shots), rank = rankOf(total, max);
  if (!shots.length) return "見学者";
  if (killRows(shots) >= 2) return "青の狙撃手";
  if (bulls(shots) >= 3 && outerBulls(shots) >= 2) return "パーフェクト6の人";
  if (bulls(shots) >= 3) return "ブルハンター";
  if (bestRun(shots, 5) >= 4) return "連刺しの名手";
  if (shots.length >= 3 && shots.every(s => s.stuck)) return rank === "S" || rank === "A" ? "無落下の職人" : "粘りの投げ手";
  return { S: "斧に愛された人", A: "冴えた投げ手", B: "伸びざかり", C: "斧の見習い", D: "これからの人" }[rank];
}
