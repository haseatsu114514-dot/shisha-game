// 本編と同じエンジン・CSSで会話UIを試す。保存済みゲームは読み書きしない。
import { loadAll, DB } from "../core/data.js";
import { newGame, state, config } from "../core/state.js";
import { initLayers } from "../core/ui.js";
import { play } from "./engine.js";
import { markIntroSeen } from "./intro.js";
import { applyUiTheme, createUiThemeSelect } from "../core/ui-theme.js";

const selector = document.querySelector("#preview-scene");
const status = document.querySelector("#preview-status");
const stage = document.querySelector("#stage");
const theme = applyUiTheme(new URL(location.href).searchParams.get("theme"));
const themeSelect = createUiThemeSelect(theme, applyUiTheme);
themeSelect.id = "preview-theme";
document.querySelector("#preview-restart").before(themeSelect);
const kit = document.createElement("aside");
kit.className = "ui-samples";
kit.hidden = true;
kit.innerHTML = `
  <section class="panel ui-sample-panel"><small>MENU</small><h2>ひと息つこう</h2>
    <div class="ui-sample-actions"><button class="btn primary">セーブ</button><button class="btn">ロード</button><button class="btn">ステータス</button><button class="btn">閉じる</button></div>
  </section>
  <section class="panel ui-sample-panel"><small>TONARI · DAY 04</small><h2>今日のひととき</h2>
    <div class="hud-stamina" data-health="green"><span>体力</span><i class="hud-bar"><span class="gauge-track"><b style="width:72%"></b></span></i></div>
    <p>所持金 <b>12,800円</b></p><div class="ui-sample-actions"><button class="btn small">店へ行く</button><button class="btn small">帰宅する</button></div>
  </section>
  <section class="panel ui-sample-panel"><small>RELATIONSHIP</small><h2>少し近づいた</h2>
    <div class="heart-row"><i class="ui-heart" style="--fill:100%"></i><i class="ui-heart" style="--fill:100%"></i><i class="ui-heart" style="--fill:45%"></i><i class="ui-heart" style="--fill:0%"></i><i class="ui-heart" style="--fill:0%"></i></div>
    <div class="gain-card stat" style="--gc:var(--stat-technique)"><span class="gc-badge">技</span><div class="gc-meta"><small>STATUS UP</small><b>技術 +2P</b></div></div>
  </section>`;
stage.append(kit);
const kitButton = document.createElement("button");
kitButton.textContent = "UI一式";
kitButton.id = "preview-kit";
kitButton.setAttribute("aria-pressed", "false");
kitButton.addEventListener("click", () => {
  kit.hidden = !kit.hidden;
  kitButton.setAttribute("aria-pressed", String(!kit.hidden));
});
document.querySelector("#preview-restart").after(kitButton);
function fit() {
  const headerHeight = document.querySelector(".preview-tools").offsetHeight;
  document.querySelector("#viewport").style.top = `${headerHeight}px`;
  stage.style.setProperty("--k", String(Math.min(innerWidth / 1280, (innerHeight - headerHeight) / 720)));
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
