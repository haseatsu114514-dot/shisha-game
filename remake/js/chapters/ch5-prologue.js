// 第5章の冒頭。新しく第5章に入る保存は、つむぎ目線の新人編から始まる（#4253・2026-11-27 オーナー）。
//   面接（章題の前）→ 初日 → ノートの名前（教わった手つきを渡す）→ むせた一口 → C.STATIONの博士 → 先に見ておく → 満席の夜
//   → 三人目（はじめが客として座り、ここで視点がはじめに戻る）→ 店の手（橋渡し）→ 挑戦状（直前に巻頭ポエム）
// つむぎ目線の場面は ch5_main.json の ch5_tsumugi_*（はじめは台本で立ち絵を明示し、つむぎは portrait:false）。
// この並びより前に第5章へ入った保存（_ch5.prologueRoute が無い）は、旧来の橋渡し→帰郷のまま読む。
// ch5_opening は data/story_routes.json の before_match[0]、それより前の場面は opening と一致させる。
export const CH5_TSUMUGI_ROUTE = "tsumugi";
// 章題の前に読む場面（巻頭ポエムは挑戦状の直前へ移した）。
export const CH5_BEFORE_TITLE = "ch5_tsumugi_interview";
export const CH5_PROLOGUE = Object.freeze([
  { id: "ch5_tsumugi_interview", label: "約束の時間", location: "橙須" },
  { id: "ch5_tsumugi_first_day", label: "エプロンの初日", location: "tonari" },
  { id: "ch5_tsumugi_lessons", label: "ノートの名前", location: "tonari" },
  { id: "ch5_tsumugi_cough", label: "一人の昼番", location: "tonari" },
  { id: "ch5_tsumugi_doctor", label: "知らない手", location: "C.STATION" },
  { id: "ch5_tsumugi_look_first", label: "先に見ておく", location: "tonari" },
  { id: "ch5_tsumugi_full_house", label: "満席の夜", location: "tonari" },
  { id: "ch5_tsumugi_third", label: "三人目", location: "tonari" },
  { id: "ch5_shop_hands", label: "店の手", location: "tonari" },
  { id: "ch5_opening", label: "挑戦状", location: "tonari" },
].map(scene => Object.freeze(scene)));
// 旧来の並び。ch4_two_tables の後の橋渡しから、帰国後の挑戦状へ。
export const CH5_LEGACY_PROLOGUE = Object.freeze([
  { id: "ch5_bridge_after_return", label: "ドバイのあと", location: "tonari" },
  { id: "ch5_opening", label: "帰郷", location: "橙須" },
].map(scene => Object.freeze(scene)));

/** 保存（_ch5）が読む冒頭の並び。 */
export const chapterFivePrologue = progress =>
  progress?.prologueRoute === CH5_TSUMUGI_ROUTE ? CH5_PROLOGUE : CH5_LEGACY_PROLOGUE;
