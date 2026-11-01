import "./ch2_vote_commit.mjs";
// 持ち点の不可逆性、JSON中断復元、再挑戦の消費、既存記録の保持。
import assert from 'node:assert/strict';
import { newState } from '../js/core/state.js';
import { tournamentProgress, startAttempt, beginStep, finishStep, recoverStep,
  castVotes, standings, recordResult, JUDGES, CH2_PRIZE } from '../js/chapters/ch2-tournament-state.js';
const copy = value => JSON.parse(JSON.stringify(value));
const s = newState();
s.chapter = 2; s.day = 28; s.stamina = 79; s.flavorStock = { double_apple: 40, mint: 8 };
s.lovers = ['minto']; s.contacts = ['sumi','minto']; s.inbox = [{ id:'existing',done:true,log:[{text:'keep'}] }];
const before = copy(s);
assert.equal(tournamentProgress(s).stage, 'entry');
const craft = { careHistory: [], total: 0 };
let p = startAttempt(s, craft);
// SAVEの瞬間に材料が減っていても、未確定の同じ配合へ戻れば二重に減らない。
beginStep(s); s.flavorStock.double_apple -= 9; s.stamina -= 4;
const loaded = copy(s); recoverStep(loaded);
assert.deepEqual(loaded.flavorStock, before.flavorStock); assert.equal(loaded.stamina, 79);
assert.equal(tournamentProgress(loaded).step, 0); assert.deepEqual(tournamentProgress(loaded).craft, craft);
recoverStep(loaded); assert.deepEqual(loaded.flavorStock, before.flavorStock);
// 確定済み消費はLOADしても巻き戻らず、一度だけ残る。
finishStep(s, { ...craft, mix:{ double_apple:9 } });
const committed = copy(s); recoverStep(committed);
assert.equal(committed.flavorStock.double_apple, 31); assert.equal(committed.stamina, 75);
assert.equal(tournamentProgress(committed).step, 1);
let previous = copy(p.votes);
for (const [round, quality] of [95,30,98,96].entries()) {
  const prior = copy(p.votes);
  assert(castVotes(p, round, quality));
  // #909: 表示用の「この回の票」は実際の増分と完全に一致する（1位・2位の2人だけ）。
  for (const judge of JUDGES) {
    const gained = Object.fromEntries(Object.entries(p.votes[judge]).map(([c, n]) => [c, n - prior[judge][c]]).filter(([, n]) => n > 0));
    const last = p.lastVotes[judge];
    assert.deepEqual(last.points, gained); assert.notEqual(last.first, last.second);
    assert(last.points[last.first] >= last.points[last.second]);
  }
  const once = copy(p.votes), onceLast = copy(p.lastVotes); assert.equal(castVotes(p,round,quality),false);
  assert.deepEqual(p.votes,once); assert.deepEqual(p.lastVotes,onceLast);
  for (const judge of JUDGES) {
    assert(Object.values(p.votes[judge]).reduce((a,b)=>a+b,0)<=10);
    for(const id of Object.keys(previous[judge])) assert(p.votes[judge][id]>=previous[judge][id]);
  }
  previous = copy(p.votes);
  // 実際のJSON保存後も、既存票を取り消していない。
  p = JSON.parse(JSON.stringify(p)); s.flags._ch2_tournament = p;
}
for(const judge of JUDGES) assert.equal(Object.values(p.votes[judge]).reduce((a,b)=>a+b,0),10);
assert.throws(()=>recordResult(s,96),/2回/);
p.craft.careHistory = [{score:91},{score:99}];
const result = recordResult(s,96); assert.deepEqual(recordResult(s,96),result); assert.equal(p.history.length,1);
assert.equal(result.careHistory.length,2);
startAttempt(s,craft); assert.equal(p.attempts,2); assert.equal(p.history.length,1);
assert.deepEqual(s.flavorStock,before.flavorStock); assert.equal(s.stamina,79);
assert.equal(CH2_PRIZE,50000,'decided chapter 2 prize');
assert.equal(s.money, before.money + (result.rank === 1 ? CH2_PRIZE : 0), 'prize follows the recorded result and survives retry');
for(const key of ['tournament','lovers','loverSince','lastDate','inbox','contacts','keepsakes','relationshipMemories']) assert.deepEqual(s[key],before[key],key);
for(const [quality,expected] of [[98,1],[20,4]]) {
  const v=newState(); v.chapter=2; const t=startAttempt(v,craft);
  for(let r=0;r<4;r++)castVotes(t,r,quality);
  assert.equal(standings(t).find(row=>row.id==='hajime').rank,expected);
  t.craft.careHistory = [{score:quality},{score:quality}];
  const moneyBefore = v.money;
  recordResult(v,quality);
  assert.equal(v.money, moneyBefore + (expected === 1 ? CH2_PRIZE : 0), 'prize only on a win');
  recordResult(v,quality);
  assert.equal(v.money, moneyBefore + (expected === 1 ? CH2_PRIZE : 0), 'prize is paid once');
}
console.log('PASS: chapter2 irrevocable 3×10 votes, good/bad ranks, JSON checkpoint rollback, committed consumption, retry, two cares and chapter1/relationships');
// 登録済みの大会ロジック入口から、独立した全国大会stateの回帰も走らせる。
await import('./ch3_tournament_state.mjs');
await import('./ngplus_difficulty.mjs');
