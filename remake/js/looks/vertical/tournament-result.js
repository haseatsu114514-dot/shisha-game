// 表彰と順位表は本編が所有する。横持ちに戻した時は、動かしたノードを元の位置へ戻す。
import { el } from "../../core/util.js";

function arrangeRecord(table) {
  const marks = new Map();
  const keep = node => {
    const mark = document.createComment("");
    node.before(mark);
    marks.set(node, mark);
    return node;
  };
  const $ = selector => table.querySelector(selector);
  const added = [];
  function review(title, content, triggerClass) {
    const heading = el("h2", { text: title, tabindex: "-1" });
    const dialog = el("dialog.review", { "aria-label": title }, [
      heading, ...content,
      el("button", { type: "button", text: "閉じる", onclick: () => dialog.close() }),
    ]);
    const trigger = el(`button.${triggerClass}`, { type: "button", text: title, "aria-haspopup": "dialog", onclick: () => {
      dialog.showModal();
      heading.focus({ preventScroll: true });
      dialog.scrollTop = 0;
    } });
    table.append(dialog);
    added.push(dialog, trigger);
    return trigger;
  }

  const title = $(".rt-hero h1");
  const originalTitle = title.textContent;
  title.textContent = "最終順位";
  const breakdown = [...table.querySelectorAll(".rt-row")].map(row => {
    const name = row.querySelector(".rt-name").firstChild.textContent;
    return el("p", [el("strong", { text: name }), document.createTextNode("　"), keep(row.querySelector(".rt-votes"))]);
  });
  const reason = $(".tournament-result-reason");
  if (reason) breakdown.push(keep(reason));
  $(".rt-ranking-head").prepend(review("投票の内訳", breakdown, "vote-breakdown"));

  const footer = el("div.result-actions", [keep($(".rt-save")), keep($("[data-test=result-next]"))]);
  table.append(footer);
  added.push(footer);
  const detail = $(".rt-detail-scroll");
  const note = detail.querySelector(".rt-good-point, .rt-next-tip");
  note?.classList.add("review-line");
  const parts = [...detail.children].filter(node => !node.matches("h4, .rt-part.total, .review-line"));
  detail.append(review("工程別の評価・審査員評", parts.map(keep), "review-more"));

  return () => {
    table.querySelector("dialog.review[open]")?.close();
    for (const [node, mark] of marks) mark.replaceWith(node);
    for (const node of added) node.remove();
    title.textContent = originalTitle;
    note?.classList.remove("review-line");
  };
}

export function createTournamentResultScene() {
  let current = null, restore = null, illustration = null;
  function poster(img) {
    if (img === illustration) return;
    illustration?.removeAttribute("srcset");
    illustration = img;
    if (img) img.srcset = "img/ui/conversation_cutin/hajime_grateful.webp";
  }
  function sync() {
    poster(document.querySelector('.ts-splash[data-portrait="grateful"] .ts-splash-bust img'));
    const next = document.querySelector("#screen > .result-table:not(.done)");
    if (next === current) return;
    restore?.();
    current = next;
    restore = current && arrangeRecord(current);
  }
  return { native: true, enter: sync, sync, leave() {
    restore?.();
    current = restore = null;
    poster(null);
  } };
}
