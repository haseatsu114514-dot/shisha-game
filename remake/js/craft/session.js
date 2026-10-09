// シーシャ作りのセッション（1台ぶんの状態）と作業台画面。
// 工程の中身は steps.js（選ぶ工程）と各ミニゲーム（holes/heat/steam/pull/care）。
// 大会では章の台本（chapters/ch1.js）が工程の間に実況や会話を挟むので、
// ここは「工程を1つずつ呼べる部品」を提供するだけにしている。
import { el } from "../core/util.js";
import { showScreen, setBg, retire, layers } from "../core/ui.js";
import { bgUrl } from "../core/data.js";
import { state, timeOfDay } from "../core/state.js";
import { currentCondition } from "../core/stats.js";
import { craftCondition } from "../core/condition.js";
import { buildWorkerScene, WORKER_STEPS } from "./worker.js";
import { buildAudience, audienceFor } from "./audience.js";
import { conditionBadge, buildGuide, STEP_BRIEFS } from "./bench-ui.js";
import { evaluationOf } from "./feedback.js";
import { isRainy } from "../daily/weather.js";
import { runHoles } from "./holes.js";
import { availableHoleTemplates } from "./holes_templates.js";
import { runHeat } from "./heat.js";
import { runSteamDodge } from "./steam.js";
import { runPull } from "./pull.js";
import { applyCraftSkin, craftSkinUrls } from "./skin.js";

/**
 * テスト用フック。auto を "good" / "bad" にすると、各ミニゲームが操作なしで
 * その腕前相当の結果を出して進む（UIの流れ自体は通常どおり通る）。
 */
export const craftTest = { auto: null };

export const MODE_LABEL = { tutorial: "LESSON", drill: "PRACTICE", rehearsal: "REHEARSAL", tournament: "SMOKE CROWN CUP" };

// 自主練のメニュー（本番のミニゲームを単体で回す）
export const DRILLS = {
  holes: { label: "アルミ穴あけ", desc: "アルミに均等な穴を開ける", stats: ["technique", "sense"] },
  heat: { label: "炭焼き", desc: "炭の芯が光る瞬間を見極める", stats: ["sense", "insight"] },
  steam: { label: "蒸らし", desc: "待つ間の雑念を避け続ける", stats: ["guts", "insight"] },
  pull: { label: "吸い出し", desc: "吸い方で熱を適温へ運ぶ", stats: ["technique", "sense"] },
};

export function newSession(mode) {
  return {
    mode,
    audienceIds: audienceFor(mode, state.chapter),
    condition: currentCondition(), // 作り始めの体力を一台の全工程で使う
    environment: { rainy: isRainy(), day: state.day },
    equip: { ...state.equip },
    concepts: [],
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
    stats: null,
    trial: null,
    total: 0,
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
  if (bench && bench.cs === cs && bench.root.isConnected) { bg(); return bench; }
  const worker = buildWorkerScene(cs);
  const audience = buildAudience(cs);
  const title = el("div.bench-title");
  const hint = el("div.bench-hint");
  const progressCount = el("b.bench-progress-count");
  const progress = el("div.bench-progress", { "aria-label": "制作の進み具合", hidden: !steps.length }, [
    progressCount, el("div.bench-progress-track", steps.map(([id, label]) => el("span", { title: WORKER_STEPS[id] || label, dataset: { step: id } }))),
  ]);
  const guide = buildGuide();
  const panel = el("div.bench-panel");
  const condition = craftCondition(cs);
  if (cs.mode !== "tutorial") worker.footer.append(conditionBadge(condition));
  const root = el("div.bench", { dataset: { mode: cs.mode } }, [
    el("div.bench-top", [el("span.bench-mode", { text: MODE_LABEL[cs.mode] || "" }), progress]),
    el("div.bench-left", [
      worker.root,
      audience?.root,
    ]),
    el("div.bench-right", [el("div.bench-head", [el("div.bench-heading", [title, hint]), guide.root]), panel]),
  ]);
  applyCraftSkin(root);
  bg();
  showScreen("bench", root);
  bench = { cs, root, worker, audience, panel, title, hint, guide, progress, progressCount };
  return bench;
}

/** 工程の見出しを切り替え、パネルを空にして返す */
export function stepPanel(id, titleText, hintText = "", { brief = STEP_BRIEFS[id] || hintText } = {}) {
  const b = bench;
  b.title.textContent = titleText;
  b.hint.textContent = brief;
  b.guide.root.open = false;
  b.guide.root.hidden = !hintText;
  b.guide.note.textContent = hintText;
  b.root.querySelectorAll(".bench-condition").forEach((d) => { d.open = false; });
  const steps = [...b.progress.querySelectorAll("[data-step]")];
  steps.forEach((s, i) => {
    s.classList.toggle("now", s.dataset.step === id);
    if (s.dataset.step === id) {
      s.classList.add("seen");
      s.setAttribute("aria-current", "step");
      b.progressCount.textContent = `${String(i + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`;
      b.progress.setAttribute("aria-label", `制作の進み具合：${i + 1} / ${steps.length}工程`);
    } else s.removeAttribute("aria-current");
  });
  b.audience?.setStep(hintText, id);
  b.panel.replaceChildren();
  b.panel.dataset.step = id;
  b.worker.root.dataset.step = id; // 今後の工程別アニメーションの接続先
  b.worker.setMental("steady");
  b.worker.caption.textContent = WORKER_STEPS[id] || titleText;
  return b.panel;
}

/** 左側の工程キャプションを更新。今後の作業アニメーションもここで同期する。 */
export function refreshBench() {
  if (!bench) return;
  bench.worker.root.dataset.ready = String(!!bench.cs.pullDone);
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
  if (kind === "holes") { await runHoles(cs); return tier(cs.holes.score); }
  if (kind === "heat") { await runHeat(cs); return tier(cs.heat.score); }
  if (kind === "steam") { cs.steamMin = 5; await runSteamDodge(cs); return cs.steam.hits === 0 ? 2 : cs.steam.hits <= 2 ? 1 : 0; }
  cs.place = "triangle";
  cs.heat = { heatPower: 10, just: 1 };
  await runPull(cs);
  return tier(cs.pull.score);
}
const tier = (score) => (score >= 85 ? 2 : score >= 60 ? 1 : 0);
