// Adapted from remake/tools/record_chapter_preview.mjs for this isolated trailer.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(new URL('../../../remake/tools/record_chapter_preview.mjs', import.meta.url));
const { chromium } = require('playwright');
const url = process.env.PREVIEW_URL || 'http://127.0.0.1:8123/asset_sources/ch1-ova-trailer-534/trailer/?cinema=1';
const captureFolder = path.resolve(process.env.CAPTURE_DIR || '/workspace/ch1-ova-capture/recording');
const output = path.resolve(process.env.OUTPUT_VIDEO || path.join(captureFolder, 'preview.mp4'));
const startSelector = process.env.START_SELECTOR || '[data-test="preview-start"]';
const previewSeconds = Number(process.env.PREVIEW_SECONDS || 40);
const introSeconds = Number(process.env.INTRO_SECONDS || .8);
const waitForEnd = process.env.WAIT_FOR_END !== '0';
const doneSelector = process.env.DONE_SELECTOR || '#end';
const endSeconds = Number(process.env.END_SECONDS || 1.5);
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
    await window.trailerReady;
    await document.fonts.ready;
    return { artworks: window.getTrailerState().images.length,
      durationMs: window.TRAILER_SPEC.duration * 1000,
      cuts: window.TRAILER_SPEC.segments.map(cut => cut.id) };
  });
  await page.waitForFunction(() => window.__previewCapture?.state === 'recording');
  const storageBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  await page.evaluate(() => {
    const capture = window.__previewCapture;
    capture.visuals = [];
    capture.layoutFailures = [];
    capture.observeTimer = setInterval(() => {
      const state = window.getTrailerState();
      if (state.phase !== 'playing' || capture.visuals.some(frame => frame.cut === state.cut)) return;
      const canvas = document.querySelector('#canvas').getBoundingClientRect();
      const contained = canvas.left >= -1 && canvas.top >= -1 && canvas.right <= innerWidth+1 && canvas.bottom <= innerHeight+1;
      const captionsFit = state.captionBoxes.every(b => b.left >= 0 && b.right <= 1280 && b.top >= 0 && b.bottom <= 720);
      const visual = { cut:state.cut, elapsedMs:Math.round(state.time*1000),
        epochMs:performance.timeOrigin+performance.now(), canvasFits:contained,
        captionsFit, caption:document.querySelector('#caption').textContent };
      capture.visuals.push(visual);
      if (!contained || !captionsFit) capture.layoutFailures.push(visual);
    }, 100);
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
    const state = window.getTrailerState();
    return { phase:state.phase, cut:state.cut, elapsedMs:Math.round(state.time*1000),
      ended:!document.querySelector('#end').hidden, audio:state.audio };
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
