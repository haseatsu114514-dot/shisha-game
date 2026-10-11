// 日常で一台を通して作り、提供後の調整も実際に練習する。
import { newSession, openBench, waitBenchReady } from "./session.js";
import { stepSetup, stepMix, stepPack, stepPlace, stepSteamTime } from "./steps.js";
import { runHoles } from "./holes.js";
import { runHeat } from "./heat.js";
import { runSteamDodge } from "./steam.js";
import { runPull, runCare } from "./pull.js";
import { state } from "../core/state.js";
import { retireScreen } from "../core/ui.js";

export const CRAFT_STEPS = [["setup", "SETUP"], ["mix", "MIX"], ["pack", "PACK"], ["holes", "FOIL"], ["place", "SET"], ["heat", "HEAT"], ["steam", "STEAM"], ["pull", "PULL"], ["care1", "調整1回目"], ["care2", "調整2回目"]];

export function practiceRecords() {
  return Array.isArray(state.flags._craft_practice_runs) ? state.flags._craft_practice_runs : [];
}
export function recordPractice(cs, kind = "practice") {
  state.flags._craft_practice_runs = [...practiceRecords(), {
    day: state.day, kind, success: !cs.failed, mix: { ...cs.mix }, adjustments: cs.careHistory?.length || 0,
  }];
}

export async function runFullPractice({ coached = false, adjustments = true, kind = "practice" } = {}) {
  const cs = newSession(coached ? "tutorial" : "rehearsal");
  openBench(cs, { steps: adjustments ? CRAFT_STEPS : CRAFT_STEPS.filter(([id]) => !id.startsWith("care")) });
  await waitBenchReady(cs);
  await stepSetup(cs);
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
  recordPractice(cs, kind);
  retireScreen();
  return cs;
}
