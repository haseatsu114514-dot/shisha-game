// 章ごとの機能スイッチ。章番号はセーブの数値をそのまま照合する。
// 占いは第1〜5章（第3章は出発前の準備と東京、第4章は出発前の準備だけ。現れる時間帯は daily/fortune-schedule.js）、ひよりの日常（寄り道・問い）は第1・2章、LINEの画像・スタンプは第1〜3章、あげはの通いは第2章、ましろの絆は第3章、サメちゃんの恋愛は第2・3章、早期の台譲渡とバイトの伏線登場は第1章のみ。文字列や未定義の章を開放しない。
// 友人LIME: 日常の朝は第1・2・5章、旧場面カードの入口は第3〜5章。第5章の朝は雑談だけ。
// ひよりの地元外出とスミの本筋シフト（DAY3/8・大会前まで）は第1章のみ。
// くゆりの地元外出（問屋街の豆屋）は第1・2章、綾取の締めくくり（煙幕）は第3章、つむぎの締めくくりを本筋の応募節目で待たせるゲートは第1章のみ。
const CHAPTER_FEATURES = new Map([
  [1, { fortune: true, earlyHomeRig: true, baitoCameos: true, hiyoriDaily: true, hiyoriHomeOuting: true, rinHomeOuting: true, sumiStoryShifts: true, tsumugiContestGate: true, lineMedia: true, friendDailyLime: true }],
  [2, { fortune: true, hiyoriDaily: true, rinHomeOuting: true, lineMedia: true, agehaVisit: true, samechanRomance: true, friendDailyLime: true }],
  [3, { fortune: true, lineMedia: true, mashiroBond: true, kuzeBond: true, samechanRomance: true, friendSceneLime: true }],
  [4, { fortune: true, friendSceneLime: true }],
  [5, { fortune: true, friendDailyLime: true, friendSceneLime: true, friendChatOnly: true }],
]);

export const chapterFeatureEnabled = (chapter, feature) => CHAPTER_FEATURES.get(chapter)?.[feature] === true;

