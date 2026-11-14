// 店頭の応対は交流とは分ける。買い出しで顔を合わせても、2階の試香や♥は進めない。
import { state, markMet } from "../core/state.js";
import { DB } from "../core/data.js";
import { readDialogues } from "../core/chapter-data.js";
import { RIO_AWAY_DAY } from "../core/rules.js";
import { on } from "../core/bus.js";
import { play } from "../vn/engine.js";

const SCENES = ["ch1_shop_rio_first", "ch1_shop_rio_return", "ch1_shop_rio_errand", "ch1_shop_rio_monitor", "ch1_shop_clerk", "ch1_shop_rio_delivery"];
let loading = null;
const inFlight = new WeakMap();
export const rioAcquainted = value => !!(value?.met?.rio || value?.flags?._met_rio || value?.story?.rio > 0 || value?.visits?.rio > 0);

export function shopGreetingScene(value, opts = {}) {
  // 第5章では第1章用の店頭応対を流さない（#3619・オーナー決定）。買い物そのものは通常どおり開く。
  if (value.chapter === 5) return null;
  if (value.day % 7 === RIO_AWAY_DAY) return "ch1_shop_clerk";
  if (!rioAcquainted(value)) return "ch1_shop_rio_first";
  if (opts.errand) return "ch1_shop_rio_errand";
  return value.story?.rio > 0 ? "ch1_shop_rio_monitor" : "ch1_shop_rio_return";
}

function readGreeting(choose, opts) {
  const owner = state;
  if (!owner) return Promise.resolve(false);
  if (inFlight.has(owner)) return inFlight.get(owner);
  const task = (async () => {
    if (!SCENES.every(id => DB.dialogues[id]?.lines?.length)) {
      loading ||= readDialogues("ch1_rio", SCENES).then(scenes => Object.assign(DB.dialogues, scenes))
        .finally(() => { loading = null; });
      await loading;
    }
    if (state !== owner || opts.signal?.aborted) return false;
    const id = choose(owner);
    if (!id) return true;
    // 旧保存に実訪問の記録があるなら、欠けた名前表示だけを修復。初対面の報酬にしない。
    if (rioAcquainted(owner) && !owner.met.rio) markMet("rio", { known: true });
    const controller = new AbortController();
    const abort = () => controller.abort();
    opts.signal?.addEventListener("abort", abort, { once: true });
    // LOAD/newGameはsetStateのhud通知を同期で出す。古いVNが新しい保存へ名乗りを書かない。
    const unlisten = on("hud", () => { if (state !== owner) abort(); });
    try {
      if (state !== owner || opts.signal?.aborted) return false;
      // SKIPは応対を読み飛ばして買い物へ進む。交流・試香の報酬は台本にも付けない。
      const result = await play(id, { signal: controller.signal, ...(opts.bg ? { bg: opts.bg } : {}) });
      return state === owner && !opts.signal?.aborted && !!result && !result.cancelled;
    } finally {
      unlisten();
      opts.signal?.removeEventListener("abort", abort);
    }
  })().finally(() => { inFlight.delete(owner); });
  inFlight.set(owner, task);
  return task;
}

export const greetHomeShop = (opts = {}) => readGreeting(value => shopGreetingScene(value, opts), opts);

/** レモン持越しの周回・DAY1通過済み旧保存の救済。納品中の顔合わせだけで、買い物・試香を強制しない。 */
export function ensureRioBeforeTokyo(opts = {}) {
  if (rioAcquainted(state)) return Promise.resolve(true);
  return readGreeting(value => rioAcquainted(value) ? null : "ch1_shop_rio_delivery", opts);
}
