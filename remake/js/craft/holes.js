// アルミ穴あけ BATTLE（master_spec 第2部 §1）
// テンプレートの配置を選び、円周を回るカーソルが目印に重なった瞬間に打つ。
// メイン評価は均等度。実際の穴数・リング配置を後工程の熱へ渡す。
import { el, sleep, clamp, rand } from "../core/util.js";
import { createCraftClock } from "./clock.js";
import { countdown } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, showStepDemo, refreshBench, tickerSay, reactAudience, scoreStep, waitBenchReady, setBenchHoleAction } from "./session.js";
import { effectBadge, effectLine, effectVisible, senseBand, effectTier } from "./effect-visual.js";
import { gradeOf, autoSkill, skill, resultCard, keys, popStamp } from "./common.js";
import { craftCondition } from "../core/condition.js";
import { artImg } from "./art.js";

import { RINGS, circularAngleDistance, templateComplete, evaluateFoil, usesFoil, skippedFoilResult } from "./holes_logic.js";
import { HOLE_TEMPLATES, DEFAULT_HOLE_TEMPLATE, availableHoleTemplates, ringsForTemplate, templateCountsLabel } from "./holes_templates.js";
import { stepVent } from "./steps.js";
export { RINGS } from "./holes_logic.js";
const TIME_LIMIT = 32;
const DEG = Math.PI / 180;
const foilSurface = () => artImg("foil_interactive_top.png", 430, "foil-surface", { h: 430 });

async function chooseTemplate(panel, cs) {
  // Saved sessions keep their captured choices and selected legacy layout.
  const available = cs.availableHoleTemplateIds || availableHoleTemplates().map(template => template.id);
  const templates = HOLE_TEMPLATES.filter(template => available.includes(template.id) || template.id === cs.holeTemplateId);
  let selected = templates.find((template) => template.id === cs.holeTemplateId)
    || templates.find((template) => template.id === DEFAULT_HOLE_TEMPLATE) || templates[0];
  const preview = el("div.foil.ht-preview", { role: "img", dataset: { test: "hole-preview" } });
  const counts = el("div.ht-counts", { dataset: { test: "hole-template-counts" } });
  const note = el("small.ht-note");
  const description = el("p.ht-description", { "aria-live": "polite" });
  const choices = templates.map((template) => {
    const button = el("button.btn.ht-option", { dataset: { test: `hole-template-${template.id}` } }, [
      el("span.btn-label", { text: template.label }),
    ]);
    button.addEventListener("click", () => { selected = template; SE.good(); draw(); });
    return button;
  });
  const start = el("button.btn.primary", { dataset: { test: "hole-start" } }, [el("span.btn-label", { text: "この配置で穴あけを始める" })]);
  panel.append(el("div.holes", [
    el("div.hr-stage", [preview]),
    el("div.ht-side", [
      el("b.ht-title", { text: "穴あけテンプレート" }), ...choices, counts, description,
      el("details.ht-help", [
        el("summary", { text: "穴数と熱の回り方" }),
        el("p", { text: "多い穴は熱が早く回り、安定しやすい。穴あけでズレる機会も増える" }),
        el("p", { text: "少ない穴は穴あけが楽。熱はゆっくり入り、吸い方で温度が動きやすい" }),
      ]),
      note, start,
    ]),
  ]));
  function draw() {
    const plane = el("div.foil-target-plane");
    preview.replaceChildren(foilSurface(), plane);
    preview.setAttribute("aria-label", `${selected.label}：${templateCountsLabel(selected)}`);
    RINGS.forEach((ring) => plane.append(el("div.foil-ring", {
      style: { width: `${ring.r * 100}%`, height: `${ring.r * 100}%`, opacity: selected.counts[ring.id] ? "1" : ".2" },
    })));
    for (const ring of ringsForTemplate(selected)) {
      for (let k = 0; k < ring.targets; k++) {
        const a = -Math.PI / 2 + k * 2 * Math.PI / ring.targets;
        plane.append(el("i.foil-marker.planned", { style: {
          left: `${50 + Math.cos(a) * ring.r * 50}%`, top: `${50 + Math.sin(a) * ring.r * 50}%`,
        }, dataset: { ring: ring.id } }));
      }
    }
    choices.forEach((button, i) => button.setAttribute("aria-pressed", String(templates[i] === selected)));
    counts.textContent = templateCountsLabel(selected);
    note.textContent = `計${Object.values(selected.counts).reduce((sum, count) => sum + count, 0)}穴。熱の広がりは配置でも変わる`;
    description.textContent = selected.description;
  }
  draw();
  await new Promise((resolve) => {
    start.addEventListener("click", resolve, { once: true });
    if (autoSkill()) start.click();
  });
  SE.good();
  cs.holeTemplateId = selected.id;
  return selected;
}

export async function runHoles(cs) {
  // ロートスHMDはアルミなし。穴あけ工程を飛ばし、中立な穴あけ相当値だけ残して次の工程へ。
  if (!usesFoil(cs)) {
    await stepVent(cs);
    cs.holes = skippedFoilResult(cs.vent);
    refreshBench();
    return;
  }
  await waitBenchReady(cs, "holes");
  const tutorial = cs.mode === "tutorial";
  const panel = stepPanel("holes", "アルミ穴あけ", "配置図を見てテンプレートを選ぶ。開始してから、光が目印に重なった瞬間にタップ（Space）", { brief: "穴の配置を選んでから、穴あけを始める" });
  await showStepDemo(cs, "holes");
  const template = await chooseTemplate(panel, cs);
  stepPanel("holes", "アルミ穴あけ", "光が目印に重なった瞬間にタップ（Space）。リングが完成したら「次のリングへ」。選んだ配置を開け終えて仕上げる");
  const rings = ringsForTemplate(template);
  const slow = skill.slow(cs) * (tutorial ? 1.3 : 1);
  const perfWin = 4.2 * skill.window(cs) * (tutorial ? 1.5 : 1);
  const basePerfWin = perfWin / (1 + 0.45 * effectTier("sense"));
  const goodWin = 11 * craftCondition(cs).window * (tutorial ? 1.3 : 1) * (cs.retryAssist ? 1.35 : 1);
  const limit = tutorial ? 48 : TIME_LIMIT;

  // ---- 画面
  const D = 430;
  const disc = el("div.foil", { style: { width: `${D}px`, height: `${D}px` }, dataset: { test: "foil" } });
  const ringEls = rings.map((rg) => el("div.foil-ring", { style: { width: `${rg.r * 100}%`, height: `${rg.r * 100}%` }, dataset: { ring: rg.id } }));
  const markers = el("div.foil-markers");
  const holesLayer = el("div.foil-holes");
  const cursor = el(`div.foil-cursor${effectVisible("technique") ? ".technique-visible" : ""}`);
  disc.append(foilSurface(), el("div.foil-target-plane", [...ringEls, markers, holesLayer, cursor]));
  const ringLabel = el("div.hr-ring");
  const timeBar = el("i.hr-time-bar", [el("b")]);
  const scoreEl = el("div.hr-score");
  const comboEl = el("div.hr-combo");
  const feedback = el("div.hr-feedback", { "aria-live": "polite", dataset: { test: "hole-feedback" } });
  const report = (text, kind) => {
    reactAudience(cs, kind);
    feedback.replaceChildren();
    popStamp(feedback, text, kind, "50%", "50%");
  };
  const role = el("div.hr-role");
  const plan = el("div.hr-plan", { dataset: { test: "hole-plan" } });
  const punchBtn = el("button.btn.primary.hr-punch", { dataset: { test: "hole-punch" } }, [el("span.btn-label", { text: "穴を開ける" })]);
  const nextBtn = el("button.btn.small", { text: "次のリングへ", dataset: { test: "hole-next" } });
  const doneBtn = el("button.btn.small.ghost", { text: "穴あけを終えて結果へ", dataset: { test: "hole-done" } });
  panel.append(el("div.holes", [
    el("div.hr-stage", [disc, el("div.foil-legend", { "aria-label": "穴あけの目印" }, [
      el("span", [el("i.foil-marker.cur.next", { "aria-hidden": "true" }), "次の目標"]),
      el("span", [el("i.foil-cursor", { "aria-hidden": "true" }), "動く光"]),
      el("span", [el("i.foil-hole", { "aria-hidden": "true" }), "開いた穴"]),
    ])]),
    el("div.hr-side", [el("small.ht-current", { text: template.label }), ringLabel, role,
      effectVisible("technique") ? effectBadge("technique", "技") : null,
      senseBand(basePerfWin, 12), effectLine("technique", "技", "技術でゲージがゆっくり"),
      el("div.hr-time", [el("span", { text: "TIME" }), timeBar]), scoreEl, comboEl, feedback, plan, punchBtn, el("div.hr-row", [nextBtn, doneBtn])]),
  ]));

  // ---- 状態
  const state = rings.map((rg) => ({
    ...rg,
    phase: rand(0, Math.PI * 2),
    taken: new Array(rg.targets).fill(false),
    holes: [], // {a, d}
    extra: 0,
  }));
  let ri = 0;
  const gameClock = createCraftClock(panel);
  let t0 = null;
  let elapsed = 0;
  let combo = 0;
  const tally = { perfect: 0, good: 0, miss: 0, tooClose: 0, blank: 0, tooMany: 0 };
  let finished = false;
  let raf = 0;

  const targetAngle = (ring, k) => ring.phase + (k * 2 * Math.PI) / ring.targets;
  const cursorAngle = () => {
    const ring = state[ri];
    return ring.phase + ((2 * Math.PI) * elapsed) / (ring.period * slow);
  };
  const posOf = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  const place = (node, a, r) => {
    const [x, y] = posOf(a, r);
    node.style.left = `${50 + x * 50}%`;
    node.style.top = `${50 + y * 50}%`;
  };
  const angDiff = circularAngleDistance;
  const complete = () => templateComplete(state);
  const ringComplete = () => state[ri].taken.every(Boolean);

  let currentMarkers = [];
  let highlighted = null;
  const highlightNext = () => {
    const ring = state[ri], a = cursorAngle(), turn = Math.PI * 2;
    // 近くの判定範囲内では実際に採点される点、それ以外は次に光が通る点を案内する。
    // 表示だけの目安で、穴を開ける順番・判定窓には制約を加えない。
    const ranked = currentMarkers.map(entry => {
      const angle = targetAngle(ring, entry.k), distance = angDiff(a, angle);
      return { node: entry.node, priority: distance <= goodWin * DEG ? distance - turn : ((angle - a) % turn + turn) % turn };
    });
    const next = ranked.reduce((best, entry) => !best || entry.priority < best.priority ? entry : best, null)?.node || null;
    if (next !== highlighted) {
      highlighted?.classList.remove("next");
      next?.classList.add("next");
      highlighted = next;
    }
    cursor.hidden = ringComplete();
  };
  const drawMarkers = () => {
    markers.replaceChildren();
    currentMarkers = [];
    highlighted = null;
    state.forEach((ring, idx) => {
      ring.taken.forEach((tk, k) => {
        if (tk) return;
        const m = el(`i.foil-marker${idx === ri ? ".cur" : ""}`);
        place(m, targetAngle(ring, k), ring.r);
        markers.append(m);
        if (idx === ri) currentMarkers.push({ node: m, k });
      });
    });
    ringEls.forEach((e, idx) => e.classList.toggle("cur", idx === ri));
    ringLabel.textContent = `${state[ri].label}（${state[ri].taken.filter(Boolean).length}/${state[ri].targets}）`;
    role.textContent = state[ri].role;
    highlightNext();
  };
  const addHoleDot = (a, r, kind) => {
    const h = el(`i.foil-hole.${kind}`);
    h.style.setProperty("--scratch-angle", `${(holesLayer.childElementCount * 137) % 180 - 90}deg`);
    place(h, a, r);
    holesLayer.append(h);
  };
  const hud = () => {
    scoreEl.textContent = `EXCELLENT ${tally.perfect} · GOOD ${tally.good} · MISS ${tally.miss + tally.tooClose}`;
    comboEl.textContent = combo >= 2 ? `${combo} COMBO` : "";
    const ready = complete();
    punchBtn.disabled = finished || ringComplete();
    nextBtn.disabled = finished || !ringComplete() || ri === state.length - 1;
    doneBtn.disabled = finished || !ready;
    plan.textContent = ready ? "選んだ配置が完成。結果を確認しよう"
      : ringComplete() ? "リング完成。「次のリングへ」で残りの目印を開けよう"
      : elapsed >= limit ? "時間評価は終了。穴あけは続けられます"
      : `${state[ri].label}の${state[ri].targets}か所を、目印に沿って開けよう`;
  };

  const closeRing = (ring) => {
    if (ring.closed) return;
    ring.closed = true;
    const left = ring.taken.filter((x) => !x).length;
    tally.blank += left;
    return left;
  };
  const advanceRing = () => {
    if (finished || !ringComplete()) return;
    closeRing(state[ri]);
    if (ri < state.length - 1) { ri++; drawMarkers(); hud(); place(cursor, cursorAngle(), state[ri].r); SE.whoosh(); }
    else finish();
  };

  const punch = () => {
    if (finished || t0 === null || gameClock.paused) return;
    const ring = state[ri];
    if (ring.closed || ring.taken.every(Boolean)) return;
    const a = cursorAngle();
    SE.foilPunch();
    // 一番近い「まだ開けていない目印」
    let best = -1, bestD = Infinity;
    ring.taken.forEach((tk, k) => {
      const d = angDiff(a, targetAngle(ring, k));
      if (!tk && d < bestD) { bestD = d; best = k; }
    });
    const dDeg = bestD / DEG;
    // 既に開けた穴のすぐ隣か
    const near = ring.holes.some((h) => angDiff(h.a, a) / DEG < goodWin * 0.8);
    let kind;
    if (best >= 0 && dDeg <= perfWin) kind = "perfect";
    else if (best >= 0 && dDeg <= goodWin) kind = "good";
    else if (near) kind = "close";
    else kind = "miss";
    if (kind === "perfect" || kind === "good") {
      ring.taken[best] = true;
      ring.holes.push({ a, d: dDeg });
      tally[kind]++;
      combo++;
      report(kind === "perfect" ? "EXCELLENT" : "GOOD", kind);
    } else {
      ring.holes.push({ a, d: goodWin * 1.5 });
      ring.extra++;
      combo = 0;
      if (kind === "close") { tally.tooClose++; report("TOO CLOSE", "bad"); }
      else { tally.miss++; report("ズレた…", "miss"); }
      if (ring.id === "inner") tally.tooMany++;
    }
    addHoleDot(a, ring.r, kind);
    setBenchHoleAction(cs, {
      dots: state.flatMap(rg => rg.holes.map(h => posOf(h.a, rg.r))), target: posOf(a, ring.r),
    });
    if (ring.taken.every(Boolean)) {
      const clean = ring.holes.every((h) => h.d <= perfWin) && ring.extra === 0;
      report(clean ? "BEAUTIFUL RING" : "RING COMPLETE", "just");
      SE.perfect();
      tickerSay(clean ? "パッキー「きれいに揃ったーッ！ 見てくださいこの輪！」" : "パッキー「リング完成！ 手が止まりませんね〜♪」");
      // 自動送りはしない。完成したリングは入力を止め、次のリングか仕上げを選んでもらう。
    }
    drawMarkers();
    if (complete()) {
      // Freeze at the final real punch, including the time score. Finishing and
      // the result confirmation remain explicit even after the time limit.
      elapsed = (gameClock.now() - t0) / 1000;
      cancelAnimationFrame(raf);
      drawTime();
    }
    hud();
  };

  const drawTime = () => {
    timeBar.querySelector("b").style.width = `${clamp(100 - (elapsed / limit) * 100, 0, 100)}%`;
  };
  const loop = (now) => {
    if (finished || complete()) return;
    elapsed = (gameClock.now() - t0) / 1000;
    if (gameClock.paused) { raf = requestAnimationFrame(loop); return; }
    const a = cursorAngle();
    place(cursor, a, state[ri].r);
    highlightNext();
    drawTime();
    hud();
    raf = requestAnimationFrame(loop);
  };

  let done;
  const finishedP = new Promise((r) => { done = r; });
  const finish = () => {
    if (finished || !complete()) return;
    finished = true;
    cancelAnimationFrame(raf);
    gameClock.dispose();
    unkey();
    state.forEach(closeRing);
    done();
  };

  // ---- 入力
  disc.addEventListener("pointerdown", (e) => { e.preventDefault(); punch(); });
  punchBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); punch(); });
  nextBtn.addEventListener("click", advanceRing);
  doneBtn.addEventListener("click", finish);
  const unkey = keys({ " ": punch, Space: punch, Enter: finish });

  drawMarkers();
  hud();
  place(cursor, state[0].phase, state[0].r);
  await countdown();
  t0 = gameClock.now();
  raf = requestAnimationFrame(loop);

  const auto = autoSkill();
  if (auto) simulate(auto);
  await finishedP;

  // ---- 採点（実穴の均等度50/タイミング精度30/穴サイズ15/残り時間5。穴数そのものは減点しない）
  const res = evaluate(state, tally, Math.max(0, limit - elapsed) / limit, goodWin);
  res.templateId = template.id;
  res.templateLabel = template.label;
  res.plannedCounts = { ...template.counts };
  cs.holes = res;
  scoreStep(cs, "holes", res.score, "穴あけ");
  refreshBench();
  await sleep(300);
  await resultCard(panel, {
    title: "穴あけ 結果",
    button: "確認して次の工程へ",
    grade: res.grade,
    lines: [
      `テンプレート：${template.label}`,
      res.evenness > 0.8 ? "穴の間隔が揃い、熱が回りやすそうだ" : "穴の間隔にばらつきがある。次は目印をよく見よう",
      `外周 ${res.outer}・中周 ${res.middle}・内周 ${res.inner}（計 ${res.total} 穴）`,
      res.innerExcess ? "内周を開けすぎた。焦げやすくなるかもしれない" : res.outerEven > 0.8 ? "外周がきれいに揃った。熱が全体に回りそうだ" : "",
      res.total < 24 ? "穴を控えめに仕上げた。吸い出しでは温度の動きをよく見よう" : "",
    ],
  });

  // 自動操作（テスト）: 次に回ってくる目印の時刻まで時計を進めて打つ（上手=ぴったり／下手=ズレる＋開け残す）
  function simulate(level) {
    (async () => {
      await sleep(80);
      while (!finished) {
        const ring = state[ri];
        if (ring.taken.every(Boolean)) {
          advanceRing();
          await sleep(level === "bad" ? 30 : 400);
          continue;
        }
        const omega = (2 * Math.PI) / (ring.period * slow);
        const err = level === "good" ? 0 : rand(5, 10) * DEG;
        const cur = (omega * elapsed) % (2 * Math.PI);
        let wait = Infinity;
        ring.taken.forEach((tk, k) => {
          if (tk) return;
          const want = ((2 * Math.PI * k) / ring.targets + err) % (2 * Math.PI);
          wait = Math.min(wait, ((want - cur + 4 * Math.PI) % (2 * Math.PI)) / omega);
        });
        t0 -= wait * 1000;
        elapsed += wait;
        punch();
        await sleep(25);
      }
    })();
  }
}

export function evaluate(rings, tally, timeRatio, goodWin) {
  const result = evaluateFoil(rings, tally, timeRatio, goodWin);
  return { ...result, grade: gradeOf(result.score) };
}
