/* ============================================================
   Rila Riders Rescue — shell.js
   ゲームエンジン（game.js）の外側のUI:
   ポーズメニュー / 操作ガイド / 設定 / フルスクリーン / SKIP表示制御
   エンジンとは window.RRR API 経由でのみやり取りする。
   ============================================================ */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const overlayPause = $("overlay-pause");
  const overlayHelp = $("overlay-help");
  const pauseBtn = $("btn-pause");
  const helpBtn = $("btn-help");
  const fullscreenBtn = $("btn-fullscreen");
  const fullscreenBtn2 = $("fullscreen-btn2");
  const resumeBtn = $("pause-resume");
  const pauseHelpBtn = $("pause-help");
  const titleBtn = $("pause-title");
  const helpCloseBtn = $("help-close");
  const visualModeBtn = $("visual-mode-btn");
  const volSlider = $("vol-slider");
  const volValue = $("vol-value");

  const rrr = () => window.RRR || null;

  // ---------- pause ----------

  let helpAutoPaused = false; // ヘルプ表示のために自動ポーズしたか
  let titleConfirmTimer = 0;

  function isPaused() {
    const api = rrr();
    return api ? api.isPaused() : false;
  }

  function syncSettingsUi() {
    const api = rrr();
    if (!api) return;
    if (volSlider) {
      const v = Math.round(api.getMasterVolume() * 100);
      volSlider.value = v;
      if (volValue) volValue.textContent = v + "%";
    }
    if (visualModeBtn) {
      visualModeBtn.textContent = (api.getVisualMode() || "cinematic").toUpperCase();
    }
  }

  function openPause() {
    const api = rrr();
    if (!api || isPaused()) return;
    api.pause();
    resetTitleConfirm();
    syncSettingsUi();
    overlayPause.classList.remove("hidden");
  }

  function closePause() {
    const api = rrr();
    overlayPause.classList.add("hidden");
    resetTitleConfirm();
    if (api && isPaused()) api.resume();
  }

  function togglePause() {
    if (!overlayHelp.classList.contains("hidden")) {
      closeHelp();
      return;
    }
    if (isPaused()) closePause();
    else openPause();
  }

  // ---------- help ----------

  function openHelp() {
    const api = rrr();
    // ゲーム中にガイドを開いたら自動でポーズ
    if (api && !isPaused()) {
      api.pause();
      helpAutoPaused = true;
    }
    overlayPause.classList.add("hidden");
    overlayHelp.classList.remove("hidden");
  }

  function closeHelp() {
    overlayHelp.classList.add("hidden");
    if (helpAutoPaused) {
      // ガイドのために自動ポーズした場合はそのまま再開
      helpAutoPaused = false;
      const api = rrr();
      if (api && isPaused()) api.resume();
    } else if (isPaused()) {
      // ポーズメニュー経由ならポーズ画面に戻る
      overlayPause.classList.remove("hidden");
    }
  }

  // ---------- return to title (2段階確認) ----------

  function resetTitleConfirm() {
    if (titleBtn) titleBtn.textContent = "タイトルに戻る";
    titleConfirmTimer = 0;
  }

  if (titleBtn) {
    titleBtn.addEventListener("click", () => {
      const api = rrr();
      if (!api) return;
      const now = performance.now();
      if (titleConfirmTimer && now - titleConfirmTimer < 3000) {
        overlayPause.classList.add("hidden");
        resetTitleConfirm();
        api.returnToTitle();
        if (api.isPaused()) api.resume();
      } else {
        titleConfirmTimer = now;
        titleBtn.textContent = "進行は失われます — もう一度押して確定";
        setTimeout(() => {
          if (titleConfirmTimer && performance.now() - titleConfirmTimer >= 3000) {
            resetTitleConfirm();
          }
        }, 3100);
      }
    });
  }

  // ---------- fullscreen ----------

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen({ navigationUI: "hide" });
      }
    } catch (_e) { /* 非対応環境では無視 */ }
  }

  // ---------- visual mode ----------

  if (visualModeBtn) {
    visualModeBtn.addEventListener("click", () => {
      const api = rrr();
      if (!api) return;
      api.toggleVisualMode();
      syncSettingsUi();
    });
  }

  // ---------- wiring ----------

  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  if (resumeBtn) resumeBtn.addEventListener("click", closePause);
  if (helpBtn) helpBtn.addEventListener("click", openHelp);
  if (pauseHelpBtn) pauseHelpBtn.addEventListener("click", openHelp);
  if (helpCloseBtn) helpCloseBtn.addEventListener("click", closeHelp);
  if (fullscreenBtn) fullscreenBtn.addEventListener("click", toggleFullscreen);
  if (fullscreenBtn2) fullscreenBtn2.addEventListener("click", toggleFullscreen);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" || e.code === "KeyP") {
      e.preventDefault();
      togglePause();
    }
  });

  // タブが非表示になったら自動ポーズ（戦闘中のみ）
  document.addEventListener("visibilitychange", () => {
    const api = rrr();
    if (!api) return;
    if (document.hidden && !isPaused()) {
      const st = api.getState();
      if (st === "play" || st === "boss") openPause();
    }
  });

  // ---------- help tabs ----------

  const tabs = document.querySelectorAll("#help-tabs .tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      ["basic", "sword", "trick", "gun", "royal"].forEach((name) => {
        const body = $("tab-" + name);
        if (body) body.classList.toggle("hidden", name !== tab.dataset.tab);
      });
    });
  });

  // ---------- SKIPボタンの表示制御（カットシーン系の時だけ） ----------

  const SKIP_STATES = new Set([
    "tutorial", "cutscene", "stage_intro", "pre_boss", "god_phase_cutscene",
  ]);

  setInterval(() => {
    const api = rrr();
    if (!api) return;
    document.body.classList.toggle("show-skip", SKIP_STATES.has(api.getState()));
  }, 250);
})();
