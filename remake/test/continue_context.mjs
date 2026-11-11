import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { weakestPart } from "../js/craft/advice.js";
import { normalizeContinueContext, prepareContinueScript, craftContinueContext, recordContinueContext, clearContinueHistory } from "../js/chapters/continue-context.js";
import { LOVER_CONTINUE_SCRIPTS } from "../js/chapters/continue-lovers.js";
const sample = { duration: 20, cues: Array.from({ length: 7 }, (_, i) => ({ at: [0,1.8,4.2,7,10.3,13.6,16.5][i], text: `line${i}`, face: "normal" })) };
// 2026-11-07 オーナー指示（#2524）: 台詞は敗因・順位・弱点に絡めない。どの負け方でも台本の文をそのまま使う。
for (const reason of ["burnt","cold","leaf","rank","unknown"]) for (const rank of [null, 2, 3]) {
  const ctx = normalizeContinueContext({ reason, rank, parts:{ heat:42, holes:60 }, completedParts:["holes","heat"] });
  const first = prepareContinueScript(sample, ctx);
  assert.deepEqual(first.cues.map(c => c.text), sample.cues.map(c => c.text), `${reason}/${rank}: no reason-specific rewrite`);
  for (const sameReasonOrdinal of [1, 2]) {
    const repeat = prepareContinueScript(sample, normalizeContinueContext({ reason, rank, lossOrdinal:2, sameReasonOrdinal }));
    assert.deepEqual(repeat.cues.map(c => c.at), [0,2.2,4.6,7]); assert.equal(repeat.duration,20);
    assert.deepEqual(repeat.cues.map(c => c.text), [0,2,5,6].map(i => sample.cues[i].text), "default short keeps lines 0,2,5,6");
  }
}
// スミさんの台本は short で残す行を持つ（掛け合いの芯 [2,3,5,6]）。
const shortSample = { ...sample, short: [2,3,5,6] };
assert.deepEqual(prepareContinueScript(shortSample, normalizeContinueContext({ lossOrdinal:3 })).cues.map(c => c.text), ["line2","line3","line5","line6"]);
assert.deepEqual(prepareContinueScript(shortSample, normalizeContinueContext({ lossOrdinal:1 })).cues.map(c => c.text), sample.cues.map(c => c.text));
assert.equal(weakestPart({heat:1,holes:1,care2:0},["holes","heat"]),"holes");
assert.equal(weakestPart({heat:NaN,holes:Infinity,unknown:-1}),null);
const partial = craftContinueContext({parts:{shisha:0,care2:0},holes:{score:60},heat:{score:45}});
assert.deepEqual(partial.completedParts,["holes","heat"]);
const copy = normalizeContinueContext({ reason:"unknown", rank:NaN, parts:{holes:0,heat:42}, completedParts:["heat"] });
assert.equal(copy.reason,"rank"); assert.equal(copy.rank,null); assert.equal(weakestPart(copy.parts,copy.completedParts),"heat");
assert(Object.isFrozen(copy.parts));
const owner={},match={}; const ctx={reason:"cold"};
assert.equal(recordContinueContext(owner,match,1,ctx).lossOrdinal,1);
assert.equal(recordContinueContext(owner,match,1,ctx).lossOrdinal,1);
assert.equal(recordContinueContext(owner,match,2,ctx).sameReasonOrdinal,2);
assert.equal(recordContinueContext(owner,match,3,{reason:"burnt"}).sameReasonOrdinal,1);
assert.equal(recordContinueContext(owner,{},4,ctx).lossOrdinal,1);
assert.equal(recordContinueContext({},match,4,ctx).lossOrdinal,1);
clearContinueHistory(owner);assert.equal(recordContinueContext(owner,match,5,ctx).lossOrdinal,1);
for(const script of Object.values(LOVER_CONTINUE_SCRIPTS)) {
  const short=prepareContinueScript(script,normalizeContinueContext({lossOrdinal:2}));
  assert.deepEqual(short.cues.map(c=>c.text),[0,2,5,6].map(i=>script.cues[i].text));
  assert.deepEqual(script.cues.map(c=>c.at),[0,1.8,4.2,7,10.3,13.6,16.5]);
}
// Run the actual modal selection with deferred answers and owner/attempt invalidation.
let resolve, current=true;
const context=vm.createContext({});
const ui=new vm.SyntheticModule(["modal"],function(){this.setExport("modal",()=>new Promise(r=>resolve=r));},{context});
const assist=new vm.SourceTextModule(fs.readFileSync(new URL('../js/chapters/retry-assist.js',import.meta.url),'utf8'),{context});
await assist.link(()=>ui);await assist.evaluate();
const t={losses:3,retryAssist:false};
for(const answer of [true,false,null]) {
  const pending=assist.namespace.chooseRetryAssist(t,()=>current);resolve(answer);
  assert.equal(await pending,answer);assert.equal(t.retryAssist,answer===true);
}
const pending=assist.namespace.chooseRetryAssist(t,()=>current);current=false;resolve(true);
assert.equal(await pending,null);assert.equal(t.retryAssist,false);
current=true;
const nextAttempt=assist.namespace.chooseRetryAssist(t,()=>current);t.attempts=2;resolve(true);
assert.equal(await nextAttempt,null);assert.equal(t.retryAssist,false);
console.log("PASS: four reasons, finite completed advice/ties, detached context, session losses, seven/four cues, owner invalidation and assist yes/no/cancel");
