// The debug menu calls the current game implementations directly. Results live only in memory.
import { newState } from "../core/state.js";
import { DJ_SETS } from "../minigames/dj.js";
import { CAMEL_CUPS } from "../minigames/camel-race-model.js";

const GAMES = [
  { id: "axe", label: "斧投げ", start: async (host, signal) => (await import("../minigames/axe.js")).runAxeThrow({ host, signal, mode: "practice", opponent: null }) },
  { id: "camel", label: "ラクダレース", start: async (host, signal) => (await import("../minigames/camel-race.js")).runCamelRace({ host, signal, cups: CAMEL_CUPS.map(cup => cup.id) }) },
  { id: "desert", label: "DESERT RIDE（砂丘）", start: async (host, signal) => (await import("../minigames/desert-ride.js")).runDesertRide({ host, signal }) },
  ...DJ_SETS.map(set => ({ id: `dj-${set.id}`, label: `DJ ${set.name}`, start: async (host, signal) => (await import("../minigames/dj.js")).runDjSet({ host, signal, set: set.id }) })),
  { id: "ichidai", label: "一台勝負（カード）", start: async (host, signal) => (await import("../minigames/ichidai.js")).runIchidai({ host, signal, opponent: { id: "sumi", name: "スミさん" } }) },
  { id: "tetsuko", label: "てつこといっしょ", start: async (_host, signal) => {
    const value = newState();
    value.chapter = 3; value.phase = "daily"; value.day = 5;
    return (await import("../minigames/tetsuko-time.js")).openTetsukoTime({ value, visitKey: "debug", signal });
  } },
  // ボドゲカフェは、本編と同じ本棚と卓を使い捨ての状態で開く試遊（TRF21。URL の ?trial=trpg と同じもの）。
  { id: "trpg", label: "ボドゲカフェ（昼・七つの灯り）", start: async (host, signal) =>
    (await import("../trpg/trial.js")).mountTrpgTrial(host, { preset: "noon", signal, exitLabel: "試遊を閉じる" }).finished },
  { id: "trpg-night", label: "TRPG（夜・物語）", start: async (host, signal) =>
    (await import("../trpg/trial.js")).mountTrpgTrial(host, { preset: "ready", signal, exitLabel: "試遊を閉じる" }).finished },
];

export const DEBUG_MINIGAMES = Object.freeze(GAMES.map(({ id, label }) => ({ id, label })));

export function mountMiniGameDebug() {
  const row = document.createElement("div");
  row.className = "dbg-row";
  let current = null;
  for (const game of GAMES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = game.label;
    button.dataset.test = `debug-minigame-${game.id}`;
    button.onclick = async () => {
      current?.abort();
      document.querySelector("[data-test='debug-minigame-host']")?.remove();
      document.querySelector("[data-test='debug-minigame-close']")?.remove();
      const stage = document.getElementById("stage");
      const panel = document.querySelector("[data-test='debug-panel']");
      const toggle = document.querySelector("[data-test='debug-toggle']");
      if (!stage || !panel) return;
      const controller = new AbortController();
      current = controller;
      const host = document.createElement("div");
      host.dataset.test = "debug-minigame-host";
      Object.assign(host.style, { position: "absolute", inset: "0", zIndex: "100", background: "#100d18" });
      if (game.id !== "tetsuko") stage.append(host);
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "ミニゲームを閉じる（タイトルへ）";
      close.dataset.test = "debug-minigame-close";
      close.style.marginBottom = "8px";
      close.onclick = () => { controller.abort(); host.remove(); close.remove(); if (current === controller) current = null; location.reload(); };
      panel.prepend(close);
      if (toggle) toggle.textContent = "DBG・終了";
      panel.hidden = true;
      try { await game.start(host, controller.signal); }
      catch (error) { if (!controller.signal.aborted) { host.textContent = `開始できませんでした: ${error.message}`; if (!host.isConnected) stage.append(host); } return; }
      if (current === controller && !controller.signal.aborted) close.click();
    };
    row.append(button);
  }
  return row;
}
