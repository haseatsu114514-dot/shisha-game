// ブラウザを開かず、本番のローダを実データで検証する。
// node --experimental-vm-modules remake/test/data_loading.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { flavorMakerProblems } from "../js/craft/temperature-model.js";

const dataFile = fileURLToPath(new URL("../js/core/data.js", import.meta.url));
const documentRoot = fileURLToPath(new URL("../", import.meta.url));
const source = fs.readFileSync(dataFile, "utf8");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loader(fetch, timers = {}) {
  const context = vm.createContext({
    console, AbortController, setTimeout, clearTimeout, ...timers, fetch,
  });
  const mod = new vm.SourceTextModule(source, { context, identifier: dataFile });
  const modules = new Map([[dataFile, mod]]);
  await mod.link((specifier, parent) => {
    assert(specifier.startsWith("./"), "loader dependencies must stay in core");
    const filename = path.resolve(path.dirname(parent.identifier), specifier);
    assert.equal(path.dirname(filename), path.dirname(dataFile));
    if (!modules.has(filename)) modules.set(filename, new vm.SourceTextModule(fs.readFileSync(filename, "utf8"), { context, identifier: filename }));
    return modules.get(filename);
  });
  await mod.evaluate();
  return mod.namespace;
}

function realJSON(url) {
  return JSON.parse(fs.readFileSync(path.resolve(documentRoot, url), "utf8"));
}
const fixtureFetch = async (url) => ({ ok: true, status: 200, json: async () => realJSON(url) });

// ギャラリー台帳・大会制作会話・映画館を含む42ファイルを読み、同時接続が4本を超えない。
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
// manifest読込前のPNG経路でも、旧版の顔画像キャッシュを使わない。
assert.equal(all.img("sprites/characters/ageha/chr_ageha_sad.png"), "../assets/sprites/characters/ageha/chr_ageha_sad.png?v=face-restore-20261028");
await all.loadAll((p) => progress.push(p));
for (const id of ["minto", "ageha"]) {
  for (const face of all.DB.manifest.portraits[id].faces) {
    const version = id === "ageha" || face === "normal" ? "?v=face-restore-20261028" : "";
    assert.equal(all.portraitInfo(id, face).src, `img/sprites/characters/${id}/chr_${id}_${face}.webp${version}`);
  }
  assert.equal(all.faceIconUrl(id), `img/ui/face_icons/face_${id}.webp?v=face-restore-20261028`);
  assert(all.allFaceIconUrls().includes(all.faceIconUrl(id)), "preload and display use the same revised icon URL");
}
assert.equal(all.img("backgrounds/bg_tonari_inside_day.png"), "img/backgrounds/bg_tonari_inside_day.webp");
assert.equal(all.faceIconUrl("oneesan"), "img/ui/face_icons/face_minto_private.webp");
assert.equal(all.portraitInfo("oneesan", "normal").face, "ura_normal");
assert.equal(requests.length, 42);
assert.equal(new Set(requests).size, 42);
assert.equal(maximum, 4);
assert.equal(active, 0);
assert.equal(progress.length, 42);
assert(all.DB.dialogues.samechan_cinema_introduction);
assert(all.DB.dialogues.cinema_first_screening);
assert.equal(progress.at(-1), 1);
assert(progress.every((p, i) => p > (progress[i - 1] || 0)));
assert.equal(all.DB.characters.tsumugi.id, "tsumugi");
assert(all.DB.baito.some(event => event.id === "baito_tsumugi_art"), "つむぎの常連接客が起動時に除外された");
for (const id of ["baito_tsumugi_01", "baito_minto_romance", "baito_ageha_romance"]) {
  assert(!all.DB.baito.some(event => event.id === id), `未接続の物語イベントを一括解放しない: ${id}`);
}
assert(Array.isArray(all.DB.gallery.items), "the approved gallery catalog is loaded from real data");
assert.equal(all.DB.characters.hiyori.name, "朝霧ひより");
assert.equal(all.DB.characters.hiyori.age, 25);
assert.equal(all.DB.hiyori.route.enabled, true);
assert(all.DB.dialogues.hiyori_preview_gap.lines[0].inner);
assert(all.DB.lover.dates.hiyori && all.DB.friends.friends.hiyori);
assert(all.portraitInfo("hiyori", "normal"));
assert(all.faceIconUrl("hiyori"));
assert.equal(all.DB.relationshipMemories.tsumugi_creature.char_id, "tsumugi");
assert(all.DB.dialogues.ch1_tsumugi_third);
assert(all.DB.dialogues.remake_midcheck);
assert.equal(Object.values(all.DB.fortuneTrivia.characters).flat().length, 56);
assert(all.DB.dialogues.remake_fortune_trivia_naru_1, "fortune results were not registered after loading");
assert(all.DB.dialogues.remake_fortune_trivia_sumi_13, "added fortune readings were not registered after loading");
assert(!all.DB.dialogues.remake_fortune_trivia_adam_1, "excluded fortune readings must not be registered");
assert.equal(all.DB.dialogues.craft_inner_heat_watch.lines[0].speaker, "hajime");
assert(all.DB.dialogues.craft_inner_heat_watch.lines[0].text);
assert.equal(all.DB.dialogues.tournament_craft_packed_intro.lines[0].speaker, "pakki");
assert(all.DB.dialogues.tournament_craft_care_recovered.lines[0].text);
assert.equal(all.DB.characters.maki.display_name, "斧崎マキ");
assert.equal(all.DB.characters.sai.display_name, "六角サイ");
assert(all.DB.dialogues.venue_maki_greet.lines[0].text);
assert(all.DB.dialogues.ch1_tsumugi_bond_finale && all.DB.dialogues.ch1_rin_bond_question); // 交友の締めくくり（ch1_bonds）
assert(all.DB.friends.friends.naru.chats.length > 0); // 友人のたまのLIME（remake/data/friends.json）
assert(all.DB.manifest.backgrounds.includes("bg_tonari_inside_day.png"));
assert(all.DB.flavors.every((f) => (f.leaf || "blond") === "blond"));
// DB.flavors はローダがブロンドのみに絞るため、メーカー検証は生データ全78種を対象にする。
const rawFlavors = realJSON("../data/flavors.json").flavors;
assert.equal(rawFlavors.length, 78);
const makerProblems = flavorMakerProblems(rawFlavors);
assert.equal(makerProblems.length, 0, `Invalid flavor makers: ${JSON.stringify(makerProblems)}`);
assert.deepEqual(flavorMakerProblems([
  { id: "missing" },
  { id: "unknown", maker: "unknown" },
  { id: "inherited_key", maker: "toString" },
  { id: "valid", maker: "fuwari" },
]), [
  { id: "missing", reason: "missing maker" },
  { id: "unknown", reason: "invalid maker: unknown" },
  { id: "inherited_key", reason: "invalid maker: toString" },
]);

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

console.log("[remake data] 42 JSON files, max 4 requests, gallery catalog, hiyori foundation, venue hosts, cinema, progress, HTTP/network/JSON errors, headers/body timeout: PASS");
