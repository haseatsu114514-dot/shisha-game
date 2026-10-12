// シーシャ作りのセッション（1台ぶんの状態）と作業台画面。
// 工程の中身は steps.js（選ぶ工程）と各ミニゲーム（holes/heat/steam/pull/care）。
// 大会では章の台本（chapters/ch1.js）が工程の間に実況や会話を挟むので、
// ここは「工程を1つずつ呼べる部品」を提供するだけにしている。
import { el, sleep, rand } from "../core/util.js";
import { showScreen, setBg, retire, layers, flash, shake } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { bgUrl } from "../core/data.js";
import { state, timeOfDay } from "../core/state.js";
import { currentCondition, addStamina, tier01 } from "../core/stats.js";
import { buildWorkerScene, WORKER_STEPS } from "./worker.js";
import { buildAudience, audienceFor } from "./audience.js";
import { buildGuide, STEP_BRIEFS, TUTORIAL_STEP_HELP } from "./bench-ui.js";
import { evaluationOf } from "./feedback.js";
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
import { LEAF_MAX, flavorLeafStages } from "./flavor-life.js";
import { buildCraftProgress } from "./progress.js";
import { warmCraftAssets } from "./readiness.js";

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
  heat: { label: "炭焼き", desc: "炭の芯が光る瞬間を見極める", stats: ["sense", "insight"] },
  steam: { label: "蒸らし", desc: "待つ間の雑念を避け続ける", stats: ["guts", "insight"] },
  pull: { label: "吸い出し", desc: "吸い方で熱を適温へ運ぶ", stats: ["technique", "sense"] },
};

export function newSession(mode) {
  const steamVariation = { offset: rand(-.065, .065), transfer: rand(.9, 1.1) };
  return {
    mode,
    audienceIds: audienceFor(mode, state.chapter),
    condition: currentCondition(), // 作り始めの体力を一台の全工程で使う
    environment: steamEnvironment(isRainy(), state.day, state.weatherSeed ?? 0, timeOfDay()),
    steamVariation,
    steamPrediction: steamForecastProfile(tier01("insight"), steamVariation),
    equip: { ...state.equip },
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
}

let bench = null;

/**
 * 作業台画面を開く（すでに開いていれば再利用）。
 * 戻り値の panel に各工程が中身を描き、左側は作業風景の静止モックアップ。
 */
export function openBench(cs, { steps = [] } = {}) {
  // 会話のあとに作業台へ戻るときも、作業台の背景（暗めの会場／店）に戻す
  const bg = () => setBg(bgUrl(cs.mode === "tournament" ? "bg_tournament_stage" : "bg_tonari_inside", timeOfDay()), { tint: "dim", fast: true, ready: craftSkinUrls() });
  if (bench && bench.cs === cs && bench.root.isConnected) { bench.ready = Promise.all([bench.ready, bg()]); return bench; }
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
  // アーケードのような総合スコア（TH42）。工程の結果が出るたびに数字が回って増える。
  const score = buildScoreBoard(cs);
  const root = el("div.bench", { dataset: { mode: cs.mode } }, [
    el("div.bench-top", [el("span.bench-mode", [MODE_LABEL[cs.mode] || "", el("small", { text: MODE_NOTE[cs.mode] || "" })]), progress, score.root]),
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
  const loading = el("div.craft-loading", { role: "status", dataset: { test: "craft-loading" }, text: "作業台を準備しています…" });
  root.append(loading);
  root.inert = true;
  root.setAttribute("aria-busy", "true");
  const ready = Promise.all([bg(), warmCraftAssets(cs.mode), worker.ready]).finally(() => {
    root.inert = false;
    root.removeAttribute("aria-busy");
    loading.remove();
  });
  bench = { cs, root, ready, worker, audience, panel, title, hint, guide, progress, progressCount, phaseProgress, thermal, leaf, score };
  renderFatigue();
  return bench;
}

export async function waitBenchReady(cs) {
  if (bench?.cs === cs) await bench.ready;
}
export function benchRoot(cs) {
  return bench?.cs === cs && bench.root.isConnected && !bench.root.classList.contains("done") ? bench.root : null;
}

/** 工程の見出しを切り替え、パネルを空にして返す */
export function stepPanel(id, titleText, hintText = "", { brief = STEP_BRIEFS[id] || hintText } = {}) {
  const b = bench;
  const lesson = b.cs.mode === "tutorial" ? TUTORIAL_STEP_HELP[id] : null;
  b.title.textContent = titleText;
  b.hint.textContent = lesson?.brief || brief;
  b.guide.root.open = false;
  b.guide.root.hidden = !hintText && !lesson;
  b.guide.note.textContent = lesson
    ? [lesson.detail, hintText].filter(Boolean).join("　操作：")
    : hintText;
  b.phaseProgress.update(id === "care" && b.cs.careRound ? `care${b.cs.careRound}` : id, titleText);
  b.audience?.setStep(hintText, id);
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

/** 同じ一台の実温度を、蒸らし以降の背景と煙の絵へ返す。 */
export function setBenchTemperature(cs, temp) {
  if (bench?.cs === cs && !bench.root.classList.contains("done")) bench.thermal.update(temp);
}
/** 吸い出し・熱管理の一口を左の作業風景へつなぐ。今後の吸引動画もこの状態を読む。 */
export function setBenchDraw(cs, kind, duration = 0) {
  if (bench?.cs === cs) bench.worker.setDraw(kind, duration);
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
  cs.strain = (cs.strain || 0) + 1;
  addStamina(-stamina);
  const now = currentCondition(), order = ["green", "yellow", "red"];
  if (order.indexOf(now.health) > order.indexOf(cs.condition?.health ?? "yellow")) cs.condition = now;
  if (bench?.cs === cs) {
    renderFatigue();
    bench.worker.flinch();
  }
  return true;
}

// ---------------------------------------------------------------- 総合スコア（TH42）

// 工程の点（0〜100）1点あたりの重み。穴・炭・完成品・調整1・調整2を各20%にする。
// 完成品の20%は配合・蒸らし・吸い出しで分ける。満点は100,000点。
const SCORE_WEIGHT = { mix: 50, holes: 200, heat: 200, steam: 50, pull: 100, care1: 200, care2: 200, care: 200 };
const SCORE_DIGITS = 6;
function buildScoreBoard(cs) {
  const num = el("b.arcade-num", { text: "0".repeat(SCORE_DIGITS) });
  const root = el("div.arcade-score", { dataset: { test: "arcade-score" }, "aria-live": "polite", "aria-label": "スコア 0" }, [el("span.arcade-label", { text: "SCORE" }), num]);
  let shown = cs.arcade?.total || 0, raf = 0;
  const paint = (v) => { num.textContent = String(Math.round(v)).padStart(SCORE_DIGITS, "0"); };
  paint(shown);
  return { root, roll(target, gain, label) {
    root.setAttribute("aria-label", `スコア ${target}`);
    if (gain) {
      const pop = el("div.arcade-pop", [`${gain > 0 ? "+" : ""}${gain.toLocaleString("en-US")}`, label ? el("small", { text: label }) : null]);
      root.append(pop);
      setTimeout(() => pop.remove(), 1300);
      root.classList.remove("bump"); void root.offsetWidth; root.classList.add("bump");
    }
    cancelAnimationFrame(raf);
    const from = shown, started = performance.now(), dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;
    const step = (now) => {
      const k = dur ? Math.min(1, (now - started) / dur) : 1;
      shown = from + (target - from) * (1 - (1 - k) ** 3);
      paint(shown);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  } };
}
/**
 * 工程の点をスコアへ入れる。key は工程名（mix/holes/heat/steam/pull/care1/care2）。"heat:1" のような部分点は、
 * 同じ工程の最終点が入ると置き換わる。やり直した工程は前の点と入れ替える。
 */
export function scoreStep(cs, key, score, label = "") {
  cs.arcade ??= { total: 0, parts: {} };
  const step = key.split(":")[0];
  const before = cs.arcade.total;
  if (!key.includes(":")) for (const k of Object.keys(cs.arcade.parts)) if (k.startsWith(`${step}:`)) delete cs.arcade.parts[k];
  cs.arcade.parts[key] = Math.round(Math.max(0, score || 0) * (SCORE_WEIGHT[step] ?? 0));
  cs.arcade.total = Object.values(cs.arcade.parts).reduce((a, b) => a + b, 0);
  // 回数は得点キーに保持し、ヘッダーのポップだけ「調整」に揃える。
  const displayLabel = ["care", "care1", "care2"].includes(step) ? "調整" : label;
  if (bench?.cs === cs) bench.score.roll(cs.arcade.total, cs.arcade.total - before, displayLabel);
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
export const burstBench = (cs) => failBench(cs, "burnt");

/** 左側の工程キャプションを更新。今後の作業アニメーションもここで同期する。 */
export function refreshBench() {
  if (!bench) return;
  bench.worker.root.dataset.ready = String(!!bench.cs.pullDone);
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
export function presentBenchResult(panel, title) {
  const score = bench?.panel === panel ? bench.cs[panel.dataset.step]?.score ?? 0 : 0;
  const evaluation = evaluationOf(score);
  if (bench?.panel === panel) reactAudience(bench.cs, evaluation.kind, { force: true, score, title, final: true });
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
export async function runDrill(kind) {
  try {
    return await drill(kind);
  } finally {
    retire(layers.screen.querySelector(":scope > .bench")); // 終わった作業台は次の会話で片付く
  }
}

async function drill(kind) {
  const cs = newSession("drill");
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
