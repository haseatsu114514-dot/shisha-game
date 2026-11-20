// 会話の pointerup で旧画面を閉じても、同じタップの click が新しいボタンへ届くことがある。
// クリアカードで新しく押したボタンだけを画面操作に使う。キーボード・支援技術の click はそのまま。
export function guardCompletionCardInput(card) {
  let pressed = null;
  card.addEventListener("pointerdown", event => { pressed = event.target.closest?.("button") || null; }, true);
  card.addEventListener("pointercancel", () => { pressed = null; }, true);
  card.addEventListener("click", event => {
    const button = event.target.closest?.("button"), eligible = pressed === button;
    pressed = null;
    if (!button || event.detail === 0 || eligible) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  return card;
}
