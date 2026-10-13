// 固定レッスンの解決と、プレイヤーが実際に触った工程を区別する。
import { state } from "../core/state.js";

export const practiceRecords = () => Array.isArray(state.flags._craft_practice_runs) ? state.flags._craft_practice_runs : [];
const fullRuns = () => practiceRecords().filter(run => (run.scope || "full") === "full");

export function recordPractice(cs, kind = "practice") {
  const scope = cs.practiceScope || "full";
  const care = (cs.careHistory || []).filter(Boolean);
  // 画面を閉じた途中の一台を、提供/成功の記録へ変えない。
  if (scope === "full" ? !cs.pullDone : !care.length) return false;
  const scores = {};
  for (const id of ["holes", "heat", "steam", "pull"]) {
    if (Number.isFinite(cs[id]?.score)) scores[id] = cs[id].score;
  }
  state.flags._craft_practice_runs = [...practiceRecords(), {
    day: state.day, kind, scope,
    success: !cs.failed && (scope === "full" || care.length === 2),
    served: scope === "full" && !!cs.pullDone && !cs.pull?.failed,
    mix: { ...cs.mix }, adjustments: care.length, scores,
    careScores: care.map(result => result.score),
  }];
  return true;
}

export function basicsExperienced() {
  const runs = fullRuns();
  return runs.some(run => run.success === true && run.served !== false)
    // 旧セーブの tutorial_done は、実制作と提供を終えてから立っていた。
    || (!!state.flags._tutorial_done && !state.flags._tutorial_skipped && !runs.some(run => run.kind === "tutorial"));
}
export const fullPracticeToday = () => fullRuns().some(run => run.day === state.day);
export const careExperienced = () => practiceRecords().some(run => run.success === true && run.adjustments >= 2);

export function recommendedDrill() {
  const latest = fullRuns().at(-1);
  if (latest?.success === false && latest.served !== true) return "pull";
  const scores = latest?.scores || {};
  const entries = Object.entries(scores).filter(([id, score]) => ["holes", "heat", "steam", "pull"].includes(id) && Number.isFinite(score));
  return entries.sort((a, b) => a[1] - b[1])[0]?.[0] || "pull";
}
