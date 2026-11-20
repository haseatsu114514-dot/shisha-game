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
let asked=null;
const ui=new vm.SyntheticModule(["modal"],function(){this.setExport("modal",options=>{asked=options;return new Promise(r=>resolve=r);});},{context});
const level=new vm.SourceTextModule(fs.readFileSync(new URL('../js/craft/retry-assist-level.js',import.meta.url),'utf8'),{context});
const assist=new vm.SourceTextModule(fs.readFileSync(new URL('../js/chapters/retry-assist.js',import.meta.url),'utf8'),{context});
await assist.link(spec=>spec.endsWith('retry-assist-level.js')?level:ui);await assist.evaluate();
const t={losses:3,retryAssist:false};
// 選択肢の値は段（イージー1・ノーマル0・取消null）。戻り値は従来どおり救済の有無。
for(const [answer,result] of [[1,true],[0,false],[null,null]]) {
  const pending=assist.namespace.chooseRetryAssist(t,()=>current);resolve(answer);
  assert.equal(await pending,result);assert.equal(t.retryAssist,result===true);assert.equal(t.retryAssistLevel,answer||0);
}
const pending=assist.namespace.chooseRetryAssist(t,()=>current);current=false;resolve(1);
assert.equal(await pending,null);assert.equal(t.retryAssist,false);
current=true;
const nextAttempt=assist.namespace.chooseRetryAssist(t,()=>current);t.attempts=2;resolve(1);
assert.equal(await nextAttempt,null);assert.equal(t.retryAssist,false);
// 3敗でイージー、6敗でベリーイージーも選べる（WIN13）。名前だけで、効き目の説明は出さない（WIN14）。2敗では聞かない。
const tests=options=>Array.from(options,o=>o.test); // vm の配列を外の配列へ写して比べる
const labels=options=>Array.from(options,o=>o.label);
for(const losses of [3,4,5]) {
  const r={losses,retryAssist:false};asked=null;
  const p=assist.namespace.chooseRetryAssist(r,()=>true);
  assert.deepEqual(tests(asked.options),['retry-assist-yes','retry-assist-no','retry-assist-cancel']);
  assert.deepEqual(labels(asked.options),['イージー','ノーマル','選択に戻る']);assert.equal(asked.options[0].primary,true);
  assert.equal(asked.body,'難易度を下げる？');
  resolve(1);assert.equal(await p,true);assert.equal(r.retryAssistLevel,1);
}
for(const [losses,answer,result] of [[6,2,true],[6,1,true],[9,2,true],[6,0,false]]) {
  const r={losses,retryAssist:false};asked=null;
  const p=assist.namespace.chooseRetryAssist(r,()=>true);
  assert.deepEqual(tests(asked.options),['retry-assist-yes','retry-assist-easy','retry-assist-no','retry-assist-cancel']);
  assert.deepEqual(labels(asked.options),['ベリーイージー','イージー','ノーマル','選択に戻る']);assert.equal(asked.options[0].primary,true);
  assert.equal(asked.body,'難易度を下げる？');
  resolve(answer);assert.equal(await p,result);assert.equal(r.retryAssist,result);assert.equal(r.retryAssistLevel,answer);
}
// コンティニュー画面の選択肢（WIN14）。取消は無く、先頭がいちばんやさしい段。
assert.deepEqual(Array.from(assist.namespace.retryAssistOptions(1),o=>[o.label,o.value,o.test]),[['イージー',1,'retry-assist-yes'],['ノーマル',0,'retry-assist-no']]);
assert.deepEqual(Array.from(assist.namespace.retryAssistOptions(2),o=>[o.label,o.value,o.test]),[['ベリーイージー',2,'retry-assist-yes'],['イージー',1,'retry-assist-easy'],['ノーマル',0,'retry-assist-no']]);
assert.deepEqual([0,2,3,5,6,9].map(losses=>assist.namespace.retryAssistOffer({losses})),[0,0,1,1,2,2]);
// 画面で選んだ段を記録する。選べない段や想定外の値はノーマル。
for(const [losses,level,assisted,stored] of [[3,1,true,1],[3,2,false,0],[6,2,true,2],[6,1,true,1],[6,0,false,0],[2,1,false,0],[6,undefined,false,0],[6,'2',false,0]]) {
  const r={losses,retryAssist:true,retryAssistLevel:9};
  assert.equal(assist.namespace.applyRetryAssistChoice(r,level),assisted,`${losses}敗で${level}`);
  assert.deepEqual([r.retryAssist,r.retryAssistLevel],[assisted,stored]);
}
// 選べない段（3敗でベリーイージー）や想定外の値は取消扱い。
{ const r={losses:3,retryAssist:false};const p=assist.namespace.chooseRetryAssist(r,()=>true);resolve(2);assert.equal(await p,null);assert.equal(r.retryAssist,false); }
{ const r={losses:6,retryAssist:false};const p=assist.namespace.chooseRetryAssist(r,()=>true);resolve(true);assert.equal(await p,null);assert.equal(r.retryAssist,false); }
{ const r={losses:2,retryAssist:true,retryAssistLevel:1};asked=null;assert.equal(await assist.namespace.chooseRetryAssist(r,()=>true),false);assert.equal(asked,null);assert.equal(r.retryAssist,false);assert.equal(r.retryAssistLevel,0); }
// 負けを記録すると、選んだ段も外れる。
{ const r={losses:6,attempts:7,lastLossAttempt:6,retryAssist:true,retryAssistLevel:2};assist.namespace.recordTournamentLoss(r);assert.deepEqual([r.losses,r.retryAssist,r.retryAssistLevel],[7,false,0]); }
console.log("PASS: four reasons, finite completed advice/ties, detached context, session losses, seven/four cues, owner invalidation and assist yes/no/cancel");
