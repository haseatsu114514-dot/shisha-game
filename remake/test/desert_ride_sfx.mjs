// サンドボードのブーストの効果音（2026-11-11 オーナー「ビリビリなる効果音とか欲しい、ブースト溜まると」「ブースト時も効果音欲しい、早そうな」）。
// 自作の合成音（asset_sources/music/desert-ride-boost-sfx/build.py）の形式・台帳と、溜まり具合で詰まる「ビリッ」の間隔、ブースト中のループの音量。
// node --experimental-vm-modules remake/test/desert_ride_sfx.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const code = await fs.readFile(new URL("remake/js/core/audio.js", ROOT), "utf8");

async function boot() {
  const config = { seVolume: .6, bgmVolume: .5 };
  const requests = [];
  class Param { value = 0; setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v) { this.value = v; }
    exponentialRampToValueAtTime(v) { this.value = v; } setTargetAtTime(v) { this.value = v; } cancelScheduledValues() {} }
  class Node {
    gain = new Param(); frequency = new Param(); Q = new Param(); playbackRate = new Param();
    connect(node) { return node; } disconnect() {} start() {} stop() { this.onended?.(); }
  }
  class AudioContext {
    state = "running"; currentTime = 0; sampleRate = 8000; destination = {};
    createGain() { return new Node(); } createBiquadFilter() { return new Node(); }
    createOscillator() { return new Node(); } createBufferSource() { return new Node(); }
    createBuffer(_c, n) { return { getChannelData: () => new Float32Array(n) }; }
    async decodeAudioData() { return { duration: 1 }; }
    addEventListener() {}
  }
  const context = vm.createContext({ document: { hidden: false, addEventListener() {} }, window: { AudioContext }, console, Math, Promise, Date, AbortController,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    fetch: async url => {
      requests.push(url);
      const b = await fs.readFile(new URL(url, new URL("remake/", ROOT)));
      return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
    } });
  const module = new vm.SourceTextModule(code, { context });
  await module.link(specifier => {
    const exports = specifier.endsWith("state.js") ? { config } : { bgmUrl: () => null };
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
  });
  await module.evaluate();
  return { audio: module.namespace, requests };
}

const { audio, requests } = await boot();
const L = state => audio.desertLoopLevels(state);

// 1) 放電の「ビリッ」: 1割に満たない間は鳴らない。溜まるほど間隔が詰まる（1割で約1.6秒、満タンで約0.35秒）
// 同日「ビリビリはなんかバグみたいに聞こえる。わかりやすい雷みたいなビリビリがいい」で、ループをやめ1発ずつにした
assert.equal(audio.desertZapGap(0), Infinity); assert.equal(audio.desertZapGap(.05), Infinity);
let previous = Infinity;
for (let c = .1; c <= 1.0001; c += .05) {
  const gap = audio.desertZapGap(c, .5);
  assert(gap < previous, `the zaps come closer together as the gauge fills (${c.toFixed(2)}: ${gap.toFixed(2)}s)`);
  previous = gap;
}
assert(audio.desertZapGap(.1, .5) > 1.4 && audio.desertZapGap(1, .5) < .4, "about 1.6s apart at first, about 0.35s when full");
assert(audio.desertZapGap(1, 0) > .2 && audio.desertZapGap(1, 1) < .5, "a little jitter so it is not a metronome");
assert(!("zapSparse" in L({})) && !("zapDense" in L({})), "no more flickering discharge loops");
// 2) ブースト中の風切り: ブースト中だけ、終わり際（boost が 1→0）に小さくなって消える
assert.equal(L({ boost: 0 }).boostLoop.gain, 0);
assert(L({ boost: .5 }).boostLoop.gain > 0 && L({ boost: .5 }).boostLoop.gain < L({ boost: 1 }).boostLoop.gain);
// 滑走・風・カーブの音は今までと同じ決まり
const old = { slide: .34 * .8, wind: .14 * ((.8 - .35) / .65), carve: .18 * .5 };
const now = L({ speed: .8, carve: .5, grounded: true });
assert(Math.abs(now.slide.gain - old.slide) < 1e-9 && Math.abs(now.wind.gain - old.wind) < 1e-9 && Math.abs(now.carve.gain - old.carve) < 1e-9);

// 3) 読み込み: 新しい4つは .wav をそのまま、ほかは今までどおり .bgm。発進は短いシュッ（boost_whoosh）から boost_rush へ
audio.unlockAudio(); // 最初の操作で音を解禁する（本編と同じ）
const se = audio.createDesertRideSe();
await se.ready();
for (const name of ["boost_rush", "boost_loop", "zap_1", "zap_2", "zap_3", "thunder_full"]) assert(requests.includes(`../assets/audio/se/desert_ride/${name}.wav`), `${name}.wav is loaded`);
assert(!requests.some(url => /zap_(sparse|dense)/.test(url)), "the flickering loops are gone");
assert(requests.includes("../assets/audio/se/desert_ride/slide_sand.bgm"), "packed sounds still load as .bgm");
assert(!requests.some(url => url.includes("boost_whoosh")), "the old short whoosh is no longer used");
se.motion({ boost: 1 });
assert(se.loopLevels().boostLoop > 0, "the ride reports what it means to play");
se.stop();
assert.equal(se.loopLevels().boostLoop, 0, "stopping clears the loops");
for (let i = 0; i < 6; i++) se.zap(i / 5);
assert.equal(se.loopLevels().zaps, 6, "every zap is counted");

// 3b) 2026-11-13 手応えレビュー: 出来事ごとに違う音。かすめ・半回転・抜いた が同じ音（ui_pluck）だったのをやめ、
// 半回転の区切り（回るほど高い）と、抜いた／抜かれた（上がる／下がる2音）は専用の合成の合図にした。再生の速さも渡せる（短い再スタートの合図・かすめの近さ）
{
  const probe = await boot();
  probe.audio.unlockAudio();
  const ride = probe.audio.createDesertRideSe();
  await ride.ready();
  assert.equal(typeof ride.cue, "function");
  ride.play("countdown", .5, 2); ride.play("near", .4, 1.3); ride.play("near", .4);
  for (let n = 1; n <= 4; n++) ride.cue("spin", { n, gain: .3 });
  ride.cue("overtake", { gain: .6 }); ride.cue("overtaken", { gain: .6 }); ride.cue("nope");
  assert.equal(ride.loopLevels().cues.join(), "spin,spin,spin,spin,overtake,overtaken", "unknown cues are ignored, known ones are counted");
  ride.dispose();
  ride.cue("spin");
  assert.equal(ride.loopLevels().cues.length, 6, "nothing plays after dispose");
}
// 合図の高さ: 半回転は回るほど高く、抜いた は上がり、抜かれた は下がる（audio.js の式を、音の出口で確かめる）
{
  const freqs = [], rates = [];
  class Param { value = 0; constructor(log) { this.log = log; } setValueAtTime(v) { this.value = v; this.log?.push(v); } linearRampToValueAtTime(v) { this.value = v; }
    exponentialRampToValueAtTime(v) { this.value = v; } setTargetAtTime(v) { this.value = v; } cancelScheduledValues() {} }
  class Node {
    gain = new Param(); frequency = new Param(freqs); Q = new Param(); playbackRate = new Param();
    connect(node) { return node; } disconnect() {} start() { if (this.buffer) rates.push(this.playbackRate.value); } stop() { this.onended?.(); }
  }
  class AudioContext {
    state = "running"; currentTime = 0; sampleRate = 8000; destination = {};
    createGain() { return new Node(); } createBiquadFilter() { return new Node(); }
    createOscillator() { return new Node(); } createBufferSource() { return new Node(); }
    createBuffer(_c, n) { return { getChannelData: () => new Float32Array(n) }; }
    async decodeAudioData() { return { duration: 1 }; }
    addEventListener() {}
  }
  const context = vm.createContext({ document: { hidden: false, addEventListener() {} }, window: { AudioContext }, console, Math, Promise, Date, AbortController,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    fetch: async url => { const b = await fs.readFile(new URL(url, new URL("remake/", ROOT))); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; } });
  const module = new vm.SourceTextModule(code, { context });
  await module.link(specifier => {
    const exports = specifier.endsWith("state.js") ? { config: { seVolume: .6, bgmVolume: .5 } } : { bgmUrl: () => null };
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
  });
  await module.evaluate();
  module.namespace.unlockAudio();
  const ride = module.namespace.createDesertRideSe();
  await ride.ready();
  // （この検査の環境では .bgm の復号ができないので、.wav の音で確かめる）
  ride.play("boost", .5, 2); ride.play("thunder", .4, 1.3); ride.play("boost", .4);
  assert.equal(rates.slice(-3).join(), "2,1.3,1", "play passes the playback rate through (default 1)");
  freqs.length = 0;
  for (let n = 1; n <= 4; n++) ride.cue("spin", { n });
  assert.equal(freqs.length, 4);
  for (let i = 1; i < freqs.length; i++) assert(freqs[i] > freqs[i - 1] * 1.05, `each half turn clicks higher (${freqs.join(", ")})`);
  freqs.length = 0; ride.cue("overtake");
  assert(freqs.length === 2 && freqs[1] > freqs[0], `passing the rival rises (${freqs.join(" → ")})`);
  freqs.length = 0; ride.cue("overtaken");
  assert(freqs.length === 2 && freqs[1] < freqs[0], `being passed falls (${freqs.join(" → ")})`);
}

// 4) ファイル: モノラル 44.1kHz 16bit、長さ、ピーク（-16〜-8 dBFS）、ループのつなぎ目、台帳（SHA-256）
const ledger = JSON.parse(await fs.readFile(new URL("asset_sources/music/desert-ride-boost-sfx/game_files.json", ROOT), "utf8"));
const spec = { zap_1: { loop: false, seconds: .2 }, zap_2: { loop: false, seconds: .26 }, zap_3: { loop: false, seconds: .32 },
  thunder_full: { loop: false, seconds: 1.5 }, boost_rush: { loop: false, seconds: 1.4 }, boost_loop: { loop: true, seconds: 2 } };
assert.deepEqual(ledger.map(entry => entry.file).sort(), Object.keys(spec).map(name => `assets/audio/se/desert_ride/${name}.wav`).sort());
for (const [name, { loop, seconds }] of Object.entries(spec)) {
  const file = `assets/audio/se/desert_ride/${name}.wav`;
  const b = await fs.readFile(new URL(file, ROOT));
  assert.equal(b.toString("ascii", 0, 4), "RIFF", file); assert.equal(b.toString("ascii", 8, 12), "WAVE", file);
  assert.equal(b.readUInt16LE(22), 1, `${file} mono`); assert.equal(b.readUInt32LE(24), 44100, file); assert.equal(b.readUInt16LE(34), 16, file);
  const samples = new Int16Array(b.buffer.slice(b.byteOffset + 44, b.byteOffset + b.length));
  assert(Math.abs(samples.length / 44100 - seconds) < .01, `${file} length`);
  const peak = Math.max(...Array.from(samples, Math.abs)) / 32768, db = 20 * Math.log10(peak);
  assert(db >= -16 && db <= -8, `${file} peak ${db.toFixed(1)} dBFS`);
  if (loop) {
    const steps = Array.from(samples.subarray(1), (v, i) => Math.abs(v - samples[i])).sort((x, y) => x - y);
    const seam = Math.abs(samples[0] - samples[samples.length - 1]);
    assert(seam <= steps[Math.floor(steps.length * .995)], `${file}: the loop seam is as smooth as any other step (${seam})`);
  }
  const entry = ledger.find(item => item.file === file);
  assert.equal(createHash("sha256").update(b).digest("hex"), entry.sha256, `${file} matches the ledger`);
  assert.match(entry.source, /自作/);
}
console.log("desert_ride_sfx: PASS");
