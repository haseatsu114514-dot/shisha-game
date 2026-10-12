import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { correctionText, correctionIssueDraft, STORAGE_KEY } from './model.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(dir,'catalog.json')));
const art = catalog.items[0], another = catalog.items.find(a=>a.character==='hiyori');
const note = '顔は本人の目に寄せる。\n衣装はそのまま。 & # + % <b>試験</b>';
const decisions = { [art.id]: { status:'hold', note }, [another.id]: { status:'reject', note:'背景の光を弱めたい' } };
const text = correctionText(decisions,catalog);
assert.ok(text.includes(art.sha256) && text.includes(note) && text.includes('メモ件数: 2'));
assert.ok(text.includes(another.sha256));
assert.ok(!correctionText(decisions,catalog,[art.id]).includes(another.sha256));
const draft = correctionIssueDraft(art, decisions[art.id],catalog);
assert.ok(draft.url);const params = new URL(draft.url).searchParams;
assert.equal(params.get('body'),draft.body);assert.equal(params.get('title'),draft.title);
assert.ok(params.get('body').includes(note));
assert.equal(correctionIssueDraft(art,{status:'hold',note:'修'.repeat(4000)},catalog).url,null);
assert.ok(correctionText({[art.id]:{status:'hold',note:'修'.repeat(4000)}},catalog).includes('修'.repeat(4000)));
assert.throws(()=>correctionText({},catalog));assert.throws(()=>correctionIssueDraft(art,{status:'hold',note:' \n '},catalog));

const { chromium }=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
const base=process.env.REVIEW_URL || 'http://127.0.0.1:8123/tools/title-review/';
const out=path.resolve(process.env.ARTIFACT_DIR||'work/title-review-notes-qa');fs.mkdirSync(out,{recursive:true});
const results=[{label:'text-and-draft-model',status:'passed'}];
try {
 for(const [label,options] of [['desktop',{viewport:{width:1440,height:1000}}],['mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],['small-mobile',{viewport:{width:320,height:740},isMobile:true,hasTouch:true}]]) {
  const context=await browser.newContext({...options,acceptDownloads:true});
  const errors=[];const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  // A local candidate can be tested against the currently published catalog/images without copying source art.
  if(process.env.PREVIEW_LOCAL==='1') {
   for(const f of ['index.html','app.js','model.mjs','style.css']) {
    const url=f==='index.html' ? base : new URL(f,base).href;
    await context.route(url,route=>route.fulfill({path:path.join(dir,f),contentType:f==='index.html'?'text/html':f.endsWith('.css')?'text/css':'application/javascript'}));
   }
  }
  // Inspect only a form-navigation URL. Never post an Issue or exercise a real user's account.
  await context.route('https://github.com/haseatsu114514-dot/shisha-game/issues/new**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Issue form test</title><p>draft only</p>'}));
  try {
   await page.goto(base);await page.locator('.card').first().waitFor();
   assert.equal(await page.locator('#export-notes').isDisabled(),true);
   await page.locator(`[data-art="${art.id}"] .art-button`).click();
   assert.equal(await page.locator('[data-action=issue-draft]').isDisabled(),true);
   await page.locator('textarea').fill(note);
   await page.locator('[data-status=hold]').click();
   assert.equal(await page.locator('[data-action=issue-draft]').isDisabled(),false);
   const before=await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY);
   const popupPromise=context.waitForEvent('page');
   if(options.hasTouch)await page.locator('[data-action=issue-draft]').tap();else await page.locator('[data-action=issue-draft]').click();
   const popup=await popupPromise;await popup.waitForURL('https://github.com/**');await popup.waitForLoadState();
   const body=new URL(popup.url()).searchParams.get('body');
   assert.ok(body.includes(note) && body.includes(art.sha256) && body.includes('保留'));
   assert.equal(new URL(popup.url()).searchParams.get('title'),draft.title);
   assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();
   const dp=page.waitForEvent('download');await page.locator('[data-action=memo-text]').click();const dl=await dp;
   const filename=path.join(out,label+'-one.txt');await dl.saveAs(filename);
   const one=fs.readFileSync(filename,'utf8');assert.ok(one.includes(note)&&one.includes(art.sha256));assert.ok(!one.includes(another.sha256));
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY),before);
   await page.locator('textarea').fill('修'.repeat(4000));
   await page.locator('[data-action=issue-draft]').click();assert.match(await page.locator('.memo-hint').innerText(),/全文を書き出し/);
   const longDownload=page.waitForEvent('download');await page.locator('[data-action=memo-text]').click();const long=await longDownload;
   const lf=path.join(out,label+'-long.txt');await long.saveAs(lf);assert.ok(fs.readFileSync(lf,'utf8').includes('修'.repeat(4000)));
   await page.locator('textarea').fill(note);
   await page.locator('#viewer').screenshot({path:path.join(out,label+'-note.png')});
   await page.locator('#close-viewer').click();
   await page.locator('#character').selectOption('hiyori');await page.locator(`[data-art="${another.id}"] .art-button`).click();
   await page.locator('textarea').fill('背景の光を弱めたい');await page.locator('#close-viewer').click();
   assert.match(await page.locator('#export-notes').innerText(),/2件/);
   // All notes are exported even when a character filter hides a noted image.
   const allDownload=page.waitForEvent('download');await page.locator('#export-notes').click();const all=await allDownload;
   const af=path.join(out,label+'-all.txt');await all.saveAs(af);const allText=fs.readFileSync(af,'utf8');
   assert.ok(allText.includes(note)&&allText.includes('背景の光を弱めたい')&&allText.includes('メモ件数: 2'));
   await page.reload();await page.locator('.card').first().waitFor();assert.match(await page.locator('#export-notes').innerText(),/2件/);
   assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(out,label+'.png')});results.push({label,status:'passed'});console.log('PASS notes '+label);
  } catch(error) {results.push({label,status:'failed',error:error.stack,errors});console.error(error.stack);await page.screenshot({path:path.join(out,label+'-failed.png')}).catch(()=>{});}
  finally {await context.close();}
 }
} finally {await browser.close();fs.writeFileSync(path.join(out,'notes-results.json'),JSON.stringify({base,previewLocal:process.env.PREVIEW_LOCAL==='1',results},null,2)+'\n');}
assert.equal(results.filter(r=>r.status==='failed').length,0);
