import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, storageSnapshot } from "./support.mjs";
const shotsPath = process.env.COMPARISON_DIR;
if (shotsPath) await fs.mkdir(shotsPath, { recursive: true });
const game = page => page.locator('[data-test="axe-game"]');
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="axe-game"]')?.dataset.phase === value, value);
async function press(page, selector, touch = false) {
  if (touch) await page.locator(selector).tap(); else await page.locator(selector).click();
}
async function pressReady(page, touch = false, keyboard = false) {
  await page.locator('[data-test="axe-action"]:not([disabled])').waitFor();
  if (keyboard) await page.keyboard.press("Space");
  else await press(page, '[data-test="axe-action"]', touch);
}
async function fit(page) {
  const results = await game(page).locator(".axe-header, .axe-panel, .axe-button, .axe-note, .axe-legend, .axe-companion, .axe-comment").evaluateAll(nodes => {
    const bounds = document.querySelector(".axe-game").getBoundingClientRect();
    return nodes.map(n => {
      const r = n.getBoundingClientRect();
      return { text: n.textContent, visible: r.width > 0 && r.height > 0,
        fits: r.left >= bounds.left - 1 && r.right <= bounds.right + 1 && r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1
          && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1
          && n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1 };
    });
  });
  for (const r of results) if (r.visible) assert(r.fits, JSON.stringify(r));
  const target = await page.locator(".axe-target").boundingBox(); assert(target && target.height > 100,"Target must stay usable");
}
async function stopGauge(page, value, touch, keyboard) {
  await page.waitForFunction(value => {
    const root = document.querySelector('[data-test="axe-game"]'), n = Number(root.dataset.timing);
    return !root.querySelector('[data-test="axe-action"]').disabled && n >= value - .02 && n <= value + .005;
  }, value);
  await pressReady(page, touch, keyboard);
}
async function shoot(page, { touch = false, x = 0, y = 0, power = .62, keyboard = false, precision = false, attempt = 0 } = {}) {
  await phase(page,"choice"); await pressReady(page,touch,keyboard); await phase(page,"horizontal"); await fit(page);
  await stopGauge(page,(x / 1.2 + 1) / 2,touch,keyboard); await phase(page,"vertical");
  const stoppedX=await game(page).getAttribute("data-aim-x");
  await stopGauge(page,(y / 1.2 + 1) / 2,touch,keyboard); await phase(page,"power");
  assert.equal(await game(page).getAttribute("data-aim-x"),stoppedX,"Horizontal position remains locked");
  if (precision) {
    const actualY=Number(await game(page).getAttribute("data-aim-y"));
    // The 4in blade forgives vertical error; horizontal error must stay inside the small blue outer ring (.051).
    if (Math.abs(Number(stoppedX)-x)>.04 || Math.abs(actualY-y)>.08) {
      assert(attempt<4,"Physical aiming failed after five visible re-aims");
      // Use the player's real re-aim control before throwing; a slow runner can miss the narrow timing window.
      console.log(`[axe-throw] Re-aim ${attempt+1}: actual ${stoppedX},${actualY}; target ${x},${y}`);
      await page.locator('[data-test="axe-reaim"]:not([disabled])').click();
      return shoot(page,{touch,x,y,power,keyboard,precision,attempt:attempt+1});
    }
  }
  await fit(page);
  if(precision) {
    // Read the real rising power needle before spending the short focus window.
    await page.evaluate(()=>window.precisionTiming=null);
    await page.waitForFunction(value=>{
      const root=document.querySelector('[data-test="axe-game"]'),n=Number(root.dataset.timing),previous=window.precisionTiming;
      window.precisionTiming=n;
      return previous!==null&&n>previous&&n>=value-.16&&n<=value-.08&&!root.querySelector('[data-test="axe-focus"]').disabled;
    },power);
    await press(page,'[data-test="axe-focus"]',touch);
  }
  await stopGauge(page,power,touch,keyboard); await phase(page,"result");
}
async function standalone(page, { touch = false, keyboard = false, league = false, opponent = "hiyori" } = {}) {
  await page.evaluate(() => {
    localStorage.setItem("suien_remake_save", JSON.stringify({ schema:5, money:45678, stamina:71, lovers:["rin"], flags:{_friend_hiyori:true},
      inbox:[{id:"keep",read:true}], pendingInvite:{sender:"hiyori",day:10,slot:1}, affinity:{hiyori:66} }));
    localStorage.setItem("unrelated","keep"); sessionStorage.setItem("unrelated","keep");
  });
  await page.goto(new URL("axe-throw.html",page.url()).href);
  await press(page,'[data-companion="' + opponent + '"]',touch);
  const selector=league?'[data-test="axe-league"]':'[data-test="axe-start"]';
  if (keyboard) { await page.locator(selector).focus(); await page.keyboard.press("Enter"); } else await press(page,selector,touch);
  await phase(page,"choice");
}
await suite("axe-throw", async run => {
  const check=(label,...args)=>!process.env.TEST_CASES || label.includes(process.env.TEST_CASES) ? run(label,...args) : Promise.resolve();
  await check('front-perspective-actual-flight-frames',async page=>{
    await standalone(page);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
    await pressReady(page);await phase(page,'horizontal');await page.clock.runFor(850);await pressReady(page);
    await phase(page,'vertical');await page.clock.runFor(950);await pressReady(page);
    await phase(page,'power');await page.clock.runFor(760);await pressReady(page);await phase(page,'flight');
    const frames=[];
    // Advance whole animation frames, including the release frame before the clock starts.
    // Fractions of the 600ms flight: .3, .57, .8, then past contact.
    for(const [label,ms] of [['release',0],['quarter',180],['half',160],['three-quarter',140],['impact',180]]){
      if(ms)await page.clock.runFor(ms);
      const shape=page.locator(label==='impact'?'.axe-impacts>g':'.axe-flight');
      frames.push(await shape.evaluate(n=>({pitch:Number(n.dataset.pitch),depth:Number(n.dataset.depth),
        faces:[...n.querySelectorAll('polygon')].map(p=>p.dataset.face),transform:n.getAttribute('transform')})));
      assert.equal(await shape.locator('image').count(),0);
      if(shotsPath)await page.locator('.axe-target').screenshot({path:shotsPath+'/front-'+label+'.png'});
    }
    assert(frames[0].pitch===0&&frames[1].pitch< -80&&frames[2].pitch< -170&&frames[3].pitch< -260, JSON.stringify(frames));
    assert(frames[1].faces.includes('handle-end'));assert(frames[2].faces.includes('blade-front'));
    assert(frames.every(f=>!f.transform.includes('rotate')));
    for(let i=1;i<frames.length;i++)assert(frames[i].depth>frames[i-1].depth);
    assert.equal(await game(page).getAttribute('data-phase'),'result');
    if(shotsPath)await fs.writeFile(shotsPath+'/front-frames.json',JSON.stringify(frames,null,2)+'\n');
  });
  for(const [label,options,touch] of [
    ['flight-ui-pc',{viewport:{width:1280,height:800}},false],
    ['flight-ui-touch-portrait',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},true],
    ['flight-ui-touch-landscape',{viewport:{width:844,height:390},isMobile:true,hasTouch:true},true],
  ]) await check(label,async page=>{
    await standalone(page,{touch});const before=await storageSnapshot(page);
    await pressReady(page,touch);await phase(page,'horizontal');await fit(page);
    assert.equal(await page.locator('[data-step="horizontal"]').getAttribute('aria-current'),'step');
    await stopGauge(page,.5,touch);await phase(page,'vertical');
    assert.match(await page.locator('[data-step="horizontal"]').textContent(),/✓/);
    await stopGauge(page,.5,touch);await phase(page,'power');await fit(page);
    assert.match(await page.locator('[data-step="vertical"]').textContent(),/✓/);
    await page.waitForFunction(()=>Number(document.querySelector('.axe-game').dataset.power)<.4);
    assert.match(await page.locator('.axe-power-label').textContent(),/弱すぎる・落下/);
    assert.match(await page.locator('.axe-feedback').textContent(),/↓ 下/);
    if(shotsPath)await page.screenshot({path:shotsPath+'/'+label+'-power.png'});
    await stopGauge(page,.62,touch);await phase(page,'flight');
    assert.match(await page.locator('[data-step="power"]').textContent(),/✓/);
    const landing=await game(page).evaluate(n=>({x:Number(n.dataset.landingX),y:Number(n.dataset.landingY)}));
    await page.waitForTimeout(180);
    if(shotsPath)await page.screenshot({path:shotsPath+'/'+label+'-flight.png'});
    await press(page,'[data-test="axe-rules"]',touch);
    const paused=await page.locator('.axe-flight').getAttribute('transform');await page.waitForTimeout(850);
    assert.equal(await page.locator('.axe-flight').getAttribute('transform'),paused,'Rules freeze flight too');
    await press(page,'[data-test="axe-rules-close"]',touch);await phase(page,'result');await fit(page);
    assert.equal(await page.locator('[data-test="axe-round"]').textContent(),'1 / 3 投','Keep the completed throw number until the next throw starts');
    assert.equal(await page.locator('.axe-flight').getAttribute('transform'),await page.locator('.axe-impacts>g').getAttribute('transform'),
      'The flying axe and embedded axe must share exactly the same final pose');
    const tip=await page.locator('.axe-impacts>g').evaluate(n=>{
      const anchor=n.querySelector('.axe-cut-contact'),p=n.ownerSVGElement.createSVGPoint();p.x=anchor.cx.baseVal.value;p.y=anchor.cy.baseVal.value;
      const actual=p.matrixTransform(n.transform.baseVal.consolidate().matrix);return {x:actual.x,y:actual.y};
    });
    assert(Math.abs(tip.x-(330+landing.x*164))<.001&&Math.abs(tip.y-(245+landing.y*164))<.001,'Rendered cutting edge must land on the visible prediction');
    assert.equal(await page.locator('.axe-impacts>g image').count(),0,'Impact must retain the frontal 3D shape');
    assert(await page.locator('.axe-impacts>g polygon').count()>0);
    assert.doesNotMatch(await page.locator('.axe-flight').getAttribute('transform'),/rotate/,'No rotation in the screen plane');
    assert.deepEqual(await game(page).evaluate(n=>({x:Number(n.dataset.landingX),y:Number(n.dataset.landingY)})),landing);
    if(shotsPath)await page.screenshot({path:shotsPath+'/'+label+'-result.png'});
    await pressReady(page,touch);await phase(page,'choice');
    await pressReady(page,touch);await phase(page,'horizontal');await stopGauge(page,.5,touch);
    await phase(page,'vertical');await stopGauge(page,.5,touch);await phase(page,'power');await stopGauge(page,.93,touch);
    await phase(page,'flight');await page.waitForFunction(()=>{
      const n=document.querySelector('.axe-flight');return document.querySelector('.axe-game').dataset.phase==='flight'&&Number(n.getAttribute('opacity'))<.9;
    });
    assert(Number(await page.locator('.axe-flight').getAttribute('opacity'))>0,'Drop stays visible while falling');
    await press(page,'[data-test="axe-rules"]',touch);
    const fade=await page.locator('.axe-flight').getAttribute('opacity');await page.waitForTimeout(450);
    assert.equal(await page.locator('.axe-flight').getAttribute('opacity'),fade,'Rules must not reset the fading drop');
    await press(page,'[data-test="axe-rules-close"]',touch);
    await phase(page,'result');assert.equal(await page.locator('.axe-impacts>g').count(),0);
    assert.match(await page.locator('.axe-note').textContent(),/落下 · 0点/);
    await page.keyboard.press('Escape');assert.deepEqual(await storageSnapshot(page),before);
  },options);
  for(const [label,options,touch] of [
    ['rules-pc',{viewport:{width:1280,height:720}},false],
    ['rules-touch-portrait',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},true],
    ['rules-touch-landscape',{viewport:{width:844,height:390},isMobile:true,hasTouch:true},true],
  ]) await check(label,async page=>{
    await page.goto(new URL('axe-throw.html',page.url()).href);
    await press(page,'[data-test="axe-menu-rules"]',touch);
    const help=page.locator('[data-test="axe-rules-panel"]');await help.waitFor();
    assert.match(await help.textContent(),/外れ・落下でも1回/);assert.match(await help.textContent(),/外側4か所にも5のリングと赤い6点/);
    assert.match(await help.textContent(),/構え直しても回数は戻らない/);
    if(shotsPath)await page.screenshot({path:shotsPath+'/'+label+'-top.png'});
    const scroll=help.locator('.axe-rules-scroll');await scroll.evaluate(n=>n.scrollTop=n.scrollHeight);
    assert(await scroll.evaluate(n=>n.scrollTop>0&&n.scrollWidth<=n.clientWidth));
    const bounds=await help.locator('.axe-rules-card').boundingBox(),view=page.viewportSize();
    assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=view.width+1&&bounds.y+bounds.height<=view.height+1);
    if(shotsPath)await page.screenshot({path:shotsPath+'/'+label+'.png'});
    await press(page,'[data-test="axe-rules-close"]',touch);assert.equal(await help.count(),0);
    await standalone(page,{touch});await pressReady(page,touch);await phase(page,'horizontal');
    await stopGauge(page,.5,touch);await phase(page,'vertical');await stopGauge(page,.5,touch);await phase(page,'power');
    await page.locator('[data-test="axe-focus"]:not([disabled])').waitFor();await press(page,'[data-test="axe-focus"]',touch);
    await press(page,'[data-test="axe-rules"]',touch);await help.waitFor();
    const frozen=await game(page).evaluate(n=>({timing:n.dataset.timing,held:n.dataset.held,focus:n.dataset.focusRemaining}));
    await page.waitForTimeout(450);assert.deepEqual(await game(page).evaluate(n=>({timing:n.dataset.timing,held:n.dataset.held,focus:n.dataset.focusRemaining})),frozen);
    assert.equal(await game(page).getAttribute('data-paused'),'true');
    for(let n=0;n<4;n++)await page.keyboard.press('Tab');assert(await help.evaluate(n=>n.contains(document.activeElement)));
    await page.keyboard.press('Escape');assert.equal(await help.count(),0);assert.equal(await game(page).getAttribute('data-phase'),'power');
    await page.waitForTimeout(100);assert.notEqual(await game(page).getAttribute('data-held'),frozen.held);
    await page.keyboard.press('Escape');assert.equal(await game(page).count(),0);
  },options);
  await check('visible-sway-focus-budget-and-release',async page=>{
    await page.evaluate(async()=>{const mini=await import('./js/minigames/axe.js');window.swayGame=mini.runAxeThrow({reducedMotion:true});});
    await phase(page,'choice');await pressReady(page);await phase(page,'horizontal');
    await stopGauge(page,.5);await phase(page,'vertical');await stopGauge(page,.5);await phase(page,'power');
    const base=await game(page).getAttribute('data-aim-x'),first=await game(page).getAttribute('data-release-x');await page.waitForTimeout(180);
    assert.equal(await game(page).getAttribute('data-aim-x'),base);assert.notEqual(await game(page).getAttribute('data-release-x'),first);
    if(shotsPath)await page.screenshot({path:shotsPath+'/story-sway.png'});
    await page.locator('[data-test="axe-focus"]:not([disabled])').click();assert(await page.locator('[data-test="axe-focus"]').isDisabled());
    if(shotsPath)await page.screenshot({path:shotsPath+'/story-focus.png'});
    await page.locator('[data-test="axe-reaim"]:not([disabled])').click();await phase(page,'choice');
    await pressReady(page);await phase(page,'horizontal');assert(await page.locator('[data-test="axe-focus"]').isDisabled());
    assert.equal(await game(page).getAttribute('data-focus-remaining'),'0','Re-aim never restores spent focus');
    await stopGauge(page,.5);await phase(page,'vertical');await stopGauge(page,.5);await phase(page,'power');
    await page.evaluate(()=>document.addEventListener('click',event=>{
      const n=document.querySelector('[data-test="axe-game"]');
      if(event.target.closest('[data-test="axe-action"]')&&n?.dataset.phase==='power')window.visibleRelease={x:Number(n.dataset.landingX),y:Number(n.dataset.landingY)};
    },true));
    await stopGauge(page,.62);await phase(page,'result');await pressReady(page);await phase(page,'choice');
    await pressReady(page);await phase(page,'horizontal');await page.locator('[data-test="axe-focus"]:not([disabled])').waitFor();
    await page.keyboard.press('Escape');const result=await page.evaluate(()=>swayGame);assert.equal(result.throws.length,1);
    const visible=await page.evaluate(()=>visibleRelease),shot=result.throws[0];
    assert.equal(shot.landing.x,visible.x);assert.equal(shot.landing.y,visible.y);assert.notDeepEqual(shot.aim,shot.baseAim);
  });
  for (const [label, options, touch] of [
    ["pc",{viewport:{width:1280,height:800}},false],
    ["touch-landscape",{viewport:{width:844,height:390},isMobile:true,hasTouch:true},true],
    ["touch-portrait",{viewport:{width:390,height:844},isMobile:true,hasTouch:true},true],
    ["keyboard-reduced",{viewport:{width:1280,height:720},reducedMotion:"reduce"},false],
  ]) await check(label,async page => {
    const keyboard=label==="keyboard-reduced";
    await standalone(page,{touch,keyboard}); const before=await storageSnapshot(page); await fit(page);
    const introComment=await page.locator(".axe-comment").textContent();
    for (let n=0;n<3;n++) {
      await shoot(page,{touch,power:n===1?.92:.62,keyboard}); await fit(page);
      if (n===0) assert.notEqual(await page.locator(".axe-comment").textContent(),introComment);
      if (n===1) assert.match(await page.locator(".axe-note").textContent(),/落下/);
      await pressReady(page,touch,keyboard);
    }
    await phase(page,"summary"); await page.locator('[data-test="axe-action"]:not([disabled])').waitFor();
    assert.match(await page.locator(".axe-note").textContent(),/合計 .*22点/);
    if (shotsPath) await page.screenshot({path:shotsPath + "/" + label + "-summary.png"});
    await press(page,'[data-test="axe-retry"]',touch); await phase(page,"choice");
    assert.equal(await page.locator('[data-test="axe-round"]').textContent(),"1 / 3 投");
    assert.match(await page.locator(".axe-call-status").textContent(),/残り2回/);
    await shoot(page,{touch,keyboard}); await page.keyboard.press("Escape");
    await page.locator('[data-test="axe-start"]').waitFor();
    assert.deepEqual(await storageSnapshot(page),before,"Practice must preserve raw legacy saves and LIME");
  },options);
  await check("ten-throws-killshots-and-companion",async page => {
    await standalone(page,{league:true,opponent:"shark"}); const before=await storageSnapshot(page);
    assert.match(await page.locator(".axe-comment").textContent(),/お主/); assert.equal(await page.locator(".axe-portrait").getAttribute("alt"),"サメちゃん");
    await page.locator('[data-call="upper-left"]').click(); assert.match(await page.locator(".axe-comment").textContent(),/キルショット/);
    // Physical timing stops, not injected model/history. Small marker is intentionally demanding.
    await shoot(page,{x:-7/14.75,y:-12/14.75,precision:true});
    assert.match(await page.locator(".axe-note").textContent(),/キルショット！ [78]点/);
    assert.match(await page.locator(".axe-comment").textContent(),/小さい的/);
    assert.match(await page.locator(".axe-portrait").getAttribute("src"),/excited/);
    await pressReady(page); await phase(page,"choice"); await page.locator('[data-test="axe-action"]:not([disabled])').waitFor();
    assert(await page.locator('[data-call="upper-left"]').isDisabled()); assert(await page.locator('[data-call="upper-right"]').isDisabled());
    assert(!(await page.locator('[data-call="lower-left"]').isDisabled()));
    await page.locator('[data-call="lower-left"]').click(); await shoot(page); // declaration miss at center earns zero
    assert.match(await page.locator(".axe-note").textContent(),/青い的から外れた · 0点/); await pressReady(page);
    assert.match(await page.locator(".axe-call-status").textContent(),/残り0回/);
    for (let n=2;n<10;n++) {
      if(n===5) { assert.match(await page.locator(".axe-note").textContent(),/後半5投/); assert(await page.locator('[data-call="upper-left"]').isDisabled()); }
      await shoot(page,{x:n%2?6/14.75:0,y:n%2?3.5/14.75:0}); await pressReady(page);
    }
    await phase(page,"summary"); await page.locator('[data-test="axe-action"]:not([disabled])').waitFor();
    await fit(page); assert.match(await page.locator(".axe-note").textContent(),/64点/);
    if(shotsPath) await page.screenshot({path:shotsPath + "/league-shark-summary.png"});
    await pressReady(page); assert.deepEqual(await storageSnapshot(page),before);
    assert.match(await page.locator(".axe-intro > p").first().textContent(),/前回の記録/);
  });
  await check("pause-reaim-and-repeat",async page => {
    await standalone(page); await page.locator('[data-call="lower-right"]').click(); await pressReady(page); await phase(page,"horizontal");
    await page.evaluate(() => {
      window.testHidden=true; Object.defineProperty(document,"hidden",{configurable:true,get:()=>window.testHidden}); document.dispatchEvent(new Event("visibilitychange"));
    });
    const needle=await game(page).getAttribute("data-timing"); await page.waitForTimeout(350);
    assert.equal(await game(page).getAttribute("data-timing"),needle); assert(await page.locator('[data-test="axe-action"]').isDisabled());
    await page.evaluate(()=>{window.testHidden=false;document.dispatchEvent(new Event("visibilitychange"));});
    await page.locator('[data-test="axe-reaim"]').click(); await phase(page,"choice");
    assert.match(await page.locator(".axe-call-status").textContent(),/宣言中/);
    await page.locator('[data-call="normal"]').click(); assert.match(await page.locator(".axe-call-status").textContent(),/残り2回/);
    await page.locator('[data-test="axe-action"]:not([disabled])').waitFor();
    await page.locator('[data-test="axe-action"]').focus(); await page.keyboard.press("Enter");
    await phase(page,"horizontal"); await page.waitForTimeout(300);
    await game(page).evaluate(root=>root.dispatchEvent(new KeyboardEvent("keydown",{key:" ",repeat:true,bubbles:true})));
    assert.equal(await game(page).getAttribute("data-phase"),"horizontal");
    assert(await game(page).evaluate(root=>root.contains(document.activeElement)),"Disabling the primary button must keep focus inside the game");
    await page.keyboard.press("Space"); await phase(page,"vertical");
    for(let i=0;i<10;i++) await page.keyboard.press("Tab"); assert(await game(page).evaluate(root=>root.contains(document.activeElement)));
    await page.keyboard.press("Escape"); assert.equal(await game(page).count(),0);
  });
  await check("pointer-double-click",async page => {
    await standalone(page); await page.locator('[data-test="axe-action"]:not([disabled])').dblclick(); await phase(page,"horizontal");
    await page.waitForTimeout(350); await page.locator('[data-test="axe-action"]:not([disabled])').dblclick(); await phase(page,"vertical");
    assert.equal(await page.locator('[data-test="axe-round"]').textContent(),"1 / 3 投");
    await page.keyboard.press("Escape");
  });
  await check("pre-abort-and-host-detach",async page => {
    await page.evaluate(async()=>{
      const mini=await import("./js/minigames/axe.js"),signal=new AbortController(); signal.abort();
      window.cancelledGame=await mini.runAxeThrow({signal:signal.signal});
      const host=document.createElement("div");document.body.append(host);window.detachedGame=mini.runAxeThrow({host});host.remove();
      const connected=document.createElement("div");document.body.append(connected);
      window.replacedGame=mini.runAxeThrow({host:connected});connected.replaceChildren();
      window.invalidMode=await mini.runAxeThrow({mode:"fake"}).then(()=>false,e=>e instanceof RangeError);
    });
    const result=await page.evaluate(async()=>[cancelledGame,await detachedGame,await replacedGame]);
    assert(result.every(r=>r.cancelled&&!r.completed&&r.throws.length===0));assert(await page.evaluate(()=>invalidMode));assert.equal(await game(page).count(),0);
  });
  await check("art-catalog-names-and-retry",async page => {
    const manifest = await (await page.request.get(new URL("data/manifest.json",page.url()).href)).json();
    const sourceKey = manifest.titleArts.find(entry=>entry.file.endsWith("_01_shishark_test_run.png")).character;
    for (const key of new Set([sourceKey,"samechan","renamed_catalogue_fixture"])) {
      await page.unrouteAll();
      const catalogue = structuredClone(manifest);
      const portrait = catalogue.portraits[sourceKey];
      delete catalogue.portraits[sourceKey]; catalogue.portraits[key]=portrait;
      for(const entry of catalogue.titleArts) if(entry.character===sourceKey) {
        entry.character=key; entry.file=entry.file.replace("title_art_" + sourceKey + "_","title_art_" + key + "_");
      }
      await page.route("**/remake/data/manifest.json",route=>route.fulfill({json:catalogue}));
      if(key!==sourceKey) await page.route("**/img/sprites/characters/" + key + "/*",async route=>{
        const url=route.request().url().replace("/" + key + "/chr_" + key + "_","/" + sourceKey + "/chr_" + sourceKey + "_");
        await route.fulfill({response:await route.fetch({url})});
      });
      await standalone(page,{opponent:"shark"}); const before=await storageSnapshot(page);
      assert.match(await page.locator(".axe-portrait").getAttribute("src"),new RegExp("/" + key + "/chr_" + key + "_normal"));
      assert(await page.locator(".axe-portrait").evaluate(img=>img.complete&&img.naturalWidth>0));
      await page.keyboard.press("Escape"); assert.deepEqual(await storageSnapshot(page),before);
    }
    await page.unrouteAll();
    await page.route("**/remake/data/manifest.json",route=>route.fulfill({json:{portraits:{}}}));
    await page.locator('[data-test="axe-start"]').click(); await phase(page,"failed");
    assert.match(await page.locator(".axe-note").textContent(),/読み込めません/);
    await page.unrouteAll(); await pressReady(page); await phase(page,"choice"); await page.keyboard.press("Escape");
  });
  for (const relationship of ["friend-legacy", "friend", "lover"]) await check("api-" + relationship, async page => {
    await page.evaluate(async relationship => {
      const core = await import("./js/core/state.js");
      window.A = { core, mini: await import("./js/minigames/axe.js"), route: await import("./js/core/hiyori-route.js") };
      const s = core.newGame(); s.phase = "daily"; s.money = 45678; s.stamina = 71;
      s.flags._hiyori_real_self_known = false; s.contacts.push("hiyori");
      s.inbox = [{ id: "keep", read: true, log: ["keep"] }]; s.pendingInvite = { sender: "hiyori", day: 10, slot: 1 };
      if (relationship === "friend-legacy") { s.schema = 5; s.flags._friend_hiyori = true; s.affinity.hiyori = 66; }
      else if (relationship === "friend") { s.met.hiyori = true; s.flags._friend_hiyori = true;
        s.finales.hiyori = { route: "friend", chapter: 1, day: 4 }; s.affinity.hiyori = 66; }
      else { s.lovers = ["hiyori","rin"]; s.lovePts.hiyori = 12; s.loveLevel.hiyori = 2; }
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(s)); core.load();
      A.before = JSON.stringify(core.state); A.abort = new AbortController();
      A.flow = A.mini.runAxeThrow({ signal: A.abort.signal });
      A.duplicate = A.flow === A.mini.runAxeThrow();
      A.friendBefore = A.route.hiyoriIsFriend();
    }, relationship);
    assert(await page.evaluate(() => A.duplicate)); assert.equal(await game(page).count(), 1);
    if (relationship === "friend") assert(await page.evaluate(() => A.friendBefore));
    await phase(page, "choice"); await fit(page);
    await shoot(page); await fit(page);
    await page.locator('[data-test="axe-rules"]').click();await page.locator('[data-test="axe-rules-panel"]').waitFor();
    if(shotsPath)await page.screenshot({path:shotsPath+'/story-rules-'+relationship+'.png'});
    await page.evaluate(() => A.abort.abort()); const result = await page.evaluate(() => A.flow);
    assert(!result.completed && result.cancelled && result.throws.length === 1);
    assert.equal(await game(page).count(), 0);
    assert.equal(await page.locator('[data-test="axe-rules-panel"]').count(),0,'Owner abort removes the help dialog too');
    assert(await page.evaluate(() => JSON.stringify(A.core.state) === A.before));
    assert(await page.evaluate(() => A.route.hiyoriIsFriend() === A.friendBefore));
    await page.evaluate(() => { A.flow = A.mini.runAxeThrow({ reducedMotion: true }); });
    for (let n = 0; n < 3; n++) { await shoot(page); if (n < 2) await pressReady(page); }
    await pressReady(page); await phase(page, "summary"); await pressReady(page); const complete = await page.evaluate(() => A.flow);
    assert(complete.completed && !complete.cancelled); assert.equal(complete.throws.length, 3);
    assert.equal(complete.total, complete.throws.reduce((sum, shot) => sum + shot.score, 0));
    assert(await page.evaluate(() => JSON.stringify(A.core.state) === A.before));
  });
});
