import "./tournament_resource_snapshot.mjs";
import "./tournament_standings.mjs";
import assert from "node:assert/strict";
import { newState } from "../js/core/state.js";
import { CONTESTANTS, JUDGES, SPEND, tournamentProgress, resources, startAttempt,
  beginStep, finishStep, recoverStep, buildTastingPlan, tastingEffect,
  castVotes, standings, recordResult, CH3_PRIZE, TOURNAMENT_RULES_VERSION,
  LEGACY_RIVAL_QUALITY, RIVAL_QUALITY } from "../js/chapters/ch3-tournament-state.js";

const copy = value => JSON.parse(JSON.stringify(value));
const makeState = () => {
  const value = newState();
  value.chapter = 3; value.day = 42; value.stamina = 78; value.weatherSeed = 7317;
  value.flavorStock = { double_apple: 44, citrus: 28 };
  value.flags._ch2_tournament = { stage: "complete", result: { rank: 1 } };
  value.tournament = { attempts: 2, lastRank: 1 };
  value.lovers = ["minto"]; value.contacts = ["sumi", "minto"];
  return value;
};
const craft = { careHistory: [], total: 0 };

assert.deepEqual(CONTESTANTS, ["hajime", "kuze", "steve", "volk"]);
assert.deepEqual(JUDGES, ["emil", "dr_kemuri", "nagumo"]);
assert.equal(SPEND.reduce((sum, value) => sum + value, 0), 10);
const value = makeState(), before = copy(value);
assert.equal(tournamentProgress(value).stage, "entry");
let p = startAttempt(value, craft);
assert.equal(p.attempts, 1);
assert.equal(startAttempt(value, craft).attempts, 1); // 二度押しでも二台目にしない
assert.deepEqual(p.tastingPlan, buildTastingPlan(p.tastingSeed));
for (const round of p.tastingPlan) for (const judge of JUDGES) {
  assert.deepEqual([...round[judge].order].sort(), [...CONTESTANTS].sort());
  if (judge === "nagumo") assert.equal(round[judge].waterAfterKuze, true);
}

// 現在工程だけはLOAD時に戻り、確定済みの前工程は戻らない。
beginStep(value); value.flavorStock.double_apple -= 9; value.stamina -= 3;
beginStep(value); value.flavorStock.citrus -= 4; // 二度呼んでも開始スナップを上書きしない
const midStep = copy(value); recoverStep(midStep);
assert.deepEqual(resources(midStep), resources(before));
assert.equal(midStep.flags._ch3_tournament.step, 0);
recoverStep(midStep); assert.deepEqual(resources(midStep), resources(before));
finishStep(value, { ...craft, mix: { double_apple: 9 } });
const committed = copy(value); recoverStep(committed);
assert.equal(committed.flavorStock.double_apple, 35);
assert.equal(committed.flavorStock.citrus, 24);
assert.equal(committed.stamina, 75);
assert.equal(committed.flags._ch3_tournament.step, 1);

// 柑橘の残り香は直後の試喫だけ。水を飲めばゼロ、次が他人ならはじめに作用しない。
const direct = { order: ["kuze", "hajime", "volk", "steve"], waterAfterKuze: false };
assert.deepEqual(tastingEffect(direct, "emil"), { ...direct, affected: "hajime", delta: -2 });
assert.deepEqual(tastingEffect(direct, "dr_kemuri"), { ...direct, affected: "hajime", delta: 2 });
assert.equal(tastingEffect({ ...direct, waterAfterKuze: true }, "emil").delta, 0);
assert.equal(tastingEffect({ order: ["kuze", "steve", "hajime", "volk"], waterAfterKuze: false }, "emil").affected, "steve");
assert.equal(tastingEffect({ order: ["hajime", "volk", "steve", "kuze"], waterAfterKuze: false }, "emil").affected, null);
const plans = Array.from({ length: 32 }, (_, seed) => buildTastingPlan(seed)[0].emil);
assert(plans.some(plan => plan.order[0] === "kuze"));
assert(plans.some(plan => plan.order[0] !== "kuze"));
assert(plans.some(plan => plan.waterAfterKuze));
assert(plans.some(plan => !plan.waterAfterKuze));
const withWater = startAttempt(makeState(), craft);
const withoutWater = startAttempt(makeState(), craft);
// この数値の旧残り香テストは、保存互換の版1としてそのまま残す。
withWater.rulesVersion = 1; withoutWater.rulesVersion = 1;
withWater.tastingPlan[1].dr_kemuri = { ...direct, waterAfterKuze: true };
withoutWater.tastingPlan[1].dr_kemuri = direct;
castVotes(withWater, 0, 83);
castVotes(withoutWater, 0, 83);
assert.deepEqual(withWater.votes, withoutWater.votes, "The pre-service poll cannot taste Ayatori's aroma");
assert(JUDGES.every(judge => withWater.lastVotes[judge].tactic === null));
castVotes(withWater, 1, 83);
castVotes(withoutWater, 1, 83);
assert.equal(withWater.votes.dr_kemuri.hajime, 0);
assert.equal(withoutWater.votes.dr_kemuri.hajime, 2);

// 4回の票は各審査員10点。投票の再呼出し、JSON保存・再開でも加算しない。
let prior = copy(p.votes);
for (const [round, quality] of [95, 40, 97, 95].entries()) {
  assert.equal(castVotes(p, round, quality), true);
  for (const judge of JUDGES) {
    const last = p.lastVotes[judge];
    const gained = Object.fromEntries(CONTESTANTS.map(id => [id, p.votes[judge][id] - prior[judge][id]])
      .filter(([, points]) => points > 0));
    assert.deepEqual(last.points, gained);
    assert.equal(Object.values(gained).reduce((sum, points) => sum + points, 0), SPEND[round]);
  }
  const after = copy(p.votes);
  assert.equal(castVotes(p, round, quality), false);
  assert.deepEqual(p.votes, after);
  p = copy(p); value.flags._ch3_tournament = p;
  prior = copy(p.votes);
}
for (const judge of JUDGES) assert.equal(CONTESTANTS.reduce((sum, id) => sum + p.votes[judge][id], 0), 10);

// 不正な持ち点でも全審査員を一部だけ確定しない。
const bad = startAttempt(makeState(), craft);
bad.votes.nagumo.kuze = 10;
const untouched = copy(bad.votes);
assert.throws(() => castVotes(bad, 0, 90), /持ち点/);
assert.deepEqual(bad.votes, untouched);
assert.equal(bad.voted, 0);

assert.throws(() => recordResult(value, 95), /2回/);
p.step = 11; p.craft.careHistory = [{ score: 90 }, { score: 94 }];
const result = recordResult(value, 95);
assert.deepEqual(recordResult(value, 95), result);
assert.equal(p.history.length, 1);
assert.equal(result.win, result.rank === 1);
assert.equal(result.careHistory.length, 2);
assert.deepEqual(result.tastingPlan, p.tastingPlan);

// 敗北後だけ再戦し、失敗した一台の消費は元へ。以前の章と交流は保持する。
p.stage = "defeat";
p.failure = "low_score";
p.defeatRead = true;
startAttempt(value, craft);
assert.equal(p.attempts, 2);
assert.equal(p.voted, 0);
assert.equal(p.defeatRead, false, "A new failed attempt must be able to read its own defeat scene");
assert.deepEqual(resources(value), resources(before));
assert.equal(p.history.length, 1);
assert.equal(CH3_PRIZE, 100000, "decided chapter 3 prize");
assert.equal(value.money, before.money + (result.win ? CH3_PRIZE : 0), "prize follows the recorded result and survives retry");
for (const key of ["tournament", "lovers", "contacts", "inbox", "keepsakes", "relationshipMemories"]) {
  assert.deepEqual(value[key], before[key], key);
}

// 制作の高低で勝敗が変わる。低品質の一台を脚本だけで優勝へ変えない。
for (const [quality, expectedWin] of [[98, true], [25, false]]) {
  const caseState = makeState(), caseProgress = startAttempt(caseState, craft);
  for (let round = 0; round < SPEND.length; round++) castVotes(caseProgress, round, quality);
  caseProgress.step = 11;
  caseProgress.craft.careHistory = [{ score: quality }, { score: quality }];
  const moneyBefore = caseState.money;
  const outcome = recordResult(caseState, quality);
  assert.equal(outcome.win, expectedWin);
  assert.equal(outcome.rank, standings(caseProgress).find(row => row.id === "hajime").rank);
  assert.equal(caseState.money, moneyBefore + (expectedWin ? CH3_PRIZE : 0), "prize only on a win");
  recordResult(caseState, quality);
  assert.equal(caseState.money, moneyBefore + (expectedWin ? CH3_PRIZE : 0), "prize is paid once");
}
assert.throws(() => tournamentProgress({ chapter: 2, flags: {} }), /第3章/);

// 版2は全国の基準を上げる。旧保存の残り票と確定済みの結果は再評価しない。
assert.equal(TOURNAMENT_RULES_VERSION, 2);
assert.deepEqual(LEGACY_RIVAL_QUALITY, { kuze: 82, steve: 80, volk: 84 });
assert.deepEqual(RIVAL_QUALITY, { kuze: 86, steve: 85, volk: 88 });
{
  const fresh = makeState(), current = startAttempt(fresh, craft);
  assert.equal(current.rulesVersion, 2);
  castVotes(current, 0, 84);
  assert.equal(current.quality.volk, 88);
  const old = makeState(), legacy = startAttempt(old, craft);
  delete legacy.rulesVersion; // rulesVersion が無い実保存は版1。
  castVotes(legacy, 0, 84);
  const committed = copy(legacy.votes);
  const loaded = copy(old), resumed = tournamentProgress(loaded);
  castVotes(resumed, 1, 84);
  assert.equal(resumed.quality.volk, 84);
  for (const judge of JUDGES) for (const id of CONTESTANTS) assert(resumed.votes[judge][id] >= committed[judge][id]);
  assert.equal(startAttempt(loaded, craft).rulesVersion, undefined, "Continuing a running legacy craft keeps its rule set");
  resumed.stage = "defeat";
  assert.equal(startAttempt(loaded, craft).rulesVersion, 2, "Only a new attempt opts into the new rules");
}
{
  const cases = [NaN, Infinity, -Infinity, -1, 101, "90", null];
  for (const invalid of cases) {
    const bad = startAttempt(makeState(), craft), before = copy(bad);
    assert.throws(() => castVotes(bad, 0, invalid), /工程成績/);
    assert.deepEqual(bad, before, "Invalid performance cannot commit any votes");
  }
  for (const invalid of [null, 0, 3, "2", NaN]) {
    const v = makeState(), bad = startAttempt(v, craft);
    bad.rulesVersion = invalid;
    assert.throws(() => tournamentProgress(v), /採点規則/);
  }
}
{
  const v = makeState(), p = startAttempt(v, craft);
  p.step = 11; p.craft.careHistory = [{ score: 90 }, { score: 94 }];
  for (let round = 0; round < SPEND.length; round++) castVotes(p, round, 98);
  const before = copy(v);
  assert.throws(() => recordResult(v, Infinity), /総合成績/);
  assert.deepEqual(v, before, "Invalid final score cannot pay a prize or record a result");
  const result = recordResult(v, 98);
  assert.equal(result.rulesVersion, 2);
  assert.equal(recordResult(v, 1), result, "A saved winning result is not recomputed");
}
console.log("PASS: chapter3 four-person 3x10 voting, conditional citrus, save rollback, retry and honest ranking");

// #2031: 賞金の共通化は、章別の結果確定・支払済みフラグ・丸めと上限を変えない。
// 旧支払ブロックを同じ章モジュールへ戻し、公開recordResultの返却値・例外・全stateを比較する。
const { readFile } = await import("node:fs/promises");
const { MAX_MONEY } = await import("../js/core/rules.js");
const prizeOutcome = action => {
  try { return { result: action() }; }
  catch (error) { return { error: error.name, message: error.message }; }
};
let prizeCases = 0;
for (const chapter of [2, 3]) {
  const url = new URL(`../js/chapters/ch${chapter}-tournament-state.js`, import.meta.url);
  const actual = await import(url.href);
  let source = await readFile(url, "utf8");
  const rank = chapter === 2 ? "p.result.rank" : "rank";
  const legacy = `if (${rank} === 1 && !p.prizePaid) {
    p.prizePaid = true;
    value.money = Math.min(legacyMaxMoney, Math.max(0, Math.round((value.money || 0) + CH${chapter}_PRIZE)));
  }`;
  const award = new RegExp(`payTournamentPrize\\(value, p, ${rank.replaceAll(".", "\\.")}, CH${chapter}_PRIZE\\);|if \\(${rank.replaceAll(".", "\\.")} === 1 && !p\\.prizePaid\\) \\{[\\s\\S]*?\\n  \\}`, "g");
  assert.equal([...source.matchAll(award)].length, 1, "replace only the chapter's prize block");
  source = source.replace(award, legacy)
    .replace(/from "(\.[^"]+)"/g, (_, path) => `from "${new URL(path, url).href}"`);
  source += `\nimport { MAX_MONEY as legacyMaxMoney } from "${new URL("../core/rules.js", url).href}";\n`;
  const oracle = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const amount = chapter === 2 ? 50000 : 100000;
  const prizeBase = newState();
  for (const money of [undefined, null, 0, -1000000, -amount, -1, 0.4, 0.5, 100, MAX_MONEY - amount,
    MAX_MONEY - 0.5, MAX_MONEY, MAX_MONEY + 1, NaN, Infinity, -Infinity, "100", "", false, true, 1n, Symbol("money")])
    for (const paid of [undefined, false, true, 0, 1, "paid"]) for (const quality of [98, 25]) {
      const run = api => {
        const state = structuredClone(prizeBase);
        Object.assign(state, { chapter, day: 42, weatherSeed: 7317, money });
        const p = api.startAttempt(state, { careHistory: [{ score: quality }, { score: quality }] });
        p.prizePaid = paid; p.step = 11;
        for (let round = 0; round < 4; round++) api.castVotes(p, round, quality);
        const first = prizeOutcome(() => api.recordResult(state, quality));
        const second = prizeOutcome(() => api.recordResult(state, quality));
        assert.equal(second.result, p.result, "a recorded result is returned without a second payment");
        const once = state.money;
        if (!first.error) {
          assert.equal(p.history.length, 1);
          const won = first.result.rank === 1;
          assert.equal(state.money, won && !paid
            ? Math.min(MAX_MONEY, Math.max(0, Math.round((money || 0) + amount))) : money);
          // JSON保存に載る値はLOAD後も再支払しない。履歴や章別の票も保持する。
          if (typeof money !== "bigint" && typeof money !== "symbol") {
            const loaded = copy(state), before = copy(loaded);
            api.recordResult(loaded, quality);
            assert.deepEqual(loaded, before);
          }
        }
        assert.equal(state.money, once);
        return { state, first, second };
      };
      assert.deepEqual(run(actual), run(oracle), `chapter=${chapter}, money=${String(money)}, paid=${String(paid)}, quality=${quality}`);
      prizeCases++;
    }
}
console.log(`PASS: ${prizeCases} chapter2/3 legacy prize comparisons, repeat and JSON LOAD`);
