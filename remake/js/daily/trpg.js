import { state } from "../core/state.js";

export const trpgSpot = () => state?.chapter >= 2 ? {
  id: "trpg_bar", kind: "trpg", label: "遊べるシーシャバー", area: "仲間の遊び場", x: 8, y: 77,
  theme: "cafe", glyph: "卓", preview: "bg_cafe", minChapter: 2,
  desc: "この店で部活を作り、仲のいい相手を勧誘しよう。部員の空いている夜に物語を囲む。買い物は時間を使わず、卓は夜の1枠。",
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
  recruiting = true;
  let unsubscribe = () => {}, observer;
  try {
    const [{ on }, { layers, toast }, { recruitmentStatus }, { loadTrpgClubResources }, { mountTrpgRecruitment }] = await Promise.all([
      import("../core/bus.js"), import("../core/ui.js"), import("../trpg/campaign.js"),
      import("../trpg/index.js"), import("../trpg/club-view.js"),
    ]);
    const cancel = () => abort.abort();
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
  } finally { observer?.disconnect(); unsubscribe(); abort.abort(); recruiting = false; }
}

/** The table saves its completion and night action atomically; calendar must not advance twice. */
export async function openTrpgBar({ nightBusy = () => false } = {}) {
  const { save } = await import("../core/state.js");
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
