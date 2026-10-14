// タイトル専用の表示設定。ゲームのセーブ・configには触れない。
import { el } from "../core/util.js";

export const TITLE_LAYOUT_KEY = "suien_title_layout";
export const isNormalTitleForced = () => new URL(location.href).searchParams.get("titleLayout") === "normal";
const styleReady = () => getComputedStyle(document.documentElement).getPropertyValue("--title-layout-ready").trim() === "1";

function readLayout() {
  if (isNormalTitleForced() || !styleReady()) return "normal";
  try {
    // 読めても書けない端末では通常版へ戻す。
    if (localStorage.getItem(TITLE_LAYOUT_KEY) !== "ds") return "normal";
    localStorage.setItem(TITLE_LAYOUT_KEY, "ds");
    return localStorage.getItem(TITLE_LAYOUT_KEY) === "ds" ? "ds" : "normal";
  } catch { return "normal"; }
}

let disposePrevious = () => {};
export function mountTitleLayout(root, { art, brand, menu, left, background }) {
  disposePrevious();
  const visual = el("section.title-ds-panel.title-ds-visual", { "aria-label": "水煙前線の世界", hidden: true,
    style: { backgroundImage: `url("${background}")` } });
  const controls = el("section.title-ds-panel.title-ds-controls", { "aria-label": "タイトルメニュー", hidden: true }, [
    el("p.title-ds-caption", { text: "煙がつなぐ街" }),
    el("p.title-ds-chapter", { text: "CH.01 SMOKE CROWN CUP" }),
  ]);
  root.append(visual, controls);
  const note = el("span.title-layout-note", { role: "status" });
  const buttons = ["normal", "ds"].map(mode => el("button", {
    text: mode === "normal" ? "通常版" : "DS風", dataset: { test: `title-layout-${mode}` },
    onclick: () => {
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
      note.textContent = next !== mode ? "保存または表示の準備ができないため通常版です" : "";
    },
  }));
  const recovery = new URL(location.href); recovery.searchParams.set("titleLayout", "normal");
  const toolbar = el("nav.title-layout-toolbar", { "aria-label": "タイトルの見た目" }, [
    ...buttons, el("a", { text: "通常版で開き直す", href: recovery.href, dataset: { test: "title-layout-recover" } }), note,
  ]);
  // 専用CSSが欠落しても、復旧ボタンは画面の上端で操作できる。
  Object.assign(toolbar.style, { position: "absolute", top: "8px", right: "10px", zIndex: "1100",
    maxWidth: "calc(100% - 20px)", backgroundColor: "#1b1023", color: "#f6dfaf" });
  buttons.forEach(b => Object.assign(b.style, { minHeight: "44px", minWidth: "60px" }));
  const hint = document.querySelector("#rotate-hint");
  const hintDisplay = hint?.style.display;
  if (hint) hint.style.display = "none";
  function apply(mode) {
    root.dataset.layout = mode;
    visual.hidden = controls.hidden = mode !== "ds";
    if (mode === "ds") {
      visual.append(art, brand); controls.insertBefore(menu, controls.firstChild);
    } else {
      root.prepend(art); left.append(brand, menu);
    }
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(mode === ["normal", "ds"][i])));
  }
  apply(readLayout());
  document.querySelector("#viewport").prepend(toolbar);
  // タイトルを離れたら入口も片付ける。ゲーム画面のDOM/寸法には設定を持ち越さない。
  let seen = root.isConnected;
  const observer = new MutationObserver(() => {
    seen ||= root.isConnected;
    if (seen && (!root.isConnected || document.body.dataset.screen !== "title" || document.body.classList.contains("vn-open"))) disposePrevious();
  });
  const dispose = () => { observer.disconnect(); toolbar.remove(); if (hint) hint.style.display = hintDisplay; };
  disposePrevious = dispose;
  observer.observe(document.querySelector("#screen"), { childList: true });
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-screen", "class"] });
}
