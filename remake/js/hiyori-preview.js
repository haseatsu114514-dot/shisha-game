// 本編とは別ページの、本番VNによる表示試写。セーブの読込・書込と章フックを使わない。
import { DB, loadAll } from "./core/data.js";
import { newGame } from "./core/state.js";
import { el } from "./core/util.js";
import { initLayers, layers, setBg } from "./core/ui.js";
import { unlockAudio } from "./core/audio.js";
import { play, isPlaying } from "./vn/engine.js";

function fitStage() {
  const width = window.visualViewport?.width || innerWidth;
  const height = window.visualViewport?.height || innerHeight;
  document.getElementById("stage").style.setProperty("--k", String(Math.min(width / 1280, height / 720)));
}
fitStage();
window.addEventListener("resize", fitStage);
window.visualViewport?.addEventListener("resize", fitStage);
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);
initLayers();
const scratch = newGame(); // メモリ上だけ。既存のlocalStorageは開かない
scratch.met.hiyori = true;
scratch.slot = 1;

const samples = [
  ["gap", "儚い台詞と本心"], ["axe", "斧投げで演技が崩れる"], ["work", "総務の仕事と気分転換"],
  ["romance", "本心が初めて声になる"], ["lover", "恋人になっても儚い女ごっこ"],
];
function menu() {
  layers.screen.replaceChildren(el("div.hiyori-preview-menu", [
    el("h1", { text: "泡沢ひより" }),
    el("p", { text: "表示確認用の短い台本です。正式な登場方法は未確定。本編のセーブは変更しません。" }),
    ...samples.map(([id, label]) => el("button.btn", { text: label, dataset: { test: `hiyori-preview-${id}` },
      onclick: async () => {
        if (isPlaying()) return;
        // 斧投げは専用背景待ち。別の店舗を斧投げバーとして代用しない。
        if (id === "axe") await setBg(null, { instant: true });
        await play(`hiyori_preview_${id}`);
        menu();
      } })),
  ]));
}
layers.screen.replaceChildren(el("p", { text: "読み込み中……" }));
try {
  await loadAll();
  await document.fonts.ready;
  menu();
} catch (error) {
  layers.screen.replaceChildren(el("p", { text: `試写の読み込みに失敗しました: ${error.message}` }));
  console.error(error);
}
