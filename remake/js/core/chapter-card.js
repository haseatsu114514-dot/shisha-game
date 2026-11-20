import { el } from "./util.js";
import { showScreen } from "./ui.js";

/** 第4・5章の同じカード骨格。章固有の見出し・MENU・追加要素は呼び出し側が保つ。 */
export function createChapterCard({ hud, screen, test, heading, menuButton }) {
  return function card(owner, name, title, description, actions = [], note = "", sceneId = "", extra = []) {
    hud();
    // 完了カードは章のクリア画面（レベルアップの札を本文の外へ寄せる・#3938）。
    showScreen(screen, el(`main.ch2-contest${name === "complete" ? ".chapter-clear" : ""}`, { dataset: { test: test(name), scene: sceneId } }, [
      el("header.ch2-contest-header", [
        el("div", [el("p", { text: heading }), el("h1", { text: title })]),
        menuButton(owner),
      ]),
      el("p.ch2-contest-description", { text: description }),
      note ? el("p.ch2-contest-note", { text: note }) : null,
      ...extra,
      el("div.ch2-contest-actions", actions),
    ]));
  };
}
