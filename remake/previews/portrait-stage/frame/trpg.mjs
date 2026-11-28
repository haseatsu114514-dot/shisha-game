import { mountPortraitTable } from "../../../js/trpg/portrait-layout.js";
// 縦画面の試作: ボドゲカフェ（短編TRPG）を縦の画面で動かす（縦試作の枠 ../index.html?view=play&scene=trpg が iframe で読む。単体でも開ける）。
// 本編のボドゲカフェと同じ「本をめくって物語を選ぶ」本棚（js/trpg/campaign-view.js・TRP11）と卓を、使い捨ての状態で開く。
// 状態の作り方は本編の試遊（js/trpg/trial.js・TRF21）と同じ trpgTrialState（夜・部員がそろっている・部員の本は買ってある）。
// 本編のセーブ・設定は読み書きしない（状態はこのページの中だけ。卓を遊び終えたら次の夜の本棚へ）。
// 物語・台詞・判定・絵・音は本編のまま、並べ方は trpg.css。
// ?shot=library|turned|cover|talk|choice|aid|showaid|showreroll|roll|topics|explore は、一覧（PC）に並べる止め絵
//   （library＝本の見開き、turned＝別の本へめくった所、choice＝行動の宣言、aid＝助力を付けられる宣言、showaid／showreroll＝劇場の中で助力／振り直しを選ぶ所、
//    roll＝判定の結果、topics＝聞き込み、explore＝部屋を調べる）。
import { newState } from "../../../js/core/state.js";
import { mountTrpgCampaign } from "../../../js/trpg/campaign-view.js";
import { loadTrpgClubResources } from "../../../js/trpg/index.js";
import { trpgTrialState } from "../../../js/trpg/trial-state.js";
import { initPortraitFit, shot, param, tellParent, until } from "./frame.mjs";

const stage = document.getElementById("stage"), host = document.getElementById("trpg-app");
initPortraitFit(stage);
mountPortraitTable(stage, host);
// 本編のスマホ向けの決まり（文字とタップの大きさ。css/phone-density.css・css/trpg-phone.css の data-density="phone"）を、縦でも使う
document.documentElement.dataset.density = "phone";
document.documentElement.dataset.layout = "portrait";
// スキル（仲間の助力・振り直し）は、卓の窓ではなくダイス劇場の中で選ぶ（VPG29）。今は横の本編も同じ既定なので、印は立てない（view.js の skillsInShow）

const SHOT_SCENARIO = "ordinary-cup"; // 止め絵に使う物語（世界一普通の一台）
// ?jump=explore などは、止め絵と同じ場面まで自動で進めて、そこから遊べる（止め絵と違い、画面を押せる。検査用）
const jump = param("jump"), scene = shot || jump;
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
  if (scene) { state.flags ||= {}; state.flags._trpg_tutorial_seen = true; state.seed = 7; }
  shelf();
  window.__trpg = Object.freeze({ get state() { return state; }, get ready() { return !!host.querySelector('[data-test="trpg-book-spread"]'); } });
}

const find = selector => [...document.querySelectorAll(selector)].find(node => node.offsetParent !== null && !node.disabled) || null;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// 止め絵の場面ごとの「ここで止める」条件（卓が入力を待っている時だけ）
const SHOT_READY = {
  talk: () => find('[data-test="trpg-next"]') && !document.querySelector(".trpg-incarnate"),
  choice: () => find(".trpg-approach-list .trpg-approach"),
  aid: () => find('[data-test="trpg-choice-aid"]'), // 仲間の助力を付けられる宣言（札に「助力で 約N%」が出る）
  roll: () => find(".trpg-dice-total") && !document.querySelector(".trpg-roll-show"),
  showaid: () => find('[data-test="trpg-show-support"]'), // 劇場の中で、助力を使うか選ぶ所（VPG29）
  showreroll: () => find('[data-test="trpg-show-reroll-0"]'), // 劇場の中で、振り直すか選ぶ所（VPG29）
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
  // 待機中に目的の札をプレイヤーが押すと、その札は次のループまでに消える。操作の直前に到達を記録する。
  let handedOff = false;
  const handoff = () => { if (ready()) handedOff = true; };
  host.addEventListener("click", handoff, true);
  host.addEventListener("pointerdown", handoff, true);
  try {
    find('[data-test="trpg-start"]').click();
    await wait(500);
    for (let step = 0; step < 600 && !handedOff && !ready(); step++) {
      const show = document.querySelector(".trpg-roll-show");
      // ダイスの演出は、画面を押して結果へ送る。劇場の中で選ぶ札は「使わずに振る／このまま続ける」。絵本（任意）はとばす
      if (show?.classList.contains("trpg-rs-choosing")) (find('[data-test="trpg-show-nosupport"]') || find('[data-test="trpg-show-keep"]'))?.click();
      else if (show) host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      else (find('[data-test="trpg-picturebook-skip"]') || find('[data-test="trpg-picturebook-next"]') || find('[data-test="trpg-incarnate-skip"]')
        || find('[data-test="trpg-next"]') || find('[data-test="trpg-roll"]') || find('[data-test="trpg-settle"]') || find(".trpg-approach-list .trpg-approach")
        || find('.trpg-topic-list .trpg-topic:not(.selected)') || find(".trpg-hypothesis-board .trpg-object-choice") || find(".trpg-stage-action .trpg-button.primary")
        || find(".trpg-room.interactive .trpg-spot:not(.checked)")
        || find(".trpg-selection:not(.trpg-interview) .trpg-choice-cards:not(:has(.selected)) .trpg-object-choice")
        || [...document.querySelectorAll(".trpg-choice-tab")].find(tab => tab.offsetParent && !tab.disabled && /選んでいない/.test(tab.textContent)))?.click();
      await wait(show ? 420 : 120);
    }
  } finally {
    host.removeEventListener("click", handoff, true);
    host.removeEventListener("pointerdown", handoff, true);
  }
  await wait(900);
}

window.addEventListener("pagehide", () => controller?.destroy());
boot().catch(error => { console.error(error); host.textContent = "ボドゲカフェを準備できませんでした。読み込み直してください。"; });
if (scene) pose(scene).catch(error => console.warn(error));
