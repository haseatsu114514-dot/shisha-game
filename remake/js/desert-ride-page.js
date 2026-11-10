// DESERT RIDE を単体で遊ぶページ（remake/desert-ride.html）。本編の保存は読み書きしない。
// 自己ベストはこのページだけの localStorage（suien_desert_ride_preview）に残す。
import { RULES_VERSION } from "./minigames/desert-ride-model.js";
import { el } from "./core/util.js";
import { initStageFit } from "./core/stage-fit.js";
import { runDesertRide } from "./minigames/desert-ride.js";

const KEY = "suien_desert_ride_preview";
const stage = document.getElementById("stage");
const app = document.getElementById("desert-app");
initStageFit(stage); // 画面の当て方は本編と同じ共通部品（core/stage-fit.js・#3076）
const readBest = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && Number.isFinite(v.score) ? v : null; } catch { return null; } };
let reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
function menu(message = "狙いは、S。") {
  const best = readBest();
  const reduceBox = el("input", { type: "checkbox", dataset: { test: "desert-page-reduce" }, onchange: e => { reduce = e.target.checked; } });
  reduceBox.checked = reduce;
  const start = tutorial => async () => {
    app.hidden = true;
    // ヌールに一度勝つと、なる（裏の相手）とも勝負できる
    const rivals = best?.beatNoor ? ["noor", "naru"] : ["noor"];
    const params = new URLSearchParams(location.search);
    const courseId = params.get("course") || undefined;
    const seedParam = params.get("seed");
    const seed = seedParam != null && seedParam !== "" && Number.isFinite(Number(seedParam)) ? Number(seedParam) : undefined;
    const { results } = await runDesertRide({ host: stage, tutorial, best, legacyBest: best?.legacyBest, rivals, reducedMotion: reduce, courseId, seed, onResult: result => {
      const prev = readBest();
      const beatNoor = !!prev?.beatNoor || (result.race?.who === "noor" && result.race.won);
      const sameRules = prev?.rulesVersion === RULES_VERSION;
      const legacyBest = prev?.legacyBest || (prev && !sameRules ? { score: prev.score, rank: prev.rank } : null);
      const top = !sameRules || result.score > prev.score ? { score: result.score, rank: result.rank } : { score: prev.score, rank: prev.rank };
      try { localStorage.setItem(KEY, JSON.stringify({ ...top, rulesVersion: RULES_VERSION, ...(legacyBest ? { legacyBest } : {}), beatNoor })); } catch { /* 保存できない環境 */ }
    } });
    app.hidden = false;
    const last = results.at(-1);
    menu(last ? `前回 ${last.score.toLocaleString("ja-JP")}点 ／ ${last.rank}` : "狙いは、S。");
  };
  // 出さない行は null。replaceChildren は null を「null」という文字で入れてしまうので、外してから並べる。
  app.replaceChildren(...[
    el("p.dr-page-kicker", { text: "DUBAI · SAND DUNES", style: { letterSpacing: ".4em", fontSize: "13px", color: "#8a4b22" } }),
    el("h1", { text: "DESERT RIDE" }),
    el("p", { text: message }),
    best && best.rulesVersion !== RULES_VERSION ? el("p", { text: `旧ルールの記録 ${best.score.toLocaleString("ja-JP")}点 ／ ${best.rank}（別記録）`, dataset: { test: "desert-page-legacy-best" } }) : null,
    best?.legacyBest ? el("p", { text: `旧ルールの記録 ${best.legacyBest.score.toLocaleString("ja-JP")}点 ／ ${best.legacyBest.rank}（別記録）`, dataset: { test: "desert-page-legacy-best" } }) : null,
    best?.rulesVersion === RULES_VERSION ? el("p", { text: `自己ベスト ${best.score.toLocaleString("ja-JP")}点 ／ ${best.rank}`, dataset: { test: "desert-page-best" } }) : null,
    el("div.row", [
      el("button.btn.primary", { type: "button", text: "滑る", dataset: { test: "desert-page-start" }, onclick: start(false) }),
      el("button.btn", { type: "button", text: "練習から始める", dataset: { test: "desert-page-tutorial" }, onclick: start(true) }),
    ]),
    el("p", { style: { marginTop: "16px" } }, [el("label", [reduceBox, el("span", { text: "動きを減らす（揺れ・閃光・速度線なし）" })])]),
    best?.beatNoor ? el("p", { text: "ヌールに勝った。なるが、砂丘で待っている。", dataset: { test: "desert-page-naru" } }) : null,
    // キーの説明は PC だけ（スマホは画面のボタンと、ゲームの中の「？」で足りる）
    el("p.dr-page-keys", { text: "PC: ← → で移動（空中では回転）、Space でジャンプ／着地、↓ でブースト。スマホ: 下のボタン。", style: { fontSize: "15px", color: "#5a3a2a" } }),
  ].filter(Boolean));
}
menu();

