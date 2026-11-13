// アルミ穴あけ BATTLE（master_spec 第2部 §1）
// テンプレートの配置を選び、光る目印の近くだけを動く針が重なった瞬間に押して刺す（#2937 案1）。
// 押している長さで刺し加減が変わり、穴の大きさに差が出る（#2937 案5）。
// メイン評価は均等度。実際の穴数・リング配置を後工程の熱へ渡す。
import { el, sleep, clamp, rand } from "../core/util.js";
import { createCraftClock } from "./clock.js";
import { countdown } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, showStepDemo, refreshBench, tickerSay, reactAudience, scoreStep, waitBenchReady, setBenchHoleAction, benchRoot } from "./session.js";
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
export { RINGS } from "./holes_logic.js";
const TIME_LIMIT = 32;
// リングが埋まってから次のリング（最後なら結果）へ自動で進むまで（CRN02）。完成の演出を見せる間。
const RING_ADVANCE_MS = 600;
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
  const panel = stepPanel("holes", "アルミ穴あけ", "配置図を見てテンプレートを選ぶ。開始すると、光る目印の近くを針が動く", { brief: "穴の配置を選んでから、穴あけを始める" });
  await showStepDemo(cs, "holes");
  const template = await chooseTemplate(panel, cs);
  stepPanel("holes", "アルミ穴あけ", "光る目印に針が重なったら押し、少し押し込んでから離す（Space長押しでも可）。リングが埋まると次のリングへ進む");
  const rings = ringsForTemplate(template);
  const slow = skill.slow(cs) * (tutorial ? 1.3 : 1);
  const perfWin = 4.2 * skill.window(cs, "holes") * (tutorial ? 1.5 : 1);
  const basePerfWin = perfWin / (1 + 0.45 * effectTier("sense"));
  const goodWin = 11 * craftCondition(cs).window * (tutorial ? 1.3 : 1) * (cs.retryAssist ? 1.35 : 1);
  const limit = tutorial ? 48 : TIME_LIMIT + (growthSkill(gameState, "K01") ? SKILL_TUNING.holesSeconds : 0);
  // 操作の詳しい説明・凡例・採点は「?」へ。基本画面には置かない（ミニゲームUI共通の方針）。
  benchRoot(cs)?.querySelector(".bench-guide-tip > p")?.after(el("div.bench-guide-extra", { dataset: { test: "hole-guide" } }, [
    el("ul", [
      ["狙う", "光る目印の近くを針が行き来する。重なったところで押す"],
      ["押し加減", "少し押し込んでから離す。短すぎると浅い穴になり、大きく減点される。長く押すほど穴が大きくなる"],
      ["ズレたとき", "ミスにはならず、ズレた位置のまま穴として残る（点は低くなる）。針は次の目印へ進む"],
      ["採点", "間隔のそろい50・狙いの正確さ30・穴の大きさのそろい15・時間5。浅い穴はさらに1穴8点減点"],
      ...rings.map(ring => [ring.label, ring.role]),
    ].map(([label, text]) => el("li", [el("b", { text: label }), el("span", { text })]))),
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
  const report = (text, kind) => {
    reactAudience(cs, kind);
    feedback.replaceChildren();
    popStamp(feedback, text, kind, "50%", "50%");
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
  const plan = el("div.hr-plan", { dataset: { test: "hole-plan" } });
  const punchBtn = el("button.btn.primary.hr-punch", { dataset: { test: "hole-punch" } }, [el("span.btn-label", { text: "穴を開ける" })]);
  const side = el("div.hr-side", [el("small.ht-current", { text: template.label }), ringLabel,
      effectVisible("technique") ? effectBadge("technique", "技") : null,
      senseBand(basePerfWin, 12), effectLine("technique", "技", "技術で針がゆっくり"),
      el("div.hr-time", [el("span", { text: "TIME" }), timeBar]), feedback, plan,
      el("p.hr-depth-hint", { dataset: { test: "hole-depth-hint" }, text: "押す長さで深さが変わる。短すぎると浅く、長いほど大きい穴に。" }),
      punchBtn]);
  panel.append(el("div.holes", [el("div.hr-stage", [disc]), side]));

  // ---- 状態
  const state = rings.map((rg) => ({
    ...rg,
    phase: rand(0, Math.PI * 2),
    taken: new Array(rg.targets).fill(false),
    holes: [], // {a, d, size}
    extra: 0,
    aim: 0, // いま狙っている目印
  }));
  let ri = 0;
  const gameClock = createCraftClock(panel);
  let t0 = null;
  let elapsed = 0;
  const tally = { perfect: 0, good: 0, miss: 0, rough: 0, tooClose: 0, blank: 0, tooMany: 0, shallow: 0 };
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

  let currentMarkers = [];
  let highlighted = null;
  const highlightNext = () => {
    const next = ringComplete() ? null : currentMarkers.find(entry => entry.k === state[ri].aim)?.node || null;
    if (next !== highlighted) {
      highlighted?.classList.remove("next");
      next?.classList.add("next");
      highlighted = next;
    }
    cursor.hidden = ringComplete();
  };
  const drawNeedle = (t) => {
    const ring = state[ri], { resting } = needle(t);
    place(cursor, needleAngle(t), ring.r);
    cursor.classList.toggle("resting", resting);
    const held = press ? Math.max(0, t - press.start) : 0;
    cursor.classList.toggle("pressing", !!press);
    cursor.style.setProperty("--press", press ? clamp(held / pressLimit(slow), 0, 1).toFixed(3) : "0");
    cursor.dataset.depth = press ? pressDepth(held, slow) : "";
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
  const addHoleDot = (a, r, kind, depth) => {
    const h = el(`i.foil-hole.${kind}.${depth}`);
    h.style.setProperty("--scratch-angle", `${(holesLayer.childElementCount * 137) % 180 - 90}deg`);
    place(h, a, r);
    holesLayer.append(h);
  };
  const hud = () => {
    const ready = complete();
    punchBtn.disabled = finished || ringComplete();
    // 初めの一行は操作の案内（新しい配置では常設しない・CSL15）。完成などの知らせは出す。
    plan.dataset.tone = ready || ringComplete() || elapsed >= limit ? "notice" : "hint";
    plan.textContent = ready ? "選んだ配置が完成。結果へ"
      : ringComplete() ? "リング完成。次のリングへ"
      : elapsed >= limit ? "時間評価は終了。穴あけは続けられます"
      : "光る目印に針が重なったら、押し込んで刺す";
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
    if (ri < state.length - 1) {
      ri++; press = null; sweepStart = clockNow(); state[ri].aim = nextAim(state[ri], 0);
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
    const size = HOLE_SIZES[depth];
    const sizeNote = depth === "small" ? "" : depth === "wide" ? "・少し大きい" : depth === "large" ? "・大きい" : "・浅い";
    let kind;
    if (dRef <= perfWin) kind = "perfect";
    else if (dRef <= goodWin) kind = "good";
    else if (near) kind = "close";
    else kind = "rough";
    // ズレた一刺しもミス（無効）にはしない。その目印の穴として成立させ、ズレの大きさで減点する（#3023）。
    ring.taken[k] = true;
    ring.holes.push({ a, d: dRef, size });
    if (depth === "shallow") {
      tally.shallow++;
      calloutAt("浅い穴。大きく減点", "rough", a, ring.r);
    } else if (kind === "perfect" || kind === "good") {
      tally[kind]++;
      calloutAt(`${kind === "perfect" ? "EXCELLENT" : "GOOD"}${sizeNote}`, kind, a, ring.r);
    } else {
      ring.extra++;
      if (kind === "close") { tally.tooClose++; calloutAt(`近すぎたけど開いた${sizeNote}`, "rough", a, ring.r); }
      else { tally.rough++; calloutAt(`ズレたけど開いた${sizeNote}`, "rough", a, ring.r); }
      if (ring.id === "inner") tally.tooMany++;
    }
    ring.aim = nextAim(ring, k + 1);
    // 成立したら（ズレた場合も）次の目印の、すぐ手前から針が動き出す。
    sweepStart = t;
    addHoleDot(a, ring.r, depth === "shallow" ? "rough" : kind, depth);
    if (depth !== "shallow" && (kind === "perfect" || kind === "good")) {
      // 針も盤も止めない（#3499）。刺した点に、小さな閃光・輪・火の粉を重ねる（CRN05）
      const [hx, hy] = posOf(a, ring.r), at = { x: `${50 + hx * 50}%`, y: `${50 + hy * 50}%` };
      if (kind === "perfect") {
        burstFlash(plane, { ...at, size: 64, color: "#ffc94a" });
        shockRing(plane, { ...at, size: 84, color: "#ffc94a" });
      }
      sparks(plane, { ...at, n: kind === "perfect" ? 9 : 6, spread: kind === "perfect" ? 70 : 55 });
      if (fxMode() === "full") globalThis.navigator?.vibrate?.(kind === "perfect" ? 12 : 6);
    }
    setBenchHoleAction(cs, {
      dots: state.flatMap(rg => rg.holes.map(hole => posOf(hole.a, rg.r))), target: posOf(a, ring.r),
      sizes: state.flatMap(rg => rg.holes.map(hole => hole.size)),
    });
    if (ring.taken.every(Boolean)) {
      const clean = ring.holes.every((hole) => hole.d <= perfWin && hole.size === HOLE_SIZES.small) && ring.extra === 0;
      report(clean ? "BEAUTIFUL RING" : "RING COMPLETE", "just");
      // リング全体が鳴る: 中心から大きな輪と、リングの円周に沿った火の粉（盤は止めない）
      const size = Math.round(ring.r * D * 1.05), gold = clean ? "#ffc21a" : undefined;
      shockRing(plane, { size, color: gold || "#ffd27a" });
      for (let k = 0; k < 6; k++) {
        const [rx, ry] = posOf(k * Math.PI / 3 + ring.phase, ring.r);
        sparks(plane, { x: `${50 + rx * 50}%`, y: `${50 + ry * 50}%`, color: gold, n: 3, spread: 50 });
      }
      SE.perfect();
      tickerSay(clean ? "パッキー「きれいに揃ったーッ！ 見てくださいこの輪！」" : "パッキー「リング完成！ 手が止まりませんね〜♪」");
      // 完成の演出を見せてから、次のリング（最後なら結果）へ自動で進む（CRN02）。完成したリングは入力を止める。
      // 自動操作（テスト）は simulate が自分で進める。
      const at = ri;
      if (!autoSkill()) setTimeout(() => { if (!finished && ri === at) advanceRing(); }, RING_ADVANCE_MS);
    }
    drawMarkers();
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
    timeBar.querySelector("b").style.width = `${clamp(100 - (elapsed / limit) * 100, 0, 100)}%`;
  };
  const loop = () => {
    if (finished || complete()) return;
    elapsed = clockNow();
    if (gameClock.paused) { raf = requestAnimationFrame(loop); return; }
    // 押しすぎは離さなくても刺し抜ける。押しっぱなしで止まらない。
    if (press && elapsed - press.start >= pressLimit(slow)) pressEnd();
    if (complete()) return;
    // 一刺しのあとも針を止めない。描画だけ停止すると処理落ちや判定の飛びに見える。
    drawNeedle(elapsed);
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
    globalThis.window?.removeEventListener("pointerup", pointerEnd);
    globalThis.window?.removeEventListener("pointercancel", pointerEnd);
    globalThis.window?.removeEventListener("keyup", keyEnd);
    state.forEach(closeRing);
    done();
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
  const unkey = keys({ " ": keyStart, Space: keyStart });

  drawMarkers();
  hud();
  drawNeedle(0);
  await countdown();
  t0 = gameClock.now();
  raf = requestAnimationFrame(loop);

  const auto = autoSkill();
  if (auto) simulate(auto);
  await finishedP;

  // ---- 採点（実穴の均等度50/タイミング精度30/実穴径の穴サイズ安定15/残り時間5、浅い穴は追加減点）
  const res = evaluate(state, tally, Math.max(0, limit - elapsed) / limit, goodWin);
  res.templateId = template.id;
  res.templateLabel = template.label;
  res.plannedCounts = { ...template.counts };
  settleGrowthPhase(gameState, cs, "holes", res, res.score >= 90);
  cs.holes = res;
  scoreStep(cs, "holes", res.score, "穴あけ");
  refreshBench();
  await sleep(120);
  // 開けたアルミは舞台に残し、操作の札と目印だけ片付ける（CRN08。作ったものと評価を並べて見せる）。
  side.remove?.();
  markers.replaceChildren(); cursor.hidden = true;
  disc.classList.add("finished");
  const marked = res.tally.perfect + res.tally.good + (res.tally.rough || 0) + res.tally.tooClose + res.tally.shallow;
  await resultCard(panel, {
    title: "穴あけ 結果",
    button: "確認して次の工程へ",
    grade: res.grade,
    summary: [
      `EXCELLENT ${res.tally.perfect}・GOOD ${res.tally.good}・ズレ ${(res.tally.rough || 0) + res.tally.tooClose}・浅い ${res.tally.shallow}（${marked}穴）`,
      res.evenness > 0.8 ? "穴の間隔が揃い、熱が回りやすそうだ" : "穴の間隔にばらつきがある。次は目印をよく見よう",
    ],
    lines: [
      `テンプレート：${template.label}`,
      res.evenness > 0.8 ? "穴の間隔が揃い、熱が回りやすそうだ" : "穴の間隔にばらつきがある。次は目印をよく見よう",
      `目印の達成：${res.tally.perfect + res.tally.good + (res.tally.rough || 0) + res.tally.tooClose + res.tally.shallow}/${Object.values(template.counts).reduce((sum, count) => sum + count, 0)}か所（EXCELLENT ${res.tally.perfect}・GOOD ${res.tally.good}）`,
      `穴あけ入力：${res.total}回 ／ ズレて開いた穴：${(res.tally.rough || 0) + res.tally.tooClose}回（近すぎた穴を含む）／ 浅い穴：${res.tally.shallow}回`,
      `実際に開いた穴：外周 ${res.outer}・中周 ${res.middle}・内周 ${res.inner}（計 ${res.total} 穴）`,
      "ズレた穴も開いた穴として残り、間隔と熱の回り方に影響する",
      `穴の大きさ：浅い ${res.holeSizes.shallow}・小 ${res.holeSizes.small}・少し大きい ${res.holeSizes.wide}・大きい ${res.holeSizes.large}`,
      res.holeSizes.shallow ? "浅い穴は成立したが、深さ不足で大きく減点された" : "",
      res.innerExcess ? "内周を開けすぎた。焦げやすくなるかもしれない" : res.outerEven > 0.8 ? "外周がきれいに揃った。熱が全体に回りそうだ" : "",
      res.total < 24 ? "穴を控えめに仕上げた。吸い出しでは温度の動きをよく見よう" : "",
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
