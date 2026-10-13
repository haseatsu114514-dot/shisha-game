// Disposable chapter-2 table, without opening or writing the player's saves.
import { newState } from "../core/state.js";
import { el } from "../core/util.js";
import { mountTrpgCampaign } from "./campaign-view.js";
const host = document.getElementById("trpg-app"), stage = document.getElementById("stage");
const state = newState();
Object.assign(state, { chapter: 2, phase: "daily", day: 3, slot: 1, money: 3000 });
for (const id of ["hiyori", "samechan", "tsumugi", "adam"]) { state.met[id] = true; state.affinity[id] = 66; }
let controller, saves = 0, nightBusy = false;
function fit() { stage.style.setProperty("--k", Math.min(innerWidth / 1280, innerHeight / 720)); }
fit(); window.addEventListener("resize", fit);
function mount() {
  controller?.destroy();
  controller = mountTrpgCampaign(host, { getState: () => state, save: () => { saves++; }, nightBusy: () => nightBusy,
    closeLabel: "試遊の設定へ" });
  controller.finished.then(() => { if (!host.querySelector(".trpg-root")) setup(); });
}
function setup() {
  const choose = (label, test, action) => el("button.trpg-button", { text: label, dataset: { test }, onclick: () => { action(); mount(); } });
  host.replaceChildren(el("section.trpg-root.trpg-campaign", [
    el("span.trpg-kicker", { text: "開発用試遊 / 本編のセーブは読み書きしません" }),
    el("h1", { text: "本棚・招集の条件を試す" }),
    el("p", { text: "購入・クリア記録はこのページのメモリだけに保持。再読み込みで初期状態に戻ります。" }),
    choose("DAY 3の夜 · サメちゃんは休み", "trpg-demo-day3", () => { state.chapter = 2; state.day = 3; state.slot = 1; state.trpg.shifts = []; nightBusy = false; }),
    choose("DAY 5の夜 · アダムが参加、ひよりは仕事", "trpg-demo-day5", () => { state.chapter = 2; state.day = 5; state.slot = 1; state.trpg.shifts = [{ id: "hiyori", chapter: 2, day: 5, slot: 1, busy: true, reason: "残業中" }]; nightBusy = false; }),
    choose("二人卓 · ひよりとはじめ", "trpg-demo-small", () => { state.chapter = 2; state.day = 4; state.slot = 1; state.trpg.shifts = [{ id: "tsumugi", chapter: 2, day: 4, slot: 1, busy: true, reason: "制作の予定" }]; nightBusy = false; }),
    choose("第1章 · 解禁前", "trpg-demo-ch1", () => { state.chapter = 1; state.slot = 1; }),
    choose("夜の約束がある日", "trpg-demo-busy", () => { state.chapter = 2; state.slot = 1; nightBusy = true; }),
    choose("昼 · 購入だけできる", "trpg-demo-noon", () => { state.chapter = 2; state.slot = 0; nightBusy = false; }),
  ]));
}
window.__trpgCampaignPreview = Object.freeze({ snapshot: () => structuredClone(state), saves: () => saves });
window.addEventListener("pagehide", () => controller?.destroy(), { once: true });
mount();
