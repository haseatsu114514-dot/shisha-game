import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// #2035: the real chapter-2 tournament buttons keep their session/error contract.
{
 const chapter=2;
 const chapterSource=fs.readFileSync(new URL(`../js/chapters/ch${chapter}-tournament.js`,import.meta.url),'utf8');
 const helperSource=fs.readFileSync(new URL('../js/core/chapter-actions.js',import.meta.url),'utf8');
 const errors=[],screens=[];const chapterState={chapter};
 const node=(selector,attrs={},children=[])=>({selector,...(Array.isArray(attrs)?{children:attrs}:{...attrs,children})});
 const context=vm.createContext({console:{error:(...args)=>errors.push(args)}});
 const runner=new vm.SourceTextModule(chapterSource+`\nexport {button,perform}; export function owner(){return session={state,active:true,busy:false};}`,{context});
 let stateModule;
 await runner.link(async spec=>{
  if(spec==='../core/chapter-actions.js'){
   const helper=new vm.SourceTextModule(helperSource,{context});
   await helper.link(()=>new vm.SyntheticModule(['el'],function(){this.setExport('el',node);},{context}));return helper;
  }
  const names=spec==='../craft/broadcast.js'?['block','judge','judgeOf','burst','clearComments']:
   [...chapterSource.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(s=>s.trim()));
  const values={state:chapterState,el:node,layers:{hud:{replaceChildren(){},classList:{toggle(){}}}},showScreen:(name,root)=>screens.push({name,root})};
  const stub=new vm.SyntheticModule(names,function(){for(const n of names)this.setExport(n,values[n]??(()=>{}));},{context});
  if(spec==='../core/state.js')stateModule=stub;return stub;
 });await runner.evaluate();const api=runner.namespace;
 let owner=api.owner(),calls=0,release;
 const wait=new Promise(resolve=>release=resolve);
 const button=api.button(owner,'続ける','next',()=>{calls++;return wait;});
 assert.equal(button.selector,'button.btn');assert.equal(button.type,'button');assert.equal(button.text,'続ける');assert.equal(button.dataset.test,`ch${chapter}-tournament-next`);
 assert.equal(api.button(owner,'進む','go',()=>{},true).selector,'button.btn.primary');
 const pending=button.onclick();assert.equal(owner.busy,true);await button.onclick();assert.equal(calls,1,'repeated clicks run once');
 release();await pending;assert.equal(owner.busy,false);await api.perform(owner,()=>calls++);assert.equal(calls,2);
 api.owner();await button.onclick();assert.equal(calls,2,'stale session is ignored');
 owner=api.owner();owner.active=false;await api.perform(owner,()=>calls++);assert.equal(calls,2,'inactive session is ignored');
 owner=api.owner();stateModule.setExport('state',{});await api.perform(owner,()=>calls++);assert.equal(calls,2,'LOAD invalidates the owner');stateModule.setExport('state',chapterState);
 for(const asyncError of [false,true]){
  owner=api.owner();const error=new Error('controlled chapter 2 action failure');
  await api.perform(owner,()=>{if(asyncError)return Promise.reject(error);throw error;});
  assert.equal(owner.busy,false);assert.equal(errors.at(-1)[0],`[ch${chapter} tournament]`);assert.equal(errors.at(-1)[1],error);
  assert.equal(screens.at(-1).name,`ch${chapter}-tournament`);assert.equal(screens.at(-1).root.dataset.test,`ch${chapter}-tournament-error`);
 }
 const before=errors.length;owner=api.owner();await api.perform(owner,()=>{api.owner();throw new Error('stale failure');});
 assert.equal(errors.length,before,'stale errors do not replace newer screens');assert.equal(owner.busy,false);
 owner=api.owner();let finish;const later=new Promise(resolve=>finish=resolve);const running=api.perform(owner,()=>later);const newer=api.owner();newer.busy=true;finish();await running;
 assert.equal(owner.busy,false,'busy resets on an old owner');assert.equal(newer.busy,true,'newer session busy state is preserved');
 console.log(`chapter-${chapter} tournament actions: session, repeated input and error recovery PASS`);
}
