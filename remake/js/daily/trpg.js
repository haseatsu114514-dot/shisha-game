import { state, save } from "../core/state.js";

export const trpgSpot = () => state?.chapter >= 2 ? {
  id: "trpg_bar", kind: "trpg", label: "遊べるシーシャバー", area: "仲間の遊び場", x: 8, y: 77,
  theme: "cafe", glyph: "卓", preview: "bg_cafe", minChapter: 2,
  desc: "新しいTRPGを本棚へ。好感度MAXの仲間を招き、今夜のメンバーに合う物語を一度だけ遊ぶ。買い物は時間を使わず、卓は夜の1枠。",
} : null;

/** The table saves its completion and night action atomically; calendar must not advance twice. */
export async function openTrpgBar({ nightBusy = () => false } = {}) {
  const [{ el }, { layers, showScreen }, { stopBgm, playBgm }, { mountTrpgCampaign }, { showHud }] = await Promise.all([
    import("../core/util.js"), import("../core/ui.js"), import("../core/audio.js"),
    import("../trpg/campaign-view.js"), import("./hud.js"),
  ]);
  const host = el("section.trpg-screen", { "aria-label": "遊べるシーシャバーのシナリオ棚" });
  const hadHud = document.getElementById("hud")?.classList.contains("show");
  showHud(false);
  showScreen("trpg", host); stopBgm(.2);
  const controller = mountTrpgCampaign(host, { getState: () => state, save, nightBusy });
  const observer = new MutationObserver(() => { if (!host.isConnected) controller.destroy(); });
  const hide = () => controller.destroy();
  observer.observe(layers.screen, { childList: true });
  window.addEventListener("pagehide", hide, { once: true });
  try { return await controller.finished; }
  finally {
    observer.disconnect(); window.removeEventListener("pagehide", hide); controller.destroy();
    if (host.isConnected && document.body.dataset.screen === "trpg") {
      showHud(hadHud); playBgm("kansetsu_shomei_to_black_coffee");
    }
  }
}
