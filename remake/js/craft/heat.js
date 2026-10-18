// 炭焼き（master_spec 第2部 §2）
// ゲージ停止ではなく、炭の見た目（黒→赤→赤熱→ピカン→白熱→灰かぶり）を観察して取る。
// ジャストの瞬間だけ、炭の芯そのものが一瞬光る。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshBench, tickerSay, reactAudience, scoreStep, waitBenchReady } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard } from "./common.js";
import { buildHeatView, coalSpots } from "./heat_view.js";
import { HEAT_GRADES, phaseOf, evaluateCoalTiming, formatTimingError, summarizeCoalTimings } from "./heat_logic.js";
export { HEAT_GRADES } from "./heat_logic.js";
import { coalCount, coalTypes } from "./coals.js";
import { createCraftClock } from "./clock.js";

export async function runHeat(cs) {
  await waitBenchReady(cs, "heat");
  const panel = stepPanel("heat", "炭焼き", "炭の色をよく見て。芯が一瞬ピカッと光ったら、その炭をタップして取り上げる");
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
    advice: res.over ? "焼きすぎた炭がある。次は芯が光ったら、待たずに取り出そう"
      : res.early ? "早く取り出した炭がある。次は芯が光るまで待とう" : "芯が光る瞬間を目印に、次も取り出そう",
    grade: res.grade,
    summary: [
      ...timings.map((timing, i) => `${coalSpots(coalCount(cs))[i][2]} ${timing.rating}：${formatTimingError(timing.errorSeconds)}（${timing.label}${timing.automatic ? "・自動" : ""}）`),
      `全体のタイミング精度 ${res.timingAccuracy}% ／ 平均誤差 ${res.meanAbsoluteError.toFixed(2)}秒`,
    ],
    lines: [
      picks.map((g) => HEAT_GRADES[g].label).join("・"),
      res.just === coalCount(cs) ? "全部、芯が光った瞬間に取れた。火が素直だ" : res.just ? "光った瞬間を掴めた炭がある" : "光る瞬間を逃した。火力が読みにくい",
      res.over ? "焼きすぎの炭がある。香りが飛びやすいかもしれない" : res.early ? "早取りの炭がある。立ち上がりが遅れそうだ" : "",
    ],
  });
}

// 1〜4個の炭を焼く本体。最初の炭焼きと、熱管理で消耗した炭を交換するときの両方で使う（TH39）。
export async function burnCoals(cs, panel, { count = 3, compact = false, onPick = null } = {}) {
  const tutorial = cs.mode === "tutorial";
  const types = coalTypes(cs, count);
  const justSec = 0.5 * skill.window(cs) * (tutorial ? 1.5 : 1);
  const clarity = skill.clarity(cs);

  await waitBenchReady(cs, "heat", { count });
  const view = buildHeatView(types, { count, compact });
  const { info, feedback } = view;
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
    if (g === "just") { SE.just(); tickerSay("パッキー「出たーッ！ EXCELLENT！ 芯まで焼けたーッ！」"); }
    else if (g === "pre" || g === "hot") SE.good();
    else SE.miss();
    SE.coalSnip();
    onPick?.(c.timing, index, coals.length);
    if (coals.every((x) => x.picked)) finish();
  };

  const paint = (c, progress) => {
    const jw = justSec / c.tj;
    c.node.style.setProperty("--red", clamp((progress - .3) / .45, 0, 1).toFixed(3));
    c.node.style.setProperty("--hot", clamp((progress - .85) / .3, 0, 1).toFixed(3));
    c.node.style.setProperty("--ash", clamp((progress - (1.15 + jw)) / .35, 0, 1).toFixed(3));
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
        // 上手=ジャストの真ん中／下手=早取りか焼きすぎ
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
