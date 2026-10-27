// 無報酬の噂と匿名目撃。完読だけを保存し、ひよりの面識・交流・正式ルートには触れない。
import { state, save } from "../core/state.js";
import { DB } from "../core/data.js";
import { on } from "../core/bus.js";
import { play, isPlaying } from "../vn/engine.js";
import { axeBarRumorDue, axeBarSightingDue } from "../core/axe-bar-discovery.js";

let active = false;

async function readDiscovery(id, due, commit, { signal } = {}) {
  if (active || isPlaying() || signal?.aborted || !due(state) || !DB.dialogues[id]?.lines?.length) return false;
  const owner = state, day = state.day, slot = state.slot, chapter = state.chapter;
  const controller = new AbortController();
  const current = () => state === owner && state.day === day && state.slot === slot && state.chapter === chapter;
  const cancel = () => controller.abort();
  const unsubscribe = on("hud", () => { if (!current()) cancel(); });
  signal?.addEventListener("abort", cancel, { once: true });
  window.addEventListener("pagehide", cancel, { once: true });
  active = true;
  try {
    const result = await play(id, { signal: controller.signal });
    if (result?.cancelled || controller.signal.aborted || !current() || !due(owner)) return false;
    commit(owner, { chapter, day });
    save();
    return true;
  } finally {
    active = false; unsubscribe();
    signal?.removeEventListener("abort", cancel);
    window.removeEventListener("pagehide", cancel);
    cancel();
  }
}

export const playAxeBarRumor = options => readDiscovery("axe_bar_rumor", axeBarRumorDue,
  s => { s.flags._axe_bar_rumor_done = true; }, options);

export const playAxeBarSighting = options => readDiscovery("axe_bar_sighting", axeBarSightingDue,
  (s, date) => {
    s.flags._axe_bar_sighting_done = true;
    s.flags._axe_bar_sighting_day = date.day;
    s.flags._axe_bar_sighting_chapter = date.chapter;
  }, options);
