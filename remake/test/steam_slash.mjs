import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { slashTouchesBullet, slashAngle, SLASH_RECHARGE_SECONDS } from '../js/craft/steam-slash.js';
const { chromium } = createRequire(import.meta.url)('playwright');

const b=(x,y,w=8,h=8)=>({x,y,w,h});
assert(slashTouchesBullet(b(70,-4),0,0,0));
assert(!slashTouchesBullet(b(-80,-4),0,0,0),'Behind the heart must survive');
assert(!slashTouchesBullet(b(81,-4),0,0,0),'Beyond 80px must survive');
assert(!slashTouchesBullet(b(10,80),0,0,0),'Outside the fan must survive');
assert(slashTouchesBullet(b(76,-30,3,60),0,0,0),'Arc crossing a long edge must cut');
assert(slashTouchesBullet(b(-200,-84,220,8),0,0,-Math.PI/2),'Visible end of a long word must cut');
for (const [direction,bullet] of [['u',b(-4,-80)],['r',b(80,-4)],['d',b(-4,80)],['l',b(-80,-4)]]) {
  assert(slashTouchesBullet(bullet,0,0,slashAngle(direction)),direction);
}
console.log('[slash geometry] PASS: front/back/reach/edges and rotated geometry boundaries');

const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
const shots=process.env.SHOTS,errors=[];
if(shots)fs.mkdirSync(shots,{recursive:true});
const shot=async(page,name)=>{if(shots)await page.screenshot({path:`${shots}/${name}.png`});};
try {
  for(const [name,viewport,mobile] of [['desktop',{width:1280,height:720},false],['mobile',{width:844,height:390},true]]) {
    const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.BASE_URL||'http://127.0.0.1:8123/remake/');
    await page.waitForSelector('[data-test="title-new"]');
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js');core.newGame();core.state.flags._sumi_attack_learned=true;core.state.stamina=80;
      core.state.stats.guts=10;core.state.stats.insight=10;
      const session=await import('./js/craft/session.js'),steam=await import('./js/craft/steam.js');
      __remake.craftTest.auto=null;window.cs=session.newSession('drill');cs.steamSeconds=600;
      session.openBench(cs);Math.random=()=>.5;window.run=steam.runSteamDodge(cs);
      const geometry=await import('./js/craft/steam-slash.js');
      window.canCut=(b)=>geometry.slashTouchesBullet(b,b.hx,b.hy,-Math.PI/2);
      window.enemies=()=>{
        const m=new DOMMatrix(document.querySelector('.dodge-heart').style.transform),hx=m.e+14,hy=m.f+14;
        return [...document.querySelectorAll('.dodge-word,.dodge-object')].map(node=>{
          const t=new DOMMatrix(node.style.transform);
          return {node,x:t.e,y:t.f,w:node.offsetWidth,h:node.offsetHeight,hx,hy};
        });
      };
    });
    const button=page.locator('[data-test="dodge-slash"]');
    await button.waitFor();assert(await button.isDisabled());
    await page.waitForFunction(()=>!document.querySelector('[data-test="dodge-slash"]').disabled);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>[...document.querySelectorAll('.bench img[src]')].filter(i=>i.getClientRects().length).every(i=>i.complete&&i.naturalWidth));
    const look=await page.evaluate(()=>{
      const heart=document.querySelector('.dodge-heart'),core=heart.querySelector('.dodge-core'),pad=document.querySelector('.dodge-pad'),knob=pad.querySelector('.dodge-knob');
      const h=heart.getBoundingClientRect(),c=core.getBoundingClientRect(),p=pad.getBoundingClientRect(),k=knob.getBoundingClientRect(),scale=p.width/pad.offsetWidth;
      return {color:getComputedStyle(heart).color,shield:heart.classList.contains('shield'),white:getComputedStyle(core).backgroundColor,width:core.offsetWidth,expected:parseFloat(heart.style.getPropertyValue('--hit-diameter')),
        artWidth:heart.querySelector('svg').getBoundingClientRect().width/(h.width/heart.offsetWidth),
        artHeight:heart.querySelector('svg').getBoundingClientRect().height/(h.height/heart.offsetHeight),
        centered:Math.abs(h.x+h.width/2-c.x-c.width/2)<.2&&Math.abs(h.y+h.height/2-c.y-c.height/2)<.2,
        extra:getComputedStyle(core,'::after').content,lift:(p.y+p.height/2-k.y-k.height/2)/scale};
    });
    assert.equal(look.white,'rgb(255, 255, 255)');assert(Math.abs(look.width-look.expected)<1&&look.centered);
    assert(Math.abs(look.artWidth-20)<.1&&Math.abs(look.artHeight-20)<.1, 'Heart artwork should be 20px; the white hit circle keeps its existing radius');
    assert(look.expected>0&&look.expected<8, 'Good-condition white circle should be smaller than the standard 8px diameter');
    assert.equal(look.extra,'none');assert(Math.abs(look.lift-10)<.2);
    assert.equal(look.color,look.shield?'rgb(239, 135, 149)':'rgb(112, 215, 237)','Artwork color must match the actual damage state, including hits during asset/font waits');
    await shot(page,`controls-${name}`);
    // ノブの見た目の中心を押しても、ハートが勝手に動かない。
    const knob=await page.locator('.dodge-knob').boundingBox();
    const neutral={x:knob.x+knob.width/2,y:knob.y+knob.height/2,id:1};
    const touch=mobile?await page.context().newCDPSession(page):null;
    const center=()=>page.locator('.dodge-heart').evaluate(n=>n.style.transform);
    const before=await center();
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[neutral]});
    else {await page.mouse.move(neutral.x,neutral.y);await page.mouse.down();}
    await page.waitForTimeout(180);assert.equal(await center(),before,'Visible knob center caused drift');
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
    await page.waitForFunction(()=>enemies().some(b=>canCut(b))&&enemies().some(b=>!canCut(b)&&b.hy-b.y-b.h>90));
    const cut=await page.evaluate(()=>{
      const before=enemies(),near=before.filter(b=>canCut(b)),far=before.filter(b=>!canCut(b)&&b.hy-b.y-b.h>90);
      const trace=document.querySelector('[data-test="mental-trace"]'),temp=document.querySelector('[data-test="steam-temperature"]'),heart=document.querySelector('.dodge-heart');
      const level=trace.dataset.level,hits=trace.dataset.hits,value=temp.getAttribute('aria-valuenow'),shield=heart.classList.contains('shield');
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',bubbles:true}));
      window.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}));
      return {near:near.length,far:far.length,removed:near.every(b=>!b.node.isConnected),kept:far.every(b=>b.node.isConnected),
        same:level===trace.dataset.level&&hits===trace.dataset.hits&&value===temp.getAttribute('aria-valuenow')&&shield===heart.classList.contains('shield')};
    });
    assert(cut.near&&cut.far&&cut.removed&&cut.kept&&cut.same,JSON.stringify(cut));
    assert.equal(await button.getAttribute('data-direction'),'u');assert.equal(await button.getAttribute('data-uses'),'1');
    assert.equal(await page.locator('.dodge-refresh').getAttribute('data-remaining'),'1');
    await shot(page,`slash-${name}`);
    assert(await button.isDisabled());const firstCooldown = Number(await button.getAttribute('data-cooldown'));
    // 表示は0.1秒単位の切り上げ。浮動小数の境界も含めて1目盛りまでを許す。
    assert(firstCooldown > 0 && firstCooldown <= SLASH_RECHARGE_SECONDS + .1 + 1e-9, `Cooldown should still be active after screenshot: ${firstCooldown}`);
    await page.evaluate(()=>{
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',repeat:true,bubbles:true}));
      document.querySelector('[data-test="dodge-slash"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    });
    assert.equal(await button.getAttribute('data-uses'),'1','Cooldown/repeat allowed an extra slash');
    if(!mobile) {
      let uses=1;
      for(const [key,direction] of [['ArrowLeft','l'],['ArrowDown','d'],['ArrowRight','r'],['ArrowUp','u']]) {
        await page.waitForFunction(()=>!document.querySelector('[data-test="dodge-slash"]').disabled);
        await page.keyboard.down(key);await page.keyboard.press('z');await page.keyboard.up(key);
        assert.equal(await button.getAttribute('data-direction'),'u',`Movement ${direction} must not turn the attack`);assert.equal(await button.getAttribute('data-uses'),String(++uses));
      }
      await page.waitForFunction(()=>!document.querySelector('[data-test="dodge-slash"]').disabled);
      await button.focus();await page.keyboard.press('Space');
      assert.equal(await button.getAttribute('data-direction'),'u','Released movement must keep the attack facing forward');
      assert.equal(await button.getAttribute('data-uses'),String(++uses));
      assert.equal(await page.locator('.dodge-refresh').getAttribute('data-remaining'),'1','Space on slash accidentally refreshed');
    } else {
      const pad=await page.locator('.dodge-pad').boundingBox(),r=await button.boundingBox();
      for(const [dx,dy,direction] of [[-.8,0,'l'],[0,.8,'d'],[.8,0,'r'],[0,-.8,'u']]) {
        await page.waitForFunction(()=>!document.querySelector('[data-test="dodge-slash"]').disabled);
        const stick={x:neutral.x+dx*pad.width*.34,y:neutral.y+dy*pad.width*.34,id:1},tap={x:r.x+r.width/2,y:r.y+r.height/3,id:2};
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick,tap]});
        assert.equal(await button.getAttribute('data-direction'),'u',`Stick ${direction} must not turn the attack`);
        assert.equal(await page.locator('.dodge-pad.held').count(),1,'Second finger interrupted movement');
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }
      await touch.detach();
    }
    // 無敵が終わるまでに別のブラウザ往復を挟まず、被弾フレームの色を保存する。
    const hitColor = await page.waitForFunction(() => {
      const heart = document.querySelector('.dodge-heart.shield');
      return heart ? getComputedStyle(heart).color : false;
    });
    assert.equal(await hitColor.jsonValue(),'rgb(239, 135, 149)');
    await shot(page,`heart-hit-${name}`);
    await page.waitForSelector('.result-card.show',{timeout:25000});
    assert.equal(await page.locator('.dodge-slash-fx,.dodge-refresh-fx,.dodge-thought-echo,.dodge-word-cut,.dodge-word,.dodge-object').count(),0);
    assert(await button.isDisabled());
    const result=await page.evaluate(()=>({...cs.steam}));
    assert(result.slashesUsed>=5);assert.equal(result.refreshesUsed,0);assert.equal(result.score,Math.max(0,100-result.hits*14));
    await page.close();
    console.log(`[slash] PASS: ${name} real bullets, bounded/no-heal strike, forward fixed while moving in four directions, cooldown, white hit circle, raised neutral knob, distinct hit color and end cleanup`);
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
