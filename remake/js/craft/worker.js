// 工程に応じた人物・手元を既存の台へ重ねる。実入力の穴あけと吸引中の泡を表示する。
import { el } from "../core/util.js";
import { bgUrl, makingUrl, portraitInfo } from "../core/data.js";
import { timeOfDay } from "../core/state.js";
import { artImg, artHeight } from "./art.js";
import { buildWorkerActions, workerSceneKey, readyWorkerImage } from "./worker-scenes.js";
import { buildWorkerHoles } from "./worker-holes.js";
import { imageReady } from "../core/ui.js";
import { renderSceneArt, sceneArtUrls } from "../core/scene-art.js";

/** 作業台の背景（大会＝会場、家で練習＝自宅・#638、それ以外＝tonari の店内） */
export const benchBgRef = (cs) => cs?.mode === "tournament" ? "bg_tournament_stage" : cs?.venue === "home" ? "bg_home" : "bg_tonari_inside";
/** 作業風景の左上の場所の札 */
export const benchPlaceTag = (cs) => cs?.mode === "tournament" ? cs.eventTitle || "SMOKE CROWN CUP" : cs?.venue === "home" ? "HOME" : "TONARI";

export const WORKER_STEPS = {
  setup: "道具を選ぶ", mix: "香りを合わせる",
  pack: "葉を詰める", holes: "アルミに穴を開ける", heat: "炭の焼け具合を確かめる",
  place: "炭を置く", steam: "蒸らしを待つ", pull: "煙の温度を合わせる",
  care: "最後の一口まで整える",
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
  const caption = el("span.bench-worker-caption", { text: "一台を仕上げる" });
  const actions = buildWorkerActions();
  const holes = buildWorkerHoles();
  actions.root.append(holes.root);
  const equipment = buildHookahRig("worker-equipment");
  const baseH = artHeight("hookah_base.png", 90);
  // 確定した水位（cs.water 0〜1）を、ベルの胴に溜まる水として描く。ガラスの奥に置き、半透明の本体越しに見せる。
  // 水面の高さだけを動かし、泡や判定とは分ける。cs.water が未設定の間は隠す。
  const waterLevel = el("div.worker-water-level", { "aria-hidden": "true", dataset: { test: "worker-water-level" },
    style: { bottom: `${baseH * .05}px`, width: `${90 * .6}px`, height: `${baseH * .5}px` },
  }, [el("i.worker-water-body"), el("i.worker-water-surface")]);
  const applyWaterLevel = (value) => {
    const has = Number.isFinite(value);
    waterLevel.hidden = !has;
    if (!has) return;
    const v = Math.max(0, Math.min(1, value));
    waterLevel.style.setProperty("--water-q", v.toFixed(3));
    waterLevel.dataset.band = v < .45 ? "low" : v > .55 ? "high" : "ideal";
  };
  applyWaterLevel(cs.water);
  const baseArt = equipment.querySelector(".worker-base");
  if (baseArt) equipment.insertBefore(waterLevel, baseArt); else equipment.append(waterLevel);
  const water = el("div.worker-water", { "aria-hidden": "true", dataset: { test: "worker-bubbles" },
    style: { bottom: `${baseH * .18}px`, height: `${baseH * .36}px` },
  }, Array.from({ length: 9 }, (_, i) => el("i", { style: { "--bubble-x": `${24 + (i * 19 % 53)}%`, "--bubble-delay": `${i * -.11}s` } })));
  equipment.append(water);
  const stage = el("div.bench-worker-stage", {
    role: "img", "aria-label": "はじめとシーシャの作業台を描いた静止イメージ",
    style: { backgroundImage: `url("${bgUrl(benchBgRef(cs), timeOfDay())}")` },
  }, [
    actor,
    el("div.worker-counter", { style: { backgroundImage: `url("${makingUrl("bench_base.png")}")` } }),
    equipment,
    actions.root,
    el("div.worker-vignette"),
    // 疲れたときの汗と荒い息（TH43）。顔の横に出す。
    el("i.worker-sweat", { "aria-hidden": "true" }, [el("i"), el("i")]),
    el("i.worker-breath", { "aria-hidden": "true" }),
    el("span.worker-scene-tag", { text: benchPlaceTag(cs) }),
  ]);
  // 家の練習窓は家の背景を使うが、所持品の台は描かない。作業中に見せる台は大会用だけ（#873）。
  const homeBg = benchBgRef(cs) === "bg_home" ? bgUrl("bg_home", timeOfDay()) : null;
  if (homeBg) {
    const backdrop = el("div", { style: { position: "absolute", inset: "0", zIndex: "-1", pointerEvents: "none", backgroundSize: "cover", backgroundPosition: "35% center" } });
    renderSceneArt(backdrop, homeBg, { homeRigs: false });
    stage.prepend(backdrop);
  }
  // 名前と体調バッジは出さない。疲れは人物の表情と汗、吸引は水泡で伝える。
  const footer = el("div.bench-worker-name", [caption]);
  const root = el("div.bench-worker", { dataset: { test: "worker-window", step: "" } }, [
    stage, footer,
  ]);
  // 表情: 蒸らしの雑念（揺れ）を優先し、落ち着いているときは疲れ具合で変える（TH43）。
  let mental = "steady", fatigue = 0;
  let facesChecked = false;
  const usableFaces = new Set();
  const faceUrls = [...new Set([
    ...["serious", "normal", "sad", "surprise"].map(face => portraitInfo("hajime", face)?.src),
  ].filter(Boolean))];
  const warmFaces = Promise.all(faceUrls.map(async url => {
    if (await imageReady(url, 15000, { keep: true })) usableFaces.add(url);
  }));
  const usable = url => url && (!facesChecked || usableFaces.has(url));
  const applyFace = () => {
    const waiting = root.dataset.step === "steam";
    const face = mental === "shaken" ? "surprise" : mental === "unsteady" ? "sad" : ["serious", "normal", "sad"][fatigue] || "serious";
    const p = portraitInfo("hajime", face);
    const calmUrl = makingUrl("hajime_steam_wait.png");
    const calm = waiting && mental === "steady" && fatigue < 2 && usable(calmUrl) && calmUrl;
    const src = calm || (usable(p?.src) ? p.src : faceUrls.find(usable));
    if (actor) actor.hidden = !src;
    if (actor && src && actor.getAttribute("src") !== src) actor.src = src;
    root.dataset.face = face;
    root.dataset.waiting = String(!!calm);
    const sceneKey = workerSceneKey(root.dataset.step, root.dataset.draw);
    const scene = actions.show(sceneKey === "holes" && !holes.available ? null : sceneKey);
    holes.show(sceneKey === "holes" && !!scene);
    root.dataset.scene = scene ? sceneKey : waiting ? "focus" : "fallback";
    root.dataset.artFallback = String(!!sceneKey && !scene);
    stage.setAttribute("aria-label", scene?.description || `はじめの作業風景：${WORKER_STEPS[root.dataset.step] || "一台を仕上げる"}`);
    if (waiting) {
      caption.textContent = WORKER_STEPS.steam;
      stage.setAttribute("aria-label", calm ? "はじめが目を閉じて精神を集中し、蒸らしを待つ" : fatigue === 2 && mental === "steady" ? "蒸らしを待つはじめの目元に疲れが出ている" : mental !== "steady" ? "蒸らしを待つはじめの目元に動揺が出ている" : "はじめが集中して蒸らしを待つ");
    }
  };
  const ready = Promise.all([actions.ready, holes.ready, warmFaces, ...sceneArtUrls(homeBg, { homeRigs: false }).map(url => imageReady(url, 15000))]).then(async () => {
    facesChecked = true;
    applyFace();
    if (actor && !actor.hidden && !await readyWorkerImage(actor, actor.getAttribute("src"))) {
      usableFaces.delete(actor.getAttribute("src"));
      applyFace();
    }
  });
  const prepare = async step => {
    const key = workerSceneKey(step, null);
    await Promise.all([
      actions.prepare(key),
      key === "holes" ? holes.prepare() : null,
      ["steam", "timer"].includes(step) ? (async () => {
        const url = makingUrl("hajime_steam_wait.png");
        if (url && await imageReady(url, 15000, { keep: true })) usableFaces.add(url);
      })() : null,
      ["pull", "care"].includes(step) ? actions.prepare("inhale") : null,
    ]);
    applyFace();
    if (["steam", "timer"].includes(step) && actor && !actor.hidden) {
      await readyWorkerImage(actor, actor.getAttribute("src"));
    }
  };
  return { caption, footer, root, ready, prepare, setStep(step) {
    holes.reset();
    root.dataset.step = step;
    delete root.dataset.draw;
    mental = "steady"; root.dataset.mental = mental;
    caption.textContent = WORKER_STEPS[step] || "一台を仕上げる";
    applyFace();
    // 装飾だけを切り替える呼出しでも、必要な工程画像だけを裏で用意する。
    prepare(step).then(() => { if (root.isConnected && root.dataset.step === step) applyFace(); });
  }, punch(event) {
    if (root.dataset.step === "holes") holes.punch(event);
  }, setWater(value) {
    applyWaterLevel(value);
  }, setMental(level) {
    if (mental === level && root.dataset.mental === level) return;
    mental = level; root.dataset.mental = level;
    applyFace();
  }, setFatigue(level) {
    fatigue = level; root.dataset.fatigue = String(level);
    applyFace();
  }, flinch() {
    root.classList.remove("flinch"); void root.offsetWidth; root.classList.add("flinch");
  }, setDraw(kind, duration = 0) {
    if (kind) {
      root.dataset.draw = kind;
      root.style.setProperty("--draw-duration", `${duration}ms`);
      applyFace();
      caption.textContent = kind === "up" ? "熱を入れる吸い…" : kind === "down" ? "熱を逃がす吸い…" : "温度を保ちながら吸う…";
      stage.setAttribute("aria-label", `はじめの作業風景：${caption.textContent}。ベースの水が泡立っている`);
    } else {
      delete root.dataset.draw;
      applyFace();
      caption.textContent = WORKER_STEPS[root.dataset.step] || "一台を仕上げる";
    }
  } };
}
