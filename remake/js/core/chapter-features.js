// 章ごとの機能スイッチ。章番号はセーブの数値をそのまま照合する。
// 占いは従来どおり第1・2章のみ。文字列や未定義の章を開放しない。
const CHAPTER_FEATURES = new Map([
  [1, { fortune: true }],
  [2, { fortune: true }],
]);

export const chapterFeatureEnabled = (chapter, feature) => CHAPTER_FEATURES.get(chapter)?.[feature] === true;
