import { masteryLine } from "../core/play-mastery.js";
import { CITY_BACKGROUNDS } from "../core/city-locations.js";
import { state } from "../core/state.js";
import { knowsTrpgBar } from "../core/trpg-discovery.js";

export const trpgSpot = () => knowsTrpgBar(state) ? {
  id: "trpg_bar", kind: "trpg", label: "ボドゲカフェ", area: "隣町の遊び場", x: 48, y: 27,
  theme: "cafe", glyph: "卓", previewUrl: CITY_BACKGROUNDS.trpg, minChapter: 2,
  desc: "六角サイのボドゲカフェ。夜はTRPG。" + masteryLine(state, "trpg"),
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
      || !recruitmentStatus(owner, resources.catalog.participants.find(p => p.id === personId), resources.catalog, { allowUnheard: true }).ok) return false;
    if (!offered.has(owner)) offered.set(owner, new Set());
    offered.get(owner).add(stamp);
    const conversation = mountTrpgRecruitment(document.getElementById("stage"), {
      getState: () => state, personId, ...resources, signal: abort.signal,
    });
    const result = await conversation.finished;
    return result.joined;
  } finally { observer?.disconnect(); unsubscribe(); window.removeEventListener("pagehide", cancel); abort.abort(); recruiting = false; }
}

/**
 * The table saves its completion and night action atomically; calendar must not advance twice.
 * 本棚の画面の前に、店長サイとのやり取りを読む（VAR02。daily/venue-arrivals.js）: 初めての来店は名乗るまで → 登場カットイン →
 * 店の案内（部活がまだ無ければ、そのままサイの提案へ）。二度目からは来店のたびに一本（昼と夜で別の束。同じ時間帯に入り直した時は読まない）。
 */
export async function openTrpgBar({ nightBusy = () => false } = {}) {
  const owner = state;
  const visitStamp = owner && `${owner.chapter}:${owner.day}:${owner.slot}`;
  const currentVisit = () => state === owner && owner.phase === "daily"
    && `${owner.chapter}:${owner.day}:${owner.slot}` === visitStamp;
  if (!knowsTrpgBar(owner) || owner.phase !== "daily") return { completed: false };
  const { save } = await import("../core/state.js");
  const [{ el }, { layers, showScreen, enterScene, toast }, { playBgm }, { mountTrpgCampaign }, { showHud }, { on }] = await Promise.all([
    import("../core/util.js"), import("../core/ui.js"), import("../core/audio.js"),
    import("../trpg/campaign-view.js"), import("./hud.js"), import("../core/bus.js"),
  ]);
  if (!currentVisit()) return { completed: false };
  const host = el("section.trpg-screen", { "aria-label": "ボドゲカフェのシナリオ棚" });
  const hadHud = document.getElementById("hud")?.classList.contains("show");
  const abort = new AbortController();
  let controller;
  const cancel = () => { abort.abort(); controller?.destroy(); };
  const unsubscribe = on("hud", () => { if (state !== owner) cancel(); });
  const observer = new MutationObserver(() => { if (!host.isConnected) cancel(); });
  window.addEventListener("pagehide", cancel, { once: true });
  try {
    showHud(false);
    await enterScene(CITY_BACKGROUNDS.trpg);
    if (!currentVisit() || abort.signal.aborted) return { completed: false };
    showScreen("trpg", host); playBgm("bgm_trpg"); // #788 採用曲。倍率は既定1.0（asset_sources/music/adopted-minigame-bgm-20261020.md）
    observer.observe(layers.screen, { childList: true });
    const [{ play }, { DB }, arrivals] = await Promise.all([
      import("../vn/engine.js"), import("../core/data.js"), import("./venue-arrivals.js"),
    ]);
    const alive = () => currentVisit() && !abort.signal.aborted && host.isConnected;
    // 会話は正常に読み終えた時だけ true。中断・LOAD は false。
    const read = async scene => {
      const result = await play(scene, { signal: abort.signal });
      return alive() && !!result && !result.cancelled;
    };
    const venue = owner.slot === 0 ? "trpg_day" : "trpg_night";
    let library = null;
    await arrivals.readyArrivals();
    if (!alive()) return { completed: false };
    const introduced = !!owner.flags._intro_sai;
    if (!introduced) {
      const { playIntro } = await import("../vn/intro.js");
      if (!alive()) return { completed: false };
      const scene = id => DB.dialogues[id]?.lines?.length ? DB.dialogues[id] : null;
      // 台本を読めなかった時は、これまでどおり一言だけで紹介へ進む
      const first = scene(owner.slot === 0 ? "trpg_cafe_first_visit_day" : "trpg_cafe_first_visit_night")
        || { lines: [{ speaker: "hajime", text: "こんばんは。遊べる卓を探していて" }] };
      if (!await read(first)) return { completed: false };
      await playIntro("sai");
      if (!alive()) return { completed: false };
      const after = scene("trpg_cafe_first_visit_after");
      // 部活がまだ無い時だけ、サイの提案へつなぐ二行を足す
      const lead = !owner.trpg?.club?.founded ? scene("trpg_cafe_first_visit_lead") : null;
      if (after && !await read({ ...after, lines: [...after.lines, ...(lead?.lines || [])] })) return { completed: false };
      arrivals.markArrival(venue, owner);
    }
    if (!owner.trpg?.club?.founded) {
      const [{ loadTrpgClubResources }, { playTrpgClubFounding }] = await Promise.all([
        import("../trpg/index.js"), import("../trpg/club-event.js"),
      ]);
      let resources;
      try { resources = await loadTrpgClubResources({ signal: abort.signal }); }
      catch {
        if (!abort.signal.aborted && state === owner) toast("部活の話を準備できませんでした。次に訪れた時に、もう一度。");
        return { completed: false };
      }
      const ready = await playTrpgClubFounding({ getState: () => state, ...resources, play, save,
        signal: abort.signal, isCurrent: () => currentVisit() && host.isConnected });
      if (!ready) return { completed: false };
    } else if (introduced && !arrivals.arrivalsOff() && !arrivals.arrivalGreeted(venue, owner)) {
      // 夜は、今夜そのまま卓を囲める時だけ席へ案内する（予定がある・顔ぶれや本が足りない夜は、その話にする）。
      // 本棚の資料はここで読み、そのまま本棚の画面へ渡す（二度読まない）。読めなければ本棚の画面が読み直す。
      let idle = false;
      if (venue === "trpg_night") {
        try {
          const [{ loadTrpgLibrary }, { syncTrpgStock, tablePlayableTonight }] = await Promise.all([import("../trpg/index.js"), import("../trpg/campaign.js")]);
          library = await loadTrpgLibrary({ signal: abort.signal, preloadAssets: false });
          if (!alive()) return { completed: false };
          // 入荷は本棚の画面と同じ確定（部員が増えた後の最初の来店）。先に済ませて、今夜の本があるかを正しく見る
          if (syncTrpgStock(owner, library.catalog)) save();
          idle = !tablePlayableTonight(owner, library.catalog, library.scenarios, { nightBusy: nightBusy() });
        } catch { library = null; }
        if (!alive()) return { completed: false };
      }
      await arrivals.playArrival(venue, { read, save: owner, ctx: { idle } });
    }
    if (abort.signal.aborted || !currentVisit() || !host.isConnected) return { completed: false };
    controller = mountTrpgCampaign(host, { getState: () => state, save, nightBusy, signal: abort.signal, resources: library,
      greeted: arrivals.arrivalGreeted(venue, owner) });
    return await controller.finished;
  } finally {
    observer.disconnect(); unsubscribe(); window.removeEventListener("pagehide", cancel); cancel();
    if (state === owner && host.isConnected && document.body.dataset.screen === "trpg") {
      showHud(hadHud); playBgm("kansetsu_shomei_to_black_coffee");
    }
  }
}

