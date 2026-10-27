// Actual commute/station/night-plan modules and calendar callback, with controlled VN/UI ports.
// No browser, player storage, or real LOAD.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = process.env.A1044_SOURCE_ROOT ? pathToFileURL(path.resolve(process.env.A1044_SOURCE_ROOT) + '/') : new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const context = vm.createContext({});
let state, log, mode, saves;
const reset = () => { state = { chapter: 2, day: 18, slot: 2, money: 1000, flags: { _ch2_region: 'widehanga', _ch2_preparation_started: true } }; log = []; mode = 'ok'; saves = 0; statePort.setExport('state', state); };
const statePort = new vm.SyntheticModule(['state','save'], function() { this.setExport('state', state); this.setExport('save', () => saves++); }, {context});
const ui = new vm.SyntheticModule(['setBg','modal','showScreen'], function() {
  this.setExport('setBg', async () => { log.push('background'); });
  for (const n of ['modal','showScreen']) this.setExport(n, () => { throw Error('Unexpected '+n); });
}, {context});
const playPort = new vm.SyntheticModule(['play'], function() { this.setExport('play', async d => {
  log.push(d.dialogue_id);
  if (mode === 'throw') throw Error('controlled VN failure');
  if (mode === 'replace') { state = {...state, flags:{...state.flags}}; statePort.setExport('state', state); }
  return {cancelled: mode === 'cancel'};
}); }, {context});
const ports = new Map([['remake/js/core/state.js',statePort],['remake/js/core/ui.js',ui],['remake/js/vn/engine.js',playPort]]);
function fixed(names, values) { return new vm.SyntheticModule(names, function(){ for(const n of names) this.setExport(n,values[n]); },{context}); }
ports.set('remake/js/core/data.js', fixed(['bgUrl'],{bgUrl:id=>id}));
ports.set('remake/js/core/util.js', fixed(['el'],{el:()=>{throw Error('Unexpected el');}}));
ports.set('remake/js/core/city-locations.js',fixed(['CH2_CITY_NAME','HOME_CITY_NAME','HOME_CITY_READING'],{CH2_CITY_NAME:'柚ヶ谷',HOME_CITY_NAME:'地元',HOME_CITY_READING:'じもと'}));
ports.set('remake/js/core/rules.js',fixed(['TOURNAMENT_DAY'],{TOURNAMENT_DAY:99}));
ports.set('remake/js/core/chapter-clock.js',fixed(['chapterDay'],{chapterDay:s=>s.day}));
async function moduleAt(p) {
  if(ports.has(p)) return ports.get(p);
  assert(['remake/js/chapters/ch2-commute.js','remake/js/daily/station-travel.js','remake/js/core/travel-budget.js','remake/js/daily/night-events.js'].includes(p),p);
  const m=new vm.SourceTextModule(read(p),{context}); ports.set(p,m);
  await m.link(spec=>moduleAt(path.posix.normalize(path.posix.join(path.posix.dirname(p),spec)))); return m;
}
const commute=await moduleAt('remake/js/chapters/ch2-commute.js'); await commute.evaluate();
const nights=await moduleAt('remake/js/daily/night-events.js'); await nights.evaluate();
const prep=read('remake/js/chapters/ch2-preparation.js');
const hook=prep.match(/beforeNightEvent: ([\s\S]*?),\n    startNextDay:/);
const beforeNight=hook ? vm.runInNewContext('('+hook[1]+')',{allSpots:()=>[{id:'tonari'},{id:'naru'},{id:'adam'},{id:'minto'},{id:'ch2_c_station',region:'widehanga'}],returnCityHome:commute.namespace.returnCityHome}) : undefined;
const calendar=read('remake/js/daily/calendar.js');
const start=calendar.indexOf('async (ev) => {',calendar.indexOf('async function endDay('));
const end=calendar.indexOf('\n  });',start);
assert(start>0 && end>start);
const callbackContext=vm.createContext({ chapterDef:{beforeNightEvent:beforeNight}, bannersIdle:async()=>{}, rested:false, returnedToTonari:false, beat:async()=>log.push('beat') });
vm.runInContext('const callback = ('+calendar.slice(start,end)+'\n  });',callbackContext);
async function run(pin) {
  // Getter keeps LOAD owner replacement visible to the actual calendar callback.
  Object.defineProperty(callbackContext,'state',{configurable:true,get:()=>state});
  const ev={id:'fixture-'+pin,pin,schedule:'fixed',beat:'destination',run:async()=>{log.push('event:'+pin); assert.equal(state.flags._ch2_region,pin==='ch2_c_station'?'widehanga':'home');}};
  await nights.namespace.runNightPlan({[state.day]:ev},callbackContext.callback || vm.runInContext('callback',callbackContext));
}
reset(); await run('tonari'); assert(log.indexOf('__ch2_return_train')<log.indexOf('beat')); assert.equal(state.money,800); assert.equal(saves,2);
await commute.namespace.returnCityHome(); assert.equal(state.money,800); assert.equal(log.filter(x=>x==='__ch2_return_train').length,1);
reset(); await run('ch2_c_station'); assert.equal(state.money,1000); assert(!log.includes('__ch2_return_train')); await commute.namespace.returnCityHome(); assert.equal(state.money,800);
for(const failure of ['cancel','throw','replace']) { reset(); mode=failure; await assert.rejects(run('naru')); assert(!log.includes('event:naru')); assert(!state.flags._night_event_day); assert.equal(state.money,800); }
reset(); state.money=100; await assert.rejects(run('tonari')); assert.equal(state.money,100); assert(!log.includes('event:tonari'));
const intro=JSON.parse(read('data/dialogue/remake_ch2.json')).dialogues.find(d=>d.dialogue_id==='remake_ch2_departure').lines.map(l=>l.text||'').join('\n');
assert.match(intro,/約束を果たした、その翌朝/); assert.doesNotMatch(intro,/優勝の翌朝|昨日の採点表|電車に乗った/);
console.log(JSON.stringify({groups:6,scope:'actual commute/station/night-plan modules + actual calendar callback; controlled VN/UI, no browser or real LOAD',passed:['home event after return','one fare after repeated return','city event stays in city until homecoming','cancel/throw/owner replacement stops event','insufficient fare stops without charge','departure chronology']},null,2));
