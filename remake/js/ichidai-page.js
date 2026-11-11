// カードゲーム「一台勝負」の試遊ページ（remake/ichidai.html）。本編の保存は読み書きしない。
// ?kit=a&tournament=practice&level=1 で設定の画面をとばす。?pilot=cpu&speed=8 で自分の席もCPUが打つ（ブラウザテスト用）。
// ?seed=123 で同じ対戦を再現する。
// ?skin=a で、見た目の案 css/ichidai-skin-a.css を重ねて見比べる（デザインの検討用。docs/design/card_game/card_design_brief.md）。
import { el } from "./core/util.js";
import { initStageFit } from "./core/stage-fit.js";
initStageFit(document.getElementById("stage"));
import { runIchidai, ICHIDAI_TITLE } from "./minigames/ichidai.js";
import { SE, unlockAudio } from "./core/audio.js";
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);
const host = document.getElementById("ichidai-app");
const params = new URLSearchParams(location.search);
const record = { wins: 0, losses: 0, draws: 0 };
const skin = /^[a-z0-9-]{1,24}$/.test(params.get("skin") || "") ? params.get("skin") : null;
if (skin) document.head.append(el("link", { rel: "stylesheet", href: `css/ichidai-skin-${skin}.css` }));

function menu(outcome = null) {
  for (const g of outcome?.games || []) { if (g.winner === 0) record.wins++; else if (g.winner === 1) record.losses++; else record.draws++; }
  const start = async ({ tutorial = false } = {}) => {
    try { SE.select(); } catch { /* 音は無くても遊べる */ }
    buttons.forEach((b) => { b.disabled = true; });
    const config = params.has("kit") ? { kit: params.get("kit"), tournament: params.get("tournament") || "practice", level: Number(params.get("level") ?? 1), opponentKit: params.get("foe") || undefined } : null;
    try {
      const result = await runIchidai({ host, config, tutorial, pilot: params.get("pilot"), speed: Number(params.get("speed")) || 1,
        seed: params.has("seed") ? Number(params.get("seed")) : null, skin, opponent: { id: params.get("face") || "sumi", name: params.get("name") || "スミさん" } });
      menu(result);
    } catch (error) { console.error(error); menu(null); }
  };
  const play = el("button.btn.primary", { type: "button", text: "対戦する（遊び方から）", dataset: { test: "ichi-menu-start" }, onclick: () => start({ tutorial: true }) });
  const quick = el("button.btn", { type: "button", text: "すぐ対戦する", dataset: { test: "ichi-menu-quick" }, onclick: () => start() });
  const buttons = [play, quick];
  const last = outcome?.last;
  host.replaceChildren(el("div.ichi-menu", [
    el("p", { text: "カードゲーム（試遊ページ）" }),
    el("h1", { text: ICHIDAI_TITLE }),
    el("p", { text: "葉を詰め、炭で熱を保ち、審査員の一口を競う。吸い方は、めくるまで分からない。" }),
    el("p", { dataset: { test: "ichi-menu-result" }, text: last ? `前回：${last.winner === 0 ? "勝ち" : last.winner === 1 ? "負け" : "引き分け"}（${last.scores[0]} 対 ${last.scores[1]}）／ ${record.wins}勝 ${record.losses}敗` : "まだ対戦していません" }),
    ...buttons,
  ]));
}
menu();
