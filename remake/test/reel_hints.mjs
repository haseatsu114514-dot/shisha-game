// パッキースロットの設定示唆・説明・示唆履歴（#634）。
// node --experimental-vm-modules remake/test/reel_hints.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../js/", import.meta.url);
const storage = new Map();
const context = vm.createContext({ Math, Map, Set, JSON, console, setTimeout: () => 0, clearTimeout() {},
  localStorage: { setItem: (k, v) => storage.set(k, v), getItem: (k) => storage.get(k) || null } });
const noop = () => {};
const mocks = {
  "core/util.js": { clamp: (v, a, b) => Math.max(a, Math.min(b, v)), el: noop, sleep: noop },
  "core/ui.js": { layers: {}, gainCard: noop, toast: noop },
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
  modules.set(url.href, mod); await mod.link((s) => load(new URL(s, url))); return mod;
}
const reelModule = await load(new URL("daily/reel.js", root)); await reelModule.evaluate();
const reel = reelModule.namespace;
const core = modules.get(new URL("core/state.js", root).href).namespace;
// vm の別領域で作られた配列・オブジェクトを、比べる前に普通の値へ
const plain = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);

// schema9以前の導入記録は初回LOADから会話条件も揃う。現行の欠落補完も維持。
for (const schema of [8, 9, core.SCHEMA]) for (const evidence of ["none", "installed", "introDone", "count", "pending", "visit"]) {
  const source = core.newState(); source.schema = schema;
  if (evidence === "visit") source.spotVisits = { c_station: 1 };
  else if (evidence !== "none") source.reel[evidence] = evidence === "pending" ? [{ id: "legacy" }] : evidence === "count" ? 1 : true;
  for (const key of [core.SAVE_KEY, "suien_remake_slot1"]) {
    storage.set(key, JSON.stringify(source));
    const loaded = key === core.SAVE_KEY ? core.load() : core.loadFromSlot(key);
    const expected = schema < 10 ? !["none", "installed"].includes(evidence) : evidence === "installed";
    assert.equal(loaded.reel.installed, expected, `${schema}/${evidence}/${key}`);
    assert.equal(loaded.flags.pakki_app_installed === true, expected, "first LOAD must agree with installed");
    core.save(); core.load();
    assert.equal(core.state.flags.pakki_app_installed === true, expected, "second LOAD must stay consistent");
  }
}
storage.clear();

// 専用リーチ目は実配列の中段位置。見本の n=-1 も有効で、決定的に選べる。
const stripsBefore = JSON.stringify(reel.core.STRIPS);
for (const n of [-1, 0, 1, 5, 20, 21, 127, 10000]) {
  const stops = reel.reachStops(n);
  assert.equal(stops.length, 3);
  stops.forEach((index, i) => {
    assert(Number.isInteger(index) && index >= 0 && index < reel.core.STRIPS[i].length, `reach index: n=${n}, reel=${i}`);
  });
  eq(stops.map((index, i) => reel.core.STRIPS[i][index]), ["replay", "replay", "pakki"]);
  eq(reel.reachStops(n), stops, `reach is deterministic: n=${n}`);
}
assert.equal(JSON.stringify(reel.core.STRIPS), stripsBefore, "リーチ目生成は配列を変更しない");
for (let seed = 1; seed <= 128; seed++) {
  const stops = reel.core.stopsFor("miss", reel.core.mulberry32(seed));
  assert.equal(reel.core.STRIPS[0][stops[0]], "smoke", "ハズレの左は煙でリーチ目と区別できる");
}

// 左リールのBAR狙い（#1281 K01・見た目だけ）: ハズレの多くで左の窓にBARが見え、チェリーは見えない
{
  const left = reel.core.STRIPS[0], n = left.length;
  let barShown = 0;
  const seeds = 2000;
  for (let seed = 1; seed <= seeds; seed++) {
    const stops = reel.core.stopsFor("miss", reel.core.mulberry32(seed));
    const window = [left[(stops[0] - 1 + n) % n], left[stops[0]], left[(stops[0] + 1) % n]];
    assert.equal(window[1], "smoke", "BAR狙いでも中段は煙");
    assert(!window.includes("cherry"), `ハズレの左の窓にチェリーを出さない: seed=${seed}`);
    if (window.includes("bar")) {
      assert.equal(window[2], "bar", "BARは下段（上段・中段だとチェリーが窓に入る）");
      barShown++;
    }
  }
  assert(barShown / seeds >= 0.65 && barShown / seeds <= 0.9, `ハズレの大半で左にBARが見える: ${barShown / seeds}`);
  assert.equal(reel.core.LEFT_BAR_AIM, 0.7);
}

// 最近の不調の補い（#1281 オーナー決定）: 直近30回転の当たりが2回なら×1.25、1回以下なら×1.5。
// 30回転そろうまでは無効。生涯の裏確変（×2.5）とは掛け合わせず大きい方だけ。
{
  const { slumpMult, effectiveTable, SLUMP, RESCUE } = reel.core;
  eq(SLUMP, { window: 30, steps: [{ maxHits: 1, mult: 1.5 }, { maxHits: 2, mult: 1.25 }] });
  const recentWith = (hits, length = 30) => Array.from({ length }, (_, i) => (i < hits ? 1 : 0));
  assert.equal(slumpMult({ recent: undefined }), 1, "旧セーブ（記録なし）は補わない");
  assert.equal(slumpMult({ recent: recentWith(0, 29) }), 1, "30回転そろうまでは補わない");
  assert.equal(slumpMult({ recent: recentWith(0) }), 1.5);
  assert.equal(slumpMult({ recent: recentWith(1) }), 1.5);
  assert.equal(slumpMult({ recent: recentWith(2) }), 1.25);
  assert.equal(slumpMult({ recent: recentWith(3) }), 1, "期待値どおりなら補わない");
  assert.equal(slumpMult({ recent: [...recentWith(3), ...recentWith(0)] }), 1.5, "古い当たりは窓から外れる");
  assert.equal(slumpMult({ recent: ["1", null, 2, ...recentWith(1)] }), 1.5, "壊れた値は数えない");
  const weights = (st) => Object.fromEntries(effectiveTable(st).map((r) => [r.id, r.weight]));
  const base = { count: 100, missRun: 0, bonusGap: 3, zoneLeft: 0, bonusCount: 12, freezeCount: 1, setting: 3 };
  const plainW = weights(base);
  const slumpW = weights({ ...base, recent: recentWith(1) });
  assert.equal(slumpW.reg, Math.round(plainW.reg * 1.5));
  assert.equal(slumpW.big, Math.round(plainW.big * 1.5));
  assert.equal(slumpW.miss, plainW.miss - (slumpW.reg - plainW.reg) - (slumpW.big - plainW.big), "増えた分はハズレから移す");
  assert.equal(Object.values(slumpW).reduce((a, b) => a + b, 0), Object.values(plainW).reduce((a, b) => a + b, 0), "合計は変えない");
  // 生涯の裏確変中は ×2.5 のまま（×1.5 を掛け重ねない）
  const rescueBase = { ...base, bonusCount: 2 };
  eq(weights({ ...rescueBase, recent: recentWith(0) }), weights(rescueBase));
  assert.equal(weights(rescueBase).reg, Math.round(plainW.reg * RESCUE.mult));
  // 最初の30回転は旧仕様と同じ抽選（窓がそろわない）。回転ごとに記録が伸び、30で止まる。
  const machine = { seed: 7, count: 0, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 0, freezeCount: 0, setting: 3 };
  for (let action = 0; action < 60; action++) {
    const before = machine.recent?.length || 0;
    const rs = reel.core.spinSeries(machine, {});
    assert.equal(machine.recent.length, Math.min(30, before + rs.length));
    assert.equal(machine.recent.at(-1), reel.core.PEKA.includes(rs.at(-1).role) || rs.at(-1).overlap ? 1 : 0);
  }
}


// 偶奇の台詞はオーナー承認の文言だけ。分類ごとの出やすさは従来どおり
const kind = (id) => reel.SETTING_HINTS.find((h) => h.id === id);
eq(kind("odd").lines, ["いち、さん、ご！ 今日はこのリズムが好き♪", "今日は奇数が気になるな〜"]);
eq(kind("even").lines, ["に、よん、ろく！ 今日はこのリズムが好き♪", "今日は偶数が気になるな〜"]);
const weights = Object.fromEntries(reel.SETTING_HINTS.map((h) => [h.id, [1, 2, 3, 4, 5, 6].map((s) => h.w(s))]));
eq(weights, {
  neutral: [40, 40, 40, 40, 40, 40], odd: [16, 6, 16, 6, 16, 6], even: [6, 16, 6, 16, 6, 16],
  low: [14, 14, 7, 7, 3, 3], high: [3, 3, 7, 7, 14, 14], ge2: [0, 4, 4, 4, 4, 4], ge4: [0, 0, 0, 4, 4, 4], six: [0, 0, 0, 0, 0, 5],
});
const allHintText = reel.SETTING_HINTS.flatMap((h) => h.lines).join("\n");
assert(!/きれいにそろ|ふたつに分け/.test(allHintText), "使わない比喩");

// 確率・設定配分は変えない
eq(reel.core.SETTINGS, {
  1: { weight: 30, reg: 0.85, big: 0.92, bell: 24 }, 2: { weight: 25, reg: 0.92, big: 0.96, bell: 26 },
  3: { weight: 20, reg: 1, big: 1, bell: 28 }, 4: { weight: 12, reg: 1.12, big: 1.05, bell: 30 },
  5: { weight: 8, reg: 1.25, big: 1.1, bell: 32 }, 6: { weight: 5, reg: 1.45, big: 1.18, bell: 36 },
});

// 説明（遊び方カード・#639）: 場所を明かさない・固定曜日と書かない・確定ではないことを伝える・文字は短く
const help = reel.GUIDE.map((g) => `${g.head} ${g.body}`).join("\n");
assert(!/観音|お参り|曜日|毎週|週替わり|金|虹/.test(help), "場所・固定曜日・金/虹の予告を書かない");
for (const must of ["1〜6", "必ず当たるわけではない", "7日", "章が変わる", "同じ設定", "低い設定", "特定のスポットでも設定が変わることがあるよ。街を歩いて見つけてみてね！", "確定ではない", "次のゲーム"]) {
  assert(help.includes(must), must);
}
for (const g of reel.GUIDE) assert([...g.body].length <= 40, `ラミネートのように短く: ${g.body}`);
eq(reel.core.CUE_ORDER, ["blue", "green", "red"]);

// 示唆の履歴: 設定変更ごとに分け、同じ日の変更でも前の示唆を今の設定の証拠にしない
const s = core.newGame();
Object.assign(s, { phase: "daily", chapter: 1, day: 3 });
s.reel.installed = true;
reel.rememberHint("前の示唆");
eq(reel.splitHints(s.reel).current.map((h) => h.text), ["前の示唆"]);
reel.changeSetting(); // 同じ日に設定が変わる
reel.rememberHint("今の示唆");
let split = reel.splitHints(s.reel);
eq(split.current.map((h) => h.text), ["今の示唆"]);
eq(split.past.map((h) => h.text), ["前の示唆"]);
// SAVE/LOAD しても同じ分け方
split = reel.splitHints(JSON.parse(JSON.stringify(s.reel)));
eq([split.current.map((h) => h.text), split.past.map((h) => h.text)], [["今の示唆"], ["前の示唆"]]);
// 章が変わって次にスロットが回る行動で選び直すと、その前の示唆は前の設定になる
s.reel.settingSince = { chapter: 1, day: 3 };
Object.assign(s, { chapter: 2, day: 15 });
const before = s.reel.settingDraws;
reel.onAction({ spent: 10 });
assert.equal(s.reel.settingDraws, before + 1);
assert.equal(reel.splitHints(s.reel).current.length, 0);
assert(reel.splitHints(s.reel).past.some((h) => h.text === "今の示唆"));
// 旧セーブ（period の無い記録・lastHint だけ）は、今の設定の証拠として扱わない
eq(reel.splitHints({ settingDraws: 0, note: { hints: [{ text: "旧", chapter: 1, day: 2 }] } }).current, []);
eq(reel.splitHints({ note: { lastHint: "もっと旧" } }).past.map((h) => h.text), ["もっと旧"]);
// ノートの表示用まとめも同じ分け方
const summary = reel.noteSummary(s.reel);
assert.equal(summary.currentHints.length, 0);
// 設定期間別の観測: 数値順で最新3件まで。現在の記録が無ければ過去から補わない。
const observed = {
  settingDraws: 12,
  note: { periods: {
    1: { spins: 10, big: 1, reg: 0, bell: 1 },
    2: { spins: 20, big: 0, reg: 2, bell: 2 },
    9: { spins: 25, big: 1, reg: 1, bell: 3 },
    10: { spins: 30, big: 1, reg: 2, bell: 4 },
    12: { spins: 42, big: 2, reg: 3, bell: 5 },
  } },
};
const observedBefore = JSON.stringify(observed);
eq(reel.noteSummary(observed).periodStats, {
  current: { period: 12, spins: 42, big: 2, reg: 3, bell: 5 },
  past: [
    { period: 10, spins: 30, big: 1, reg: 2, bell: 4 },
    { period: 9, spins: 25, big: 1, reg: 1, bell: 3 },
    { period: 2, spins: 20, big: 0, reg: 2, bell: 2 },
  ],
});
assert.equal(JSON.stringify(observed), observedBefore, "集計表示は記録を書き換えない");
eq(reel.noteSummary(JSON.parse(observedBefore)).periodStats, reel.noteSummary(observed).periodStats);
assert.equal(reel.noteSummary({ ...observed, settingDraws: 13 }).periodStats.current, null);
for (const legacy of [undefined, {}, { count: 100, note: { big: 5, reg: 6, bell: 7 } }]) {
  eq(reel.noteSummary(legacy).periodStats, { current: null, past: [] });
}
for (const settingDraws of [undefined, null, "12", 1.5, NaN]) {
  eq(reel.noteSummary({ settingDraws, note: { periods: {
    0: { spins: 1, big: 0, reg: 0, bell: 0 },
  } } }).periodStats, {
    current: { period: 0, spins: 1, big: 0, reg: 0, bell: 0 }, past: [],
  });
}
// 実際の行動で新しい期間にだけ記録される（上の章更新で初めて回した結果）。
const recorded = s.reel.pending;
eq(summary.periodStats, {
  current: {
    period: s.reel.settingDraws, spins: recorded.length,
    big: recorded.filter((r) => r.role === "big" || r.role === "rare" || r.overlap === "big").length,
    reg: recorded.filter((r) => r.role === "reg" || r.overlap === "reg").length,
    bell: recorded.filter((r) => r.role === "bell").length,
  },
  past: [],
});
eq(summary.history.map((h) => h.ren), recorded.filter((r) => reel.core.PEKA.includes(r.role) || !!r.overlap).reverse().map((r) => r.ren));

// 固定シード群から連チャンの実例を探す。リプレイも1回転として前回当選との差を数える。
let renSeed = null, sawLongGap = false, sawFive = false, sawSix = false, sawEarlyFirst = false;
for (let seed = 1; seed <= 32; seed++) {
  const machine = { seed, count: 0, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 0, freezeCount: 0, setting: 3 };
  let previousBonus = null;
  for (let action = 0; action < 300; action++) {
    for (const r of reel.core.spinSeries(machine, {})) {
      const win = reel.core.PEKA.includes(r.role) || !!r.overlap;
      const gap = previousBonus === null ? r.n + 1 : r.n - previousBonus;
      assert.equal(r.games, gap, `games: seed=${seed}, spin=${r.n}`);
      assert.equal(r.ren, win && previousBonus !== null && gap <= 5, `ren: seed=${seed}, spin=${r.n}`);
      if (r.ren) renSeed ??= seed;
      if (win && previousBonus !== null && gap >= 6) sawLongGap = true;
      if (win && previousBonus !== null && gap === 5) sawFive = true;
      if (win && previousBonus !== null && gap === 6) sawSix = true;
      if (win && previousBonus === null && gap <= 5) sawEarlyFirst = true;
      if (win) previousBonus = r.n;
    }
  }
}
assert.notEqual(renSeed, null, "固定シード群に連チャン当選が実在する");
assert(sawLongGap, "6回転以上あいた当選も検証した");
assert(sawFive && sawSix, "5回転と6回転の境界を両方検証した");
assert(sawEarlyFirst, "開始5回転以内の初当選には連を付けない");

// 設定示唆の取得（フォールバックと安全確認）
for (const setting of [1, 2, 3, 4, 5, 6, 0, undefined, null, NaN]) {
  const line = reel.settingHint(setting);
  assert(typeof line === "string" && line.length > 0, `settingHint must return non-empty string for setting=${setting}`);
  assert(allHintText.includes(line), `settingHint line must belong to known hint lines: ${line}`);
}
console.log("[reel hints] PASS: approved odd/even lines, unchanged weights and settings, spoiler-free guide, period-separated history across same-day change, SAVE/LOAD, chapter redraw and legacy saves, guarded settingHint, period observations and ren boundaries");

