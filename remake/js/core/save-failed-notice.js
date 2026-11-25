// 保存に失敗したら一度知らせ、保存が回復するまで未保存の印を出す。
import { on } from "./bus.js";
import { requestResumeOnBoot } from "./state.js";
import { el } from "./util.js";
import { layers, toast } from "./ui.js";

export const SAVE_FAILED_TEXT = "この端末に保存できていません。空き容量やブラウザの設定を確かめてください";
export const SAVE_FAILED_MS = 7000;

// ゲームの確認窓を置き換えず、その上で選べるようにする。
function showSaveConflict() {
  if (document.getElementById("save-conflict")) return;
  const dialog = el("dialog#save-conflict", {
    "aria-labelledby": "save-conflict-title", onclose: () => dialog.remove(),
    onkeydown: event => event.stopPropagation(),
  }, [
    el("h3#save-conflict-title", { text: "別のタブでオートセーブが更新されました" }),
    el("p", { text: "新しい進行を読むと、このタブの未保存の進行は失われます。このタブに残ると、今の進行を手動枠に保存できます。" }),
    el("div.modal-actions", [
      el("button.btn", { text: "このタブに残る", autofocus: true, onclick: () => dialog.close() }),
      el("button.btn.primary", { text: "新しい進行を読む", onclick: () => {
        requestResumeOnBoot();
        location.reload();
      } }),
    ]),
  ]);
  document.body.append(dialog);
  dialog.showModal();
}

let installed = false;
export function installSaveFailedNotice() {
  if (installed) return;
  installed = true;
  let indicator;
  on("save-conflict", showSaveConflict);
  on("save-failed", () => {
    indicator = el("details.save-failed-notice", {
      // Enter・Space を会話送りやミニゲームの操作に渡さない。
      onkeydown: event => event.stopPropagation(),
    }, [
      el("summary", { text: "未保存" }),
      el("p", { text: SAVE_FAILED_TEXT }),
    ]);
    layers.toasts.append(indicator);
    toast(SAVE_FAILED_TEXT, { kind: "warn", ms: SAVE_FAILED_MS });
  });
  on("save-recovered", () => { indicator?.remove(); indicator = null; });
}
