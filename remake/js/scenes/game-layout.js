// 表示だけの試作。既存のDOM・入力・進行・保存処理をそのまま使う。
import { el } from "../core/util.js";
import { readTitleLayout, TITLE_LAYOUT_KEY } from "./title-layout.js";
import { installDsGeometry } from "./ds-geometry.js";

export function initGameLayout() {
  const body = document.body, stage = document.querySelector("#stage"), viewport = document.querySelector("#viewport");
  const visual = el("div.game-ds-panel.game-ds-visual", { "aria-hidden": "true" });
  const controls = el("div.game-ds-panel.game-ds-controls", { "aria-hidden": "true" });
  stage.append(visual, controls);
  const note = el("span.game-layout-note", { role: "status" });
  let tried = false;
  const buttons = ["normal", "ds"].map(mode => el("button", {
    text: mode === "normal" ? "通常版" : "DS風", type: "button", dataset: { test: `game-layout-${mode}` },
    onclick: () => {
      try {
        localStorage.setItem(TITLE_LAYOUT_KEY, mode);
        if (mode === "ds") {
          const url = new URL(location.href); url.searchParams.delete("titleLayout");
          history.replaceState(null, "", url);
        }
      } catch { /* 保存できない環境はreadTitleLayoutが通常版に戻す。 */ }
      toolbar.open = false;
      update();
    },
  }));
  const recovery = new URL(location.href); recovery.searchParams.set("titleLayout", "normal");
  // DS風では画面を覆わないよう「表示」の折りたたみにする。開くと通常版/DS風/開き直しを選べる。
  const summary = el("summary", { text: "表示", dataset: { test: "game-layout-settings" } });
  const toolbar = el("details.game-layout-toolbar", { "aria-label": "本編の見た目", hidden: true,
    onkeydown: e => { if (["Enter", " "].includes(e.key) && e.target.closest("button,a")) e.stopPropagation(); },
  }, [summary, el("nav.game-layout-options", [
    ...buttons, el("a", { text: "通常版で開き直す", href: recovery.href, dataset: { test: "game-layout-recover" } }), note,
  ])]);
  Object.assign(summary.style, { minHeight: "44px", padding: "12px", cursor: "pointer", boxSizing: "border-box" });
  // DS専用CSSが届かなくても、復旧入口を画面外に隠さない。
  Object.assign(toolbar.style, { position: "fixed", top: "8px", right: "10px", zIndex: "1100",
    maxWidth: "calc(100% - 20px)", backgroundColor: "#1b1023", color: "#f6dfaf" });
  buttons.forEach(button => Object.assign(button.style, { minHeight: "44px", minWidth: "60px" }));
  body.append(toolbar);
  function update() {
    const mode = readTitleLayout(), screen = body.dataset.screen;
    body.dataset.gameLayout = mode;
    const vn = body.classList.contains("vn-open");
    const view = vn ? "vn" : ["map", "tonari", "home", "bench"].includes(screen) ? screen : ["ch2-stop", "ch2-complete", "ch2-error"].includes(screen) ? "tonari" : null; // home: 家で練習（#638）
    const inGame = vn || screen !== "boot" && screen !== "title";
    const ready = getComputedStyle(document.documentElement).getPropertyValue("--game-layout-ready").trim() === "1";
    tried ||= inGame && mode === "ds";
    const active = inGame && mode === "ds" && ready && !!view;
    const wasActive = body.classList.contains("game-ds");
    const previousView = body.dataset.dsView;
    body.classList.toggle("game-ds", active);
    if (wasActive !== active || active && previousView !== view) {
      stage.scrollTop = stage.scrollLeft = 0;
      viewport.scrollTop = viewport.scrollLeft = 0;
    }
    if (active) body.dataset.dsView = view; else delete body.dataset.dsView;
    visual.hidden = controls.hidden = !active;
    toolbar.hidden = !inGame || !(mode === "ds" || tried);
    // 通常版の右上MENU/LIMEを覆わず、従来のステージ位置を維持する。
    Object.assign(toolbar.style, active
      ? { left: "auto", right: "10px", transform: "none" }
      : { left: "50%", right: "auto", transform: "translateX(-50%)" });
    buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(mode === ["normal", "ds"][i])));
    note.textContent = mode !== "ds" ? "" : !ready ? "表示準備ができないため通常表示" : !view ? "この画面は通常表示です" : "";
    // DS専用CSSが届かないときは、開き直しの入口を畳まずに見せる。
    if (inGame && mode === "ds" && !ready && !toolbar.open) toolbar.open = true;
    measure();
  }
  // 上下2画面の寸法はタイトルと共通（ds-geometry.js が :root に --ds-* を置く）。
  function measure() { installDsGeometry(); }
  // DOMを移動・複製しない。シーン変更と会話の開始/終了を表示に反映するだけ。
  new MutationObserver(update).observe(body, { attributes: true, attributeFilter: ["data-screen", "class"] });
  window.addEventListener("display-layout-change", update);
  update();
}
