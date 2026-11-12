// 世界優勝後のtonariの新事業。第5章の日常へ入る前に、初回だけ無料で相談する。
// ch5-progress の場面順・旧セーブのstageを変更しない。専用flagは読了後だけ確定する。
import { state, save, timeOfDay } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { setBg } from "../core/ui.js";
import { readDialogues } from "../core/chapter-data.js";
import { play } from "../vn/engine.js";

export const CATERING_ORIGIN_FLAG = "_intro_ch5_catering_business";
const IDS = Object.freeze(["ch5_catering_business", "ch5_catering_business_recall"]);
let loading = null;
let active = null;

/** 導入前でも、既に届いた旧セーブの依頼・委託・実績はそのまま続けられる。 */
export function hasCateringHistory(value) {
  const record = value?.flags?._ch5_catering;
  return !!record && (record.offers > 0 || !!record.offer || !!record.last
    || Object.values(record.served || {}).some(count => count > 0));
}

export const cateringBusinessOpen = value => value?.flags?.[CATERING_ORIGIN_FLAG] === true || hasCateringHistory(value);

/** 地元で自由行動中だけ。海外や勝負の日のLOADから、tonariへ呼び戻さない。 */
export function cateringBusinessPending(value) {
  const progress = value?.flags?._ch5;
  const region = value?.flags?._ch2_region || "home";
  return value?.chapter === 5 && progress?.part === "free" && !Number.isInteger(progress.matchDay)
    && region === "home" && value?.flags?.[CATERING_ORIGIN_FLAG] !== true;
}

async function loadScenes() {
  if (IDS.every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= readDialogues("ch5_catering_origin", IDS).then(found => {
    for (const id of IDS) DB.dialogues[id] = found[id];
  }).finally(() => { loading = null; });
  await loading;
}

/** true＝読み終えたか対象外。false＝中断/LOAD。読込失敗は章の再試行画面へ返す。行動・体力・報酬は一切変えない。 */
export function introduceCateringBusiness() {
  if (!cateringBusinessPending(state)) return Promise.resolve(true);
  if (active?.owner === state) return active.task;
  const owner = state;
  const entry = { owner, task: null };
  entry.task = readBusiness(owner).finally(() => { if (active === entry) active = null; });
  active = entry;
  return entry.task;
}

async function readBusiness(owner) {
  try { await loadScenes(); } catch (error) {
    if (state !== owner) return false;
    // falseで日常から戻すとfreeの再描画が即座に再試行してしまう。章のエラー画面で再開を待つ。
    throw new Error("新しい仕事の会話を読み込めませんでした。もう一度、続きから再開できます", { cause: error });
  }
  if (state !== owner || !cateringBusinessPending(owner)) return false;
  const { url, tint } = sceneBg(timeOfDay() === "night" ? "bg_tonari_inside_night" : "bg_tonari_inside", timeOfDay());
  await setBg(url, { tint });
  if (state !== owner) return false;
  const result = await play(IDS[hasCateringHistory(owner) ? 1 : 0]);
  if (state !== owner || !result || result.cancelled) return false;
  owner.flags[CATERING_ORIGIN_FLAG] = true;
  save();
  return true;
}
