import { ChapterSaveError, isChapterStart } from "./chapter-save.js";
import { readSlot, requestResumeOnBoot, restartChapterFromSave, SAVE_SLOTS, state } from "./state.js";
import { modal, toast } from "./ui.js";
import { el } from "./util.js";

/** 保存検査のエラーだけ、理由を保管して章のエラーカードに復帰操作を足す。 */
export function chapterRecoveryActions(error, session, button, validateStart) {
  const owner = state;
  if (!(error instanceof ChapterSaveError) || owner?.chapter !== error.chapter) return [];
  console.error("[chapter save]", error.chapter, error.condition);
  try {
    // 壊れたAUTOを再保存せず、直近の診断だけをセーブと同じ保存領域へ記録する。
    localStorage.setItem("suien_remake_chapter_save_error", JSON.stringify({
      cycleId: owner.cycleId, chapter: owner.chapter, day: owner.day,
      condition: error.condition, message: error.message, at: Date.now(),
    }));
  } catch { /* console の記録は残る */ }

  const usable = candidate => {
    if (!isChapterStart(candidate, owner)) return false;
    try { validateStart?.(candidate); } catch { return false; }
    return true;
  };
  let checkpoint = owner.flags?._chapter_start_checkpoint;
  if (!usable(checkpoint)) {
    checkpoint = SAVE_SLOTS.map(slot => readSlot(slot.key))
      .flatMap(saved => [saved?.flags?._chapter_start_checkpoint, saved])
      .find(usable);
  }
  const label = "この章の頭から再開";
  if (!checkpoint) {
    const unavailable = button(session, label, "restart-chapter", () => {});
    unavailable.disabled = true;
    return [unavailable, el("p.ch2-contest-note", { text: "この周回の章開始時の保存が見つかりません。", role: "status" })];
  }
  return [button(session, label, "restart-chapter", async () => {
    const confirmed = await modal({ title: label,
      body: "この章で進めた内容を取り消し、章の開始時点をオートセーブします。",
      options: [{ label: "再開する", value: true, primary: true, test: "chapter-restart-confirm" },
        { label: "戻る", value: false, test: "chapter-restart-cancel" }] });
    if (!confirmed || state !== owner) return;
    if (!restartChapterFromSave(owner, checkpoint)) {
      toast("章開始時の状態を保存できなかったため、再開できませんでした。");
      return;
    }
    requestResumeOnBoot();
    location.reload();
  })];
}
