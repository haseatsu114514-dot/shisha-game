// CAMEL RACE の独立ページ（remake/camel-race.html）。本編の保存は読み書きしない。
// ?pilot=perfect&speed=4&skip=1 で自動操作・早回し・チュートリアル省略（ブラウザテスト用）。
import { el } from "./core/util.js";
import { initStageFit } from "./core/stage-fit.js";
initStageFit(document.getElementById("stage")); // 画面の当て方は本編と同じ共通部品（#3076）
import { runCamelRace } from "./minigames/camel-race.js";
const host = document.getElementById("camel-app");
const params = new URLSearchParams(location.search);
let best = null;
function menu(result = null) {
  const start = async ({ tutorial = true, pilot = null } = {}) => {
    buttons.forEach(button => { button.disabled = true; });
    try {
      const outcome = await runCamelRace({ host, tutorial, pilot: pilot || params.get("pilot") || null,
        timeScale: Number(params.get("speed")) || 1, best });
      if (outcome.best && (!best || outcome.best.total > best.total)) best = outcome.best;
      menu(outcome);
    } catch (error) { console.error(error); menu(null); }
  };
  const play = el("button.btn.primary", { type: "button", text: "レースへ（遊び方から）", dataset: { test: "camel-menu-start" }, onclick: () => start({ tutorial: !params.has("skip") }) });
  const quick = el("button.btn", { type: "button", text: "すぐ走る（遊び方をとばす）", dataset: { test: "camel-menu-quick" }, onclick: () => start({ tutorial: false }) });
  const demo = el("button.btn.ghost", { type: "button", text: "自動操作のデモを見る", dataset: { test: "camel-menu-demo" }, onclick: () => start({ tutorial: false, pilot: "perfect" }) });
  const buttons = [play, quick, demo];
  host.replaceChildren(el("div.camel-menu", [
    el("p", { text: "第4章ドバイ編・任意ミニゲーム（試遊ページ）" }),
    el("h1", { text: "CAMEL RACE" }),
    el("p", { text: "ラクダは自分で走る。横を走る車から、ロボット騎手へ「声」と「ムチ」を送るだけ。輪が重なる瞬間に Space（当たるとぐっと伸びる）、X は押している間ムチ（スタミナを使う）。" }),
    el("p", { dataset: { test: "camel-menu-result" }, text: result?.last ? `前回：${result.last.rank}位 ／ スコア ${result.last.total}（${result.last.grade}）${best ? ` ／ 自己ベスト ${best.total}` : ""}` : "まだ記録はありません。" }),
    ...buttons,
  ]));
}
menu();
