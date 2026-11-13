// 会話の立ち絵・CGの「待たない先読み」（core/data.js の preload(urls, 0)）の列を、ブラウザを開かずに確かめる。
// 2026-11-13 オーナー指摘「キャラの立ち絵が出る前に準備してますとか出てくる」（docs/owner_requests.md LD02）。
// - 1枚ずつ読む（十数枚を一度に頼んで、次に使う1枚と回線を分け合わない）
// - 頼まれた順に読む。新しく頼まれた組（新しい会話・jump 先）を、前の組の読み残しより先にする
// - 同じ絵を二度読まない。読み残しは上限を超えたら古い方から捨てる
// - 待つ先読み（timeoutMs あり）は従来どおり、全部を並べて読み、読めたら（または時間切れで）解決する
// node --experimental-vm-modules remake/test/vn_preload_queue.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dataFile = fileURLToPath(new URL("../js/core/data.js", import.meta.url));

/** 読み込みを手で終わらせられる Image。src を入れた順に started へ積む。 */
function imageStub() {
  const started = [];
  const active = new Set();
  class FakeImage {
    set src(url) { this.url = url; started.push(url); active.add(this); }
    get src() { return this.url; }
  }
  const finish = (url, ok = true) => {
    const image = [...active].find((i) => i.url === url);
    assert(image, `${url} is not loading`);
    active.delete(image);
    (ok ? image.onload : image.onerror)?.();
  };
  return { FakeImage, started, active, finish };
}

async function loadData(Image) {
  const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout, Image, fetch: async () => { throw new Error("no fetch"); } });
  const modules = new Map();
  const load = (filename) => {
    if (!modules.has(filename)) modules.set(filename, new vm.SourceTextModule(fs.readFileSync(filename, "utf8"), { context, identifier: filename }));
    return modules.get(filename);
  };
  const mod = load(dataFile);
  await mod.link((specifier, parent) => load(path.resolve(path.dirname(parent.identifier), specifier)));
  await mod.evaluate();
  return mod.namespace;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

{
  const { FakeImage, started, active, finish } = imageStub();
  const { preload } = await loadData(FakeImage);

  // 1つ目の会話: 頼んだ順に1枚ずつ。呼び出しはすぐ解決する（会話を待たせない）。
  let resolved = false;
  preload(["a1", "a2", null, "a3", "a4", "a2"], 0).then(() => { resolved = true; });
  await tick();
  assert.equal(resolved, true, "background preload never holds the caller");
  assert.deepEqual(started, ["a1"], "one image at a time, in the order asked");
  finish("a1");
  assert.deepEqual(started, ["a1", "a2"], "the next one starts when the slot frees");

  // 2つ目の会話（または jump 先）: 前の会話の読み残し（a3・a4）より先に読む。組の中の順番は保つ。
  // 読んでいる最中の a2 は頼み直さない。
  preload(["b1", "a2", "b2", "a4"], 0);
  for (const url of ["a2", "b1", "b2", "a4"]) finish(url, url !== "a4"); // 読めなかった絵（a4）も列は止めない
  finish("a3");
  assert.deepEqual(started, ["a1", "a2", "b1", "b2", "a4", "a3"], "a newer request goes ahead of older leftovers");

  // 一度読んだ絵（失敗も含む）は頼み直さない。
  preload(["a1", "b1", "a4"], 0);
  await tick();
  assert.equal(started.length, 6, "loaded images are not requested again");
  assert.equal(active.size, 0);
}

{
  // 読み残しは32枚まで。超えた分は古い組の後ろから捨てる。
  const { FakeImage, started, finish } = imageStub();
  const { preload } = await loadData(FakeImage);
  const old = Array.from({ length: 40 }, (_, i) => `old${i}`);
  preload(old, 0);
  const fresh = Array.from({ length: 10 }, (_, i) => `new${i}`);
  preload(fresh, 0);
  // いま読んでいる old0 が終わると、新しい組から順に読む。
  for (let i = 0; i < 60 && started.length > i; i++) finish(started[i]);
  assert.equal(started[0], "old0");
  assert.deepEqual(started.slice(1, 11), fresh, "the newest group is read first");
  assert.equal(started.length, 1 + 32, "at most 32 images wait in the queue");
  assert.equal(started.at(-1), "old22", "the oldest leftovers beyond the limit are dropped");
}

{
  // 待つ先読み（遷移の前など）は従来どおり: 全部を並べて読み、終わったら解決する。
  const { FakeImage, started, finish } = imageStub();
  const { preload } = await loadData(FakeImage);
  let done = false;
  preload(["w1", "w2", "w3"], 1000).then(() => { done = true; });
  assert.deepEqual(started, ["w1", "w2", "w3"], "a waited preload still starts every image at once");
  await tick();
  assert.equal(done, false);
  finish("w1"); finish("w2"); finish("w3");
  await tick();
  assert.equal(done, true);
}

console.log("PASS: background preload reads one at a time in the order asked, newest group first, without repeats or an unbounded backlog; waited preloads are unchanged");
