// 第1章の採用判断用。独立ページで本編の順位表・表彰・画像保存を動かす。
import { loadAll } from "./core/data.js";
import { config, markMet, newGame } from "./core/state.js";
import { initLayers, layers } from "./core/ui.js";
import { el } from "./core/util.js";
import { voteStyleFrom } from "./core/vote-style.js";
import { beginCh1Votes, castCh1Votes } from "./craft/ch1-votes.js";
import { resultTable } from "./craft/result.js";
import { sampleCraft } from "./craft/tournament-show-dev.js";

function arrangePoster(splash, illustration) {
  if (!splash) return; // 動きを減らす設定では本編が直接順位表へ進む。
  splash.querySelector(".ts-splash-bust").replaceChildren(illustration);
  const copy = splash.querySelector(".ts-splash-copy");
  const crest = copy.querySelector(".ts-crest");
  const unit = crest.querySelector("small");
  unit.textContent = "位";
  crest.append(el("span.winner-rank", [crest.querySelector("b"), unit]));
  copy.append(el("div.winner-lockup", [crest, copy.querySelector("h2"), copy.querySelector("p")]));
}

function reviewDialog(table, title, content, triggerClass) {
  const heading = el("h2", { text: title, tabindex: "-1" });
  const dialog = el("dialog.review", { "aria-label": title }, [
    heading, ...content,
    el("button", { type: "button", text: "閉じる", onclick: () => dialog.close() }),
  ]);
  table.append(dialog);
  return el(`button.${triggerClass}`, { type: "button", text: title, "aria-haspopup": "dialog", onclick: () => {
    dialog.showModal();
    heading.focus({ preventScroll: true });
    dialog.scrollTop = 0;
  } });
}

function arrangeRecord(table) {
  const $ = selector => table.querySelector(selector);
  $(".rt-hero h1").textContent = "最終順位";
  const reason = $(".tournament-result-reason");
  const breakdown = [...table.querySelectorAll(".rt-row")].map(row => {
    const votes = row.querySelector(".rt-votes");
    const name = row.querySelector(".rt-name").firstChild.textContent;
    return el("p", [el("strong", { text: name }), document.createTextNode("　"), votes]);
  });
  if (reason) breakdown.push(reason);
  $(".rt-ranking-head").prepend(reviewDialog(table, "投票の内訳", breakdown, "vote-breakdown"));

  const next = $("[data-test=result-next]");
  next.querySelector(".btn-label").textContent = "表彰をもう一度";
  table.append(el("div.result-actions", [$(".rt-save"), next]));

  const detail = $(".rt-detail-scroll");
  const title = detail.querySelector("h4"), grade = detail.querySelector(".rt-part.total");
  const note = detail.querySelector(".rt-good-point") || detail.querySelector(".rt-next-tip");
  note?.classList.add("review-line");
  const fullReview = [...detail.children].filter(child => child !== title && child !== grade && child !== note);
  const more = reviewDialog(table, "工程別の評価・審査員評", fullReview, "review-more");
  detail.replaceChildren(title, grade, ...(note ? [note] : []), more);
}

async function preview() {
  initLayers();
  const illustration = new Image();
  illustration.src = "img/ui/conversation_cutin/hajime_grateful.webp";
  illustration.alt = "";
  await Promise.all([loadAll(), illustration.decode()]);
  // このページは保存処理・本編起動を通らず、メモリ内の見本だけを評価する。
  const sample = newGame();
  for (const id of ["naru", "adam", "minto", "sensu", "uezono", "dr_charcoal"]) markMet(id, { known: true });
  sample.day = 14;
  const craft = sampleCraft(false), attempt = sample.tournament;
  attempt.rulesVersion = 2;
  beginCh1Votes(attempt, { style: voteStyleFrom(config) });
  for (let round = 0; round < 4; round++) castCh1Votes(attempt, round, craft);
  for (;;) {
    const completed = resultTable(craft, attempt.voteAttempt.result.rank, attempt);
    arrangePoster(layers.fx.querySelector(".ts-splash.win"), illustration);
    arrangeRecord(layers.screen.querySelector(".result-table"));
    await completed;
  }
}

preview().catch(error => {
  const status = el("p#preview-status", { role: "alert", text: `大会結果を開けませんでした。 ${error.message}` });
  layers.screen.replaceChildren(status);
});
