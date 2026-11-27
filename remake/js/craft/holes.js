// アルミ穴あけ BATTLE（master_spec 第2部 §1）
// テンプレートの配置を選び、光る目印の近くだけを動く針が重なった瞬間に押して刺す（#2937 案1）。
// 押している長さで刺し加減が変わり、穴の大きさに差が出る（#2937 案5）。
// メイン評価は均等度。実際の穴数・リング配置を後工程の熱へ渡す。
import { el, sleep, clamp, rand } from "../core/util.js";
import { createCraftClock } from "./clock.js";
import { countdown } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshBench, tickerSay, reactAudience, scoreStep, waitBenchReady, setBenchHoleAction, benchRoot, explainTutorialStep } from "./session.js";
import { effectBadge, effectLine, effectVisible, senseBand, effectTier } from "./effect-visual.js";
import { gradeOf, autoSkill, skill, resultCard, keys, popStamp } from "./common.js";
import { craftCondition } from "../core/condition.js";
import { state as gameState } from "../core/state.js";
import { growthSkill, settleGrowthPhase, SKILL_TUNING } from "../core/growth-effects.js";
import { artImg } from "./art.js";
import { sparks, burstFlash, shockRing, fxMode } from "./fx.js";

import { RINGS, circularAngleDistance, templateComplete, evaluateFoil, usesFoil, skippedFoilResult,
  NEEDLE, needleHalfArc, needleOffset, referenceDegrees, HOLE_SIZES, pressDepth, pressLimit } from "./holes_logic.js";
import { HOLE_TEMPLATES, DEFAULT_HOLE_TEMPLATE, availableHoleTemplates, ringsForTemplate, templateCountsLabel } from "./holes_templates.js";
import { stepVent } from "./steps.js";
import { craftStageEnabled } from "./stage-layout.js";
import { holePatternMark } from "./choice-marks.js";
import { renewalCraft } from "../core/craft-version.js";
import { assistEffect } from "./retry-assist-level.js";
export { RINGS } from "./holes_logic.js";
/**
 * 穴あけの手触りの調整値（CRN・P8）。試遊ページの ?tune=holes.timeLimit:40 で差し替えて試せる。
 * timeLimit: 時間評価の秒（レッスンは lessonTimeLimit）／perfectDeg・goodDeg: EXCELLENT・GOOD の判定幅（基準角の度）
 * lessonSlow・lessonPerfect・lessonGood: レッスンで針をゆっくり・幅を広くする倍率
 */
export const HOLES_TUNING = { timeLimit: 32, lessonTimeLimit: 48, perfectDeg: 4.2, goodDeg: 11, lessonSlow: 1.3, lessonPerfect: 1.5, lessonGood: 1.3 };
// リングが埋まってから次のリング（最後なら結果）へ自動で進むまで（CRN02）。完成の演出を見せる間。
const RING_ADVANCE_MS = 600;
const DEG = Math.PI / 180;
const foilSurface = () => artImg("foil_interactive_top.png", 430, "foil-surface", { h: 430 });
const depthOf = (size) => Object.keys(HOLE_SIZES).find(depth => HOLE_SIZES[depth] === size);
const holePosition = (a, r) => ({
  left: `${50 + Math.cos(a) * r * 50}%`, top: `${50 + Math.sin(a) * r * 50}%`,
});

function previousFoil(cs, templates) {
  const foil = cs.preparation?.previous?.foil;
  const template = templates.find(t => t.id === foil?.templateId);
  if (!template || !Number.isFinite(foil.elapsed) || foil.elapsed < 0 || !Array.isArray(foil.rings)) return null;
  const rings = ringsForTemplate(template);
  if (foil.rings.length !== rings.length || !rings.every((ring, i) => {
    const saved = foil.rings[i];
    return Number.isFinite(saved?.phase) && Array.isArray(saved.holes) && saved.holes.length === ring.targets
      && saved.holes.every((hole, k) => hole?.k === k && Number.isFinite(hole.a) && Number.isFinite(hole.d) && hole.d >= 0
        && depthOf(hole.size) && ["perfect", "good", "rough", "close"].includes(hole.kind));
  })) return null;
  return { foil, template };
}

async function chooseTemplate(panel, cs) {
  // Saved sessions keep their captured choices and selected legacy layout.
  const available = cs.availableHoleTemplateIds || availableHoleTemplates().map(template => template.id);
  const templates = HOLE_TEMPLATES.filter(template => available.includes(template.id) || template.id === cs.holeTemplateId);
  let selected = templates.find((template) => template.id === cs.holeTemplateId)
    || templates.find((template) => template.id === DEFAULT_HOLE_TEMPLATE) || templates[0];
  const previous = previousFoil(cs, templates.filter(template => available.includes(template.id)));
  let recalled = !!previous && !!cs.preparation.reuseFoil;
  if (recalled) selected = previous.template;
  const redo = new Set();
  const preview = el("div.foil.ht-preview", { role: "img", dataset: { test: "hole-preview" } });
  const counts = el("div.ht-counts", { dataset: { test: "hole-template-counts" } });
  const note = el("small.ht-note");
  const description = el("p.ht-description", { "aria-live": "polite" });
  const illustrated = craftStageEnabled() && !renewalCraft(cs);
  const choices = templates.map((template) => {
    const button = el("button.btn.ht-option", { dataset: { test: `hole-template-${template.id}` } }, [
      illustrated ? holePatternMark(ringsForTemplate(template)) : null,
      el("span.btn-label", { text: template.label }),
    ]);
    button.addEventListener("click", () => {
      selected = template; recalled = false; redo.clear(); SE.good(); draw();
    });
    return button;
  });
  const startLabel = el("span.btn-label");
  const start = el("button.btn.primary", { dataset: { test: "hole-start" } }, [startLabel]);
  const reuse = previous ? el("button.btn.ghost.small.hole-reuse", {
    type: "button", text: "前回の穴を呼び出す", dataset: { test: "hole-reuse" },
  }) : null;
  reuse?.addEventListener("click", () => {
    selected = previous.template; recalled = true; redo.clear(); SE.good(); draw();
  });
  const editHint = previous ? el("small.hole-reuse-hint", { text: "開け直す穴を選べます。" }) : null;
  const help = el("details.ht-help", [
    el("summary", { text: "配置と熱の回り方" }),
    illustrated ? counts : null,
    el("p", { text: "どちらも24穴。外周に集中させると温度が安定し、中周にも開けると吸い方で温度を動かしやすい" }),
    illustrated ? note : null,
  ]);
  const title = el("b.ht-title", { text: illustrated ? "穴の配置" : "穴あけテンプレート" });
  panel.append(el(illustrated ? "div.holes.hole-chooser" : "div.holes", [
    el("div.hr-stage", [preview]),
    el("div.ht-side", illustrated ? [
      el("div.hole-chooser-scroll", [title, reuse, editHint, ...choices, description, help]), start,
    ] : [title, reuse, editHint, ...choices, counts, description, help, note, start]),
  ]));
  function updateStart() {
    startLabel.textContent = recalled ? (redo.size ? "選んだ穴を開け直す" : "この配置で進む")
      : illustrated ? "穴あけを始める" : "この配置で穴あけを始める";
  }
  function draw() {
    const plane = el("div.foil-target-plane");
    preview.replaceChildren(foilSurface(), plane);
    preview.setAttribute("role", recalled ? "group" : "img");
    preview.setAttribute("aria-label", `${selected.label}：${templateCountsLabel(selected)}`);
    RINGS.forEach((ring) => plane.append(el("div.foil-ring", {
      style: { width: `${ring.r * 100}%`, height: `${ring.r * 100}%`, opacity: selected.counts[ring.id] ? "1" : ".2" },
    })));
    ringsForTemplate(selected).forEach((ring, i) => {
      for (let k = 0; k < ring.targets; k++) {
        if (!recalled) {
          const a = -Math.PI / 2 + k * 2 * Math.PI / ring.targets;
          plane.append(el("i.foil-marker.planned", { style: holePosition(a, ring.r), dataset: { ring: ring.id } }));
          continue;
        }
        const savedRing = previous.foil.rings[i];
        const hole = savedRing.holes[k], key = `${i}:${k}`;
        const target = savedRing.phase + k * 2 * Math.PI / ring.targets;
        const width = 10; // 盤に対するボタンの幅（%）
        const button = el("button.foil-reuse-dot", {
          type: "button", style: { ...holePosition(target, ring.r), width: `${width}%`, height: `${width}%` },
          "aria-pressed": "false",
          "aria-label": `${ring.label}の穴 ${k + 1}を開け直す`, dataset: { test: `hole-reuse-${ring.id}-${k}` },
        }, [el(`i.foil-hole.${depthOf(hole.size)}`, { style: {
          left: `${50 + (Math.cos(hole.a) - Math.cos(target)) * ring.r * 5000 / width}%`,
          top: `${50 + (Math.sin(hole.a) - Math.sin(target)) * ring.r * 5000 / width}%`,
        } })]);
        button.addEventListener("click", () => {
          if (redo.has(key)) redo.delete(key);
          else redo.add(key);
          button.setAttribute("aria-pressed", String(redo.has(key)));
          updateStart();
        });
        plane.append(button);
      }
    });
    choices.forEach((button, i) => button.setAttribute("aria-pressed", String(!recalled && templates[i] === selected)));
    reuse?.setAttribute("aria-pressed", String(recalled));
    if (editHint) editHint.hidden = !recalled;
    updateStart();
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
  return { template: selected, recalled: recalled ? previous.foil : null, redo };
}

// 毎フレーム動く部分は、値が変わった時だけ書く。同じ値でも DOM へ書くと、ページ全体の見た目の再計算が毎フレーム走って重くなる（CRN・穴あけの重さ）
const putText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
const putData = (node, key, value) => { if (node.dataset[key] !== value) node.dataset[key] = value; };
const putStyle = (node, key, value) => { if (node.style[key] !== value) node.style[key] = value; };
const putProp = (node, key, value) => { if (node[key] !== value) node[key] = value; };
const putClass = (node, name, on) => { if (node.classList.contains?.(name) !== on) node.classList.toggle(name, on); };

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
  let warmup = tutorial && cs.onboarding && !autoSkill();
  const owner = gameState;
  const root = benchRoot(cs);
  const isCurrent = () => gameState === owner && benchRoot(cs) === root;
  let finishWarmup;
  // 穴あけのお手本動画は廃止（#3815）。押し加減は「穴を開ける」の中の目盛りと「?」の説明で伝える。
  const panel = stepPanel("holes", "アルミ穴あけ", "配置図を見てテンプレートを選ぶ。開始すると、光る目印の近くを針が動く", { brief: "穴の配置を選んでから、穴あけを始める" });
  if (tutorial && !await explainTutorialStep(cs, "holes")) return;
  const { template, recalled, redo } = await chooseTemplate(panel, cs);
  if (!isCurrent()) return;
  // リニューアル（CRN02・05・08）: リングが埋まると自動で次へ・判定は穴のそば・刺した点の閃光・結果でアルミを残す。
  // 桜井版（CRN16）: リニューアル前のとおり「次のリングへ」「穴あけを終えて結果へ」のボタン・判定は右の札・小さな火の粉だけ。
  const renewal = renewalCraft(cs);
  stepPanel("holes", "アルミ穴あけ", renewal ? "光る目印に針が重なったら押し、少し押し込んでから離す。リングが埋まると次のリングへ進む"
    : "光る目印に針が重なったら押し、少し押し込んでから離す。リングが完成したら「次のリングへ」");
  const rings = ringsForTemplate(template);
  const slow = skill.slow(cs) * (tutorial ? HOLES_TUNING.lessonSlow : 1);
  const perfWin = HOLES_TUNING.perfectDeg * skill.window(cs, "holes") * (tutorial ? HOLES_TUNING.lessonPerfect : 1);
  const basePerfWin = perfWin / (1 + 0.45 * effectTier("sense"));
  const goodWin = HOLES_TUNING.goodDeg * craftCondition(cs).window * (tutorial ? HOLES_TUNING.lessonGood : 1) * assistEffect(cs).holesGood;
  const limit = (tutorial ? HOLES_TUNING.lessonTimeLimit : HOLES_TUNING.timeLimit + (growthSkill(gameState, "K01") ? SKILL_TUNING.holesSeconds : 0))
    * assistEffect(cs).slow;
  // 操作の詳しい説明・凡例・採点は「?」へ。基本画面には置かない（ミニゲームUI共通の方針）。
  root?.querySelector(".bench-guide-tip > p")?.after(el("div.bench-guide-extra", { dataset: { test: "hole-guide" } }, [
    el("ul", [
      ["狙う", "光る目印の近くを針が行き来する。重なったところで押す"],
      ["押し加減", "少し押し込んでから離す。大きさの評価は小穴で揃えると満点。短すぎると浅い穴になり、長すぎると大きな穴になって減点される"],
      ["ズレたとき", "ミスにはならず、ズレた位置のまま穴として残る（点は低くなる）。針は次の目印へ進む"],
      ["採点", "間隔のそろい50・狙いの正確さ30・小穴のそろい15・時間5。浅い穴はさらに1穴8点減点"],
      ...rings.map(ring => [ring.label, ring.role]),
      // スマホの右の列は狭く、能力の効果は「技」「感」の札だけを出す。中身はここで読む（css/craft-phone.css。PC は今までどおり画面に出る）
      ...(effectVisible("technique") ? [["技", "技術で針がゆっくり", "bench-guide-phone"]] : []),
      ...(effectVisible("sense") ? [["感", "センスで成功の幅が広がる", "bench-guide-phone"]] : []),
    ].map(([label, text, only]) => el(only ? `li.${only}` : "li", [el("b", { text: label }), el("span", { text })]))),
    el("p", { text: "時間が過ぎても、選んだ配置を最後まで開けられる" }),
  ]));

  // ---- 画面
  const D = 430;
  const disc = el("div.foil", { style: { width: `${D}px`, height: `${D}px` }, dataset: { test: "foil" } });
  const ringEls = rings.map((rg) => el("div.foil-ring", { style: { width: `${rg.r * 100}%`, height: `${rg.r * 100}%` }, dataset: { ring: rg.id } }));
  const markers = el("div.foil-markers");
  const holesLayer = el("div.foil-holes");
  const cursor = el(`div.foil-cursor${effectVisible("technique") ? ".technique-visible" : ""}`, { dataset: { test: "hole-needle" } });
  const plane = el("div.foil-target-plane", [...ringEls, markers, holesLayer, cursor]);
  disc.append(foilSurface(), plane);
  const ringLabel = el("div.hr-ring");
  const timeBar = el("i.hr-time-bar", [el("b")]);
  const feedback = el("div.hr-feedback", { "aria-live": "polite", dataset: { test: "hole-feedback" } });
  const report = (text, kind, options) => {
    reactAudience(cs, kind);
    feedback.replaceChildren();
    popStamp(feedback, text, kind, "50%", "50%", options);
  };
  // 一刺しの判定は、目が向いている穴のすぐ外側に出す（CRN05。右の札まで目を動かさない）
  const calloutAt = (text, kind, a, r) => {
    reactAudience(cs, kind);
    const [x, y] = posOf(a, Math.min(1.02, r + 0.17));
    plane.querySelectorAll?.(":scope > .stamp").forEach((old, i, all) => { if (i < all.length - 1) old.remove(); });
    // 長い文字（浅い穴…）でも盤の外へ切れないよう、横は内側へ寄せる
    const keep = (v, edge) => Math.max(edge, Math.min(100 - edge, v));
    popStamp(plane, text, kind, `${keep(50 + x * 50, text.length > 9 ? 26 : 16)}%`, `${keep(50 + y * 50, 6)}%`);
  };
  // 一刺しの判定の出し先（桜井版は右の札）
  const judged = (text, kind, a, r) => renewal ? calloutAt(text, kind, a, r) : report(text, kind);
  const plan = el("div.hr-plan", { dataset: { test: "hole-plan" } });
  // 桜井版（#3815）: 押している長さを「穴を開ける」の中の目盛りでも見せる。左の小さな穴（短く）から右の大きな穴（長く）へ伸びる。
  // 針の --press をそのまま写すだけで、判定・採点は変えない。リニューアル（第1章大会の旧方式）は従来のまま。
  const pressMeter = renewal ? null : el("span.hr-press-meter", { "aria-hidden": "true", dataset: { test: "hole-press-meter" } }, [el("i.hr-press-fill")]);
  const punchBtn = el("button.btn.primary.hr-punch", { dataset: { test: "hole-punch" } }, [el("span.btn-label", { text: "穴を開ける" }), pressMeter]);
  const nextBtn = renewal ? null : el("button.btn.small", { text: "次のリングへ", dataset: { test: "hole-next" } });
  // 文は「穴あけを終えて結果へ」のまま。前半を分けておく（スマホの狭い列では「結果へ」だけを出す・css/craft-phone.css）
  const doneBtn = renewal ? null : el("button.btn.small.ghost", { dataset: { test: "hole-done" } }, [el("span.hole-done-lead", { text: "穴あけを終えて" }), "結果へ"]);
  const begin = warmup ? el("button.btn.small", { text: "穴あけを始める", dataset: { test: "hole-warmup-start" } }) : null;
  const row = el("div.hr-row", [begin || nextBtn, begin ? null : doneBtn]);
  const side = el("div.hr-side", [el("small.ht-current", { text: template.label }), ringLabel,
      effectVisible("technique") ? effectBadge("technique", "技") : null,
      senseBand(basePerfWin, 12), effectLine("technique", "技", "技術で針がゆっくり"),
      el("div.hr-time", [el("span", { text: "TIME" }), timeBar]), feedback, plan,
      el("p.hr-depth-hint", { dataset: { test: "hole-depth-hint" }, text: "押す長さで深さが変わる。大きさの評価は小穴で揃えると満点。" }),
      punchBtn, begin || !renewal ? row : null]);
  panel.append(el("div.holes", [el("div.hr-stage", [disc]), side]));

  // ---- 状態
  const tally = { perfect: 0, good: 0, miss: 0, rough: 0, tooClose: 0, blank: 0, shallow: 0 };
  const countHole = (ring, { size, kind }) => {
    if (size === HOLE_SIZES.shallow) tally.shallow++;
    else if (kind === "perfect" || kind === "good") tally[kind]++;
    else {
      ring.extra++;
      tally[kind === "close" ? "tooClose" : "rough"]++;
    }
  };
  const state = rings.map((rg, i) => {
    const saved = recalled?.rings[i];
    const holes = saved ? saved.holes.filter(({ k }) => !redo.has(`${i}:${k}`)) : [];
    const taken = Array.from({ length: rg.targets }, (_, k) => !!saved && !redo.has(`${i}:${k}`));
    const ring = {
      ...rg, holes, taken, phase: saved?.phase ?? rand(0, Math.PI * 2), extra: 0,
      aim: Math.max(0, taken.indexOf(false)), // いま狙っている目印
    };
    holes.forEach(hole => countHole(ring, hole));
    return ring;
  });
  let ri = Math.max(0, state.findIndex(ring => ring.taken.includes(false)));
  const gameClock = createCraftClock(panel);
  let t0 = null;
  let elapsed = 0;
  const previousElapsed = recalled
    ? recalled.elapsed * (1 - redo.size / rings.reduce((total, ring) => total + ring.targets, 0))
    : 0;
  let finished = false;
  let raf = 0;
  // 針: sweepStart から弧を動く。press は押している間。
  let sweepStart = 0, press = null;

  const targetAngle = (ring, k) => ring.phase + (k * 2 * Math.PI) / ring.targets;
  const clockNow = () => t0 === null ? 0 : (gameClock.now() - t0) / 1000;
  const halfArc = (ring) => needleHalfArc(ring.targets);
  const nextAim = (ring, from) => {
    for (let i = 0; i < ring.targets; i++) { const k = (from + i) % ring.targets; if (!ring.taken[k]) return k; }
    return 0;
  };
  const needle = (t) => {
    const ring = state[ri], h = halfArc(ring);
    if (press) return { offset: press.offset, resting: false };
    return needleOffset(t - sweepStart, h, slow);
  };
  const needleAngle = (t) => targetAngle(state[ri], state[ri].aim) + needle(t).offset;
  const posOf = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  const place = (node, a, r) => {
    const [x, y] = posOf(a, r);
    node.style.left = `${50 + x * 50}%`;
    node.style.top = `${50 + y * 50}%`;
  };
  const angDiff = circularAngleDistance;
  const complete = () => templateComplete(state);
  const ringComplete = () => state[ri].taken.every(Boolean);
  const nextRing = () => state.findIndex((ring, i) => i > ri && ring.taken.includes(false));

  let currentMarkers = [];
  let highlighted = null;
  const highlightNext = () => {
    const next = ringComplete() ? null : currentMarkers.find(entry => entry.k === state[ri].aim)?.node || null;
    if (next !== highlighted) {
      highlighted?.classList.remove("next");
      next?.classList.add("next");
      highlighted = next;
    }
    putProp(cursor, "hidden", ringComplete());
  };
  const drawNeedle = (t) => {
    const ring = state[ri], { resting } = needle(t);
    place(cursor, needleAngle(t), ring.r);
    putClass(cursor, "resting", resting);
    const held = press ? Math.max(0, t - press.start) : 0;
    putClass(cursor, "pressing", !!press);
    const pressed = press ? clamp(held / pressLimit(slow), 0, 1).toFixed(3) : "0";
    if (cursor.style.getPropertyValue?.("--press") !== pressed) cursor.style.setProperty("--press", pressed);
    const depth = press ? pressDepth(held, slow) : "";
    putData(cursor, "depth", depth);
    if (pressMeter) {
      if (punchBtn.style.getPropertyValue?.("--press") !== pressed) punchBtn.style.setProperty("--press", pressed);
      putData(punchBtn, "depth", depth);
    }
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
    highlightNext();
  };
  // 一刺しごとには目印を作り直さず、開けた目印だけを外す（毎回20個ほど作り直すと重い・CRN）
  const takeMarker = (k) => {
    const entry = currentMarkers.find(item => item.k === k);
    if (entry) {
      entry.node.remove?.();
      currentMarkers = currentMarkers.filter(item => item !== entry);
      if (highlighted === entry.node) highlighted = null;
    }
    putText(ringLabel, `${state[ri].label}（${state[ri].taken.filter(Boolean).length}/${state[ri].targets}）`);
    highlightNext();
  };
  const addHoleDot = (a, r, kind, depth) => {
    const h = el(`i.foil-hole.${kind}.${depth}`);
    h.style.setProperty("--scratch-angle", `${(holesLayer.childElementCount * 137) % 180 - 90}deg`);
    place(h, a, r);
    holesLayer.append(h);
  };
  const hud = () => {
    const ready = complete();
    putProp(punchBtn, "disabled", finished || ringComplete());
    if (nextBtn) putProp(nextBtn, "disabled", finished || !ringComplete() || nextRing() < 0);
    if (doneBtn) putProp(doneBtn, "disabled", finished || !ready);
    if (warmup) return;
    // 初めの一行は操作の案内（新しい配置では常設しない・CSL15）。完成などの知らせは出す。
    putData(plan, "tone", ready || ringComplete() || previousElapsed + elapsed >= limit ? "notice" : "hint");
    putText(plan, ready ? renewal ? "選んだ配置が完成。結果へ" : "選んだ配置が完成。結果を確認しよう"
      : ringComplete() ? renewal ? "リング完成。次のリングへ" : "リング完成。「次のリングへ」で残りの目印を開けよう"
      : previousElapsed + elapsed >= limit ? "時間評価は終了。穴あけは続けられます"
      : "光る目印に針が重なったら、押し込んで刺す");
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
    const next = nextRing();
    if (next >= 0) {
      ri = next; press = null; sweepStart = clockNow(); state[ri].aim = nextAim(state[ri], 0);
      drawMarkers(); hud(); drawNeedle(sweepStart); SE.whoosh();
    }
    else finish();
  };

  // 押した瞬間に針の位置が決まり、離した時点の押し加減で穴の大きさが決まる。
  const pressStart = (source) => {
    if (finished || t0 === null || gameClock.paused || press) return;
    const ring = state[ri];
    if (ring.closed || ring.taken.every(Boolean)) return;
    const t = clockNow();
    press = { start: t, offset: needle(t).offset, source };
    drawNeedle(t);
  };
  const pressEnd = () => {
    if (!press) return;
    const t = clockNow(), { offset } = press, held = t - press.start;
    press = null;
    pierce(offset, pressDepth(held, slow), t);
  };

  const pierce = (offset, depth, t) => {
    const ring = state[ri], k = ring.aim, h = halfArc(ring);
    const a = targetAngle(ring, k) + offset;
    SE.foilPunch();
    const dRef = referenceDegrees(offset, h);
    const near = ring.holes.some((hole) => referenceDegrees(angDiff(hole.a, a), h) < goodWin * 0.8);
    if (warmup) {
      holesLayer.replaceChildren();
      addHoleDot(a, ring.r, dRef <= goodWin ? "good" : "rough", depth);
      const size = { shallow: "浅い穴", small: "小さい穴", wide: "少し大きい穴", large: "大きい穴" }[depth];
      const aim = dRef <= goodWin ? "目印のそばに開いた" : "目印からズレた";
      putText(plan, `${aim}。深さは「${size}」。押す長さを変えて試せる。`);
      sweepStart = t;
      drawNeedle(t);
      return;
    }
    const size = HOLE_SIZES[depth];
    const sizeNote = depth === "small" ? "" : depth === "wide" ? "・少し大きい" : depth === "large" ? "・大きい" : "・浅い";
    let kind;
    if (dRef <= perfWin) kind = "perfect";
    else if (dRef <= goodWin) kind = "good";
    else if (near) kind = "close";
    else kind = "rough";
    // ズレた一刺しもミス（無効）にはしない。その目印の穴として成立させ、ズレの大きさで減点する（#3023）。
    ring.taken[k] = true;
    const hole = { a, d: dRef, size, kind, k };
    ring.holes.push(hole);
    countHole(ring, hole);
    if (depth === "shallow") {
      judged("浅い穴。大きく減点", "rough", a, ring.r);
    } else if (kind === "perfect" || kind === "good") {
      judged(`${kind === "perfect" ? "EXCELLENT" : "GOOD"}${sizeNote}`, kind, a, ring.r);
    } else if (kind === "close") judged(`近すぎたけど開いた${sizeNote}`, "rough", a, ring.r);
    else judged(`ズレたけど開いた${sizeNote}`, "rough", a, ring.r);
    ring.aim = nextAim(ring, k + 1);
    // 成立したら（ズレた場合も）次の目印の、すぐ手前から針が動き出す。
    sweepStart = t;
    addHoleDot(a, ring.r, depth === "shallow" ? "rough" : kind, depth);
    if (depth !== "shallow" && (kind === "perfect" || kind === "good")) {
      // 針も盤も止めない（#3499）。刺した点に、小さな閃光・輪・火の粉を重ねる（CRN05）
      const [hx, hy] = posOf(a, ring.r), at = { x: `${50 + hx * 50}%`, y: `${50 + hy * 50}%` };
      if (!renewal) sparks(plane, { ...at, n: 5, spread: 55 }); // 桜井版: リニューアル前の小さな火の粉だけ
      else if (kind === "perfect") {
        burstFlash(plane, { ...at, size: 64, color: "#ffc94a" });
        shockRing(plane, { ...at, size: 84, color: "#ffc94a" });
      }
      if (renewal) {
        sparks(plane, { ...at, n: kind === "perfect" ? 7 : 4, spread: kind === "perfect" ? 70 : 55 });
        if (fxMode() === "full") globalThis.navigator?.vibrate?.(kind === "perfect" ? 12 : 6);
      }
    }
    setBenchHoleAction(cs, {
      dots: state.flatMap(rg => rg.holes.map(hole => posOf(hole.a, rg.r))), target: posOf(a, ring.r),
      sizes: state.flatMap(rg => rg.holes.map(hole => hole.size)),
    });
    if (ring.taken.every(Boolean)) {
      const clean = ring.holes.every((hole) => hole.d <= perfWin && hole.size === HOLE_SIZES.small) && ring.extra === 0;
      // 周の完成演出は一刺しの精度判定ではない。EXCELLENT へ置き換えない。
      report(clean ? "BEAUTIFUL RING" : "RING COMPLETE", "just", { timing: false });
      // リング全体が鳴る: 中心から大きな輪と、リングの円周に沿った火の粉（盤は止めない）
      const size = Math.round(ring.r * D * 1.05), gold = clean ? "#ffc21a" : undefined;
      if (renewal) {
        shockRing(plane, { size, color: gold || "#ffd27a" });
        for (let k = 0; k < 6; k++) {
          const [rx, ry] = posOf(k * Math.PI / 3 + ring.phase, ring.r);
          sparks(plane, { x: `${50 + rx * 50}%`, y: `${50 + ry * 50}%`, color: gold, n: 3, spread: 50 });
        }
      } else sparks(plane, { color: gold, n: 8, spread: 90 });
      SE.perfect();
      tickerSay(clean ? "パッキー「きれいに揃ったーッ！ 見てくださいこの輪！」" : "パッキー「リング完成！ 手が止まりませんね〜♪」");
      // 完成の演出を見せてから、次のリング（最後なら結果）へ自動で進む（CRN02）。完成したリングは入力を止める。
      // 自動操作（テスト）は simulate が自分で進める。
      const at = ri;
      // 桜井版は自動で進めない。「次のリングへ」か「穴あけを終えて結果へ」を押してもらう
      if (renewal && !autoSkill()) setTimeout(() => { if (!finished && ri === at) advanceRing(); }, RING_ADVANCE_MS);
    }
    takeMarker(k);
    if (complete()) {
      // Freeze at the final real punch, including the time score. Finishing and
      // the result confirmation remain explicit even after the time limit.
      elapsed = t;
      cancelAnimationFrame(raf);
      drawTime();
    } else drawNeedle(t);
    hud();
  };

  const drawTime = () => {
    // 時間の帯は 0.5% 刻みで書く（毎フレームの細かな書き換えを減らす。見た目は変わらない）
    putStyle(timeBar.querySelector("b"), "width", `${Math.round(clamp(100 - ((previousElapsed + elapsed) / limit) * 100, 0, 100) * 2) / 2}%`);
  };
  const loop = () => {
    raf = 0;
    if (finished || complete()) return;
    if (warmup && !isCurrent()) { finishWarmup(false); return; }
    elapsed = clockNow();
    if (gameClock.paused) {
      if (warmup || !gameClock.onPauseChange) raf = requestAnimationFrame(loop);
      return;
    }
    // 押しすぎは離さなくても刺し抜ける。押しっぱなしで止まらない。
    if (press && elapsed - press.start >= pressLimit(slow)) pressEnd();
    if (complete()) return;
    // 一刺しのあとも針を止めない。描画だけ停止すると処理落ちや判定の飛びに見える。
    drawNeedle(elapsed);
    highlightNext();
    if (!warmup) drawTime();
    hud();
    raf = requestAnimationFrame(loop);
  };
  gameClock.onPauseChange?.((paused) => {
    if (!paused && !finished && !complete() && !raf && t0 !== null) raf = requestAnimationFrame(loop);
  });

  let done;
  const finishedP = new Promise((r) => { done = r; });
  const finish = () => {
    if (finished || !complete()) return;
    finished = true;
    cleanup();
    state.forEach(closeRing);
    done();
  };
  const cleanup = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    gameClock.dispose();
    unkey();
    globalThis.window?.removeEventListener("pointerup", pointerEnd);
    globalThis.window?.removeEventListener("pointercancel", pointerEnd);
    globalThis.window?.removeEventListener("keyup", keyEnd);
  };

  // ---- 入力（押し始め／離す）
  const pointerStart = (e) => { e.preventDefault(); pressStart("pointer"); };
  const pointerEnd = () => { if (press?.source === "pointer") pressEnd(); };
  const keyStart = (e) => { if (!e?.repeat) pressStart("key"); };
  const keyEnd = (e) => {
    if ((e.key === " " || e.code === "Space") && press?.source === "key") { e.preventDefault(); pressEnd(); }
  };
  for (const node of [disc, punchBtn]) {
    node.addEventListener("pointerdown", pointerStart);
    node.addEventListener("pointerup", pointerEnd);
    node.addEventListener("pointercancel", pointerEnd);
  }
  globalThis.window?.addEventListener("pointerup", pointerEnd);
  globalThis.window?.addEventListener("pointercancel", pointerEnd);
  globalThis.window?.addEventListener("keyup", keyEnd);
  nextBtn?.addEventListener("click", advanceRing);
  doneBtn?.addEventListener("click", finish);
  const unkey = keys(renewal ? { " ": keyStart, Space: keyStart } : { " ": keyStart, Space: keyStart, Enter: finish });

  drawMarkers();
  hud();
  drawNeedle(0);
  if (recalled) {
    for (const ring of state) for (const hole of ring.holes) {
      const depth = depthOf(hole.size);
      addHoleDot(hole.a, ring.r, depth === "shallow" ? "rough" : hole.kind, depth);
    }
    drawTime();
  }
  if (warmup) {
    putText(ringLabel, "練習・採点なし");
    timeBar.parentElement.style.visibility = "hidden";
    putData(plan, "tone", "warmup");
    plan.setAttribute("aria-live", "polite");
    putText(plan, "針と目印が重なったら押す。少し待って離す。");
    t0 = gameClock.now();
    const start = await new Promise(resolve => {
      finishWarmup = resolve;
      begin.addEventListener("click", () => resolve(true), { once: true });
      raf = requestAnimationFrame(loop);
    });
    cancelAnimationFrame(raf);
    raf = 0;
    if (!start || !isCurrent()) { cleanup(); return; }
    warmup = false;
    t0 = null;
    press = null;
    sweepStart = elapsed = 0;
    holesLayer.replaceChildren();
    timeBar.parentElement.style.removeProperty("visibility");
    if (renewal) row.remove();
    else row.replaceChildren(nextBtn, doneBtn);
    drawMarkers();
    drawNeedle(0);
    hud();
  }
  if (complete()) finish();
  else {
    await countdown();
    if (!isCurrent()) { cleanup(); return; }
    t0 = gameClock.now();
    if (!gameClock.onPauseChange || !gameClock.paused) raf = requestAnimationFrame(loop);
    const auto = autoSkill();
    if (auto) simulate(auto);
  }
  await finishedP;
  if (!isCurrent()) return;

  // ---- 採点（実穴の均等度50/タイミング精度30/実穴径の穴サイズ安定15/残り時間5、浅い穴は追加減点）
  if (redo.size) for (const ring of state) ring.holes.sort((a, b) => a.k - b.k);
  const totalElapsed = previousElapsed + elapsed;
  const res = evaluate(state, tally, Math.max(0, limit - totalElapsed) / limit, goodWin);
  res.templateId = template.id;
  res.templateLabel = template.label;
  res.plannedCounts = { ...template.counts };
  if (cs.preparation) cs.preparation.foil = {
    templateId: template.id, elapsed: totalElapsed,
    rings: state.map(ring => ({ phase: ring.phase, holes: ring.holes })),
  };
  settleGrowthPhase(gameState, cs, "holes", res, res.score >= 90);
  cs.holes = res;
  scoreStep(cs, "holes", res.score, "穴あけ");
  refreshBench();
  await sleep(renewal ? 120 : 300);
  if (renewal) {
    // 開けたアルミは舞台に残し、操作の札と目印だけ片付ける（CRN08。作ったものと評価を並べて見せる）。
    side.remove?.();
    markers.replaceChildren(); cursor.hidden = true;
    disc.classList.add("finished");
  } else panel.replaceChildren(); // 桜井版: 結果を出す前に穴あけ操作を片付け、完了ボタンとの重なりを防ぐ（リニューアル前のとおり）
  const marked = res.tally.perfect + res.tally.good + (res.tally.rough || 0) + res.tally.tooClose + res.tally.shallow;
  const shallowAdvice = "短いタップで穴が浅くなった。少し長く押してから離そう";
  const depthFirst = res.holeSizes.shallow > 0 && res.holeSizes.shallow * 2 >= res.total;
  const spacingAdvice = res.evenness > 0.8 ? "穴の間隔が揃い、熱が回りやすそうだ" : "穴の間隔にばらつきがある。次は目印をよく見よう";
  await resultCard(panel, {
    title: "穴あけ 結果",
    button: "確認して次の工程へ",
    grade: res.grade,
    advice: tutorial && depthFirst ? shallowAdvice : "",
    ...(renewal ? { summary: [
      `EXCELLENT ${res.tally.perfect}・GOOD ${res.tally.good}・ズレ ${(res.tally.rough || 0) + res.tally.tooClose}・浅い ${res.tally.shallow}（${marked}穴）`,
      depthFirst ? shallowAdvice : spacingAdvice,
    ] } : {}),
    lines: [
      depthFirst ? shallowAdvice : "",
      `テンプレート：${template.label}`,
      spacingAdvice,
      `目印の達成：${res.tally.perfect + res.tally.good + (res.tally.rough || 0) + res.tally.tooClose + res.tally.shallow}/${Object.values(template.counts).reduce((sum, count) => sum + count, 0)}か所（EXCELLENT ${res.tally.perfect}・GOOD ${res.tally.good}）`,
      `穴あけ入力：${res.total}回 ／ ズレて開いた穴：${(res.tally.rough || 0) + res.tally.tooClose}回（近すぎた穴を含む）／ 浅い穴：${res.tally.shallow}回`,
      `実際に開いた穴：外周 ${res.outer}・中周 ${res.middle}（計 ${res.total} 穴）`,
      "ズレた穴も開いた穴として残り、間隔と熱の回り方に影響する",
      `穴の大きさ：浅い ${res.holeSizes.shallow}・小 ${res.holeSizes.small}・少し大きい ${res.holeSizes.wide}・大きい ${res.holeSizes.large}`,
      res.holeSizes.shallow && !depthFirst ? shallowAdvice : "",
      res.outerEven > 0.8 ? "外周がきれいに揃った。熱が全体に回りそうだ" : "",
    ],
  });

  // 自動操作（テスト）: 針が目印に来る時刻まで時計を進めて押し、押し加減の分だけ進めて離す
  // （上手=ぴったり・整った小穴／下手=ズレる・押しすぎて少し大きい穴）
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
        const h = halfArc(ring), sweep = NEEDLE.sweep * slow, cycle = sweep + NEEDLE.rest * slow;
        const err = level === "good" ? 0 : rand(5, 10) * DEG * (h / NEEDLE.maxHalfArc);
        const t = clockNow(), want = sweepStart + ((err + h) / (2 * h)) * sweep;
        t0 -= ((((want - t) % cycle) + cycle) % cycle) * 1000;
        elapsed = clockNow();
        pressStart("auto");
        t0 -= (level === "good" ? 0.25 : 0.6 * slow) * 1000;
        elapsed = clockNow();
        pressEnd();
        await sleep(25);
      }
    })();
  }
}

export function evaluate(rings, tally, timeRatio, goodWin) {
  const result = evaluateFoil(rings, tally, timeRatio, goodWin);
  return { ...result, grade: gradeOf(result.score) };
}
