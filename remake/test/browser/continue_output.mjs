// #590: capture the browser's real rendered SE/BGM streams, not a mocked audio API.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const out = process.env.ARTIFACT_DIR || ".codex/artifacts/continue-output";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"],
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];
try {
  for (const music of [false, true]) {
    console.log(`START native output BGM=${music}`);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());
    await page.route("**/assets/audio/se/**", r => r.abort()); // unrelated recorded SE; existing synth BGM fallback
    // Local BGM uses HTMLAudioElement outside the WebAudio recording graph;
    // block it to use the existing synth fallback in the capture.
    await page.route("**/assets/audio/bgm/**", r => r.abort());
    await page.addInitScript(() => {
      const AC = window.AudioContext;
      window.__contexts = []; window.__notes = [];
      window.AudioContext = class extends AC {
        constructor(...args) { super(...args); this.__gains = []; window.__contexts.push(this); }
        createGain() { const g = super.createGain(); this.__gains.push(g); return g; }
        createOscillator() {
          const o = super.createOscillator(), start = o.start.bind(o);
          const set = o.frequency.setValueAtTime.bind(o.frequency);
          let scheduledFrequency;
          o.frequency.setValueAtTime = (value, at) => { scheduledFrequency = value; return set(value, at); };
          o.start = at => {
            window.__notes.push({ freq: scheduledFrequency ?? o.frequency.value, audioAt: at ?? this.currentTime,
              at: performance.now(), count: document.querySelector(".go-count")?.textContent });
            return start(at);
          };
          return o;
        }
      };
    });
    await page.goto(new URL("continue-preview.html", base).href);
    await page.waitForFunction(() => !document.querySelector("#preview-play").disabled);
    await page.locator("#preview-play").click(); // actual gesture, official unlockAudio path
    await page.waitForFunction(() => window.__contexts[0]?.state === "running");
    await page.evaluate(() => document.querySelector(".gameover").cleanupContinue());
    await page.waitForTimeout(300);
    await page.evaluate(async music => {
      const { config } = await import("./js/core/state.js");
      config.seVolume = .5; config.bgmVolume = music ? .4 : 0; config.mute = config.muted = false;
      (await import("./js/core/audio.js")).applyVolumes();
      const c = __contexts[0];
      // ensureCtx creates master, seBus, bgmBus in this order. Keep the original
      // destination connected and add passive recording taps to the real graph.
      window.__captures = [c.__gains[1], c.__gains[0]].map(bus => {
        const dest = c.createMediaStreamDestination(); bus.connect(dest);
        // Keep silent intervals in the recording clock. Chromium may otherwise
        // omit frames when the SE bus has no live sources. This zero source is
        // connected only to the recording tap, never to the game's output.
        const silence = c.createConstantSource(); silence.offset.value = 0;
        silence.connect(dest); silence.start();
        const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" }), chunks = [];
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        return { dest, bus, silence, recorder, chunks };
      });
      const recording = Promise.all(__captures.map(x => new Promise(resolve => {
        x.recorder.onstart = resolve; x.recorder.start();
      })));
      window.__recordAt = c.currentTime; window.__notes = []; window.__calls = [];
      const modal = document.createElement("div"); modal.id = "modal"; modal.textContent = "MENU";
      document.querySelector("#stage").append(modal);
      const { buildGameOver } = await import("./js/chapters/gameover.js");
      window.__go = buildGameOver({ variant: 0, context: { lossOrdinal: 2 }, onTitle: () => __calls.push("title") });
      document.querySelector("#screen").replaceChildren(__go);
      await Promise.race([recording, new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Native MediaRecorder did not start within 5s")), 5000))]);
    }, music);
    console.log(`RECORDING native output BGM=${music}`);
    // Real time/native AudioContext: also prove that a visible pause silences
    // rendered output and resumes the same countdown without a catch-up burst.
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector("#modal").classList.add("show"));
    await page.waitForFunction(() => __go.dataset.paused === "true");
    await page.evaluate(() => { window.__pause = { at: performance.now(), audioAt: __contexts[0].currentTime }; });
    await page.waitForTimeout(1000);
    await page.evaluate(() => document.querySelector("#modal").classList.remove("show"));
    await page.waitForFunction(() => __go.dataset.paused === "false");
    await page.evaluate(() => { __pause.duration = performance.now() - __pause.at; });
    await page.waitForTimeout(20100);
    const rendered = await page.evaluate(async () => {
      const c = __contexts[0];
      const captures = await Promise.all(__captures.map(async x => {
          await Promise.race([
            new Promise(resolve => { x.recorder.onstop = resolve; x.recorder.stop(); }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("MediaRecorder stop timed out")), 5000)),
          ]);
          const bytes = await new Blob(x.chunks, { type: "audio/webm;codecs=opus" }).arrayBuffer();
          const buffer = await c.decodeAudioData(bytes.slice(0)), samples = buffer.getChannelData(0);
          let peak = 0, square = 0;
          for (const s of samples) { peak = Math.max(peak, Math.abs(s)); square += s * s; }
          const pauseStart = Math.floor((__pause.audioAt - __recordAt + .3) * buffer.sampleRate);
          const pauseEnd = Math.floor((__pause.audioAt - __recordAt + .8) * buffer.sampleRate);
          let pauseSquare = 0;
          for (let i = pauseStart; i < pauseEnd; i++) pauseSquare += samples[i] ** 2;
          const tones = __notes.filter(n => [1000, 620, 700, 780, 870, 990, 70].includes(n.freq)).map(note => {
            // Opus/stream startup has a small offset: search a bounded ±150ms
            // around the native source timestamp, never the whole recording.
            const expected = note.audioAt - __recordAt;
            const frequency = note.freq === 70 ? 55 : note.freq; // existing 0 tone sweeps 70 → 45Hz
            let amplitude = 0, at = 0;
            for (let time = Math.max(0, expected - .15); time < expected + .15; time += .005) {
              const start = Math.floor(time * buffer.sampleRate), length = Math.floor(.02 * buffer.sampleRate);
              let re = 0, im = 0;
              for (let i = 0; i < length && start + i < samples.length; i++) {
                const angle = 2 * Math.PI * frequency * i / buffer.sampleRate;
                re += samples[start + i] * Math.cos(angle); im += samples[start + i] * Math.sin(angle);
              }
              const value = 2 * Math.hypot(re, im) / length;
              if (value > amplitude) { amplitude = value; at = time; }
            }
            return { count: note.count, frequency, expected, at, amplitude };
          });
          x.bus.disconnect(x.dest);
          x.silence.stop(); x.silence.disconnect();
          const recording = await new Promise(resolve => {
            const reader = new FileReader(); reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(new Blob([bytes], { type: "audio/webm;codecs=opus" }));
          });
          return { bytes: bytes.byteLength, sampleRate: buffer.sampleRate, duration: buffer.duration,
            peak, rms: Math.sqrt(square / samples.length),
            pausedRms: Math.sqrt(pauseSquare / (pauseEnd - pauseStart)), tones, recording };
      }));
      return { captures, notes: __notes, calls: __calls, pause: __pause, contextState: c.state };
    });
    for (const [i, capture] of rendered.captures.entries()) {
      const file = `bgm-${music}-${i ? "master" : "se"}.webm`;
      fs.writeFileSync(path.join(out, file), Buffer.from(capture.recording.split(",")[1], "base64"));
      delete capture.recording;
      capture.recordingFile = file;
    }
    fs.writeFileSync(path.join(out, `rendered-bgm-${music}.json`), JSON.stringify(rendered, null, 2));
    assert.deepEqual(errors, []);
    assert.deepEqual(rendered.calls, ["title"]);
    const counts = rendered.notes.filter(n => n.freq === 1000 || [620, 700, 780, 870, 990, 70].includes(n.freq));
    assert.deepEqual(counts.map(n => n.count), Array.from({ length: 21 }, (_, i) => String(20 - i)));
    const [se, mix] = rendered.captures;
    assert.equal(se.tones.filter(t => t.frequency === 1000).length, 15);
    assert.deepEqual(se.tones.map(t => t.count), Array.from({ length: 21 }, (_, i) => String(20 - i)));
    assert(se.tones.every(t => t.amplitude > .0005), "all 15 ticks + 5 final counts + 0 must exist in rendered samples");
    assert(se.peak < .98 && mix.peak < .98, "captured output must not clip");
    assert(se.pausedRms < .0001 && mix.pausedRms < .0001, "SE and BGM output must be silent during the visible pause");
    assert(se.duration >= 21 && se.rms > .0001, "actual audio samples were captured");
    if (music) assert(mix.rms > se.rms * 1.1, "BGM-on capture includes the existing synth music");
    counts.forEach((n, i) => assert(Math.abs(n.at - counts[0].at - i * 1000
      - (i >= 3 ? rendered.pause.duration : 0)) < 150, `display/audio boundary ${i}`));
    results.push({ music, mode: "native MediaRecorder/Opus decoded PCM; BGM files unavailable, existing synth fallback",
      listening: "not performed", captures: rendered.captures, calls: rendered.calls,
      contextState: rendered.contextState, pause: rendered.pause, observedOscillators: rendered.notes.length, counts });
    await context.close();
    console.log(`PASS native CONTINUE output: BGM=${music}, tones=${se.tones.length} (15+5+1), SE peak=${se.peak}, mix RMS=${mix.rms}`);
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
}
