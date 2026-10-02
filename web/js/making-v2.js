// Shisha-making comparison build.
// This file is intentionally opt-in: the shipped game stays on the current UI
// unless the URL includes ?making_preview=v2.  ?making_preview=legacy exposes
// the same preview launcher without changing the current presentation.
(function setupMakingV2Preview() {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const previewMode = params.get("making_preview");
  const previewEnabled = previewMode === "v2" || previewMode === "legacy";
  const v2Enabled = previewMode === "v2";

  if (v2Enabled) document.body.classList.add("making-v2");

  const PHASES = [
    { id: "setup", label: "道具", sub: "SETUP", steps: ["setup_bowl", "setup_hms", "setup_charcoal"] },
    { id: "blend", label: "味作り", sub: "BLEND", steps: ["theme", "mix", "pack"] },
    { id: "heat", label: "熱作り", sub: "HEAT", steps: ["foil", "coal", "coalfire", "steam"] },
    { id: "serve", label: "仕上げ", sub: "SERVE", steps: ["pull", "adjust"] },
  ];

  const STEP_LABELS = {
    setup_bowl: "ボウル", setup_hms: "HMS", setup_charcoal: "炭種",
    theme: "テーマ", mix: "配合", pack: "詰め",
    foil: "穴あけ", coal: "炭数", coalfire: "炭起こし", steam: "蒸らし",
    pull: "吸い出し", adjust: "熱管理",
  };

  const STEP_NUMBERS = {
    setup: "01", theme: "02", mix: "03", pack: "04", foil: "05",
    coal: "06", coalfire: "07", steam: "08", pull: "09", adjust: "10",
  };

  function phaseOf(step) {
    return PHASES.findIndex((phase) => phase.steps.includes(step));
  }

  function selectedLabel(collection, id, fallback) {
    if (!id) return fallback;
    const found = (collection || []).find((item) => item.id === id);
    return found ? (found.label || found.name || found.short_name || id) : id;
  }

  function compactFlavorName(id) {
    const flavor = (D.flavors || []).find((item) => item.id === id);
    return flavor ? (flavor.short_name || flavor.name || id).replace(/^AF |^NS /, "") : id;
  }

  function recipeSnapshot() {
    const mixEntries = Object.entries((tt && tt.mix) || {}).filter(([, grams]) => grams > 0);
    const total = mixEntries.reduce((sum, [, grams]) => sum + grams, 0);
    return {
      bowl: selectedLabel(D.equipment, tt && tt.bowl, "未選択"),
      hms: selectedLabel(D.equipment, tt && tt.hms, "未選択"),
      charcoal: selectedLabel(D.equipment, tt && tt.charcoal, "未選択"),
      theme: tt && tt.theme ? tt.theme.label : "未決定",
      mix: mixEntries.length
        ? mixEntries.map(([id, grams]) => `${compactFlavorName(id)} ${grams}g`).join(" + ")
        : "未配合",
      total,
      pack: selectedLabel(typeof PACKS !== "undefined" ? PACKS : [], tt && tt.pack, "未選択"),
      steam: tt && tt.steam != null ? `${tt.steam}分` : "未選択",
    };
  }

  function progressMarkup() {
    const step = tt && tt.step;
    const activePhase = Math.max(0, phaseOf(step));
    const flow = typeof makingFlow === "function" ? makingFlow() : [];
    const stepIndex = flow.findIndex(([key]) => key === step);
    const modeLabel = tt && ({
      tournament: "TOURNAMENT", tutorial: "TUTORIAL", baito: "ORDER",
      drill: "DRILL", rehearsal: "REHEARSAL",
    }[tt.mode] || "MAKING");

    return `
      <div class="m2-progress-head">
        <span class="m2-mode">${modeLabel || "MAKING"}</span>
        <span class="m2-step-count">${String(Math.max(0, stepIndex) + 1).padStart(2, "0")} / ${String(flow.length).padStart(2, "0")}</span>
      </div>
      <div class="m2-phase-rail" aria-label="シーシャ作りの進行">
        ${PHASES.map((phase, index) => `
          <div class="m2-phase ${index < activePhase ? "done" : ""} ${index === activePhase ? "active" : ""}">
            <span class="m2-phase-dot">${index < activePhase ? "✓" : index + 1}</span>
            <span class="m2-phase-copy"><b>${phase.label}</b><small>${phase.sub}</small></span>
          </div>`).join("")}
      </div>`;
  }

  function contextMarkup() {
    const recipe = recipeSnapshot();
    const mixValue = recipe.total ? `${recipe.total}g` : "—";
    return `
      <div class="m2-context-title">
        <span>CURRENT BUILD</span>
        <small>いま作っている一台</small>
      </div>
      <div class="m2-context-grid">
        <div class="m2-context-item"><span>テーマ</span><b>${recipe.theme}</b></div>
        <div class="m2-context-item"><span>配合量</span><b>${mixValue}</b></div>
        <div class="m2-context-item"><span>ボウル</span><b>${recipe.bowl}</b></div>
        <div class="m2-context-item"><span>詰め</span><b>${recipe.pack}</b></div>
      </div>
      <div class="m2-mix-note" title="${recipe.mix}">${recipe.mix}</div>`;
  }

  function fitPortraitScene(stage) {
    if (!stage) return;
    const canvas = stage.querySelector(":scope > .m2-scene-canvas");
    if (!canvas) return;
    const portrait = window.matchMedia("(orientation: portrait) and (max-width: 700px)").matches;
    if (!portrait || !stage.isConnected) {
      canvas.removeAttribute("style");
      return;
    }
    // Existing scene art was authored around the desktop workbench size.
    // Keep that coordinate system and scale the complete scene as one unit so
    // fixed-pixel hands, bowls and burners do not get cropped on a narrow phone.
    const designWidth = 800;
    const designHeight = 500;
    const scale = Math.min(stage.clientWidth / designWidth, stage.clientHeight / designHeight);
    canvas.style.inset = "auto";
    canvas.style.width = `${designWidth}px`;
    canvas.style.height = `${designHeight}px`;
    canvas.style.left = `${(stage.clientWidth - designWidth * scale) / 2}px`;
    canvas.style.top = `${(stage.clientHeight - designHeight * scale) / 2}px`;
    canvas.style.transform = `scale(${scale})`;
  }

  function buildSceneCanvas(stage) {
    const canvas = document.createElement("div");
    canvas.className = "m2-scene-canvas";
    while (stage.firstChild) canvas.appendChild(stage.firstChild);
    stage.appendChild(canvas);
    window.requestAnimationFrame(() => fitPortraitScene(stage));
  }

  function decorateWorkbench(stage) {
    if (!v2Enabled || !stage || !tt) return stage;
    const scene = MAKING_SCENE[tt.step] || tt.step;
    const phaseIndex = Math.max(0, phaseOf(tt.step));
    buildSceneCanvas(stage);
    const badge = document.createElement("div");
    badge.className = "m2-stage-badge";
    badge.innerHTML = `<span>${STEP_NUMBERS[scene] || "00"}</span><b>${STEP_LABELS[tt.step] || "WORK"}</b><small>WORKBENCH FEED</small>`;
    stage.appendChild(badge);

    const focus = document.createElement("div");
    focus.className = "m2-stage-focus";
    focus.innerHTML = `<span>PHASE ${phaseIndex + 1}</span><b>${PHASES[phaseIndex].sub}</b>`;
    stage.appendChild(focus);
    return stage;
  }

  if (v2Enabled) {
    window.addEventListener("resize", () => {
      document.querySelectorAll(".making-stage").forEach((stage) => fitPortraitScene(stage));
    });
  }

  if (v2Enabled && typeof renderMakingWorkbench === "function") {
    const renderLegacyWorkbench = renderMakingWorkbench;
    renderMakingWorkbench = function renderMakingWorkbenchV2(step, opts) {
      return decorateWorkbench(renderLegacyWorkbench(step, opts));
    };
  }

  if (v2Enabled && typeof tnPanel === "function") {
    const renderLegacyPanel = tnPanel;
    tnPanel = function renderMakingPanelV2(title, hint) {
      const controls = renderLegacyPanel(title, hint);
      if (!tt || !isMakingWorkbenchPanel(title)) return controls;

      const progress = document.getElementById("tn-progress");
      if (progress) progress.innerHTML = progressMarkup();

      const context = document.createElement("section");
      context.className = "m2-context";
      context.innerHTML = contextMarkup();
      controls.prepend(context);

      const actionHead = document.createElement("div");
      actionHead.className = "m2-action-head";
      actionHead.innerHTML = `<span>YOUR MOVE</span><small>${STEP_LABELS[tt.step] || "工程"}を決める</small>`;
      context.after(actionHead);
      return controls;
    };
  }

  function seedPreviewState() {
    if (!state) state = newState();
    state.phase = "daily";
    state.day = 7;
    state.stats = { technique: 35, sense: 35, guts: 35, charm: 35, insight: 35 };
    state.owned = (D.equipment || []).map((item) => item.id);
    state.flags._kumicho_zero_steam = true;
    state.flags._tutorial_done = true;
  }

  function seedRecipeFor(step) {
    if (!tt) return;
    const order = [
      "setup_bowl", "setup_hms", "setup_charcoal", "theme", "mix", "pack",
      "foil", "coal", "coalfire", "steam", "pull", "adjust",
    ];
    const index = Math.max(0, order.indexOf(step));
    Object.assign(tt, {
      bowl: null, hms: null, charcoal: null, theme: null, mix: {}, pack: null,
      foilHits: 0, foilDone: false, holeResult: null, coal: null,
      coalFire: null, coalResult: null, steam: null, steamHits: null,
      pull: null, pullCount: 0, temp: null, care: null, adjustPhase: null,
    });
    if (index >= 1) tt.bowl = "silicone_bowl";
    if (index >= 2) tt.hms = "lotos_hagal";
    if (index >= 3) tt.charcoal = "flat_charcoal";
    if (index >= 4) tt.theme = THEMES[0];
    if (index >= 4) tt.mix = { double_apple: 8, mint: 4 };
    if (index >= 6) tt.pack = "normal";
    if (index >= 7) {
      tt.foilHits = 5;
      tt.foilDone = true;
      tt.holeResult = {
      totalHoles: 18, evenness: 72, outerHoles: 8, middleHoles: 6, innerHoles: 4,
      heatSpread: 70, score: 76,
      };
    }
    if (index >= 8) tt.coal = "triangle";
    if (index >= 9) {
      tt.coalFire = "good";
      tt.coalResult = { justCount: 2, heatStability: 72, burnRisk: 24 };
    }
    if (index >= 10) {
      tt.steam = 8;
      tt.steamHits = 1;
    }
    if (index >= 10) {
      const target = pullTargetZone();
      tt.temp = (target[0] + target[1]) / 2;
      tt.pull = "good";
      tt.pullCount = 2;
    }
  }

  function jumpPreview(step) {
    if (!tt) {
      seedPreviewState();
      beginMaking("rehearsal");
      // beginMaking waits for the first three workbench images on a cold load.
      // Jump only after that entry callback has rendered its initial step, or it
      // would overwrite the requested preview a moment later.
      const startedAt = Date.now();
      const waitForEntry = window.setInterval(() => {
        if (tt && tt.step) {
          window.clearInterval(waitForEntry);
          seedRecipeFor(step);
          tournamentStep(step);
        } else if (Date.now() - startedAt > 4000) {
          window.clearInterval(waitForEntry);
        }
      }, 30);
      setPreviewDockCollapsed(true);
      return;
    }
    seedRecipeFor(step);
    tournamentStep(step);
    setPreviewDockCollapsed(true);
  }

  function updatePreviewUrl(mode) {
    const url = new URL(window.location.href);
    url.searchParams.set("making_preview", mode);
    return url.href;
  }

  function setPreviewDockCollapsed(collapsed) {
    const dock = document.getElementById("making-preview-dock");
    if (!dock) return;
    dock.classList.toggle("collapsed", collapsed);
    const toggle = dock.querySelector(".mpd-hide");
    if (toggle) {
      toggle.textContent = collapsed ? "工程" : "工程メニューを閉じる";
      toggle.setAttribute("aria-expanded", String(!collapsed));
    }
  }

  function buildPreviewDock() {
    if (!previewEnabled) return;
    const dock = document.createElement("aside");
    dock.id = "making-preview-dock";
    dock.innerHTML = `
      <div class="mpd-title"><b>MAKING UI 比較版</b><span>本編には未反映</span></div>
      <div class="mpd-switch">
        <a class="${previewMode === "v2" ? "active" : ""}" href="${updatePreviewUrl("v2")}">新版 V2</a>
        <a class="${previewMode === "legacy" ? "active" : ""}" href="${updatePreviewUrl("legacy")}">現行版</a>
      </div>
      <div class="mpd-steps">
        ${[
          ["setup_bowl", "ボウル"], ["setup_hms", "HMS"], ["setup_charcoal", "炭種"],
          ["theme", "テーマ"], ["mix", "配合"], ["pack", "詰め"],
          ["foil", "穴あけ"], ["coal", "炭"], ["coalfire", "着火"], ["steam", "蒸らし"],
          ["pull", "吸い出し"], ["adjust", "調整"],
        ].map(([step, label]) => `<button type="button" data-preview-step="${step}">${label}</button>`).join("")}
      </div>
      <button class="mpd-hide" type="button" aria-expanded="true">工程メニューを閉じる</button>`;
    document.body.appendChild(dock);

    dock.querySelectorAll("[data-preview-step]").forEach((button) => {
      button.addEventListener("click", () => jumpPreview(button.dataset.previewStep));
    });
    dock.querySelector(".mpd-hide").addEventListener("click", () => {
      setPreviewDockCollapsed(!dock.classList.contains("collapsed"));
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", buildPreviewDock, { once: true });
  } else {
    buildPreviewDock();
  }
})();
