// TRPGの試遊の「始め方」（TRF21）。本編と同じ決まりで動かすための、最初の状態だけを決める。
// 画面を持たない（単体テストから読める）。試遊そのものは trial.js。
import { syncTrpgStock } from "./campaign.js";

/** 試遊の始め方。どれも本編と同じ決まりで動く（違うのは、最初の状態だけ）。 */
export const TRPG_TRIAL_PRESETS = Object.freeze([
  { id: "ready", label: "夜 · 部員がそろっている", note: "部員の本は買ってある。すぐ卓を囲めます" },
  { id: "fresh", label: "夜 · 部を作ったばかり", note: "部員はまだいない。店の常連と遊ぶ本と、勧誘から" },
  { id: "finale", label: "夜 · 部員の物語を遊び終えた", note: "サイの最後の一冊が入荷しています" },
  { id: "noon", label: "昼 · 本選びと店長の試遊", note: "卓を囲むのは夜。昼は買い物と「七つの灯り」" },
]);

/**
 * まっさらな状態（core/state.js の newState()）を、試遊の始め方に合わせて整えて返す。
 * 部員と本は catalog から決めるので、増減しても追随する。
 */
export function trpgTrialState(state, catalog, preset = "ready") {
  const chapter = Math.max(2, catalog.unlockChapter || 2);
  Object.assign(state, { chapter, phase: "daily", day: 3, slot: preset === "noon" ? 0 : 1, money: 5000 });
  const members = catalog.participants.filter(person => person.interested === true);
  // 知り合いで、部活の話も聞いてある（勧誘の会話を試せる）。店長のチュートリアルは本編と同じに出す。
  for (const person of members) {
    state.met[person.id] = true; state.affinity[person.id] = 66; state.flags[`_trpg_topic_${person.id}`] = true;
  }
  state.trpg.club = { founded: { chapter, day: 1 },
    members: preset === "fresh" ? {} : Object.fromEntries(members.map(person => [person.id, { chapter, day: 2 }])) };
  if (preset === "finale") {
    const finale = catalog.scenarios.find(book => book.finale);
    for (const id of finale?.clearRequires || []) {
      state.trpg.cleared[id] = { chapter, day: 2, gm: "", participants: ["hajime"], ending: "trial", endingTitle: "試遊で遊び終えた",
        variant: "smooth", plan: {}, stars: 2, heat: 6, night: "盛り上がった夜", endingsSeen: ["trial"], plays: 1 };
    }
  }
  syncTrpgStock(state, catalog);
  // 昼は買い物を試せるよう入荷だけ。夜は、入荷している本を買ってある。
  if (preset !== "noon") state.trpg.owned = [...state.trpg.stock];
  return state;
}
