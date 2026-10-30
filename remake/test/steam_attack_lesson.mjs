import assert from 'node:assert/strict';
import fs from 'node:fs';
import { suite, assertFits } from './browser/support.mjs';
const shots = process.env.SHOTS || '.codex/artifacts/remake-browser/steam';
fs.mkdirSync(shots, {recursive:true});
await suite('attack-lesson', async check => {
  await check('shift-menu', async page => {
    await page.evaluate(async()=>{
      window.M={core:await import('./js/core/state.js'),tonari:await import('./js/daily/tonari.js'),vn:await import('./js/vn/engine.js')};
      M.start=points=>{
        M.core.newGame(); M.core.state.affinity.sumi=points;
        M.core.state.flags._hiyori_meeting_done=true;
        M.vn.vnTest.turbo=true; M.shift=M.tonari.doBaito();
      };
    });
    // ♥2（20）はシフト後のスミとの会話で好感度が上がっても♥3（33）に届かない値。♥3ちょうどで選択肢が出る。
    for(const points of [20,33]) {
      await page.evaluate(points=>M.start(points),points);
      await page.locator('[data-test="shift-order-0"]').click();
      await page.locator('[data-test="after-none"]').waitFor();
      assert.equal(await page.locator('[data-test="after-attack"]').count(),points>=33?1:0);
      if(points>=33) {
        await page.locator('[data-test="after-attack"]').click();
        await page.evaluate(()=>M.shift);
        assert.equal(await page.evaluate(()=>M.core.state.flags._sumi_attack_learned),true);
        await page.evaluate(()=>{M.core.load();M.shift=M.tonari.doBaito();});
        await page.locator('[data-test="shift-order-0"], [data-test="after-none"]').first().waitFor();
        if (await page.locator('[data-test="shift-order-0"]').count()) await page.locator('[data-test="shift-order-0"]').click();
        await page.locator('[data-test="after-none"]').waitFor();
        assert.equal(await page.locator('[data-test="after-attack"]').count(),0,'Learned lesson offered again');
      }
      await page.locator('[data-test="after-none"]').click(); await page.evaluate(()=>M.shift);
    }
  });
  for (const [name, mobile] of [['desktop',false],['touch',true]]) await check(name, async page => {
    page.setDefaultTimeout(60000);
    await page.evaluate(async () => {
      window.A = { core: await import('./js/core/state.js'), lesson: await import('./js/daily/attack-lesson.js'),
        vn: await import('./js/vn/engine.js'), session: await import('./js/craft/session.js'),
        steam: await import('./js/craft/steam.js'), ui: await import('./js/core/ui.js') };
      A.core.newGame(); A.core.state.affinity.sumi = 33;
      A.core.state.flags._intro_sumi = true;
      A.padPressed = false;
      Object.defineProperty(navigator, 'getGamepads', { configurable:true, value: () => [{mapping:'standard', buttons:[{pressed:A.padPressed}]}] });
      A.start = (mode, learned=!!A.core.state.flags._sumi_attack_learned) => {
        A.core.state.flags._sumi_attack_learned = learned;
        A.session.craftTest.auto=null;
        const cs = A.cs = A.session.newSession(mode); cs.steamSeconds=600;
        A.session.openBench(cs); A.running=A.steam.runSteamDodge(cs);
      };
    });
    // Each production context uses the same lock, including the first tutorial.
    for (const mode of ['tutorial','tournament','drill','rehearsal']) {
      await page.evaluate(mode=>A.start(mode,false), mode);
      const button=page.locator('[data-test="dodge-slash"]'); await button.waitFor();
      if (mode === 'tutorial') {
        await page.waitForFunction(() => document.querySelector('.bench-guide')?.open);
        await assertFits(page, '.bench-guide summary');
        await assertFits(page, '.bench-guide-tip');
        const helpClear = await page.locator('.bench-guide summary').evaluate(summary => {
          const a = summary.getBoundingClientRect();
          return a.width >= 43 && a.height >= 43 &&
            [...document.querySelectorAll('.dodge, .dodge-controls, .bench-guide-tip')].every(node => {
              const b = node.getBoundingClientRect();
              return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
            });
        });
        assert(helpClear, 'help target is reachable and clear of controls and explanation');
        await page.locator('.bench-guide summary').click();
      }
      await page.waitForFunction(()=>!document.querySelector('[data-test="dodge-refresh"]').disabled);
      assert(await button.isDisabled()); await assertFits(page,'[data-test="slash-lock"]');
      assert.equal(await page.locator('[data-test="slash-lock"]').innerText(),'🔒');
      assert.equal(await page.locator('[data-test="slash-lock"]').getAttribute('aria-hidden'),'true');
      const lockGeometry = await button.evaluate(button => {
        const emblem = button.querySelector('.refresh-emblem').getBoundingClientRect();
        const lock = button.querySelector('.slash-lock').getBoundingClientRect();
        return { dx: Math.abs(lock.x + lock.width / 2 - emblem.x - emblem.width / 2),
          dy: Math.abs(lock.y + lock.height / 2 - emblem.y - emblem.height / 2),
          size: parseFloat(getComputedStyle(button.querySelector('.slash-lock')).fontSize),
          opacity: Number(getComputedStyle(button.querySelector('.refresh-emblem > span:first-child')).opacity) };
      });
      assert(lockGeometry.dx < 1 && lockGeometry.dy < 1, 'lock stays at icon centre');
      assert(lockGeometry.size >= 50 && lockGeometry.opacity <= .25, 'large lock and inactive artwork');
      assert.equal(await button.getAttribute('title'),'アタック：使用不可');
      assert.equal(await button.getAttribute('aria-label'),'アタック。使用不可');
      await page.keyboard.press('z');
      await button.dispatchEvent('pointerdown'); await button.dispatchEvent('click',{detail:0});
      if(mobile) { const r=await button.boundingBox(); await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2); }
      await page.evaluate(()=>A.padPressed=true); await page.waitForTimeout(100);
      await page.evaluate(()=>A.padPressed=false);
      assert.equal(await button.getAttribute('data-uses'),'0');
      assert.equal(await page.locator('.dodge-slash-fx').count(),0);
      await page.screenshot({path:`${shots}/attack-locked-${name}-${mode}.png`});
      await page.locator('.result-card.show').waitFor();
      await page.locator('[data-test="step-next"]').click(); await page.evaluate(()=>A.running);
      assert.equal(await page.evaluate(()=>A.cs.steam.slashesUsed),0);
    }
    // Real dialogue modes, not synthetic completion results.
    for (const mode of ['manual','auto','skip','cancel']) {
      await page.evaluate(mode=>{
        A.core.newGame(); A.core.state.affinity.sumi=33; A.core.state.flags._intro_sumi=true;
        A.vn.vnTest.turbo=false; A.abort=new AbortController(); A.done=null;
        A.lesson.studyAttack({signal:A.abort.signal}).then(value=>A.done=value);
      },mode);
      await page.locator('#vn.active').waitFor();
      assert.equal(await page.evaluate(()=>!!A.core.state.flags._sumi_attack_learned),false,'Opening lesson granted attack');
      if(mode==='cancel') {
        await page.evaluate(()=>A.abort.abort());
      } else if(mode==='auto'||mode==='skip') {
        await page.locator(`[data-test="vn-${mode}"]`).click();
      } else {
        for(let n=0;n<80 && await page.evaluate(()=>A.done===null);n++) {
          await page.keyboard.press('Enter'); await page.waitForTimeout(150);
        }
      }
      await page.waitForFunction(()=>A.done!==null);
      assert.equal(await page.evaluate(()=>A.done),mode!=='cancel');
      assert.equal(await page.evaluate(()=>!!A.core.state.flags._sumi_attack_learned),mode!=='cancel');
      if(mode!=='cancel') assert.equal(await page.evaluate(()=>{A.core.load(); return A.core.state.flags._sumi_attack_learned;}),true);
    }
    await page.evaluate(async()=>{
      A.vn.vnTest.turbo=true; await A.lesson.studyAttack(); A.core.load(); A.start('tournament');
    });
    const button=page.locator('[data-test="dodge-slash"]');
    await button.waitFor();
    await page.waitForFunction(()=>!document.querySelector('[data-test="dodge-slash"]').disabled);
    assert(await page.locator('[data-test="slash-lock"]').isHidden());
    assert.match(await button.getAttribute('title'),/Z／ボタン/);
    assert.doesNotMatch(await button.getAttribute('aria-label'),/使用不可/);
    await page.evaluate(()=>A.padPressed=true); await page.waitForTimeout(150);
    assert.equal(await button.getAttribute('data-uses'),'1');
    await page.waitForFunction(()=>!document.querySelector('[data-test="dodge-slash"]').disabled);
    assert.equal(await button.getAttribute('data-uses'),'1','Held pad repeated attack');
    await page.evaluate(()=>A.padPressed=false); await page.waitForTimeout(100);
    if(mobile) { const r=await button.boundingBox(); await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2); }
    else await page.keyboard.press('z');
    assert.equal(await button.getAttribute('data-uses'),'2');
    await page.screenshot({path:`${shots}/attack-learned-${name}.png`});
    await page.locator('.result-card.show').waitFor();
    await page.locator('[data-test="step-next"]').click(); await page.evaluate(()=>A.running);
    assert.equal(await page.evaluate(()=>A.cs.steam.slashesUsed),2);
  }, mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{});
});
