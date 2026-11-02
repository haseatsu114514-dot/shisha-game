// 章ごとの機能スイッチ。章番号はセーブの数値をそのまま照合する。
// 占いは第1・2章、ひよりの日常（寄り道・問い）は第1・2章、LINEの画像・スタンプは第1〜3章、あげはの通いは第2章、ましろの絆は第3章、サメちゃんの恋愛は第2・3章、早期の台譲渡とバイトの伏線登場は第1章のみ。文字列や未定義の章を開放しない。
const CHAPTER_FEATURES = new Map([
  [1, { fortune: true, earlyHomeRig: true, baitoCameos: true, hiyoriDaily: true, lineMedia: true }],
  [2, { fortune: true, hiyoriDaily: true, lineMedia: true, agehaVisit: true, samechanRomance: true }],
  // 第3章も出発前の準備期間（3日）は柚ヶ谷のMELTY PUFFへ通える（VOL02。東京にいる間は店が地図に無い）。
  [3, { lineMedia: true, mashiroBond: true, samechanRomance: true, agehaVisit: true }],
]);

export const chapterFeatureEnabled = (chapter, feature) => CHAPTER_FEATURES.get(chapter)?.[feature] === true;
