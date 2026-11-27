// 縦画面の試作: ボドゲカフェ（短編TRPG）を縦の画面で動かす（縦試作の枠 ../index.html?view=play&scene=trpg が iframe で読む。単体でも開ける）。
// 本編の単独ページ（remake/js/trpg/preview.js）と同じ mountTrpgCollection を呼ぶだけ。物語・台詞・判定・絵・音は本編のまま、並べ方は trpg.css。
// この卓は本編の保存を読まない・書かない（mountTrpgCollection の決まり）。
// ?shot=library|cover|talk|choice|roll|topics|explore は、一覧（PC）に並べる止め絵（choice＝行動の宣言、roll＝判定の結果、topics＝聞き込み、explore＝部屋を調べる）。?scenario=・?seed=・?traveler=・?tutorial=1 は単独ページと同じ。
import { mountTrpgCollection } from "../../../js/trpg/collection.js";
import { initPortraitFit, shot, param, until } from "./frame.mjs";

const stage = document.getElementById("stage"), host = document.getElementById("trpg-app");
initPortraitFit(stage);
// 本編のスマホ向けの決まり（文字とタップの大きさ。css/phone-density.css・css/trpg-phone.css の data-density="phone"）を、縦でも使う
document.documentElement.dataset.density = "phone";
document.documentElement.dataset.layout = "portrait";

const SHOT_SCENARIO = "ordinary-cup"; // 止め絵に使う物語（世界一普通の一台）
let collection = null;

function boot() {
  collection?.destroy();
  const seedText = param("seed");
  collection = mountTrpgCollection(host, {
    initialScenarioId: param("scenario") || (shot && shot !== "library" ? SHOT_SCENARIO : null) || (param("traveler") || seedText ? SHOT_SCENARIO : null),
    seed: seedText != null && seedText !== "" ? Number(seedText) : shot ? 7 : undefined,
    profileId: param("traveler"), tutorial: param("tutorial") === "1",
  });
  window.__trpg = Object.freeze({ snapshot: () => collection.snapshot(), audio: () => collection.audioSnapshot(),
    get ready() { return collection.loaded; } });
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
  await until(() => collection?.loaded);
  if (name === "library") return;
  await until(() => find('[data-test="trpg-start"]'));
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

window.addEventListener("pagehide", () => collection?.destroy());
window.addEventListener("pageshow", event => { if (event.persisted) boot(); });
boot();
if (shot) pose(shot).catch(error => console.warn(error));
