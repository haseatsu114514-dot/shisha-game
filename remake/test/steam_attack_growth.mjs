// #356: production bullets, controlled RAF clock; no edits to #380's refresh suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { slashProfile, slashTouchesBullet, slashAngle } from '../js/craft/steam-slash.js';
const { chromium } = createRequire(import.meta.url)('playwright');
for (const [count, reach, recharge] of [[0,80,1.8],[2,80,1.8],[3,90,1.5],[5,90,1.5],[6,100,1.2],[50,100,1.2]]) {
  const p = slashProfile(count);
  assert.equal(p.reach, reach); assert.equal(p.recharge, recharge);
  for (const direction of ['u','r','d','l']) {
    const angle = slashAngle(direction);
    const b = distance => ({x:Math.cos(angle)*distance-1,y:Math.sin(angle)*distance-1,w:2,h:2});
    assert(slashTouchesBullet(b(reach),0,0,angle,reach));
    assert(!slashTouchesBullet(b(reach+3),0,0,angle,reach));
    assert(!slashTouchesBullet(b(-20),0,0,angle,reach));
  }
}
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath:process.env.CHROME_EXECUTABLE_PATH} : {})});
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots,{recursive:true});
try {
  for (const mobile of [false,true]) {
    const page = await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:720},hasTouch:mobile,isMobile:mobile,reducedMotion:mobile?'reduce':'no-preference'});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
    await page.waitForSelector('[data-test="title-new"]');
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js');core.newGame();core.state.stamina=80;
      window.session=await import('./js/craft/session.js');window.steam=await import('./js/craft/steam.js');
      window.geometry=await import('./js/craft/steam-slash.js');
      __remake.craftTest.auto=null;Math.random=()=>.5;
      // Only the steam RAF is controlled. Real browser input, spawn and collision run unchanged.
      let id=0; window.frames=new Map();window.now=performance.now();
      const nativeRAF=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window);
      window.controlFrames=()=>{
        window.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};
        window.cancelAnimationFrame=id=>frames.delete(id);
      };
      window.restoreFrames=()=>{window.requestAnimationFrame=nativeRAF;window.cancelAnimationFrame=nativeCancel;};
      window.advance=()=>{now=Math.max(now,performance.now())+20;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));};
      window.start=mode=>{window.cs=session.newSession(mode);cs.steamSeconds=600;session.openBench(cs);window.run=steam.runSteamDodge(cs);};
      window.button=()=>document.querySelector('[data-test="dodge-slash"]');
      window.enemies=()=>{
        const m=new DOMMatrix(document.querySelector('.dodge-heart').style.transform);
        return [...document.querySelectorAll('.dodge-word,.dodge-object')].map(node=>{const t=new DOMMatrix(node.style.transform);return {node,x:t.e,y:t.f,w:node.offsetWidth,h:node.offsetHeight,hx:m.e+14,hy:m.f+14,word:node.classList.contains('dodge-word')};});
      };
      window.strike=()=>{
        const before=Number(button().dataset.cutWords),profile=geometry.slashProfile(before);
        const near=enemies().filter(b=>geometry.slashTouchesBullet(b,b.hx,b.hy,-Math.PI/2,profile.reach));
        const words=near.filter(b=>b.word).length;
        button().dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));
        return {before,words,near:near.length,removed:near.every(b=>!b.node.isConnected),after:Number(button().dataset.cutWords),recharge:Number(button().dataset.cooldown),reach:Number(button().dataset.reach),feedback:document.querySelector('[data-test="slash-feedback"]').textContent};
      };
      start('drill');
    });
    await page.waitForFunction(()=>window.button && button() && !button().disabled);
    await page.evaluate(()=>controlFrames());
    await page.waitForFunction(()=>frames.size>0,null,{polling:50});
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-cut-words'),'0');
    // Empty shot starts cooldown but gives no growth. A repeated pointer can't attack again.
    const empty=await page.evaluate(()=>{const r=strike();strike();return {...r,uses:button().dataset.uses};});
    assert.equal(empty.after,0);assert.equal(empty.feedback,'空振り');assert.equal(empty.uses,'1');
    let total=0; const tiers=new Set([0]); let objectOnly=false;
    for(let attempt=0;attempt<12 && total<6;attempt++) {
      const result=await page.evaluate(()=>{
        for(let frame=0;frame<150;frame++) {
          advance();
          if(!button().disabled && enemies().some(b=>geometry.slashTouchesBullet(b,b.hx,b.hy,-Math.PI/2,Number(button().dataset.reach))))return strike();
        }
        return null;
      });
      assert(result,'No reachable real bullet before steam end');
      assert(result.removed);assert.equal(result.after,result.before+result.words);
      if(result.words===0){objectOnly=true;assert.equal(result.after,result.before);}
      total=result.after;
      const p=slashProfile(total);tiers.add(p.tier);
      assert.equal(result.reach,p.reach);assert(result.recharge>=p.recharge && result.recharge<=p.recharge+.1+1e-9);
      assert.match(result.feedback,/個斬った/);
    }
    assert(total>=6);assert(tiers.has(1)&&tiers.has(2),'Both approved growth thresholds must be exercised');
    await page.evaluate(()=>document.fonts.ready);
    if(shots)await page.screenshot({path:`${shots}/strike-${mobile?'mobile-reduced':'desktop'}.png`});
    assert.equal(await page.locator('[data-test="dodge-refresh"]').getAttribute('data-remaining'),'1');
    const refresh=await page.evaluate(()=>{
      const before=button().dataset.cutWords;
      document.querySelector('[data-test="dodge-refresh"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
      for(let i=0;i<65;i++)advance();
      return {before,after:button().dataset.cutWords,ready:!button().disabled,refreshCooldown:document.querySelector('[data-test="dodge-refresh"]').dataset.cooldown};
    });
    assert.equal(refresh.after,refresh.before);assert(refresh.ready);assert(Number(refresh.refreshCooldown)>6);
    // Let an actual incoming word hit; growth is retained, not a damage-reset combo.
    const damage=await page.evaluate(()=>{
      const before=button().dataset.cutWords,hits=Number(document.querySelector('[data-test="mental-trace"]').dataset.hits);
      for(let i=0;i<250;i++){advance();if(Number(document.querySelector('[data-test="mental-trace"]').dataset.hits)>hits)break;}
      return {before,after:button().dataset.cutWords,hitsBefore:hits,hitsAfter:Number(document.querySelector('[data-test="mental-trace"]').dataset.hits)};
    });
    assert(damage.hitsAfter>damage.hitsBefore);assert.equal(damage.after,damage.before);
    await page.evaluate(()=>document.fonts.ready);
    if(shots)await page.screenshot({path:`${shots}/growth-${mobile?'mobile-reduced':'desktop'}.png`});
    await page.evaluate(()=>{for(let i=0;i<1800 && frames.size;i++)advance();restoreFrames();});
    await page.waitForSelector('.result-card.show');
    assert.equal(await page.locator('.dodge-slash-fx,.dodge-slash-impact,.dodge-refresh-fx').count(),0);
    assert.equal(await page.evaluate(()=>cs.steam.wordsCut),total);
    // The next (initial practice) session resets growth and needs no new unlock flags.
    await page.evaluate(()=>{restoreFrames();start('tutorial');});
    await page.waitForFunction(()=>!button().disabled);
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-cut-words'),'0');
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-reach'),'80');
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-recharge'),'1.8');
    assert.deepEqual(errors,[]);
    console.log(`[attack growth] PASS: ${mobile?'touch/reduced motion':'PC'} real words, approved tiers, miss/repeat, refresh/damage retention, cleanup and initial-practice reset (object-only shot observed: ${objectOnly})`);
    await page.close();
  }
} finally {await browser.close();}
