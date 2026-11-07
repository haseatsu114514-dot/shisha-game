// 第1章末: 予告なしでクリア画面→既存の第2章タイトルへ。旧予告フラグは無視して保全する。
import assert from "node:assert/strict";
import { suite, assertFits, storageSnapshot } from "./support.mjs";
await suite("ch1-preview",async check=>{
  for(const seen of [undefined,false,true]) for(const touch of [false,true]) {
    await check(`clear-${String(seen)}-${touch?"touch":"pc"}`,async page=>{
      await page.evaluate(async seen=>{
        const c=await import('./js/core/state.js');c.newGame();c.state.phase='cleared';
        if(seen!==undefined)c.state.flags._ch1_preview_seen=seen;
        c.save();localStorage.setItem('suien_remake_slot1','keep-manual');
      },seen);
      const before=await storageSnapshot(page);
      await page.evaluate(async()=>{await(await import('./js/chapters/ch1.js')).showClear();});
      await page.locator('[data-test="end-chapter2"]').waitFor();
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.chapter-preview').count(),0);
      assert.equal(await page.locator('[data-test="end-preview"]').count(),0);
      assert(!(await page.locator('[data-test="end-chapter2"]').isDisabled()));
      assert.equal(await page.evaluate(()=>__remake.state.flags._ch1_preview_seen),seen);
      assert.deepEqual(await storageSnapshot(page),before);
      await assertFits(page,'[data-test="end-chapter2"], [data-test="end-title"]');
    },touch?{viewport:{width:844,height:390},hasTouch:true,isMobile:true}:{});
  }
  await check('next-chapter-title-once-and-resume',async page=>{
    await page.evaluate(async()=>{
      const c=await import('./js/core/state.js');c.newGame();c.state.phase='cleared';c.save();
      window.cards=[];
      new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1){
        if(n.matches('.chapter-card'))cards.push(n.dataset.chapter);
        for(const x of n.querySelectorAll('.chapter-card'))cards.push(x.dataset.chapter);
      }}).observe(document.getElementById('fx'),{childList:true,subtree:true});
      await(await import('./js/chapters/ch1.js')).showClear();
    });
    // 章タイトルの直前に第2章の巻頭ポエム（poem_ch2）が出る。自動送り（turbo）では演出を飛ばし、titleSeen まで進める。
    await page.evaluate(async()=>{(await import('./js/vn/engine.js')).vnTest.turbo=true;});
    await page.locator('[data-test="end-chapter2"]').click();
    const title=page.locator('.chapter-card.show[data-chapter="第二章"]');await title.waitFor({timeout:30000});
    await page.keyboard.press('Enter');await page.keyboard.press('Space');
    await page.keyboard.down('Control');await page.keyboard.up('Control');
    await page.locator('.chapter-title-shield').waitFor({state:'detached',timeout:12000});
    await page.waitForFunction(()=>__remake.state.flags._ch2_day1.titleSeen);
    assert.deepEqual(await page.evaluate(()=>cards),['第二章']);
    assert.equal(await page.locator('.chapter-preview').count(),0);
    assert.equal(await page.evaluate(()=>__remake.state.chapter),2);
    await page.reload();
    await page.locator('[data-test="title-load"]').click();await page.locator('[data-test="slot-0"]').click();
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('.chapter-card,.chapter-preview').count(),0,'再開時に読了済みの章題や予告を繰り返さない');
    assert.equal(await page.evaluate(()=>__remake.state.chapter),2);
  });
});
