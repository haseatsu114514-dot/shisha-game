// 龍龍水煙所のドバイの店（2026-11-02 オーナー「ドバイ編でマスターフーカーの店に行けたり」「普通に他の章のライバルと同じ扱い」）。
// 王煙楼の店（中国伝統の水煙文化の老舗。本店は中国のまま）が、世界大会に合わせてドバイに出している店。第4章ドバイの
// 日常（DAY1〜12）の地図に最初から出る。ほかの章のライバルの店と同じく、来店（専門店の一台6,000円）で好感度と能力が少し上がり、
// 通うと段階の会話が進む（必要ハートは core/affinity-stages.js の LONGLONG_VISIT_STORIES・5本で♥5）。段階を読み終えた後は
// 小会話を巡回する。先に店で会っていれば、前夜祭（ch4_wang_reception）は顔見知りとして迎える（面識 state.met で分ける）。
// ここは DOM を持たない判定と記録だけ。再生・代金・好感度は ch4-dubai-daily.js。台詞は data/dialogue/ch4_longlong.json。
import { LONGLONG_VISIT_STORIES } from "../core/affinity-stages.js";

/** 来店の記録（段階の既読・小会話の回数）。周回では持ち越さない（core/carry.js の progression）。 */
export const LONGLONG_FLAG = "_ch4_longlong";
export const LONGLONG_CHAR = "master_hookah";
/** 段階を読み終えた後の通い（小会話）。順に巡回する。 */
export const LONGLONG_TALKS = Object.freeze(["ch4_longlong_visit_b", "ch4_longlong_visit_c"]);
export const LONGLONG_IDS = Object.freeze([...LONGLONG_VISIT_STORIES.map(entry => entry.scene), ...LONGLONG_TALKS]);
/** 締めくくり（♥5の次の来店。段階列には入れず、daily/bonds.js から読む）。 */
export const LONGLONG_FINALE = "ch4_longlong_bond_finale";
export const LONGLONG_LOAD_IDS = Object.freeze([...LONGLONG_IDS, LONGLONG_FINALE]);
/** 店の背景は仮置き（龍龍水煙所のドバイの店の絵が無い。届いたらここだけ直す）。 */
export const LONGLONG_BG = "bg_hideaway";

export function longlongRecord(value) {
  const record = value?.flags?.[LONGLONG_FLAG];
  const ok = record && typeof record === "object" && !Array.isArray(record);
  const read = ok && record.read && typeof record.read === "object" && !Array.isArray(record.read) ? record.read : {};
  const talks = ok && Number.isInteger(record.talks) && record.talks >= 0 ? record.talks : 0;
  return { read, talks };
}

/**
 * 次の来店で読む場面。必要ハートに届いた最古の未読の段階（kind: "story"）、無ければ小会話（kind: "talk"）。
 * heart は今の好感度（♥0〜5）。保存は変えない。
 */
export function nextLonglongVisit(value, heart = 0) {
  const { read, talks } = longlongRecord(value);
  const story = LONGLONG_VISIT_STORIES.find(entry => read[entry.scene] !== true && heart >= entry.heart);
  if (story) return { id: story.scene, kind: "story" };
  return { id: LONGLONG_TALKS[talks % LONGLONG_TALKS.length], kind: "talk" };
}

/** まだ読んでいない段階の会話が、今のハートで読めるか（地図の「新しいイベント」の印）。 */
export const longlongHasNew = (value, heart = 0) => nextLonglongVisit(value, heart).kind === "story";

/** 段階の会話をすべて読んだか。 */
export const longlongStoriesDone = value => LONGLONG_VISIT_STORIES.every(entry => longlongRecord(value).read[entry.scene] === true);

/** 来店の場面を読み終えた時だけ呼ぶ。段階は既読に、小会話は回数を一つ進める。 */
export function recordLonglongVisit(value, visit) {
  if (!value?.flags || !visit || !LONGLONG_IDS.includes(visit.id)) return false;
  const { read, talks } = longlongRecord(value);
  value.flags[LONGLONG_FLAG] = visit.kind === "story"
    ? { read: { ...read, [visit.id]: true }, talks }
    : { read: { ...read }, talks: talks + 1 };
  return true;
}
