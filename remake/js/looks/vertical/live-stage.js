// 表示中の本編の層だけを縦長に組む。元のボタン・入力座標・進行中のゲームを維持する。
import { buildVersioned } from "../../core/asset-version.js";
import { fitStage } from "../../core/stage-fit.js";

import { followCat } from "../../minigames/tetsuko-portrait.js";
import { mountPortraitTable } from "../../trpg/portrait-layout.js";

const gameScenes = {
  ".axe-game": "axe",
  ".camel-game": "camel",
  ".desert-ride": "desert",
  ".dj-frame": "dj",
  ".tonari-floor": "floor",
  ".trpg-root": "trpg",
  ".tetsuko-time": "tetsuko",
};
const selectors = Object.keys(gameScenes);
const games = selectors.join(", ");
const styledGames = new Set(["camel", "desert", "trpg", "tetsuko"]);
let cleanup;

export function livePortraitScene() {
  const modal = document.querySelector("#modal.show");
  if (modal) {
    if (modal.querySelector(":scope > .gal-overlay")) return "gallery";
    if (modal.querySelector(".axe-bar-menu, .dj-club-menu")) return "club";
    if (modal.querySelector(":scope > .reel-intro")) return "reel";
    return "";
  }
  const game = document.querySelector(games);
  if (game && !game.closest(".done, [hidden]")) return gameScenes[selectors.find(selector => game.matches(selector))];
  const fx = document.getElementById("fx");
  if (fx?.querySelector(".reel-night, .reel-cutin, .reel-intro")) return "reel";
  if (document.body.matches(".vn-open, .in-vn") || fx?.querySelector(".gboard")) return "";
  const screen = document.querySelector("#screen > :not(.done)");
  if (!screen) return "";
  if (screen.matches(".axe-bar-menu,.dj-club-menu")) return "club";
  if (screen.matches("main.chapter-clear")) return "clear";
  if (screen.matches(".result-screen, .staff-roll")) return "ending";
  if (screen.matches(".bench")) {
    const panel = screen.querySelector(".bench-panel");
    if (!panel) return "";
    const step = panel.dataset.step;
    if (step === "steam" && screen.querySelector(".bench-title")?.textContent === "0分蒸らし") return "steam";
    if (step === "place" || panel.querySelector(".vent-preview") || step === "setup" && screen.querySelector(".bench-title")?.textContent.startsWith("機材")) return "equipment";
  }
  return "";
}

export function setLivePortraitScene(name) {
  const stage = document.getElementById("stage");
  if (!stage || (stage.dataset.portraitScene || "") === name) return;
  cleanup?.();
  cleanup = null;
  if (name) stage.dataset.portraitScene = name;
  else delete stage.dataset.portraitScene;
  fitStage(stage);
  if (styledGames.has(name)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = buildVersioned(new URL(`previews/portrait-stage/frame/${name}.css`, document.baseURI).href);
    link.onload = () => window.dispatchEvent(new Event("resize"));
    document.head.append(link);
    const teardown = [];
    if (name === "trpg") {
      const host = stage.querySelector(".trpg-root").parentElement;
      document.documentElement.dataset.layout = "portrait";
      teardown.push(mountPortraitTable(stage, host));
    }
    if (name === "tetsuko") teardown.push(followCat(stage.querySelector(".tetsuko-time")));
    if (name === "camel" || name === "tetsuko") {
      const resize = new ResizeObserver(() => {
        const height = stage.clientHeight;
        const cat = name === "tetsuko";
        const z = Math.max(cat ? .9 : .92, Math.min(cat ? 1.25 : 1.2, (height - 430) / 720));
        stage.style.setProperty("--z", String(z));
        if (cat) stage.style.setProperty("--f", String(Math.max(1, Math.min(1.2, (height - 720 * z) * stage.getBoundingClientRect().width / 640 / 258))));
      });
      resize.observe(stage);
      teardown.push(() => resize.disconnect());
    }
    cleanup = () => {
      for (const stop of teardown) stop();
      if (name === "trpg") delete document.documentElement.dataset.layout;
      stage.style.removeProperty("--z");
      stage.style.removeProperty("--f");
      link.remove();
    };
  }
  window.dispatchEvent(new Event("resize"));
}
