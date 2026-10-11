// 8秒リチャージ式の範囲消去、初期の回復なし、成長による範囲・1段階回復。
// サーバー8123: node remake/test/steam_refresh.mjs （SHOTS=<フォルダ>）
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({headless:true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath:process.env.CHROME_EXECUTABLE_PATH}:{}),
});
const shots=process.env.SHOTS;
if(shots) fs.mkdirSync(shots,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async()=>{
    const core=await import('./js/core/state.js'), steam=await import('./js/craft/steam.js'),session=await import('./js/craft/session.js');
    core.newGame(); window.T={core,steam,session};
    // CSS内の移動量はフィールド座標なので、画面の縮尺に左右されない。
    window.enemies=()=>{
      const h=new DOMMatrix(document.querySelector('.dodge-heart').style.transform),hx=h.e+14,hy=h.f+14;
      return [...document.querySelectorAll('.dodge-word,.dodge-object')].map(n=>{
        const m=new DOMMatrix(n.style.transform),cx=Math.max(m.e,Math.min(hx,m.e+n.offsetWidth)),cy=Math.max(m.f,Math.min(hy,m.f+n.offsetHeight));
        return {node:n,distance:Math.hypot(hx-cx,hy-cy)};
      });
    };
    window.startSteam=guts=>{
      T.core.state.stats.guts=guts; __remake.craftTest.auto=null;
      window.cs=T.session.newSession('drill');cs.steamSeconds=600;
      T.session.openBench(cs);window.running=T.steam.runSteamDodge(cs);
    };
    window.consume=key=>{
      const radius=T.steam.refreshEffect().radius,before=enemies();
      const mental=document.querySelector('[data-test="mental-trace"]'),thermo=document.querySelector('[data-test="steam-temperature"]');
      const level=mental.dataset.level,misses=mental.dataset.hits,temp=thermo.getAttribute('aria-valuenow'),shieldBefore=document.querySelector('.dodge-heart').classList.contains('shield');
      window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
      return {radius,near:before.filter(b=>b.distance<=radius).length,far:before.filter(b=>b.distance>radius).length,
        correctlyRemoved:before.every(b=>b.node.isConnected===(b.distance>radius)),
        remaining:enemies().length,shieldBefore,levelBefore:level,levelAfter:mental.dataset.level,missesUnchanged:misses===mental.dataset.hits,tempUnchanged:temp===thermo.getAttribute('aria-valuenow')};
    };
  });
  const perks=await page.evaluate(()=>[10,21,41,61,81].map(guts=>{
    T.core.state.stats.guts=guts;const effect=T.steam.refreshEffect();
    return {radius:Number.isFinite(effect.radius)?effect.radius:'all',recovery:effect.mentalRecovery,stock:T.steam.refreshStock()};
  }));
  assert.deepEqual(perks,[{radius:180,recovery:false,stock:1},{radius:220,recovery:false,stock:1},{radius:265,recovery:true,stock:1},{radius:310,recovery:true,stock:1},{radius:'all',recovery:true,stock:1}]);
  const finish=async()=>{
    await page.waitForSelector('.result-card.show',{timeout:20000});
    await page.locator('[data-test="step-details"]').click();
    const result=await page.locator('.rc-lines').textContent();
    const stats=await page.evaluate(()=>({...cs.steam}));
    assert.equal(stats.score,Math.max(0,100-stats.hits*14),'Dodge score must depend only on avoided hits');
    assert.equal(await page.locator('.dodge-word,.dodge-object').count(),0,'End cleanup left active bullets');
    await page.locator('[data-test="step-next"]').click();await page.evaluate(()=>window.running);
    return {result,stats};
  };

  await page.evaluate(()=>startSteam(10));
  const button=page.locator('[data-test="dodge-refresh"]');await button.waitFor();
  assert(await button.isDisabled());assert.equal(await button.getAttribute('data-remaining'),'1');
  await page.waitForFunction(()=>!document.querySelector('[data-test="dodge-refresh"]').disabled);
  await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'x',repeat:true,bubbles:true})));
  assert.equal(await button.getAttribute('data-remaining'),'1','Repeated key spent the only refresh');
  if(shots) await page.screenshot({path:`${shots}/refresh-medium-before.png`});
  const medium=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const deadline=performance.now()+8000;
    const attempt=()=>{
      const radius=T.steam.refreshEffect().radius,b=enemies();
      if(!document.querySelector('.dodge-heart').classList.contains('shield')&&
          b.some(b=>b.distance<=radius)&&b.some(b=>b.distance>radius)) {
        const times=window.spawnTimes={at:performance.now(),next:0};
        const observer=new MutationObserver(list=>{
          if(list.some(m=>[...m.addedNodes].some(n=>n.classList?.contains('dodge-word')||n.classList?.contains('dodge-object')))) {
            times.next=performance.now();observer.disconnect();
          }
        });observer.observe(document.querySelector('.dodge'),{childList:true});
        // Observe and consume in one task: bullets cannot move between them.
        resolve(consume('x'));return;
      }
      if(performance.now()>=deadline) {reject(new Error('No unshielded near/far refresh opportunity'));return;}
      requestAnimationFrame(attempt);
    };
    attempt();
  }));
  assert(medium.near>0&&medium.far>0,JSON.stringify(medium));assert(medium.correctlyRemoved);
  assert.equal(medium.remaining,medium.far,'Refresh removed bullets outside its radius');
  assert.equal(medium.levelAfter,medium.levelBefore,'Base refresh healed mental state');
  assert(medium.missesUnchanged&&medium.tempUnchanged);
  assert.equal(await button.getAttribute('data-remaining'),'0');assert(await button.isDisabled());assert.equal(await page.locator('.dodge-refresh-fx').count(),1);
  const shield=await page.evaluate(async()=>{
    const mental=document.querySelector('[data-test="mental-trace"]'),hit=mental.dataset.hits;
    await new Promise(requestAnimationFrame);
    return {same:hit===mental.dataset.hits,shield:document.querySelector('.dodge-heart').classList.contains('shield')};
  });
  if(shield.same&&!medium.shieldBefore) assert(!shield.shield,'Base refresh granted invulnerability');
  if(shots) await page.screenshot({path:`${shots}/refresh-medium-after.png`});
  await page.waitForFunction(()=>spawnTimes.next,null,{timeout:1500});
  assert(await page.evaluate(()=>spawnTimes.next-spawnTimes.at)<800,'Refresh postponed the spawning schedule');
  await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'x',repeat:true,bubbles:true})));
  await page.keyboard.press('Space');assert.equal(await button.getAttribute('data-remaining'),'0');assert(await button.isDisabled());
  await page.waitForSelector('.dodge-word,.dodge-object');
  const empty=await page.evaluate(()=>{
    const before=enemies().map(b=>b.node);window.dispatchEvent(new KeyboardEvent('keydown',{key:'x',bubbles:true}));
    return before.every(n=>n.isConnected);
  });assert(empty,'Empty stock still cleared bullets');
  assert(Number(await button.getAttribute('data-cooldown')) > 6, 'Refresh recharged immediately');
  const chargeStarted=performance.now();
  await page.waitForFunction(()=>!document.querySelector('[data-test="dodge-refresh"]').disabled,null,{timeout:10000});
  assert(performance.now()-chargeStarted>6000, 'Recharge bypassed the 8-second wait');
  assert.equal(await button.getAttribute('data-remaining'),'1');
  assert.equal(await button.locator('.action-recharge').textContent(),'');
  const second=await page.evaluate(()=>consume('x'));
  assert(second.near>0&&second.correctlyRemoved,'Recharged refresh did not clear real bullets');
  assert.equal(await button.getAttribute('data-remaining'),'0');assert(await button.isDisabled());
  const baseResult=await finish();assert.equal(baseResult.stats.refreshesUsed,2);
  assert.match(baseResult.result,/リフレッシュで2回/);
  console.log('[refresh] PASS: actual 8-second recharge and second use, medium range, no base healing/invulnerability/spawn delay, repeat/cooldown guards and hit-based score');

  await page.evaluate(()=>startSteam(41));
  await page.waitForFunction(()=>document.querySelector('[data-test="mental-trace"]').dataset.level==='shaken',null,{timeout:10000});
  const recovered=await page.evaluate(()=>consume('x'));
  assert.equal(recovered.levelBefore,'shaken');assert.equal(recovered.levelAfter,'unsteady','Growth refresh must recover exactly one mental level');
  assert(recovered.missesUnchanged&&recovered.tempUnchanged&&recovered.correctlyRemoved);
  if(shots) await page.screenshot({path:`${shots}/refresh-grown-recovery.png`});
  await finish();

  await page.evaluate(()=>startSteam(81));
  await page.waitForFunction(()=>enemies().length>=3);
  const full=await page.evaluate(()=>consume('x'));
  assert(full.near>=3&&full.correctlyRemoved);assert.equal(full.remaining,0);
  assert.equal(await button.getAttribute('data-remaining'),'0');assert(await button.isDisabled());await finish();
  assert.deepEqual(errors,[]);
  console.log('[refresh] PASS: one charge at a time; growth expands range, adds one-step mental recovery, and unlocks full-field clearing');
} finally {await browser.close();}
