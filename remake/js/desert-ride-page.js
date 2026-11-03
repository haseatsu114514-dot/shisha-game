// DESERT RIDE を単体で遊ぶページ（remake/desert-ride.html）。本編の保存は読み書きしない。
// 自己ベストはこのページだけの localStorage（suien_desert_ride_preview）に残す。
import { RULES_VERSION } from "./minigames/desert-ride-model.js";
import { el } from "./core/util.js";
import { runDesertRide } from "./minigames/desert-ride.js";

const KEY = "suien_desert_ride_preview";
const stage = document.getElementById("stage");
const app = document.getElementById("desert-app");
function fit() {
  const w = window.innerWidth, h = window.innerHeight;
  stage.style.setProperty("--k", String(Math.min(w / 1280, h / 720)));
}
fit(); window.addEventListener("resize", fit);
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
    const { results } = await runDesertRide({ host: stage, tutorial, best, legacyBest: best?.legacyBest, rivals, reducedMotion: reduce, onResult: result => {
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
  app.replaceChildren(
    el("p", { text: "DUBAI · SAND DUNES", style: { letterSpacing: ".4em", fontSize: "13px", color: "#8a4b22" } }),
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
    el("p", { text: "PC: ← → で移動（空中では回転）、Space でジャンプ／着地、↓ でブースト。スマホ: 下のボタン。", style: { fontSize: "15px", color: "#5a3a2a" } }),
  );
}
menu();

