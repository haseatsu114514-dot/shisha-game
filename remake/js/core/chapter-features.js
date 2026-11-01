// 章ごとの機能スイッチ。章番号はセーブの数値をそのまま照合する。
// 占いは第1・2章、早期の台譲渡とバイトの伏線登場は第1章のみ。文字列や未定義の章を開放しない。
const CHAPTER_FEATURES = new Map([
  [1, { fortune: true, earlyHomeRig: true, baitoCameos: true }],
  [2, { fortune: true }],
]);

export const chapterFeatureEnabled = (chapter, feature) => CHAPTER_FEATURES.get(chapter)?.[feature] === true;
