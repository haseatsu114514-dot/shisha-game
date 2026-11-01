// Record production PLACE -> HEAT with one real pointer click. No automatic scoring.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const { chromium } = createRequire(path.join(root, 'remake/test/browser/package.json'))('playwright');
const out = path.resolve(process.env.CAPTURE_DIR || '/tmp/place-demo-capture');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8129/remake/');
  await page.locator('[data-test="title-new"]').waitFor(); await page.locator('#boot').waitFor({ state: 'detached' });
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'); core.newGame();
    core.config.bgmVolume = core.config.seVolume = 0;
    // A normal post-coal-lesson save fixture. Tutorial mode intentionally skips PLACE.
    core.state.flags._coal_cube_learned = true;
    const session = await import('./js/craft/session.js'), steps = await import('./js/craft/steps.js');
    const cs = session.newSession('rehearsal'); cs.preview = true;
    cs.mix = { double_apple: 10, mint: 2 }; cs.pack = 'normal';
    const bench = session.openBench(cs); await bench.ready;
    window.placeRecording = { cs, bench, before: JSON.stringify(core.state) };
    window.placeChain = (async () => { await steps.stepPlace(cs); await (await import('./js/craft/heat.js')).runHeat(cs); })();
  });
  const target = page.locator('[data-test="opt-triangle"]'); await target.waitFor();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled([...document.images].map(i => i.decode())); });
  const box = await target.boundingBox(), cdp = await page.context().newCDPSession(page);
  const frames = [], writes = []; let serial = 0;
  cdp.on('Page.screencastFrame', event => {
    const name = `${String(serial++).padStart(5, '0')}.jpg`;
    frames.push({ file: name, timestamp: event.metadata.timestamp });
    writes.push(writeFile(path.join(out, name), Buffer.from(event.data, 'base64')));
    cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
  });
  const start = Date.now() / 1000;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  await page.waitForTimeout(9000);
  const clickedAt = Date.now() / 1000 - start; await target.click();
  await page.locator('.bench-panel[data-step="heat"]').waitFor();
  const heatAt = Date.now() / 1000 - start;
  await page.waitForTimeout(Math.max(0, 16000 - (Date.now() / 1000 - start) * 1000));
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast'); await Promise.all(writes);
  if (errors.length) throw Error(errors.join('\n'));
  if (frames.length < 2) throw Error('No production frames');
  const zero = frames[0].timestamp;
  const concat = frames.map((frame, i) => `file '${frame.file}'\nduration ${Math.max(.001, (frames[i + 1]?.timestamp ?? end) - frame.timestamp).toFixed(6)}\n`).join('') + `file '${frames.at(-1).file}'\n`;
  await writeFile(path.join(out, 'frames.ffconcat'), concat);
  const metadata = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), viewport: { width: 1280, height: 720 }, mode: 'rehearsal', fixture: { coalLessonComplete: true, preview: true, mix: { double_apple: 10, mint: 2 }, pack: 'normal' }, realInput: { selector: '[data-test="opt-triangle"]', box, clickedAt: clickedAt - (zero - start) }, heatVisibleAt: heatAt - (zero - start), duration: end - zero, frames: frames.length, errors, noScoringAutomation: true };
  await writeFile(path.join(out, 'capture.json'), JSON.stringify(metadata, null, 2) + '\n');
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(out, 'frames.ffconcat'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', path.join(out, 'raw.mp4')], { stdio: 'ignore' });
  console.log(JSON.stringify(metadata));
} finally { await browser.close(); }
