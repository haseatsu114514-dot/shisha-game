import { CITY_BACKGROUNDS } from "../core/city-locations.js";
import { state } from "../core/state.js";
import { knowsTrpgBar } from "../core/trpg-discovery.js";
import { DB } from "../core/data.js";

export const trpgSpot = () => knowsTrpgBar(state) ? {
  id: "trpg_bar", kind: "trpg", label: "ボドゲカフェ", area: "隣町の遊び場", x: 48, y: 27,
  theme: "cafe", glyph: "卓", previewUrl: CITY_BACKGROUNDS.trpg, minChapter: 2,
  desc: "六角サイのボドゲカフェ。夜はTRPG。",
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
  if (!knowsTrpgBar(owner) || owner.phase !== "daily") return { completed: false };
  const { save } = await import("../core/state.js");
  const [{ el }, { layers, showScreen, setBg }, { playBgm }, { mountTrpgCampaign }, { showHud }, { on }] = await Promise.all([
    import("../core/util.js"), import("../core/ui.js"), import("../core/audio.js"),
    import("../trpg/campaign-view.js"), import("./hud.js"), import("../core/bus.js"),
  ]);
  if (state !== owner) return { completed: false };
  const host = el("section.trpg-screen", { "aria-label": "ボドゲカフェのシナリオ棚" });
  const hadHud = document.getElementById("hud")?.classList.contains("show");
  showHud(false);
  await setBg(CITY_BACKGROUNDS.trpg, { instant: true });
  if (state !== owner) return { completed: false };
  showScreen("trpg", host); playBgm("bgm_trpg"); // #788 採用曲。倍率は既定1.0（asset_sources/music/adopted-minigame-bgm-20261020.md）
  if (!owner.flags._intro_sai) {
    const { playIntro } = await import("../vn/intro.js");
    if (state !== owner || !host.isConnected) return { completed: false };
    await playIntro("sai", { override: { display_name: DB.characters.sai.display_name } });
    if (state !== owner || !host.isConnected) return { completed: false };
  }
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
