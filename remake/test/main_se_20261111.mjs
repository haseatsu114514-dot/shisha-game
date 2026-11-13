// 本編の効果音 第1弾（2026-11-11）: 録音が読めたら録音で鳴ること、台帳・クレジットがそろっていること。
// node --experimental-vm-modules remake/test/main_se_20261111.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import vm from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const code = await fs.readFile(new URL("remake/js/core/audio.js", ROOT), "utf8");

async function boot({ fail = false } = {}) {
  const config = { seVolume: .6, bgmVolume: .5 };
  const sources = [], bytes = new Map(), clock = { now: 1000 };
  let oscillators = 0;
  class Param {
    value = 0; events = [];
    setValueAtTime(v, t) { this.value = v; this.events.push(["set", v, t]); }
    linearRampToValueAtTime(v, t) { this.value = v; this.events.push(["ramp", v, t]); }
    exponentialRampToValueAtTime(v) { this.value = v; }
    setTargetAtTime(v) { this.value = v; }
    cancelScheduledValues() {}
  }
  class Node {
    gain = new Param(); frequency = new Param(); Q = new Param(); playbackRate = new Param(); stops = [];
    connect(node) { this.destination = node; return node; }
    disconnect() {}
    start(at = 0) { this.startedAt = at; sources.push(this); }
    stop(t) { this.stops.push(t); }
  }
  class AudioContext {
    state = "running"; currentTime = 10; sampleRate = 8000; destination = {};
    createGain() { return new Node(); }
    createBiquadFilter() { return new Node(); }
    createOscillator() { oscillators++; return new Node(); }
    createBufferSource() { return new Node(); }
    createBuffer(_channels, n) { return { getChannelData: () => new Float32Array(n) }; }
    async decodeAudioData(buffer) { return { file: bytes.get(buffer), duration: 4.2 }; }
    addEventListener() {}
  }
  const context = vm.createContext({ document: { hidden: false, addEventListener() {} }, window: { AudioContext }, console, Math, Promise,
    Date: { now: () => clock.now }, AbortController, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    fetch: async url => {
      if (fail) return { ok: false, status: 404 };
      const b = await fs.readFile(new URL(url, new URL("remake/", ROOT)));
      const data = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); bytes.set(data, url.split("/").at(-1));
      return { ok: true, arrayBuffer: async () => data };
    },
  });
  const module = new vm.SourceTextModule(code, { context });
  await module.link(specifier => {
    const exports = specifier.endsWith("state.js") ? { config } : { bgmUrl: () => null };
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return { audio: module.namespace, sources, clock, oscillators: () => oscillators };
}

const ledger = JSON.parse(await fs.readFile(new URL("asset_sources/music/main-se-20261111/sources.json", ROOT), "utf8"));
const gameFiles = JSON.parse(await fs.readFile(new URL("asset_sources/music/main-se-20261111/game_files.json", ROOT), "utf8"));
const staffRoll = await fs.readFile(new URL("remake/js/scenes/staff-roll.js", ROOT), "utf8");

// 台帳: ゲーム用ファイルが置いてあり、中身が再生成の記録と同じ。原音はすべて CC0 で、作者がスタッフロールに載っている。
assert.equal(Object.keys(gameFiles).length, ledger.game.length);
for (const entry of ledger.game) {
  const data = await fs.readFile(new URL(`assets/audio/se/${entry.file}`, ROOT));
  const record = gameFiles[`se/${entry.file}`];
  assert(record, `${entry.file} is in game_files.json`);
  assert.equal(createHash("sha256").update(data).digest("hex"), record.sha256, `${entry.file} matches the ledger`);
  assert(ledger.originals.some(original => original.key === entry.from), `${entry.file} names its source`);
}
for (const original of ledger.originals) {
  assert.equal(original.license, "CC0", original.key);
  assert.match(original.page, /^https:\/\/opengameart\.org\/content\//, original.key);
  assert.match(original.sha256, /^[0-9a-f]{64}$/, original.key);
  if (original.author !== "Kenney") assert(staffRoll.includes(original.author), `${original.author} is credited in the staff roll`);
}

// 対応表: 台帳のファイルと、鳴らす側の一覧が同じ。
const game = await boot();
const table = game.audio.recordedSeFiles();
// 第1弾（2026-11-11）と第2弾（2026-11-13: door・get・birds）。page は TRPG のページめくりと同じ録音を使う（台帳は trpg-audio）。
const ledgerIds = ["crowd", "money", "parin", "shutter", "mew", "crackle", "affinity", "save", "door", "get", "birds"];
assert.deepEqual(ledgerIds.flatMap(id => table[id]).sort(), ledger.game.map(entry => entry.file).sort());
assert.deepEqual([...table.page], ["trpg/page_flip_01.wav", "trpg/page_flip_02.wav"]); // 別の実行環境の配列なので写して比べる
for (const file of table.page) assert((await fs.stat(new URL(`assets/audio/se/${file}`, ROOT))).size > 100, file);
const ids = [...ledgerIds, "page"];
for (const id of ids) assert.equal(typeof game.audio.SYNTH_SE[id], "function", `${id} keeps its synthetic fallback`);

// 録音が読めたら録音で鳴る（合成音は使わない）。
game.audio.unlockAudio();
assert.equal(await game.audio.preloadSe(), true, "every recording is present and loads");
for (const id of ids) {
  const before = game.sources.length;
  game.clock.now += 1000;
  game.audio.SE[id]();
  assert.equal(game.sources.length, before + 1, `${id} plays one recording`);
  assert(table[id].map(file => file.split("/").at(-1)).includes(game.sources.at(-1).buffer.file), `${id} plays its own file`);
}
assert.equal(game.oscillators(), 0, "no synthetic tone once the recordings are loaded");

// コイン: 0.25秒のうちに続けて呼ばれた分は鳴らさない（所持金の増減と店の売り買いが同時に呼んでも1回）。間があけば別の切り出しで鳴る。
game.clock.now += 1000;
const beforeCoins = game.sources.length;
game.audio.SE.money(); game.audio.SE.money(); game.clock.now += 200; game.audio.SE.money();
assert.equal(game.sources.length, beforeCoins + 1, "coins called together play once");
const first = game.sources.at(-1).buffer.file;
game.clock.now += 300; game.audio.SE.money();
assert.equal(game.sources.length, beforeCoins + 2);
assert.notEqual(game.sources.at(-1).buffer.file, first, "coin variants alternate");

// 歓声は呼び出しの秒数に合わせ、そのあと0.7秒で消える。秒数の無い呼び出しと、録音より長い指定は最後まで鳴る。
game.audio.SE.crowd(1.6);
const fitted = game.sources.at(-1);
const [hold, fade] = fitted.destination.gain.events.slice(-2);
assert.deepEqual([hold[0], hold[1], fade[0], fade[1]], ["set", 1, "ramp", 0]);
assert(Math.abs(hold[2] - 11.6) < 1e-9 && Math.abs(fade[2] - 12.3) < 1e-9, "holds for 1.6s, then fades over 0.7s");
assert.equal(fitted.stops.length, 1); assert(Math.abs(fitted.stops[0] - 12.32) < 1e-9);
game.audio.SE.crowd();
assert.equal(game.sources.at(-1).stops.length, 0, "no length: play the whole recording");
game.audio.SE.crowd(9);
assert.equal(game.sources.at(-1).stops.length, 0, "longer than the recording: play the whole recording");

// 段階アップのベル: 同じ録音を、高さを変えて少し遅らせてもう1回。
const beforeUp = game.sources.length;
game.audio.SE.affinityUp();
const [bell, second] = game.sources.slice(beforeUp);
assert.equal(game.sources.length, beforeUp + 2);
assert.equal(bell.buffer.file, "heart_bell.wav"); assert.equal(second.buffer.file, "heart_bell.wav");
assert.equal(bell.playbackRate.value, 1); assert.equal(second.playbackRate.value, 1.5);
assert(Math.abs(second.startedAt - 10.13) < 1e-9, "the second bell starts 0.13s later");

// 録音が取れない時は、これまでの合成音（新しいIDは短い合成音）で鳴る。
const offline = await boot({ fail: true });
offline.audio.unlockAudio();
assert.equal(await offline.audio.preloadSe(), false);
for (const id of [...ids, "affinityUp"]) {
  offline.clock.now += 1000;
  const before = offline.oscillators() + offline.sources.length;
  offline.audio.SE[id]();
  assert(offline.oscillators() + offline.sources.length > before, `${id} falls back to a synthetic sound`);
  assert(offline.sources.every(source => !source.buffer?.file), `${id} does not play a missing file`);
}

// 呼び出し側: セーブはコインの音を使わない。所持金の増減でコインが鳴り、店・くじは二重に鳴らさない。
const read = path => fs.readFile(new URL(path, ROOT), "utf8");
assert(!(await read("remake/js/scenes/saves.js")).includes("SE.money"), "saving does not jingle coins");
assert.match(await read("remake/js/scenes/saves.js"), /SE\.save\(\)/);
assert.match(await read("remake/js/daily/hud.js"), /on\("money"[\s\S]{0,400}SE\.money\(\)/, "the money change plays the coin");
assert.match(await read("remake/js/core/ui.js"), /o\.chime === "up" \? SE\.affinityUp : SE\.affinity/);

// 第2弾の呼び出し側。
// 店のロゴが出る時に扉（早送り中は鳴らさない）。晴れた朝だけ小鳥。
assert.match(await read("remake/js/core/store-arrival.js"), /if \(!fast\) SE\.door\?\.\(\);/);
assert.match(await read("remake/js/core/transitions.js"), /if \(weather === "sun"\) SE\.birds\?\.\(\);/);
// 第2〜4章の結果発表: 最終結果は拍手、1位はファンファーレも。途中の持ち点は判の一打。
for (const path of ["remake/js/chapters/ch2-tournament.js", "remake/js/chapters/ch3-tournament.js"]) {
  assert.match(await read(path), /if \(final\) \{ SE\.crowd\?\.\(2\.4\); if \(progress\(\)\.result\?\.rank === 1\) SE\.fanfare\?\.\(\); \}\n  else SE\.stamp\?\.\(\);/, path);
}
assert.match(await read("remake/js/chapters/ch4.js"), /if \(!result\.failure\) \{ SE\.crowd\?\.\(2\.4\); if \(result\.rank === 1\) SE\.fanfare\?\.\(\); \}/);
// 通知に添える音: レシピ帳・メモはページ、黄金比はきらきら、手に入れたものは入手の音、判子は判の音。
const toastSe = async (path, text, se) => assert((await read(path)).split("\n").some(line => line.includes(text) && line.includes(`se: "${se}"`)), `${path}: ${text} → ${se}`);
await toastSe("remake/js/craft/steps.js", "レシピ帳に書き加えた", "page");
await toastSe("remake/js/craft/steps.js", "黄金比！", "twinkle");
await toastSe("remake/js/daily/home-shisha.js", "レシピ帳に書き加えた", "page");
await toastSe("remake/js/daily/home-shisha.js", "黄金比！", "twinkle");
await toastSe("remake/js/daily/spots.js", "試したい配合をメモした", "page");
await toastSe("remake/js/vn/engine.js", "メモした", "page");
await toastSe("remake/js/daily/shop.js", "限定フレーバー", "get");
await toastSe("remake/js/chapters/ch5-catering.js", "くじ券を", "get");
await toastSe("remake/js/chapters/ch5-shop-stamps.js", "店めぐり帳に判子をもらった", "stamp");
// 通知の音は、実在する効果音の名前だけ（書き間違いは無音になるので、ここで止める）。
for (const path of ["remake/js/craft/steps.js", "remake/js/daily/home-shisha.js", "remake/js/daily/spots.js", "remake/js/vn/engine.js", "remake/js/daily/shop.js",
  "remake/js/chapters/ch5-catering.js", "remake/js/chapters/ch5-shop-stamps.js", "remake/js/chapters/ch5-tokyo.js", "remake/js/chapters/ch5-shops.js", "remake/js/chapters/ch5-dubai.js"]) {
  for (const [, name] of (await read(path)).matchAll(/\bse: "([A-Za-z]+)"/g)) assert.equal(typeof game.audio.SE[name], "function", `${path}: SE.${name}`);
}

console.log("PASS: main SE 2026-11-11 / 11-13 (ledger, credits, recorded playback, variants, fitted applause, bell pair, synthetic fallback, call sites, round 2 wiring)");
