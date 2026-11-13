// 本編と同じ工程を、保存済みのゲームを読み書きせず試す入口。
// ?step= pack（既定）/holes/heat/water/steam/pull/care/full。full は機材選びから調整2回目までの通しの一台（CRN・P0）。
// ?mode=rehearsal|tournament で場面（ランク・ライバルの小窓の出方）を切り替える（既定はリハーサル。pack〜heat・water は従来どおりレッスン）。
import { loadAll } from "../core/data.js";
import { newGame, state } from "../core/state.js";
import { initLayers, layers } from "../core/ui.js";
import { initStageFit } from "../core/stage-fit.js";
import { unlockAudio, SE } from "../core/audio.js";
import { installRotateGuard } from "../core/rotate-guard.js";
import { el } from "../core/util.js";
import { newSession, openBench, stepPanel } from "./session.js";
import { stepSetup, stepMix, stepPack, stepPlace, stepSteamTime } from "./steps.js";
import { stepWater } from "./water-view.js";
import { runHoles } from "./holes.js";
import { runHeat } from "./heat.js";
import { runSteamDodge } from "./steam.js";
import { runPull, runCare, PULL_TUNING } from "./pull.js";
import { HEAT_TUNING } from "./heat_logic.js";
import { finalize } from "./score.js";
import { newCarePracticeSession, CRAFT_STEPS } from "./practice.js";
import { mountWaterPour } from "./water-pour-view.js";
import { initCraftStage } from "./stage-layout.js";
import { craftRankProgress } from "./rank-hud.js";
import { CRAFT_RANK_THRESHOLDS } from "./common.js";

const STEPS = ["pack", "holes", "heat", "water", "steam", "pull", "care", "full"];
// 1工程だけ遊ぶときに、前の工程の結果として置く値（session.js の drill() と同じ前提）
const AFTER_HEAT = { place: "triangle", heat: { score: 80, heatPower: 60, heatStability: 60, burnRisk: 30, aromaRetention: 60, startup: 60, picks: ["just", "just", "pre"], just: 2 } };
const AFTER_HOLES = { holes: { score: 85, total: 24, outer: 12, middle: 12, inner: 0, evenness: .85, outerEven: .85, precision: .85, completion: 1, innerExcess: 0, minimumComplete: true } };

function activeStep(step) {
  document.querySelectorAll("[data-preview-step]").forEach(link => {
    if (link.dataset.previewStep === step) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function endCard(title, links, grade = null) {
  layers.screen.append(el("section.craft-preview-end", [
    grade ? el("img.craft-preview-rank", { src: `img/ui/craft-rank/rank-${grade}.webp`, alt: `ランク ${grade}`, dataset: { test: "preview-final-rank" } }) : null,
    el("h1", { text: title }),
    el("p", { text: "上のメニューから、何度でも試せます。" }),
    ...links.map(([text, href], i) => el(`a.btn${i ? "" : ".primary"}`, { href, text })),
  ]));
}

// ?tune=heat.readyGapExtra:0.4,pull.period:1.2 で、この試遊の間だけ手触りの値を差し替える（本編は読まない）
const TUNING = { heat: HEAT_TUNING, pull: PULL_TUNING };
function applyTune(text) {
  const applied = [];
  for (const pair of String(text || "").split(",")) {
    const [path, raw] = pair.split(":"), [group, key] = String(path).split("."), value = Number(raw);
    const table = TUNING[group];
    if (!table || !(key in table) || !Number.isFinite(value) || typeof table[key] !== "number") continue;
    table[key] = value; applied.push(`${group}.${key}=${value}`);
  }
  if (applied.length) console.info("[craft preview] tune:", applied.join(" "));
  return applied;
}

export async function boot() {
  initStageFit(document.getElementById("stage"), document.getElementById("viewport"));
  window.addEventListener("pointerdown", unlockAudio); window.addEventListener("keydown", unlockAudio);
  installRotateGuard(); // 縦持ちの回転ガード中は、制作の時計と音を止める（#2941）
  initLayers();
  initCraftStage(); // 新しい配置（?craftStage=1）も本編と同じ切り替えで試せる
  await Promise.all([loadAll(), document.fonts.ready]);
  newGame(); // メモリ上の一台だけ。load / save / 設定の読込は呼ばない。
  const query = new URLSearchParams(location.search);
  applyTune(query.get("tune"));
  const step = STEPS.includes(query.get("step")) ? query.get("step") : "pack";
  const late = ["steam", "pull", "care", "full"].includes(step);
  const mode = ["rehearsal", "tournament"].includes(query.get("mode")) ? query.get("mode") : late ? "rehearsal" : "tutorial";
  // 通しの一台は持ち込みの葉を用意しておく（ショップを通らないため）
  state.flavorStock = { double_apple: 50, mint: 50, blueberry: 50, lemon: 50 };
  state.flavors = ["double_apple", "mint", "blueberry", "lemon"];
  const cs = step === "care" ? newCarePracticeSession() : newSession(mode);
  cs.preview = true; // 試遊中のデモ既読は保存データへ書かない。
  if (step !== "care") cs.mix = { double_apple: 10, mint: 2 };
  if (step !== "pack" && step !== "full" && step !== "care") cs.pack = "normal";
  if (step === "heat") cs.equip.charcoal = query.get("charcoal") === "cube" ? "cube_charcoal" : "flat_charcoal";
  if (["full", "holes", "pack"].includes(step)) cs.foilOptIn = true; // 試遊では穴あけを必ず見せる（アルミの無いHMDでも）
  if (step === "steam" || step === "pull") Object.assign(cs, AFTER_HOLES, AFTER_HEAT, { steamSeconds: 300, steamMin: 5 });
  const temp = Number(query.get("temp"));
  if (step === "pull" && Number.isFinite(temp) && query.has("temp")) cs.steam = { temp, hits: 0, score: 100, seconds: 300, min: 5 };
  const loadingPreview = query.get("loading") === "comic";
  if (loadingPreview) {
    const plain = query.get("look") === "plain";
    document.getElementById("stage").dataset.loadingStudy = plain ? "plain" : "paper";
    const link = (text, href, current) => el("a", { text, href, "aria-current": current ? "page" : null });
    document.querySelector(".craft-preview-nav").replaceChildren(
      el("b", { text: "ロード画面の比較" }),
      link("紙面と煙の表示", "craft-preview.html?loading=comic", !plain),
      link("前の表示", "craft-preview.html?loading=comic&look=plain", plain),
      link("制作ミニゲーム", "craft-preview.html", false),
      el("small", { text: "確認用に約2秒で制作へ移ります・セーブには影響しません" }),
    );
  }
  const steps = step === "full" ? CRAFT_STEPS : step === "care" ? CRAFT_STEPS.filter(([id]) => id.startsWith("care"))
    : step === "steam" || step === "pull" ? CRAFT_STEPS.filter(([id]) => ["steam", "pull"].includes(id)) : [];
  // Only this preview supplies a simulated extra asset. The game never adds a delay.
  await openBench(cs, { steps, entryAssets: loadingPreview ? new Promise(resolve => setTimeout(resolve, 2200)) : null }).ready;
  document.getElementById("craft-preview-loading").hidden = true;
  globalThis.__craftPreview = { cs, step, done: false }; // 確認用の読み取り口
  async function play() {
    activeStep(step);
    if (step === "water") {
      // 試作：本編の工程列（#743）には入れず、試遊だけで遊ぶ。何本でも続けられる。
      const panel = stepPanel("setup", "水入れ", "長押しで注ぐ。入れすぎたら長押しでボトルを傾けてこぼす。揺れが収まってから、金の目安線に水面を合わせて「決める」", { brief: "目安線ぴったりに水を入れる" });
      globalThis.__waterPourPreview = mountWaterPour(panel, { sound: SE, endless: true }); // 確認用の読み取り口
      return;
    }
    if (step === "heat") {
      await runHeat(cs);
      endCard("炭焼き、おつかれさま。", [["フラット炭でもう一度", "craft-preview.html?step=heat"], ["キューブ炭で試す", "craft-preview.html?step=heat&charcoal=cube"]]);
      return;
    }
    if (step === "steam") {
      await runSteamDodge(cs);
      endCard("蒸らし、おつかれさま。", [["もう一度", location.search], ["続けて吸い出し", "craft-preview.html?step=pull"]]);
      return;
    }
    if (step === "pull") {
      await runPull(cs);
      endCard("一服、おつかれさま。", [["もう一度", location.search], ["調整で遊ぶ", "craft-preview.html?step=care"]]);
      return;
    }
    if (step === "care") {
      for (const round of [1, 2]) { await runCare(cs, { round }); if (cs.failed) break; }
      endCard("調整、おつかれさま。", [["もう一度", location.search], ["通しで一台", "craft-preview.html?step=full"]]);
      return;
    }
    if (step === "full") {
      await stepSetup(cs); await stepWater(cs); await stepMix(cs); await stepPack(cs);
      await runHoles(cs); await stepPlace(cs); await runHeat(cs); await stepSteamTime(cs); await runSteamDodge(cs);
      await runPull(cs);
      for (const round of [1, 2]) { if (cs.failed) break; await runCare(cs, { round }); }
      finalize(cs);
      const grade = craftRankProgress(cs.total, CRAFT_RANK_THRESHOLDS).grade;
      endCard(`一台、できあがり。総合 ${cs.total}`, [["もう一台", location.search], ["大会の雰囲気で", "craft-preview.html?step=full&mode=tournament"]], grade);
      return;
    }
    if (step === "pack") await stepPack(cs);
    activeStep("holes");
    await runHoles(cs);
    endCard("一枚、できあがり。", [["もう一度、穴あけをする", "craft-preview.html?step=holes"], ["詰め方を見比べる", "craft-preview.html"]]);
  }
  play().then(() => { globalThis.__craftPreview.done = true; }, error => {
    const loading = document.getElementById("craft-preview-loading");
    loading.textContent = "試遊を続けられませんでした。ページを再読み込みしてください。";
    loading.hidden = false; console.error(error);
  });
}
