// 本編と同じエンジン・CSSで会話UIを試す。保存済みゲームは読み書きしない。
import { loadAll, loadDeferredDialogues, DB } from "../core/data.js";
import { newGame, state, config } from "../core/state.js";
import { initLayers } from "../core/ui.js";
import { play } from "./engine.js";
import { markIntroSeen } from "./intro.js";
import { applyUiTheme, UI_THEMES } from "../core/ui-theme.js";

const selector = document.querySelector("#preview-scene");
const status = document.querySelector("#preview-status");
const stage = document.querySelector("#stage");
const previewQuery = new URL(location.href).searchParams;
function applyPreviewTheme(value) {
  if(value === "heisei-blue") { document.documentElement.dataset.uiTheme=value; return value; }
  return applyUiTheme(value);
}
const theme = applyPreviewTheme(previewQuery.get("theme"));
const themeSelect=document.createElement("select");
themeSelect.className="ui-theme-select";
themeSelect.setAttribute("aria-label","UIデザイン");
for(const {id,label} of [...UI_THEMES,{id:"heisei-blue",label:"R2 平成の青いADV（比較用）"}]) {
  const option=document.createElement("option"); option.value=id; option.textContent=label; themeSelect.append(option);
}
themeSelect.value=theme;
themeSelect.disabled=true;
themeSelect.addEventListener("change",()=>{applyPreviewTheme(themeSelect.value);start();});
themeSelect.id = "preview-theme";
document.querySelector("#preview-restart").before(themeSelect);
const characterSelect=document.createElement("select");
characterSelect.id="preview-character";
characterSelect.setAttribute("aria-label","比較するキャラクター");
for(const [id,label] of [["hiyori","ひより"],["minto","みんと"],["ageha","あげは"],["tsumugi","つむぎ"]]) {
  const option=document.createElement("option"); option.value=id; option.textContent=label; characterSelect.append(option);
}
characterSelect.value=["hiyori","minto","ageha","tsumugi"].includes(previewQuery.get("character"))?previewQuery.get("character"):"hiyori";
if(previewQuery.has("character")) selector.value="characters";
characterSelect.hidden=selector.value!=="characters";
characterSelect.disabled=true;
themeSelect.after(characterSelect);
const backgroundSelect=document.createElement("select");
backgroundSelect.id="preview-background";
backgroundSelect.setAttribute("aria-label","比較する背景");
const backgrounds={eden:["Eden・暖色","res://assets/backgrounds/bg_eden_shop.png"],tonari:["となり・昼","res://assets/backgrounds/bg_tonari_inside_day.png"],street:["街・夜","res://assets/backgrounds/bg_street_night.png"]};
for(const [id,[label]] of Object.entries(backgrounds)){
  const option=document.createElement("option");option.value=id;option.textContent=label;backgroundSelect.append(option);
}
backgroundSelect.value=Object.hasOwn(backgrounds,previewQuery.get("background"))?previewQuery.get("background"):"eden";
backgroundSelect.disabled=true;
backgroundSelect.addEventListener("change",start);
characterSelect.after(backgroundSelect);
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
new ResizeObserver(fit).observe(document.querySelector(".preview-tools"));
initLayers();
const lightButton = document.createElement("button");
lightButton.id = "preview-light";
lightButton.textContent = "光の試作 OFF";
lightButton.setAttribute("aria-pressed", "false");
lightButton.onclick = () => {
  const on = document.documentElement.dataset.uiMotion !== "on";
  document.documentElement.dataset.uiMotion = on ? "on" : "off";
  lightButton.textContent = `光の試作 ${on ? "ON" : "OFF"}`;
  lightButton.setAttribute("aria-pressed", String(on));
};
document.querySelector("#preview-kit").after(lightButton);
function attachLight() {
  const box = document.querySelector(".vn-box");
  if (!box || box.querySelector(".vn-light-overlay")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("vn-light-overlay");
  svg.setAttribute("viewBox", "0 0 1200 240");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = '<path d="M130 18 C60 0 20 42 25 80 C30 106 72 116 48 148 C24 180 72 211 220 217"/><path d="M1020 32 C1130 8 1178 47 1160 79 C1140 110 1200 121 1175 166 C1155 200 1100 218 1000 220"/>';
  box.append(svg);
}
new MutationObserver(attachLight).observe(document.querySelector("#vn"), {childList:true});
let controller;
async function start() {
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  await loadDeferredDialogues();
  newGame();
  for (const id of Object.keys(DB.characters)) {
    state.met[id] = true;
    markIntroSeen(id);
  }
  Object.assign(config, { textSpeed: 4, mute: true });
  characterSelect.hidden=selector.value!=="characters";
  const characterLines = {
    hiyori:{speaker:"hiyori",face:"smile",text:"今日はここで、ゆっくりしていってね。\nお茶も用意するから、少しだけ待っていてね。"},
    minto:{speaker:"minto",face:"normal",text:"そうそう！\n時間帯でレシピを変えるの、大事なんだよ？"},
    ageha:{speaker:"ageha",face:"normal",text:"おつかれ、ハジメっち！\nうちも今、店閉めてきたとこ〜"},
    tsumugi:{speaker:"tsumugi",face:"normal",text:"……今日は、見せられる絵がなくて。\nすみません"},
  };
  const scenes = {
    characters:{dialogue_id:"ui-preview-characters",lines:[characterLines[characterSelect.value]]},
    hiyori: { ...DB.dialogues.hiyori_shop_repeat_0, lines: DB.dialogues.hiyori_shop_repeat_0.lines.slice(1) },
    twolines: { dialogue_id: "ui-preview-two-lines", lines: [
      { speaker: "hiyori", face: "smile", text: "今日はここで、ゆっくりしていってね。\nお茶も用意するから、少しだけ待っていてね。" },
    ] },
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
    // 本編のスミさんの仕組み解説（図解つき, #1128）をそのまま再生して確かめる
    shisha: DB.dialogues.ch1_sumi_basics,
  };
  status.textContent = "画面をクリックで会話送り · セーブへの影響なし";
  await play(scenes[selector.value], { bg: backgrounds[backgroundSelect.value][1], signal });
  if (!signal.aborted) status.textContent = "会話終了 ·「もう一度」で再生できます";
}
selector.addEventListener("change", start);
characterSelect.addEventListener("change", start);
document.querySelector("#preview-restart").addEventListener("click", start);
try {
  await loadAll();
  await Promise.all([document.fonts.load('700 24px "Suien Name"', "ひよりアダム"), document.fonts.load('500 32px "Suien Gothic"')]);
  selector.disabled = false;
  characterSelect.disabled = false;
  themeSelect.disabled = false;
  backgroundSelect.disabled = false;
  if(theme==="heisei-blue") await document.fonts.load('400 32px "Suien Blue Mincho"',"みんとあげはつむぎ時間帯");
  document.querySelector("#preview-restart").disabled = false;
  await start();
} catch (error) {
  status.textContent = "読み込みに失敗しました。再読み込みしてください。";
  console.error(error);
}
