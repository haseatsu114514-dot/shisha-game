import { notifyMastery } from "../core/mastery-notice.js";
import { gainFlavorExperience, masteryDay } from "../core/flavor-mastery.js";
import { DB } from "../core/data.js";
// 日常で一台を通して作り、提供後の調整も実際に練習する。
import { newSession, openBench, waitBenchReady } from "./session.js";
import { stepSetup, stepMix, stepPack, stepPlace, stepSteamTime, evaluateMix } from "./steps.js";
import { stepWater } from "./water-view.js";
import { runHoles } from "./holes.js";
import { runHeat } from "./heat.js";
import { runSteamDodge } from "./steam.js";
import { runPull, runCare } from "./pull.js";
import { state } from "../core/state.js";
import { retireScreen } from "../core/ui.js";
import { temperatureAfterSteam } from "./conditions.js";
import { ensureFlavorLife } from "./flavor-life.js";
import { recordPractice } from "./practice-history.js";
export { practiceRecords, recordPractice } from "./practice-history.js";

export const CRAFT_STEPS = [["setup", "SETUP"], ["mix", "MIX"], ["pack", "PACK"], ["holes", "FOIL"], ["place", "SET"], ["heat", "HEAT"], ["steam", "STEAM"], ["pull", "PULL"], ["care1", "調整1回目"], ["care2", "調整2回目"]];

export async function runFullPractice({ coached = false, adjustments = true, kind = "practice", staffPractice = false, isCurrent = null } = {}) {
  // 呼出し元が指定した制作だけを中断判定する。既存の自由練習等は従来どおり。
  const owner = state;
  const checkCurrent = () => {
    if (state !== owner) throw new DOMException("Practice owner changed", "AbortError");
    if (isCurrent && !isCurrent()) throw new DOMException("Practice owner changed", "AbortError");
  };
  checkCurrent();
  const cs = newSession(coached ? "tutorial" : "rehearsal");
  cs.practiceKind = kind;
  cs.staffPractice = staffPractice;
  if (staffPractice) { cs.eventTitle = "PRACTICE"; cs.eventNote = "まかないで練習"; }
  openBench(cs, { steps: adjustments ? CRAFT_STEPS : CRAFT_STEPS.filter(([id]) => !id.startsWith("care")) });
  await waitBenchReady(cs);
  checkCurrent();
  await stepSetup(cs);
  checkCurrent();
  await stepWater(cs);
  checkCurrent();
  await stepMix(cs);
  checkCurrent();
  await stepPack(cs);
  checkCurrent();
  await runHoles(cs);
  checkCurrent();
  await stepPlace(cs);
  checkCurrent();
  await runHeat(cs);
  checkCurrent();
  await stepSteamTime(cs);
  checkCurrent();
  await runSteamDodge(cs);
  checkCurrent();
  await runPull(cs);
  checkCurrent();
  if (adjustments) for (const round of [1, 2]) {
    if (cs.failed) break;
    await runCare(cs, { round });
    checkCurrent();
  }
  if (!recordPractice(cs, kind)) throw new Error("Practice interrupted before serving");
  const key = !coached && `_mastery_practice_${masteryDay(state)}_${kind}`;
  cs.masteryGained = false;
  if (cs.pullDone && !state.flags[key] && !coached) {
    const own = Object.values(cs.practiceSpent?.own || {}).reduce((a, b) => a + b, 0);
    const total = Object.values(cs.mix).reduce((a, b) => a + b, 0);
    const before = { ...state.flavorMastery };
    const gains = gainFlavorExperience(state, cs.mix, staffPractice ? 2 + 4 * own / Math.max(1, total) : 2, DB.flavorById);
    cs.masteryGained = gains.some(({ id }) => state.flavorMastery[id] > (before[id] || 0));
    notifyMastery(gains);
    state.flags[key] = true;
  }
  retireScreen();
  return cs;
}

/** スミさんが用意した一台。前半の操作・提供の成績は捏造しない。 */
export function newCarePracticeSession() {
  const cs = newSession("tutorial");
  cs.practiceScope = "care";
  const flavor = state.flags._prep_flavor || "double_apple";
  cs.mix = { [flavor]: 10, mint: 2 };
  cs.mixInfo = evaluateMix(cs);
  cs.pack = "normal";
  cs.place = "triangle";
  cs.holes = { total: 24, outer: 24, middle: 0, inner: 0 };
  cs.heat = { heatPower: 50 };
  cs.steamSeconds = 480;
  // 標準の焼き炭・8分の蒸らしから計算。提供後の冷え方は本番の runCare が適用する。
  cs.practiceSource = { temperature: temperatureAfterSteam(cs, cs.steamSeconds, 0) };
  ensureFlavorLife(cs);
  return cs;
}

export async function runCarePractice({ kind = "care" } = {}) {
  const cs = newCarePracticeSession();
  openBench(cs, { steps: CRAFT_STEPS.filter(([id]) => id.startsWith("care")) });
  await waitBenchReady(cs);
  for (const round of [1, 2]) {
    await runCare(cs, { round });
    if (cs.failed) break;
  }
  if (!recordPractice(cs, kind)) throw new Error("Care practice interrupted before adjustment");
  retireScreen();
  return cs;
}

