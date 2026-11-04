import { el } from "../core/util.js";
import { DB } from "../core/data.js";
import { craftReviewLines } from "./advice.js";
import { evaluationOf } from "./feedback.js";
import { smokeUrl } from "./smoke-art.js";
import { buildResultCardData, renderResultCard, resultCardFilename } from "./result-card.js";

export function resultSaveButton(cs) {
  const status = el("small", { role: "status" });
  const button = el("button.btn", { text: "画像で保存", type: "button", dataset: { test: "result-save" }, onclick: async () => {
    button.disabled = true;
    status.textContent = "";
    try {
      await document.fonts.ready;
      const smoke = new Image();
      smoke.src = smokeUrl("title");
      // An unavailable decorative image must not prevent saving the result.
      const image = await smoke.decode().then(() => smoke, () => null);
      const grade = evaluationOf(cs.total || 0);
      const data = buildResultCardData({ mix: cs.mix, flavors: DB.flavorById,
        grade: `${grade.mark} ${grade.label}`, advice: craftReviewLines(cs) });
      const link = el("a", { href: renderResultCard(document.createElement("canvas"), data, image), download: resultCardFilename() });
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      status.textContent = "画像を保存できませんでした。もう一度お試しください";
    } finally {
      button.disabled = false;
    }
  } });
  return el("div.rt-save", [button, status]);
}
