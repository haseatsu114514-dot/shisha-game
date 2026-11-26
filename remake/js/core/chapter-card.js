import { el } from "./util.js";
import { showScreen } from "./ui.js";

/** 章カードの骨格。章固有の見出し・MENU・追加要素は呼び出し側が保つ。 */
export function createChapterCard({ hud, screen, test, heading, menuButton, beforeNote, footerActions,
  guardCompletionCardInput, chapterClear = true, includeScene = true, returnScreen = false }) {
  return function card(owner, name, title, description, actions = [], note = "", sceneId = "", extra = []) {
    hud();
    const complete = name === "complete";
    const dataset = { test: test(name), ...(includeScene ? { scene: sceneId } : {}) };
    // 完了カードは章のクリア画面（レベルアップの札を本文の外へ寄せる・#3938）。
    const panel = el(`main.ch2-contest${complete && chapterClear ? ".chapter-clear" : ""}`, { dataset }, [
      el("header.ch2-contest-header", [
        el("div", [el("p", { text: heading }), el("h1", { text: title })]),
        menuButton(owner),
      ]),
      description?.nodeType === 1 ? description : el("p.ch2-contest-description", { text: description }),
      ...(beforeNote ? [beforeNote(sceneId)] : []),
      note ? el("p.ch2-contest-note", { text: note }) : null,
      ...extra,
      el("div.ch2-contest-actions", footerActions ? [...actions, ...footerActions(owner, name)] : actions),
    ]);
    if (complete) guardCompletionCardInput?.(panel, owner.completionTaps);
    const rendered = showScreen(screen, panel);
    if (returnScreen) return rendered;
  };
}
