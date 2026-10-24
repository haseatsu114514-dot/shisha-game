import { DB } from "../core/data.js";
import { state } from "../core/state.js";
import { play } from "../vn/engine.js";
import { FORTUNE_RUMOR, syncFortuneSchedule } from "../core/fortune-discovery.js";
import { isRainy } from "./weather.js";

export const FORTUNE_RUMOR_SCENE = "ch1_tsumugi_fortune_rumor";
const reading = new WeakMap();

/** 自分で選んだ客席訪問の続きだけ。強制の取材・面識・過去の占いから読了を推測しない。 */
export async function hearFortuneRumor() {
  const owner = state;
  if (owner.flags[FORTUNE_RUMOR]) return true;
  if (reading.has(owner)) return reading.get(owner);
  const dialogue = DB.dialogues[FORTUNE_RUMOR_SCENE];
  if (!dialogue?.lines?.length) return false;
  const task = (async () => {
    const result = await play(FORTUNE_RUMOR_SCENE);
    if (state !== owner || !result || result.cancelled) return false;
    owner.flags[FORTUNE_RUMOR] = true;
    syncFortuneSchedule(owner, isRainy);
    // 訪問の費用・枠・報酬と一緒にcalendarで保存する。進行中の客席訪問を単独保存しない。
    return true;
  })();
  reading.set(owner, task);
  try { return await task; } finally { reading.delete(owner); }
}
