import { el } from "../core/util.js";

/** 途中離脱を確かめる間、ゲーム面への操作を止める。Esc は再開と同じ。 */
export function openMinigamePause(root, { id, title = "一時停止", quitLabel = "やめる", onResume, onQuit }) {
  const close = callback => {
    dialog.close();
    dialog.remove();
    callback();
  };
  const resume = el("button.btn.primary", { type: "button", text: "つづける", autofocus: true,
    dataset: { test: id + "-resume" }, onclick: () => close(onResume) });
  const dialog = el("dialog.minigame-pause", { "aria-label": title, dataset: { test: id + "-pause" } }, [
    el("h2", { text: title }),
    el("div.minigame-pause-actions", [
      resume,
      el("button.btn", { type: "button", text: quitLabel, dataset: { test: id + "-quit-confirm" }, onclick: () => close(onQuit) }),
    ]),
  ]);
  dialog.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (event.repeat) event.preventDefault();
    }
  });
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(onResume); });
  root.append(dialog);
  dialog.showModal();
  return dialog;
}
