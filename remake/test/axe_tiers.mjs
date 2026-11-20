// 斧投げBarの10投の三段階（#3779・daily/axe-bar-tiers.js と core/play-tiers.js）:
// 段＝部門（初級 レク・中級 アマ・上級 プロ）。クリアはその部門の10投で、初級は B・中級と上級は A ランク以上だけ。
// 3投練習・中断・対戦・レッスンは数えない。閉じた段は開かない・上級の白火は一度だけ・旧保存の取り込み（play-tiers.js の LEGACY.axe）。
import assert from "node:assert/strict";
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const T = await import("../js/core/play-tiers.js");
const { DIVISIONS, MODES } = await import("../js/minigames/axe-model.js");
const { rankOf } = await import("../js/minigames/axe-challenges.js");
const { AXE_TIER_DIVISION, AXE_TIER_PASS, axeTierClear, axeTierLock } = await import("../js/daily/axe-bar-tiers.js");

// 確定した10投の結果（axe.js の runAxeThrow と同じ形の、判定に使う所だけ）
const league = (division, total, extra = {}) => ({ completed: true, cancelled: false, mode: "league", opponent: null, division,
  throwCount: 10, maximum: MODES.league.max, total, throws: Array.from({ length: 10 }, () => ({ score: 0 })), ...extra });
const B_LINE = Math.ceil(MODES.league.max * .45); // 64点満点の .45 ＝ 29点
const A_LINE = Math.ceil(MODES.league.max * .62); // 64点満点の .62 ＝ 40点

// 段と部門: 初級＝レク・中級＝アマ・上級＝プロ。どの段もある部門を指す
assert.deepEqual(Object.keys(AXE_TIER_DIVISION), T.TIERS);
assert.deepEqual(Object.values(AXE_TIER_DIVISION), ["rec", "am", "pro"]);
for (const division of Object.values(AXE_TIER_DIVISION)) assert(DIVISIONS[division], division);
assert.equal(T.TIER_GAMES.axe.clear, "その部門の10投で、初級はB・中級と上級はAランク以上");
assert.deepEqual(AXE_TIER_PASS, { easy: ["S", "A", "B"], normal: ["S", "A"], hard: ["S", "A"] });
assert.equal(axeTierLock("easy"), "");
assert.equal(axeTierLock("normal"), "初級クリアで開く");
assert.equal(axeTierLock("hard"), "中級クリアで開く");

// クリアの線: 初級（レク）は B 以上、中級（アマ）・上級（プロ）は A 以上（axe-challenges.js の RANKS と同じ境目）
assert.equal(B_LINE, 29);
assert.equal(A_LINE, 40);
assert.equal(rankOf(B_LINE, 64), "B");
assert.equal(rankOf(B_LINE - 1, 64), "C");
assert.equal(rankOf(A_LINE, 64), "A");
assert.equal(rankOf(A_LINE - 1, 64), "B");
assert.equal(axeTierClear(league("rec", B_LINE)), "easy");
assert.equal(axeTierClear(league("am", A_LINE)), "normal");
assert.equal(axeTierClear(league("am", A_LINE - 1)), null, "中級の B は数えない");
assert.equal(axeTierClear(league("pro", A_LINE)), "hard");
assert.equal(axeTierClear(league("pro", A_LINE - 1)), null, "上級の B は数えない");
assert.equal(axeTierClear(league("pro", 64)), "hard");
assert.equal(axeTierClear(league("rec", B_LINE - 1)), null, "C は数えない");
assert.equal(axeTierClear(league("pro", 0)), null);
// 数えない結果: 3投練習・中断・ひよりとの対戦・レッスン・投数の足りない記録・知らない部門
assert.equal(axeTierClear({ ...league("rec", 22), mode: "practice", throwCount: 3, maximum: 22, throws: [{}, {}, {}] }), null, "3投練習は段の外");
assert.equal(axeTierClear(league("rec", 60, { completed: false, cancelled: true })), null, "中断");
assert.equal(axeTierClear(league("pro", 60, { opponent: "hiyori", mode: "versus" })), null, "対戦");
assert.equal(axeTierClear(league("pro", 60, { opponent: "hiyori" })), null, "相手がいる10投");
assert.equal(axeTierClear({ ...league("rec", 8), mode: "practice", tutorial: true, throwCount: 1, maximum: 8, throws: [{}] }), null, "レッスン");
assert.equal(axeTierClear(league("rec", 60, { throws: [{}, {}] })), null, "10投そろっていない");
assert.equal(axeTierClear(league("secret", 60)), null);
assert.equal(axeTierClear(null), null);

// 解放: 初級だけが最初から。初級の10投で B → 中級が開き、既定は開いた中でいちばん上。3投練習・C では開かない
{
  const s = core.newState();
  assert.deepEqual(T.openTiers(s, "axe"), ["easy"]);
  assert.equal(T.defaultTier(s, "axe"), "easy");
  assert(!T.tierOpen(s, "axe", "normal") && !T.tierOpen(s, "axe", "hard"), "閉じた段は選べない");
  const tally = r => { const tier = axeTierClear(r); return tier ? T.recordTierClear(s, "axe", tier) : []; };
  assert.deepEqual(tally({ ...league("rec", 22), mode: "practice", throwCount: 3, maximum: 22, throws: [{}, {}, {}] }), []);
  assert.deepEqual(tally(league("rec", B_LINE - 1)), []);
  assert.deepEqual(T.openTiers(s, "axe"), ["easy"], "C と3投練習では中級は開かない");
  assert.equal(s.growth?.playTiers?.axe, undefined, "数えない結果は何も書かない");
  assert.deepEqual(tally(league("rec", B_LINE)), ["easy"]);
  assert.equal(T.tierUnlockNote("axe", ["easy"]), "初級をクリア。中級が開いた。");
  assert.deepEqual(T.openTiers(s, "axe"), ["easy", "normal"]);
  assert.equal(T.defaultTier(s, "axe"), "normal");
  assert.deepEqual(tally(league("rec", 60)), [], "同じ段のクリアは二度目は何も足さない");
  // 選んだ段は次の既定になる。中級（アマ）の A で上級が開く（B では開かない）
  assert(T.rememberTier(s, "axe", "easy"));
  assert.equal(T.defaultTier(s, "axe"), "easy", "選んだ段を覚える");
  assert.deepEqual(tally(league("am", 35)), [], "中級の B では上級は開かない");
  assert.deepEqual(tally(league("am", A_LINE)), ["normal"]);
  assert.deepEqual(T.openTiers(s, "axe"), ["easy", "normal", "hard"]);
  assert.equal(T.tierLine(s, "axe"), "初級✓ 中級✓ 上級— · 上級クリアで白火1");
}

// 上級（プロの10投で A 以上）を初めてクリアしたら白火1つ。もう一度クリアしても、保存／読込でも二度は渡さない
{
  const s = core.newState();
  core.setState(s);
  const g = growth.ensureGrowth();
  const start = g.earned;
  T.recordTierClear(s, "axe", axeTierClear(league("am", A_LINE)));
  assert.equal(g.earned, start, "中級では火種は出ない");
  assert.equal(axeTierClear(league("pro", B_LINE)), null);
  assert.deepEqual(T.recordTierClear(s, "axe", axeTierClear(league("pro", A_LINE))), ["hard"]);
  assert.equal(g.earned - start, 1);
  assert(g.rewards["axe-hard"]);
  assert.match(T.tierUnlockNote("axe", ["hard"]), /斧投げの上級をクリア！ 白火が1つ届く/);
  assert.deepEqual(T.recordTierClear(s, "axe", axeTierClear(league("pro", 64))), []);
  core.save(); core.load(); growth.settleGrowth();
  assert.equal(core.state.growth.earned - start, 1, "二度は渡さない");
}

// 旧保存の取り込み（core/play-tiers.js の LEGACY.axe）: Bar の10投（records.league）の自己ベスト・前回のうち、
// 部門の分かる記録がその段の線（レク .45・アマとプロ .62）以上なら、その段（と下の段）をクリアした証明になる。
const imported = (s) => { T.syncPlayTiers(s); return T.tierRecord(s, "axe").cleared; };
const withRecords = (records) => { const s = core.newState(); s.flags._axe_bar_records = records; return s; };
const entry = (division, total, maximum = 64) => ({ total, maximum, ...(division ? { division } : {}), throws: [] });
assert.deepEqual(imported(core.newState()), []);
assert.deepEqual(imported(withRecords({ league: { plays: 3, best: entry("am", 40), last: entry("rec", 12) } })), ["easy", "normal"], "アマの A は中級まで");
assert.deepEqual(imported(withRecords({ league: { plays: 3, best: entry("am", 39), last: entry("rec", 29) } })), ["easy"], "アマの B は中級の証明にならない（レクの B は初級）");
assert.deepEqual(imported(withRecords({ league: { plays: 2, best: entry("rec", 45), last: entry("pro", 40) } })), ["easy", "normal", "hard"], "前回のプロの A でも上級");
assert.deepEqual(imported(withRecords({ league: { plays: 2, best: entry("pro", 39), last: entry("pro", 20) } })), [], "A に届かないプロの記録は証明にならない");
assert.deepEqual(imported(withRecords({ league: { plays: 1, best: entry(null, 60), last: entry(null, 60) } })), [], "部門の無い古い記録は推測しない");
assert.deepEqual(imported(withRecords({ practice: { plays: 4, best: entry("rec", 22, 22), last: entry("rec", 22, 22) } })), [], "3投練習は段の外");
assert.deepEqual(imported(withRecords({ league: { plays: 1, best: entry("am", 70, 100) } })), ["easy", "normal"]);
assert.deepEqual(imported(withRecords({ league: { plays: 1, best: entry("am", 61, 100) } })), []);
assert.deepEqual(imported(withRecords({ league: { plays: 1, best: entry("am", 30, 0) } })), [], "満点の分からない記録");
assert.deepEqual(imported(withRecords("broken")), []);

console.log("axe_tiers: ok");
