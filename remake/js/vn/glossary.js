// 用語集（data/glossary.json）。シーシャを知らない人が置いていかれないための一級市民。
import { el } from "../core/util.js";
import { DB } from "../core/data.js";

export function glossaryPanel() {
  const groups = DB.glossary || [];
  const tabs = el("div.gl-tabs");
  const body = el("div.gl-body");
  const show = (i) => {
    [...tabs.children].forEach((t, k) => t.classList.toggle("on", k === i));
    body.replaceChildren(...groups[i].terms.map((t) => el("div.gl-term", [el("b", { text: t.term }), el("p", { text: t.desc })])));
    body.scrollTop = 0;
  };
  groups.forEach((g, i) => tabs.append(el("button.gl-tab", { text: g.title, onclick: () => show(i) })));
  if (groups.length) show(0);
  return el("div.glossary", [tabs, body]);
}
