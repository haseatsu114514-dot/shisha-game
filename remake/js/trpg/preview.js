import { loadTrpgResources, mountTrpg } from "./index.js";

const host = document.getElementById("trpg-app");
const stage = document.getElementById("stage");
const params = new URLSearchParams(location.search);
let controller = null;
let shuttingDown = false;

function fit() {
  const width = window.visualViewport?.width || innerWidth, height = window.visualViewport?.height || innerHeight;
  stage.style.setProperty("--k", String(Math.min(width / 1280, height / 720)));
  const touch = matchMedia("(pointer:coarse)").matches;
  document.getElementById("trpg-rotate").hidden = !(touch && height > width);
}
fit();
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.addEventListener("pagehide", () => { shuttingDown = true; controller?.destroy(); });

try {
  const resources = await loadTrpgResources();
  await document.fonts.ready;
  const mount = () => {
    controller = mountTrpg(host, { ...resources,
      seed: params.has("seed") ? Number(params.get("seed")) : Date.now(),
      profileId: params.get("traveler") || null, closeLabel: "表紙へ戻る",
    });
    window.__trpg = Object.freeze({ snapshot: () => controller.snapshot(), ready: true });
    controller.finished.then(() => { if (!shuttingDown && host.isConnected) mount(); });
  };
  window.addEventListener("pageshow", event => {
    if (event.persisted) { shuttingDown = false; mount(); }
  });
  mount();
} catch (error) {
  host.replaceChildren();
  const note = document.createElement("p");
  note.className = "trpg-loading";
  note.textContent = "卓を用意できませんでした。ページを開き直してください。";
  host.append(note);
  console.error(error);
}
