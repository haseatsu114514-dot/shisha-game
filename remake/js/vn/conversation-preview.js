// 本編と同じエンジン・CSSで会話UIを試す。保存済みゲームは読み書きしない。
import { loadAll, DB } from "../core/data.js";
import { newGame, state, config } from "../core/state.js";
import { initLayers } from "../core/ui.js";
import { play } from "./engine.js";
import { markIntroSeen } from "./intro.js";

const selector = document.querySelector("#preview-scene");
const status = document.querySelector("#preview-status");
const stage = document.querySelector("#stage");
function fit() {
  stage.style.setProperty("--k", String(Math.min(innerWidth / 1280, (innerHeight - 48) / 720)));
}
fit();
addEventListener("resize", fit);
initLayers();
let controller;
async function start() {
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  newGame();
  for (const id of Object.keys(DB.characters)) {
    state.met[id] = true;
    markIntroSeen(id);
  }
  Object.assign(config, { textSpeed: 4, mute: true });
  const scenes = {
    hiyori: { ...DB.dialogues.hiyori_shop_repeat_0, lines: DB.dialogues.hiyori_shop_repeat_0.lines.slice(1) },
    names: { dialogue_id: "ui-preview-names", lines: [
      { speaker: "adam", face: "normal", text: "名前が切り替わっても、同じ会話ウインドウで表示します。" },
      { speaker: "hajime", text: "本文の送り方や操作は、本編と同じです。" },
      { speaker: "hiyori", face: "smile", text: "……また見つかっちゃった" },
    ] },
    narration: { dialogue_id: "ui-preview-narration", lines: [
      { speaker: "", text: "暖かな灯りの下、静かに煙がほどけていく。\n名前のない地の文も、同じ枠の中に表示される。" },
      { speaker: "hajime", text: "（今日は、ここで一息つこう）" },
    ] },
    choices: { dialogue_id: "ui-preview-choices", lines: [
      { speaker: "hiyori", face: "smile", text: "……今日はどうしようか" },
      { type: "choice", choices: [{ text: "もう少し話す" }, { text: "ゆっくり煙を眺める" }] },
      { speaker: "hiyori", face: "smile", text: "……うん。今日はここにしよう" },
    ] },
  };
  status.textContent = "画面をクリックで会話送り · セーブへの影響なし";
  await play(scenes[selector.value], { bg: "res://assets/backgrounds/bg_eden_shop.png", signal });
  if (!signal.aborted) status.textContent = "会話終了 ·「もう一度」で再生できます";
}
selector.addEventListener("change", start);
document.querySelector("#preview-restart").addEventListener("click", start);
try {
  await loadAll();
  await Promise.all([document.fonts.load('700 24px "Suien Name"', "ひよりアダム"), document.fonts.load('500 32px "Suien Gothic"')]);
  selector.disabled = false;
  document.querySelector("#preview-restart").disabled = false;
  await start();
} catch (error) {
  status.textContent = "読み込みに失敗しました。再読み込みしてください。";
  console.error(error);
}
