// 炭焼き（master_spec 第2部 §2）
// ゲージ停止ではなく、炭の見た目（黒→赤→赤熱→ピカン→白熱→灰かぶり）を観察して取る。
// ジャストの瞬間だけ、炭の芯そのものが一瞬光る。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown, flash } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshBench, tickerSay, reactAudience, scoreStep, waitBenchReady } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, popStamp } from "./common.js";
import { artImg } from "./art.js";
import { HEAT_GRADES, phaseOf, evaluateCoalTiming, formatTimingError, summarizeCoalTimings } from "./heat_logic.js";
export { HEAT_GRADES } from "./heat_logic.js";
import { coalCount, coalTypes } from "./coals.js";

export async function runHeat(cs) {
  await waitBenchReady(cs);
  const panel = stepPanel("heat", "炭焼き", "炭の色をよく見て。芯が一瞬ピカッと光ったら、その炭をタップして取り上げる");
  // 炭を一つ取るたびに、その炭の分の点がスコアへ入る（TH42）。
  const { res, timings, picks, info } = await burnCoals(cs, panel, { count: coalCount(cs), onPick: (timing, i, count) => scoreStep(cs, `heat:${i}`, timing.score / count) });
  cs.heat = res;
  scoreStep(cs, "heat", res.score, "炭焼き");
  refreshBench();
  await sleep(350);
  if (res.heatStability >= 70) popStamp(panel, "HEAT STABLE", "good", "50%", "60%");
  if (res.aromaRetention >= 68) popStamp(panel, "AROMA KEEP", "good", "50%", "70%");
  info.classList.add("heat-finished");
  await resultCard(panel, {
    title: "炭焼き 結果",
    grade: res.grade,
    summary: [
      ...timings.map((timing) => `炭${timing.coal} ${timing.rating}：${formatTimingError(timing.errorSeconds)}（${timing.label}${timing.automatic ? "・自動" : ""}）`),
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
const SPOT_SETS = {
  1: [[0.5, 0.40, 1]],
  2: [[0.39, 0.42, 1], [0.61, 0.42, 1]],
  // コイルの上に三角に並べる（中心座標はコンロ素材の中身に対する比。奥の炭ほど少し小さい）
  3: [[0.5, 0.30, 0.90], [0.38, 0.45, 1], [0.62, 0.45, 1]],
  4: [[0.39, 0.29, .90], [0.61, 0.29, .90], [0.35, 0.47, 1], [0.65, 0.47, 1]],
};
export async function burnCoals(cs, panel, { count = 3, compact = false, onPick = null } = {}) {
  const tutorial = cs.mode === "tutorial";
  const types = coalTypes(cs, count);
  const img = (st, i) => (types[i] === "cube_charcoal" ? `coal_${st}.png` : `coal_flat_${st}.png`);
  const justSec = 0.5 * skill.window(cs) * (tutorial ? 1.5 : 1);
  const clarity = skill.clarity(cs);

  const stove = el("div.stove", [artImg("stove_coil.png", compact ? 420 : 520, "stove-img")]);
  const SPOTS = SPOT_SETS[count] || SPOT_SETS[3];
  const coals = SPOTS.map((_, i) => {
    const [cx, cy, k] = SPOTS[i];
    const node = el("button.coal", {
      dataset: { test: `coal-${i}` },
      "aria-label": `炭${i + 1}を取り出す`,
      style: { left: `${cx * 100}%`, top: `${cy * 100}%`, "--k": String(k), zIndex: String(Math.round(cy * 10)) },
    }, [
      artImg(img("cold", i), 118, "c-cold"),
      artImg(img("red", i), 118, "c-red"),
      artImg(img("just", i), 118, "c-hot"),
      artImg(img("white", i), 118, "c-ash"),
      el("i.c-core"),
      el("i.c-burst"),
      el("span.coal-number", { text: String(i + 1), "aria-hidden": "true" }),
    ]);
    stove.append(node);
    return {
      node,
      tj: rand(4.2, 7.4) * (tutorial ? 1.25 : 1), // ジャストまでの秒数（炭ごとに焼けるスピードが違う）
      picked: null,
      timing: null,
      p: 0,
    };
  });
  const timingRows = coals.map((_, i) => el("li", { dataset: { test: `coal-timing-${i}` } }, [
    el("b", { text: `炭${i + 1}` }), el("span", { text: "焼成中" }),
  ]));
  const info = el("div.heat-info", [
    el("div.hi-row", [el("span", { text: "黒い芯" }), el("i"), el("span", { text: "赤熱" }), el("i"), el("b", { text: "芯が光る" }), el("i"), el("span", { text: "白熱" }), el("i"), el("span", { text: "灰かぶり" })]),
    el("ol.heat-picks", { "aria-live": "polite", "aria-label": "各炭のタイミング" }, timingRows),
  ]);
  panel.append(el(`div.heat${compact ? ".heat-compact" : ""}`, [stove, info]));

  let t0 = 0;
  let raf = 0;
  let finished = false;
  let done;
  const finishedP = new Promise((r) => { done = r; });

  const pick = (c, elapsedSeconds = (performance.now() - t0) / 1000, automatic = false) => {
    if (c.picked || finished || !t0) return;
    const timing = evaluateCoalTiming(elapsedSeconds, c.tj, justSec);
    const g = timing.phase;
    c.p = elapsedSeconds / c.tj;
    c.picked = g;
    const index = coals.indexOf(c);
    c.timing = { ...timing, coal: index + 1, automatic };
    const G = HEAT_GRADES[g];
    timingRows[index].replaceChildren(
      el("b", { text: `炭${index + 1} ${timing.rating}（${G.label}）` }),
      el("span", { text: `${formatTimingError(timing.errorSeconds)}${automatic ? "・自動取り出し" : ""}` }),
    );
    timingRows[index].dataset.rating = timing.rating;
    reactAudience(cs, G.kind);
    c.node.classList.add("picked", `g-${g}`);
    c.node.classList.remove("pikan", "soon");
    c.node.disabled = true;
    c.node.dataset.phase = g;
    popStamp(panel, G.stamp, G.kind, `${22 + index * (count > 1 ? 44 / (count - 1) : 0) + (count === 1 ? 22 : 0)}%`, "28%");
    if (g === "just") { SE.just(); flash("gold"); tickerSay("パッキー「出たーッ！ EXCELLENT！ 芯まで焼けたーッ！」"); }
    else if (g === "pre" || g === "hot") SE.good();
    else SE.miss();
    SE.coalSnip();
    onPick?.(c.timing, index, coals.length);
    if (coals.every((x) => x.picked)) finish();
  };

  const loop = (now) => {
    if (finished) return;
    const t = (now - t0) / 1000;
    for (const c of coals) {
      if (c.picked) continue;
      c.p = t / c.tj;
      const jw = justSec / c.tj;
      const ph = phaseOf(c.p, jw);
      const n = c.node;
      // 見た目: 素材の重ね合わせで色を移ろわせる
      const red = clamp((c.p - 0.3) / 0.45, 0, 1);
      const hot = clamp((c.p - 0.85) / 0.3, 0, 1);
      const ash = clamp((c.p - (1.15 + jw)) / 0.35, 0, 1);
      n.style.setProperty("--red", red.toFixed(3));
      n.style.setProperty("--hot", hot.toFixed(3));
      n.style.setProperty("--ash", ash.toFixed(3));
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
    done();
  };

  coals.forEach((c) => c.node.addEventListener("pointerdown", (e) => { e.preventDefault(); pick(c); }));

  await countdown();
  SE.crackle();
  t0 = performance.now();
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
  return { res, timings, picks, info };
}
