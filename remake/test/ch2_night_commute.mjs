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

// Run the actual calendar entry, night, sleep and morning functions together.
// Chapter 2's delivery checkpoint and chapter 1's ordinary evening must use the same order.
const runDailySource = calendar.slice(calendar.indexOf('export async function runDaily('), calendar.indexOf('\nasync function morning()')).replace('export ', '');
const morningSource = calendar.slice(calendar.indexOf('async function morning()'), calendar.indexOf('\n/** HUD'));
const nightSource = calendar.slice(calendar.indexOf('async function endDay('));
for (const chapter of [1, 2]) for (const weather of ['sun', 'rain']) {
  const trace = [], snapshots = [];
  const fixture = { chapter, day: 15, slot: 2, stamina: 60, money: 1000, flags: { _morning_15: true }, visitedDay: {} };
  const stop = new Error('morning destination reached');
  const env = {
    state: fixture,
    chapterDay: s => s.day - 14, TOURNAMENT_DAY: 14, SLEEP_RECOVERY: 14, DELIVERY_LAST_DAY: 4,
    save: () => { snapshots.push(structuredClone(fixture)); trace.push('save:' + fixture.day); },
    showReelNow: async () => {}, syncSamechanKnowledge() {}, syncNightQueue() {}, expireInvitations() {},
    initHud() {}, showHud() {}, setPhoneBadge() {}, unreadCount: () => 0, phoneButton() {}, openStatus() {}, openMenu() {},
    briefDeliveryBatch: async () => true, reportDeliveryBatch: async () => null,
    restingToday: () => false, bannersIdle: async () => {},
    runNightPlan: async () => { trace.push('night'); return 0; },
    maybeConfession: async () => { trace.push('confession'); return false; },
    maybeSamechanEncounter: async () => { trace.push('encounter'); },
    play: async id => { trace.push(id); return {}; }, beat() {},
    showSumiRigAtHome: async () => { trace.push('rig-homecoming'); return false; },
    runHomeShisha: async () => { trace.push('home-shisha'); return false; },
    presentNight: async () => { trace.push('night-growth'); return null; },
    conditionForRatio: () => ({ health: 'healthy' }), staminaRatio: () => fixture.stamina / 100,
    addStamina: n => { fixture.stamina += n; trace.push('recovery'); },
    daysLeft: () => 28 - fixture.day, updateHud() {},
    refreshWeather: () => trace.push('weather:' + fixture.day),
    bgUrl: (id, time) => `${id}:${time}`, setBg: bg => trace.push(bg),
    dayTurn: async wake => { trace.push('dawn'); const data = await wake(); assert.equal(data.weather, weather); },
    fadeBlack: async wake => wake(), isRainy: () => weather === 'rain', weatherOf: () => weather,
    presentSleepRecovery: async ({ before, after }) => { assert.equal(before, 60); assert.equal(after, 74); trace.push('recovery-ui'); },
    playBgm: bgm => trace.push(bgm), dayCard: async () => { throw Error('Duplicate morning DAY card'); },
    deliverMorning: () => { trace.push('lime'); return 1; }, pushNotice: () => trace.push('notice'),
  };
  const ctx = vm.createContext(env);
  vm.runInContext('let chapterDef, onQuit, queuedLimeSender, dawnShownDay; const fixedNight = () => false;\n' + runDailySource + morningSource + nightSource, ctx);
  await assert.rejects(ctx.runDaily({ startNextDay: chapter === 2, untilDay: 28, nightEvents: {},
    beforeHomecoming: async () => trace.push('return-home'),
    morningDeparture: async () => { if (fixture.day === 16) throw stop; },
  }), error => error === stop);
  assert.equal(fixture.day, 16); assert.equal(fixture.slot, 0); assert.equal(fixture.stamina, 74); assert.equal(fixture.money, 1000);
  assert.deepEqual(trace.filter(x => !x.startsWith('save:')), [
    'night', 'confession', 'return-home', 'encounter', 'remake_homecoming_0', 'rig-homecoming', 'home-shisha',
    'night-growth', 'dawn', 'recovery', 'weather:16', 'bg_home:day', 'recovery-ui',
    'weather:16', 'kansetsu_shomei_to_black_coffee', 'lime', 'notice',
  ]);
  assert.equal(trace.filter(x => x === 'lime').length, 1);
  assert(snapshots.some(s => s.day === 15 && s.stamina === 60), 'Night checkpoint precedes sleep');
  assert(snapshots.some(s => s.day === 16 && !s.flags._morning_16 && s.stamina === 74), 'Sleep is saved before morning delivery');
  assert(snapshots.some(s => s.day === 16 && s.flags._morning_16 && s.stamina === 74), 'Morning completion is saved');
  if (chapter === 1 && weather === 'sun') {
    Object.assign(fixture, { day: 15, slot: 2, stamina: 60, flags: { _morning_15: true } });
    trace.length = 0;
    ctx.showSumiRigAtHome = async () => {
      ctx.state = structuredClone(fixture); // D03表示中に別のSAVEへ切替
      ctx.state.money = 4321;
      return false;
    };
    await ctx.runDaily({ untilDay: 16, nightEvents: {} });
    assert.equal(ctx.state.day, 15, 'LOAD後に旧日付を進めない');
    assert.equal(ctx.state.stamina, 60, 'LOAD後に旧日の睡眠回復を適用しない');
    assert(!trace.includes('home-shisha') && !trace.includes('dawn'));
  }
}
console.log('PASS: chapter 1 / chapter 2 actual calendar night → home → sleep → autosave → weather/BGM/LIME, once each (sun/rain)');

// Actual chapter controller: finish the mandatory report before entering the shared calendar.
const chapterSource = read('remake/js/chapters/ch2.js');
const dayOneSource = chapterSource.slice(chapterSource.indexOf('async function continueDayOne()'), chapterSource.indexOf('\nasync function introduceStop('));
for (const stage of ['tonari', 'complete']) {
  const scenes = [], progress = { stage }, fixture = { slot: 1, money: 1000, flags: { _ch2_deliveries: { accepted: true, reported: stage === 'complete' } } };
  const ctx = vm.createContext({
    session: {}, current: () => true, state: fixture, progress: () => progress,
    bgUrl: () => 'tonari:night', scene: async id => { scenes.push(id); return true; }, save() {},
    checkpoint: async stage => { progress.stage = stage; },
    continuePreparation: async () => { scenes.push('shared-calendar'); assert(fixture.flags._ch2_deliveries.reported); },
  });
  vm.runInContext(dayOneSource, ctx);
  await ctx.continueDayOne();
  assert.deepEqual(scenes, stage === 'tonari' ? ['remake_ch2_day1_night', 'remake_ch2_delivery_report', 'shared-calendar'] : ['shared-calendar']);
  assert.equal(fixture.money, 1000);
}
console.log('PASS: initial report and legacy complete checkpoint automatically enter shared calendar');
