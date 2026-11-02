// #590: adopted C from first display, all canonical expressions, fixed across caption/face changes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
const out = path.resolve(process.env.ARTIFACT_DIR || '.codex/artifacts/continue-closeup');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], failed = [], records = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => {
  if (new URL(r.url()).origin === new URL(base).origin && r.status() >= 400) {
    failed.push({ url: r.url(), status: r.status() });
  }
});
await page.route('**/assets/audio/bgm/bgm_continue_urgent.mp3', r => r.abort());

try {
  await page.goto(new URL('continue-preview.html', base).href);
  await page.waitForFunction(() => !document.querySelector('#preview-play').disabled);
  // Measure settled composition; continue_typing/neon cover live entry, cues, reactions and motion reduction.
  await page.addStyleTag({ content: `
    #preview-tools,#preview-error{display:none!important}#viewport{inset:0!important}
    .gameover,.gameover *,.gameover *::before,.gameover *::after{animation:none!important;transition:none!important}
  ` });
  const faces = await page.evaluate(async () => {
    const { DB, portraitInfo } = await import('./js/core/data.js');
    const { config } = await import('./js/core/state.js');
    const { createContinueView } = await import('./js/chapters/continue-view.js');
    const { SUMI_CONTINUE_SCRIPTS } = await import('./js/chapters/gameover.js');
    const { PREMIUM_CONTINUE_SCRIPTS } = await import('./js/chapters/continue-premium.js');
    config.bgmVolume = config.seVolume = 0;
    window.closeupQA = {
      mount(speaker, face) {
        const view = createContinueView({
          script: speaker === 'sumi' ? SUMI_CONTINUE_SCRIPTS[0] : PREMIUM_CONTINUE_SCRIPTS[speaker],
          speaker, character: speaker, premium: speaker !== 'sumi',
        });
        document.querySelector('#screen').replaceChildren(view.root);
        this.view = view;
        view.face(face, false);
        view.setCaption('お前いま諦めようとしたな！？');
        view.reveal();
        view.setCount(12, .4);
        return view;
      },
      async measure(speaker, face) {
        const view = this.mount(speaker, face);
        await Promise.all([...view.root.querySelectorAll('img')].map(i => i.decode()));
        await document.fonts.ready;
        const info = portraitInfo(speaker, face), f = DB.manifest.continuePortraits[info.folder][info.face];
        const stage = document.querySelector('#stage').getBoundingClientRect(), scale = stage.width / 1280;
        const box = element => {
          const r = element.getBoundingClientRect();
          return { x: (r.x - stage.x) / scale, y: (r.y - stage.y) / scale, w: r.width / scale, h: r.height / scale };
        };
        const image = box(view.root.querySelector('.go-sumi-img'));
        return {
          speaker, face, viewport: { width: innerWidth, height: innerHeight }, image,
          faceBox: { cx: image.x + image.w * f.cx, cy: image.y + image.h * (f.top + f.size / 2), size: image.h * f.size },
          left: box(view.root.querySelector('.go-left')), title: box(view.root.querySelector('.go-title')),
          hud: box(view.root.querySelector('.go-clock')), caption: box(view.dialogue), buttons: [box(view.retry), box(view.quit)],
          loaded: [...view.root.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0),
        };
      },
      async switchFace(speaker, face) {
        const view = this.view;
        view.face(face, false);
        const image = view.root.querySelector('.go-sumi-img');
        await image.decode();
        const f = DB.manifest.continuePortraits[speaker][face], before = image.style.cssText;
        view.setCaption('台詞送りで構図を変えない');
        view.reveal(.2);
        view.reveal();
        return {
          size: parseFloat(image.style.height) * f.size,
          cy: parseFloat(image.style.top) + parseFloat(image.style.height) * (f.top + f.size / 2),
          unchanged: before === image.style.cssText,
        };
      },
    };
    return Object.entries(DB.manifest.continuePortraits).flatMap(([speaker, expressions]) =>
      Object.keys(expressions).map(face => ({ speaker, face })));
  });
  const saveBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  assert.equal(new Set(faces.map(f => f.speaker)).size, 8);
  assert.equal(faces.length, 57);
  for (const viewport of [
    { width: 1280, height: 720 }, { width: 1920, height: 1080 },
    { width: 844, height: 390 }, { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    for (const { speaker, face } of faces) {
      const m = await page.evaluate(({ speaker, face }) => closeupQA.measure(speaker, face), { speaker, face });
      assert.ok(m.loaded);
      assert.ok(Math.abs(m.faceBox.size - 524.8) < .15, JSON.stringify(m));
      assert.ok(Math.abs(m.faceBox.cx - 640) < .15, JSON.stringify(m));
      assert.ok(Math.abs(m.faceBox.cy - 273) < .15, JSON.stringify(m));
      assert.ok(Math.abs(m.left.y) < .15 && Math.abs(m.left.h - 720) < .15, JSON.stringify(m));
      // C's bbox bottom is 535.4, within one stage pixel of the subtitle's top border (535).
      assert.ok(m.faceBox.cy + m.faceBox.size / 2 <= m.caption.y + 1, 'face bbox reaches subtitle');
      assert.ok(m.faceBox.cx + m.faceBox.size / 2 <= m.hud.x, 'face bbox reaches HUD');
      records.push(m);
      if (viewport.width === 1280) await page.screenshot({ path: path.join(out, `${speaker}-${face}.png`) });
    }
  }
  for (const speaker of [...new Set(faces.map(f => f.speaker))]) {
    const expressions = faces.filter(f => f.speaker === speaker).map(f => f.face);
    await page.evaluate(({ speaker, face }) => { closeupQA.mount(speaker, face); }, { speaker, face: expressions[0] });
    for (const face of [...expressions, ...expressions.toReversed()]) {
      const m = await page.evaluate(({ speaker, face }) => closeupQA.switchFace(speaker, face), { speaker, face });
      assert.ok(m.unchanged, 'captions must not reframe the portrait');
      assert.ok(Math.abs(m.size - 524.8) < .001);
      assert.ok(Math.abs(m.cy - 273) < .02, JSON.stringify({ speaker, face, ...m }));
    }
  }
  assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), saveBefore);
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify({
    faces: 57, speakers: 8, viewportCases: records.length, switches: 114, errors, failed, saveUnchanged: true, records,
  }, null, 2));
  console.log('PASS: C 524.8px centered at (640,273); 57 expressions × 4 sizes, 114 switches, caption stability, errors/missing=0, save unchanged');
} finally { await browser.close(); }
