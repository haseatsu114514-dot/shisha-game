// タイトル専用の表示設定。ゲームのセーブ・configには触れない。
import { el } from "../core/util.js";
import { installDsGeometry } from "./ds-geometry.js";

export const TITLE_LAYOUT_KEY = "suien_title_layout";
export const isNormalTitleForced = () => new URL(location.href).searchParams.get("titleLayout") === "normal";
const styleReady = () => getComputedStyle(document.documentElement).getPropertyValue("--title-layout-ready").trim() === "1";

export function readTitleLayout() {
  if (isNormalTitleForced() || !styleReady()) return "normal";
  try {
    // 読めても書けない端末では通常版へ戻す。
    if (localStorage.getItem(TITLE_LAYOUT_KEY) !== "ds") return "normal";
    localStorage.setItem(TITLE_LAYOUT_KEY, "ds");
    return localStorage.getItem(TITLE_LAYOUT_KEY) === "ds" ? "ds" : "normal";
  } catch { return "normal"; }
}

let disposePrevious = () => {};
// 表示中のタイトルの切替口。CONFIG（openConfig）がタイトル画面でだけ「タイトルの表示」の行を作る。
let activeLayout = null;
export function mountTitleLayout(root, { art, brand, menu, left, background }) {
  disposePrevious();
  const visual = el("section.title-ds-panel.title-ds-visual", { "aria-label": "水煙前線の世界", hidden: true,
    style: { backgroundImage: `url("${background}")` } });
  const controls = el("section.title-ds-panel.title-ds-controls", { "aria-label": "タイトルメニュー", hidden: true }, [
    el("p.title-ds-caption", { text: "煙がつなぐ街" }),
    el("p.title-ds-chapter", { text: "CH.01 SMOKE CROWN CUP" }),
  ]);
  root.append(visual, controls);
  const hint = document.querySelector("#rotate-hint");
  const hintDisplay = hint?.style.display;
  let current = "normal";
  const listeners = new Set();
  function apply(mode) {
    if (mode === "ds") installDsGeometry(); // 本編と同じ上下2画面の寸法
    current = mode;
    root.dataset.layout = mode;
    if (hint) hint.style.display = mode === "ds" ? "none" : hintDisplay;
    visual.hidden = controls.hidden = mode !== "ds";
    if (mode === "ds") {
      visual.append(art, brand); controls.insertBefore(menu, controls.firstChild);
    } else {
      root.prepend(art); left.append(brand, menu);
    }
    listeners.forEach(fn => fn(mode));
    window.dispatchEvent(new Event("display-layout-change"));
  }
  // 選んだ見た目を保存して適用する。保存か表示の準備ができなければ通常版にして、その理由を返す。
  function choose(mode) {
    let next = mode === "ds" && !styleReady() ? "normal" : mode;
    try {
      localStorage.setItem(TITLE_LAYOUT_KEY, next);
      if (localStorage.getItem(TITLE_LAYOUT_KEY) !== next) throw Error("unavailable");
    } catch { next = "normal"; }
    if (next === "ds" && isNormalTitleForced()) {
      const url = new URL(location.href); url.searchParams.delete("titleLayout");
      try { history.replaceState(null, "", url); } catch { next = "normal"; }
    }
    apply(next);
    return next !== mode ? "保存または表示の準備ができないため通常版です" : "";
  }
  apply(readTitleLayout());
  const layout = { root, mode: () => current, choose, listen: fn => listeners.add(fn) };
  activeLayout = layout;
  // タイトルを離れたら切替口も片付ける。ゲーム画面のDOM/寸法には設定を持ち越さない。
  let seen = root.isConnected;
  const observer = new MutationObserver(() => {
    seen ||= root.isConnected;
    if (seen && (!root.isConnected || document.body.dataset.screen !== "title" || document.body.classList.contains("vn-open"))) disposePrevious();
  });
  const dispose = () => {
    observer.disconnect(); listeners.clear();
    if (activeLayout === layout) activeLayout = null;
    if (hint) hint.style.display = hintDisplay;
  };
  disposePrevious = dispose;
  observer.observe(document.querySelector("#screen"), { childList: true });
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-screen", "class"] });
}

/**
 * CONFIG の中に置く「タイトルの表示」（通常版／DS風）。#2863 でタイトル右上から移した。
 * 表示中のタイトルが無いとき（ゲーム中のCONFIG）は null。押すとその場で切り替える（表示の仕組みは mountTitleLayout のまま）。
 */
export function createTitleLayoutSettings() {
  const layout = activeLayout;
  if (!layout || !layout.root.isConnected) return null;
  const note = el("span.title-layout-note", { role: "status" });
  const buttons = ["normal", "ds"].map(mode => el("button", {
    type: "button", text: mode === "normal" ? "通常版" : "DS風", dataset: { test: `title-layout-${mode}` },
    onclick: () => { note.textContent = layout.choose(mode); },
  }));
  const mark = mode => buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(mode === ["normal", "ds"][i])));
  mark(layout.mode());
  layout.listen(mark);
  // 専用CSSが欠落しても押せるよう、最低限の寸法はここで持つ。
  buttons.forEach(b => Object.assign(b.style, { minHeight: "44px", minWidth: "60px" }));
  const recovery = new URL(location.href); recovery.searchParams.set("titleLayout", "normal");
  return el("div.title-layout-options", { role: "group", "aria-label": "タイトルの見た目", dataset: { test: "title-layout-settings" } }, [
    ...buttons, el("a", { text: "通常版で開き直す", href: recovery.href, dataset: { test: "title-layout-recover" } }), note,
  ]);
}
