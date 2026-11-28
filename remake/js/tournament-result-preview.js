// 第1章の操作プレビュー。独立ページで本編の順位表・表彰・画像保存を動かす。
import { loadAll } from "./core/data.js";
import { config, markMet, newGame } from "./core/state.js";
import { initLayers, layers } from "./core/ui.js";
import { el } from "./core/util.js";
import { voteStyleFrom } from "./core/vote-style.js";
import { drawRivalForm } from "./chapters/tournament-ballot.js";
import { CH1_RIVALS, beginCh1Votes, castCh1Votes } from "./craft/ch1-votes.js";
import { resultTable } from "./craft/result.js";
import { sampleCraft } from "./craft/tournament-show-dev.js";
import { createTournamentResultScene } from "./looks/vertical/tournament-result.js";

async function preview() {
  initLayers();
  await loadAll();
  const scene = createTournamentResultScene();
  // このページは保存処理・本編起動を通らず、メモリ内の見本だけを評価する。
  const sample = newGame();
  for (const id of ["naru", "adam", "minto", "sensu", "uezono", "dr_charcoal"]) markMet(id, { known: true });
  sample.day = 14;
  const retries = new URLSearchParams(location.search).has("retries");
  const craft = sampleCraft(retries), attempt = sample.tournament;
  attempt.rulesVersion = 2;
  for (;;) {
    if (!attempt.voteAttempt || retries) {
      attempt.voteAttempt = null;
      attempt.attempts++;
      const rivalForm = retries ? drawRivalForm(Object.keys(CH1_RIVALS), 42, 1, attempt.attempts) : undefined;
      beginCh1Votes(attempt, { style: voteStyleFrom(config), rivalForm });
      for (let round = 0; round < 4; round++) castCh1Votes(attempt, round, craft);
    }
    const completed = resultTable(craft, attempt.voteAttempt.result.rank, attempt);
    scene.sync();
    layers.screen.querySelector("[data-test=result-next] .btn-label").textContent = retries ? "同じ一台で再挑戦" : "表彰をもう一度";
    await completed;
    scene.leave();
  }
}

preview().catch(error => {
  const status = el("p#preview-status", { role: "alert", text: `大会結果を開けませんでした。 ${error.message}` });
  layers.screen.replaceChildren(status);
});
