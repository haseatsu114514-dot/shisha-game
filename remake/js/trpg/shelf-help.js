// 本棚と店の「？」（#2719・ミニゲーム共通のUI方針）。決まりや操作の説明は画面に常に出さず、開いた時だけ額入りの紙で見せる。
// 見た目だけ: 進行・料金・保存には触れない。Esc・閉じる・紙の外で閉じ、開く前の場所へ焦点を戻す。
import { el } from "../core/util.js";

/** 「？」ボタンを返す。押すと getRoot() の中に、見出しと短い説明の組（sections）を並べた紙を重ねる。 */
export function shelfHelpButton(getRoot, { title, sections, test = "trpg-shelf-help" }) {
  function open() {
    const root = getRoot();
    if (!root?.isConnected || root.querySelector(".trpg-shelf-help")) return;
    const previous = document.activeElement;
    const close = () => {
      overlay.remove();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
    const body = el("div.trpg-modal-body", { tabindex: "0", role: "region", "aria-label": title + "の内容" },
      sections.map(([head, text]) => el("section.trpg-shelf-help-item", [el("h3", { text: head }), el("p", { text })])));
    const done = el("button.trpg-button.primary", { type: "button", text: "閉じる", dataset: { test: test + "-close" }, onclick: close });
    const box = el("section.trpg-modal.trpg-shelf-help-card", { role: "dialog", "aria-modal": "true", "aria-label": title, tabindex: "-1" },
      [el("h2", { text: title }), body, el("div.trpg-modal-actions", [done])]);
    const overlay = el("div.trpg-overlay.trpg-shelf-help", {
      onclick: event => { if (event.target === overlay) close(); },
      onkeydown: event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === "Tab") { event.preventDefault(); (document.activeElement === done ? body : done).focus({ preventScroll: true }); }
      },
    }, box);
    root.append(overlay);
    done.focus({ preventScroll: true });
  }
  return el("button.trpg-button.small.trpg-help-button", { type: "button", text: "？", title, "aria-label": title,
    dataset: { test }, onclick: open });
}
