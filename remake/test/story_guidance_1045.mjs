// Actual pure contact-context and public timer caller; controlled DOM/UI, not a browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js = new URL('../js/', import.meta.url);
const read = p => fs.readFileSync(new URL(p, js), 'utf8');
const context = vm.createContext({console});
const contact = new vm.SourceTextModule(read('daily/story-contact.js'), {context});
await contact.link(() => { throw Error('Contact status must stay pure'); }); await contact.evaluate();
const status = contact.namespace.storyThreadStatus;
for (const flags of [{}, {_ch2_naru_read:true}, {_ch2_naru_listened:true}, {_ch2_read_ch2_naru_window:true}]) {
  const game={chapter:2,flags}; const before=JSON.stringify(game);
  assert.equal(status('naru',game),null); assert.equal(JSON.stringify(game),before);
}
for (const choice of ['_ch2_naru_listened','_ch2_naru_hurt']) {
  const game={chapter:2,flags:{_ch2_read_ch2_naru_window:true,[choice]:true},inbox:[{read:false,done:false,log:[]}],affinity:{naru:20}};
  const before=JSON.stringify(game),text=status('naru',game);
  assert.equal(typeof text,'string'); assert(text.includes('以前のやり取り'));
  assert.equal(status('minto',game),null);assert.equal(status('naru',{...game,chapter:1}),null);
  assert.equal(status('naru',{...game,chapter:3}),null);
  for(let i=0;i<5;i++)assert.equal(status('naru',JSON.parse(JSON.stringify(game))),text);
  assert.equal(JSON.stringify(game),before,'Preview/reload cannot read old messages or award affinity');
}
console.log('PASS contact context: only completed story, both choices, chapter exit and pure reload');

async function timerFixture(mode, experienced=false) {
  const nodes=[];
  const node=(attrs={})=>({children:[],dataset:{},style:{},...attrs,
    append(...children){this.children.push(...children.filter(Boolean));},
    classList:{add(){}},setAttribute(k,v){this[k]=v;},
    click(){if(!this.disabled)this.onclick?.();},
    querySelectorAll(){return nodes.filter(n=>['timer-minute-up','timer-second-up'].includes(n.dataset?.test));}});
  const el=(spec,attrs={},children=[])=>{
    if(Array.isArray(attrs)){children=attrs;attrs={};}
    const n=node(attrs);n.append(...(Array.isArray(children)?children:[children]));nodes.push(n);return n;
  };
  const port=(name,values)=>new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context:ctx,identifier:name});
  const ctx=vm.createContext({console,setTimeout(){throw Error('Unexpected auto-start');}});
  const mods=new Map([
    ['core/state.js',port('state',{state:{}})],
    ['core/growth-effects.js',port('growth',{growthLesson:()=>false})],
    ['core/util.js',port('util',{el,clamp:(n,a,b)=>Math.max(a,Math.min(b,n))})],
    ['core/audio.js',port('audio',{SE:{click(){},select(){}}})],
    ['craft/session.js',port('session',{stepPanel:()=>node()})],
    ['craft/common.js',port('common',{autoSkill:()=>false})],
    ['craft/art.js',port('art',{artImg:()=>node()})],
    ['craft/digital-clock.js',port('clock',{buildDigitalClock:()=>({root:node(),update(){}})})],
    ['craft/steam-forecast.js',port('forecast',{buildSteamTemperature:()=>({root:node()}),buildSteamForecast:()=>({root:node(),update(){}})})],
    ['craft/practice-history.js',port('history',{basicsExperienced:()=>experienced})],
  ]);
  for(const path of ['craft/timer.js','craft/steam-time.js'])mods.set(path,new vm.SourceTextModule(read(path),{context:ctx,identifier:path}));
  const entry=mods.get('craft/timer.js');
  await entry.link((s,ref)=>mods.get(new URL(s,'https://fixture/'+ref.identifier).pathname.slice(1)));
  await entry.evaluate();
  const cs={mode,untouched:'temperature/score ports are not modified'},before={...cs};
  const pending=entry.namespace.runSteamTimer(cs);
  return {cs,before,pending,get:test=>nodes.find(n=>n.dataset?.test===test)};
}
for(const mode of ['practice','tutorial']) {
  const f=await timerFixture(mode);
  assert(f.get('timer-start').disabled);
  assert(!f.get('steam-shorten'),'First-time/tutorial players never see the shorten toggle');
  assert(!f.get('steam-duration-hint').textContent.includes('約'));
  for(let i=0;i<9;i++)f.get('timer-minute-up').click();
  assert(f.get('steam-duration-hint').textContent.includes(mode==='tutorial'?'約13秒':'約18秒'));
  assert.deepEqual(f.cs,f.before,'Reading/changing the duration cannot commit craft state');
  f.get('timer-reset').click();assert(f.get('timer-start').disabled);
  for(let i=0;i<5;i++)f.get('timer-minute-up').click();
  assert(f.get('steam-duration-hint').textContent.includes(mode==='tutorial'?'約9秒':'約12秒'));
  f.get('timer-start').click();await f.pending;
  assert.deepEqual(f.cs,{...f.before,steamSeconds:300,steamMin:5});
}
console.log('PASS actual timer: selected duration, tutorial scale, reset and unchanged commit contract');

// B08: 既習プレイヤーだけ、雑念回避の任意短縮を使える。初回・温度・採点・保存には触れない。
{
  const f=await timerFixture('practice',true);
  const toggle=f.get('steam-shorten');
  assert(toggle,'Experienced players get an optional shorten toggle');
  assert.equal(toggle['aria-pressed'],'false');
  for(let i=0;i<9;i++)f.get('timer-minute-up').click();
  assert(f.get('steam-duration-hint').textContent.includes('約18秒'));
  toggle.click();
  assert.equal(f.cs.steamShorten,true);
  assert.equal(toggle['aria-pressed'],'true');
  const hint=f.get('steam-duration-hint').textContent;
  assert(hint.includes('約8秒')&&hint.includes('短縮'),'Shortened hint shows the reduced dodge length');
  assert(hint.includes('採点はそのまま'),'Shortening must not change scoring/temperature');
  toggle.click();
  assert.equal(f.cs.steamShorten,false,'The shorten choice can be toggled back off');
  assert(f.get('steam-duration-hint').textContent.includes('約18秒'));
  toggle.click();
  f.get('timer-start').click();await f.pending;
  assert.deepEqual(f.cs,{...f.before,steamSeconds:540,steamMin:9,steamShorten:true},'Only the opted-in shorten flag is added to craft state');
}
console.log('PASS B08 shorten: experienced-only toggle, reduced length, scoring/temperature untouched');
