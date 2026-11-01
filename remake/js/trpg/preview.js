import { mountTrpgCollection } from "./collection.js";

const host = document.getElementById("trpg-app");
const stage = document.getElementById("stage");
let collection = null;

function fit() {
  const width = window.visualViewport?.width || innerWidth, height = window.visualViewport?.height || innerHeight;
  stage.style.setProperty("--k", String(Math.min(width / 1280, height / 720)));
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
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.addEventListener("pagehide", () => collection?.destroy());
window.addEventListener("pageshow", event => { if (event.persisted) boot(); });
boot();
