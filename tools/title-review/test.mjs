import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseImport, exportData, migrateLegacy, STORAGE_KEY } from './model.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.REVIEW_URL || 'http://127.0.0.1:8123/tools/title-review/';
const out = path.resolve(process.env.ARTIFACT_DIR || 'work/title-review-qa');
fs.mkdirSync(out,{recursive:true});
const browser = await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath:process.env.CHROME_EXECUTABLE_PATH} : {})});
const results=[];
let catalog;
async function check(label, fn, options={}, init) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,...options});
  if(init) await context.addInitScript(init);
  const page=await context.newPage(); page.setDefaultTimeout(12000);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(base); await page.locator('.card').first().waitFor();
    await fn(page,context);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(out,label+'.png'),fullPage:false});
    results.push({label,status:'passed'}); console.log('PASS '+label);
  } catch(error) {
    await page.screenshot({path:path.join(out,label+'-failed.png')}).catch(()=>{});
    results.push({label,status:'failed',error:String(error.stack),errors}); console.error('FAIL '+label+'\n'+error.stack);
  } finally {await context.close();}
}
const sentinel='{"schema":5,"day":9,"ownerQA":"untouched"}';
const seed=()=>localStorage.setItem('suien_remake_save','{"schema":5,"day":9,"ownerQA":"untouched"}');
try {
  await check('all-images-and-catalog',async page=>{
    catalog=await page.evaluate(async()=>await(await fetch('catalog.json')).json());
    assert.equal(catalog.summary.current,41); assert.equal(new Set(catalog.items.map(a=>a.id)).size,catalog.items.length);
    assert.equal(catalog.items.filter(a=>a.groups.includes('アゲハ修正')).length,5);
    assert.equal(catalog.items.filter(a=>a.groups.includes('タッパー修正')).length,5);
    assert.equal(catalog.items.filter(a=>a.current&&a.character==='hiyori').length,6);
    assert.equal(catalog.characters.samechan,'サメちゃん／波多野なぎさ');
    const urls=[...catalog.items.flatMap(a=>[a.image,a.thumbnail]),...Object.values(catalog.references).flat().map(a=>a.url)];
    const failures=await page.evaluate(async urls=>{
      const failures=[];
      for(let i=0;i<urls.length;i+=2) await Promise.all(urls.slice(i,i+2).map(async url=>{
        const im=new Image();im.src=url;
        try{await im.decode();if(!im.naturalWidth)throw Error('empty');}catch{failures.push(url);}
      })); return failures;
    },urls);
    assert.deepEqual(failures,[]); results.push({label:'image-URLs',status:'passed',count:urls.length});
    for(const char of Object.keys(catalog.characters)) {
      await page.locator('#character').selectOption(char);
      assert.equal(await page.locator('.card').count(),catalog.items.filter(a=>a.character===char).length);
    }
    await page.locator('#reset').click();
    for(const group of [...new Set(catalog.items.flatMap(a=>a.groups))]) {
      await page.locator('#group').selectOption(group);
      assert.equal(await page.locator('.card').count(),catalog.items.filter(a=>a.groups.includes(group)).length);
    }
    await page.locator('#reset').click();
    const one=catalog.items[0]; const d={[one.id]:{status:'hold',note:'<script>alert(1)</script>',updatedAt:new Date().toISOString()}};
    assert.deepEqual(parseImport(exportData(d,catalog),catalog),d);
    for(const invalid of [{}, {application:'shisha-title-review',version:1,decisions:{unknown:{status:'hold',note:''}}}, exportData({[one.id]:{status:'official',note:''}},catalog),exportData({[one.id]:{status:'hold',note:'x'.repeat(4001)}},catalog)]) assert.throws(()=>parseImport(invalid,catalog));
    const duplicate=catalog.items.find(a=>a.sources.length>1);
    assert.throws(()=>migrateLegacy({[duplicate.sources[0]]:'adopt',[duplicate.sources[1]]:'reject'},catalog));
  });
  for(const [label,options] of [['desktop',{viewport:{width:1440,height:1000}}],['mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],['small-mobile',{viewport:{width:320,height:740},isMobile:true,hasTouch:true}]]) {
    await check(label,async page=>{
      await page.locator('#character').selectOption('ageha');
      const cards=page.locator('.card');
      for(let i=0;i<2;i++) { const button=cards.nth(i).locator('.select-art'); if(options.hasTouch)await button.tap();else await button.click(); }
      await page.locator('#compare').click();
      assert.equal(await page.locator('.comparison .review-panel').count(),2);
      await page.locator('.comparison').screenshot({path:path.join(out,label+'-compare-two.png')});
      await page.locator('#close-viewer').click();
      await cards.nth(2).locator('.select-art').click();
      await page.locator('#compare').click();assert.equal(await page.locator('.comparison .review-panel').count(),3);await page.locator('#close-viewer').click();
      await cards.nth(3).locator('.select-art').click();
      await cards.nth(4).locator('.select-art').click();
      assert.match(await page.locator('#notice').innerText(),/4枚まで/);
      await page.locator('#compare').click();
      assert.equal(await page.locator('.comparison .review-panel').count(),4);
      const first=page.locator('.comparison .review-panel').first();
      if(options.hasTouch)await first.locator('[data-status=candidate]').tap();else await first.locator('[data-status=candidate]').click();
      assert.equal(await first.locator('.decision-badge').innerText(),'採用候補');
      await first.locator('textarea').fill('顔と目の年齢感。<b>メモはテキスト</b>');
      await first.locator('.references').locator('..').locator('summary').click();
      await first.locator('.image-viewport button').click();
      assert.equal(await first.locator('.image-viewport.zoomed').count(),1);
      await first.locator('.image-viewport button').click();
      await page.locator('#viewer').screenshot({path:path.join(out,label+'-compare-four.png')});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.ok(await page.locator('#viewer').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
      await page.locator('#close-viewer').click();
      const before=await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY); assert.ok(before);
      assert.equal(await page.evaluate(()=>localStorage.getItem('suien_remake_save')),sentinel);
      await page.reload(); await page.locator('.card').first().waitFor();
      assert.equal(await page.locator('#character').inputValue(),'ageha');
      assert.equal(await page.locator('.card.selected').count(),4);
      await page.locator('#compare').click();
      assert.equal(await page.locator('.comparison textarea').first().inputValue(),'顔と目の年齢感。<b>メモはテキスト</b>');
      assert.equal(await page.locator('.comparison [data-status=candidate][aria-pressed=true]').count(),1);
      await page.locator('#close-viewer').click();
      await page.locator('#decision').selectOption('candidate'); assert.equal(await page.locator('.card').count(),1);
      await page.locator('#reset').click();
      await page.locator('#current').selectOption('yes'); assert.equal(await page.locator('.card').count(),41);
      await page.locator('#reset').click();
      await page.locator('#search').fill('タッパー'); assert.ok(await page.locator('.card').count()>=5);
      await page.locator('#reset').click();
      const downloadPromise=page.waitForEvent('download'); await page.locator('#export').click(); const download=await downloadPromise;
      const filename=path.join(out,label+'-decisions.json'); await download.saveAs(filename);
      const json=JSON.parse(fs.readFileSync(filename)); assert.equal(Object.values(json.decisions)[0].status,'candidate');
      const unchanged=await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY);
      await page.locator('#file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
      await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('JSONを取り込めません'));
      assert.equal(await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY),unchanged);
      await page.locator('#file').setInputFiles({name:'unknown.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({application:'shisha-title-review',version:1,decisions:{unknown:{status:'hold',note:''}}}))});
      await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('目録にない'));
      assert.equal(await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY),unchanged);
      await page.locator('#file').setInputFiles(filename); await page.locator('#cancel-import').click();
      assert.equal(await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY),unchanged);
      // Change then restore from the real exported file. Target the art that owns
      // the exported decision (the first ageha card): the catalog's first card is a
      // different art, and the merge-style import would leave a temporary decision
      // for it behind, breaking the deep-equal below.
      await page.locator('#character').selectOption('ageha');
      await page.locator('.card').first().locator('.art-button').click();
      await page.locator('[data-status=reject]').click(); await page.locator('textarea').fill('temporary'); await page.locator('#close-viewer').click();
      await page.locator('#file').setInputFiles(filename); await page.locator('#apply-import').click();
      const restored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).decisions,STORAGE_KEY); assert.deepEqual(restored,json.decisions);
      assert.equal(await page.evaluate(()=>localStorage.getItem('suien_remake_save')),sentinel);
      await page.locator('.card').first().locator('.art-button').click();
      await page.locator('#viewer').screenshot({path:path.join(out,label+'-detail.png')});
      await page.locator('#close-viewer').click();
    },options,seed);
  }
  await check('failed-image',async page=>{
    await page.route('**/media/*.webp',route=>route.abort());
    await page.reload(); await page.locator('.image-error').first().waitFor();
    await page.locator('.card').first().locator('.art-button').click();
    await page.locator('#viewer .image-error').first().waitFor();
    assert.match(await page.locator('#viewer .image-error').first().innerText(),/読み込めません/);
  });
  await check('save-unavailable',async page=>{
    await page.locator('.card').first().locator('.art-button').click(); await page.locator('[data-status=hold]').click();
    assert.match(await page.locator('#save-state').innerText(),/保存できません/);
    assert.match(await page.locator('#notice').innerText(),/JSONを書き出し/);
  },{},()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','QuotaExceededError');};});
  await check('corrupt-storage-preserved',async page=>{
    assert.match(await page.locator('#notice').innerText(),/読込に失敗/);
    await page.locator('.card').first().locator('.art-button').click();await page.locator('[data-status=hold]').click();
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY),'{broken');
    assert.match(await page.locator('#notice').innerText(),/上書きしていません/);
  },{},()=>localStorage.setItem('shisha-title-review-v4','{broken'));
  await check('related-before-after',async page=>{
    await page.locator('#group').selectOption('アゲハ修正');
    const target=catalog.items.find(a=>a.groups.includes('アゲハ修正')&&a.related.some(id=>catalog.items.find(b=>b.id===id)?.current));
    await page.locator(`[data-art="${target.id}"] .art-button`).click();
    await page.locator('#viewer .related button').first().click();
    assert.equal(await page.locator('.comparison .review-panel').count(),2);
    assert.equal(await page.locator('.comparison .badge.live').count(),1);
  });
  await check('legacy-prototype-migration',async page=>{
    const stored=await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY);assert.equal(stored,null);
    assert.match(await page.locator('#notice').innerText(),/移行しました/);
    await page.locator('#decision').selectOption('candidate'); assert.equal(await page.locator('.card').count(),1);
    assert.ok(await page.evaluate(()=>localStorage.getItem('shisha-title-review-v3')));
  },{},()=>localStorage.setItem('shisha-title-review-v3',JSON.stringify({'assets/ui/title_arts/title_art_ageha_01_professional_taste.png':'adopt'})));
} finally {
  await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,summary:catalog?.summary,results},null,2)+'\n');
}
assert.ok(results.length);assert.equal(results.filter(r=>r.status==='failed').length,0,'Browser QA failed');
