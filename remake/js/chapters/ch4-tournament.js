// 第4章runnerから共通の実制作へ。工程ごとに保存し、LOADでは未確定工程だけ巻き戻す。
import { state, save } from "../core/state.js";
import { play } from "../vn/engine.js";
import { modal, retireScreen } from "../core/ui.js";
import { playBgm } from "../core/audio.js";
import { newSession, openBench, waitBenchReady, benchRoot } from "../craft/session.js";
import { CRAFT_STEPS } from "../craft/practice.js";
import { stepSetup, stepMix, stepPack, stepPlace, stepSteamTime } from "../craft/steps.js";
import { stepWater } from "../craft/water-view.js";
import { runHoles } from "../craft/holes.js";
import { runHeat } from "../craft/heat.js";
import { runSteamDodge } from "../craft/steam.js";
import { runPull, runCare } from "../craft/pull.js";
import { computeShisha, finalize } from "../craft/score.js";
import { block, clearComments } from "../craft/broadcast.js";
import { showChapterFourStandings } from "./ch4-standings.js";
import { chapterFourMatch, startChapterFourCraft, recoverChapterFourStep,
  beginChapterFourStep, finishChapterFourStep } from "./ch4-tournament-state.js";
import { chapterFourCraftAdvice, chapterFourCustomerLines } from "./ch4-verdict.js";

const setup = async cs => { await stepSetup(cs); await stepWater(cs); };
const STEPS = [setup, stepMix, stepPack, runHoles, stepPlace, runHeat, stepSteamTime, runSteamDodge,
  runPull, cs => runCare(cs, { round: 1 }), cs => runCare(cs, { round: 2 })];
const STEP_IDS = ["setup", "mix", "pack", "foil", "place", "coalfire", "steam", "steam", "pull", "adjust", "adjust"];

export async function runChapterFourCraft({ isCurrent, menuButton }) {
  const owner = state;
  const live = () => state === owner && isCurrent();
  const requireCurrent = () => { if (!live()) throw new DOMException("World tournament owner changed", "AbortError"); };
  requireCurrent();
  const p = recoverChapterFourStep(state);
  if (!p.craft && !p.result) {
    const cs = newSession("tournament");
    cs.eventTitle = "HAZE: GRAND SMOKE";
    cs.eventNote = "世界大会・一台を二度調整";
    if (!startChapterFourCraft(state, cs)) throw new Error("世界大会の開始地点を確認できません");
    save();
  }
  while (live() && !p.result) {
    // 助言の読了も工程前に保存し、再開で同じ問いを繰り返さない。
    const adviceKey = `step${p.step}`;
    if (!p.craft.ch4AdviceSeen?.[adviceKey]) {
      const hints = chapterFourCraftAdvice(state, p.step);
      if (hints.length) {
        clearComments();
        const read = await play({ dialogue_id: `ch4_craft_advice_${p.step}`,
          lines: hints.map(text => ({ speaker: "", face: "", text })) });
        requireCurrent();
        if (!read || read.cancelled) return false;
      }
      if ([9, 10].includes(p.step)) {
        const round = p.step - 8;
        const ask = await modal({ title: `調整${round}回目の前に`, body: "吸っていた時間で熱は変わる。今の一口を確かめよう。", options: [
          { label: "吸い心地を聞く", value: true, primary: true, test: "ch4-customer-ask" },
          { label: "温度を見て調整する", value: false, test: "ch4-customer-temperature" },
        ] });
        requireCurrent();
        if (ask) {
          const read = await play({ dialogue_id: `ch4_customer_${round}`, lines: chapterFourCustomerLines(p.craft, round) });
          requireCurrent();
          if (!read || read.cancelled) return false;
        }
        p.craft.customerChecks ||= [];
        p.craft.customerChecks[round - 1] = ask === true;
      }
      p.craft.ch4AdviceSeen ||= {};
      p.craft.ch4AdviceSeen[adviceKey] = true;
      save();
    }
    const cs = beginChapterFourStep(state);
    save();
    playBgm("bgm_tournament_craft");
    openBench(cs, { steps: CRAFT_STEPS });
    await waitBenchReady(cs);
    requireCurrent();
    benchRoot(cs)?.querySelector(".bench-top")?.append(menuButton());
    block(cs, STEP_IDS[p.step]);
    const completed = await STEPS[p.step](cs);
    requireCurrent();
    if (completed === false) { recoverChapterFourStep(state); save(); return false; }
    if (p.step === 8 && !cs.failed) cs.servedQuality = computeShisha(cs).craftQuality;
    if (p.step === 10 && !cs.failed) { cs.stats = computeShisha(cs); finalize(cs); }
    const votedBefore = p.voted;
    finishChapterFourStep(state, cs);
    save();
    // 投票が動いた工程の後は、第2・3章と同じく途中順位を見せる（最後の票は結果画面が見せる）。
    if (p.voted > votedBefore && !p.result) { await showChapterFourStandings(p); requireCurrent(); }
  }
  requireCurrent();
  clearComments();
  retireScreen();
  return chapterFourMatch(state).result;
}
