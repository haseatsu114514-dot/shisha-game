// Follow-up repairs: exercise all expressions and compare five changed sprites.
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, 'remake/test/browser/node_modules/playwright'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'remake/data/manifest.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json')));
const out = path.join(__dirname, 'followup-runtime-review');
const crops = '/tmp/portrait-followup-crops';
const otherCharacters = false;
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(crops, { recursive: true });
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
 const results = [];
 try {
  for (const viewport of otherCharacters ? [{ width: 844, height: 390 }] : [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
   // The VN intentionally hides the player (hajime); audit his five assets in the static gallery.
   const jobs = otherCharacters ? Object.keys(manifest.portraits).filter(c=>!['minto','ageha','hajime'].includes(c)).map(c=>[c,'normal']) : [['minto', ['smile']], ['ageha', ['normal', 'serious', 'smile', 'surprise']]];
   for (const [cid, changed] of jobs) {
    for (const version of otherCharacters ? ['after'] : ['before', 'after']) {
     const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
     const page = await context.newPage(); const errors = []; let substitutions = 0;
     page.on('pageerror', e => errors.push(e.message));
     if (version === 'before') for (const face of changed) await page.route(`**/img/sprites/characters/${cid}/chr_${cid}_${face}.webp`, async route => {
      substitutions++;
      await route.fulfill({ path: path.join(root, `asset_sources/portraits/face-corrections-followup/previous/chr_${cid}_${face}.png`), contentType: 'image/png' });
     });
     await page.goto('http://127.0.0.1:8123/remake/');
     await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
     await page.locator('#boot').waitFor({ state: 'detached' });
     const faces = version === 'before' ? changed : manifest.portraits[cid].faces;
     await page.evaluate(async ({ cid, faces }) => {
      const state = await import('./js/core/state.js'); state.newGame(); state.state.met[cid] = true; state.state.flags[`known_name_${cid}`] = true;
      const vn = await import('./js/vn/engine.js');
      window.reviewRun = vn.play({ dialogue_id: '__portrait_review', metadata: { bg: 'peppermint.png' }, lines: faces.map(face => ({ speaker: cid, face, text: '表情確認。' })) });
     }, { cid, faces });
     for (let n = 0; n < faces.length; n++) {
      const face = faces[n], suffix = `chr_${cid}_${face}.webp`;
      await page.waitForFunction(suffix => [...document.querySelectorAll('.portrait.active')].some(i => i.src.endsWith(suffix) && i.complete && i.naturalWidth), suffix);
      await page.waitForTimeout(750);
      const info = await page.locator('.portrait.active').evaluate(i => { const r = i.getBoundingClientRect(); return { src: i.src, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, x:r.x,y:r.y,width:r.width,height:r.height }; });
      assert(info.src.endsWith(suffix)); assert(info.naturalWidth>0&&info.naturalHeight>0);
      assert(Math.abs(info.width / info.height - info.naturalWidth / info.naturalHeight) < .001);
      if (version === 'before') assert(substitutions > 0);
      assert.deepEqual(errors, []);
      if (changed.includes(face) && !otherCharacters) await page.screenshot({ path: path.join(out, `${cid}-${face}-${version}-${viewport.width}.jpg`) });
      if (version === 'after') {
       const [x,y,x2,y2] = catalog.find(r => r.character === cid && r.expression === face).crop;
       const k = info.width / info.naturalWidth;
       const clip = { x:Math.max(0,info.x+x*k), y:Math.max(0,info.y+y*k), width:(x2-x)*k, height:(y2-y)*k };
       clip.width = Math.min(clip.width,viewport.width-clip.x); clip.height = Math.min(clip.height,viewport.height-clip.y);
       await page.screenshot({ path:path.join(crops, `${cid}-${face}-${viewport.width}.png`), clip });
      }
      results.push({ version,cid,face,viewport,substitutions,errors:[...errors],...info });
      if (n < faces.length - 1) await page.keyboard.press('Enter');
     }
     await context.close();
     console.log(`${cid} ${version} ${viewport.width}: ${faces.length} expressions`);
    }
   }
  }
  fs.writeFileSync(path.join(out,otherCharacters?'other-browser-check.json':'browser-check.json'), JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify({ checks:results.length, allExpressionsAfter:results.filter(r=>r.version==='after').length, errors:results.flatMap(r=>r.errors) }));
 } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });
