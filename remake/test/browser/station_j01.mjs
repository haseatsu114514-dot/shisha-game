import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { suite } from './support.mjs';
const evidence = (process.env.COMPARISON_DIR || fileURLToPath(new URL('../../../docs/qa/ch2-daily/', import.meta.url))).replace(/\/?$/, '/');
fs.mkdirSync(evidence, { recursive: true });
const t = name => `[data-test="${name}"]`;
const map = '[data-destination-selection]:not(.done)';
async function setup(page, { money = 36000, unknown = false, reel = false, guest = null } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ money, unknown, reel, guest }) => {
    const core = await import('./js/core/state.js');
    const value = core.newGame();
    Object.assign(value, { chapter: 2, phase: 'daily', day: 15, slot: 2, money, stamina: 100, weatherSeed: 7 });
    value.flags = { _rei_trpg_introduced: true, _ch1_cleared: true, _ch2_day1: { startDay: 15, stage: 'complete', titleSeen: true },
      _ch2_city_visit_c_station: true, _lime_tut: 1, _lime_opened: true,
      _hiyori_meeting_done: true, _hiyori_message_delivered: true };
    value.stats = { technique: 31, sense: 31, guts: 31, charm: 31, insight: 31 };
    value.flavorStock = { mint: 21.5, double_apple: 6 }; value.keepsakes = ['qa_old_keepsake'];
    value.relationshipMemories = ['qa_old_memory']; value.loverSince = { minto: 10 }; value.lastDate = { minto: 13 };
    value.met = { hajime: true, sumi: true, naru: true, adam: true, minto: true, tsumugi: true,
      ageha: !unknown, kumicho: !unknown, rei: !unknown, volk: !unknown };
    value.contacts = ['sumi', 'naru'];
    value.reel.installed = reel;
    if (reel) Object.assign(value.reel, { introDone: true, settingGuideDone: true });
    for (const id of ['ageha', 'kumicho', 'rei']) value.flags[`_intro_${id}`] = !unknown;
    if (guest) {
      const { trainPassengers } = await import('./js/motions/train-passengers.js');
      for (let weatherSeed = 0; weatherSeed < 10000; weatherSeed++) {
        if (trainPassengers({ ...value, day: 16, slot: 0, weatherSeed }, { from: 'widehanga', to: 'home' }).cameo === guest) {
          value.weatherSeed = weatherSeed; break;
        }
      }
    }
    core.save();
    for (let i=1;i<=3;i++) localStorage.setItem(`suien_remake_slot${i}`, JSON.stringify({ ...value, money: 1000+i }));
    window.__remake.vnTest.turbo = true;
    (await import('./js/chapters/ch1.js')).setupHooks();
    window.__dailyTrace = [];
    const vn = await import('./js/vn/engine.js');
    vn.hooks.onLine = (id,line) => { if(window.__dailyTrace.at(-1)!==id) window.__dailyTrace.push(id); };
    void (await import('./js/chapters/ch2.js')).resumeChapterTwo();
  }, { money, unknown, reel, guest });
  await page.locator(t('ch2-main-complete')).waitFor();
}
async function begin(page) { await page.locator(t('ch2-main-next-day')).click(); await page.locator(t('ch2-morning-home')).click(); await page.locator(map).waitFor(); }
async function settled(page) { await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]')); }

for (const [name, options] of [['pc',{}],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
 await suite(`station-j01-${name}`,async check=>{
  const hit = (page, id) => name === 'touch' ? page.locator(t(id)).tap() : page.locator(t(id)).click();
  const loadRoundTrip = async page => {
   await hit(page,'hud-menu'); await hit(page,'menu-save'); await hit(page,'slot-1');
   if (await page.locator(t('confirm-overwrite')).isVisible()) await hit(page,'confirm-overwrite');
   await page.locator('#modal.show').waitFor({state:'hidden'});
   await hit(page,'hud-menu'); await hit(page,'menu-load'); await hit(page,'slot-1');
   await Promise.all([page.waitForEvent('load'),hit(page,'confirm-load')]);
   await page.locator('#screen .map:not(.done)').waitFor();
  };
  await check('chapter1-save-load',async page=>{
   await page.evaluate(async()=>{
    const core=await import('./js/core/state.js'); const s=core.newGame();
    Object.assign(s,{phase:'daily',day:6,slot:1,money:45678,stamina:73,weatherSeed:4});
    Object.assign(s.flags,{_morning_6:true,_errand_scout_done:true,_delivery_adam_done:true,_delivery_minto_done:true,_lime_tut:1,_lime_opened:true});
    (await import('./js/vn/engine.js')).vnTest.turbo=true; core.save();
    (await import('./js/scenes/title.js')).showTitle();
   });
   await hit(page,'title-load'); await hit(page,'slot-0'); await page.locator('#screen .map:not(.done)').waitFor();
   assert.equal(await page.locator(t('station-open')).count(),0);
   await page.screenshot({path:evidence+name+'-ch1.png'});
   await loadRoundTrip(page); assert.equal(await page.locator(t('station-open')).count(),0);
   assert.equal(await page.evaluate(()=>__remake.state.chapter),1);
   await page.screenshot({path:evidence+name+'-ch1-load.png'});
  },options);
  await check('chapter2-save-load-and-layout',async page=>{
   await setup(page,{reel:true}); await begin(page); await settled(page);
   const overlaps=await page.evaluate(()=>{const s=document.querySelector('[data-test="station-open"]').getBoundingClientRect(); return [...document.querySelectorAll('.spot-pin:not(.pin-station), .hud-card, .hud-stamina, .hud-level, .hud-lime, .hud-menu, .reel-widget, .map-info')].map(n=>{const r=n.getBoundingClientRect();return {name:n.dataset.test||n.className,area:Math.max(0,Math.min(s.right,r.right)-Math.max(s.left,r.left))*Math.max(0,Math.min(s.bottom,r.bottom)-Math.max(s.top,r.top))}}).filter(x=>x.area>1)});
   assert.deepEqual(overlaps,[]); await page.screenshot({path:evidence+name+'-ch2.png'});
   await hit(page,'station-open'); assert.equal(await page.locator(t('station-destination-widehanga')).count(),1); await hit(page,'station-cancel');
   await loadRoundTrip(page); assert.equal(await page.evaluate(()=>__remake.state.chapter),2);
   await page.locator(t('station-open')).waitFor(); await page.screenshot({path:evidence+name+'-ch2-load.png'});
  },options);
 });
}
