import { el } from "../core/util.js";
import { layers, showScreen } from "../core/ui.js";
import { stopBgm } from "../core/audio.js";
import { mountTrpgCampaign } from "../trpg/campaign-view.js";
import { peekSave } from "../core/state.js";

/** Title reads the saved bookshelf only. All playing/purchasing belongs to the daily bar. */
export function openTrpgRoom(onReturn) {
  const host = el("section.trpg-screen", { "aria-label": "短編TRPGの遊び場" });
  showScreen("trpg", host);
  stopBgm(.2);
  const saved = peekSave();
  const collection = mountTrpgCampaign(host, { getState: () => saved, readOnly: true, closeLabel: "タイトルへ戻る" });
  let leaving = false;
  const observer = new MutationObserver(() => { if (!host.isConnected) cleanup(); });
  function cleanup() {
    leaving = true; observer.disconnect();
    window.removeEventListener("pagehide", pagehide); collection.destroy();
  }
  function pagehide(event) {
    cleanup();
    // Back/forward cache restores the old DOM without booting main.js again.
    if (event.persisted) window.addEventListener("pageshow", () => {
      if (host.isConnected && document.body.dataset.screen === "trpg") onReturn();
    }, { once: true });
  }
  observer.observe(layers.screen, { childList: true });
  window.addEventListener("pagehide", pagehide, { once: true });
  collection.finished.then(() => {
    const current = !leaving && host.isConnected && document.body.dataset.screen === "trpg";
    cleanup();
    if (current) onReturn();
  });
  return collection;
}
