// 縦画面「煙の舞台」: タイトル。本編のタイトルの絵とロゴを上に、NEW GAME などの札を下に並べる。押したら本編のボタンへ中継する。
import { el } from "../../core/util.js";
import { textOf, cssUrl } from "./frame.js";

export function createTitleScene(frame) {
  const art = el("div.vt-title-art");
  const logo = el("img.vt-title-logo", { alt: "水煙前線 -EN:CODE-", draggable: "false" });
  const items = el("div.vt-title-menu", { dataset: { test: "vt-title-menu" } });
  const ver = el("small.vt-title-ver");
  let pick = 0, sig = "";
  const liveItems = () => [...document.querySelectorAll("#screen > .title .title-menu > .title-item")];
  const usable = (node) => !!node && !node.disabled;

  function renderPick() {
    for (const node of items.children) node.setAttribute("aria-current", String(Number(node.dataset.index) === pick));
  }
  items.addEventListener("click", (event) => {
    const node = event.target.closest(".vt-title-item");
    if (!node) return;
    event.stopPropagation();
    pick = Number(node.dataset.index);
    const live = liveItems()[pick];
    if (usable(live)) live.click();
  });

  function sync() {
    const root = document.querySelector("#screen > .title");
    if (!root) return;
    const live = liveItems();
    const next = live.map((node) => `${node.dataset.test}|${node.disabled}|${node.textContent}`).join("\n");
    if (next !== sig) {
      sig = next;
      pick = Math.max(0, live.findIndex(usable));
      items.replaceChildren(...live.map((node, index) => el("button.vt-title-item", {
        type: "button", disabled: node.disabled, dataset: { index: String(index), test: `vt-${node.dataset.test}` },
      }, [el("b", { text: textOf(node.querySelector(".ti-en")) || textOf(node) }), el("small", { text: textOf(node.querySelector(".ti-ja")) })])));
      renderPick();
    }
    const artNode = root.querySelector(".title-art");
    const url = artNode ? cssUrl(getComputedStyle(artNode).backgroundImage) : "";
    if (url && art.dataset.url !== url) { art.dataset.url = url; art.style.backgroundImage = `url("${url}")`; }
    frame.setAmbient(url);
    const img = root.querySelector("img.title-logo");
    const src = img && img.complete && img.naturalWidth ? img.currentSrc || img.src : "";
    if (src && logo.getAttribute("src") !== src) logo.src = src;
    logo.hidden = !src;
    ver.textContent = textOf(root.querySelector(".title-ver"));
    frame.setChips([]);
    frame.setPad({ dirs: live.length > 1 ? ["up", "down"] : [], a: { face: "ok", disabled: !usable(live[pick]) } });
    frame.setHud("none");
  }

  function move(by) {
    const live = liveItems();
    if (!live.length) return;
    for (let i = 0; i < live.length; i++) {
      pick = (pick + by + live.length) % live.length;
      if (usable(live[pick])) break;
    }
    renderPick();
    sync();
  }

  return {
    name: "title",
    enter() {
      frame.picture.dataset.kind = "title";
      frame.picture.append(art, logo, ver);
      frame.telop.append(items);
      sig = "\u0000";
    },
    leave() {},
    sync,
    dir(dir) { if (dir === "up") move(-1); else if (dir === "down") move(1); },
    a() { const live = liveItems()[pick]; if (usable(live)) live.click(); },
    chip() {},
    tap() {},
  };
}
