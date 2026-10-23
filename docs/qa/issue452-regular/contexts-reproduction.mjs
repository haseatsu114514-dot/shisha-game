import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const {chromium}=createRequire(root+'/remake/test/browser/package.json')('playwright');
const source=fs.readFileSync(root+'/remake/test/browser/action_context.mjs','utf8');
const setup=new Function('return ('+source.slice(source.indexOf('async function setup('),source.indexOf('async function nextMorning('))+')')();
const old=path=>execFileSync('git',['-c','protocol.allow=never','show',`7d63fbdc:${path}`],{cwd:root,env:{...process.env,GIT_NO_LAZY_FETCH:'1'}}).toString();
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'}), results=[];
try{for(const version of ['main-7d63fbdc','pr-f51ddcf8'])for(const experiment of ['unchanged','draw-once-route-experiment']){
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[],resources=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.status()>=400)resources.push(`${r.status()} ${r.url()}`)});
 await page.addInitScript(()=>{window.probeErrors=[];window.addEventListener('error',e=>window.probeErrors.push(e.error?.stack||e.message));window.addEventListener('unhandledrejection',e=>window.probeErrors.push(e.reason?.stack||String(e.reason)));});
 if(version.startsWith('main')){
  await page.route('**/data/dialogue/ch1_main.json',r=>r.fulfill({body:old('data/dialogue/ch1_main.json'),contentType:'application/json'}));
  await page.route('**/js/chapters/ch1.js',r=>r.fulfill({body:old('remake/js/chapters/ch1.js'),contentType:'text/javascript'}));
 }
 if(experiment!=='unchanged')await page.route('**/js/daily/reel.js',async route=>{const response=await route.fetch(),source=await response.text();const before='const kind = SETTING_HINTS.find((h) => h.id === pickWeighted(Math.random, kinds));';assert(source.includes(before));await route.fulfill({response,body:source.replace(before,'const picked = pickWeighted(Math.random, kinds);\n  const kind = SETTING_HINTS.find((h) => h.id === picked);')});});
 await page.goto(process.env.CONTEXTS_FIXTURE_URL || 'http://127.0.0.1:8124/remake/test/browser/fixtures/regular_service.html');await page.locator('[data-test="vn-fixture-ready"]').waitFor();await setup(page,4,1);
 await page.evaluate(()=>{C.core.state.reel.seed=15;const original=Math.random;let draw=0;Math.random=()=>{const stack=new Error().stack;if(stack.includes('settingHint'))return draw++<3?0.99:0;if(stack.includes('finish')&&stack.includes('reel.js'))return 0.1;return original();};C.core.save();C.core.load();C.start();});
 await page.locator('.map:not(.done) [data-spot="c_station"]').click();await page.locator('[data-test="map-go"]').click();
 await page.waitForFunction(()=>window.probeErrors.length||window.calendarError||C.core.state.day===5&&document.querySelector('.map:not(.done)'),null,{timeout:25000});
 const outcome=await page.evaluate(()=>({day:C.core.state.day,slot:C.core.state.slot,money:C.core.state.money,flags:C.core.state.flags,trace:C.trace,lines:C.lines,beats:C.beats,reel:C.core.state.reel,error:window.calendarError,visibleFx:document.querySelector('#fx').innerText}));
 if(experiment==='unchanged'){assert(errors.some(e=>e.includes('settingHint')));assert.equal(outcome.day,4);assert.equal(outcome.slot,2);assert.equal(outcome.reel.note.big,1);assert(!outcome.trace.some(x=>x.startsWith('remake_homecoming_')));}
 else{assert.deepEqual(errors,[]);assert.equal(outcome.day,5);assert.equal(outcome.slot,0);assert.equal(!!outcome.flags._ev_ageha_cameo,false);assert(!outcome.trace.includes('ch1_ageha_encounter'));assert(!outcome.trace.includes('ch1_day5_sumi_story'));assert.equal(outcome.trace.filter(x=>x.startsWith('remake_homecoming_')).length,1);assert.equal(outcome.lines.find(l=>l.id==='ch1_c_station_visit').money,27500);}
 const row={version,experiment,controlledBehaviorAssertions:'passed',suiteAcceptance:'not passed: missing cached icons',errors,failedResources:resources,outcome};results.push(row);console.log(JSON.stringify({version,experiment,day:outcome.day,slot:outcome.slot,errors,failedResources:resources.length}));await context.close();
}}finally{await browser.close();fs.writeFileSync(process.env.CONTEXTS_RESULT || '/tmp/issue452-contexts-reproduction.json',JSON.stringify(results,null,2)+'\n');}
