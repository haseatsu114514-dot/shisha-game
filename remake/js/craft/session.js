// シーシャ作りのセッション（1台ぶんの状態）と作業台画面。
// 工程の中身は steps.js（選ぶ工程）と各ミニゲーム（holes/heat/steam/pull/care）。
// 大会では章の台本（chapters/ch1.js）が工程の間に実況や会話を挟むので、
// ここは「工程を1つずつ呼べる部品」を提供するだけにしている。
import { el } from "../core/util.js";
import { showScreen, setBg, retire, layers } from "../core/ui.js";
import { bgUrl } from "../core/data.js";
import { state, timeOfDay } from "../core/state.js";
import { buildRig } from "./art.js";
import { runHoles } from "./holes.js";
import { runHeat } from "./heat.js";
import { runSteamDodge } from "./steam.js";
import { runPull } from "./pull.js";

/**
 * テスト用フック。auto を "good" / "bad" にすると、各ミニゲームが操作なしで
 * その腕前相当の結果を出して進む（UIの流れ自体は通常どおり通る）。
 */
export const craftTest = { auto: null };

export const MODE_LABEL = { tutorial: "LESSON", drill: "PRACTICE", rehearsal: "REHEARSAL", tournament: "SMOKE CROWN CUP" };

// 自主練のメニュー（本番のミニゲームを単体で回す）
export const DRILLS = {
  holes: { label: "穴あけ ── HOLE RHYTHM", desc: "アルミに均等な穴を開ける", stats: ["technique", "sense"] },
  heat: { label: "炭焼き ── HEAT IGNITION", desc: "炭の芯が光る瞬間を見極める", stats: ["sense", "insight"] },
  steam: { label: "蒸らし ── 雑念を躱す", desc: "待つ間の雑念を避け続ける", stats: ["guts", "insight"] },
  pull: { label: "吸い出し ── 温度合わせ", desc: "吸い方で熱を適温へ運ぶ", stats: ["technique", "sense"] },
};

export function newSession(mode) {
  return {
    mode,
    equip: { ...state.equip },
    concepts: [],
    mix: {},
    mixInfo: null,
    pack: null,
    holes: null,
    heat: null,
    place: null,
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
 * 戻り値の panel に各工程が中身を描き、rig は左の一台。
 */
export function openBench(cs, { steps = [] } = {}) {
  // 会話のあとに作業台へ戻るときも、作業台の背景（暗めの会場／店）に戻す
  const bg = () => (cs.mode === "tournament" ? setBg(bgUrl("bg_tournament_stage"), { tint: "dim", fast: true }) : setBg(bgUrl("bg_tonari_inside", timeOfDay()), { tint: "dim", fast: true }));
  if (bench && bench.cs === cs && bench.root.isConnected) { bg(); return bench; }
  bench?.rig.destroy();
  const rig = buildRig();
  const title = el("div.bench-title");
  const hint = el("div.bench-hint");
  const progress = el("div.bench-progress", steps.map(([id, label]) => el("span", { text: label, dataset: { step: id } })));
  const panel = el("div.bench-panel");
  const ticker = el("div.bench-ticker");
  const root = el("div.bench", { dataset: { mode: cs.mode } }, [
    el("div.bench-top", [el("span.bench-mode", { text: MODE_LABEL[cs.mode] || "" }), progress]),
    el("div.bench-left", [rig.root]),
    el("div.bench-right", [el("div.bench-head", [title, hint]), panel]),
    ticker,
  ]);
  bg();
  showScreen("bench", root);
  bench = { cs, root, rig, panel, title, hint, progress, ticker };
  rig.update(cs);
  return bench;
}

/** 工程の見出しを切り替え、パネルを空にして返す */
export function stepPanel(id, titleText, hintText = "") {
  const b = bench;
  b.title.textContent = titleText;
  b.hint.textContent = hintText;
  b.progress.querySelectorAll("span").forEach((s) => {
    s.classList.toggle("now", s.dataset.step === id);
    if (s.dataset.step === id) s.classList.add("seen");
  });
  b.panel.replaceChildren();
  b.panel.dataset.step = id;
  return b.panel;
}

export function benchRig() { return bench?.rig; }
export function refreshRig() { bench?.rig.update(bench.cs); }

/** 大会中だけ流れる実況テロップ（パッキー） */
export function tickerSay(text) {
  if (!bench || bench.cs.mode !== "tournament") return;
  const t = el("div.tick", { text });
  bench.ticker.replaceChildren(t);
  requestAnimationFrame(() => t.classList.add("show"));
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
