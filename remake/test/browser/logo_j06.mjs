import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
const shots = process.env.J06_SHOTS || '.codex/artifacts/logo-j06';
fs.mkdirSync(shots, {recursive:true});
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath:process.env.CHROME_EXECUTABLE_PATH} : {})});
const failures=[];
for (const [device, options] of [['pc',{viewport:{width:1280,height:720}}],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
 for (const fail of [false,true]) {
  const context=await browser.newContext(options), page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if (fail) await page.route('**/assets/ui/store_logos/*',route=>route.abort());
  try {
   await page.goto(base); await page.locator('[data-test="title-new"]').waitFor({timeout:30000});
   await page.evaluate(async()=>{
    const core=await import('./js/core/state.js'); const v=core.newGame();
    Object.assign(v,{chapter:1,phase:'cleared',day:14,slot:2,money:30000,stamina:80});
    v.owned.push('home_rig_set'); Object.assign(v.flags,{_ev_midcheck:true,_ch1_preview_seen:true,_minto_name_known:true,_minto_identity_known:true});
    v.met={hajime:true,sumi:true,minto:true}; core.save(); __remake.vnTest.turbo=true;
    (await import('./js/chapters/ch1.js')).setupHooks(); await (await import('./js/chapters/ch1.js')).showClear();
   });
   await page.locator('[data-test="end-chapter2"]').click();
   await page.locator('[data-test="ch2-main-map"]').waitFor({timeout:30000});
   if (fail) await page.locator('[data-test="ch2-main-pin-ageha"] .store-logo.missing').waitFor();
   else await page.locator('[data-test="ch2-main-pin-ageha"] img').waitFor();
   assert.equal(await page.locator('[data-test="ch2-main-pin-ch2_aquarium"], [data-test="ch2-main-pin-ch2_sento"], [data-test="ch2-main-pin-trpg_bar"]').count(),0);
   const info=await page.locator('.ch2-map-main .spot-pin').evaluateAll(nodes=>nodes.map(n=>{
    const img=n.querySelector('.store-logo img'), shield=n.querySelector('.shield');
    return {id:n.dataset.spot, branded:n.classList.contains('branded'), logo:n.querySelector('.store-logo')?.dataset.storeLogo,
      missing:!!n.querySelector('.store-logo.missing'), naturalWidth:img?.naturalWidth, filter:getComputedStyle(shield).filter,
      background:getComputedStyle(shield,'::before').backgroundColor, image:getComputedStyle(shield,'::before').backgroundImage,
      opacity:getComputedStyle(n).opacity};
   }));
   console.log(device,fail?'failed-image':'initial',JSON.stringify(info));
   await page.screenshot({path:path.join(shots,`${device}-${fail?'failed':'initial'}.png`)});
   const pin=page.locator('[data-test="ch2-main-pin-ageha"]');
   if(device==='touch') await pin.tap(); else await pin.click();
   assert.equal(await pin.getAttribute('aria-pressed'),'true');
   await page.screenshot({path:path.join(shots,`${device}-${fail?'failed-selected':'selected'}.png`)});
   if(fail) {
    for (const [id, name] of [['ageha','MELTY PUFF'],['kumicho','神崎煙草店'],['rei','零-ZERO-'],['c_station','C.STATION'],['ch2_shop','Dr.fookah 柚ヶ谷店'],['ch2_c_station','C.STATION 柚ヶ谷店']]) {
     const missing=page.locator(`[data-test="ch2-main-pin-${id}"] .store-logo.missing`);
     await missing.waitFor(); assert.equal(await missing.innerText(),name);
    }
    assert.equal(await page.locator('[data-test="ch2-main-go"]').count(),1);
    await page.evaluate(async()=>{
     const {storeLogo}=await import('./js/core/store-logos.js');
     for (const id of ['ch2_aquarium','ch2_sento','trpg_bar']) document.body.append(storeLogo(id));
    });
    for(const [id,name] of [['ch2_aquarium','都市型水族館'],['ch2_sento','銭湯・サウナ'],['trpg_bar','ボドゲカフェ / TRPG BAR']]) {
     const missing=page.locator(`body > .store-logo.missing[data-store-logo="${id}"]`);
     await missing.waitFor(); assert.equal(await missing.innerText(),name);
    }
   }
   else {
    assert(info.filter(x=>x.logo).every(x=>x.naturalWidth>0),JSON.stringify(info));
    assert(info.filter(x=>x.logo).every(x=>x.branded && x.background==='rgb(255, 250, 240)' && x.image==='none'),JSON.stringify(info));
    await page.reload(); await page.locator('[data-test="title-load"]').click(); await page.locator('[data-test="slot-0"]').click();
    await page.locator('[data-test="ch2-main-map"]').waitFor({timeout:30000});
    assert(await page.locator('[data-test="ch2-main-pin-ageha"] img').evaluate(i=>i.complete && i.naturalWidth===768));
    await page.screenshot({path:path.join(shots,`${device}-cached.png`)});
    await page.evaluate(async()=>{
     Object.assign(__remake.state.flags,{_ageha_aquarium_introduced:true,_kumicho_sento_introduced:true,_rei_trpg_introduced:true});
     __remake.vnTest.turbo=true; void (await import('./js/chapters/ch2.js')).resumeChapterTwo();
    });
    for (const id of ['ch2_aquarium','ch2_sento','trpg_bar']) {
     const unlocked=page.locator(`[data-test="ch2-main-pin-${id}"]`);
     await unlocked.waitFor(); await unlocked.locator('img').evaluate(i=>i.decode());
     assert(await unlocked.evaluate(n=>n.classList.contains('branded') && n.querySelector('img').naturalWidth===768));
    }
    await page.screenshot({path:path.join(shots,`${device}-unlocked.png`)});
   }
   assert.deepEqual(errors,[]); console.log('PASS',device,fail?'failure fallback':'normal and cache');
  } catch(e) { failures.push(`${device}/${fail}: ${e.stack}`); }
  finally { await context.close(); }
 }
}
await browser.close();
assert.deepEqual(failures,[]);
