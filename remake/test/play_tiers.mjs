// ミニゲームの三段階（#3779・core/play-tiers.js）: 解放・クリア記録・旧保存の取り込み・上級クリアの白火（一度だけ・周回でも二度渡さない）。
import assert from "node:assert/strict";
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const { on } = await import("../js/core/bus.js");
const { PLAY_REWARDS } = await import("../js/core/growth-board-data.js");
const { buildCarryPackage } = await import("../js/core/carry.js");
const T = await import("../js/core/play-tiers.js");

// 段の名前と、上級クリアの報酬はゲームごとに1つ（白火1）
assert.deepEqual(T.TIERS, ["easy", "normal", "hard"]);
assert.deepEqual(Object.values(T.TIER_LABEL), ["初級", "中級", "上級"]);
for (const game of Object.keys(T.TIER_GAMES)) {
  const rewards = PLAY_REWARDS.filter(r => r.game === game && r.tier);
  assert.equal(rewards.length, 1, `${game}: one tier reward`);
  assert.deepEqual(rewards[0], { ...rewards[0], id: `${game}-hard`, tier: "hard", gift: { any: T.TIER_HARD_GIFT } });
}
assert(!T.TIER_GAMES.trpg, "TRPG has no three tiers");
assert(!T.TIER_GAMES.ichidai, "the card game is on hold");

// 解放: 初級は最初から、上の段は下の段のクリアで
{
  const s = core.newState();
  assert.deepEqual(T.openTiers(s, "desert"), ["easy"]);
  assert.equal(T.defaultTier(s, "desert"), "easy");
  assert.deepEqual(T.recordTierClear(s, "desert", "easy"), ["easy"]);
  assert.deepEqual(T.openTiers(s, "desert"), ["easy", "normal"]);
  assert.deepEqual(T.recordTierClear(s, "desert", "easy"), [], "same clear twice adds nothing");
  assert.equal(T.defaultTier(s, "desert"), "normal", "the highest open tier by default");
  assert(T.rememberTier(s, "desert", "easy"));
  assert.equal(T.defaultTier(s, "desert"), "easy", "the last chosen tier comes back");
  assert.deepEqual(T.recordTierClear(s, "desert", "normal"), ["normal"]);
  assert.deepEqual(T.openTiers(s, "desert"), ["easy", "normal", "hard"]);
  // 上の段のクリアは下の段もクリア済みに数える
  const jump = core.newState();
  assert.deepEqual(T.recordTierClear(jump, "axe", "hard"), ["easy", "normal", "hard"]);
  assert.equal(T.tierLine(jump, "axe"), "初級✓ 中級✓ 上級✓ · 上級クリア済み");
  assert.equal(T.tierLine(core.newState(), "axe"), "初級— 中級— 上級— · 上級クリアで白火1");
  // 知らない段・知らないゲームは記録しない
  assert.deepEqual(T.recordTierClear(s, "trpg", "hard"), []);
  assert.deepEqual(T.recordTierClear(s, "desert", "secret"), []);
  assert.equal(T.tierUnlockNote("desert", ["easy"]), "初級をクリア。中級が開いた。");
  assert.match(T.tierUnlockNote("desert", ["normal", "hard"]), /上級をクリア！ 白火が1つ届く/);
  assert.equal(T.tierUnlockNote("desert", []), null);
}

// 旧保存: 証明できる段だけを取り込む（ラクダの大会の3位以内・DJ のセットの B 以上・サンドボードの勝利＝今の中級）
{
  const old = core.newState();
  old.flags._camel_cups = { rookie: { qualified: true }, standard: { qualified: true, mastered: false }, expert: { qualified: false } };
  old.dj = { sets: { 1: { best: { rank: "B" } }, 2: { best: { rank: "C" } }, 3: { best: { rank: "A" } } }, bestRank: "A" };
  old.desert = { wins: 2, bestRank: "B" };
  T.syncPlayTiers(old);
  assert.deepEqual(T.tierRecord(old, "camel").cleared, ["easy", "normal"]);
  assert.deepEqual(T.tierRecord(old, "dj").cleared, ["easy", "normal", "hard"], "SET 3 at B or better proves the top tier");
  assert.deepEqual(T.tierRecord(old, "desert").cleared, ["easy", "normal"]);
  assert.deepEqual(T.tierRecord(old, "axe").cleared, []);
  const before = JSON.stringify(old.growth.playTiers);
  T.syncPlayTiers(old);
  assert.equal(JSON.stringify(old.growth.playTiers), before, "sync is idempotent");
  const fresh = core.newState();
  T.syncPlayTiers(fresh);
  assert.equal(fresh.growth?.playTiers, undefined, "nothing to import, nothing written (opening a menu must not change the save)");
  // 各ゲームの記録処理は、結果を記録したら（精算の取り込みより先に）recordTierClear で確定する。初めてのクリアの知らせが必ず出る
  fresh.desert = { wins: 1 };
  const seen = [];
  const off = on("play-tier", e => seen.push(e));
  assert.deepEqual(T.recordTierClear(fresh, "desert", "normal"), ["easy", "normal"]);
  off();
  assert.equal(seen.length, 1, "the first clear is announced");
  const after = JSON.stringify(fresh.growth.playTiers);
  T.syncPlayTiers(fresh);
  assert.equal(JSON.stringify(fresh.growth.playTiers), after, "a later import adds nothing");
}

// 上級クリアの白火: その場で一度だけ。保存／読込・周回（NG+）でも二度は渡さない。盤が埋まっていれば架空の+1を出さない
{
  const s = core.newState();
  core.setState(s);
  const g = growth.ensureGrowth();
  const gifts = [], notices = [];
  const offGift = on("hidane-gift", x => gifts.push(x)), offNotice = on("notice", x => notices.push(x.text));
  const start = g.earned;
  T.recordTierClear(s, "desert", "normal");
  assert.equal(g.earned, start, "clearing below the top tier gives no fire");
  T.recordTierClear(s, "desert", "hard");
  assert.equal(g.earned - start, 1, "one white fire for the top tier");
  assert(g.rewards["desert-hard"]);
  assert(notices.includes("サンドボード 上級クリア"));
  T.recordTierClear(s, "desert", "hard");
  growth.settleGrowth();
  assert.equal(g.earned - start, 1, "never twice");
  core.save(); core.load();
  growth.settleGrowth();
  assert.equal(core.state.growth.earned - start, 1, "save/load does not pay again");
  const next = Object.assign(core.newState(), buildCarryPackage(core.state), { cycle: 2 });
  core.setState(next);
  growth.settleGrowth();
  assert.equal(next.growth.earned - start, 1, "NG+ keeps the record and the receipt");
  assert(T.tierCleared(next, "desert", "hard"), "tiers carry over with growth");
  offGift(); offNotice();
  assert(gifts.length >= 1);

  const capped = core.newState();
  core.setState(capped);
  const cg = growth.ensureGrowth();
  cg.earned = growth.BOARD_TOTAL; cg.hidane.any = growth.BOARD_TOTAL;
  T.recordTierClear(capped, "dj", "hard");
  assert(cg.rewards["dj-hard"], "the clear is still recorded as received");
  assert.equal(cg.earned, growth.BOARD_TOTAL, "no fire past the board total");
}

// 旧保存の上級（ラクダの上級大会3位以内）は、次の精算で白火1つ
{
  const old = core.newState();
  old.flags._camel_cups = { rookie: { qualified: true }, standard: { qualified: true, mastered: true }, expert: { qualified: true } };
  core.setState(old);
  const g = growth.ensureGrowth();
  const start = g.earned;
  growth.settleGrowth();
  assert(g.rewards["camel-hard"]);
  assert(g.earned - start >= 1);
}
// てつこは段を持たず、来訪をまたいで溜まる好感度がハート5に届いたら白火1つ（2026-11-20 オーナー「てつこは難易度とかないや」）
{
  assert(!T.TIER_GAMES.tetsuko, "てつこ has no tiers");
  assert(!PLAY_REWARDS.some(r => r.game === "tetsuko" && r.tier));
  const reward = PLAY_REWARDS.find(r => r.id === "tetsuko-heart");
  assert.deepEqual(reward.gift, { any: 1 });
  const tetsuko = await import("../js/minigames/tetsuko-model.js");
  assert.equal(growth.TETSUKO_AFFECTION_FULL, tetsuko.JOY_MAX, "growth's copy of the full-heart value matches the cat's model");
  assert(tetsuko.VISIT_JOY * 4 < tetsuko.JOY_MAX, "one visit cannot fill five hearts (several visits are needed)");
  const { emit } = await import("../js/core/bus.js");
  const s = core.newState();
  core.setState(s);
  const g = growth.ensureGrowth();
  const start = g.earned;
  s.flags._tetsuko_time = { affection: growth.TETSUKO_AFFECTION_FULL - 1 };
  growth.settleGrowth();
  assert(!g.rewards["tetsuko-heart"], "not before five hearts");
  s.flags._tetsuko_time.affection = growth.TETSUKO_AFFECTION_FULL;
  emit("tetsuko-hearts", { state: s, affection: growth.TETSUKO_AFFECTION_FULL, full: true });
  assert(g.rewards["tetsuko-heart"], "settled on the spot");
  assert.equal(g.earned - start, 1);
  growth.settleGrowth();
  assert.equal(g.earned - start, 1, "never twice");
}
// TRPG は三段階にせず、最後の本（サイが立ちはだかる）を初めてクリアしたら白火1つ。ほかの本では出ない
{
  const finale = PLAY_REWARDS.find(r => r.id === "trpg-finale");
  assert.deepEqual(finale.gift, { any: 1 });
  const catalog = JSON.parse((await import("node:fs")).readFileSync(new URL("../../data/trpg_catalog.json", import.meta.url), "utf8"));
  const books = catalog.scenarios || catalog.books || Object.values(catalog).find(Array.isArray);
  assert.equal(books.find(b => b.finale)?.id, finale.scenario, "the reward follows the catalog's final book");
  const s = core.newState();
  core.setState(s);
  const g = growth.ensureGrowth();
  s.trpg.cleared = { "ordinary-cup": { stars: 1 } };
  const start = g.earned;
  growth.settleGrowth();
  assert(!g.rewards["trpg-finale"]);
  s.trpg.cleared[finale.scenario] = { ending: "together", stars: 0, firstEndingPlays: { bad: 1 } };
  growth.settleGrowth();
  assert(g.rewards["trpg-finale"]);
  assert.equal(g.earned - start, 1, "bad still earns the first clear gift");
  s.trpg.cleared[finale.scenario].firstEndingPlays.normal = 2;
  growth.settleGrowth();
  assert.equal(g.earned - start, 1, "a new ending does not issue the finale gift again");
}
// #4195 M-35: 全ミニゲームで同じ言葉（段の開き方・自己ベスト・練習）。閉じた段の札は、ひとつ下の段のクリアを言う
assert.equal(T.PLAY_RULES.tier, "初級は最初から。中級・上級は、ひとつ下の段をクリアすると開く");
assert.match(T.TIER_RULE_LINE, /ひとつ下の段をクリア.*自己ベストは段ごと/);
assert.match(T.PLAY_RULES.practice, /段の外/);
assert.deepEqual(T.TIERS.map(t => T.tierLockNote(t)), ["", "初級クリアで開く", "中級クリアで開く"]);
console.log("play_tiers: ok");
