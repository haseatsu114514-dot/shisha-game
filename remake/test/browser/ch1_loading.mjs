// #609: distinguish asset readiness from animation; do not gate a line on future portraits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {suite, storageSnapshot as rawStorageSnapshot} from './support.mjs';
// #1950: 既読SKIPのため、読んだ台詞の記録（suien_remake_seen_dialogue_lines）は意図して保存される。
// ここで守るのはセーブ等それ以外の保存が読み込み待ちで変わらないこと。
const SEEN_LINES_KEY='suien_remake_seen_dialogue_lines';
async function storageSnapshot(page){const snap=await rawStorageSnapshot(page);delete snap.local[SEEN_LINES_KEY];return snap;}

const measurements=[];
const out=process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser';
async function prepare(page) {
  await page.evaluate(async()=>{
    const core=await import('./js/core/state.js');core.newGame();core.config.textSpeed=4;
    const ui=await import('./js/core/ui.js'),data=await import('./js/core/data.js'),vn=await import('./js/vn/engine.js');
    ui.clearScreen();await ui.setBg(data.bgUrl('bg_tonari_inside_day'),{instant:true});
    window.L={core,ui,data,vn,events:[],lines:[]};
    vn.hooks.onLine=(id,line)=>L.lines.push({id,text:line.text,at:performance.now()});
    new MutationObserver(records=>{
      for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&n.matches('.vn-loading,.craft-loading')){
        const event={text:n.textContent,start:performance.now(),end:null};L.events.push(event);
        const observer=new MutationObserver(()=>{if(!n.isConnected){event.end=performance.now();observer.disconnect();}});
        observer.observe(document.body,{subtree:true,childList:true});
      }
    }).observe(document.body,{subtree:true,childList:true});
  });
}
async function remember(page,label) {
  const row=await page.evaluate(()=>({start:L.start,lines:L.lines,loading:L.events}));
  measurements.push({label,...row});return row;
}

try { await suite('ch1-loading',async check=>{
  for(const [device,options] of [['pc',{}],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
    await check(`${device}-warm-scene`,async page=>{
      await prepare(page);
      await page.evaluate(async()=>{
        // Match the title's bounded warm-up fixture before measuring zero image
        // requests. Network-idle would also wait for unrelated streaming audio.
        await L.ui.warmUiArt();
        const bgs=['bg_osu_map_day','bg_osu_map_night','bg_tonari_inside_day','bg_tonari_inside_night',
          'bg_home_day','bg_home_night','bg_shop','bg_tournament_stage'];
        const faces=['sumi','tsumugi','naru','adam','minto','rin','pakki'];
        const urls=[...bgs.map(id=>L.data.bgUrl(id)),...faces.map(id=>L.data.portraitInfo(id,'normal').src),
          ...['bench_base.png','stove_coil.png','hookah_base.png'].map(id=>L.data.makingUrl(id))];
        await Promise.all(urls.map(url=>L.ui.imageReady(url,15000)));
      });
      const before=await storageSnapshot(page),requests=[];
      page.on('request',r=>{if(/\.(webp|png)(\?|$)/.test(r.url()))requests.push(r.url());});
      await page.evaluate(()=>{
        L.stop=new AbortController();L.start=performance.now();
        L.play=L.vn.play({dialogue_id:'loading_warm',lines:[{text:'読み込み済みの場面。'},{type:'choice',choices:[{text:'続ける',next:'end'}]}],branches:{end:[]}},{bg:'bg_home_day',signal:L.stop.signal});
      });
      await page.waitForFunction(()=>L.lines.length===1);
      const row=await remember(page,`${device}-warm-scene`);
      assert.deepEqual(requests,[],'Warm scene should not request image bytes again');
      assert.equal(row.loading.length,0,'Transition animation was counted as image loading');
      assert.deepEqual(await storageSnapshot(page),before);
      await page.evaluate(async()=>{L.stop.abort();await L.play;});
    },options);

    await check(`${device}-future-portrait`,async page=>{
      await prepare(page);const before=await storageSnapshot(page);
      await page.route('**/chr_sumi_smile.webp',async route=>{
        const response=await route.fetch();await new Promise(r=>setTimeout(r,1800));await route.fulfill({response});
      });
      await page.evaluate(()=>{L.stop=new AbortController();L.start=performance.now();L.play=L.vn.play('remake_tutorial_result',{signal:L.stop.signal});});
      await page.waitForFunction(()=>L.lines.length>0);
      const row=await remember(page,`${device}-future-portrait`);
      assert.match(row.lines[0].text,/最後の一服/);
      assert(row.lines[0].at-row.start<500,`Future expression delayed narration: ${row.lines[0].at-row.start}ms`);
      await page.keyboard.press('Enter');
      await page.locator('[data-test="vn-loading"]').waitFor();
      for(let i=0;i<4;i++)await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>L.lines.length),1,'Input advanced through the pending portrait');
      await page.waitForFunction(()=>L.lines.length===2);
      assert(await page.locator('.portrait[data-speaker="sumi"]').evaluate(n=>n.complete&&n.naturalWidth>0));
      await remember(page,`${device}-future-portrait-used`);
      assert.deepEqual(await storageSnapshot(page),before);
      await page.evaluate(async()=>{L.stop.abort();await L.play;});
    },options);

    await check(`${device}-flashback-next-while-loading`,async page=>{
      await prepare(page);const before=await storageSnapshot(page);
      const url=await page.evaluate(()=>new URL(L.data.portraitInfo('hiyori','normal').src,location.href).href);
      let release;const held=new Promise(r=>{release=r;});
      await page.route(url,async route=>{await held;await route.continue();});
      const advance=()=>device==='touch'?page.locator('.vn-box').tap():page.keyboard.press('Enter');
      try {
        await page.evaluate(()=>{
          L.core.markMet('hiyori');L.core.state.flags._intro_hiyori=true;L.start=performance.now();L.done=false;
          L.play=L.vn.play({dialogue_id:'loading_flashback',lines:[
            {type:'fx',id:'flashback'},{speaker:'hiyori',face:'student_smile',text:'学生の頃'},
            {type:'fx',id:'flashback_off'},{speaker:'hiyori',face:'normal',text:'今の話'},
          ]}).then(result=>{L.done=true;return result;});
        });
        await page.locator('#vn.flashback .vn-next.show').waitFor();
        assert.equal(await page.locator('.vn-text').innerText(),'学生の頃');
        await advance();
        await page.locator('#vn:not(.flashback)').waitFor();
        assert.equal(await page.locator('.vn-next.show').count(),0,'Previous line still advertises Next while the new portrait is pending');
        await page.locator('[data-test="vn-loading"]').waitFor();
        for(let i=0;i<3;i++)await advance();
        assert.deepEqual(await page.evaluate(()=>L.lines.map(line=>line.text)),['学生の頃'],'Input skipped the pending line');
        assert.equal(await page.evaluate(()=>L.done),false);
      }finally{release();}
      await page.locator('#vn:not(.flashback) .vn-next.show').waitFor();
      assert.equal(await page.locator('.vn-text').innerText(),'今の話');
      assert(await page.locator('.portrait[data-speaker="hiyori"]').evaluate(n=>n.complete&&n.naturalWidth>0));
      assert.equal(await page.locator('[data-test="vn-loading"]').count(),0);
      await advance();await page.waitForFunction(()=>L.done);
      assert.deepEqual(await page.evaluate(()=>L.lines.map(line=>line.text)),['学生の頃','今の話']);
      assert.deepEqual(await storageSnapshot(page),before);
      await remember(page,`${device}-flashback-next-while-loading`);
    },options);

    await check(`${device}-initial-portrait-and-skip`,async page=>{
      await prepare(page);const before=await storageSnapshot(page);
      let release;const held=new Promise(r=>{release=r;});
      await page.route('**/chr_minto_ura_normal.webp',async route=>{await held;await route.continue();});
      try {
        await page.evaluate(()=>{L.stop=new AbortController();L.start=performance.now();
          L.play=L.vn.play({dialogue_id:'loading_required',lines:[{text:'お姉さんが入ってきた。',portrait:'oneesan',portrait_face:'ura_normal'},
            {type:'choice',choices:[{text:'話を聞く',next:'end'}]}],branches:{end:[]}},{signal:L.stop.signal});});
        await page.locator('[data-test="vn-loading"]').waitFor();
        for(let i=0;i<5;i++){await page.keyboard.press('Enter');await page.mouse.click(500,450);}
        // The scene is still covered. Exercise the handler without hit-testing the covering layer.
        await page.locator('[data-test="vn-skip"]').dispatchEvent('click');
        assert.equal(await page.evaluate(()=>L.lines.length),0,'Required portrait was skipped');
      }finally{release();}
      await page.locator('.vn-choices.show').waitFor();
      assert(await page.locator('.portrait[data-speaker="oneesan"]').evaluate(n=>n.complete&&n.naturalWidth>0));
      assert.equal(await page.evaluate(()=>L.lines.length),1);
      assert.equal(await page.locator('[data-test="vn-loading"]').count(),0);
      assert.deepEqual(await storageSnapshot(page),before);
      await remember(page,`${device}-initial-portrait-and-skip`);
      await page.evaluate(async()=>{L.stop.abort();await L.play;});
    },options);

    await check(`${device}-cancel-while-loading`,async page=>{
      await prepare(page);const before=await storageSnapshot(page);
      const statsBefore=await page.evaluate(()=>({...L.core.state.stats}));
      let release;const held=new Promise(r=>{release=r;});
      await page.route('**/chr_minto_ura_normal.webp',async route=>{await held;await route.continue();});
      try {
        await page.evaluate(()=>{L.stop=new AbortController();L.start=performance.now();L.play=L.vn.play({dialogue_id:'cancel_old',metadata:{add_stat:{technique:5}},lines:[{speaker:'oneesan',text:'古い画面。'}]},{signal:L.stop.signal});});
        await page.locator('[data-test="vn-loading"]').waitFor();
        await page.evaluate(async()=>{L.stop.abort();await L.play;L.newStop=new AbortController();L.newPlay=L.vn.play({dialogue_id:'cancel_new',lines:[{text:'新しい画面。'},{type:'choice',choices:[{text:'待つ',next:'end'}]}],branches:{end:[]}},{signal:L.newStop.signal});});
        await page.waitForFunction(()=>L.lines.some(l=>l.id==='cancel_new'));
      }finally{release();}
      await page.waitForFunction(()=>!document.querySelector('[data-test="vn-loading"]'));
      await page.evaluate(async()=>{await L.ui.imageReady(L.data.portraitInfo('oneesan','normal').src,15000);});
      assert.deepEqual(await page.evaluate(()=>L.lines.map(x=>x.id)),['cancel_new']);
      assert.equal(await page.locator('.portrait[data-speaker="oneesan"]').count(),0);
      assert.deepEqual(await storageSnapshot(page),before);
      assert.deepEqual(await page.evaluate(()=>L.core.state.stats),statsBefore,'Cancelled scene granted its completion reward');
      await remember(page,`${device}-cancel-while-loading`);
      await page.evaluate(async()=>{L.newStop.abort();await L.newPlay;});
    },options);

    await check(`${device}-image-error-retry`,async page=>{
      await prepare(page);
      const url=await page.evaluate(()=>new URL(L.data.portraitInfo('sumi','normal').src+'?loading609=retry',location.href).href);
      let calls=0;
      await page.route(url,async route=>{calls++;if(calls===1)await route.fulfill({status:200,contentType:'image/webp',body:'broken-image'});else await route.continue();});
      const result=await page.evaluate(async url=>({first:await L.ui.imageReady(url,15000),retry:await L.ui.imageReady(url,15000),cached:await L.ui.imageReady(url,15000)}),url);
      assert.deepEqual(result,{first:false,retry:true,cached:true});assert.equal(calls,2);
    },options);

    await check(`${device}-auto-pending-expression`,async page=>{
      await prepare(page);
      let release;const held=new Promise(r=>{release=r;});
      await page.route('**/chr_sumi_smile.webp',async route=>{await held;await route.continue();});
      try {
        await page.evaluate(()=>{L.stop=new AbortController();L.start=performance.now();
          L.play=L.vn.play({dialogue_id:'loading_auto',lines:[{text:'待つ。'},
            {speaker:'sumi',face:'smile',text:'届いてから話す。'},
            {type:'choice',choices:[{text:'続ける',next:'end'}]}],branches:{end:[]}},{signal:L.stop.signal});});
        await page.waitForFunction(()=>L.lines.length===1);
        await page.locator('[data-test="vn-auto"]').click();
        await page.locator('[data-test="vn-loading"]').waitFor();
        for(let i=0;i<4;i++)await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(()=>L.lines.length),1);
      }finally{release();}
      await page.locator('[data-test="choice-0"]').waitFor();
      assert.equal(await page.evaluate(()=>L.lines.length),2);
      assert(await page.locator('.portrait[data-speaker="sumi"]').evaluate(n=>n.complete&&n.naturalWidth>0));
      await remember(page,`${device}-auto-pending-expression`);
      await page.locator('[data-test="vn-auto"]').click();
      await page.evaluate(async()=>{L.stop.abort();await L.play;});
    },options);

    await check(`${device}-warm-bench-after-scene`,async page=>{
      await prepare(page);
      await page.evaluate(async()=>{
        L.session=await import('./js/craft/session.js');L.cs=L.session.newSession('tutorial');
        await L.session.openBench(L.cs).ready;
        await L.ui.setBg(L.data.bgUrl('bg_home_day'),{instant:true});
        // instant setBg resolves after inserting the CSS background, before paint.
        // Let that intervening scene render before measuring the cached bench's
        // requests; otherwise its deferred CSS image request belongs to this window.
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        L.events=[];
      });
      const requests=[];page.on('request',r=>{if(/\.(webp|png)(\?|$)/.test(r.url()))requests.push(r.url());});
      await page.evaluate(()=>{L.start=performance.now();const b=L.session.openBench(L.cs);L.bench=b;
        L.ready=b.ready.then(()=>{L.done=performance.now();});});
      assert(await page.locator('.bench').evaluate(n=>n.inert),'Animation must still guard input');
      await page.evaluate(()=>L.ready);
      const row=await remember(page,`${device}-warm-bench-after-scene`);
      assert.equal(row.loading.length,0,'Cached bench animation was counted as loading');
      assert.deepEqual(requests,[]);
      assert.equal(await page.locator('.bench').evaluate(n=>n.inert),false);
      measurements.at(-1).readyMs=await page.evaluate(()=>L.done-L.start);
    },options);
  }
});}finally{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'ch1-loading-measurements.json'),JSON.stringify(measurements,null,2)+'\n');}
