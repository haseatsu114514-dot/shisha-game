import { el } from "./util.js";

/** 章ごとのsession判定・表示名を保ったまま、ボタンの実行だけを共通化する。 */
export function createChapterActions({ current, test, logName, renderError,
  buttonOwner = owner => owner, buttonDisabled, setBusy = (owner, value) => { owner.busy = value; },
  clearBusyIfCurrent = false }) {
  function button(owner, text, name, action, primary = false, disabled = false) {
    return el(`button.btn${primary ? ".primary" : ""}`, { type: "button", text,
      dataset: { test: test(name) }, ...(buttonDisabled ? { disabled: buttonDisabled(owner, disabled) } : {}),
      onclick: () => perform(buttonOwner(owner), action) });
  }

  async function perform(owner, action) {
    if (!current(owner) || owner.busy) return;
    setBusy(owner, true);
    try { await action(); }
    catch (error) {
      if (current(owner)) { console.error(logName, error); renderError(owner); }
    } finally { if (!clearBusyIfCurrent || current(owner)) setBusy(owner, false); }
  }

  return { button, perform };
}
