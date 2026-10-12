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
      window.screenPoint=(hx,hy)=>{const r=document.querySelector('.dodge').getBoundingClientRect();return {x:r.left+hx*r.width/784,y:r.top+hy*r.height/414};};
      window.safePoint=()=>{
        const all=enemies();
        // The deterministic wave has its open lane through the middle; avoid entry edges.
        const corners=[[64,207],[720,207]];
        const distance=([x,y])=>Math.min(...all.map(b=>Math.hypot(x-Math.max(b.x,Math.min(x,b.x+b.w)),y-Math.max(b.y,Math.min(y,b.y+b.h)))),1000);
        corners.sort((a,b)=>distance(b)-distance(a));return screenPoint(...corners[0]);
      };
      window.wordShot=()=>{
          if(button().disabled)return null;
          const all=enemies(),reach=Number(button().dataset.reach);
          for(const target of all.filter(b=>b.word)) {
            for(const [hx,hy] of [[target.x-12,target.y+target.h+reach*.3],[target.x+target.w+12,target.y+target.h+reach*.3],[target.x+target.w/2,target.y+target.h/2+reach*.65]]) {
              if(hx<16||hx>768||hy<16||hy>398)continue;
              if(all.some(b=>hx>=b.x-8&&hx<=b.x+b.w+8&&hy>=b.y-8&&hy<=b.y+b.h+8))continue;
              if(geometry.slashTouchesBullet(target,hx,hy,-Math.PI/2,reach))return screenPoint(hx,hy);
            }
          }
        return null;
      };
      window.strike=()=>{
        const before=Number(button().dataset.cutWords),profile=geometry.slashProfile(before);
        const near=enemies().filter(b=>geometry.slashTouchesBullet(b,b.hx,b.hy,-Math.PI/2,profile.reach));
        const words=near.filter(b=>b.word).length;
        button().dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));
        const halves=[...document.querySelectorAll('.dodge-word-cut')];
        return {before,words,pieces:halves.length,split:halves.every(n=>n.children.length===2&&n.children[0].textContent===n.children[1].textContent),still:halves.every(n=>[...n.children].every(h=>getComputedStyle(h).animationName==='none')),near:near.length,removed:near.every(b=>!b.node.isConnected),after:Number(button().dataset.cutWords),recharge:Number(button().dataset.cooldown),reach:Number(button().dataset.reach),feedback:document.querySelector('[data-test="slash-feedback"]').textContent};
      };
      start('drill');
    });
    await page.waitForFunction(()=>window.button && button() && !button().disabled);
    await page.evaluate(()=>controlFrames());
    await page.waitForFunction(()=>frames.size>0,null,{polling:50});
    const move=async point=>{if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.move(point.x,point.y);};
    const shelter=async()=>move(await page.evaluate(()=>safePoint()));
    const dodgeFrames=async count=>{for(let i=0;i<count;i+=5){await shelter();await page.evaluate(n=>{for(let i=0;i<n;i++)advance();},Math.min(5,count-i));}};
    const seekShot=async()=>{for(let i=0;i<250;i++){const point=await page.evaluate(()=>wordShot());if(point)return point;await dodgeFrames(5);}return null;};
    await shelter();
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-cut-words'),'0');
    // Empty shot starts cooldown but gives no growth. A repeated pointer can't attack again.
    const empty=await page.evaluate(()=>{const r=strike();strike();return {...r,uses:button().dataset.uses};});
    assert.equal(empty.after,0);assert.equal(empty.feedback,'空振り');assert.equal(empty.uses,'1');
    let total=0; const tiers=new Set([0]); let objectOnly=false;
    for(let attempt=0;attempt<12 && total<6;attempt++) {
      const point=await seekShot();
      assert(point,'No reachable real word before steam end');await move(point);
      const result=await page.evaluate(()=>strike());
      assert(result.removed);assert.equal(result.after,result.before+result.words);
      assert.equal(result.pieces,result.words);assert(result.split,'Each cut word should leave two matching clipped halves');
      if(mobile)assert(result.still,'Reduced-motion word halves must not animate');
      if(result.words===0){objectOnly=true;assert.equal(result.after,result.before);}
      total=result.after;
      const p=slashProfile(total),newTier=!tiers.has(p.tier);tiers.add(p.tier);
      assert.equal(result.reach,p.reach);assert(result.recharge>=p.recharge && result.recharge<=p.recharge+.1+1e-9);
      assert.match(result.feedback,/個斬った/);
      if(shots&&newTier)await page.screenshot({path:`${shots}/tier-${p.tier}-${mobile?'mobile-reduced':'desktop'}.png`});
      await shelter();
    }
    assert(total>=6);assert(tiers.has(1)&&tiers.has(2),'Both approved growth thresholds must be exercised');
    await page.evaluate(()=>document.fonts.ready);
    if(shots)await page.screenshot({path:`${shots}/strike-${mobile?'mobile-reduced':'desktop'}.png`});
    assert.equal(await page.locator('[data-test="dodge-refresh"]').getAttribute('data-remaining'),'1');
    const refresh=await page.evaluate(()=>{
      const before=button().dataset.cutWords;
      document.querySelector('[data-test="dodge-refresh"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
      return {before,after:button().dataset.cutWords};
    });
    assert.equal(refresh.after,refresh.before);
    await dodgeFrames(65);
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-cut-words'),refresh.before);
    assert(await page.locator('[data-test="dodge-slash"]').isEnabled());
    assert(Number(await page.locator('[data-test="dodge-refresh"]').getAttribute('data-cooldown'))>6);
    // Move onto a real incoming bullet: actual damage must break the combo.
    const impact=await page.evaluate(()=>{
      for(let frame=0;frame<100;frame++) {
        const b=enemies().find(b=>b.x+b.w/2>=16&&b.x+b.w/2<=768&&b.y+b.h/2>=16&&b.y+b.h/2<=398);
        if(b)return screenPoint(b.x+b.w/2,b.y+b.h/2);advance();
      }
      return null;
    });
    assert(impact,'No real damage opportunity');await move(impact);
    const damage=await page.evaluate(()=>{
      const before=button().dataset.cutWords,hits=Number(document.querySelector('[data-test="mental-trace"]').dataset.hits);
      for(let i=0;i<250;i++){advance();if(Number(document.querySelector('[data-test="mental-trace"]').dataset.hits)>hits)break;}
      return {before,after:button().dataset.cutWords,reach:button().dataset.reach,recharge:button().dataset.recharge,total:button().dataset.totalWordsCut,hitsBefore:hits,hitsAfter:Number(document.querySelector('[data-test="mental-trace"]').dataset.hits)};
    });
    assert(Number(damage.before)>=6);assert.equal(damage.hitsAfter,damage.hitsBefore+1);assert.equal(damage.after,'0');
    assert.equal(damage.reach,'80');assert.equal(damage.recharge,'1.8');assert.equal(Number(damage.total),total);
    await shelter();
    // Find a real small object and a firing position that excludes every word.
    const smallPosition=await page.evaluate(()=>{
      for(let frame=0;frame<200;frame++) {
        advance();if(button().disabled)continue;
        const all=enemies(),reach=Number(button().dataset.reach);
        for(const target of all.filter(b=>!b.word&&b.w<=40&&b.h<=40)) {
          for(const [dx,dy] of [[0,25],[30,40],[-30,40],[55,55],[-55,55],[0,70]]) {
            const hx=target.x+target.w/2+dx,hy=target.y+target.h/2+dy;
            if(hx<16||hx>768||hy<16||hy>398)continue;
            const near=all.filter(b=>geometry.slashTouchesBullet(b,hx,hy,-Math.PI/2,reach));
            if(!near.includes(target)||near.some(b=>b.word))continue;
            const box=document.querySelector('.dodge'),r=box.getBoundingClientRect();
            window.smallTarget=target.node;
            return {x:r.left+hx*r.width/784,y:r.top+hy*r.height/414};
          }
        }
      }
      return null;
    });
    assert(smallPosition,'No isolated real small-object shot found');
    if(mobile)await page.touchscreen.tap(smallPosition.x,smallPosition.y);else await page.mouse.click(smallPosition.x,smallPosition.y);
    const small=await page.evaluate(()=>{const r=strike();return {...r,removed:!smallTarget.isConnected};});
    assert(small.removed&&small.near>0);assert.equal(small.after,small.before);objectOnly=true;
    await dodgeFrames(95);
    assert.equal(await page.locator('[data-test="dodge-slash"]').isEnabled(),true);
    await page.evaluate(()=>document.fonts.ready);
    if(shots)await page.screenshot({path:`${shots}/growth-${mobile?'mobile-reduced':'desktop'}.png`});
    await page.evaluate(()=>{for(let i=0;i<1800 && frames.size;i++)advance();restoreFrames();});
    await page.waitForSelector('.result-card.show');
    assert.equal(await page.locator('.dodge-slash-fx,.dodge-slash-impact,.dodge-word-cut,.dodge-refresh-fx').count(),0);
    assert.equal(await page.evaluate(()=>cs.steam.wordsCut),total);
    assert.equal(await page.evaluate(()=>cs.steam.combo),0);assert.equal(await page.evaluate(()=>cs.steam.maxCombo),total);
    // The next (initial practice) session resets growth and needs no new unlock flags.
    await page.evaluate(()=>{restoreFrames();start('tutorial');});
    await page.waitForFunction(()=>!button().disabled);
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-cut-words'),'0');
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-reach'),'80');
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-recharge'),'1.8');
    assert.deepEqual(errors,[]);
    console.log(`[attack growth] PASS: ${mobile?'touch/reduced motion':'PC'} real words, approved tiers, miss/repeat, refresh retention, damage breaks combo, total/maximum preserved, cleanup and initial-practice reset (object-only shot observed: ${objectOnly})`);
    await page.close();
  }
} finally {await browser.close();}
