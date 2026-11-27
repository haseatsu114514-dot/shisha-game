// 縦画面の試作: ボドゲカフェ（短編TRPG）を縦の画面で動かす（縦試作の枠 ../index.html?view=play&scene=trpg が iframe で読む。単体でも開ける）。
// 本編のボドゲカフェと同じ「本をめくって物語を選ぶ」本棚（js/trpg/campaign-view.js・TRP11）と卓を、使い捨ての状態で開く。
// 状態の作り方は本編の試遊（js/trpg/trial.js・TRF21）と同じ trpgTrialState（夜・部員がそろっている・部員の本は買ってある）。
// 本編のセーブ・設定は読み書きしない（状態はこのページの中だけ。卓を遊び終えたら次の夜の本棚へ）。
// 物語・台詞・判定・絵・音は本編のまま、並べ方は trpg.css。
// ?shot=library|turned|cover|talk|choice|aid|roll|topics|explore は、一覧（PC）に並べる止め絵
//   （library＝本の見開き、turned＝別の本へめくった所、choice＝行動の宣言、aid＝助力を付けられる宣言、roll＝判定の結果、topics＝聞き込み、explore＝部屋を調べる）。
import { newState } from "../../../js/core/state.js";
import { mountTrpgCampaign } from "../../../js/trpg/campaign-view.js";
import { loadTrpgClubResources } from "../../../js/trpg/index.js";
import { trpgTrialState } from "../../../js/trpg/trial-state.js";
import { initPortraitFit, shot, param, tellParent, until } from "./frame.mjs";

const stage = document.getElementById("stage"), host = document.getElementById("trpg-app");
// ダイスの劇場（js/trpg/roll-show.js）は、縦では 720×1240 の縦長の舞台に組み替えて（trpg.css）、画面の幅いっぱい近くまで大きく見せる。
// 倍率は幅（640）と高さ（ステージの高さ）の両方に収まる大きさ（VPG22）
const RS_W = 720, RS_H = 1240;
initPortraitFit(stage, ({ width, height }) => {
  stage.style.setProperty("--rs-k", String(Math.min(width / RS_W, (height - 24) / RS_H).toFixed(4)));
  syncExplore();
});
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
  aid: () => find('[data-test="trpg-choice-aid"]'), // 仲間の助力を付けられる宣言（札に「助力で 約N%」が出る）
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
      || find('.trpg-topic-list .trpg-topic:not(.selected)') || find(".trpg-hypothesis-board .trpg-object-choice") || find(".trpg-stage-action .trpg-button.primary")
      || find(".trpg-room.interactive .trpg-spot:not(.checked)")
      || find(".trpg-selection:not(.trpg-interview) .trpg-choice-cards:not(:has(.selected)) .trpg-object-choice")
      || [...document.querySelectorAll(".trpg-choice-tab")].find(tab => tab.offsetParent && !tab.disabled && /選んでいない/.test(tab.textContent)))?.click();
    await wait(show ? 420 : 120);
  }
  await wait(900);
}

// 段の進み（見出しの「1/7 話を聞く」）を、段の名前と7つの点で見せる（VPG17。「1/7」の字は点で分かる。読み上げは本編の見出しのまま）。
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
// 調べる場面で、横長の絵の外側に同じ絵をぼかして敷く（trpg.css の --scene-art。VPG20）。今の部屋の絵を写すだけで、本編の DOM には触れない。
function syncSceneArt() {
  const img = host.querySelector(".trpg-room > img");
  const src = img?.currentSrc || img?.src || "";
  if (host.dataset.sceneArt === src) return;
  host.dataset.sceneArt = src;
  if (src) host.style.setProperty("--scene-art", `url("${src.replace(/"/g, "%22")}")`);
  else host.style.removeProperty("--scene-art");
}
// 調べる場面（VPG23）: 部屋の絵を縦の画面で大きく見せる。横長の絵は縦に収まらないので、左半分と右半分に分けて見せ、
// 下の「左・右」の札と、絵を横に払うので切り替える。調べる印は絵と一緒に動き、今の側に無い印は隠す（反対側の札に、まだ調べていない数）。
// 本編の DOM には触れない: 印の位置（本編が style の left/top に % で書く）を CSS の変数に写し、表と裏（data-pan）は #stage に立てる。
const EX_H = 664; // 絵の高さ（ステージの単位）。幅は絵の比率から（16:9 で約 1180）。左右の半分が 100px ほど重なり、どの印もどちらかの側で丸ごと見える
const panNav = document.createElement("nav");
panNav.className = "p-pan";
panNav.setAttribute("aria-label", "部屋の見る側");
const panButtons = ["left", "right"].map(side => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "p-pan-side";
  button.dataset.side = side;
  button.dataset.test = `trpg-pan-${side}`;
  button.innerHTML = side === "left" ? '<i aria-hidden="true">◀</i><b>左</b><em aria-hidden="true"></em>' : '<em aria-hidden="true"></em><b>右</b><i aria-hidden="true">▶</i>';
  button.addEventListener("click", () => pan(side));
  panNav.append(button);
  return button;
});
stage.append(panNav);
stage.dataset.pan = "left";
function pan(side) {
  if (stage.dataset.pan === side) return;
  stage.dataset.pan = side;
  syncExplore();
}
function syncExplore() {
  const root = host.querySelector(".trpg-root");
  // 窓（メモ・見立て・判定など）が開いている間は、左右の札を出さない
  const room = root?.matches('.trpg-idle[data-phase="explore"]') && !root.querySelector(".trpg-modal, .trpg-roll-show") ? root.querySelector(".trpg-room.interactive") : null;
  stage.dataset.exploring = room ? "true" : "false";
  if (!room) return;
  const img = room.querySelector(":scope > img");
  const ratio = img?.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 16 / 9;
  const exW = EX_H * ratio, width = 640, panX = stage.dataset.pan === "right" ? exW - width : 0;
  stage.style.setProperty("--ex-h", `${EX_H}px`);
  stage.style.setProperty("--ex-ar", ratio.toFixed(5));
  const left = { open: 0 }, right = { open: 0 };
  for (const spot of room.querySelectorAll(".trpg-spot")) {
    const sx = parseFloat(spot.style.left), sy = parseFloat(spot.style.top);
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
    spot.style.setProperty("--sx", String(sx));
    spot.style.setProperty("--sy", String(sy));
    const at = sx / 100 * exW;
    // 印（丸 80px）が丸ごと入る側。真ん中付近の印は両方の側で見える
    const inLeft = at <= width - 44, inRight = at >= exW - width + 44;
    const shown = stage.dataset.pan === "right" ? inRight : inLeft;
    spot.dataset.off = String(!shown);
    const x = at - panX;
    spot.dataset.edge = x < 130 ? "start" : x > width - 130 ? "end" : "";
    // 名前の札は印の下に（絵が縦に高いので下に余る）。絵の下の端に近い印だけ上に
    spot.dataset.pside = sy > 86 ? "above" : "below";
    if (!spot.classList.contains("checked") && !spot.disabled) {
      if (inLeft && !inRight) left.open++;
      if (inRight && !inLeft) right.open++;
    }
  }
  for (const button of panButtons) {
    const side = button.dataset.side, open = side === "left" ? left.open : right.open, current = stage.dataset.pan === side;
    button.setAttribute("aria-pressed", String(current));
    button.querySelector("em").textContent = !current && open ? String(open) : "";
    button.setAttribute("aria-label", `部屋の${side === "left" ? "左" : "右"}側を見る${!current && open ? `。まだ調べていない所が${open}つ` : ""}`);
  }
}
// 絵を横に払って、反対の側へ（印を押す途中で払った時は、その印は押さない）
let swipe = null, swallowClick = false;
stage.addEventListener("pointerdown", event => {
  if (stage.dataset.exploring !== "true" || event.target.closest?.(".p-pan, .trpg-stage-companions, .trpg-stage-pockets, .trpg-stage-action")) return;
  swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
});
stage.addEventListener("pointerup", event => {
  if (!swipe || swipe.id !== event.pointerId) return;
  const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y, unit = stage.getBoundingClientRect().width / 640;
  swipe = null;
  if (Math.abs(dx) < 48 * unit || Math.abs(dx) < Math.abs(dy) * 1.2) return;
  swallowClick = true;
  setTimeout(() => { swallowClick = false; }, 0);
  pan(dx < 0 ? "right" : "left");
});
stage.addEventListener("pointercancel", () => { swipe = null; });
stage.addEventListener("click", event => { if (swallowClick) { swallowClick = false; event.stopPropagation(); event.preventDefault(); } }, true);

let stepQueued = false;
new MutationObserver(() => { if (!stepQueued) { stepQueued = true; requestAnimationFrame(() => { stepQueued = false; syncStep(); syncSceneArt(); syncExplore(); }); } })
  .observe(host, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "data-phase", "disabled"] });

window.addEventListener("pagehide", () => controller?.destroy());
boot().catch(error => { console.error(error); host.textContent = "ボドゲカフェを準備できませんでした。読み込み直してください。"; });
if (shot) pose(shot).catch(error => console.warn(error));
