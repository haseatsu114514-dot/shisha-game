// 正式な前後の会話と実プレイをつなぐ。得点・練習だけでは読了にしない。
import { state } from "../core/state.js";
import { on } from "../core/bus.js";
import { hiyoriRoute, hiyoriEventStatus, hiyoriEventPrereqsMet } from "../core/hiyori-route.js";
import { play } from "../vn/engine.js";
import { runAxeThrow } from "../minigames/axe.js";
import { bgUrl } from "../core/data.js";
import { setBg } from "../core/ui.js";
import { playBgm, currentBgm } from "../core/audio.js";

export function hiyoriAxeAffordable() {
  const event = hiyoriRoute().events?.find(e => e.id === "axe_reveal");
  // 当日のLIMEの約束を別の遊びで上書きしない。翌日の予約は保持する。
  const booked = state?.pendingInvite && (state.pendingInvite.day ?? state.day) === state.day
    && state.pendingInvite.slot === state.slot;
  return !!event && !!state && state.money >= event.cost && state.stamina > 0 && !booked;
}

export const hiyoriAxeReady = () => hiyoriEventStatus("axe_reveal") === "ready";

/** #1081 B06: ひより前提（時間帯・費用を除く）を満たしたか。前提チェーン自体は現状維持。 */
export const hiyoriAxePrereqsMet = () => hiyoriEventPrereqsMet("axe_reveal");

/** #1081 B06: バイト上がりのスミ会話で露出済みか。露出はこのフラグだけで決まる。 */
export const axeThrowExposed = () => !!state?.flags?._axe_throw_unlocked;

export async function playHiyoriAxeSequence(event, { signal } = {}) {
  const owner = state, abort = new AbortController();
  const current = () => state === owner && !abort.signal.aborted;
  const unsubscribe = on("hud", () => { if (state !== owner) abort.abort(); });
  const cancel = () => abort.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) abort.abort();
  try {
    if (!current()) return false;
    const opening = await play(event.dialogue, { signal: abort.signal });
    if (!current() || opening?.id !== event.dialogue) return false;
    const bgmBefore = currentBgm() || "tonari"; playBgm("bgm_axe"); // #788 実プレイ中だけ斧投げ曲。終了・中断でtonariの曲へ
    const game = await runAxeThrow({ host: document.getElementById("stage"), signal: abort.signal,
      mode: "practice", opponent: "hiyori" }).finally(() => { if (state === owner && currentBgm() === "bgm_axe") playBgm(bgmBefore); });
    if (!current() || !game.completed) return false;
    const ending = await play(event.outro, { signal: abort.signal });
    return current() && ending?.id === event.outro;
  } finally {
    unsubscribe(); signal?.removeEventListener("abort", cancel); abort.abort();
    if (state === owner) await setBg(bgUrl("bg_tonari_inside_night"), { fast: true });
  }
}
