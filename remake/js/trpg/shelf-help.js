// 本棚と店の「？」（#2719・ミニゲーム共通のUI方針）。進行・料金・保存には触れない。
import { el } from "../core/util.js";

/** Esc・閉じる・紙の外で閉じ、開く前の場所へ焦点を戻す。 */
export function openShelfPanel(root, { title, content, test, closeTest = test + "-close" }) {
  if (!root?.isConnected || root.querySelector(".trpg-shelf-help")) return;
  const previous = document.activeElement;
  const close = () => {
    overlay.remove();
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  };
  const body = el("div.trpg-modal-body", { tabindex: "0", role: "region", "aria-label": title + "の内容" }, content);
  const done = el("button.trpg-button.primary", { type: "button", text: "閉じる", dataset: { test: closeTest }, onclick: close });
  const actions = el("div.trpg-modal-actions", [done]);
  const box = el("section.trpg-modal.trpg-shelf-help-card", { role: "dialog", "aria-modal": "true", "aria-label": title, tabindex: "-1",
    dataset: { test } }, [el("h2", { text: title }), body, actions]);
  const overlay = el("div.trpg-overlay.trpg-shelf-help", {
    onclick: event => { if (event.target === overlay) close(); },
    onkeydown: event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      else if (event.key === "Tab") {
        const focus = [body, ...box.querySelectorAll("summary, button:not(:disabled)")].filter(node => node.getClientRects().length);
        const first = focus[0], last = focus.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
      }
    },
  }, box);
  root.append(overlay);
  done.focus({ preventScroll: true });
  return { body, setActions: buttons => actions.replaceChildren(...buttons, done) };
}

/** 「？」で、見出しと短い説明の組を重ねる。 */
export function shelfHelpButton(getRoot, { title, sections, test = "trpg-shelf-help" }) {
  return el("button.trpg-button.small.trpg-help-button", { type: "button", text: "？", title, "aria-label": title,
    dataset: { test }, onclick: () => openShelfPanel(getRoot(), { title, test: test + "-panel",
      content: sections.map(([head, text]) => el("section.trpg-shelf-help-item", [el("h3", { text: head }), el("p", { text })])),
      closeTest: test + "-close",
    }) });
}
