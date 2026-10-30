// 本編と同じ工程を、保存済みのゲームを読み書きせず試す入口。
import { loadAll } from "../core/data.js";
import { newGame } from "../core/state.js";
import { initLayers, layers } from "../core/ui.js";
import { unlockAudio, SE } from "../core/audio.js";
import { el } from "../core/util.js";
import { newSession, openBench, stepPanel } from "./session.js";
import { stepPack } from "./steps.js";
import { runHoles } from "./holes.js";
import { runHeat } from "./heat.js";
import { mountWaterPour } from "./water-pour-view.js";

function fit() {
  const w = window.visualViewport?.width || innerWidth, h = window.visualViewport?.height || innerHeight;
  document.getElementById("stage").style.setProperty("--k", String(Math.min(w / 1280, (h - 52) / 720)));
}
function activeStep(step) {
  document.querySelectorAll("[data-preview-step]").forEach(link => {
    if (link.dataset.previewStep === step) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}
export async function boot() {
  fit(); window.addEventListener("resize", fit); window.visualViewport?.addEventListener("resize", fit);
  window.addEventListener("pointerdown", unlockAudio); window.addEventListener("keydown", unlockAudio);
  initLayers();
  await Promise.all([loadAll(), document.fonts.ready]);
  newGame(); // メモリ上の一台だけ。load / save / 設定の読込は呼ばない。
  const query = new URLSearchParams(location.search);
  const step = ["holes", "heat", "water"].includes(query.get("step")) ? query.get("step") : "pack";
  const cs = newSession("tutorial");
  cs.preview = true; // 試遊中のデモ既読は保存データへ書かない。
  cs.mix = { double_apple: 10, mint: 2 };
  if (step !== "pack") cs.pack = "normal";
  if (step === "heat") cs.equip.charcoal = query.get("charcoal") === "cube" ? "cube_charcoal" : "flat_charcoal";
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
  // Only this preview supplies a simulated extra asset. The game never adds a delay.
  await openBench(cs, { entryAssets: loadingPreview ? new Promise(resolve => setTimeout(resolve, 2200)) : null }).ready;
  document.getElementById("craft-preview-loading").hidden = true;
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
      layers.screen.append(el("section.craft-preview-end", [
        el("h1", { text: "炭焼き、おつかれさま。" }),
        el("a.btn.primary", { href: "craft-preview.html?step=heat", text: "フラット炭でもう一度" }),
        el("a.btn", { href: "craft-preview.html?step=heat&charcoal=cube", text: "キューブ炭で試す" }),
      ]));
      return;
    }
    if (step === "pack") await stepPack(cs);
    activeStep("holes");
    await runHoles(cs);
    layers.screen.append(el("section.craft-preview-end", [
      el("h1", { text: "一枚、できあがり。" }),
      el("p", { text: "上のメニューから、何度でも試せます。" }),
      el("a.btn.primary", { href: "craft-preview.html?step=holes", text: "もう一度、穴あけをする" }),
      el("a.btn", { href: "craft-preview.html", text: "詰め方を見比べる" }),
    ]));
  }
  play().catch(error => {
    const loading = document.getElementById("craft-preview-loading");
    loading.textContent = "試遊を続けられませんでした。ページを再読み込みしてください。";
    loading.hidden = false; console.error(error);
  });
}
