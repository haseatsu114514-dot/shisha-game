// 第4・5章のMENU。項目・保存/LOADの順序は章runnerの従来実装を維持する。
import { save, loadFromSlot, requestResumeOnBoot } from "./state.js";
import { modal } from "./ui.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";

/** 章固有のsession判定・test名・見出しを受け取る。ゲームの進行は変更しない。 */
export function createChapterMenu({ current, test, title }) {
  return async function openMenu(owner) {
    if (!current(owner) || owner.menuBusy) return;
    owner.menuBusy = true;
    try {
      const choice = await modal({ title, body: "読み終えた場面から再開できます。", options: [
        { label: "セーブ", value: "save", test: test("save") },
        { label: "ロード", value: "load", test: test("load") },
        { label: "設定", value: "config", test: test("config") },
        { label: "タイトルへ戻る", value: "title", test: test("title") },
        { label: "閉じる", value: null, primary: true },
      ] });
      if (!current(owner)) return;
      if (choice === "save") await saveFlow();
      if (choice === "config") await (await import("../scenes/title.js")).openConfig();
      if (choice === "load") {
        const key = await loadFlow({ inGame: true });
        if (key && loadFromSlot(key)) {
          owner.active = false;
          owner.controller?.abort();
          requestResumeOnBoot();
          location.reload();
        }
      }
      if (choice === "title") {
        save();
        owner.active = false;
        owner.controller?.abort();
        location.reload();
      }
    } finally { owner.menuBusy = false; }
  }
}
