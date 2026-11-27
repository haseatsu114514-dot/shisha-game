// 縦画面の試作: ボドゲカフェ（短編TRPG）を縦の画面で動かす（縦試作の枠 ../index.html?view=play&scene=trpg が iframe で読む。単体でも開ける）。
// 本編のボドゲカフェと同じ「本をめくって物語を選ぶ」本棚（js/trpg/campaign-view.js・TRP11）と卓を、使い捨ての状態で開く。
// 状態の作り方は本編の試遊（js/trpg/trial.js・TRF21）と同じ trpgTrialState（夜・部員がそろっている・部員の本は買ってある）。
// 本編のセーブ・設定は読み書きしない（状態はこのページの中だけ。卓を遊び終えたら次の夜の本棚へ）。
// 物語・台詞・判定・絵・音は本編のまま、並べ方は trpg.css。
// ?shot=library|turned|cover|talk|choice|roll|topics|explore は、一覧（PC）に並べる止め絵
//   （library＝本の見開き、turned＝別の本へめくった所、choice＝行動の宣言、roll＝判定の結果、topics＝聞き込み、explore＝部屋を調べる）。
import { newState } from "../../../js/core/state.js";
import { mountTrpgCampaign } from "../../../js/trpg/campaign-view.js";
import { loadTrpgClubResources } from "../../../js/trpg/index.js";
import { trpgTrialState } from "../../../js/trpg/trial-state.js";
import { initPortraitFit, shot, param, tellParent, until } from "./frame.mjs";

const stage = document.getElementById("stage"), host = document.getElementById("trpg-app");
initPortraitFit(stage);
// 本編のスマホ向けの決まり（文字とタップの大きさ。css/phone-density.css・css/trpg-phone.css の data-density="phone"）を、縦でも使う
document.documentElement.dataset.density = "phone";
document.documentElement.dataset.layout = "portrait";

const SHOT_SCENARIO = "ordinary-cup"; // 止め絵に使う物語（世界一普通の一台）
let controller = null, state = null, resources = null;

/** 本棚を開く（卓を遊び終えたら次の夜、閉じたら枠に知らせて開き直す）。 */
function shelf() {
  controller?.destroy();
  const owner = state;
  controller = mountTrpgCampaign(host, { getState: () => owner, save: () => true, closeLabel: "戻る", resources: null });
  controller.finished.then(result => {
    if (state !== owner) return;
    if (result?.completed) { owner.day++; owner.slot = 1; shelf(); return; }
    tellParent("leave", { game: "trpg" }); // 本編では街へ戻る。試作では本棚を開き直す
    shelf();
  });
}
async function boot() {
  resources = await loadTrpgClubResources();
  state = trpgTrialState(newState(), resources.catalog, "ready");
  // 店長の説明（はじめての卓）は本編と同じに出す。止め絵だけは説明を飛ばして、場面をそろえる
  if (shot) { state.flags ||= {}; state.flags._trpg_tutorial_seen = true; state.seed = 7; }
  shelf();
  window.__trpg = Object.freeze({ get state() { return state; }, get ready() { return !!host.querySelector('[data-test="trpg-book-spread"]'); } });
}

const find = selector => [...document.querySelectorAll(selector)].find(node => node.offsetParent !== null && !node.disabled) || null;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// 止め絵の場面ごとの「ここで止める」条件（卓が入力を待っている時だけ）
const SHOT_READY = {
  talk: () => find('[data-test="trpg-next"]') && !document.querySelector(".trpg-incarnate"),
  choice: () => find(".trpg-approach-list .trpg-approach"),
  roll: () => find(".trpg-dice-total") && !document.querySelector(".trpg-roll-show"),
  topics: () => document.querySelector(".trpg-root.trpg-idle") && find(".trpg-topic-list .trpg-topic"),
  explore: () => document.querySelector('.trpg-root.trpg-idle[data-phase="explore"]') && find(".trpg-spot"),
};
/** 止め絵の場面を作る（画面のボタンを、遊ぶ人と同じ順に押していく）。 */
async function pose(name) {
  await until(() => find('[data-test="trpg-book-spread"]'));
  await wait(1400); // 入口の幕が上がるのを待つ
  if (name === "library") return;
  // 止め絵の物語の頁へめくる
  const tab = await until(() => find(`[data-test="trpg-tab-${SHOT_SCENARIO}"]`));
  if (tab.getAttribute("aria-current") !== "true") { tab.click(); await wait(700); }
  if (name === "turned") return;
  (await until(() => find(`[data-test="trpg-play-${SHOT_SCENARIO}"]`))).click();
  await until(() => find('[data-test="trpg-start"]'), { timeout: 30000 });
  await wait(600);
  if (name === "cover") return;
  const ready = SHOT_READY[name] || SHOT_READY.talk;
  find('[data-test="trpg-start"]').click();
  await wait(500);
  for (let step = 0; step < 600 && !ready(); step++) {
    const show = document.querySelector(".trpg-roll-show");
    // ダイスの演出は、画面を押して結果へ送る。絵本（任意）はとばす
    if (show) host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    else (find('[data-test="trpg-picturebook-skip"]') || find('[data-test="trpg-picturebook-next"]') || find('[data-test="trpg-incarnate-skip"]')
      || find('[data-test="trpg-next"]') || find('[data-test="trpg-roll"]') || find('[data-test="trpg-settle"]') || find(".trpg-approach-list .trpg-approach")
      || find('.trpg-topic-list .trpg-topic:not(.selected)') || find(".trpg-stage-action .trpg-button.primary"))?.click();
    await wait(show ? 420 : 120);
  }
  await wait(900);
}

// 段の進み（見出しの「1/7 話を聞く」）を、段の名前と7つの点で見せる（VPG15。「1/7」の字は点で分かる。読み上げは本編の見出しのまま）。
// 見出しの字は本編が書き換えるので、隣に点の列を置き、字だけを CSS で隠す（本編の DOM の中身には触れない）。
const STEP = /^(\d+)\/(\d+)\s+(.+)$/;
function syncStep() {
  const node = host.querySelector('[data-test="trpg-heading-step"]');
  if (!node) return;
  const match = STEP.exec(node.textContent.trim());
  let track = node.nextElementSibling?.classList.contains("p-step") ? node.nextElementSibling : null;
  if (!match) { track?.remove(); node.classList.remove("p-step-source"); return; }
  const [, at, of, label] = match;
  if (!track) {
    track = Object.assign(document.createElement("span"), { className: "p-step" });
    track.setAttribute("aria-hidden", "true");
    node.after(track);
  }
  const key = `${at}/${of} ${label}`;
  if (track.dataset.key === key) return;
  track.dataset.key = key;
  const name = Object.assign(document.createElement("b"), { textContent: label });
  const pips = Object.assign(document.createElement("span"), { className: "p-step-pips" });
  for (let i = 1; i <= Number(of); i++) pips.append(Object.assign(document.createElement("i"), { className: i < Number(at) ? "done" : i === Number(at) ? "now" : "" }));
  track.replaceChildren(name, pips);
  node.classList.add("p-step-source");
}
let stepQueued = false;
new MutationObserver(() => { if (!stepQueued) { stepQueued = true; requestAnimationFrame(() => { stepQueued = false; syncStep(); }); } })
  .observe(host, { childList: true, subtree: true, characterData: true });

window.addEventListener("pagehide", () => controller?.destroy());
boot().catch(error => { console.error(error); host.textContent = "ボドゲカフェを準備できませんでした。読み込み直してください。"; });
if (shot) pose(shot).catch(error => console.warn(error));
