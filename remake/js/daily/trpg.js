import { state } from "../core/state.js";

export const trpgSpot = () => state?.chapter >= 2 ? {
  id: "trpg_bar", kind: "trpg", label: "ボドゲカフェ", area: "隣町の遊び場", x: 48, y: 19,
  theme: "cafe", glyph: "卓", preview: "bg_cafe", minChapter: 2,
  desc: "糸目で微笑む六角サイのボドゲカフェ。昼は店長と無料試遊、夜は仲間とTRPG。入店・部活設立・試遊・本の購入は時間消費なし。TRPGは夜の1枠。",
} : null;

let recruiting = false;
const offered = new WeakMap();
/** Called only after meeting this person. The visit caller saves its action and membership together. */
export async function maybeRecruitTrpgMember(personId) {
  if (recruiting || !state || state.chapter < 2 || state.phase !== "daily" || !state.trpg?.club?.founded
    || state.trpg.club.members?.[personId] || !state.met?.[personId] || ["sumi", "naru"].includes(personId)) return false;
  const owner = state, abort = new AbortController();
  const stamp = `${personId}:${owner.chapter}:${owner.day}:${owner.slot}`;
  if (offered.get(owner)?.has(stamp)) return false;
  const cancel = () => abort.abort();
  window.addEventListener("pagehide", cancel, { once: true });
  recruiting = true;
  let unsubscribe = () => {}, observer;
  try {
    const [{ on }, { layers, toast }, { recruitmentStatus }, { loadTrpgClubResources }, { mountTrpgRecruitment }] = await Promise.all([
      import("../core/bus.js"), import("../core/ui.js"), import("../trpg/campaign.js"),
      import("../trpg/index.js"), import("../trpg/club-view.js"),
    ]);
    unsubscribe = on("hud", () => { if (state !== owner) cancel(); });
    observer = new MutationObserver(cancel); observer.observe(layers.screen, { childList: true });
    let resources;
    try { resources = await loadTrpgClubResources({ signal: abort.signal }); }
    catch { if (!abort.signal.aborted && state === owner) toast("部活の話を準備できませんでした。次に会った時に、もう一度。"); return false; }
    if (state !== owner || abort.signal.aborted
      || !recruitmentStatus(owner, resources.catalog.participants.find(p => p.id === personId), resources.catalog).ok) return false;
    if (!offered.has(owner)) offered.set(owner, new Set());
    offered.get(owner).add(stamp);
    const conversation = mountTrpgRecruitment(document.getElementById("stage"), {
      getState: () => state, personId, ...resources, signal: abort.signal,
    });
    const result = await conversation.finished;
    return result.joined;
  } finally { observer?.disconnect(); unsubscribe(); window.removeEventListener("pagehide", cancel); abort.abort(); recruiting = false; }
}

/** The table saves its completion and night action atomically; calendar must not advance twice. */
export async function openTrpgBar({ nightBusy = () => false } = {}) {
  const owner = state;
  if (!owner || owner.chapter < 2 || owner.phase !== "daily") return { completed: false };
  const { save } = await import("../core/state.js");
  const [{ el }, { layers, showScreen }, { playBgm }, { mountTrpgCampaign }, { showHud }, { on }] = await Promise.all([
    import("../core/util.js"), import("../core/ui.js"), import("../core/audio.js"),
    import("../trpg/campaign-view.js"), import("./hud.js"), import("../core/bus.js"),
  ]);
  if (state !== owner) return { completed: false };
  const host = el("section.trpg-screen", { "aria-label": "ボドゲカフェのシナリオ棚" });
  const hadHud = document.getElementById("hud")?.classList.contains("show");
  showHud(false);
  showScreen("trpg", host); playBgm("bgm_trpg"); // #788 採用曲。倍率は既定1.0（asset_sources/music/adopted-minigame-bgm-20261020.md）
  const controller = mountTrpgCampaign(host, { getState: () => state, save, nightBusy });
  const unsubscribe = on("hud", () => { if (state !== owner) controller.destroy(); });
  const observer = new MutationObserver(() => { if (!host.isConnected) controller.destroy(); });
  const hide = () => controller.destroy();
  observer.observe(layers.screen, { childList: true });
  window.addEventListener("pagehide", hide, { once: true });
  try { return await controller.finished; }
  finally {
    observer.disconnect(); unsubscribe(); window.removeEventListener("pagehide", hide); controller.destroy();
    if (state === owner && host.isConnected && document.body.dataset.screen === "trpg") {
      showHud(hadHud); playBgm("kansetsu_shomei_to_black_coffee");
    }
  }
}
