// ブラウザを開かず、本番のローダを実データで検証する。
// node --experimental-vm-modules remake/test/data_loading.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dataFile = fileURLToPath(new URL("../js/core/data.js", import.meta.url));
const documentRoot = fileURLToPath(new URL("../", import.meta.url));
const source = fs.readFileSync(dataFile, "utf8");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loader(fetch, timers = {}) {
  const context = vm.createContext({
    console, AbortController, setTimeout, clearTimeout, ...timers, fetch,
  });
  const mod = new vm.SourceTextModule(source, { context, identifier: dataFile });
  await mod.link(() => { throw new Error("The data loader should have no imports"); });
  await mod.evaluate();
  return mod.namespace;
}

function realJSON(url) {
  return JSON.parse(fs.readFileSync(path.resolve(documentRoot, url), "utf8"));
}
const fixtureFetch = async (url) => ({ ok: true, status: 200, json: async () => realJSON(url) });

// 30ファイルを読み、本文の受信中も同時接続が4本を超えない。
const requests = [];
let active = 0, maximum = 0;
const all = await loader(async (url, options) => {
  requests.push(url);
  assert.equal(options.cache, "no-cache");
  assert(options.signal instanceof AbortSignal);
  maximum = Math.max(maximum, ++active);
  await pause(2);
  return { ok: true, status: 200, json: async () => {
    try { await pause(2); return realJSON(url); }
    finally { active--; }
  } };
});
const progress = [];
await all.loadAll((p) => progress.push(p));
assert.equal(requests.length, 30);
assert.equal(new Set(requests).size, 30);
assert.equal(maximum, 4);
assert.equal(active, 0);
assert.equal(progress.length, 30);
assert.equal(progress.at(-1), 1);
assert(progress.every((p, i) => p > (progress[i - 1] || 0)));
assert.equal(all.DB.characters.tsumugi.id, "tsumugi");
assert.equal(all.DB.relationshipMemories.tsumugi_creature.char_id, "tsumugi");
assert(all.DB.dialogues.ch1_tsumugi_third);
assert(all.DB.dialogues.remake_midcheck);
assert(all.DB.manifest.backgrounds.includes("bg_tonari_inside_day.png"));
assert(all.DB.flavors.every((f) => (f.leaf || "blond") === "blond"));

// HTTP・通信・JSONの各失敗にはファイル名が付き、以後の組は読まず、DBも公開しない。
const badPath = "../data/relationship_memories.json";
for (const [response, expected] of [
  [async () => ({ ok: false, status: 404 }), /relationship_memories\.json: HTTP 404/],
  [async () => { throw new TypeError("connection reset"); }, /relationship_memories\.json: connection reset/],
  [async () => ({ ok: true, status: 200, json: async () => JSON.parse("{broken") }), /relationship_memories\.json:/],
]) {
  const started = [];
  const failed = await loader(async (url) => {
    started.push(url);
    return url === badPath ? response() : fixtureFetch(url);
  });
  await assert.rejects(failed.loadAll(), expected);
  await pause(1); // 同じ組の残りのリクエストを片付ける
  assert.equal(started.length, 4);
  assert.equal(Object.keys(failed.DB.characters).length, 0);
  assert.equal(Object.keys(failed.DB.dialogues).length, 0);
}

// 応答前の停止と、HTTP 200後の本文受信の停止をともに15秒で中断する。
// 時計だけを早め、AbortSignalによる中断と本番のエラー処理はそのまま通す。
for (const phase of ["headers", "body"]) {
  const scheduled = [], pending = new Set(), started = [];
  let aborted = false;
  const timers = {
    setTimeout(fn, ms) {
      scheduled.push(ms);
      const handle = setTimeout(() => { pending.delete(handle); fn(); }, 15);
      pending.add(handle);
      return handle;
    },
    clearTimeout(handle) { pending.delete(handle); clearTimeout(handle); },
  };
  const stalled = await loader(async (url, { signal }) => {
    started.push(url);
    if (url !== badPath) return fixtureFetch(url);
    const waitForAbort = () => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Request aborted", "AbortError"));
      }, { once: true });
    });
    return phase === "headers" ? waitForAbort() : { ok: true, status: 200, json: waitForAbort };
  }, timers);
  await assert.rejects(stalled.loadAll(), /relationship_memories\.json: .*15秒.*タイムアウト/);
  assert(aborted, `${phase} was not aborted`);
  assert(scheduled.every((ms) => ms === 15000));
  assert.equal(pending.size, 0);
  assert.equal(started.length, 4);
}

console.log("[remake data] 30 JSON files, max 4 requests, progress, HTTP/network/JSON errors, headers/body timeout: PASS");
