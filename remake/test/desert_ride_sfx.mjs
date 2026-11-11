// サンドボードのブーストの効果音（2026-11-11 オーナー「ビリビリなる効果音とか欲しい、ブースト溜まると」「ブースト時も効果音欲しい、早そうな」）。
// 自作の合成音（asset_sources/music/desert-ride-boost-sfx/build.py）の形式・台帳と、溜まり具合・ブーストに応じたループの音量。
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

// 1) 放電: 空では鳴らない。溜まり始めはまばらなパチパチだけ、半分を超えると濃いビリビリが混ざり、満タンで最大（ずっと大きくなる）
assert.equal(L({ charge: 0 }).zapSparse.gain, 0); assert.equal(L({ charge: 0 }).zapDense.gain, 0);
const low = L({ charge: .3 }), full = L({ charge: 1 });
assert(low.zapSparse.gain > 0 && low.zapDense.gain === 0, "a little charge: sparse crackle only");
assert(L({ charge: .75 }).zapDense.gain > 0, "past half: the dense buzz joins");
assert(full.zapDense.gain > full.zapSparse.gain, "full: the dense buzz leads");
let before = 0;
for (let c = .15; c <= 1.0001; c += .05) {
  const level = L({ charge: c }), total = level.zapSparse.gain + level.zapDense.gain;
  assert(total >= before - 1e-9, `the discharge only grows as the gauge fills (${c.toFixed(2)})`);
  assert(level.zapSparse.rate >= low.zapSparse.rate - 1e-9 || c < .3, "and gets a little sharper");
  before = total;
}
assert(full.zapDense.gain <= .3 && full.zapSparse.gain <= .3, "stays under the music and the slide");
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
for (const name of ["boost_rush", "boost_loop", "zap_sparse", "zap_dense"]) assert(requests.includes(`../assets/audio/se/desert_ride/${name}.wav`), `${name}.wav is loaded`);
assert(requests.includes("../assets/audio/se/desert_ride/slide_sand.bgm"), "packed sounds still load as .bgm");
assert(!requests.some(url => url.includes("boost_whoosh")), "the old short whoosh is no longer used");
se.motion({ charge: 1 });
assert(se.loopLevels().zapDense > 0, "the ride reports what it means to play");
se.stop();
assert.equal(se.loopLevels().zapDense, 0, "stopping clears the loops");

// 4) ファイル: モノラル 44.1kHz 16bit、長さ、ピーク（-16〜-8 dBFS）、ループのつなぎ目、台帳（SHA-256）
const ledger = JSON.parse(await fs.readFile(new URL("asset_sources/music/desert-ride-boost-sfx/game_files.json", ROOT), "utf8"));
const spec = { zap_sparse: { loop: true, seconds: 2 }, zap_dense: { loop: true, seconds: 2 }, boost_rush: { loop: false, seconds: 1.4 }, boost_loop: { loop: true, seconds: 2 } };
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
