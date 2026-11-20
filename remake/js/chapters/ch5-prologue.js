// プロローグ。橋渡しの位置は※仮置き（CH4-CONNECTION-DESIGN。ch4_two_tables の後という説もある）。
// ch5_opening は data/story_routes.json の before_match[0] と一致させる。
export const CH5_PROLOGUE = Object.freeze([
  { id: "ch5_bridge_after_return", label: "ドバイのあと", location: "tonari" },
  { id: "ch5_opening", label: "帰郷", location: "橙須" },
].map(scene => Object.freeze(scene)));
