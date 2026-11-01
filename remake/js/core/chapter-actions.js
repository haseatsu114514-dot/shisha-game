import { el } from "./util.js";

/** 章ごとのsession判定・表示名を保ったまま、ボタンの実行だけを共通化する。 */
export function createChapterActions({ current, test, logName, renderError }) {
  function button(owner, text, name, action, primary = false) {
    return el(`button.btn${primary ? ".primary" : ""}`, { type: "button", text,
      dataset: { test: test(name) }, onclick: () => perform(owner, action) });
  }

  async function perform(owner, action) {
    if (!current(owner) || owner.busy) return;
    owner.busy = true;
    try { await action(); }
    catch (error) {
      if (current(owner)) { console.error(logName, error); renderError(owner); }
    } finally { owner.busy = false; }
  }

  return { button, perform };
}
