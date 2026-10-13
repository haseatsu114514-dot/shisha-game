import { el } from "./core/util.js";
import { runAxeThrow } from "./minigames/axe.js";
import { COMPANIONS } from "./minigames/axe-companions.js";
import { axeRules } from "./minigames/axe-rules.js";
const host = document.getElementById("axe-app");
let opponent = "hiyori";
function menu(result = null) {
  const startGame = async (mode, button) => {
    if (buttons.some(b => b.disabled)) return; buttons.forEach(b => { b.disabled = true; });
    try { menu(await runAxeThrow({ host, mode, opponent })); }
    catch (error) { console.error(error); buttons.forEach(b => { b.disabled = false; }); message.textContent = "開き直して、もう一度お試しください。"; button.focus(); }
  };
  const start = el("button.axe-button.axe-primary", { text: "3投で練習", dataset: { test: "axe-start" }, onclick: () => startGame("practice", start) });
  const league = el("button.axe-button", { text: "10投の競技練習", dataset: { test: "axe-league" }, onclick: () => startGame("league", league) });
  const buttons = [start, league];
  const picker = el("div.axe-pickers", Object.entries(COMPANIONS).map(([id, c]) => el("button.axe-button", {
    text: c.name + "と遊ぶ", "aria-pressed": String(id === opponent), dataset: { companion: id }, onclick: () => {
      if (buttons.some(b => b.disabled)) return; opponent = id;
      for (const b of picker.children) b.setAttribute("aria-pressed", String(b.dataset.companion === id));
    } })));
  const message = el("p", { text: result?.completed ? "前回の記録  " + result.total + " / " + result.maximum + "点" : "横・縦・力のゲージを止めて、一緒に斧投げ。" });
  const rules = el("button.axe-button", { text: "遊び方・得点ルール", dataset: { test: "axe-menu-rules" }, onclick: () => {
    intro.inert = true;
    const panel = axeRules(() => { panel.remove(); intro.inert = false; rules.focus(); });
    host.append(panel); panel.querySelector("button").focus();
  } });
  const intro = el("section.axe-intro", [
    el("span.axe-eyebrow", { text: "水煙前線 -EN:CODE-" }), el("h1", { text: "AXE THROW" }), message,
    el("ol", [el("li", { text: "横 → 縦 → 力の順にボタン／Spaceで止める" }),
      el("li", { text: "力は緑の帯へ。弱すぎても強すぎても斧が落ちる" }),
      el("li", { text: "赤6点、通常1〜5点。青は事前宣言で7／8点、外すと0点" }),
      el("li", { text: "宣言は2回。成功した高さのキルショットは閉じる" })]),
    picker, el("div.axe-pickers", [...buttons, rules]), el("p.axe-menu-help", { text: "構えて待つと手ブレが増える。各投1回、息を整えて小さい的を狙おう。" }),
    el("a.axe-back", { href: "./", text: "本編へ" }),
  ]);
  host.replaceChildren(intro);
  if (result) start.focus();
}
menu();
