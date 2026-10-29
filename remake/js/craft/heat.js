// 炭焼き（master_spec 第2部 §2）
// 炭はかなり焼けた状態から始まり、黒い面が消えて全面が赤くなり白い灰をまとう“取り頃”でタップして取る。
// ゲージ停止ではなく、炭の見た目（赤い面が広がる→全面赤→灰かぶり）を観察して取り出す。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshBench, tickerSay, reactAudience, scoreStep, waitBenchReady } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard } from "./common.js";
import { buildHeatView, coalSpots } from "./heat_view.js";
import { HEAT_GRADES, HEAT_TUNING, phaseOf, evaluateCoalTiming, formatTimingError, summarizeCoalTimings } from "./heat_logic.js";
export { HEAT_GRADES } from "./heat_logic.js";
import { coalCount, coalTypes } from "./coals.js";
import { createCraftClock } from "./clock.js";
import { state } from "../core/state.js";
import { coalJustSeconds } from "./heat_logic.js";
import { effectVisible, effectBadge, senseBand, effectTier } from "./effect-visual.js";

export async function runHeat(cs) {
  await waitBenchReady(cs, "heat");
  const panel = stepPanel("heat", "炭焼き", "黒い面が消えて全面が赤くなった炭を、タップして取り上げる");
  // 炭を一つ取るたびに、その炭の分の点がスコアへ入る（TH42）。
  const { res, timings, picks, info, feedback } = await burnCoals(cs, panel, { count: coalCount(cs), onPick: (timing, i, count) => scoreStep(cs, `heat:${i}`, timing.score / count) });
  cs.heat = res;
  scoreStep(cs, "heat", res.score, "炭焼き");
  refreshBench();
  await sleep(350);
  const bonuses = [
    ...(res.heatStability >= 70 ? ["HEAT STABLE"] : []),
    ...(res.aromaRetention >= 68 ? ["AROMA KEEP"] : []),
  ];
  feedback.replaceChildren(...bonuses.map((label) => el("span.heat-bonus", { text: label })));
  info.classList.add("heat-finished");
  await resultCard(panel, {
    title: "炭焼き 結果",
    advice: heatAdvice(res),
    grade: res.grade,
    summary: [
      ...timings.map((timing, i) => `${coalSpots(coalCount(cs))[i][2]} ${timing.rating}：${formatTimingError(timing.errorSeconds)}（${timing.label}${timing.automatic ? "・自動" : ""}）`),
      res.just === coalCount(cs) ? "すべて全面が赤い取り頃で取れた" : res.just ? "取り頃で取れた炭がある" : "次は全面が赤くなるのを待とう",
    ],
    lines: [
      picks.map((g) => HEAT_GRADES[g].label).join("・"),
      res.just === coalCount(cs) ? "全部、全面が赤い取り頃で取れた。火が素直だ" : res.just ? "取り頃で取れた炭がある" : "取り頃を逃した。焼け具合が読みにくい",
      res.over ? "取り出しが遅れた炭がある。炭が減って熱が落ちやすい" : res.early ? "黒い面が残る炭がある。えぐみが出やすい" : "",
    ],
  });
}

function heatAdvice(res) {
  const early = res.picks.some(p => ["raw", "early", "pre"].includes(p));
  const late = res.picks.some(p => ["hot", "over"].includes(p));
  if (early && late) return "早い炭と遅い炭がある。黒い面が消えて全面が赤くなった炭から取り出そう";
  if (late) return res.over ? "取り出しが遅れた炭がある。次は全面が赤くなったら、待たずに取り出そう"
    : "少し遅れた炭がある。次は全面が赤くなった頃合いで取り出そう";
  return early ? "早く取り出した炭がある。次は黒い面が消えるまで待とう" : "";
}

// 1〜4個の炭を焼く本体。最初の炭焼きと、熱管理で消耗した炭を交換するときの両方で使う（TH39）。
export async function burnCoals(cs, panel, { count = 3, compact = false, onPick = null } = {}) {
  const tutorial = cs.mode === "tutorial";
  const types = coalTypes(cs, count);
  const justSec = coalJustSeconds(skill.window(cs), tutorial, state?.goods || []);
  const baseJustSec = coalJustSeconds(skill.window(cs) / (1 + 0.45 * effectTier("sense")), tutorial, state?.goods || []);
  const plainBase = coalJustSeconds(skill.window(cs) / (1 + 0.45 * effectTier("sense")), tutorial, []);
  const clarity = skill.clarity(cs);

  await waitBenchReady(cs, "heat", { count });
  const view = buildHeatView(types, { count, compact });
  const { info, feedback } = view;
  if (effectVisible("sense")) info.prepend(senseBand(plainBase, 90, justSec - baseJustSec));
  if (effectVisible("insight")) view.root.classList.add("insight-visible");
  const coals = view.coals.map(c => ({ ...c,
    tj: rand(4.2, 7.4) * (tutorial ? 1.25 : 1),
    picked: null, timing: null, p: 0,
  }));
  panel.append(view.root);

  const gameClock = createCraftClock(panel);
  let t0 = null;
  let raf = 0;
  let finished = false;
  let done;
  const finishedP = new Promise((r) => { done = r; });

  const pick = (c, elapsedSeconds = (gameClock.now() - t0) / 1000, automatic = false) => {
    if (c.picked || finished || t0 === null || gameClock.paused) return;
    const timing = evaluateCoalTiming(elapsedSeconds, c.tj, justSec);
    const g = timing.phase;
    c.p = elapsedSeconds / c.tj;
    c.picked = g;
    const index = coals.indexOf(c);
    c.timing = { ...timing, coal: index + 1, automatic };
    const G = HEAT_GRADES[g];
    // 入力時刻で先に判定し、同じ素材・その時の焼け具合を炭壺へ残す。
    paint(c, c.p);
    view.recordPick(index, { ...c.timing, errorText: formatTimingError(timing.errorSeconds) });
    reactAudience(cs, G.kind);
    c.node.classList.add("picked", `g-${g}`);
    c.node.classList.remove("pikan", "soon");
    c.node.disabled = true;
    c.node.dataset.phase = g;
    if (g === "just") { SE.just(); tickerSay("パッキー「出たーッ！ EXCELLENT！ 全面が真っ赤だーッ！」"); }
    else if (g === "pre" || g === "hot") SE.good();
    else SE.miss();
    SE.coalSnip();
    onPick?.(c.timing, index, coals.length);
    if (coals.every((x) => x.picked)) finish();
  };

  const paint = (c, progress) => {
    // かなり焼けた状態から始める：赤い面は startBurn から始まり、全面が赤くなる取り頃（progress=1）で 1.0 に届く。
    const b = HEAT_TUNING.startBurn;
    c.node.style.setProperty("--red", clamp(b + (1 - b) * progress, 0, 1).toFixed(3));
    c.node.style.setProperty("--hot", clamp((progress - .85) / .3, 0, 1).toFixed(3));
    c.node.style.setProperty("--ash", clamp((progress - .9) / .5, 0, 1).toFixed(3));
  };

  const loop = (now) => {
    if (finished) return;
    const t = (gameClock.now() - t0) / 1000;
    if (gameClock.paused) { raf = requestAnimationFrame(loop); return; }
    for (const c of coals) {
      if (c.picked) continue;
      c.p = t / c.tj;
      const jw = justSec / c.tj;
      const ph = phaseOf(c.p, jw);
      const n = c.node;
      paint(c, c.p);
      n.dataset.phase = ph;
      // 洞察★: ジャスト直前にかすかな揺らぎ（読みやすさ）
      n.classList.toggle("soon", clarity > 0 && ph === "pre" && c.p > 1 - 0.1 * clarity);
      if (effectVisible("insight") && n.classList.contains("soon") && !n.querySelector(".effect-badge")) n.append(effectBadge("insight", "察"));
      if (ph === "just" && !n.classList.contains("pikan")) { n.classList.add("pikan"); SE.tick(); }
      if (ph !== "just") n.classList.remove("pikan");
      if (c.p > 1.75) pick(c, t, true); // 放っておくと灰になって勝手に落ちる
    }
    if (!finished) raf = requestAnimationFrame(loop);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    gameClock.dispose();
    done();
  };

  coals.forEach((c) => {
    c.node.addEventListener("pointerdown", e => { e.preventDefault(); pick(c); });
    c.node.addEventListener("click", e => { if (e.detail === 0) pick(c); });
  });

  await countdown();
  SE.crackle();
  t0 = gameClock.now();
  view.root.setAttribute("aria-busy", "false");
  raf = requestAnimationFrame(loop);

  const auto = autoSkill();
  if (auto) {
    (async () => {
      for (const c of coals) {
        // 上手=ジャストの真ん中／下手=早取りか遅取り
        const target = auto === "good" ? c.tj * (1 + (justSec / c.tj) / 2) : c.tj * (Math.random() < 0.5 ? 0.55 : 1.55);
        pick(c, target);
        await sleep(40);
      }
    })();
  }
  await finishedP;

  const picks = coals.map((c) => c.picked);
  const timings = coals.map((c) => c.timing);
  const timingSummary = summarizeCoalTimings(timings);
  const avg = (k) => picks.reduce((s, g) => s + HEAT_GRADES[g][k], 0) / picks.length;
  const score = timingSummary.accuracy;
  const res = {
    score, grade: gradeOf(score), picks, timings,
    timingAccuracy: score, meanAbsoluteError: timingSummary.meanAbsoluteError,
    just: picks.filter((g) => g === "just").length,
    early: picks.filter((g) => g === "raw" || g === "early").length,
    over: picks.filter((g) => g === "over").length,
    heatPower: clamp(50 + avg("hp"), 0, 100),
    heatStability: clamp(50 + avg("hs"), 0, 100),
    startup: clamp(50 + avg("su"), 0, 100),
    burnRisk: clamp(30 + avg("br"), 0, 100),
    aromaRetention: clamp(55 + avg("ar"), 0, 100),
    flash: picks.includes("just"),
  };
  return { res, timings, picks, info, feedback };
}
