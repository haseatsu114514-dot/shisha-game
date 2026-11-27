// 縦画面の試作: ラクダレースを縦の画面で動かす（縦試作の枠 ../index.html?view=play&scene=camel が iframe で読む。単体でも開ける）。
// 本編の画面（remake/js/minigames/camel-race.js）を layout: "portrait" で呼ぶだけ。規則・採点・絵・音は本編のまま、並べ方は camel.css。
// 記録と開いた大会は、このページを開いている間だけ覚える（本編の保存には触れない）。
// ?shot=tutorial|cups|race|result は、一覧（PC）に並べる止め絵。?pilot=perfect（自動操作）・?speed=（早回し）は単独ページと同じ。
import { runCamelRace, loadCamelArt } from "../../../js/minigames/camel-race.js";
import { unlockAudio } from "../../../js/core/audio.js";
import { initPortraitFit, shot, param, tellParent, until } from "./frame.mjs";

const stage = document.getElementById("stage");
// コースの絵の倍率（--z）: 下の操作の板に 430 ぶんを残し、残りの高さいっぱいにコース（720）を置く。
// 広げすぎると左右が見えなくなるので 1.2 倍まで、縦が短い端末でも 0.92 倍まで（camel.css が --z で絵と HUD を拡大縮小する）。
const DECK = 430;
initPortraitFit(stage, ({ height }) => stage.style.setProperty("--z", String(Math.max(0.92, Math.min(1.2, (height - DECK) / 720)).toFixed(3))));
// 本編（main.js）と同じく、最初の操作で音を解禁する
const unlock = () => unlockAudio({ warm: false });
window.addEventListener("pointerdown", unlock);
window.addEventListener("keydown", unlock);
void loadCamelArt();
// 本編のスマホ向けの決まり（大会選びの前置きを出さない等。css/camel-race.css の data-density="phone"）を、縦でも使う
document.documentElement.dataset.density = "phone";

/** 止め絵の場面を作る（本編の検査用の窓口 window.__camelRace を使う）。 */
async function pose(name) {
  const hook = await until(() => window.__camelRace);
  if (name === "tutorial" || name === "cups") return;
  (await until(() => document.querySelector('[data-test="camel-cup"]:not(:disabled)'))).click();
  if (name === "result") { (await until(() => document.querySelector('[data-test="camel-result"] button'), { timeout: 90000 })).blur(); return; }
  await until(() => hook.fx.phase === "race" && hook.fx.t > 7, { every: 30, timeout: 60000 });
  hook.debug.freeze(true);
}

async function play() {
  let best = null, first = true;
  const cups = new Set(["practice", "rookie"]), cupRecords = {};
  if (shot) pose(shot).catch(error => console.warn(error));
  for (;;) {
    const outcome = await runCamelRace({
      host: stage, layout: "portrait", tutorial: shot ? shot === "tutorial" : first && !param("skip"),
      pilot: shot && shot !== "tutorial" && shot !== "cups" ? "perfect" : param("pilot") || null,
      timeScale: shot === "result" ? 10 : shot === "race" ? 3 : Number(param("speed")) || 1,
      best, cups: [...cups], cupRecords, debugTools: true,
    });
    first = false;
    if (outcome.best && (!best || outcome.best.total > best.total)) best = outcome.best;
    for (const run of outcome.runs || []) { // 3位以内で次の大会が開く（本編と同じ条件を、このページの間だけ覚える）
      const record = cupRecords[run.cup] ||= {};
      if (!record.best || run.total > record.best.total) record.best = run;
      if (run.rank <= 3 && run.cup === "rookie") cups.add("standard");
      if (run.rank <= 3 && run.cup === "standard") cups.add("expert");
    }
    // やめる・競馬場を出る: 本編では街へ戻る。試作では入口へ戻し、枠に知らせる
    tellParent("leave", { game: "camel" });
    if (shot) return;
  }
}
play();
