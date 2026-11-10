// Exercise the real audio module, including its procedural board loop, without a device/network.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

async function fixture(suspended = false) {
  const config = { bgmVolume: .6, seVolume: .5 }, gains = [], notes = [], timers = [];
  const document = { hidden: false, addEventListener() {} };
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; },
    linearRampToValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; },
    cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } });
  let ctx;
  class AudioContext {
    constructor() { ctx = this; this.state = suspended ? "suspended" : "running"; }
    currentTime = 0; destination = {};
    createGain() { const g = { gain: param(), connect() { return this; }, disconnect() {} }; gains.push(g); return g; }
    createOscillator() { const n = { frequency: param(), connect() { return this; }, start() { notes.push(this); }, stop() {} }; return n; }
    resume() { this.state = "running"; return Promise.resolve(); }
  }
  const context = vm.createContext({ window: { AudioContext }, document, console, Math, Promise,
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {} });
  const mod = new vm.SourceTextModule(await fs.readFile(new URL("../js/core/audio.js", import.meta.url), "utf8"), { context });
  await mod.link(spec => {
    const values = spec.endsWith("state.js") ? { config } : { bgmUrl: () => null };
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await mod.evaluate();
  return { audio: mod.namespace, config, document, gains, notes, timers, ctx: () => ctx };
}

const { audio, config, document, gains, notes, timers, ctx } = await fixture();
audio.playBgm("tonari"); audio.duckBgm(.5);
const release = audio.createGrowthBoardAudio();
assert.equal(audio.currentBgm(), "bgm_growth_board");
assert.equal(audio.bgmDuckLevel(), 1);
assert(notes.length >= 4, "Dedicated board loop schedules its own chord without fetching media");
assert(notes.every(n => n.type === "sine"), "Quiet pad, no drums or sharp oscillators");
config.bgmVolume = .2; audio.applyVolumes(); assert.equal(gains[2].gain.value, .2);
config.mute = true; audio.applyVolumes(); assert.equal(gains[2].gain.value, 0);
audio.unlockAudio();
let before = notes.length; audio.SE.boardLight(); audio.SE.boardCommit();
assert.equal(notes.length, before, "Muted actions are not scheduled for later playback");
config.mute = false; config.seVolume = 0; audio.applyVolumes(); audio.SE.boardLight();
assert.equal(notes.length, before);
config.seVolume = .5; audio.applyVolumes(); document.hidden = true; audio.SE.boardCommit();
assert.equal(notes.length, before);
document.hidden = false; audio.SE.boardLight(); assert.equal(notes.length, before + 2);
audio.SE.boardCommit(); assert.equal(notes.length, before + 6);
release(); assert.equal(audio.currentBgm(), "tonari"); assert.equal(audio.bgmDuckLevel(), .5);
audio.playBgm("new-scene"); release(); assert.equal(audio.currentBgm(), "new-scene", "Cleanup is idempotent");
const superseded = audio.createGrowthBoardAudio(); audio.playBgm("another-scene"); superseded();
assert.equal(audio.currentBgm(), "another-scene", "A newer scene owns its music");
const interrupted = audio.createGrowthBoardAudio(); interrupted(false);
assert.equal(audio.currentBgm(), null, "LOAD discards the old scene, including its board music");
before = notes.length; ctx().currentTime += 5;
timers.splice(0).forEach(fn => fn());
assert.equal(notes.length, before, "Retired board schedulers cannot schedule more notes");

for (const restore of [true, false]) {
  const f = await fixture(true); f.audio.playBgm("tonari");
  const close = f.audio.createGrowthBoardAudio(); close(restore);
  f.audio.unlockAudio(); await Promise.resolve();
  assert.equal(f.audio.currentBgm(), restore ? "tonari" : null, "Delayed audio unlock uses the surviving request only");
}
const silent = await fixture(); silent.audio.stopBgm(); silent.audio.createGrowthBoardAudio()();
assert.equal(silent.audio.currentBgm(), null, "A silent scene remains silent after closing");
console.log("PASS board audio: dedicated synth, volume/mute/hidden gates, distinct cues, restore, replacement, delayed unlock, stopped schedulers");
