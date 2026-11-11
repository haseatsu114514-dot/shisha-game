// 第4章のドバイで、同じ便で来た恋人（同行者）と宿で過ごす時間（BLC08）。
// 別便で来る恋人には到着の場面と夕方の場面があるのに、同行者にはドバイの12日間に固有の場面が無かった。
// - 宿で「（名前）と過ごす（同行）」を一日に一度選べる。その人の二本を順に読み、読み切ったら出さない
// - デート1回と同じ量の絆が入る（恋人の絆は core/stats.js で半分。ドバイでは節目 lover_events は読まない・IR17）
// - 話し合いの済んでいない保存（_story_shuraba_unresolved）・恋人でなくなった相手には出さない
// 台本は data/dialogue/ch4_companion.json（ch4_companion_<id>_1・_2）。行動・体力は呼び出し側（ch4-dubai-daily.js の宿）が持つ。
// DOM に触れないので、remake/test/companion_time.mjs が node で読み込んで確かめる。
import { state } from "../core/state.js";
import { DB } from "../core/data.js";
import { gainAffinity, privateBondScope } from "../core/stats.js";
import { OVERSEAS_HEROINES, overseasCompanion } from "../core/overseas-companion.js";

export const COMPANION_TIME_FILE = "ch4_companion";
export const COMPANION_TIME_SCENES = Object.freeze(Object.fromEntries(OVERSEAS_HEROINES.map(id =>
  [id, Object.freeze([`ch4_companion_${id}_1`, `ch4_companion_${id}_2`])])));
export const COMPANION_TIME_IDS = Object.freeze(Object.values(COMPANION_TIME_SCENES).flat());
export const COMPANION_TIME_FLAG = "_ch4_companion_time"; // { read: [読んだ場面], day: 最後に過ごした通算日 }
/** デート1回と同じ（daily/romance.js の playDate）。 */
export const COMPANION_TIME_BOND = 10;

const record = value => {
  const saved = value?.flags?.[COMPANION_TIME_FLAG];
  const read = Array.isArray(saved?.read) ? saved.read.filter(id => COMPANION_TIME_IDS.includes(id)) : [];
  return { read, day: Number.isInteger(saved?.day) ? saved.day : null };
};
/** 今の同行者（恋人のままの時だけ）。いなければ null。 */
export function companionLover(value = state) {
  const id = overseasCompanion(value).companion;
  return id && (value?.lovers || []).includes(id) ? id : null;
}
/** 次に読む同行者の場面。読み切っていれば null。 */
export function companionTimeScene(value = state) {
  const id = companionLover(value);
  if (!id) return null;
  const { read } = record(value);
  return COMPANION_TIME_SCENES[id].find(scene => !read.includes(scene)) || null;
}
/** いま宿で「（名前）と過ごす（同行）」を選べるか。第4章・今日まだ過ごしていない・台本が読めている時。 */
export function companionTimeOpen(value = state) {
  if (value?.chapter !== 4 || value.flags?._story_shuraba_unresolved) return false;
  const scene = companionTimeScene(value);
  return !!scene && record(value).day !== value.day && !!DB.dialogues[scene]?.lines?.length;
}

/**
 * 一緒に過ごす。読み終えたら true（途中でやめた・別の保存に替わった時は false で、既読も絆も残さない）。
 * @param io.read (sceneId) => Promise<boolean> 場面の読み方（背景は呼び出し側）
 */
export async function spendCompanionTime({ read }) {
  const owner = state;
  if (!companionTimeOpen(owner)) return false;
  const id = companionLover(owner), scene = companionTimeScene(owner);
  const restore = privateBondScope();
  try { if (!await read(scene) || state !== owner) return false; } finally { restore(); }
  owner.flags[COMPANION_TIME_FLAG] = { read: [...record(owner).read, scene], day: owner.day };
  const scope = privateBondScope();
  try { gainAffinity(id, COMPANION_TIME_BOND); } finally { scope(); }
  return true;
}
