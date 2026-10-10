// 軽量な静止モックアップ。人物と台を一つの場面に収め、後から工程別動画へ差し替える。
import { el } from "../core/util.js";
import { bgUrl, makingUrl, portraitInfo } from "../core/data.js";
import { timeOfDay } from "../core/state.js";
import { artImg, artHeight } from "./art.js";

export const WORKER_STEPS = {
  setup: "道具を選ぶ", concept: "今日の一台を考える", mix: "香りを合わせる",
  pack: "葉を詰める", holes: "アルミに穴を開ける", heat: "炭の芯を確かめる",
  place: "炭を置く", steam: "熱が入るのを待つ", pull: "煙の温度を合わせる",
  care: "最後の一口まで整える", trial: "香りを届ける",
};

/** 作業台のシーシャ台（本体・ステム・受け皿・ボウル）。GAME OVER の影絵にも同じ組み方を使う。 */
export function buildHookahRig(cls) {
  const baseH = artHeight("hookah_base.png", 90);
  const stemH = artHeight("hookah_stem.png", 16);
  const base = artImg("hookah_base.png", 90, "worker-base");
  const stem = artImg("hookah_stem.png", 16, "worker-stem", { cropTop: Math.max(0, stemH - 110) });
  const tray = artImg("hookah_tray.png", 78, "worker-tray");
  const bowl = artImg("bowl_empty_silicone.png", 50, "worker-bowl");
  base.style.bottom = "0px";
  stem.style.bottom = `${baseH - 18}px`;
  tray.style.bottom = `${baseH + 73}px`;
  bowl.style.bottom = `${baseH + 85}px`;
  return el(`div.${cls}`, { "aria-hidden": "true" }, [stem, base, tray, bowl]);
}

export function buildWorkerScene(cs) {
  const portrait = portraitInfo("hajime", "serious");
  const actor = portrait ? el("img.worker-actor", { src: portrait.src, alt: "", draggable: false }) : null;
  for (const face of ["sad", "surprise"]) {
    const p = portraitInfo("hajime", face);
    if (p) { const warm = new Image(); warm.src = p.src; }
  }
  const caption = el("span.bench-worker-caption", { text: "一台を仕上げる" });
  const stage = el("div.bench-worker-stage", {
    role: "img", "aria-label": "はじめとシーシャの作業台を描いた静止イメージ",
    style: { backgroundImage: `url("${bgUrl(cs?.mode === "tournament" ? "bg_tournament_stage" : "bg_tonari_inside", timeOfDay())}")` },
  }, [
    actor,
    el("div.worker-counter", { style: { backgroundImage: `url("${makingUrl("bench_base.png")}")` } }),
    buildHookahRig("worker-equipment"),
    el("div.worker-vignette"),
    // 疲れたときの汗と荒い息（TH43）。顔の横に出す。
    el("i.worker-sweat", { "aria-hidden": "true" }, [el("i"), el("i")]),
    el("i.worker-breath", { "aria-hidden": "true" }),
    el("span.worker-scene-tag", { text: cs?.mode === "tournament" ? "SMOKE CROWN CUP" : "TONARI" }),
  ]);
  // 名前は出さない（自分のことなので分かる TH44）。体調の顔・フレーバーの葉・熱のイメージだけを置く。
  const footer = el("div.bench-worker-name", [caption]);
  const root = el("div.bench-worker", { dataset: { test: "worker-window", step: "" } }, [
    stage, footer,
  ]);
  // 表情: 蒸らしの雑念（揺れ）を優先し、落ち着いているときは疲れ具合で変える（TH43）。
  let mental = "steady", fatigue = 0;
  const applyFace = () => {
    const face = mental === "shaken" ? "surprise" : mental === "unsteady" ? "sad" : ["serious", "normal", "sad"][fatigue] || "serious";
    const p = portraitInfo("hajime", face);
    if (actor && p && actor.getAttribute("src") !== p.src) actor.src = p.src;
    root.dataset.face = face;
  };
  return { caption, footer, root, setMental(level) {
    if (mental === level && root.dataset.mental === level) return;
    mental = level; root.dataset.mental = level;
    applyFace();
  }, setFatigue(level) {
    fatigue = level; root.dataset.fatigue = String(level);
    applyFace();
  }, flinch() {
    root.classList.remove("flinch"); void root.offsetWidth; root.classList.add("flinch");
  } };
}
