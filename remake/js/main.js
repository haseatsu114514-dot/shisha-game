// 起動: ステージの拡縮 → データ読込 → タイトル。
import { $ } from "./core/util.js";
import { loadAll, DB } from "./core/data.js";
import { initLayers } from "./core/ui.js";
import { loadConfig, state } from "./core/state.js";
import { unlockAudio } from "./core/audio.js";
import { vnTest } from "./vn/engine.js";
import { craftTest } from "./craft/session.js";
import { showTitle } from "./scenes/title.js";

function fitStage() {
  const stage = $("#stage");
  const k = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `scale(${k})`;
}

async function boot() {
  fitStage();
  window.addEventListener("resize", fitStage);
  window.addEventListener("orientationchange", () => setTimeout(fitStage, 200));
  initLayers();
  loadConfig();
  // 自動再生制限: 最初の操作で音を解禁（以後も操作のたびに保険で呼ぶ・軽い）
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);

  const bar = $("#boot .boot-bar i");
  try {
    await loadAll((p) => { bar.style.width = `${Math.round(p * 100)}%`; });
  } catch (e) {
    $("#boot .boot-msg").textContent = `読み込みに失敗しました（${e.message}）。ローカルサーバー越しに開いているか確認してください。`;
    throw e;
  }
  $("#boot").classList.add("done");
  setTimeout(() => $("#boot").remove(), 700);
  showTitle();
}

// テスト・デバッグ用フック（見た目を変えてもテストが壊れないよう、ここだけに依存させる）
window.__remake = {
  get state() { return state; },
  DB,
  vnTest,
  craftTest,
};

boot();
