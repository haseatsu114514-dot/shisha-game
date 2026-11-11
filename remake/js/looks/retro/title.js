// タイトル。上画面に現行のタイトルの絵（背景・キャラクターの絵・ロゴ）を写し、下画面に NEW GAME などを並べる。
// 押したら現行のボタン（[data-test="title-new"] など）への click として中継する。
import { el } from "../../core/util.js";

const text = (node) => node?.textContent?.trim() || "";
const cssUrl = (value) => {
  const m = /url\((['"]?)(.*?)\1\)/.exec(value || "");
  return m ? new URL(m[2], document.baseURI).href : "";
};

export function createTitleScene(shell, painter) {
  const pane = el("div.retro-pane.retro-title", { hidden: true, dataset: { test: "retro-title" } });
  // ロゴの画像が読めない時の代わり（現行と同じく文字で出す）
  const logoText = el("div.retro-toptext", { text: "水煙前線 -EN:CODE-", hidden: true });
  const liveItems = () => [...document.querySelectorAll("#screen > .title .title-menu > .title-item")];
  let menuSig = "";

  function sync() {
    const items = liveItems();
    const sig = items.map((item) => `${item.dataset.test}|${item.disabled}|${item.textContent}`).join("\n");
    if (sig !== menuSig) {
      menuSig = sig;
      pane.replaceChildren(...items.map((item) => el("button.retro-menu", {
        type: "button", disabled: item.disabled, dataset: { test: `retro-${item.dataset.test}` },
        onclick: () => liveItems().find((live) => live.dataset.test === item.dataset.test)?.click(),
      }, [el("b", { text: text(item.querySelector(".ti-en")) }), el("small", { text: text(item.querySelector(".ti-ja")) })])));
    }
    shell.setStatus("タイトル", text(document.querySelector("#screen > .title .title-ver")));
    shell.setKeys([]);
    shell.setCaption("");
  }

  function paint(now) {
    const root = document.querySelector("#screen > .title");
    if (!root) return false;
    const artNode = root.querySelector(".title-art");
    const artStyle = artNode ? getComputedStyle(artNode) : null;
    const art = artStyle ? { url: cssUrl(artStyle.backgroundImage), opacity: Math.round((parseFloat(artStyle.opacity) || 0) * 20) / 20 } : null;
    const img = root.querySelector("img.title-logo");
    const logoReady = !!img && !img.hidden && img.complete && img.naturalWidth > 0;
    if (logoText.hidden !== logoReady) logoText.hidden = logoReady;
    return painter.paintTitle(now, { art, logo: logoReady ? { url: img.currentSrc || img.src } : null });
  }

  return {
    pane,
    sync,
    paint,
    enter() { menuSig = "\u0000"; shell.top.querySelector(".retro-top-ui").append(logoText); },
    leave() { logoText.remove(); },
  };
}
