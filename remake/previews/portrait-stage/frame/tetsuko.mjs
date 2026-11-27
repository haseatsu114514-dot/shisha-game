// 縦画面の試作: 「てつこといっしょ」を縦の画面で動かす（縦試作の枠 ../index.html?view=play&scene=tetsuko が iframe で読む。単体でも開ける）。
// 本編の画面（remake/js/minigames/tetsuko-time.js の openTetsukoTime）をそのまま呼ぶ。遊び・判定・台詞・絵・音は本編のまま、並べ方は tetsuko.css。
// 本編の画面は本編の層（core/ui.js の layers）とデータ（data/*.json）を使うので、このページでも同じ層を置き、データを読んでから開く。
// 進行の値は newState() の使い捨て（デバッグ入口と同じ作り方）。来訪の記録・手帳・小物は、このページを開いている間だけ値の中に覚える
// （確定は本編と同じ settleTetsukoTime。値に書くだけで、保存はしない。本編の保存の関数は呼ばない）。
// ?visits=0〜4 は通った回数（段階。既定 4＝気を許した後）。?shot=visit|pet|toy|decor|book は、一覧（PC）に並べる止め絵。
import { loadAll } from "../../../js/core/data.js";
import { initLayers } from "../../../js/core/ui.js";
import { newState } from "../../../js/core/state.js";
import { unlockAudio } from "../../../js/core/audio.js";
import { openTetsukoTime, settleTetsukoTime } from "../../../js/minigames/tetsuko-time.js";
import { initPortraitFit, shot, param, tellParent, until } from "./frame.mjs";

const stage = document.getElementById("stage");
// 舞台（1280×720）の倍率（--z）: 下の操作の板に DECK ぶんを残し、残りの高さいっぱいに舞台を置く。
// 広げすぎると左右が見えなくなるので 1.15 倍まで、縦が短い端末でも 0.9 倍まで（tetsuko.css が --z で舞台と部品を拡大縮小する）。
const DECK = 500;
initPortraitFit(stage, ({ height }) => stage.style.setProperty("--z", String(Math.max(0.9, Math.min(1.15, (height - DECK) / 720)).toFixed(3))));
// 本編（main.js）と同じく、最初の操作で音を解禁する
const unlock = () => unlockAudio({ warm: false });
window.addEventListener("pointerdown", unlock);
window.addEventListener("keydown", unlock);

const test = name => `[data-test="tetsuko-${name}"]`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
/** 止め絵の場面を作る（画面のボタンを押して進める。本編の検査と同じ目印 data-test を使う）。 */
async function pose(name) {
  await until(() => document.querySelector(test("time-screen")));
  await wait(1600); // 入った時の箱が開く演出・カメラが寄るのを待つ
  if (name === "pet") { // なでる: 頭をなでて、ごろごろ
    const cat = document.querySelector(test("cat")), box = cat.getBoundingClientRect();
    const at = (dx, dy) => ({ clientX: box.left + box.width * dx, clientY: box.top + box.height * dy, pointerId: 7, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true });
    cat.dispatchEvent(new PointerEvent("pointerdown", at(0.4, 0.25)));
    for (let i = 0; i < 16; i++) { cat.dispatchEvent(new PointerEvent("pointermove", at(0.4 + 0.2 * Math.sin(i / 2), 0.25))); await wait(60); }
    cat.dispatchEvent(new PointerEvent("pointerup", at(0.5, 0.25)));
  } else if (name === "toy") { // じゃらしを出して振る
    document.querySelector(test("play")).click();
    await wait(900);
    const yard = document.querySelector(".tt-yard"), box = yard.getBoundingClientRect(), view = document.documentElement.getBoundingClientRect();
    const at = i => ({ clientX: view.width * (0.5 + 0.22 * Math.sin(i / 1.6)), clientY: box.top + box.height * 0.62, pointerId: 7, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true });
    yard.dispatchEvent(new PointerEvent("pointerdown", at(0)));
    for (let i = 1; i < 22; i++) { yard.dispatchEvent(new PointerEvent("pointermove", at(i))); await wait(70); }
  } else if (name === "decor") { // もようがえ（置き場所が全部見える引いた絵）
    document.querySelector(test("decor")).click();
    await wait(1300);
  } else if (name === "book") { // てつこ手帳
    document.querySelector(test("book")).click();
    await wait(600);
  }
}

async function play() {
  initLayers();
  await loadAll();
  // 進行の値: デバッグ入口（js/dev/minigame-launcher.js）と同じ第3章の昼。通った回数は ?visits=（既定は気を許した後）
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "daily", day: 5 });
  const visits = Math.max(0, Math.min(9, Number(param("visits") ?? 4) || 0));
  value.flags._ch3_outings = { ...(value.flags._ch3_outings || {}), tetsuko: visits };
  value.met = { ...(value.met || {}), mukai_master: true };
  if (shot) pose(shot).catch(error => console.warn(error));
  for (let visit = 0; ; visit++) {
    const visitKey = `portrait:${value.day}:${visit}`;
    const result = await openTetsukoTime({ value, visitKey });
    settleTetsukoTime(value, result); // 値の中の記録だけを進める（保存はしない）
    value.day += 1; // 同じ日は一度だけなので、次の日にして入口へ戻す
    // 「帰る」: 本編では裏口から店へ戻る。試作では次の日の裏口へ戻し、枠に知らせる
    tellParent("leave", { game: "tetsuko" });
    if (shot) return;
  }
}
play();
