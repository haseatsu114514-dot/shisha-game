// Safe transcript preview: intentionally does NOT call the live VN engine.
// It never touches game state, save slots, or event hooks.
export function createEventPreview(getDialogues, documentRef) {
  let overlay = null;
  const close = () => { overlay?.remove(); overlay = null; };
  const open = id => {
    const scene = (getDialogues() || {})[id];
    if (!scene) throw new Error("Unknown dialogue ID: " + id);
    close();
    const doc = documentRef;
    overlay = doc.createElement("section");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "開発用イベント台本プレビュー");
    Object.assign(overlay.style, {
      position: "fixed", inset: "5%", zIndex: "2147483647",
      overflow: "auto", background: "#16131e", color: "#fff",
      padding: "20px", font: "16px/1.7 var(--font)", border: "2px solid #a89dc7",
    });
    const heading = doc.createElement("h2");
    heading.textContent = "台本プレビュー（状態変更なし）: " + id;
    overlay.append(heading);
    const button = doc.createElement("button");
    button.type = "button";
    button.textContent = "閉じる";
    button.addEventListener("click", close);
    overlay.append(button);
    const render = (lines, label) => {
      const title = doc.createElement("h3");
      title.textContent = label;
      overlay.append(title);
      for (const line of lines || []) {
        const p = doc.createElement("p");
        if (line.type === "choice") {
          p.textContent = "【選択肢】 " + (line.choices || []).map(c => c.text || "").join(" / ");
        } else {
          p.textContent = (line.speaker ? line.speaker + "： " : "") + (line.text || "【" + (line.type || "演出") + "】");
        }
        overlay.append(p);
      }
    };
    render(scene.lines, "本編");
    for (const [key, lines] of Object.entries(scene.branches || {})) {
      render(lines, "分岐: " + key);
    }
    doc.body.append(overlay);
    return { id, lines: (scene.lines || []).length, branches: Object.keys(scene.branches || {}) };
  };
  return Object.freeze({ open, close });
}
