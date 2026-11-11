// 恋人のましろと mukai で過ごす時間（BLC03）。第3章の東京（ch3-tokyo-daily.js）と第5章の東京（ch5-tokyo.js）の共通部品。
// 地元の恋人のデート（daily/romance.js の playDate）にあたる。ましろは東京に住み、地元のデートに誘ってこないので、
// これが無いと恋人の絆が朝のLIMEでしか増えず、節目の後半（lover_mashiro_lv3〜5）を読む機会が無かった。
// - 一日に一度。短い場面を巡回で読み、デートと同じ量の絆が入る（恋人の絆は core/stats.js で半分になる）。
// - 未読の節目がある日は、短い場面の代わりに節目を読む。絆が次の段に届いた日は、続けて節目を読む（デートの後と同じ）。
// - 行動・体力・経験値は呼び出し側が付ける。話し合いが済んでいない間（_story_shuraba_unresolved）は出さない。
// 台本は data/dialogue/ch3_mashiro.json。節目の判定と再生（chapters/lover-entry.js。端末の画面を読み込む）は呼び出し側から
// 受け取り、ここは DOM に触れない。remake/test/mashiro_time.mjs が node で読み込んで確かめる。
import { state } from "../core/state.js";
import { DB } from "../core/data.js";
import { gainAffinity, privateBondScope } from "../core/stats.js";

export const MASHIRO_TIME_FILE = "ch3_mashiro";
export const MASHIRO_TIME_SCENES = Object.freeze(["mashiro_time_counter", "mashiro_time_train", "mashiro_time_errand", "mashiro_time_braid"]);
export const MASHIRO_TIME_FLAG = "_mashiro_time"; // { count: 読んだ回数, day: 最後に過ごした通算日 }
/** デート1回と同じ（daily/romance.js の playDate）。 */
export const MASHIRO_TIME_BOND = 10;

const record = value => {
  const saved = value?.flags?.[MASHIRO_TIME_FLAG];
  const count = Number.isInteger(saved?.count) && saved.count > 0 ? saved.count : 0;
  return { count, day: Number.isInteger(saved?.day) ? saved.day : null };
};
const isLover = value => (value?.lovers || []).includes("mashiro") && !value.flags?._story_shuraba_unresolved;
/** 今日はもう一緒に過ごしたか。 */
export const mashiroTimeSpentToday = (value = state) => record(value).day === value?.day;
/** 次に読む短い場面（巡回）。 */
export const mashiroTimeScene = (value = state) => MASHIRO_TIME_SCENES[record(value).count % MASHIRO_TIME_SCENES.length];

/**
 * いま mukai で「ましろちゃんと過ごす（恋人）」を選べるか。
 * 今日まだ過ごしていない日と、もう過ごした日でも未読の節目が残っている時。
 * @param opts.milestoneDue 未読の節目があるか（lover-entry.js の loverMilestonesDue(["mashiro"]).length > 0）
 */
export function mashiroTimeOpen(value = state, { milestoneDue = false } = {}) {
  if (!isLover(value)) return false;
  if (milestoneDue) return true;
  return !mashiroTimeSpentToday(value) && !!DB.dialogues[mashiroTimeScene(value)]?.lines?.length;
}

/**
 * 一緒に過ごす。読み終えたら true（途中でやめた・別の保存に替わった時は false で、回数も絆も残さない）。
 * @param io.read (sceneId) => Promise<boolean> 短い場面の読み方（背景は呼び出し側）
 * @param io.milestoneDue () => boolean 未読の節目があるか
 * @param io.readMilestone () => Promise<boolean> 未読の節目を一つ読む（lover-entry.js の readLoverMilestone("mashiro")）
 */
export async function spendMashiroTime({ read, milestoneDue, readMilestone }) {
  const owner = state;
  const startedWithMilestone = !!milestoneDue();
  if (!mashiroTimeOpen(owner, { milestoneDue: startedWithMilestone })) return false;
  const fresh = !mashiroTimeSpentToday(owner);
  if (startedWithMilestone) {
    if (!await readMilestone() || state !== owner) return false;
  } else {
    const restore = privateBondScope();
    try { if (!await read(mashiroTimeScene(owner)) || state !== owner) return false; } finally { restore(); }
  }
  if (fresh) {
    const before = record(owner);
    owner.flags[MASHIRO_TIME_FLAG] = { count: before.count + (startedWithMilestone ? 0 : 1), day: owner.day };
    const restore = privateBondScope();
    try { gainAffinity("mashiro", MASHIRO_TIME_BOND); } finally { restore(); }
  }
  // 絆が次の段に届いたら、その日のうちに節目を読む（地元のデートの後と同じ）。節目から始めた日は一本で終える。
  if (!startedWithMilestone && state === owner && milestoneDue()) await readMilestone();
  return state === owner;
}
