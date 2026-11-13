// カードゲーム「一台勝負」の試遊ページ（remake/ichidai.html）。本編の保存は読み書きしない。
// ?kit=a&tournament=practice&level=1 で設定の画面をとばす。?pilot=cpu&speed=8 で自分の席もCPUが打つ（ブラウザテスト用）。
// ?seed=123 で同じ対戦を再現する。
// ?assist=0 で、ガイド（次にすることの案内・自動で冷める）を切って始める（画面の右上の「ガイド」でも切り替えられる）。
// ?players=4 で4人対戦（1:1:1:1。相手はスミさん・なる・アダム）。設定の画面の「人数」でも選べる。
// ?skin=a で、見た目の案 css/ichidai-skin-a.css を重ねて見比べる（デザインの検討用。docs/design/card_game/card_design_brief.md）。
// ?versus=4 で、対戦前の「VS」演出だけを人数を変えて見る（2〜4人。?versus=hajime,sumi,naru,adam のようにキャラIDでも指定できる）。
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
// 4人対戦の相手（先頭は1対1の相手）
const RIVALS = [{ id: "sumi", name: "スミさん" }, { id: "naru", name: "なる" }, { id: "adam", name: "アダム" }];
const skin = /^[a-z0-9-]{1,24}$/.test(params.get("skin") || "") ? params.get("skin") : null;
if (skin) document.head.append(el("link", { rel: "stylesheet", href: `css/ichidai-skin-${skin}.css` }));

function menu(outcome = null) {
  for (const g of outcome?.games || []) { if (g.winner === 0) record.wins++; else if (g.winner == null) record.draws++; else record.losses++; } // 4人対戦は、1位でなければ負け
  const start = async ({ tutorial = false } = {}) => {
    try { SE.select(); } catch { /* 音は無くても遊べる */ }
    buttons.forEach((b) => { b.disabled = true; });
    const config = params.has("kit") ? { kit: params.get("kit"), tournament: params.get("tournament") || "practice", level: Number(params.get("level") ?? 1), opponentKit: params.get("foe") || undefined, players: params.get("players") === "4" ? 4 : 2 } : null;
    try {
      const result = await runIchidai({ host, config, tutorial, pilot: params.get("pilot"), speed: Number(params.get("speed")) || 1,
        seed: params.has("seed") ? Number(params.get("seed")) : null, skin, opponentKit: params.get("foe"), opponent: { id: params.get("face") || "sumi", name: params.get("name") || "スミさん" },
        opponents: params.has("face") ? null : RIVALS, assist: params.get("assist") !== "0" });
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
    el("p", { dataset: { test: "ichi-menu-result" }, text: last ? `前回：${last.winner === 0 ? "勝ち" : last.winner == null ? "引き分け" : last.players > 2 ? `${last.rank}位` : "負け"}（${last.scores.join(" 対 ")}）／ ${record.wins}勝 ${record.losses}敗` : "まだ対戦していません" }),
    ...buttons,
  ]));
}
menu();

// VS演出の見本（4人の並びは、まだ対戦そのものが無いので、ここで見る）
if (params.has("versus")) {
  const SAMPLE = [["hajime", "はじめ"], ["sumi", "スミさん"], ["naru", "なる"], ["adam", "アダム"]], raw = params.get("versus");
  const players = /^[234]$/.test(raw) ? SAMPLE.slice(0, Number(raw)).map(([id, name]) => ({ id, name }))
    : raw.split(",").filter((id) => /^[a-z0-9_]{1,24}$/.test(id)).slice(0, 4).map((id) => ({ id, name: SAMPLE.find((x) => x[0] === id)?.[1] || id }));
  const show = async () => { const { playVersus } = await import("./minigames/ichidai-versus.js"); await playVersus({ host, players, speed: Number(params.get("speed")) || 1 }); };
  if (players.length >= 2) {
    host.querySelector(".ichi-menu")?.append(el("button.btn", { type: "button", text: `VS演出を見る（${players.length}人）`, dataset: { test: "ichi-menu-versus" }, onclick: show }));
  }
}
