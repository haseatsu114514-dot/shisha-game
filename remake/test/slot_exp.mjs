// パッキースロット: 図柄が揃ったら経験値（#1281 オーナー指示 2026-10-30）。経験値のしくみが無効なら従来の能力P。
// node --experimental-vm-modules remake/test/slot_exp.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../js/", import.meta.url);
const storage = new Map();
const context = vm.createContext({ Math, Map, Set, JSON, console, setTimeout: () => 0, clearTimeout() {},
  localStorage: { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) } });
const noop = () => {};
const mocks = {
  "core/util.js": { clamp: (v, a, b) => Math.max(a, Math.min(b, v)), el: noop, sleep: noop },
  "core/ui.js": { layers: {}, gainCard: noop, toast: noop },
  "core/data.js": { DB: {}, faceIconUrl: noop, loadLoverEvents: noop },
  "core/audio.js": { SE: {} },
};
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const path = url.href.slice(root.href.length), values = mocks[path];
  const mod = values ? new vm.SyntheticModule(Object.keys(values), function () {
    for (const [k, v] of Object.entries(values)) this.setExport(k, v);
  }, { context, identifier: url.href }) : new vm.SourceTextModule(fs.readFileSync(url, "utf8"), { context, identifier: url.href });
  modules.set(url.href, mod); return mod;
}
const reelModule = await load(new URL("daily/reel.js", root));
await reelModule.link((specifier, parent) => load(new URL(specifier, parent.identifier)));
await reelModule.evaluate();
const reel = reelModule.namespace;
const ns = (p) => modules.get(new URL(p, root).href).namespace;
const core = ns("core/state.js"), growth = ns("core/growth.js"), { on } = ns("core/bus.js");
const plain = (v) => JSON.parse(JSON.stringify(v));
const rawGains = [];
on("stat-raw", (v) => rawGains.push(v));
const levels = [];
on("level-up", (v) => levels.push(v));

function fresh() {
  core.newGame();
  Object.assign(core.state, { phase: "daily", chapter: 1, day: 3 });
  Object.assign(core.state.reel, { installed: true, introDone: true, seed: 12345 });
}
// 同じシードで回したときの役の列（報酬のしくみに関係なく同じであること）
function rolls(n) {
  fresh();
  for (let i = 0; i < n; i++) reel.onAction({ spent: 1 });
  return { roles: core.state.reel.pending.map((r) => `${r.role}:${r.overlap || ""}:${r.stops.join(",")}`), note: plain(core.state.reel.note) };
}

// 1) ?growth=0 で旧しくみに戻した時: 今までどおり能力P、経験値は作らない（通常プレイの既定は盤が有効。SBD97）
assert.equal(growth.growthEnabled(), true, "既定は有効");
growth.setGrowthPreview(false);
assert.equal(growth.growthEnabled(), false);
const offRun = rolls(60);
const base = plain(core.state.stats);
assert.equal(core.state.growth, undefined, "無効なら growth を作らない");
assert.ok(core.state.reel.pending.every((r) => r.applied === false && r.expMode === false && r.got === undefined));
core.state.reel.pending.forEach(reel.applyReward);
const offStats = plain(core.state.stats);
assert.equal(core.state.growth, undefined, "無効なら growth を作らない");
assert.ok(core.state.reel.pending.some((r) => r.got > 0), "無効なら能力Pが入る");

// 2) 有効: 役・出目・ノートは同じ、能力は伸びず、揃った役の分だけ経験値
growth.setGrowthPreview(true);
assert.equal(growth.growthEnabled(), true);
const onRun = rolls(60);
assert.deepEqual(onRun.roles, offRun.roles, "役・出目は報酬のしくみで変わらない");
assert.deepEqual(onRun.note, offRun.note, "ノートの記録も同じ");
assert.deepEqual(plain(core.state.stats), base, "有効なら能力Pは足さない");
assert.notDeepEqual(offStats, base, "（比較）無効のときは伸びていた");
const pending = core.state.reel.pending;
assert.equal(core.state.growth, undefined, "演出前は経験値が入らない");
assert.ok(pending.every((r) => r.applied === false && r.expMode === true && r.xp === undefined));
let sum = 0;
for (const r of pending) {
  reel.applyReward(r);
  const role = r.overlap || r.role;
  assert.equal(r.got, 0);
  const want = r.quiet ? 0 : (growth.SLOT_EXP[role] || 0); // 第1章は章倍率1
  assert.equal(r.xp, want, `${role} の経験値`);
  sum += r.xp;
}
assert.ok(sum > 0, "当たりがあれば経験値が入る");
assert.equal(core.state.growth.xp, sum, "経験値は適用の時点で一度だけ入る");
assert.equal(core.state.growth.today.learned.pakki_slot, sum, "今日学んだことにスロットとして載る");
assert.equal(growth.SLOT_EXP.miss, undefined);
assert.equal(growth.SLOT_EXP.replay, undefined);

// 説明は初期import時でなく、開いた時のモードを使う。旧説明の配列は書き換えない。
const legacyGuide = plain(reel.GUIDE);
for (const preview of [false, true, false]) {
  growth.setGrowthPreview(preview);
  const tiles = reel.guideTiles();
  const help = tiles.map((g) => `${g.head} ${g.body}`).join("\n");
  if (preview) {
    assert.match(help, /チェリー・ベル・ボーナスで経験値/);
    assert.match(help, /ハズレ・リプレイはなし/);
    assert.doesNotMatch(help, /能力は少し伸びる/);
  } else assert.deepEqual(plain(tiles), legacyGuide);
  for (const g of tiles) assert([...g.body].length <= 40, `遊び方は短く: ${g.body}`);
  assert.deepEqual(plain(reel.GUIDE), legacyGuide, "モード切替で旧説明を変更しない");
}

// 各役・チェリー重複・リプレイ連鎖を、既存の次ゲーム予告の保存形式で確定する。
// 期待値は仕様の表から。旧ポイントと経験値の両方を渡さないことも調べる。
const xpByRole = { miss: 0, replay: 0, cherry: 10, bell: 15, reg: 90, big: 130, rare: 130, freeze: 200 };
const pointsByRole = { miss: 1, replay: 1, cherry: 2, bell: 3, reg: 16, big: 24, rare: 24, freeze: 36 };
const cases = [...Object.keys(xpByRole).map((role) => [role, null]), ["cherry", "reg"], ["cherry", "big"]];
const rewardSnapshot = () => plain({ stats: core.state.stats, statXp: core.state.statXp,
  xp: core.state.growth?.xp || 0, hidane: core.state.growth?.hidane || null,
  count: core.state.reel.count, pending: core.state.reel.pending, note: core.state.reel.note });
for (const preview of [false, true]) for (const [role, overlap] of cases) {
  growth.setGrowthPreview(preview); fresh(); rawGains.length = 0;
  core.state.reel.lock = { count: 0, role, overlap, cue: "green" };
  const statsBefore = plain(core.state.stats), statXpBefore = plain(core.state.statXp);
  reel.onAction({ spent: 1 });
  const committed = rewardSnapshot();
  assert.equal(committed.pending[0].role, role); assert.equal(committed.pending[0].overlap, overlap);
  assert.equal(core.state.growth, undefined);
  assert.deepEqual(committed.stats, statsBefore);
  assert.deepEqual(committed.statXp, statXpBefore);
  assert.deepEqual(rawGains, []);
  assert.ok(committed.pending.every((r) => r.applied === false && r.expMode === preview));

  // 未適用のまま保存・読込し、適用前に成長モードを切り替える。
  assert(core.save());
  assert(core.load());
  growth.setGrowthPreview(!preview);
  reel.onAction({ spent: 0 });
  assert.deepEqual(rewardSnapshot(), committed, "保存・読込・モード切替で再抽選や先払いをしない");
  const results = core.state.reel.pending;
  if (role === "replay") assert(results.length > 1, "リプレイの再遊技は維持");
  const expectedXp = results.reduce((n, r) => n + xpByRole[r.overlap || r.role], 0);
  const expectedPoints = results.reduce((n, r) => n + pointsByRole[r.role] + (r.overlap ? pointsByRole[r.overlap] : 0), 0);
  results.forEach(reel.applyReward);
  const applied = rewardSnapshot();
  assert.ok(results.every((r) => r.applied === true));
  assert.deepEqual(applied.note, committed.note);
  assert.equal(applied.count, committed.count);
  if (preview) {
    assert.equal(core.state.growth?.xp || 0, expectedXp, `${role}/${overlap}: 経験値は一度だけ`);
    assert.deepEqual(plain(core.state.stats), statsBefore, "旧能力の直接加算なし");
    assert.deepEqual(plain(core.state.statXp), statXpBefore, "旧能力の端数も変えない");
    assert.deepEqual(rawGains, [], "旧能力の通知も発火しない");
    for (const r of results) {
      assert.equal(r.xp, xpByRole[r.overlap || r.role]);
      assert.equal(r.got, 0);
      assert.equal(r.target, undefined);
    }
    assert.equal(core.state.growth?.earned || 0, 0, "火種は回転時に直接付与しない");
  } else {
    assert.equal(core.state.growth, undefined);
    const gained = Object.values(core.state.stats).reduce((a, b) => a + b, 0)
      - Object.values(statsBefore).reduce((a, b) => a + b, 0);
    assert.equal(gained, expectedPoints, `${role}/${overlap}: 旧報酬は維持`);
    for (const r of results) assert.equal(r.xp, undefined);
  }
  // 適用直後・保留の除去直前で中断しても、保存された分は二度入らない。
  results.forEach(reel.applyReward);
  assert.deepEqual(rewardSnapshot(), applied);
  assert(core.load()); // applyReward が保存した値をそのまま読む
  core.state.reel.pending.forEach(reel.applyReward);
  assert.deepEqual(rewardSnapshot(), applied, "適用済みの保留はリロード後も二重付与しない");

  if (role === "bell") {
    // 適用済みの旧セーブは、保存時モードや旧schemaの有無にかかわらず現物の報酬を保持する。
    const old = JSON.parse(storage.get(core.SAVE_KEY));
    if (!preview) old.schema = 21;
    for (const r of old.reel.pending) { delete r.applied; delete r.expMode; }
    storage.set(core.SAVE_KEY, JSON.stringify(old));
    assert(core.load());
    assert.ok(core.state.reel.pending.every((r) => r.applied === true));
    const migrated = rewardSnapshot();
    assert.deepEqual(migrated.pending, old.reel.pending.map((r) => ({ ...r, applied: true })));
    core.state.reel.pending.forEach(reel.applyReward);
    assert.deepEqual(rewardSnapshot(), migrated, "旧形式の報酬を二重付与しない");
    for (const k of ["stats", "statXp", "xp", "hidane", "count", "note"]) assert.deepEqual(migrated[k], applied[k]);
  }
}

// 上限直前は残りだけ、上限到達後は0。能力Pへ戻さず、同じpendingを保持する。
growth.setGrowthPreview(true); fresh();
growth.gainExp(growth.totalExpFor(growth.MAX_LEVEL) - 5, { silent: true });
const atCapStats = plain(core.state.stats), atCapStatXp = plain(core.state.statXp);
for (const expected of [5, 0]) {
  core.state.reel.lock = { count: core.state.reel.count, role: "bell", overlap: null, cue: "green" };
  const before = core.state.growth.xp;
  reel.onAction({ spent: 1 });
  const r = core.state.reel.pending.at(-1);
  assert.equal(core.state.growth.xp, before);
  reel.applyReward(r);
  assert.equal(r.xp, expected);
  assert.equal(r.got, 0);
  assert.equal(core.state.growth.xp, growth.totalExpFor(growth.MAX_LEVEL));
  assert.deepEqual(plain(core.state.stats), atCapStats);
  assert.deepEqual(plain(core.state.statXp), atCapStatXp);
}

// 3) 再開が翌日・別章なら適用時の章倍率と日次記録を使う。レベル・火種も適用で入る。
fresh();
growth.gainExp(growth.totalExpFor(2) - 1, { silent: true });
levels.length = 0;
const g = core.state.growth, beforeXp = g.xp, beforeHidane = g.hidane.any;
core.state.reel.lock = { count: 0, role: "big", overlap: null, cue: "green" };
reel.onAction({ spent: 1 });
const big = core.state.reel.pending[0];
assert.equal(g.xp, beforeXp);
assert.equal(g.level, 1);
assert.equal(g.hidane.any, beforeHidane);
assert.equal(levels.length, 0);
Object.assign(core.state, { chapter: 3, day: 4 });
g.today = { xp: 0, learned: {}, gifts: [] };
growth.setGrowthPreview(false);
reel.applyReward(big);
assert.equal(big.xp, Math.round(130 * growth.CHAPTER_MULT[3]));
assert.equal(g.today.learned.pakki_slot, big.xp);
assert.equal(levels.length, 1);
assert.equal(g.level, growth.levelForExp(g.xp));
assert.ok(g.hidane.any > beforeHidane);
reel.applyReward(big);
assert.equal(levels.length, 1);
growth.setGrowthPreview(true);
assert.equal(growth.awardSlotExp("miss"), 0);

// 旧成長の対象は抽選時点で固定し、スロットの加算は次の対象選択に混ぜない。
growth.setGrowthPreview(false); fresh();
const { gainStat } = ns("core/stats.js");
gainStat("sense", 2, { silent: true });
core.state.reel.lock = { count: 0, role: "bell", overlap: null, cue: "green" };
reel.onAction({ spent: 1 });
const bell = core.state.reel.pending[0];
assert.equal(bell.target, "sense");
gainStat("guts", 1, { silent: true });
reel.applyReward(bell);
assert.equal(bell.target, "sense");
reel.onAction({ spent: 1 });
assert.equal(core.state.reel.pending[1].target, "guts");
const forced = { ...bell, applied: false, n: -1 };
core.state.reel.pending.push(forced);
const beforeForce = rewardSnapshot();
reel.applyReward(forced);
assert.deepEqual(rewardSnapshot(), beforeForce, "演出用の偽造結果は報酬対象外");

// 4) 平均の量（1章30回転で約510、SPEC 1.4 のスロット分 約2割）
growth.setGrowthPreview(true);
let total = 0;
for (let seed = 1; seed <= 200; seed++) {
  core.newGame(); Object.assign(core.state, { phase: "daily", chapter: 1, day: 3 });
  Object.assign(core.state.reel, { installed: true, introDone: true, seed: seed * 7919 });
  for (let i = 0; i < 30; i++) reel.onAction({ spent: 1 });
  core.state.reel.pending.forEach(reel.applyReward);
  total += core.state.growth.xp;
}
const avg = total / 200;
assert.ok(avg > 400 && avg < 650, `1章30回転の平均 ${avg}`);

console.log(`[slot exp] PASS: deferred rewards, all roles/overlaps/replay, mode switch, save/load and legacy migration, EXP cap, level-ups, fixed stat target, avg ${Math.round(avg)}/30 spins`);
