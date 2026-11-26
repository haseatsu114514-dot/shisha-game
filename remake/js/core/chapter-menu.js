// 章共通のMENU。
import { loadFromSlot, requestResumeOnBoot } from "./state.js";
import { modal } from "./ui.js";
import { saveFlow, loadFlow, returnToTitle } from "../scenes/saves.js";
import { glossaryPanel } from "../vn/glossary.js";

/** ロード成功時とタイトルへ戻るときに、controllerの中断前にonLeaveを呼ぶ。 */
export function createChapterMenu({
  current, test, title, body = "読み終えた場面から再開できます。", showConfig = true,
  glossaryAvailable = () => false, rulesAvailable = () => false, rulesLabel = "規則書", onLeave,
}) {
  return async function openMenu(owner) {
    if (!current(owner) || owner.menuBusy) return;
    owner.menuBusy = true;
    const leave = () => {
      owner.active = false;
      onLeave?.(owner);
      owner.controller?.abort();
    };
    try {
      const choice = await modal({ title, body, options: [
        { label: "セーブ", value: "save", test: test("save") },
        { label: "ロード", value: "load", test: test("load") },
        ...(showConfig ? [{ label: "設定", value: "config", test: test("config") }] : []),
        ...(glossaryAvailable(owner) ? [{ label: "用語集", value: "glossary", test: test("glossary") }] : []),
        ...(rulesAvailable(owner) ? [{ label: rulesLabel, value: "rules", test: test("rules") }] : []),
        { label: "タイトルへ戻る", value: "title", test: test("title") },
        { label: "閉じる", value: null, primary: true },
      ] });
      if (!current(owner)) return;
      if (choice === "save") await saveFlow();
      if (choice === "config") await (await import("../scenes/title.js")).openConfig();
      if (choice === "glossary") {
        await modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal",
          options: [{ label: "閉じる", value: true, primary: true }] });
      }
      if (choice === "rules") await (await import("../scenes/rule-sheet.js")).openRuleSheet();
      if (choice === "load") {
        const key = await loadFlow({ inGame: true });
        if (key && loadFromSlot(key)) {
          leave();
          requestResumeOnBoot();
          location.reload();
        }
      }
      if (choice === "title") {
        await returnToTitle({ current: () => current(owner), leave });
      }
    } finally { owner.menuBusy = false; }
  }
}
