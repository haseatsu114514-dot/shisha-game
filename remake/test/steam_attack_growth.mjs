// #356: production bullets, controlled RAF/monotonic clock; no edits to #380's refresh suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { slashProfile, slashTouchesBullet, slashAngle, sharkPulseTouchesBullet } from '../js/craft/steam-slash.js';
import { installLoadingComicReader } from './browser/loading_reader.mjs';
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
const sideWord={x:40,y:-5,w:20,h:10};
assert(!slashTouchesBullet(sideWord,0,0,-Math.PI/2,80));assert(slashTouchesBullet(sideWord,0,0,-Math.PI/2,80,Math.PI/2));
assert(sharkPulseTouchesBullet({x:-100,y:0,w:20,h:10},0,0,120));assert(!sharkPulseTouchesBullet({x:121,y:0,w:20,h:10},0,0,120));
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath:process.env.CHROME_EXECUTABLE_PATH} : {})});
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots,{recursive:true});
const shot=async(page,name)=>{
  if(!shots)return;
  // Freeze a representative visual frame, not the game's collision/count state.
  await page.evaluate(()=>{
    window.shotAnimations=[...document.querySelectorAll('.dodge-word-cut,.dodge-slash-fx,.dodge-slash-impact')].flatMap(n=>n.getAnimations({subtree:true}));
    for(const animation of shotAnimations){animation.pause();animation.currentTime=100;}
  });
  await page.screenshot({path:`${shots}/${name}.png`});
  await page.evaluate(()=>shotAnimations.forEach(a=>a.play()));
};
try {
  for (const [mobile,afterglow,shark] of [[false,false,false],[true,false,false],[false,true,false],[false,false,true]]) {
    const page = await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:720},hasTouch:mobile,isMobile:mobile,reducedMotion:mobile?'reduce':'no-preference'});
    await installLoadingComicReader(page);
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
    await page.waitForSelector('[data-test="title-new"]');
    await page.evaluate(async({afterglow,shark})=>{
      window.captureGlow=afterglow;window.captureShark=shark;
      const core=await import('./js/core/state.js');core.newGame();core.state.flags._sumi_attack_learned=true;core.state.stamina=80;
      const growth=await import("./js/core/growth.js");growth.setGrowthPreview(afterglow||shark);if(afterglow)growth.ensureGrowth().nodes=["K22"];if(shark)Object.assign(growth.ensureGrowth(),{nodes:["M-W7"],learned:["M-W7"]});
      window.session=await import('./js/craft/session.js');window.steam=await import('./js/craft/steam.js');
      window.geometry=await import('./js/craft/steam-slash.js');
      __remake.craftTest.auto=null;Math.random=()=>.5;
      // The shared pause clock reads performance.now(), so advance it with RAF.
      // Real browser input, spawn, collision and recharge rules run unchanged.
      let id=0; window.frames=new Map();window.now=performance.now();
      const nativeRAF=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window);
      const nativeNow=performance.now.bind(performance);
      window.controlFrames=()=>{
        now=Math.max(now,nativeNow());performance.now=()=>now;
        window.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};
        window.cancelAnimationFrame=id=>frames.delete(id);
      };
      window.restoreFrames=()=>{window.requestAnimationFrame=nativeRAF;window.cancelAnimationFrame=nativeCancel;performance.now=nativeNow;};
      window.advance=()=>{now=Math.max(now,nativeNow())+20;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));};
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
            for(const [hx,hy] of [...(captureShark?[[target.x+target.w+reach*.5,target.y+target.h/2]]:[]),[target.x-12,target.y+target.h+reach*.3],[target.x+target.w+12,target.y+target.h+reach*.3],[target.x+target.w/2,target.y+target.h/2+reach*.65]]) {
              if(hx<16||hx>768||hy<16||hy>398)continue;
              if(all.some(b=>hx>=b.x-8&&hx<=b.x+b.w+8&&hy>=b.y-8&&hy<=b.y+b.h+8))continue;
              if(geometry.slashTouchesBullet(target,hx,hy,-Math.PI/2,reach,captureShark?Math.PI/2:undefined)&&(!captureShark||!geometry.slashTouchesBullet(target,hx,hy,-Math.PI/2,reach)))return screenPoint(hx,hy);
            }
          }
        return null;
      };
      window.strike=()=>{
        const wasGlow=document.querySelector('[data-test="dodge"]').dataset.afterglow==="true";
        let velocities=new Map();
        if(captureGlow){
          const original=new Map(enemies().map(b=>[b.node,b])),previousTime=now;advance();
          const dt=Math.min(.05,(now-previousTime)/1000);
          for(const b of enemies()){const p=original.get(b.node);if(p&&dt>0)velocities.set(b.node,{vx:(b.x-p.x)/dt,vy:(b.y-p.y)/dt});}
        }
        const before=Number(button().dataset.cutWords),profile=geometry.slashProfile(before);
        const all=enemies();let near=all.filter(b=>geometry.slashTouchesBullet(b,b.hx,b.hy,-Math.PI/2,profile.reach,captureShark?Math.PI/2:undefined));
        const lateral=near.some(b=>b.word&&!geometry.slashTouchesBullet(b,b.hx,b.hy,-Math.PI/2,profile.reach));
        if(captureShark&&Math.floor((before+near.filter(b=>b.word).length)/3)>Math.floor(before/3))near=[...new Set([...near,...all.filter(b=>geometry.sharkPulseTouchesBullet(b,b.hx,b.hy,profile.reach*1.5))])];
        const words=near.filter(b=>b.word).length;
        button().dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));
        let slowRatios=[];
        if(captureGlow){
          const original=new Map(enemies().map(b=>[b.node,b])),previousTime=now;advance();
          const dt=Math.min(.05,(now-previousTime)/1000);
          for(const b of enemies()){const p=original.get(b.node),v=velocities.get(b.node);if(p&&v&&dt>0&&Math.hypot(v.vx,v.vy)>1)slowRatios.push(Math.hypot(b.x-p.x,b.y-p.y)/dt/Math.hypot(v.vx,v.vy));}
        }
        const halves=[...document.querySelectorAll('.dodge-word-cut')];
        return {lateral,sharkPulse:!!document.querySelector('[data-test="shark-bite"][data-pulse="true"]'),wasGlow,slowRatios,glow:document.querySelector('[data-test="dodge"]').dataset.afterglow,before,words,pieces:halves.length,split:halves.every(n=>n.children.length===2&&n.children[0].textContent===n.children[1].textContent),still:halves.every(n=>[...n.children].every(h=>getComputedStyle(h).animationName==='none')),near:near.length,removed:near.every(b=>!b.node.isConnected),after:Number(button().dataset.cutWords),recharge:Number(button().dataset.cooldown),reach:Number(button().dataset.reach),feedback:document.querySelector('[data-test="slash-feedback"]').textContent};
      };
      start('drill');
    },{afterglow,shark});
    await page.waitForFunction(()=>window.button && button() && !button().disabled);
    await page.evaluate(()=>controlFrames());
    await page.waitForFunction(()=>frames.size>0,null,{polling:50});
    const move=async point=>{if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.move(point.x,point.y);};
    const shelter=async()=>move(await page.evaluate(()=>safePoint()));
    const dodgeFrames=async count=>{for(let i=0;i<count;i+=5){await shelter();await page.evaluate(n=>{for(let i=0;i<n;i++)advance();},Math.min(5,count-i));}};
    const seekShot=async()=>{for(let i=0;i<250;i++){const point=await page.evaluate(()=>wordShot());if(point)return point;await dodgeFrames(5);}return null;};
    await shelter();
    // Visual fixture only: preserve a word's own rotation and cut in world stroke direction.
    const rotated=await page.evaluate(()=>{
      const node=document.createElement('div');node.className='dodge-word';node.textContent='斜めに来る言葉';
      node.style.transform='translate(320px, 120px) rotate(30deg)';document.querySelector('.dodge').append(node);
      const b={node,x:320,y:120,w:node.offsetWidth,h:node.offsetHeight};
      window.rotatedCut=geometry.buildWordCutFx(b,392,207,-Math.PI/2,80);node.remove();document.querySelector('.dodge').append(rotatedCut);
      const matrix=new DOMMatrix(rotatedCut.style.transform);
      return {angle:Math.atan2(matrix.b,matrix.a),clips:[...rotatedCut.children].map(n=>n.style.clipPath)};
    });
    assert(Math.abs(rotated.angle-Math.PI/6)<1e-6);assert(rotated.clips.every(p=>p.startsWith('polygon(')));assert.notEqual(rotated.clips[0],rotated.clips[1]);
    await shot(page,`cut-rotated-${mobile?'mobile-reduced':'desktop'}`);
    await page.evaluate(()=>rotatedCut.remove());
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-cut-words'),'0');
    // Empty shot starts cooldown but gives no growth. A repeated pointer can't attack again.
    const empty=await page.evaluate(()=>{const r=strike();strike();return {...r,uses:button().dataset.uses};});
    assert.equal(empty.after,0);assert.equal(empty.feedback,'空振り');assert.equal(empty.uses,'1');
    let total=0,cumulative=0,maxSeen=0,measuredSlow=false,lateralSeen=false,pulseSeen=false; const tiers=new Set([0]); let objectOnly=false;
    for(let attempt=0;attempt<12 && total<(afterglow||shark?3:6);attempt++) {
      const point=await seekShot();
      assert(point,'No reachable real word before steam end');await move(point);
      const result=await page.evaluate(()=>strike());
      assert(result.removed);assert.equal(result.after,result.before+result.words);
      assert.equal(result.pieces,result.words);assert(result.split,'Each cut word should leave two matching clipped halves');
      if(mobile)assert(result.still,'Reduced-motion word halves must not animate');
      if(result.words===0){objectOnly=true;assert.equal(result.after,result.before);}
      if(afterglow&&!result.wasGlow&&Math.floor(result.after/3)>Math.floor(result.before/3)){
        measuredSlow=true;assert.equal(result.glow,"true");assert(result.slowRatios.length>0,"observe surviving real bullets");
        // CSS transform行列の丸め誤差は0.2%未満。速度が0.65倍かを実移動で検査する。
        for(const ratio of result.slowRatios)assert(Math.abs(ratio-.65)<.002,`real motion slowdown ${ratio}`);
      }
      lateralSeen ||= result.lateral;pulseSeen ||= result.sharkPulse;
      total=result.after;cumulative+=result.words;maxSeen=Math.max(maxSeen,result.after);
      const p=slashProfile(total),newTier=!tiers.has(p.tier);tiers.add(p.tier);
      assert.equal(result.reach,p.reach);assert(result.recharge>=p.recharge && result.recharge<=p.recharge+.1+1e-9);
      assert.match(result.feedback,shark?/個噛んだ/:/個斬った/);
      if(newTier)await shot(page,`tier-${p.tier}-${mobile?'mobile-reduced':'desktop'}`);
      await shelter();
    }
    if(shark){
      assert(total>=3&&lateralSeen&&pulseSeen,"learned shark must bite sideways and pulse at three words");
      await page.evaluate(()=>{for(let i=0;i<1800&&frames.size;i++)advance();restoreFrames();});
      await page.waitForSelector('.result-card.show');assert(await page.evaluate(()=>cs.steam.sharkPulses>=1));
      assert.equal(await page.locator('.dodge-slash-fx,.dodge-slash-impact,.dodge-word-cut').count(),0);assert.deepEqual(errors,[]);
      console.log('[attack growth] PASS: learned M-W7 real lateral word hits, three-combo radial bite, jaws and cleanup');await page.close();continue;
    }
    if(afterglow){
      assert(total>=3&&measuredSlow,"K22 must slow actual surviving bullets after three consecutive cuts");
      await dodgeFrames(170);assert.equal(await page.locator('[data-test="dodge"]').getAttribute('data-afterglow'),'false',"the slowdown expires after three seconds");
      await page.evaluate(()=>{for(let i=0;i<1800&&frames.size;i++)advance();restoreFrames();});
      await page.waitForSelector('.result-card.show');assert(await page.evaluate(()=>cs.steam.afterglows>=1));
      assert.equal(await page.locator('.dodge-slash-fx,.dodge-slash-impact,.dodge-word-cut,.dodge-refresh-fx').count(),0);
      assert.deepEqual(errors,[]);console.log('[attack growth] PASS: K22 real bullet motion x0.65, three-cut trigger, three-second expiry and cleanup');
      await page.close();continue;
    }
    assert(total>=6);assert(tiers.has(1)&&tiers.has(2),'Both approved growth thresholds must be exercised');
    await page.evaluate(()=>document.fonts.ready);
    await shot(page,`strike-${mobile?'mobile-reduced':'desktop'}`);
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
    assert.equal(damage.reach,'80');assert.equal(damage.recharge,'1.8');assert.equal(Number(damage.total),cumulative);
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
            // Touch coordinates round to device pixels: require a small robust margin.
            const stable=[-4,0,4].every(dx=>[-4,0,4].every(dy=>
              geometry.slashTouchesBullet(target,hx+dx,hy+dy,-Math.PI/2,reach)&&
              !all.some(b=>b.word&&geometry.slashTouchesBullet(b,hx+dx,hy+dy,-Math.PI/2,reach))));
            if(!stable)continue;
            const p=screenPoint(hx,hy),box=document.querySelector('.dodge');
            if(document.elementFromPoint(p.x,p.y)?.closest('.dodge')!==box)continue;
            window.smallTarget=target.node;
            return {hx,hy};
          }
        }
      }
      return null;
    });
    assert(smallPosition,'No isolated real small-object shot found');
    await page.waitForFunction(()=>!document.querySelector('.dodge').classList.contains('shake'),null,{polling:20});
    await page.evaluate(()=>{window.lastTouch=null;document.addEventListener('pointerdown',e=>{const r=document.querySelector('.dodge').getBoundingClientRect();window.lastTouch={type:e.pointerType,target:e.target.className,x:e.clientX,y:e.clientY,left:r.left,top:r.top,width:r.width,height:r.height};},{capture:true,once:true});});
    await move(await page.evaluate(({hx,hy})=>screenPoint(hx,hy),smallPosition));
    const small=await page.evaluate(()=>{const r=strike();const heart=new DOMMatrix(document.querySelector('.dodge-heart').style.transform);return {...r,removed:!smallTarget.isConnected,hx:heart.e+14,hy:heart.f+14,touch:lastTouch};});
    assert(small.removed&&small.near>0,JSON.stringify({small,smallPosition,errors}));assert.equal(small.after,small.before);objectOnly=true;
    await dodgeFrames(95);
    assert.equal(await page.locator('[data-test="dodge-slash"]').isEnabled(),true);
    await page.evaluate(()=>document.fonts.ready);
    await shot(page,`growth-${mobile?'mobile-reduced':'desktop'}`);
    await page.evaluate(()=>{for(let i=0;i<1800 && frames.size;i++)advance();restoreFrames();});
    await page.waitForSelector('.result-card.show');
    assert.equal(await page.locator('.dodge-slash-fx,.dodge-slash-impact,.dodge-word-cut,.dodge-refresh-fx').count(),0);
    assert.equal(await page.evaluate(()=>cs.steam.wordsCut),cumulative);
    if(afterglow)assert(await page.evaluate(()=>cs.steam.afterglows>=2));
    assert.equal(await page.evaluate(()=>cs.steam.combo),0);assert.equal(await page.evaluate(()=>cs.steam.maxCombo),maxSeen);
    // The next (initial practice) session resets growth and needs no new unlock flags.
    await page.evaluate(()=>{restoreFrames();start('tutorial');});
    await page.waitForFunction(() => document.querySelector('.bench-guide')?.open
      && document.querySelector('.bench-panel')?.inert);
    const guide = page.locator('.bench-guide summary');
    if (mobile) await guide.tap(); else await guide.click();
    // 新しい作業台は素材decode後に操作を作る。その待ち中はボタンがまだ無い。
    await page.waitForFunction(()=>button() && !button().disabled);
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-cut-words'),'0');
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-reach'),'80');
    assert.equal(await page.locator('[data-test="dodge-slash"]').getAttribute('data-recharge'),'1.8');
    assert.deepEqual(errors,[]);
    console.log(`[attack growth] PASS: ${mobile?'touch/reduced motion':afterglow?'PC + K22 actual motion':'PC'} real words, approved tiers, miss/repeat, refresh retention, damage breaks combo, total/maximum preserved, cleanup and initial-practice reset (object-only shot observed: ${objectOnly})`);
    await page.close();
  }
} finally {await browser.close();}
