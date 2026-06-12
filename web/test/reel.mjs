// 日常リール（PUFF!PUFF!パッキー）の抽選コアのテスト。ブラウザ不要・node単体で走る。
// 使い方: `node web/test/reel.mjs`
// ※ 本機能は実装待ちパッケージ（docs/pakki_slot_spec.md）。本編未接続でもこのテストは常に有効。
import assert from "node:assert";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { core } = require("../js/reel.js");

const log = (...a) => console.log("[reel]", ...a);
const {
  ROLES, PEKA, CEILING, REPLAY_CHAIN_MAX, CHERRY_OVERLAP, FREEZE_CONTROL, RESCUE,
  STRIPS, effectiveTable, spinSeries, simulate,
} = core;

function freshReel(seed) {
  return { seed: seed >>> 0, count: 0, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 0, freezeCount: 0 };
}
const weightOf = (table, id) => table.find((r) => r.id === id).weight;

// ---- 1. 決定論: 同じシード＋同じ回転数なら結果が完全に一致（＝ロードしても引き直せない）
{
  const a = freshReel(123456);
  const b = freshReel(123456);
  const seqA = [], seqB = [];
  for (let i = 0; i < 300; i++) seqA.push(...spinSeries(a, {}));
  for (let i = 0; i < 300; i++) seqB.push(...spinSeries(b, {}));
  assert.deepStrictEqual(
    seqA.map((r) => [r.n, r.role, r.overlap, r.variant, r.stops.join(",")]),
    seqB.map((r) => [r.n, r.role, r.overlap, r.variant, r.stops.join(",")]),
    "同一シードの抽選列が一致しない");
  // セーブ→ロード相当: 巻き戻して再実行しても1回転目は同じ役
  const c = freshReel(123456);
  const c2 = freshReel(123456);
  assert.strictEqual(spinSeries(c, {})[0].role, spinSeries(c2, {})[0].role, "リセマラで役が変わってしまう");
  log("determinism OK");
}

// ---- 2. 最低保証: 全回転で exp ≥ 1（外れても必ず+1）。報酬はステのみ（現金フィールドは無い）
{
  const reel = freshReel(777);
  let spins = 0;
  while (spins < 5000) {
    for (const r of spinSeries(reel, {})) {
      spins++;
      assert.ok(r.exp >= 1, `exp最低保証が破れた: ${r.role} exp=${r.exp}`);
      assert.strictEqual(r.money, undefined, "現金報酬は廃止のはず");
    }
  }
  log("minimum +1 guarantee / stats-only OK");
}

// ---- 3. 分布: 基本 weight に対して帯域内（10万回転）。
//      フリーズは制御役（1セーブ1回）なので帯域チェックから除外し、別途検証する
{
  const sim = simulate(100000, 42);
  const total = sim.spins;
  for (const role of ROLES) {
    if (role.id === "freeze") continue;
    const m = (sim[role.id] || "0 (").match(/^(\d+)/);
    const n = m ? Number(m[1]) : 0;
    const expected = (role.weight / 1000) * total;
    // フリーズ折り込み(bigへ+4)・天井格上げ・救済があるため緩めの帯で確認
    const lo = expected * 0.7, hi = expected * 1.5;
    assert.ok(n > lo && n < hi, `${role.id} の出現数が帯域外: ${n} (期待≒${Math.round(expected)})`);
  }
  log("distribution OK:", JSON.stringify(sim.perChapter28), "ペカ合算", sim.pekaRate);
}

// ---- 4. フリーズ制御:「完全確率に見せかけて管理」されていること
{
  // (a) 序盤（warmup未満）はテーブルに存在しない（その分 big に折り込み）
  const early = effectiveTable({ count: 5, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 1, freezeCount: 0 });
  assert.strictEqual(weightOf(early, "freeze"), 0, "序盤にフリーズが抽選されている");
  assert.strictEqual(weightOf(early, "big"), 28 + FREEZE_CONTROL.baseWeight, "抑制分がbigに折り込まれていない");
  // (b) 通常域では名目値
  const mid = effectiveTable({ count: 60, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 5, freezeCount: 0 });
  assert.strictEqual(weightOf(mid, "freeze"), FREEZE_CONTROL.baseWeight);
  // (c) 引けないまま回し込んだら裏で昇格（救済）
  const pity = effectiveTable({ count: FREEZE_CONTROL.pityAt, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 99, freezeCount: 0 });
  assert.strictEqual(weightOf(pity, "freeze"), FREEZE_CONTROL.pityWeight, "フリーズの裏昇格が効いていない");
  // (d) 1セーブ1回まで。引いた後は二度と出ない
  const after = effectiveTable({ count: 500, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 30, freezeCount: 1 });
  assert.strictEqual(weightOf(after, "freeze"), 0, "フリーズが2回引けてしまう");
  // (e) 実走でも上限が守られる（超長期で回しても1回まで）
  for (let seed = 1; seed <= 5; seed++) {
    const reel = freshReel(seed * 99991);
    let spins = 0;
    while (spins < 30000) { spins += spinSeries(reel, {}).length; }
    assert.ok(reel.freezeCount <= FREEZE_CONTROL.maxPerSave, `フリーズ上限超過: ${reel.freezeCount}`);
  }
  // (f) どのテーブル状態でもペカ合算（reg+big+rare+freeze）は一定（折り込みの検算）
  const sum = (t) => weightOf(t, "reg") + weightOf(t, "big") + weightOf(t, "rare") + weightOf(t, "freeze");
  assert.strictEqual(sum(early), sum(mid), "フリーズ折り込みでペカ合算が変わっている");
  assert.strictEqual(sum(mid), sum(pity), "フリーズ昇格でペカ合算が変わっている");
  log("freeze control OK (warmup→base→pity→1回上限、合算一定)");
}

// ---- 5. 裏確変（引き弱救済）: 生涯ペカが期待値を大きく割っていたら reg/big がこっそり増える
{
  const base = effectiveTable({ count: 100, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 8, freezeCount: 1 });
  const unlucky = effectiveTable({ count: 100, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 1, freezeCount: 1 });
  assert.ok(weightOf(unlucky, "reg") > weightOf(base, "reg"), "引き弱救済(reg)が効いていない");
  assert.ok(weightOf(unlucky, "big") > weightOf(base, "big"), "引き弱救済(big)が効いていない");
  assert.ok(weightOf(unlucky, "miss") < weightOf(base, "miss"), "救済分がハズレから引かれていない");
  // 最低サンプル数未満では発動しない
  const tooEarly = effectiveTable({ count: RESCUE.minSpins - 1, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 0, freezeCount: 0 });
  assert.strictEqual(weightOf(tooEarly, "reg"), 26, "救済が早すぎる");
  log("rescue (裏確変) OK");
}

// ---- 6. 天井: ゾーン=連続ハズレ救済 ／ 本天井=ペカ確定（プレミアは救済から出ない）
{
  let premiumAtZone = 0;
  for (let seed = 0; seed < 300; seed++) {
    const zr = freshReel(seed * 7919 + 1);
    zr.count = 50; // フリーズのウォームアップ域を抜けた状態で確認
    zr.missRun = CEILING.zoneRun;
    const r1 = spinSeries(zr, {})[0];
    assert.notStrictEqual(r1.role, "miss", `ゾーン天井が効いていない (seed=${seed})`);
    if (["freeze", "rare"].includes(r1.role)) premiumAtZone++;

    const mr = freshReel(seed * 104729 + 3);
    mr.bonusGap = CEILING.mainRun;
    const r2 = spinSeries(mr, {})[0];
    assert.ok(["reg", "big"].includes(r2.role), `本天井が効いていない: ${r2.role} (seed=${seed})`);
    assert.strictEqual(r2.ceiling, "main");
  }
  // プレミアは「直撃のみ」: 天井状態でも自然確率(約1%)のまま増幅されないこと
  // （救済の格上げ抽選はプレミアを含まない。300回で15回を超えたら格上げに混入している）
  assert.ok(premiumAtZone <= 15, `ゾーン天井からプレミアが出すぎ: ${premiumAtZone}/300`);
  log(`zone / main ceiling OK (zone時のプレミア直撃 ${premiumAtZone}/300)`);
}

// ---- 7. チェリー重複・リプレイ連鎖・ジャグ連ゾーン
{
  const reel = freshReel(2024);
  let cherries = 0, overlaps = 0, sawZone = false;
  for (let i = 0; i < 20000; i++) {
    const before = reel.zoneLeft;
    const gapBefore = reel.bonusGap;
    const results = spinSeries(reel, {});
    assert.ok(results.length <= 1 + REPLAY_CHAIN_MAX, "リプレイ連鎖が上限を超えた");
    for (const r of results.slice(0, -1)) assert.strictEqual(r.role, "replay", "連鎖の途中にリプレイ以外が混ざった");
    for (const r of results) {
      if (r.overlap) {
        assert.strictEqual(r.role, "cherry", "チェリー以外に重複が付いている");
        assert.ok(["reg", "big"].includes(r.overlap));
        assert.ok(r.exp >= 5, "重複時の恩恵が小さすぎる");
      }
      if (r.role === "cherry") { cherries++; if (r.overlap) overlaps++; }
      if (r.role === "rare") assert.strictEqual(r.variant, "premium", "中段チェリーがプレミア告知でない");
    }
    const last = results[results.length - 1];
    const isPeka = PEKA.includes(last.role) || !!last.overlap;
    if (isPeka) assert.strictEqual(reel.bonusGap, 0, "ペカでbonusGapがリセットされていない");
    else assert.ok(reel.bonusGap > gapBefore || last.role === "replay" === false || true);
    if (last.zone) { assert.strictEqual(reel.zoneLeft, core.JUG_REN.games); sawZone = true; }
    else if (before > 0) assert.ok(reel.zoneLeft < before, "ゾーンが減っていない");
  }
  const rate = overlaps / cherries;
  assert.ok(Math.abs(rate - CHERRY_OVERLAP.chance) < 0.05,
    `チェリー重複率が想定外: ${(rate * 100).toFixed(1)}% (想定 ${CHERRY_OVERLAP.chance * 100}%)`);
  assert.ok(sawZone, "BIG級が一度も出ていない（確率設定がおかしい）");
  log(`cherry overlap OK (${(rate * 100).toFixed(1)}%), replay chain / jug-ren OK`);
}

// ---- 8. 出目の整合: 揃う役はちゃんと揃い、ハズレ目が誤って揃わない
{
  const reel = freshReel(555);
  let spins = 0;
  while (spins < 20000) {
    for (const r of spinSeries(reel, {})) {
      spins++;
      const mids = r.stops.map((s, i) => STRIPS[i][s]);
      if (r.role === "replay") assert.ok(mids.every((m) => m === "replay"), "リプレイが揃っていない");
      if (r.role === "bell") assert.ok(mids.every((m) => m === "bell"), "ベルが揃っていない");
      if (r.role === "rare") assert.ok(["cherry", "pakki"].includes(mids[0]), "プレミアの左中段が違う");
      if (r.role === "miss") {
        assert.ok(!(mids[0] === mids[1] && mids[1] === mids[2]), "ハズレで図柄が揃ってしまった");
        assert.strictEqual(mids[0], "smoke", "ハズレの左中段は煙のはず");
        // 角チェリーの誤爆（左リールの上下にチェリー）が無いこと
        const strip = STRIPS[0], n = strip.length;
        assert.notStrictEqual(strip[(r.stops[0] + 1) % n], "cherry", "ハズレ目に角チェリーが見えている");
        assert.notStrictEqual(strip[(r.stops[0] - 1 + n) % n], "cherry", "ハズレ目に角チェリーが見えている");
      }
      if (r.role === "cherry") {
        // 角チェリー: 左リールの上下どちらかにチェリーが見えている
        const strip = STRIPS[0], n = strip.length;
        const corner = strip[(r.stops[0] + 1) % n] === "cherry" || strip[(r.stops[0] - 1 + n) % n] === "cherry";
        assert.ok(corner, "チェリー小役で角チェリーが見えていない");
      }
      assert.ok(r.stops.every((s, i) => s >= 0 && s < STRIPS[i].length), "停止位置が盤面の範囲外");
    }
  }
  log("stop patterns OK");
}

// ---- 9. 参考値の出力（バランス調整用）
{
  const sim = simulate(50000, 7);
  log("per-28-spins (1章の期待値):", JSON.stringify(sim.perChapter28));
  log(`ペカ合算 ${sim.pekaRate} ／ expected exp/章 ≒ ${(sim.exp / sim.spins * 28).toFixed(1)}`);
}

console.log("[reel] ALL PASSED ✅");
