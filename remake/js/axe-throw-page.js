import { el } from "./core/util.js";
import { runAxeThrow } from "./minigames/axe.js";
const host = document.getElementById("axe-app");
function menu(result = null) {
  const start = el("button.axe-button.axe-primary", { text: "3投に挑戦", dataset: { test: "axe-start" }, onclick: async () => {
    if (start.disabled) return; start.disabled = true;
    try { menu(await runAxeThrow({ host })); }
    catch (error) { console.error(error); start.disabled = false; message.textContent = "開き直して、もう一度お試しください。"; }
  } });
  const message = el("p", { text: result?.completed ? "前回の記録  " + result.total + " / 18点" : "中心を狙って、投げるタイミングを合わせよう。" });
  host.replaceChildren(el("section.axe-intro", [
    el("span.axe-eyebrow", { text: "水煙前線 -EN:CODE-" }), el("h1", { text: "AXE THROW" }),
    el("h2", { text: "斧投げ" }), message,
    el("ol", [
      el("li", { text: "的をタップ／クリックして照準を合わせる" }),
      el("li", { text: "「構える」を押し、針が中央の帯に来たら投げる" }),
      el("li", { text: "3投の合計は最大18点。何度でも挑戦できる" }),
    ]), start, el("a.axe-back", { href: "./", text: "本編へ" }),
  ]));
}
menu();
