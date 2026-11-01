// #711: focused adopted-art rendering on the real game entry, PC and touch.
// Uses existing Playwright/preview infrastructure; installs or fetches nothing.
// Screenshots still require visual review of color, identity, labels and texture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
const OUT = path.resolve(process.env.ARTIFACT_DIR || '.codex/artifacts/adam-eden-711');
const FACES = ['normal', 'intense', 'serious', 'smile', 'surprise'];
const CASES = ['expressions', 'intro', 'map-and-entry', 'eden-visit', 'tournament-cg', 'preserved-title'];
// These two adopted files were already correct at main 8a5bb15. #711 must
// preserve them. A future intentional adoption must update this baseline.
const PRESERVED = {
  '/assets/ui/store_logos/eden.png': '68b3102129af4c1f8c3bc218c9a03ffa7216483285c62bbd227f62aa062ca2a6',
  '/remake/img/ui/chapters/ch1-title.webp': '39dd98c35a3394985f847adecf2884108acd2ae559507aa0879914e7ce341c44',
};
fs.mkdirSync(OUT, { recursive: true });
const report = { test: 'adam-eden-711', ref: process.env.TEST_REF || null, prHeadSHA: process.env.PR_HEAD_SHA || null, baseURL: BASE,
  rule: 'Adam anatomical left green/right red; front screen left red/right green. Adopted EDEN interior apple pairs screen left green/right red.',
  visualReviewRequired: true, chapterPlaythrough: false, cases: [] };
function saveReport() {
  report.screenshotBytes = fs.readdirSync(OUT).filter(x => x.endsWith('.jpg'))
    .reduce((total, filename) => total + fs.statSync(path.join(OUT, filename)).size, 0);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2) + '\n');
}
saveReport();
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });

async function setup(page) {
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'), data = await import('./js/core/data.js');
    const ui = await import('./js/core/ui.js'), vn = await import('./js/vn/engine.js');
    core.newGame();
    Object.assign(core.state, { phase: 'daily', day: 4, slot: 0, money: 30000, weatherSeed: 2 });
    Object.assign(core.config, { bgmVolume: 0, seVolume: 0, voiceBlip: false, textSpeed: 4 });
    for (const id of ['adam', 'hajime', 'naru', 'minto', 'rin', 'sumi', 'tsumugi', 'pakki']) {
      core.state.met[id] = true; core.state.flags['_intro_' + id] = true;
    }
    vn.vnTest.turbo = false;
    ui.clearScreen();
    window.A711 = { core, data, ui, vn };
  });
}

async function shot(page, stem) {
  // Opaque game screenshots stay small; original alpha is measured separately.
  const filename = `${stem}.jpg`;
  await page.screenshot({ path: path.join(OUT, filename), type: 'jpeg', quality: 80 });
  return filename;
}

async function advance(page, touch) {
  if (touch) await page.locator('.vn-box').tap();
  else await page.keyboard.press('Enter');
}

async function images(page, selector) {
  await page.locator(selector).first().waitFor();
  return page.locator(selector).evaluateAll(async elements => {
    await Promise.all(elements.map(image => image.decode()));
    return elements.map(image => ({ src: new URL(image.currentSrc || image.src).pathname,
      width: image.naturalWidth, height: image.naturalHeight,
      box: image.getBoundingClientRect().toJSON() }));
  });
}

async function background(page, selector) {
  return page.locator(selector).evaluate(async node => {
    // setBg keeps the previous layer during a crossfade; the last shown layer is current.
    const active = [...node.querySelectorAll('.bg-img.show')];
    if (node.id === 'bg' && !active.length) throw new Error('No active background layer in #bg');
    const host = active.at(-1) || node, style = getComputedStyle(host);
    const svg = host.querySelector(':scope > svg.scene-art');
    const decode = async (href, baseURI, role) => {
      if (!href) throw new Error(`Missing ${role} background image href`);
      const image = new Image(); image.src = new URL(href, baseURI).href;
      try { await image.decode(); }
      catch (error) { throw new Error(`Cannot decode ${role} background image ${image.src}: ${error.message}`); }
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty background image: ' + image.src);
      return { role, src: new URL(image.src).pathname, width: image.naturalWidth, height: image.naturalHeight };
    };
    let layers;
    if (svg) {
      // renderSceneArt puts the base image first; props can be inside nested crop SVGs.
      const pictures = [...svg.querySelectorAll('image')];
      if (!pictures.length) throw new Error('Scene-art SVG has no background image');
      layers = await Promise.all(pictures.map((picture, index) => decode(
        picture.href?.baseVal || picture.getAttribute('href') || picture.getAttributeNS('http://www.w3.org/1999/xlink', 'href'),
        picture.baseURI, index === 0 ? 'base' : 'prop')));
    } else {
      const match = /^url\(["']?(.*?)["']?\)$/.exec(style.backgroundImage);
      if (!match) throw new Error('Expected actual background image: ' + host.className);
      layers = [await decode(match[1], host.baseURI, 'base')];
    }
    const base = layers[0];
    return { src: base.src, width: base.width, height: base.height,
      renderer: svg ? 'scene-art-svg' : 'css-background', layers,
      sceneBg: host.dataset.sceneBg || null, activeBackgroundCount: active.length,
      box: host.getBoundingClientRect().toJSON(), backgroundSize: style.backgroundSize, opacity: style.opacity };
  });
}

async function assertPreserved(page, source) {
  const digest = await page.evaluate(async source => {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Missing preserved asset: ${source}`);
    const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
    return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
  }, source);
  assert.equal(digest, PRESERVED[source], `Already-correct adopted art changed: ${source}`);
  return digest;
}

async function portraitMetrics(page) {
  return page.locator('#vn img[data-speaker="adam"]').evaluate(async image => {
    await image.decode();
    const box = image.getBoundingClientRect(), stage = document.querySelector('#stage').getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const width = canvas.width = image.naturalWidth, height = canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data, alpha = new Uint8Array(width * height);
    let x0 = width, y0 = height, x1 = 0, y1 = 0, edges = 0, transparent = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const a = alpha[y * width + x] = pixels[(y * width + x) * 4 + 3];
      if (!a) transparent++;
      if (a < 24) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
      if (!x || !y || x === width - 1 || y === height - 1) edges++;
    }
    const digest = await crypto.subtle.digest('SHA-256', alpha);
    return { src: new URL(image.currentSrc).pathname, width, height, position: image.dataset.pos,
      box: box.toJSON(), stage: stage.toJSON(), alpha24BBox: [x0, y0, x1, y1], edges, transparent,
      alphaSHA256: [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join(''),
      headTop: box.top + y0 * box.height / height };
  });
}

async function textFits(page, selector) {
  const result = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(), s = document.querySelector('#stage').getBoundingClientRect();
    // scrollWidth/scrollHeight can include a decorative ::before rule or the
    // flex line box even when the visible glyphs are fully on stage. Inspect
    // the actual text range, not the element's unclipped scrollable overflow.
    const range = document.createRange();
    range.selectNodeContents(node);
    const glyphs = range.getBoundingClientRect();
    const inside = box => box.left >= s.left - 1 && box.top >= s.top - 1
      && box.right <= s.right + 1 && box.bottom <= s.bottom + 1;
    return { text: node.textContent.trim(), box: r.toJSON(), glyphBox: glyphs.toJSON(),
      contained: inside(r),
      textContained: glyphs.width > 0 && glyphs.height > 0 && inside(glyphs),
      layoutScrollOverflow: node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1 };
  }));
  assert(result.length && result.every(x => x.text && x.contained && x.textContained), JSON.stringify(result));
  return result;
}

async function runScene(page, row, touch) {
  const prefix = row.device + '-' + row.name;
  row.screenshots = [];
  if (row.name === 'expressions') {
    await page.evaluate(faces => {
      A711.task = A711.vn.play({ dialogue_id: '__issue711_expressions',
        metadata: { bg: 'res://assets/backgrounds/bg_eden_shop.png' },
        lines: faces.map(face => ({ speaker: 'adam', face, text: 'ようこそ、エデンの園へ。' })) });
    }, FACES);
    row.expressions = [];
    for (let i = 0; i < FACES.length; i++) {
      const face = FACES[i];
      await page.waitForFunction(face => {
        const image = document.querySelector('#vn img[data-speaker="adam"]');
        return image?.currentSrc.endsWith(`chr_adam_${face}.webp`) && image.complete && image.naturalWidth > 0;
      }, face);
      await page.waitForTimeout(1300);
      const m = await portraitMetrics(page);
      assert.equal(m.width, 896); assert.equal(m.height, 1200); assert.equal(m.position, 'center');
      assert.equal(m.edges, 0); assert(m.transparent > 0 && m.headTop >= m.stage.top - .5, JSON.stringify(m));
      row.expressions.push({ face, ...m });
      row.screenshots.push(await shot(page, `${prefix}-${face}`));
      if (i < FACES.length - 1) await advance(page, touch);
    }
    assert.equal(new Set(row.expressions.map(x => JSON.stringify(x.box))).size, 1, 'Expression frame moved');
  } else if (row.name === 'intro') {
    await page.evaluate(async () => {
      await A711.ui.setBg(A711.data.bgUrl('bg_eden_shop'), { instant: true });
      A711.task = (await import('./js/vn/intro.js')).playIntro('adam');
    });
    await page.locator('.cutin.in[data-char="adam"]').waitFor();
    await page.waitForTimeout(1350);
    row.images = await images(page, '.cutin img');
    assert(row.images.some(x => x.src.endsWith('/img/ui/character_intros/graphic/adam.webp') && x.width === 1024 && x.height === 1024));
    assert(row.images.some(x => x.src.endsWith('/img/ui/character_intros/graphic/bg_adam.webp') && x.width === 1672 && x.height === 941));
    row.text = await textFits(page, '.cutin .ci-title, .cutin .ci-name, .cutin .ci-line');
    row.screenshots.push(await shot(page, prefix));
    await page.evaluate(() => A711.task);
    assert.equal(await page.locator('.cutin').count(), 0);
  } else if (row.name === 'map-and-entry') {
    await page.evaluate(async () => {
      const map = await import('./js/daily/map.js'), hud = await import('./js/daily/hud.js');
      hud.initHud({}); hud.showHud(); A711.arrived = false;
      A711.task = map.chooseSpot().then(async id => {
        if (id !== 'adam') throw new Error('Unexpected map destination ' + id);
        await A711.ui.setBg(A711.data.bgUrl('bg_eden_shop'));
        A711.arrived = true;
      });
    });
    const pin = page.locator('[data-test="pin-adam"]'); await pin.waitFor();
    if (touch) await pin.tap(); else await pin.click();
    await page.waitForTimeout(450);
    row.pinImages = await images(page, '[data-test="pin-adam"] img');
    const face = row.pinImages.find(x => x.src.endsWith('/face_adam.webp'));
    const logo = row.pinImages.find(x => x.src.endsWith('/store_logos/eden.webp'));
    assert(face && logo, 'Actual Adam face or adopted EDEN logo missing');
    assert.deepEqual([face.width, face.height], [160, 160]);
    assert.deepEqual([logo.width, logo.height], [1960, 802]);
    row.preservedLogoSHA256 = await assertPreserved(page, '/assets/ui/store_logos/eden.png');
    assert(await pin.evaluate(x => x.classList.contains('sel')));
    row.pin = await pin.evaluate(pin => {
      const logo = pin.querySelector('.store-logo').getBoundingClientRect(), shield = pin.querySelector('.shield').getBoundingClientRect();
      return { centerError: Math.abs(logo.x + logo.width / 2 - shield.x - shield.width / 2),
        contained: logo.top >= shield.top && logo.bottom <= shield.bottom };
    });
    assert(row.pin.centerError < .1 && row.pin.contained, JSON.stringify(row.pin));
    row.screenshots.push(await shot(page, prefix + '-pin'));
    if (touch) await page.locator('[data-test="map-go"]').tap();
    else await page.locator('[data-test="map-go"]').click();
    const card = page.locator('[data-test="store-arrival"][data-store="adam"]');
    await card.waitFor({ state: 'visible' });
    row.entryImages = await images(page, '[data-test="store-arrival"][data-store="adam"] img');
    assert(row.entryImages.some(x => x.src.endsWith('/store_logos/eden.webp')));
    await page.waitForTimeout(180);
    row.screenshots.push(await shot(page, prefix + '-arrival'));
    await page.waitForFunction(() => A711.arrived);
    row.background = await background(page, '#bg');
    assert(row.background.src.endsWith('/bg_eden_shop.webp'));
    assert.equal(row.background.renderer, 'css-background', 'Adopted EDEN art already includes tabletop hookahs; do not overlay old props');
    assert.equal(row.background.layers.length, 1, 'EDEN must use the adopted background without duplicate equipment');
    row.screenshots.push(await shot(page, prefix + '-background'));
  } else if (row.name === 'eden-visit') {
    await page.evaluate(async () => { A711.task = (await import('./js/daily/spots.js')).visitChar('adam'); });
    await page.locator('.vn-box').waitFor();
    for (let i = 0; i < 20 && !(await page.locator('#vn img[data-speaker="adam"]').count()); i++) {
      await advance(page, touch); await page.waitForTimeout(250);
    }
    row.images = await images(page, '#vn img[data-speaker="adam"]');
    row.background = await background(page, '#bg');
    assert(row.background.src.endsWith('/bg_eden_shop.webp'));
    assert.equal(row.background.renderer, 'css-background', 'EDEN visits must not restore old equipment overlays');
    assert.equal(row.background.layers.length, 1, 'EDEN visit must show only the adopted background');
    await page.waitForTimeout(1300);
    row.screenshots.push(await shot(page, prefix));
  } else if (row.name === 'tournament-cg') {
    await page.evaluate(() => {
      const source = A711.data.DB.dialogues.ch1_tournament_match;
      const i = source.lines.findIndex(x => x.type === 'show_cg' && x.cg_id === 'cg_ch1_tournament_battle');
      if (i < 0) throw new Error('Canonical tournament CG cue missing');
      A711.task = A711.vn.play({ dialogue_id: '__issue711_tournament_cg', lines: source.lines.slice(i, i + 2) });
    });
    await page.waitForFunction(() => {
      const node = document.querySelector('.vn-cg.show[data-cg="cg_ch1_tournament_battle"]');
      return node && Number(getComputedStyle(node).opacity) >= .99 && document.querySelector('.vn-text')?.textContent.length;
    });
    row.cg = await background(page, '.vn-cg.show');
    assert(row.cg.src.endsWith('/cg_ch1_tournament_battle.webp'));
    assert.deepEqual([row.cg.width, row.cg.height], [1920, 1080]);
    row.text = await textFits(page, '.vn-text');
    row.screenshots.push(await shot(page, prefix));
  } else if (row.name === 'preserved-title') {
    row.preservedTitleSHA256 = await assertPreserved(page, '/remake/img/ui/chapters/ch1-title.webp');
    await page.evaluate(async () => { A711.task = (await import('./js/chapters/ch1-title-motion.js')).playCh1Title(); });
    await page.locator('.ch1-title-motion[data-phase="playing"]').waitFor();
    await page.waitForFunction(() => Number(document.querySelector('.ch1-title-motion')?.dataset.elapsed) >= 3150);
    row.title = await page.locator('.ch1-title-motion canvas').evaluate(async canvas => {
      const image = new Image(); image.src = 'img/ui/chapters/ch1-title.webp'; await image.decode();
      const c = document.createElement('canvas'); c.width = 1280; c.height = 720; c.getContext('2d').drawImage(image, 0, 0);
      const r = canvas.getBoundingClientRect();
      return { originalPixels: canvas.toDataURL() === c.toDataURL(), fit: getComputedStyle(canvas).objectFit,
        fits: r.left >= -.5 && r.top >= -.5 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5 };
    });
    assert(row.title.originalPixels && row.title.fits && row.title.fit === 'contain', JSON.stringify(row.title));
    row.screenshots.push(await shot(page, prefix));
    await page.evaluate(() => A711.task);
  }
}

try {
  for (const [device, viewport, touch] of [
    ['pc', { width: 1280, height: 720 }, false],
    ['touch', { width: 844, height: 390 }, true],
  ]) for (const name of CASES) {
    if (process.env.CASE_FILTER && process.env.CASE_FILTER !== `${device}-${name}`) continue;
    const row = { device, viewport, hasTouch: touch, isMobile: touch, name, errors: [], failedResources: [], externalRequestsBlocked: [] };
    report.cases.push(row);
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const origin = new URL(BASE).origin;
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) row.failedResources.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => {
      if (new URL(request.url()).origin === origin && !/ERR_ABORTED/.test(request.failure()?.errorText || ''))
        row.failedResources.push(`${request.failure()?.errorText} ${request.url()}`);
    });
    await context.route('**/*', route => {
      const url = route.request().url();
      if (/^https?:/.test(url) && new URL(url).origin !== origin) {
        row.externalRequestsBlocked.push(url); return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      localStorage.setItem('suien_remake_config', JSON.stringify({ bgmVolume: 0, seVolume: 0, voiceBlip: false, textSpeed: 4 }));
    });
    try {
      await page.goto(BASE, { waitUntil: 'load' });
      await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
      await page.locator('#boot').waitFor({ state: 'detached' });
      await setup(page); await runScene(page, row, touch);
      assert.deepEqual(row.errors, [], 'Unexpected page errors');
      assert.deepEqual(row.failedResources, [], 'Missing or failed game resources');
      row.status = 'passed'; console.log(`PASS adam-eden-711 ${device}/${name}`);
    } catch (error) {
      row.status = 'failed'; row.failure = error.stack || String(error);
      row.failureScreenshot = await shot(page, `${device}-${name}-failed`).catch(() => null);
      console.error(`FAIL adam-eden-711 ${device}/${name}: ${error.message}`);
    } finally { await context.close(); saveReport(); }
  }
} finally {
  await browser.close();
  saveReport();
  console.log(`adam-eden-711 screenshot payload: ${report.screenshotBytes} bytes; target dedicated ZIP <= 3 MB`);
}
assert(report.cases.length && report.cases.every(x => x.status === 'passed'), 'Some #711 browser checks failed; review results.json');
