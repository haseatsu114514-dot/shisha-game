// Isolated production session fixture; real gram/puff/help input, not NEW GAME coverage.
import assert from 'node:assert/strict';
import path from 'node:path';
import { suite, assertFits } from './support.mjs';
const shots = process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser';
const test = (page,id) => page.locator(`[data-test="${id}"]`);
async function setGuide(page, open, touch) {
  const summary = page.locator('.bench-guide summary');
  if (touch) await summary.tap(); else await summary.click();
  // Native details.toggle is queued after the input; wait for its pause handler.
  await page.waitForFunction(open => {
    const guide = document.querySelector('.bench-guide'), panel = document.querySelector('.bench-panel');
    return guide?.open === open && panel?.inert === open
      && guide.closest('.bench').dataset.helpPaused === String(open);
  }, open);
}
async function init(page, mode, load = false) {
  await page.evaluate(async ({mode, load}) => {
    const core = await import('./js/core/state.js');
    if (load) { if (!core.load() || !core.state.flags._qa703) throw new Error('Saved fixture was not restored'); }
    else { core.newGame(); core.state.flavorStock = {double_apple:50,mint:50}; core.state.flags._qa703 = true; }
    const session = await import('./js/craft/session.js');
    const steps = await import('./js/craft/steps.js'), pull = await import('./js/craft/pull.js');
    const steam = await import('./js/craft/steam.js');
    const cs = session.newSession(mode); cs.steamVariation={offset:0,transfer:1};
    await session.openBench(cs).ready;
    window.QA={core,session,steps,pull,steam,cs};
  }, {mode, load});
}
async function run(page, step) {
  await page.evaluate(step => { QA.run = step === 'mix' ? QA.steps.stepMix(QA.cs)
    : step === 'timer' ? QA.steps.stepSteamTime(QA.cs)
    : step === 'steam' ? QA.steam.runSteamDodge(QA.cs) : QA.pull.runPull(QA.cs); }, step);
  await test(page, {mix:'mix-ok',timer:'timer-start',steam:'dodge-refresh',pull:'pull-stop'}[step]).waitFor();
}
async function overlap(page) {
  const result = await page.evaluate(() => {
    const stage=document.querySelector('.bench-worker-stage').getBoundingClientRect();
    const note=document.querySelector('.bench-audience').getBoundingClientRect();
    return {extends:stage.top<=note.top && stage.bottom>=note.bottom-1,
      front:document.elementFromPoint(note.x+note.width/2,note.y+note.height/2)?.closest('.bench-audience')!=null};
  });
  assert(result.extends && result.front, JSON.stringify(result));
  await assertFits(page,'.bench-audience, .audience-note');
}
async function fullRig(page) {
  await assertFits(page,'.worker-base, .worker-stem, .worker-tray, .worker-bowl');
  const result=await page.evaluate(()=>{
    const stage=document.querySelector('.bench-worker-stage').getBoundingClientRect();
    const note=document.querySelector('.bench-audience').getBoundingClientRect();
    return [...document.querySelectorAll('.worker-equipment > .art')].map(n=>{
      const r=n.getBoundingClientRect();return {name:n.className,visible:getComputedStyle(n).visibility==='visible',
      contained:r.top>=stage.top-1 && r.bottom<=note.top+1};
    });
  });
  assert(result.length>=4);for(const r of result)assert(r.visible && r.contained,JSON.stringify(r));
}
await suite('craft-layout-703', async check => {
  for(const [name,options,layout] of [
    ['pc',{},'normal'],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true},'normal'],
    ['pc-ds',{},'ds'],['touch-ds',{viewport:{width:844,height:390},isMobile:true,hasTouch:true},'ds'],
    ['portrait-ds',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},'ds'],
  ]) {
    await check(`layout-${name}`,async page=>{
      if(options.hasTouch)await test(page,'title-layout-settings').tap();
      else await test(page,'title-layout-settings').click();
      await test(page,`title-layout-${layout}`).click();await init(page,'drill');await run(page,'mix');
      await overlap(page);
      for(let i=0;i<9;i++)await test(page,'mix-plus-double_apple').click();
      for(let i=0;i<3;i++)await test(page,'mix-plus-mint').click();
      assert.equal(await page.locator('.mix-footer .mix-temperature-preview').count(),0);
      await assertFits(page,'.mix-temperature-preview, .mix-temperature-legend');
      const mixRect=await page.locator('.mix-temperature .thermo-housing').boundingBox();
      await page.screenshot({path:path.join(shots,`${name}-mix.png`)});
      const before=await page.evaluate(()=>JSON.stringify(QA.cs));
      await setGuide(page, true, options.hasTouch);
      assert(await page.locator('.bench-panel').evaluate(n=>n.inert));
      await setGuide(page, false, options.hasTouch);
      assert.equal(await page.locator('.bench-panel').evaluate(n=>n.inert), false);
      assert.equal(await page.evaluate(()=>JSON.stringify(QA.cs)),before);
      await page.evaluate(()=>{QA.cs.steam={temp:.54,score:100};});await run(page,'pull');
      const pullRect=await page.locator('.pull .thermo-housing').boundingBox();
      for(const key of ['x','y','width','height'])assert(Math.abs(mixRect[key]-pullRect[key])<1,`${key}: ${JSON.stringify({mixRect,pullRect})}`);
      await overlap(page);await fullRig(page);
      await page.screenshot({path:path.join(shots,`${name}-pull.png`)});
      await test(page,'pull-stop').waitFor({state:'visible'});
      await page.waitForFunction(()=>!document.querySelector('[data-test="pull-stop"]').disabled);
      if(options.hasTouch)await test(page,'pull-stop').tap();else await test(page,'pull-stop').click();
      await page.waitForFunction(()=>!!document.querySelector('.bench-worker').dataset.draw);
      await fullRig(page);
      assert.equal(await page.locator('.bench-worker').getAttribute('data-scene'),'inhale');
      await page.waitForFunction(()=>!document.querySelector('.bench-worker').dataset.draw);
      assert.equal(await page.locator('.bench-worker').getAttribute('data-scene'),'pull');
    },options);
  }
  for(const [name,options] of [['pc',{}],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
    await check(`initial-and-resumed-lesson-${name}`,async page=>{
      await init(page,'tutorial');
      await page.evaluate(()=>QA.core.save());
      for (const phase of ['initial', 'loaded']) {
        if (phase === 'loaded') {
          await page.reload();
          await test(page, 'title-new').waitFor({timeout:30000});
          await page.locator('#boot').waitFor({state:'detached'});
          await init(page, 'tutorial', true);
        }
        for(const step of ['mix','timer','steam','pull']) {
          if(step!=='mix')await page.evaluate(()=>{QA.cs.mix={double_apple:9,mint:3};QA.cs.steamSeconds=300;QA.cs.steam={temp:.54,score:100};});
          await run(page,step);
          assert.equal(await page.locator('.mix-temperature-preview:visible').count(),0,step);
          assert.equal(await page.locator('.thermo:visible').count(),step==='mix'?0:1,step);
          if(step==='timer') {
            assert.match(await page.locator('.bench-hint').textContent(),/温度計.*3〜10分/);
            await test(page,'timer-start').click(); await page.evaluate(()=>QA.run);
          }
          if(step==='steam') {
            await page.waitForFunction(() => document.querySelector('.bench-guide')?.open
              && document.querySelector('.bench-panel')?.inert);
            await setGuide(page, false, options.hasTouch);
            // Finish the real game before replacing its DOM with the next step.
            await test(page,'step-next').waitFor({timeout:30000});
            await test(page,'step-next').click(); await page.evaluate(()=>QA.run);
          }
          if(step==='pull') {
            await setGuide(page, true, options.hasTouch);
            assert.doesNotMatch(await page.locator('.bench-guide-tip').textContent(),/温度計|虹色/);
            await setGuide(page, false, options.hasTouch);
            assert.match(await page.locator('.audience-note').textContent(),/針を止めて吸い/);
          }
          await overlap(page);
        }
        await page.screenshot({path:path.join(shots,`${name}-lesson-${phase}-pull.png`)});
      }
    },options);
    await check(`timer-minimum-${name}`,async page=>{
      for(const mode of ['tutorial','drill','rehearsal','tournament']) {
        await init(page,mode);
        await page.evaluate(()=>{QA.cs.steamSeconds=1;});
        await run(page,'timer');
        assert(await test(page,'timer-start').isDisabled(),`${mode}: legacy one-second timer`);
        assert(await test(page,'steam-temperature').isVisible());
        await test(page,'timer-second-up').click();
        assert.equal(await test(page,'timer-start').isDisabled(),mode==='tutorial',mode);
        if(mode==='tutorial') {
          await test(page,'timer-minute-up').click();
          await test(page,'timer-minute-up').click();
          for(let i=0;i<4;i++)await test(page,'timer-second-up').click();
          assert.equal(await test(page,'timer-display').textContent(),'02:50');
          assert(await test(page,'timer-start').isDisabled());
          // A dispatched click must also honor the minimum in the handler.
          await test(page,'timer-start').dispatchEvent('click');
          assert.equal(await page.evaluate(()=>QA.cs.steamSeconds),1);
          await test(page,'timer-second-up').click();
          assert.equal(await test(page,'timer-display').textContent(),'03:00');
          assert(await test(page,'timer-start').isEnabled());
          await test(page,'timer-reset').click();
          assert.equal(await test(page,'timer-display').textContent(),'00:00');
          assert(await test(page,'timer-start').isDisabled());
          for(let i=0;i<10;i++)await test(page,'timer-minute-up').click();
          await test(page,'timer-minute-up').dispatchEvent('click');
          assert.equal(await test(page,'timer-display').textContent(),'10:00');
          assert(await test(page,'timer-minute-up').isDisabled());
        }
        await test(page,'timer-start').click(); await page.evaluate(()=>QA.run);
        assert.equal(await page.evaluate(()=>QA.cs.steamSeconds),mode==='tutorial'?600:10);
      }
    },options);
  }
  await check('missing-pull-scene-full-fallback',async page=>{
    await page.route('**/img/ui/making/hajime_craft_pull*.webp',r=>r.fulfill({status:200,contentType:'image/webp',body:'invalid test image'}));
    await init(page,'drill');await page.evaluate(()=>{QA.cs.mix={mint:12};QA.cs.steam={temp:.54};});await run(page,'pull');
    assert.equal(await page.locator('.bench-worker').getAttribute('data-scene'),'fallback');
    await fullRig(page);await overlap(page);
  });
});
