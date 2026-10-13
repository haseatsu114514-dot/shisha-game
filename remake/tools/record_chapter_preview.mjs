import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.env.PREVIEW_URL || 'http://127.0.0.1:8123/remake/chapter-preview.html';
const captureFolder = path.resolve(process.env.CAPTURE_DIR || '.codex/artifacts/chapter-preview-recording');
const output = path.resolve(process.env.OUTPUT_VIDEO || path.join(captureFolder, 'preview.mp4'));
const startSelector = process.env.START_SELECTOR || '[data-test="preview-start"]';
const previewSeconds = Number(process.env.PREVIEW_SECONDS || 42);
const introSeconds = Number(process.env.INTRO_SECONDS || 1.8);
const waitForEnd = process.env.WAIT_FOR_END !== '0';
const doneSelector = process.env.DONE_SELECTOR || '[data-test="preview-ended"]';
const endSeconds = Number(process.env.END_SECONDS || 3);
fs.mkdirSync(captureFolder, { recursive: true });
fs.mkdirSync(path.dirname(output), { recursive: true });

const browser = await chromium.launch({
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  await context.addInitScript(() => {
    // Instrumentation lives only in this isolated recording browser. Every
    // existing AudioContext keeps its normal destination and playback graph.
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    const nativeConnect = AudioNode.prototype.connect;
    const nativeDisconnect = AudioNode.prototype.disconnect;
    const recorderContext = new NativeAudioContext({ sampleRate: 48000 });
    const mix = recorderContext.createMediaStreamDestination();
    // Keep a zero-valued source running so MediaRecorder emits silence before
    // the game creates its first graph instead of shifting the entire track.
    const silence = recorderContext.createConstantSource();
    silence.offset.value = 0;
    nativeConnect.call(silence, mix);
    silence.start();
    const taps = new Map();
    const chunks = [];
    const capture = window.__previewCapture = {
      state: 'starting', startedEpochMs: 0, tapCount: 0, error: null,
    };
    const recorder = new MediaRecorder(mix.stream, {
      mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000,
    });
    recorder.addEventListener('dataavailable', event => {
      if (event.data.size) chunks.push(event.data);
    });
    const getTap = context => {
      let tap = taps.get(context);
      if (!tap) {
        const destination = context.createMediaStreamDestination();
        const source = recorderContext.createMediaStreamSource(destination.stream);
        nativeConnect.call(source, mix);
        tap = { destination, source };
        taps.set(context, tap);
        capture.tapCount = taps.size;
      }
      return tap;
    };
    AudioNode.prototype.connect = function (...args) {
      const result = nativeConnect.apply(this, args);
      if (this.context !== recorderContext && args[0] === this.context.destination) {
        nativeConnect.call(this, getTap(this.context).destination, args[1] ?? 0);
      }
      return result;
    };
    AudioNode.prototype.disconnect = function (...args) {
      const result = nativeDisconnect.apply(this, args);
      if (this.context !== recorderContext && args[0] === this.context.destination) {
        const tap = taps.get(this.context);
        if (tap) {
          try { nativeDisconnect.call(this, tap.destination, ...args.slice(1)); }
          catch { /* The node may already have removed the mirrored connection. */ }
        }
      }
      return result;
    };
    capture.stop = () => new Promise((resolve, reject) => {
      if (recorder.state !== 'recording') return reject(new Error('Recorder never started'));
      recorder.addEventListener('stop', async () => {
        try {
          const data = await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer();
          const bytes = new Uint8Array(data);
          let binary = '';
          for (let offset = 0; offset < bytes.length; offset += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
          }
          resolve({ base64: btoa(binary), startedEpochMs: capture.startedEpochMs,
            tapCount: capture.tapCount, sampleRate: recorderContext.sampleRate });
        } catch (error) { reject(error); }
      }, { once: true });
      recorder.stop();
    });
    recorderContext.resume().then(() => {
      capture.startedEpochMs = performance.timeOrigin + performance.now();
      recorder.start(1000);
      capture.state = 'recording';
    }).catch(error => { capture.error = String(error); capture.state = 'failed'; });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator(startSelector).waitFor({ state: 'visible' });
  const preload = await page.evaluate(async () => {
    try {
      const response = await fetch('../data/chapter_previews/ch2.json');
      if (!response.ok) throw new Error(`Preview data ${response.status}`);
      const base = await response.json();
      const sample = new URLSearchParams(location.search).get('sample');
      const { createChapterSample } = await import('./js/chapters/chapter-preview-samples.js');
      const data = createChapterSample(base, sample);
      const arts = [...new Set(data.frames.map(cut => cut.art).filter(Boolean))];
      await Promise.all(arts.map(art => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = async () => { try { await image.decode(); resolve(); } catch (error) { reject(error); } };
        image.onerror = () => reject(new Error(`Missing art ${art}`));
        image.src = `../assets/cgs/ch2_preview/${art}.webp`;
      })));
      return { artworks: arts.length, durationMs: data.duration, cuts: data.frames.map(cut => cut.id) };
    } catch (error) { return { error: String(error) }; }
  });
  await page.evaluate(async () => {
    await document.fonts.load('400 30px \"Chapter Preview Dot\"', '水煙前線次回予告みんと');
    await document.fonts.ready;
    await Promise.all([...document.images].filter(img => !img.complete)
      .map(img => new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })));
  });
  await page.waitForFunction(() => window.__previewCapture?.state === 'recording');
  const storageBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  await page.evaluate(() => {
    const capture = window.__previewCapture;
    capture.visuals = [];
    capture.layoutFailures = [];
    capture.observeTimer = setInterval(() => {
      const root = document.querySelector('[data-test="chapter-preview"]');
      const cut = root?.dataset.cut;
      if (!cut || capture.visuals.some(frame => frame.cut === cut)) return;
      const art = root.querySelector('.preview-art');
      if (art && (!art.complete || !art.naturalWidth)) return;
      const screen = root.querySelector('.preview-screen').getBoundingClientRect();
      const a = art?.getBoundingClientRect();
      const caption = root.querySelector('.preview-caption');
      const contained = r => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      const controlsFit = [...root.querySelectorAll('.preview-control')].every(button => contained(button.getBoundingClientRect()) && button.scrollWidth <= button.clientWidth + 1);
      const captionFits = !caption || (contained(caption.getBoundingClientRect()) && caption.scrollWidth <= caption.clientWidth + 1 && caption.scrollHeight <= caption.clientHeight + 1);
      const artFits = !a || (a.left >= screen.left - 1 && a.top >= screen.top - 1 && a.right <= screen.right + 1 && a.bottom <= screen.bottom + 1);
      const visual = { cut, elapsedMs: Number(root.dataset.elapsed), epochMs: performance.timeOrigin + performance.now(), controlsFit, captionFits, artFits,
        image: art ? { width: art.naturalWidth, height: art.naturalHeight, file: art.src.split('/').at(-1) } : null,
        caption: caption?.textContent || '' };
      capture.visuals.push(visual);
      if (!controlsFit || !captionFits || !artFits) capture.layoutFailures.push(visual);
    }, 200);
  });
  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', event => {
    const file = path.join(captureFolder, `frame-${String(frames.length).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(event.data, 'base64'));
    frames.push({ file, timestamp: event.metadata.timestamp });
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg', quality: 94, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1,
  });
  const frameDeadline = Date.now() + 10000;
  while (!frames.length && Date.now() < frameDeadline) await page.waitForTimeout(20);
  if (!frames.length) throw new Error('CDP did not produce a video frame');
  await page.waitForTimeout(introSeconds * 1000);
  const clickEpochMs = await page.evaluate(() => performance.timeOrigin + performance.now());
  await page.locator(startSelector).click();
  console.log(JSON.stringify({ status: 'recording', clickEpochMs, duration: previewSeconds, url }));
  if (waitForEnd) {
    await page.locator(doneSelector).waitFor({ state: 'visible', timeout: 65000 });
    await page.waitForTimeout(endSeconds * 1000);
  } else {
    await page.waitForTimeout(previewSeconds * 1000);
  }
  const captureEndEpochMs = await page.evaluate(() => performance.timeOrigin + performance.now());
  const finalPageState = await page.evaluate(() => {
    const preview = document.querySelector('[data-test="chapter-preview"]');
    return {
      phase: preview?.dataset.phase || 'ended', cut: preview?.dataset.cut || null,
      elapsedMs: Number(preview?.dataset.elapsed || 0),
      ended: !!document.querySelector('[data-test="preview-ended"]'),
    };
  });
  const visualQA = await page.evaluate(() => {
    clearInterval(window.__previewCapture.observeTimer);
    return { visuals: window.__previewCapture.visuals, layoutFailures: window.__previewCapture.layoutFailures,
      storageAfter: JSON.stringify({ ...localStorage }) };
  });
  await cdp.send('Page.stopScreencast');
  const audio = await page.evaluate(() => window.__previewCapture.stop());
  const finalScreenshot = path.join(captureFolder, 'final.png');
  await page.screenshot({ path: finalScreenshot });
  const audioFile = path.join(captureFolder, 'audio.webm');
  fs.writeFileSync(audioFile, Buffer.from(audio.base64, 'base64'));
  if (!audio.tapCount) throw new Error('No game AudioContext was connected to the recording mix');

  // CDP records actual render timestamps. Preserve their durations, including
  // static frames, before converting to a portable 30 fps H.264/AAC file.
  const concatFile = path.join(captureFolder, 'frames.ffconcat');
  const lines = ['ffconcat version 1.0'];
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
  for (let i = 0; i < frames.length; i++) {
    const nextTimestamp = frames[i + 1]?.timestamp || captureEndEpochMs / 1000;
    lines.push(`file ${quote(frames[i].file)}`);
    // image2 otherwise rounds every JPEG to a 1/25s clock; many short frames
    // accumulate drift and can cut the last subtitle off the exported video.
    lines.push('option framerate 1000');
    lines.push(`duration ${Math.max(0.001, nextTimestamp - frames[i].timestamp).toFixed(6)}`);
  }
  lines.push(`file ${quote(frames.at(-1).file)}`);
  lines.push('option framerate 1000');
  fs.writeFileSync(concatFile, lines.join('\n') + '\n');
  const videoEpochMs = frames[0].timestamp * 1000;
  const duration = (captureEndEpochMs - videoEpochMs) / 1000;
  const audioTrim = (videoEpochMs - audio.startedEpochMs) / 1000;
  const audioFilter = audioTrim >= 0
    ? `atrim=start=${audioTrim.toFixed(6)},asetpts=PTS-STARTPTS,apad`
    : `adelay=${Math.round(-audioTrim * 1000)}:all=1,apad`;
  const encode = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'warning', '-y',
    '-f', 'concat', '-safe', '0', '-i', concatFile,
    '-i', audioFile,
    '-filter_complex', `[0:v]fps=30,scale=in_range=pc:out_range=tv,format=yuv420p[v];[1:a]${audioFilter}[a]`,
    '-map', '[v]', '-map', '[a]', '-t', duration.toFixed(6),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output,
  ], { encoding: 'utf8' });
  if (encode.status !== 0) throw new Error(`ffmpeg failed: ${encode.stderr}`);
  const details = {
    output, url, frameCount: frames.length, duration, audioTrim,
    audioContexts: audio.tapCount, sampleRate: audio.sampleRate,
    imageTimebase: '1/1000',
    clickInVideoSeconds: (clickEpochMs - videoEpochMs) / 1000,
    errors, preload, finalPageState, finalScreenshot,
    visuals: visualQA.visuals, layoutFailures: visualQA.layoutFailures,
    storageUnchanged: storageBefore === visualQA.storageAfter,
  };
  fs.writeFileSync(path.join(captureFolder, 'capture.json'), JSON.stringify(details, null, 2));
  console.log(JSON.stringify({ status: 'done', ...details }));
  const cutOrder = visualQA.visuals.map(frame => frame.cut);
  if (errors.length || visualQA.layoutFailures.length || storageBefore !== visualQA.storageAfter
      || (waitForEnd && (JSON.stringify(cutOrder) !== JSON.stringify(preload.cuts) || !finalPageState.ended))) process.exitCode = 1;
} finally {
  await browser.close();
}
