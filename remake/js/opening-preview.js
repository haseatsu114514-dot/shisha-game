import { loadAll, DB, bgUrl } from "./core/data.js";
import { initLayers, setBg } from "./core/ui.js";
import { newGame, loadConfig } from "./core/state.js";
import { unlockAudio, playBgm, stopBgm } from "./core/audio.js";
import { playTonariOpening } from "./scenes/tonari-opening.js";

const button = document.getElementById("opening-play");
const stop = document.getElementById("opening-stop");
const select = document.getElementById("opening-from");
const message = document.getElementById("opening-status");
const toolbar = document.getElementById("opening-tools");
function fit() {
  const top = toolbar.getBoundingClientRect().height;
  document.getElementById("viewport").style.top = `${top}px`;
  document.getElementById("stage").style.setProperty("--k", String(Math.max(.05, Math.min(innerWidth / 1280, (innerHeight - top) / 720))));
}
addEventListener("resize", fit);
new ResizeObserver(fit).observe(toolbar);
fit();
initLayers();
loadConfig(); // 音量を読むだけ。save/loadは呼ばず、プレイヤーの進行を触らない。
let controller;
try {
  await loadAll();
  await document.fonts.ready;
  newGame();
  await setBg(bgUrl("bg_tonari_inside"), { instant: true });
  button.disabled = false;
  button.textContent = "再生する";
} catch (error) {
  message.textContent = `素材を読み込めませんでした。ページを再読み込みしてください：${error.message}`;
}
button.addEventListener("click", async () => {
  if (controller) return;
  controller = new AbortController();
  button.disabled = select.disabled = true;
  stop.disabled = false;
  message.textContent = "クリック・Enterで台詞送り／AUTO・SKIPも使えます";
  newGame();
  unlockAudio();
  playBgm("tonari");
  const source = DB.dialogues.ch1_opening;
  const from = Math.max(0, source.lines.findIndex(line => line.shot === select.value));
  const end = source.lines.findIndex(line => line.speaker === "sumi");
  // 本編の同じ台本と演出を再生。確認区間は常連の退店まで。
  const dialogue = { ...source, lines: source.lines.slice(from, end), branches: {} };
  try {
    const result = await playTonariOpening({ signal: controller.signal, dialogue });
    message.textContent = result?.cancelled ? "再生を終了しました。別のカットからも見られます" : "冒頭プレビュー終了。セーブデータは変更していません";
  } catch (error) {
    message.textContent = `再生できませんでした：${error.message}`;
  } finally {
    stopBgm();
    controller = null;
    button.disabled = select.disabled = false;
    stop.disabled = true;
    button.textContent = "もう一度見る";
  }
});
stop.addEventListener("click", () => controller?.abort());
addEventListener("pagehide", () => controller?.abort());
