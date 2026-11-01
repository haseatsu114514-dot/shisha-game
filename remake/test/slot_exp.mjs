// パッキースロット: 図柄が揃ったら経験値（#1281 オーナー指示 2026-10-30）。経験値のしくみが無効なら従来の能力P。
// node --experimental-vm-modules remake/test/slot_exp.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../js/", import.meta.url);
const storage = new Map();
const cards = [];
const context = vm.createContext({ Math, Map, Set, JSON, console, setTimeout: () => 0, clearTimeout() {},
  localStorage: { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) } });
const noop = () => {};
const mocks = {
  "core/util.js": { clamp: (v, a, b) => Math.max(a, Math.min(b, v)), el: noop, sleep: noop },
  "core/ui.js": { layers: {}, gainCard: (o) => cards.push(o), toast: noop },
  "core/data.js": { DB: {}, faceIconUrl: noop },
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

// 1) 経験値のしくみが無効: 今までどおり能力P、経験値は作らない
assert.equal(growth.growthEnabled(), false);
const offRun = rolls(60);
const offStats = plain(core.state.stats);
assert.equal(core.state.growth, undefined, "無効なら growth を作らない");
assert.ok(core.state.reel.pending.some((r) => r.got > 0), "無効なら能力Pが入る");

// 2) 有効: 役・出目・ノートは同じ、能力は伸びず、揃った役の分だけ経験値
growth.setGrowthPreview(true);
assert.equal(growth.growthEnabled(), true);
fresh();
const base = plain(core.state.stats);
const onRun = rolls(60);
assert.deepEqual(onRun.roles, offRun.roles, "役・出目は報酬のしくみで変わらない");
assert.deepEqual(onRun.note, offRun.note, "ノートの記録も同じ");
assert.deepEqual(plain(core.state.stats), base, "有効なら能力Pは足さない");
assert.notDeepEqual(offStats, base, "（比較）無効のときは伸びていた");
const pending = core.state.reel.pending;
let sum = 0;
for (const r of pending) {
  const role = r.overlap || r.role;
  assert.equal(r.got, 0);
  const want = r.quiet ? 0 : (growth.SLOT_EXP[role] || 0); // 第1章は章倍率1
  assert.equal(r.xp, want, `${role} の経験値`);
  sum += r.xp;
}
assert.ok(sum > 0, "当たりがあれば経験値が入る");
assert.equal(core.state.growth.xp, sum, "経験値は抽選の時点で一度だけ入る");
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
  const results = core.state.reel.pending;
  assert.equal(results[0].role, role); assert.equal(results[0].overlap, overlap);
  if (role === "replay") assert(results.length > 1, "リプレイの再遊技は維持");
  const expectedXp = results.reduce((n, r) => n + xpByRole[r.overlap || r.role], 0);
  const expectedPoints = results.reduce((n, r) => n + pointsByRole[r.role] + (r.overlap ? pointsByRole[r.overlap] : 0), 0);
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
  // 旧schemaのSAVE/LOAD、表示前のモード切替でも、確定済みの報酬と待ち列を保持。
  const committed = rewardSnapshot();
  assert(core.save());
  const saved = JSON.parse(storage.get(core.SAVE_KEY)); saved.schema = 21;
  storage.set(core.SAVE_KEY, JSON.stringify(saved));
  core.load();
  assert.deepEqual(rewardSnapshot(), committed, "保存・読込で再付与しない");
  growth.setGrowthPreview(!preview);
  reel.onAction({ spent: 0 });
  assert.deepEqual(rewardSnapshot(), committed, "無料の再表示・モード切替で再抽選しない");
}

// 上限直前は残りだけ、上限到達後は0。能力Pへ戻さず、同じpendingを保持する。
growth.setGrowthPreview(true); fresh();
growth.gainExp(growth.totalExpFor(growth.MAX_LEVEL) - 5, { silent: true });
const atCapStats = plain(core.state.stats), atCapStatXp = plain(core.state.statXp);
for (const expected of [5, 0]) {
  core.state.reel.lock = { count: core.state.reel.count, role: "bell", overlap: null, cue: "green" };
  reel.onAction({ spent: 1 });
  assert.equal(core.state.reel.pending.at(-1).xp, expected);
  assert.equal(core.state.reel.pending.at(-1).got, 0);
  assert.equal(core.state.growth.xp, growth.totalExpFor(growth.MAX_LEVEL));
  assert.deepEqual(plain(core.state.stats), atCapStats);
  assert.deepEqual(plain(core.state.statXp), atCapStatXp);
}

// 3) 章倍率は他の経験値と同じに掛かる
core.newGame();
Object.assign(core.state, { phase: "daily", chapter: 3, day: 3 });
assert.equal(growth.awardSlotExp("big"), Math.round(130 * growth.CHAPTER_MULT[3]));
assert.equal(growth.awardSlotExp("miss"), 0);

// 4) 平均の量（1章30回転で約510、SPEC 1.4 のスロット分 約2割）
let total = 0;
for (let seed = 1; seed <= 200; seed++) {
  core.newGame(); Object.assign(core.state, { phase: "daily", chapter: 1, day: 3 });
  Object.assign(core.state.reel, { installed: true, introDone: true, seed: seed * 7919 });
  for (let i = 0; i < 30; i++) reel.onAction({ spent: 1 });
  total += core.state.growth.xp;
}
const avg = total / 200;
assert.ok(avg > 400 && avg < 650, `1章30回転の平均 ${avg}`);

console.log(`[slot exp] PASS: mode-specific guide, all roles/overlaps/replay, legacy stat P only, preview EXP only, save/load and mode switch keep committed rewards, EXP cap, chapter mult, avg ${Math.round(avg)}/30 spins`);
