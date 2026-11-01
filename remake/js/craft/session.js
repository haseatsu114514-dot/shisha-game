// シーシャ作りのセッション（1台ぶんの状態）と作業台画面。
// 工程の中身は steps.js（選ぶ工程）と各ミニゲーム（holes/heat/steam/pull/care）。
// 大会では章の台本（chapters/ch1.js）が工程の間に実況や会話を挟むので、
// ここは「工程を1つずつ呼べる部品」を提供するだけにしている。
import { el, sleep, rand } from "../core/util.js";
import { showScreen, setBg, retire, layers, flash, shake } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { bgUrl } from "../core/data.js";
import { state, timeOfDay, save } from "../core/state.js";
import { currentCondition, addStamina, tier01 } from "../core/stats.js";
import { growthSkill, growthCraftCondition, SKILL_TUNING } from "../core/growth-effects.js";
import { noteGrowthCraftOwner } from "../core/growth-memory.js";
import { buildWorkerScene, WORKER_STEPS, benchBgRef } from "./worker.js";
import { buildAudience, audienceFor } from "./audience.js";
import { buildGuide, STEP_BRIEFS, TUTORIAL_STEP_HELP } from "./bench-ui.js";
import { evaluationOf } from "./feedback.js";
import { clearComments, completed } from "./broadcast.js";
import { isRainy } from "../daily/weather.js";
import { runHoles } from "./holes.js";
import { availableHoleTemplates } from "./holes_templates.js";
import { runHeat } from "./heat.js";
import { runSteamDodge } from "./steam.js";
import { runPull } from "./pull.js";
import { applyCraftSkin, craftSkinUrls } from "./skin.js";
import { buildThermalAtmosphere } from "./thermal.js";
import { buildPanelSmoke } from "./smoke-art.js";
import { temperatureAfterSteam } from "./conditions.js";
import { steamEnvironment, steamForecastProfile } from "./steam-climate.js";
import { screenBlast } from "./blast.js";
import { artImg } from "./art.js";
import { LEAF_MAX, flavorLeafStages, ensureFlavorLife } from "./flavor-life.js";
import { buildCraftProgress } from "./progress.js";
import { warmCraftAssets } from "./readiness.js";
import { prepareBenchEntry } from "./loading.js";
import { applyCoalTraining } from "./coals.js";
import { attachBenchAppearance } from "../appearance/bench.js";
import { demoFor, openDemoSheet } from "./demo.js";

/**
 * テスト用フック。auto を "good" / "bad" にすると、各ミニゲームが操作なしで
 * その腕前相当の結果を出して進む（UIの流れ自体は通常どおり通る）。
 */
export const craftTest = { auto: null }; // "good" / "bad" / "burn"（温度を上げ続けて焦がす）

export const MODE_LABEL = { tutorial: "LESSON", drill: "PRACTICE", rehearsal: "REHEARSAL", tournament: "SMOKE CROWN CUP" };
const MODE_NOTE = { tutorial: "レッスン", drill: "練習モード", rehearsal: "前日リハーサル", tournament: "大会" };

// 自主練のメニュー（本番のミニゲームを単体で回す）
export const DRILLS = {
  holes: { label: "アルミ穴あけ", desc: "アルミに均等な穴を開ける", stats: ["technique", "sense"] },
  heat: { label: "炭焼き", desc: "炭の全面が赤くなる頃合いを見極める", stats: ["sense", "insight"] },
  steam: { label: "蒸らし", desc: "待つ間の雑念を避け続ける", stats: ["guts", "insight"] },
  pull: { label: "吸い出し", desc: "吸い方で熱を適温へ運ぶ", stats: ["technique", "sense"] },
};

export function newSession(mode) {
  const steamVariation = { offset: rand(-.065, .065), transfer: rand(.9, 1.1) };
  const cs = {
    mode,
    chapter: state.chapter,
    audienceIds: audienceFor(mode, state.chapter),
    condition: growthCraftCondition(state, mode, currentCondition()), // 本番の胆力はこの一台だけ
    environment: steamEnvironment(isRainy(), state.day, state.weatherSeed ?? 0, timeOfDay()),
    steamVariation,
    steamPrediction: steamForecastProfile(tier01("insight"), steamVariation,
      { readBonus: growthSkill(state, "K14") ? SKILL_TUNING.forecastRead : 0 }),
    masteryAtStart: { ...state.flavorMastery }, // 練習後の成長で、作り終えた一台の評価を変えない
    equip: { ...state.equip },
    appearance: { ...state.appearance },
    mix: {},
    mixInfo: null,
    pack: null,
    availableHoleTemplateIds: availableHoleTemplates(state.flags).map((template) => template.id),
    holeTemplateId: null,
    holes: null,
    heat: null,
    place: null,
    steamSeconds: null,
    steam: null,
    pull: null,
    pullDone: false,
    care: null,
    careHistory: [],
    stats: null,
    total: 0,
    arcade: { total: 0, parts: {} },
    retryUsed: false,
  };
  applyCoalTraining(cs, state.flags);
  // E07(#1081): 葉の持ち/消耗は一台の全工程で共有する状態として、ここで一度だけ生む。
  // 蒸らし・提供で傷んだ葉を、調整（熱管理）や場面切替・SAVE/LOAD で新品へ戻さない。
  ensureFlavorLife(cs);
  noteGrowthCraftOwner(cs, state);
  return cs;
}

let bench = null;

// 同時に待つベース/工程の準備を一つにまとめる。キャッシュ済みなら幕を出さない。
function waitForBenchAssets(b, task, assets = task, notice = true) {
  b.pendingWork = (b.pendingWork || 0) + 1;
  b.pendingAssets = (b.pendingAssets || 0) + 1;
  b.root.inert = true;
  b.root.setAttribute("aria-busy", "true");
  if (notice && !b.loadingTimer && !b.loading) b.loadingTimer = setTimeout(() => {
    b.loadingTimer = null;
    if (!b.pendingAssets || !b.root.isConnected) return;
    b.loading = el("div.craft-loading", { role: "status", dataset: { test: "craft-loading" }, text: "作業台を準備しています…" });
    b.root.append(b.loading);
  }, 220);
  const assetsReady = Promise.resolve(assets).finally(() => {
    if (--b.pendingAssets) return;
    clearTimeout(b.loadingTimer); b.loadingTimer = null;
    b.loading?.remove(); b.loading = null;
  });
  const complete = Promise.all([task, assetsReady]).finally(() => {
    if (--b.pendingWork) return;
    b.root.inert = false;
    b.root.removeAttribute("aria-busy");
  });
  return Object.assign(complete, { assetsReady });
}

/**
 * 作業台画面を開く（すでに開いていれば再利用）。
 * 戻り値の panel に各工程が中身を描き、左側は作業風景の静止モックアップ。
 */
export function openBench(cs, { steps = [], entryAssets = null } = {}) {
  applyCoalTraining(cs, state.flags);
  // 会話のあとに作業台へ戻るときも、作業台の背景（暗めの会場／店）に戻す
  // 制作中は大会用の台だけを見せる。家背景に所持品の台を重ねない（#873）。
  const bg = () => setBg(bgUrl(benchBgRef(cs), timeOfDay()), { tint: "dim", fast: true, ready: craftSkinUrls(), homeRigs: false });
  if (bench && bench.cs === cs && bench.root.isConnected) {
    const background = bg();
    bench.ready = waitForBenchAssets(bench, Promise.all([bench.ready, background]),
      Promise.all([bench.ready.assetsReady, background.assetsReady]));
    return bench;
  }
  const worker = buildWorkerScene(cs);
  const audience = buildAudience(cs);
  const title = el("div.bench-title");
  const hint = el("div.bench-hint");
  const phaseProgress = buildCraftProgress(steps);
  const progress = phaseProgress.root, progressCount = phaseProgress.count;
  const guide = buildGuide();
  const panel = el("div.bench-panel");
  // TH62: 顔のバッジは廃止。疲れは作業中のはじめの表情と汗で見せる。
  const leaf = buildLeafIcon();
  worker.footer.append(leaf.root);
  const root = el("div.bench", { dataset: { mode: cs.mode } }, [
    el("div.bench-top", [el("span.bench-mode", [cs.eventTitle || MODE_LABEL[cs.mode] || "", el("small", { text: cs.retryAssist ? "今回のみ操作補助" : cs.eventNote || MODE_NOTE[cs.mode] || "" })]), progress]),
    el("div.bench-left", [
      worker.root,
      audience?.root,
    ]),
    el("div.bench-right", [el("div.bench-head", [el("div.bench-heading", [title, hint]), guide.root]), panel]),
  ]);
  root.querySelector(".bench-right").prepend(buildPanelSmoke(root));
  applyCraftSkin(root);
  const thermal = buildThermalAtmosphere(root, worker, cs);
  showScreen("bench", root);
  bench = { cs, root, worker, audience, panel, title, hint, guide, progress, progressCount, phaseProgress, thermal, leaf,
    sequence: steps.map(([id]) => id), prefetchSteps: new Set() };
  attachBenchAppearance(bench, cs);
  const background = bg();
  // A missing entryAssets is an already completed fourth step in the loading count.
  const preparationSteps = [background.assetsReady, warmCraftAssets(cs.mode, { cs, step: "setup" }), worker.ready, entryAssets];
  const assets = Promise.all(preparationSteps);
  bench.ready = prepareBenchEntry(waitForBenchAssets(bench, Promise.all([background, assets]), assets, false), cs.chapter, preparationSteps);
  renderFatigue();
  return bench;
}

export async function waitBenchReady(cs, step = null, options = {}) {
  const b = bench;
  if (b?.cs !== cs) return;
  if (!step) { await b.ready; return; }
  const assets = Promise.all([
    b.ready.assetsReady,
    warmCraftAssets(cs.mode, { cs, step, ...options }),
    b.worker.prepare(step),
  ]);
  await waitForBenchAssets(b, Promise.all([b.ready, assets]), assets);
  const current = b.sequence.indexOf(step === "timer" ? "steam" : step);
  const next = current >= 0 ? b.sequence[current + 1] : null;
  if (next && !b.prefetchSteps.has(next)) {
    b.prefetchSteps.add(next);
    setTimeout(() => {
      if (b.root.isConnected) {
        warmCraftAssets(cs.mode, { cs, step: next });
        b.worker.prepare(next);
      }
    }, 0);
  }
}
export function benchRoot(cs) {
  return bench?.cs === cs && bench.root.isConnected && !bench.root.classList.contains("done") ? bench.root : null;
}

/** 初回の操作説明を、時計・カウントダウンを始める前に既存ガイドで読む。 */
export async function explainTutorialStep(cs, id) {
  const b = bench, owner = state;
  const current = () => bench === b && state === owner && benchRoot(cs) === b?.root && b.panel.dataset.step === id;
  if (!current()) return false;
  if (cs.mode !== "tutorial") return true;
  const lesson = cs.lessonHelp?.[id] || TUTORIAL_STEP_HELP[id];
  b.explainedLessons ??= new Set();
  if (!lesson || b.explainedLessons.has(id)) return true;
  if (b.pendingHelp?.id === id) return (await b.pendingHelp.promise) && current();
  const guide = b.guide.root, note = b.guide.note, fullNote = note.textContent;
  const tip = guide.querySelector(".bench-guide-tip"), summary = guide.querySelector("summary");
  // 固定作業台の縮小後も、初回説明は読める文字と押せる閉じ口を保つ。
  const styles = [
    [tip, { width: "min(760px, calc(92vw / var(--k, 1)))" }],
    [note, { fontSize: "calc(16px / var(--k, 1))", lineHeight: "1.5" }],
    [tip.querySelector("b"), { fontSize: "calc(16px / var(--k, 1))" }],
    [tip.querySelector("small"), { fontSize: "calc(14px / var(--k, 1))" }],
    [summary, { width: "calc(44px / var(--k, 1))", height: "calc(44px / var(--k, 1))" }],
  ].map(([node, values]) => ({ node, values, previous: Object.fromEntries(Object.keys(values).map(key => [key, node.style[key]])) }));
  styles.forEach(({ node, values }) => Object.assign(node.style, values));
  // 最初はスミの既存説明だけ。詳しい操作は従来の「?」に残す。
  note.textContent = lesson.detail;
  const pending = new Promise(resolve => {
    const finish = ok => {
      guide.removeEventListener("toggle", closed);
      observer.disconnect();
      styles.forEach(({ node, previous }) => Object.assign(node.style, previous));
      if (current() || note.textContent === lesson.detail) note.textContent = fullNote;
      if (b.panel.dataset.step === id) {
        guide.open = false;
        b.panel.inert = false;
        b.root.dataset.helpPaused = "false";
      }
      resolve(ok);
    };
    const closed = () => { if (!guide.open) finish(current()); };
    const observer = new MutationObserver(() => { if (!current()) finish(false); });
    guide.addEventListener("toggle", closed);
    observer.observe(b.root.ownerDocument.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-step"] });
    guide.open = true;
    // toggleの配送を待たず、この描画から操作を止める。
    b.panel.inert = true;
    b.root.dataset.helpPaused = "true";
    // 既存の自動操作フックも、表示してからガイドを閉じて進む。
    if (craftTest.auto) sleep(120).then(() => { if (current()) guide.open = false; });
  });
  b.pendingHelp = { id, promise: pending };
  const acknowledged = await pending;
  b.pendingHelp = null;
  if (!acknowledged || !current()) return false;
  b.explainedLessons.add(id);
  return true;
}

/** 工程の見出しを切り替え、パネルを空にして返す */
export function stepPanel(id, titleText, hintText = "", { brief = STEP_BRIEFS[id] || hintText, lessonStep = id } = {}) {
  const b = bench;
  clearComments();
  const lesson = b.cs.mode === "tutorial" ? b.cs.lessonHelp?.[lessonStep] || TUTORIAL_STEP_HELP[lessonStep] : null;
  b.title.textContent = titleText;
  b.hint.textContent = lesson?.brief || brief;
  if (demoFor(lessonStep)) {
    const link = el("button.bench-demo-link", { type: "button", text: "お手本を見る" });
    link.addEventListener("click", () => {
      if (bench === b && b.panel.dataset.step === id && !b.root.dataset.demoPaused) openDemoSheet(b.root, lessonStep);
    });
    b.hint.append(" ", link);
  }
  b.guide.root.open = false;
  b.guide.root.hidden = !hintText && !lesson;
  b.guide.note.textContent = lesson
    ? [lesson.detail, hintText].filter(Boolean).join("　操作：")
    : hintText;
  b.phaseProgress.update(id === "care" && b.cs.careRound ? `care${b.cs.careRound}` : id, titleText);
  // 短い操作案内は、隠れている見出しではなく既存のスミさんの欄へ。
  // 蒸らし弾幕中は従来どおり無言とし、説明は「?」で読み返せる。
  const coaching = lesson && lessonStep !== "steam" ? `スミ「${lesson.brief}」` : hintText;
  b.audience?.setStep(coaching, id);
  // 吸い出しの情報欄へ移した葉を、工程を消す前に作業風景へ戻す。
  b.worker.footer.append(b.leaf.root);
  b.panel.replaceChildren();
  b.panel.dataset.step = id;
  b.root.dataset.step = id;
  b.worker.setStep(id);
  renderFatigue();
  b.worker.caption.textContent = WORKER_STEPS[id] || titleText;
  b.thermal.setStep(id);
  b.leaf.root.hidden = !["pull", "care"].includes(id);
  b.leaf.render(b.cs.leaf);
  // 蒸らしのやり直しでも前回の温度を残さず、炭を置いた直後の温度から始める。
  if (id === "steam") b.thermal.update(temperatureAfterSteam(b.cs, 0));
  if (["pull", "care"].includes(id)) b.thermal.update(b.cs.care?.temp ?? b.cs.pull?.temp ?? b.cs.steam?.temp ?? 0);
  return b.panel;
}

/** 初回レッスンの工程だけ、操作開始前にお手本を一度見せる。 */
export async function showStepDemo(cs, step) {
  const b = bench;
  if (cs.mode !== "tutorial" || craftTest.auto || !demoFor(step) || !b || b.cs !== cs || !b.root.isConnected) return;
  const seenDemo = state.flags.seenDemo ||= {};
  if (seenDemo[step]) return;
  seenDemo[step] = true; // とばしても既読。再度見たいときは brief のリンクから開ける。
  if (!cs.preview) save();
  await openDemoSheet(b.root, step);
}

/** 同じ一台の実温度を、蒸らし以降の背景と煙の絵へ返す。 */
export function setBenchTemperature(cs, temp) {
  if (bench?.cs === cs && !bench.root.classList.contains("done")) bench.thermal.update(temp);
}
/** 吸い出し・熱管理の一口を左の作業風景へつなぐ。今後の吸引動画もこの状態を読む。 */
export function setBenchDraw(cs, kind, duration = 0) {
  if (bench?.cs === cs) bench.worker.setDraw(kind, duration);
}
/** 確定した水量を左の作業風景のボトル内部の水位へ反映する。 */
export function setBenchWater(cs) {
  if (bench?.cs === cs && bench.root.isConnected) bench.worker.setWater(cs?.water);
}
/** 穴あけ側が確定した実穴の座標だけを、左の手元へ渡す。 */
export function setBenchHoleAction(cs, event) {
  if (bench?.cs === cs && bench.root.isConnected) bench.worker.punch(event);
}
export function pauseBenchTemperature(cs, paused) {
  if (bench?.cs === cs) bench.thermal.pause(paused);
}
/**
 * 赤い葉5枚のうち使用中の1枚だけが茶→黒→消える。次の赤い葉は変色しない（TH77〜82）。
 */
function buildLeafIcon() {
  const leaves = Array.from({ length: LEAF_MAX }, (_, i) => el("span.flavor-leaf", { "aria-hidden": "true", dataset: { slot: i, stage: "red" } }, [
    artImg("ui_mockup_flavor_leaf.png", 34, "leaf-skin", { h: 34 }),
  ]));
  const root = el("span.leaf-icon", { hidden: true, role: "img", dataset: { test: "leaf-icon", hp: String(LEAF_MAX) } }, leaves);
  return { root, render(leaf, { hit = false } = {}) {
    const hp = leaf?.hp ?? LEAF_MAX, burn = leaf?.burn ?? 0;
    root.dataset.hp = String(hp);
    root.dataset.burn = String(burn);
    flavorLeafStages(leaf).forEach((stage, i) => { leaves[i].dataset.stage = stage; });
    const description = `フレーバー：赤い葉が残り${hp}/${LEAF_MAX}枚${burn ? `、使用中の葉は${burn === 1 ? "茶色" : "黒い焦げ"}` : ""}`;
    root.setAttribute("aria-label", description);
    root.title = description;
    if (hit) { root.classList.remove("hit"); void root.offsetWidth; root.classList.add("hit"); }
  } };
}

/** フレーバーが傷んだら葉を更新する。音と揺れは呼び出し側で鳴らす。 */
export function setBenchLeaf(cs, hit = false) {
  if (bench?.cs === cs) bench.leaf.render(cs.leaf, { hit });
}
/** 吸い出し・熱管理では、同じ葉の状態をモックアップの情報欄へ置く。 */
export function dockBenchLeaf(cs, host) {
  if (bench?.cs !== cs) return;
  const root = bench.leaf.root;
  host.prepend(root);
}
/** 配合（フレーバーを決める工程）でも「フレーバーの持ち」を先に見せたいときに使う（#1081 E02）。 */
export function setBenchLeafVisible(cs, visible) {
  if (bench?.cs === cs) bench.leaf.root.hidden = !visible;
}

/**
 * はじめの疲れ（TH29・TH43）。札や文字は出さず、作業中のはじめの表情と汗で見せる。
 * 0=元気（真剣な顔）、1=少し疲れ（汗がにじむ）、2=ばてている（沈んだ顔・汗と荒い息）。体調の黄・赤と、吸いすぎ・熱すぎの疲れの重い方。
 */
export function fatigueOf(cs) {
  const health = { green: 0, yellow: 1, red: 2 }[cs.condition?.health] ?? 0;
  return Math.max(health, Math.min(2, cs.strain || 0));
}
function renderFatigue() {
  if (bench) bench.worker.setFatigue(fatigueOf(bench.cs));
}
/**
 * 吸いすぎ・熱すぎで、はじめの体力が削れてデバフが付く（TH29）。レッスンでは起きない。
 * 体力が体調の境界を割れば、その一台の残りは悪い方の体調で作る。
 */
export function strainBench(cs, stamina = 4) {
  if (cs.mode === "tutorial") return false;
  const rate = growthSkill(state, "K08") ? SKILL_TUNING.strain : 1;
  const progress = (cs.strainRemainder || 0) + rate;
  cs.strain = (cs.strain || 0) + Math.floor(progress);
  cs.strainRemainder = progress - Math.floor(progress);
  addStamina(-stamina * rate);
  const now = growthCraftCondition(state, cs.mode, currentCondition()), order = ["green", "yellow", "red"];
  if (order.indexOf(now.health) > order.indexOf(cs.condition?.health ?? "yellow")) cs.condition = now;
  if (bench?.cs === cs) {
    renderFatigue();
    bench.worker.flinch();
  }
  return true;
}

// ---------------------------------------------------------------- 旧SCORE保存との互換

// 工程の点（0〜100）1点あたりの重み。穴・炭・完成品・調整1・調整2を各20%にする。
// 完成品の20%は配合・蒸らし・吸い出しで分ける。満点は100,000点。
const SCORE_WEIGHT = { mix: 50, holes: 200, heat: 200, steam: 50, pull: 100, care1: 200, care2: 200, care: 200 };
/**
 * 工程の点をスコアへ入れる。key は工程名（mix/holes/heat/steam/pull/care1/care2）。"heat:1" のような部分点は、
 * 同じ工程の最終点が入ると置き換わる。やり直した工程は前の点と入れ替える。
 */
export function scoreStep(cs, key, score) {
  cs.arcade ??= { total: 0, parts: {} };
  const step = key.split(":")[0];
  if (!key.includes(":")) for (const k of Object.keys(cs.arcade.parts)) if (k.startsWith(`${step}:`)) delete cs.arcade.parts[k];
  // 旧保存由来の異常値（上限超・Infinity / NaN）が記録用スコアへ流れ込まないよう入口で丸める（#1364）
  const numericScore = Number(score);
  const cleanScore = Number.isFinite(numericScore) ? Math.min(100, Math.max(0, numericScore)) : 0;
  cs.arcade.parts[key] = Math.round(cleanScore * (SCORE_WEIGHT[step] ?? 0));
  cs.arcade.total = Object.values(cs.arcade.parts).reduce((a, b) => a + b, 0);
  // 旧保存と記録の互換用。制作中や結果画面には表示しない。
  return cs.arcade.total;
}

/** ステージ座標（1280×720）でのボウルの位置。爆発の爆心にする。 */
function bowlOrigin() {
  const stage = document.getElementById("stage")?.getBoundingClientRect();
  const bowl = bench?.root.querySelector(".worker-bowl")?.getBoundingClientRect();
  if (!stage?.width || !bowl?.width) return { x: 385, y: 240 };
  const scale = stage.width / 1280;
  return { x: (bowl.left + bowl.width / 2 - stage.left) / scale, y: (bowl.top + bowl.height * .3 - stage.top) / scale };
}

/**
 * その一台がダメになった演出（TH06・TH17・TH19・TH20）。burnt=画面全体の大爆発と焦げた背景、
 * cold=煙が消えて冷え切った色、leaf=フレーバーが抜けてくすんだ色。終わると結果へ進む。
 */
export async function failBench(cs, kind) {
  if (bench?.cs !== cs || !bench.root.isConnected) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  bench.thermal.fail(kind);
  if (kind === "burnt") {
    SE.burst();
    shake(undefined, 700);
    await Promise.all([screenBlast(bowlOrigin(), { reduced }), sleep(reduced ? 400 : 1900)]);
    return;
  }
  if (kind === "cold") SE.miss(); else { SE.crack(); shake(undefined, 380); }
  flash(kind === "cold" ? "white" : "red", 300);
  await sleep(reduced ? 300 : 1200);
}

/** 左側の工程キャプションを更新。今後の作業アニメーションもここで同期する。 */
export function refreshBench() {
  if (!bench) return;
  bench.worker.root.dataset.ready = String(!!(bench.cs.pullDone || bench.cs.practiceSource));
  // pullDoneは失敗時にも立つので、成功した提供だけを現在地にする。
  // panelの工程IDは結果評価が参照するためpullのまま保持する。
  if (bench.panel.dataset.step === "pull" && bench.cs.pullDone && bench.cs.pull && !bench.cs.pull.failed) {
    bench.phaseProgress.update("serve", "提供");
    bench.title.textContent = "提供";
    bench.hint.textContent = "お客さんへシーシャを提供した。しばらく吸ってもらおう";
    bench.guide.root.open = false;
    bench.guide.root.hidden = true;
    bench.root.dataset.step = "serve";
    bench.worker.setStep("serve");
    bench.worker.caption.textContent = "シーシャを提供した";
  }
}

/** 結果は左下の人物へ。審査点・好感度は変えず、実際の工程スコアを読む。 */
export function presentBenchResult(panel, title, advice = "") {
  const score = bench?.panel === panel ? bench.cs[panel.dataset.step]?.score ?? 0 : 0;
  const evaluation = evaluationOf(score);
  if (bench?.panel === panel) {
    reactAudience(bench.cs, evaluation.kind, { force: true, score, title, text: advice, final: true });
    completed(bench.cs, panel.dataset.step, score);
  }
  return { evaluation, hasAudience: !!(bench?.panel === panel && bench.audience) };
}

/** その一台を見ている人だけが反応する。古い工程の非同期処理から次の画面へ漏らさない。 */
export function reactAudience(cs, kind, options) {
  if (bench?.cs === cs && bench.root.isConnected && !bench.root.classList.contains("done")) bench.audience?.react(kind, options);
}

/** 被弾や深呼吸の表情は、その一台の作業風景だけへ返す。 */
export function setPlayerMental(cs, level) {
  if (bench?.cs === cs && bench.root.isConnected && bench.panel.dataset.step === "steam") bench.worker.setMental(level);
}

/** 大会実況は、審査員と同じ左下の欄でパッキーが話す。 */
export function tickerSay(text) {
  if (bench?.cs.mode === "tournament" && bench.root.isConnected && !bench.root.classList.contains("done")) bench.audience?.say(text);
}

// ---------------------------------------------------------------- 自主練

/** ドリルを1本。戻り値は出来の段階 0〜2 */
/** 工程をひとつ反復する。venue: "home" なら家の作業台（#638） */
export async function runDrill(kind, { venue = null } = {}) {
  try {
    return await drill(kind, { venue });
  } finally {
    retire(layers.screen.querySelector(":scope > .bench")); // 終わった作業台は次の会話で片付く
  }
}

async function drill(kind, { venue = null } = {}) {
  const cs = newSession("drill");
  if (venue) cs.venue = venue;
  const labels = { holes: "FOIL", heat: "HEAT", steam: "STEAM", pull: "PULL" };
  openBench(cs, { steps: [[kind, labels[kind]]] });
  await waitBenchReady(cs);
  if (kind === "holes") { await runHoles(cs); return tier(cs.holes.score); }
  if (kind === "heat") { await runHeat(cs); return tier(cs.heat.score); }
  if (kind === "steam") { cs.steamMin = 5; await runSteamDodge(cs); return cs.steam.hits === 0 ? 2 : cs.steam.hits <= 2 ? 1 : 0; }
  cs.place = "triangle";
  cs.heat = { heatPower: 10, just: 1 };
  await runPull(cs);
  return tier(cs.pull.score);
}
const tier = (score) => (score >= 85 ? 2 : score >= 60 ? 1 : 0);
