// DAY9の店仕事は、店の葉と道具で一回だけ調整する。全工程の再演・消耗・成長報酬はない。
import { state } from "../core/state.js";
import { newSession, openBench, waitBenchReady } from "../craft/session.js";
import { evaluateMix } from "../craft/steps.js";
import { runCare } from "../craft/pull.js";
import { temperatureAfterSteam } from "../craft/conditions.js";
import { ensureFlavorLife } from "../craft/flavor-life.js";
import { retireScreen } from "../core/ui.js";

export async function adjustChapterThreeService({ isCurrent = () => true } = {}) {
  const owner = state;
  const live = () => state === owner && isCurrent();
  if (!live()) return null;
  const cs = newSession("tutorial");
  cs.serviceRecipient = "綾取さん";
  cs.venueBg = "bg_mukai_shop";
  cs.venueLabel = "MUKAI";
  cs.audienceIds = [];
  cs.lessonHelp = { care: {
    brief: "焼いてあった炭で、一度だけ熱を整える",
    detail: "交換する炭の数と置き方を選び、最低一口で熱を確かめる。味の確認はましろと分担する",
  } };
  cs.eventTitle = "MUKAI";
  cs.eventNote = "店の一台を、一度だけ調整する";
  cs.practiceScope = "care";
  // 仕込みははじめ、味の確認はましろ。既定の店の道具を使い、私物の在庫は参照しない。
  cs.equip = { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" };
  cs.mix = { grape: 8, black_tea: 4 };
  cs.mixInfo = evaluateMix(cs);
  cs.pack = "normal";
  cs.place = "triangle";
  cs.holes = { total: 24, outer: 24, middle: 0, inner: 0 };
  cs.heat = { heatPower: 50 };
  cs.steamSeconds = 480;
  cs.practiceSource = { temperature: temperatureAfterSteam(cs, cs.steamSeconds, 0) };
  ensureFlavorLife(cs);
  openBench(cs, { steps: [["care1", "一度の調整"]] });
  await waitBenchReady(cs);
  if (!live()) return null;
  await runCare(cs, { round: 1 });
  if (!live()) return null;
  retireScreen();
  return cs;
}
