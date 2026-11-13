// ドバイの太陽・シェイクの好感度ルート（2026-11-11 オーナー「ルートを新設」RVE03）。
// ほかの章のライバルと同じく、通うと段階の会話が進み、♥5の次の来店で締めくくり（専用ハガル）を一度だけ読む。
// - 太陽: 第4章のFESTA（大会会場の出張ブース・DAY1〜12）で段階1〜3（審査員だとは明かさない）、
//   第5章のシェイクの屋敷の中庭で段階4・5と締めくくり（大会の後。審査席にいたことはもう知っている）。
//   FESTAは第4章だけなので、第4章の段階1〜3は締めくくりの前提にしない（読めた人だけの前日譚）。
// - シェイク: 第5章の屋敷で段階1〜5と締めくくり。連絡はLIMEではなく手紙（ch5-travel.js）で、段階を読んだ後の手紙が一度ずつ届く。
// 段階の必要ハートは core/affinity-stages.js の DUBAI_BOND_STORIES。ここは DOM を持たない判定と記録だけ。
// 再生・代金・好感度は ch4-dubai-daily.js（FESTA）と ch5-dubai.js（屋敷）。台詞は data/dialogue/taiyo_bond.json・sheikh_bond.json。
import { DUBAI_BOND_FLAG, DUBAI_BOND_STORIES } from "../core/affinity-stages.js";

/** 締めくくりの台詞（daily/bonds.js の BOND_FINALES と同じ id）。 */
export const DUBAI_BOND_FINALES = Object.freeze({ da_silva: "ch5_taiyo_bond_finale", sheikh: "ch5_sheikh_bond_finale" });
/** シェイクの手紙（往復の切符入り）。after の段階を読み終えた後の、次の手紙で一度ずつ届く。finale は締めくくりの後。 */
export const SHEIKH_BOND_LETTERS = Object.freeze([
  Object.freeze({ scene: "ch5_dubai_letter_bond_1", after: "ch5_sheikh_bond_2" }),
  Object.freeze({ scene: "ch5_dubai_letter_bond_2", after: "ch5_sheikh_bond_4" }),
  Object.freeze({ scene: "ch5_dubai_letter_bond_3", finale: "sheikh" }),
]);
/** 台詞ファイルごとの読み込み id。 */
export const TAIYO_BOND_IDS = Object.freeze([...DUBAI_BOND_STORIES.da_silva.map(entry => entry.scene), DUBAI_BOND_FINALES.da_silva]);
export const SHEIKH_BOND_IDS = Object.freeze([...DUBAI_BOND_STORIES.sheikh.map(entry => entry.scene), DUBAI_BOND_FINALES.sheikh,
  ...SHEIKH_BOND_LETTERS.map(letter => letter.scene)]);
/** FESTA（第4章）で読む太陽の段階。 */
export const FESTA_BOND_IDS = Object.freeze(DUBAI_BOND_STORIES.da_silva.filter(entry => entry.where === "festa").map(entry => entry.scene));

const plain = value => value && typeof value === "object" && !Array.isArray(value);

/** 既読の記録（段階・手紙）。壊れた値は空として読む。周回では持ち越さない（core/carry.js の progression）。 */
export function dubaiBondRecord(value) {
  const record = value?.flags?.[DUBAI_BOND_FLAG];
  const read = plain(record) && plain(record.read) ? record.read : {};
  const letters = plain(record) && plain(record.letters) ? record.letters : {};
  return { read, letters };
}

export const dubaiBondRead = (value, scene) => dubaiBondRecord(value).read[scene] === true;

/**
 * その場所で次に読む段階（必要ハートに届いた最古の未読）。無ければ null。
 * where: "festa"（第4章のFESTA）・"courtyard"（第5章の屋敷の中庭）・"residence"（第5章の屋敷）。
 */
export function nextDubaiBondStory(value, id, where, heart = 0) {
  const { read } = dubaiBondRecord(value);
  return (DUBAI_BOND_STORIES[id] || []).find(entry => entry.where === where && read[entry.scene] !== true && heart >= entry.heart)?.scene || null;
}

/** 段階を読み終えた時だけ呼ぶ。知らない場面は記録しない。 */
export function recordDubaiBondRead(value, scene) {
  if (!value?.flags || ![...TAIYO_BOND_IDS, ...SHEIKH_BOND_IDS].includes(scene)) return false;
  const { read, letters } = dubaiBondRecord(value);
  value.flags[DUBAI_BOND_FLAG] = { read: { ...read, [scene]: true }, letters: { ...letters } };
  return true;
}

/** 締めくくりの前提の段階をすべて読んだか（太陽は第5章の段階だけ。FESTAの段階は前日譚なので数えない）。 */
export const dubaiBondStoriesDone = (value, id) => (DUBAI_BOND_STORIES[id] || [])
  .filter(entry => !entry.prelude).every(entry => dubaiBondRead(value, entry.scene));

/** 次に届くシェイクの手紙（届いていない最古のもの）。無ければ null（いつもの手紙が届く）。 */
export function sheikhBondLetterDue(value) {
  const { read, letters } = dubaiBondRecord(value);
  const finaleSeen = id => !!value?.finales?.[id];
  return SHEIKH_BOND_LETTERS.find(letter => letters[letter.scene] !== true
    && (letter.after ? read[letter.after] === true : finaleSeen(letter.finale)))?.scene || null;
}

/** シェイクの手紙を読み終えた（同じ手紙は二度届かない）。 */
export function recordSheikhBondLetter(value, scene) {
  if (!value?.flags || !SHEIKH_BOND_LETTERS.some(letter => letter.scene === scene)) return false;
  const { read, letters } = dubaiBondRecord(value);
  value.flags[DUBAI_BOND_FLAG] = { read: { ...read }, letters: { ...letters, [scene]: true } };
  return true;
}
