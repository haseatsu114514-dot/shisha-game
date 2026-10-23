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

export async function runFullPractice({ coached = false, adjustments = true, kind = "practice", venue = null } = {}) {
  const cs = newSession(coached ? "tutorial" : "rehearsal");
  if (venue) cs.venue = venue; // "home": 家の作業台で練習（#638）
  openBench(cs, { steps: adjustments ? CRAFT_STEPS : CRAFT_STEPS.filter(([id]) => !id.startsWith("care")) });
  await waitBenchReady(cs);
  await stepSetup(cs);
  await stepWater(cs);
  await stepMix(cs);
  await stepPack(cs);
  await runHoles(cs);
  await stepPlace(cs);
  await runHeat(cs);
  await stepSteamTime(cs);
  await runSteamDodge(cs);
  await runPull(cs);
  if (adjustments) for (const round of [1, 2]) {
    if (cs.failed) break;
    await runCare(cs, { round });
  }
  if (!recordPractice(cs, kind)) throw new Error("Practice interrupted before serving");
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

