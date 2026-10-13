import { loadTrpgLibrary, mountTrpg } from "./index.js";
import { mountTrpgLibrary } from "./library.js";
import { createTrpgAudio } from "./audio.js";
import { el } from "../core/util.js";

const host = document.getElementById("trpg-app");
const stage = document.getElementById("stage");
let controller = null;
let shuttingDown = false;
let resources = null, audio = null, request = null, generation = 0;

function fit() {
  const width = window.visualViewport?.width || innerWidth, height = window.visualViewport?.height || innerHeight;
  stage.style.setProperty("--k", String(Math.min(width / 1280, height / 720)));
  const touch = matchMedia("(pointer:coarse)").matches;
  document.getElementById("trpg-rotate").hidden = !(touch && height > width);
}
fit();
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.addEventListener("pagehide", () => {
  shuttingDown = true; generation++; request?.abort(); controller?.destroy(); audio?.destroy();
});

function setScenarioUrl(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("scenario", id); else url.searchParams.delete("scenario");
  history.replaceState(null, "", url);
}
function debug() {
  window.__trpg = Object.freeze({ snapshot: () => controller?.snapshot() || { phase: "loading" },
    audio: () => audio?.snapshot(), ready: true });
}
function library() {
  generation++; controller?.destroy(); setScenarioUrl(null);
  controller = mountTrpgLibrary(host, { ...resources, audio, onChoose: open }); debug();
}
function open(id) {
  const scenario = resources.scenarios.find(s => s.id === id);
  if (!scenario) { library(); return; }
  const ticket = ++generation;
  controller?.destroy(); setScenarioUrl(id);
  const params = new URLSearchParams(location.search);
  const requested = params.get("traveler");
  const profileId = scenario.profiles.some(p => p.id === requested) ? requested : null;
  const mounted = mountTrpg(host, { scenario, characters: resources.characters, manifest: resources.manifest, audio,
    seed: params.has("seed") ? Number(params.get("seed")) : Date.now(), profileId, closeLabel: "本棚へ戻る" });
  controller = mounted; debug();
  mounted.finished.then(result => {
    if (shuttingDown || ticket !== generation || !host.isConnected) return;
    if (result.replayRequested) open(id); else library();
  });
}
async function boot() {
  const ticket = ++generation; shuttingDown = false;
  request?.abort(); request = new AbortController();
  host.replaceChildren(el("div.trpg-loading", [el("span", { text: "小さな卓を用意しています" }), el("small", { text: "背景と、今夜の仲間を迎えています……" })]));
  try {
    resources = await loadTrpgLibrary({ signal: request.signal });
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 6000);
      document.fonts.ready.then(() => { clearTimeout(timer); resolve(); });
    });
    if (shuttingDown || ticket !== generation) return;
    audio = createTrpgAudio();
    const params = new URLSearchParams(location.search);
    const id = params.get("scenario") || (params.has("traveler") || params.has("seed") ? "ordinary-cup" : null);
    if (id) open(id); else library();
  } catch (error) {
    if (shuttingDown || ticket !== generation) return;
    host.replaceChildren(el("div.trpg-loading", [
      el("p", { text: "卓の用意が間に合いませんでした" }),
      el("small", { text: "通信を確認して、もう一度お試しください" }),
      el("button.trpg-button.primary", { type: "button", text: "もう一度用意する", dataset: { test: "trpg-retry-load" }, onclick: boot }),
    ]));
    console.error(error);
  }
}
window.addEventListener("pageshow", event => { if (event.persisted) boot(); });
await boot();
