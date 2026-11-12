import assert from "node:assert/strict";
import { shiftAchievement, shiftAchievementBonus, shiftBasePay, shiftPayNote } from "../js/core/shift-pay.js";

for (const value of [undefined, {}, { flags: null }, { chapter: 5, phase: "daily", baitoCount: 999 },
  { chapter: 1, tournament: { lastRank: 2, attempts: 10 } },
  { flags: { _ch2_tournament: { result: { rank: 2 }, stage: "defeat" } } },
  { flags: { _ch3_tournament: { result: { rank: 2 } }, _ch3_tournament_won: false } },
  { flags: { _ch4: { match: { result: { rank: 2 } }, read: { ch4_defeat: true } } } },
  { flags: { _ch4_cleared: "true", _ch3_tournament_won: "yes" } }]) {
  assert.equal(shiftAchievement(value), null);
  assert.equal(shiftBasePay(value), 8000);
}
const milestones = [
  [{ flags: { _ch1_cleared: true } }, "local", 1000],
  [{ chapter: 1, phase: "cleared" }, "local", 1000],
  [{ flags: { _ch2_cleared: 1 } }, "prefectural", 2000],
  [{ chapter: 2, phase: "cleared" }, "prefectural", 2000],
  [{ flags: { _ch3_tournament_won: true } }, "asia", 3000],
  [{ flags: { _ch3_cleared: true } }, "asia", 3000],
  [{ flags: { _ch4: { read: { ch4_final: true } } } }, "world", 4000],
  [{ flags: { _ch4_cleared: true } }, "world", 4000],
  [{ flags: { _ch1_cleared: true, _ch2_cleared: true, _ch3_tournament_won: true, _ch4_cleared: true } }, "world", 4000],
];
for (const [value, id, bonus] of milestones) {
  const original = JSON.stringify(value);
  assert.equal(shiftAchievement(value).id, id);
  assert.equal(shiftAchievementBonus(value), bonus);
  assert.equal(shiftBasePay(value), 8000 + bonus);
  assert.equal(shiftBasePay(value, 6000), 6000 + bonus, "mukaiは軽いシフトとの差額を維持");
  assert.equal(shiftBasePay(JSON.parse(original)), 8000 + bonus, "JSON保存・再読でも同じ日当");
  assert.match(shiftPayNote(value), new RegExp((8000 + bonus).toLocaleString("ja-JP")));
  assert.equal(JSON.stringify(value), original, "照会・再読で実績や所持金を変えない");
}
assert.equal(shiftBasePay({ chapter: 1, phase: "daily", flags: {}, cycle: 2 }), 8000, "周回後は前周の実績を推測しない");
// 実際の旧セーブ移行・SAVE/LOADでも実績を読むだけ。差額の遡及入金や新しい記録はない。
{
  const previousStorage = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  try {
    const core = await import("../js/core/state.js");
    const old = core.newState(); old.schema = 27; old.money = 12345;
    old.flags._ch3_tournament_won = true;
    storage.set(core.SAVE_KEY, JSON.stringify(old));
    assert(core.load());
    assert.equal(shiftBasePay(core.state), 11000);
    assert.equal(core.state.money, 12345);
    assert(core.save());
    assert(core.load());
    assert.equal(shiftBasePay(core.state), 11000);
    assert.equal(core.state.money, 12345, "再保存・再読でも過去分を入金しない");
    const fresh = core.newGame();
    assert.equal(shiftBasePay(fresh), 8000, "別の新規保存へ実績を漏らさない");
  } finally { globalThis.localStorage = previousStorage; }
}
console.log("shift pay: confirmed achievements, no chapter/count inference, legacy flags, bounded non-stacking raise, JSON roundtrip and pure display passed");
