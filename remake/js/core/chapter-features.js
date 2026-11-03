// 章ごとの機能スイッチ。章番号はセーブの数値をそのまま照合する。
// 占いは第1〜5章（第3章は出発前の準備と東京、第4章は出発前の準備だけ。現れる時間帯は daily/fortune-schedule.js）、ひよりの日常（寄り道・問い）は第1・2章、LINEの画像・スタンプは第1〜3章、あげはの通いは第2章、ましろの絆は第3章、サメちゃんの恋愛は第2・3章、早期の台譲渡とバイトの伏線登場は第1章のみ。文字列や未定義の章を開放しない。
// 友人LIME: 日常の朝は第1・2・5章、旧場面カードの入口は第3〜5章。第5章の朝は雑談だけ。
const CHAPTER_FEATURES = new Map([
  [1, { fortune: true, earlyHomeRig: true, baitoCameos: true, hiyoriDaily: true, lineMedia: true, friendDailyLime: true }],
  [2, { fortune: true, hiyoriDaily: true, lineMedia: true, agehaVisit: true, samechanRomance: true, friendDailyLime: true }],
  [3, { fortune: true, lineMedia: true, mashiroBond: true, samechanRomance: true, friendSceneLime: true }],
  [4, { fortune: true, friendSceneLime: true }],
  [5, { fortune: true, friendDailyLime: true, friendSceneLime: true, friendChatOnly: true }],
]);

export const chapterFeatureEnabled = (chapter, feature) => CHAPTER_FEATURES.get(chapter)?.[feature] === true;

