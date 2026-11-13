import "./trial-redirect.js"; // 人が開いた時は本編の試遊へ送る（TRF21）。検査と ?harness=1 はこのページのまま
import { mountTrpgCollection } from "./collection.js";
import { fitStage } from "../core/stage-fit.js";
import { initSideArea } from "../core/side-area.js";

const host = document.getElementById("trpg-app");
const stage = document.getElementById("stage");
let collection = null;

function fit() {
  const width = window.visualViewport?.width || innerWidth, height = window.visualViewport?.height || innerHeight;
  fitStage(stage); // 本編と同じ画面当て（--k と、スマホ横持ちの文字拡大 data-density="phone"）
  const touch = matchMedia("(pointer:coarse)").matches;
  document.getElementById("trpg-rotate").hidden = !(touch && height > width);
}
function setScenarioUrl(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("scenario", id); else url.searchParams.delete("scenario");
  history.replaceState(null, "", url);
}
function boot() {
  collection?.destroy();
  const params = new URLSearchParams(location.search);
  collection = mountTrpgCollection(host, {
    initialScenarioId: params.get("scenario") || (params.has("traveler") || params.has("seed") ? "ordinary-cup" : null),
    seed: params.has("seed") ? Number(params.get("seed")) : undefined,
    profileId: params.get("traveler"), onScenarioChange: setScenarioUrl, tutorial: params.get("tutorial") === "1",
  });
  window.__trpg = Object.freeze({ snapshot: () => collection.snapshot(), audio: () => collection.audioSnapshot(),
    get ready() { return collection.loaded; } });
}
fit();
initSideArea({ stage, standalone: true, readSettings: false }); // 左右の余白の煙と縁（YHK）。この試遊ページは保存領域に触れない決まりなので設定は読まない
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.addEventListener("pagehide", () => collection?.destroy());
window.addEventListener("pageshow", event => { if (event.persisted) boot(); });
boot();
