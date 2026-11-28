// #356: production bullets, controlled RAF/monotonic clock; no edits to #380's refresh suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { slashProfile, slashTouchesBullet, slashAngle, sharkPulseTouchesBullet } from '../../js/craft/steam-slash.js';
import { installLoadingComicReader } from './loading_reader.mjs';
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
        now=nativeNow();performance.now=()=>now;
        window.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};
        window.cancelAnimationFrame=id=>frames.delete(id);
      };
      window.restoreFrames=()=>{window.requestAnimationFrame=nativeRAF;window.cancelAnimationFrame=nativeCancel;performance.now=nativeNow;};
      window.advance=()=>{now+=20;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));};
      window.start=mode=>{window.cs=session.newSession(mode);cs.steamSeconds=600;session.openBench(cs);window.run=steam.runSteamDodge(cs);};
      window.button=()=>document.querySelector('[data-test="dodge-slash"]');
      window.enemies=()=>{
        const m=new DOMMatrix(document.querySelector('.dodge-heart').style.transform);
        return [...document.querySelectorAll('.dodge-word,.dodge-object')].map(node=>{const t=new DOMMatrix(node.style.transform);return {node,x:t.e,y:t.f,w:node.offsetWidth,h:node.offsetHeight,hx:m.e+14,hy:m.f+14,word:node.classList.contains('dodge-word')};});
      };
      window.screenPoint=(hx,hy)=>{const r=document.querySelector('.dodge').getBoundingClientRect();return {x:r.left+hx*r.width/784,y:r.top+hy*r.height/414};};
      window.inRange = () => {
        const reach = Number(button().dataset.reach);
        return enemies().filter(b => geometry.slashTouchesBullet(b, b.hx, b.hy, -Math.PI/2, reach, captureShark ? Math.PI/2 : undefined));
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
      // Let the real countdown finish, then capture the very first gameplay RAF.
      // Both the first spawn and the recharge clock start at the same frame on every host.
      window.startDrill = () => {
        restoreFrames();
        frames.clear();
        const oldButton = button();
        window.requestAnimationFrame = callback => {
          if (!button() || button() === oldButton || button().disabled) return nativeRAF(callback);
          controlFrames();
          return window.requestAnimationFrame(callback);
        };
        start('drill');
      };
      startDrill();
    },{afterglow,shark});
    const waitForDrill = () => page.waitForFunction(
      () => window.button && button() && !button().disabled && frames.size > 0, null, {polling:50},
    );
    await waitForDrill();
    // Move at the production speed. A touch target exists only while the finger is down.
    const touch = mobile ? await page.context().newCDPSession(page) : null;
    let touching = false;
    const aim = async (x, y) => {
      const point = await page.evaluate(([x,y]) => screenPoint(x,y), [x,y]);
      if (!touch) return page.mouse.move(point.x, point.y);
      await touch.send('Input.dispatchTouchEvent', {
        type: touching ? 'touchMove' : 'touchStart', touchPoints: [{...point, id: 1}],
      });
      touching = true;
    };
    // Look one short movement ahead. Incoming projectiles are aimed at the
    // heart's previous position, so it can stand still until it needs to dodge.
    const patrol = async () => {
      const point = await page.evaluate(() => {
        const before = new Map(enemies().map(b => [b.node, b]));
        advance();
        const bullets = enemies().map(b => {
          const prev = before.get(b.node) || b;
          return {...b, dx:b.x-prev.x, dy:b.y-prev.y};
        });
        const heart = new DOMMatrix(document.querySelector('.dodge-heart').style.transform);
        const hx = heart.e + 14, hy = heart.f + 14;
        const diagonal = Math.SQRT1_2;
        const directions = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
          [-diagonal, -diagonal], [diagonal, -diagonal], [-diagonal, diagonal], [diagonal, diagonal]];
        const step = steam.STEAM_TUNING.speed * 0.02;
        let best;
        for (const [dx, dy] of directions) {
          let clearance = 100;
          for (let t=2; t<=18; t+=2) {
            const x = Math.max(24,Math.min(760,hx+dx*step*t));
            const y = Math.max(24,Math.min(390,hy+dy*step*t));
            for (const b of bullets) {
              const bx = b.x+b.dx*t, by=b.y+b.dy*t;
              clearance = Math.min(clearance, Math.hypot(Math.max(bx-x,0,x-bx-b.w), Math.max(by-y,0,y-by-b.h)));
            }
          }
          const x = Math.max(24,Math.min(760,hx+dx*105));
          const y = Math.max(24,Math.min(390,hy+dy*105));
          // Favor the middle of the board once the next 360 ms of travel are safe.
          const score = Math.min(clearance,20) - .035*Math.hypot(x-392,y-207) + (!dx&&!dy ? 3 : 0);
          if (!best || score>best.score) best={x,y,score};
        }
        return best;
      });
      await aim(point.x, point.y);
    };
    const tick = async count => page.evaluate(count => { for (let i=0; i<count; i++) advance(); }, count);
    const dodgeFrames = async count => {
      for (let i=0; i<count; i+=5) {
        await patrol();
        await tick(Math.min(4, count-i-1));
      }
    };
    const seekShot = async kind => {
      for (let i=0; i<1000; i+=5) {
        await patrol();
        const state = await page.evaluate(kind => {
          for (let i=0; i<4; i++) {
            if (!frames.size) return 'ended';
            const near = inRange();
            const hasWord = near.some(b => b.word);
            const lateral = !captureShark || near.some(b => b.word && !geometry.slashTouchesBullet(b, b.hx, b.hy, -Math.PI/2, Number(button().dataset.reach)));
            const small = near.find(b => !b.word && b.w <= 40 && b.h <= 40);
            if (!button().disabled && (kind === 'word' ? hasWord && lateral : !hasWord && small)) {
              if (small) window.smallTarget = small.node;
              return 'ready';
            }
            advance();
          }
          return 'moving';
        }, kind);
        if (state === 'ready') return true;
        if (state === 'ended') break;
      }
      return false;
    };
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
    let total=0,cumulative=0,maxSeen=0,measuredSlow=false,lateralSeen=false,pulseSeen=false; const tiers=new Set([0]);
    for(let attempt=0;attempt<12 && total<(afterglow||shark?3:6);attempt++) {
      assert(await seekShot('word'), 'No reachable real word before steam end');
      const result=await page.evaluate(()=>strike());
      assert(result.removed);assert.equal(result.after,result.before+result.words);
      assert.equal(result.pieces,result.words);assert(result.split,'Each cut word should leave two matching clipped halves');
      if(mobile)assert(result.still,'Reduced-motion word halves must not animate');
      if(afterglow&&!result.wasGlow&&Math.floor(result.after/3)>Math.floor(result.before/3)){
        measuredSlow=true;assert.equal(result.glow,"true");assert(result.slowRatios.length>0,"observe surviving real bullets");
        // CSS transform行列の丸め誤差は0.2%未満。速度が0.65倍かを実移動で検査する。
        for(const ratio of result.slowRatios)assert(Math.abs(ratio-.65)<.002,`real motion slowdown ${ratio}`);
      }
      lateralSeen ||= result.lateral;pulseSeen ||= result.sharkPulse;
      total=result.after;cumulative+=result.words;maxSeen=Math.max(maxSeen,result.after);
      const p=slashProfile(total),newTier=!tiers.has(p.tier);tiers.add(p.tier);
      assert.equal(result.reach,p.reach);assert(result.recharge>=p.recharge && result.recharge<=p.recharge+.1+1e-9);
      const feedback = result.near ? `${result.near}個${shark ? "噛んだ" : "斬った"}` : "空振り";
      assert.equal(result.feedback.split("・")[0], feedback, "範囲内の弾の個数と空振りを区別する");
      if(newTier)await shot(page,`tier-${p.tier}-${mobile?'mobile-reduced':'desktop'}`);

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
    // Hold a fixed target and let the next aimed projectile hit the heart.
    const heart = await page.locator('.dodge-heart').evaluate(n => new DOMMatrix(n.style.transform).e + 14);
    await aim(heart, 207);
    const damage=await page.evaluate(()=>{
      const before=button().dataset.cutWords,hits=Number(document.querySelector('[data-test="mental-trace"]').dataset.hits);
      for(let i=0;i<250;i++){advance();if(Number(document.querySelector('[data-test="mental-trace"]').dataset.hits)>hits)break;}
      return {before,after:button().dataset.cutWords,reach:button().dataset.reach,recharge:button().dataset.recharge,total:button().dataset.totalWordsCut,hitsBefore:hits,hitsAfter:Number(document.querySelector('[data-test="mental-trace"]').dataset.hits)};
    });
    assert(Number(damage.before)>=6);assert.equal(damage.hitsAfter,damage.hitsBefore+1);assert.equal(damage.after,'0');
    assert.equal(damage.reach,'80');assert.equal(damage.recharge,'1.8');assert.equal(Number(damage.total),cumulative);
    await page.evaluate(()=>document.fonts.ready);
    await shot(page,`growth-${mobile?'mobile-reduced':'desktop'}`);
    await page.evaluate(()=>{for(let i=0;i<1800 && frames.size;i++)advance();restoreFrames();});
    await page.waitForSelector('.result-card.show');
    assert.equal(await page.locator('.dodge-slash-fx,.dodge-slash-impact,.dodge-word-cut,.dodge-refresh-fx').count(),0);
    assert.equal(await page.evaluate(()=>cs.steam.wordsCut),cumulative);
    assert.equal(await page.evaluate(()=>cs.steam.combo),0);assert.equal(await page.evaluate(()=>cs.steam.maxCombo),maxSeen);
    // Use a fresh drill for the isolated object so a late spawn in the combo
    // scenario cannot exhaust the play clock before the object reaches the heart.
    if (touching) {
      await touch.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      touching = false;
    }
    await page.evaluate(() => startDrill());
    await waitForDrill();
    assert(await seekShot('object'), 'No isolated real small-object shot before steam end');
    const small = await page.evaluate(() => ({ ...strike(), targetRemoved: !smallTarget.isConnected }));
    assert(small.targetRemoved && small.near > 0);
    assert.equal(small.words, 0);
    assert.equal(small.after, small.before);
    await dodgeFrames(95);
    assert(await page.locator('[data-test="dodge-slash"]').isEnabled());
    await page.evaluate(()=>{for(let i=0;i<1800 && frames.size;i++)advance();restoreFrames();});
    await page.waitForSelector('.result-card.show');
    // The next (initial practice) session resets growth and needs no new unlock flags.
    if (touching) await touch.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
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
    console.log(`[attack growth] PASS: ${mobile?'touch/reduced motion':afterglow?'PC + K22 actual motion':'PC'} real words, approved tiers, miss/repeat, refresh retention, damage breaks combo, total/maximum preserved, cleanup and initial-practice reset and isolated small-object strike`);
    await page.close();
  }
} finally {await browser.close();}
