import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { suite, assertFits } from './support.mjs';
const evidence = fileURLToPath(new URL('../../../docs/qa/ch2-daily/', import.meta.url));
fs.mkdirSync(evidence, { recursive: true });
const t = name => `[data-test="${name}"]`;
const map = '[data-destination-selection]:not(.done)';
async function setup(page, { money = 36000, unknown = false, reel = false } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ money, unknown, reel }) => {
    const core = await import('./js/core/state.js');
    const value = core.newGame();
    Object.assign(value, { chapter: 2, phase: 'daily', day: 15, slot: 2, money, stamina: 100, weatherSeed: 7 });
    value.flags = { _ch1_cleared: true, _ch2_day1: { startDay: 15, stage: 'complete', titleSeen: true },
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
    core.save();
    for (let i=1;i<=3;i++) localStorage.setItem(`suien_remake_slot${i}`, JSON.stringify({ ...value, money: 1000+i }));
    window.__remake.vnTest.turbo = true;
    (await import('./js/chapters/ch1.js')).setupHooks();
    window.__dailyTrace = [];
    const vn = await import('./js/vn/engine.js');
    vn.hooks.onLine = (id,line) => { if(window.__dailyTrace.at(-1)!==id) window.__dailyTrace.push(id); };
    void (await import('./js/chapters/ch2.js')).resumeChapterTwo();
  }, { money, unknown, reel });
  await page.locator(t('ch2-main-complete')).waitFor();
}
async function begin(page) { await page.locator(t('ch2-main-next-day')).click(); await page.locator(map).waitFor(); }
async function value(page) { return page.evaluate(() => structuredClone(window.__remake.state)); }
async function settled(page) { await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]')); } // #780: 新ピンの解錠演出中は選択を受け付けない
async function wide(page, touch = false) {
  await settled(page);
  const button = page.locator(t('map-region-widehanga'));
  if(touch) await button.tap(); else await button.click();
  await page.locator(`${map}[data-region="widehanga"]`).waitFor();
}
async function go(page, id, touch = false) {
  await settled(page);
  const pin = page.locator(t(`pin-${id}`));
  if(touch) await pin.tap(); else await pin.click();
  await settled(page);
  const button=page.locator(t('map-go'));
  if(touch) await button.tap(); else await button.click();
}
async function act(page,id,{touch=false}={}) {
  const before = await value(page);
  await go(page,id,touch);
  await page.waitForFunction(old => window.__remake.state.day > old.day || window.__remake.state.slot > old.slot,
    { day: before.day, slot: before.slot });
  await page.locator(`${map}, ${t('ch2-tournament-entry')}`).first().waitFor();
}
async function reloadSave(page, slot = 0) {
  await page.reload(); await page.locator(t('title-load')).click(); await page.locator(t(`slot-${slot}`)).click();
  await page.locator(`${map}, ${t('ch2-tournament-entry')}`).first().waitFor();
  await page.evaluate(() => { window.__remake.vnTest.turbo = true; });
}
async function capture(page,file) { await page.waitForTimeout(700); await page.screenshot({path:evidence+file}); }

await suite('ch2-daily',async check=>{
  await check('next-day-region-switch-and-autosave',async page=>{
    await setup(page,{reel:true}); await begin(page);
    let v=await value(page); assert.equal(v.day,16); assert.equal(v.slot,0); assert.equal(v.stamina,110);
    assert.match(await page.locator('.dc-day').textContent(),/^2\/14$/); assert.match(await page.locator('.dc-row').allTextContents().then(a=>a.join(' ')),/あと12日/);
    await capture(page,'day2-home.png'); await wide(page);
    await assertFits(page,'.map-regions button, .spot-pin');
    const overlaps=await page.evaluate(()=>{
      const controls=[...document.querySelectorAll('.map-regions button')].map(n=>n.getBoundingClientRect());
      return [...document.querySelectorAll('.spot-pin, .hud-card, .hud-stamina, .hud-level, .hud-lime, .hud-menu, .reel-widget')].map(n=>{
        const r=n.getBoundingClientRect();return {name:n.className,area:Math.max(...controls.map(c=>Math.max(0,Math.min(c.right,r.right)-Math.max(c.left,r.left))*Math.max(0,Math.min(c.bottom,r.bottom)-Math.max(c.top,r.top))))};
      });
    });
    for(const overlap of overlaps)assert(overlap.area<1,`City controls cover another control: ${JSON.stringify(overlap)}`);
    // mainの3店舗を保持し、今回追加するカフェだけを隣町へ接続する。
    assert.equal(await page.locator('.spot-pin[data-test^="pin-ch2_"]').count(),3);
    assert.deepEqual((await page.locator('.spot-pin').evaluateAll(nodes=>nodes.map(n=>n.dataset.test))).sort(),
      ['pin-ch2_ageha','pin-ch2_kumicho','pin-ch2_rei','pin-trpg_bar'].sort());
    await settled(page);await page.locator(t('pin-ch2_rei')).click();
    await page.locator('.mi-preview:not(.loading)').waitFor();
    const preview=await page.locator('.mi-preview').evaluate(async node=>{
      const src=node.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
      const image=new Image();image.src=src;await image.decode();return {src,width:image.naturalWidth,height:image.naturalHeight};
    });
    assert.match(preview.src,/bg_ch2_rei_entry.webp/);assert.equal(preview.width,1280);assert.equal(preview.height,720);
    await capture(page,'day2-widehanga.png');
    v=await value(page);assert.equal(v.money,36000);assert.equal(v.slot,0);assert(Object.values(v.stats).every(n=>n===31));
    await page.locator(t('hud-menu')).click();await page.locator(t('menu-save')).click();
    await page.locator(t('slot-0')).waitFor();
    assert.match(await page.locator(t('slot-0')).textContent(),/第2章・DAY 2/);
    assert(!/初日終了/.test(await page.locator(t('slot-0')).textContent()),'DAY2 saves must not keep the DAY1-complete caption');
    await page.locator(t('slot-1')).click();await page.locator(t('confirm-overwrite')).click();
    await page.locator('#modal.show').waitFor({state:'hidden'});
    await reloadSave(page,1);v=await value(page);assert.equal(v.day,16);assert.equal(v.slot,0);assert.equal(v.flags._ch2_region,'widehanga');
    assert.deepEqual(v.flavorStock,{mint:21.5,double_apple:6});assert.deepEqual(v.relationshipMemories,['qa_old_memory']);assert.deepEqual(v.loverSince,{minto:10});
    const slots=await page.evaluate(()=>[1,2,3].map(i=>JSON.parse(localStorage.getItem(`suien_remake_slot${i}`)).money));assert.deepEqual(slots,[36000,1002,1003]);
  });
  await check('paid-city-talk-repeat-and-contact',async page=>{
    await setup(page);await begin(page);await wide(page);await act(page,'ch2_ageha');
    let v=await value(page);assert.equal(v.money,33000);assert.equal(v.slot,1);assert.equal(v.stamina,95);
    assert.equal(v.flags._ch2_talks.ageha,1);assert.equal(v.visits.ageha,1);assert(v.contacts.includes('ageha'));
    assert.equal(Object.values(v.stats).reduce((a,b)=>a+b,0),157); // 2 normal points, not old 4-point amounts
    await page.locator(t('pin-ch2_ageha')).click();assert.match(await page.locator('.mi-no').textContent(),/今日はもう行った/);
    assert.equal(await page.locator(t('map-go')).count(),0);
    await page.locator(t('map-region-home')).click();await act(page,'rest');
    v=await value(page);assert.equal(v.day,17);assert.equal(v.slot,0);
    assert.equal(v.inbox.filter(i=>i.id==='lime_ch2_ageha_after_visit').length,1);
    await wide(page);await act(page,'ch2_ageha');v=await value(page);assert.equal(v.money,30000);assert.equal(v.flags._ch2_talks.ageha,2);
    assert((await page.evaluate(()=>window.__dailyTrace)).includes('remake_ch2_ageha_followup'));
    assert.equal(v.flags._ch2_followup_done.ageha,true);
    await reloadSave(page);v=await value(page);assert.equal(v.day,17);assert.equal(v.slot,1);assert.equal(v.flags._ch2_talks.ageha,2);
    await page.evaluate(async()=>{
      window.__dailyTrace=[];
      (await import('./js/vn/engine.js')).hooks.onLine=(id)=>{
        if(window.__dailyTrace.at(-1)!==id)window.__dailyTrace.push(id);
      };
    });
    await page.locator(t('map-region-home')).click();await act(page,'rest');
    await wide(page);await act(page,'ch2_ageha');v=await value(page);
    assert.equal(v.money,27000);assert.equal(v.flags._ch2_talks.ageha,3);
    // 続編のあとは、あげはの店に通う回を順に読む（#626）。全部読んだら従来の repeat に戻る
    assert((await page.evaluate(()=>window.__dailyTrace)).includes('remake_ch2_ageha_gyaru'));assert(v.flags._ch2_read_remake_ch2_ageha_gyaru);
  });
  await check('installed-reel-preserves-draw-on-reload',async page=>{
    await setup(page,{reel:true});await begin(page);await wide(page);await act(page,'ch2_rei');
    let v=await value(page);assert(v.reel.count>0);assert.equal(v.reel.lastChapter,2);assert.equal(v.slot,1);assert.equal(v.flags._ch2_talks.rei,1);
    const drawn=structuredClone(v); // リプレイで複数回転する場合も、確定した抽選と報酬をそのまま保存する。
    await reloadSave(page);v=await value(page);assert.equal(v.reel.count,drawn.reel.count,'Loading must not reroll the same visit');
    assert.equal(v.money,drawn.money);assert.deepEqual(v.stats,drawn.stats);
    assert.equal(v.slot,1);assert.equal(v.flags._ch2_talks.rei,1);
  });
  await check('touch-three-owners-and-fixed-day3-night',async page=>{
    await setup(page,{unknown:true});await begin(page);await wide(page,true);
    for(const id of ['ageha','kumicho','rei']) {await act(page,`ch2_${id}`,{touch:true});}
    await page.locator(t('map-region-home')).tap(); await act(page,'rest',{touch:true});
    let v=await value(page);assert.equal(v.day,18);assert.equal(v.slot,0);assert.equal(v.money,27000);
    assert(v.flags._ch2_naru_warm_done);for(const id of ['ageha','kumicho','rei'])assert.equal(v.flags._ch2_talks[id],1);
    const trace=await page.evaluate(()=>window.__dailyTrace);assert.equal(trace.filter(id=>id==='ch2_naru_warm').length,1);
    assert.equal(Object.values(v.stats).reduce((a,b)=>a+b,0),161,'Fixed Naru night must not award growth');
    await capture(page,'touch-day4-home.png');await reloadSave(page);v=await value(page);assert.equal(v.day,18);assert.equal(v.money,27000);
    assert.equal(await page.locator(t('ch2-main-next-day')).count(),0);
  },{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await check('preparation-json-failure-keeps-day1-and-retries',async page=>{
    let bad=true;await page.route('**/ch2_preparation.json',r=>bad?r.fulfill({status:200,body:'bad json'}):r.continue());
    await setup(page);await page.locator(t('ch2-main-next-day')).click();await page.locator(t('ch2-main-error')).waitFor();
    let v=await value(page);assert.equal(v.day,15);assert.equal(v.slot,2);assert(!v.flags._ch2_preparation_started);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('suien_remake_save')));assert.equal(saved.day,15);
    bad=false;await page.locator(t('ch2-main-retry')).click();await page.locator(map).waitFor();v=await value(page);assert.equal(v.day,16);assert.equal(v.money,36000);
  });
  await check('reload-unread-paid-room-keeps-last-action-point',async page=>{
    await setup(page);await begin(page);await wide(page);
    await page.evaluate(()=>{window.__remake.vnTest.turbo=false;});await go(page,'ch2_kumicho');await page.locator('#vn.active .vn-box').waitFor();
    assert.equal((await value(page)).money,33000);
    await reloadSave(page);const v=await value(page);assert.equal(v.day,16);assert.equal(v.slot,0);assert.equal(v.money,36000);assert.equal(v.flags._ch2_talks?.kumicho,undefined);
    assert.equal(Object.values(v.stats).reduce((a,b)=>a+b,0),155);
    await act(page,'ch2_kumicho');assert.equal((await value(page)).money,33000);
  });
  await check('unaffordable-city-visit-spends-nothing',async page=>{
    await setup(page,{money:2000});await begin(page);await wide(page);await settled(page);await page.locator(t('pin-ch2_rei')).click();
    assert.match(await page.locator('.mi-no').textContent(),/お金が足りない/);assert.equal(await page.locator(t('map-go')).count(),0);
    const v=await value(page);assert.equal(v.money,2000);assert.equal(v.slot,0);assert(Object.values(v.stats).every(n=>n===31));
  });
  await check('room-image-failure-preserves-cost-and-action',async page=>{
    let bad=true;await page.route('**/bg_ch2_rei_entry.webp',r=>bad?r.fulfill({status:200,contentType:'image/webp',body:'bad image'}):r.continue());
    await setup(page);await begin(page);await wide(page);await go(page,'ch2_rei');
    await page.locator(map).waitFor();let v=await value(page);assert.equal(v.money,36000);assert.equal(v.slot,0);assert.equal(v.flags._ch2_talks?.rei,undefined);
    bad=false;await act(page,'ch2_rei');v=await value(page);assert.equal(v.money,33000);assert.equal(v.slot,1);
  });
});
