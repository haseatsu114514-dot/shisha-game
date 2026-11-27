// PEPPERMINTで頼むみんとのチェキ（PFC14・#3941）。
// 普通のチェキは持っていないものから無作為（被りなし）。正体と本名を知った後は、頼むとたまに私服の一枚をこっそりくれる。
// 台本・絵・記念品のつながりと、選び方・来店への接続を確かめる。VN と画面は差し替え（ブラウザの受け入れ試験ではない）。
// node --experimental-vm-modules remake/test/minto_cheki_collection.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as chekiData from "../js/core/minto-cheki-data.js";

const { MINTO_CHEKIS, MINTO_SECRET_CHEKIS, ALL_MINTO_CHEKIS, MINTO_CHEKI_PRICE } = chekiData;
const root = new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const scenes = Object.fromEntries(JSON.parse(read("data/dialogue/ch1_minto.json")).dialogues.map(d => [d.dialogue_id, d]));
const manifest = JSON.parse(read("remake/data/manifest.json"));
const textOf = scene => [...scene.lines, ...Object.values(scene.branches || {}).flat()].map(line => line.text || "").join("\n");

// ---------------------------------------------------------------- A. 台本・絵・記念品
assert.equal(MINTO_CHEKIS.length, 13);
assert.equal(MINTO_SECRET_CHEKIS.length, 3);
assert.equal(new Set(ALL_MINTO_CHEKIS.map(c => c.id)).size, ALL_MINTO_CHEKIS.length);
const ask = scenes.minto_cheki_ask;
const choice = ask.lines.find(line => line.type === "choice");
// 頼む方は別の台本（minto_cheki_take）へ飛ぶ（next_id）。読んだ台本の記録で頼んだかを見分ける。
assert.deepEqual(choice.choices.map(c => [c.next_id || c.next, c.condition_type, c.threshold]),
  [["minto_cheki_take", "money", MINTO_CHEKI_PRICE], ["cheki_skip", undefined, undefined]]);
assert.equal(choice.choices[0].next, undefined);
assert(ask.branches.cheki_skip?.length);
assert(scenes.minto_cheki_take?.lines?.length, "頼んだ印の台本");
for (const c of ALL_MINTO_CHEKIS) {
  const scene = scenes[c.scene];
  assert(scene, c.scene);
  assert(manifest.cgs.includes(`${c.cg}.png`), c.cg);
  for (const file of [`assets/cgs/${c.cg}.png`, `remake/img/cgs/${c.cg}.webp`, `remake/img/cgs/thumbs/${c.cg}.webp`]) {
    assert(fs.existsSync(new URL(file, root)), file);
  }
  const shows = scene.lines.filter(line => line.type === "show_cg");
  assert.deepEqual(shows.map(line => line.cg_id), [c.cg], c.scene);
  // 普通のチェキはその場で撮る（シャッターの演出）。私服の一枚は前に撮ったものを渡すので演出なし。
  assert.equal(shows[0].effect, c.secret ? undefined : "cheki", c.scene);
  const buys = scene.lines.filter(line => line.type === "buy_keepsake");
  assert.deepEqual(buys.map(line => line.item_id), [c.id], c.scene);
  assert(scene.lines.some(line => line.type === "hide_cg"), c.scene);
  assert.equal(c.cost, c.secret ? 0 : MINTO_CHEKI_PRICE, c.id);
  // サインが本名の一枚だけが「栞」を書く。普通のチェキと頼む場面には出さない。
  assert.equal(/栞/.test(textOf(scene)), !!c.secret, c.scene);
  for (const line of [...scene.lines, ...Object.values(scene.branches || {}).flat()]) {
    if (!line.text) continue;
    assert.equal(line.text.endsWith("。"), line.speaker === "", line.text);
    assert(!line.text.includes("\n"), line.text);
    assert(["", "minto", "hajime"].includes(line.speaker), line.text);
  }
}
assert(!/栞|精肉|自己破産|29歳/.test(textOf(ask) + textOf(scenes.minto_cheki_take)));
// 記念品・ギャラリー・周回の分類は同じ一覧から作る
const keepsakes = read("remake/js/core/keepsakes.js"), progress = read("remake/js/core/gallery-progress.js");
const carry = read("remake/js/core/carry.js"), catalog = read("remake/js/core/gallery-catalog.js");
for (const src of [keepsakes, progress, carry, catalog]) assert.match(src, /ALL_MINTO_CHEKIS\.map\(/);

// ---------------------------------------------------------------- B. 選び方（被りなし・こっそりの一枚）
function namedImports(src) {
  const map = new Map();
  for (const m of src.matchAll(/(?:import|export)\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const set = map.get(m[2]) || new Set();
    for (const part of m[1].split(",").map(s => s.trim()).filter(Boolean)) set.add(part.split(/\s+as\s+/)[0].trim());
    map.set(m[2], set);
  }
  return map;
}
async function loadWithStubs(filePath, overrides) {
  const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout, Math });
  const src = read(filePath);
  const mod = new vm.SourceTextModule(src, { context, identifier: filePath });
  const imports = namedImports(src);
  const synthetic = new Map();
  await mod.link(spec => {
    const names = [...(imports.get(spec) || [])];
    const values = overrides[spec] || {};
    const stub = new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, name in values ? values[name] : (() => undefined));
    }, { context, identifier: spec });
    synthetic.set(spec, stub);
    return stub;
  });
  await mod.evaluate();
  return { ns: mod.namespace, set: (spec, name, value) => synthetic.get(spec).setExport(name, value) };
}

let played = [], playImpl;
const DB = { dialogues: scenes };
const chekiModule = await loadWithStubs("remake/js/daily/minto-cheki.js", {
  "../core/data.js": { DB },
  "../core/minto-cheki-data.js": chekiData,
  "../vn/engine.js": { play: async (scene, opts) => { played.push(scene); return playImpl(scene, opts); } },
});
const cheki = chekiModule.ns;
const newSave = (patch = {}) => {
  const value = { story: { minto: 2 }, keepsakes: ["minto_first_cheki"], money: 20000, flags: {}, ...patch };
  chekiModule.set("../core/state.js", "state", value);
  return value;
};
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

// 正体を知る前: 普通のチェキだけ。持っていないものから選び、13枚で尽きる。
let s = newSave();
assert.equal(cheki.mintoChekiOfferDue(), true);
const got = [];
for (let n = 0; n < MINTO_CHEKIS.length; n++) {
  const pick = cheki.pickMintoCheki(s, () => 0.999);
  assert(pick && !pick.secret, "no secret before the reveal");
  assert(!s.keepsakes.includes(pick.id), "never a duplicate");
  s.keepsakes.push(pick.id); got.push(pick.id);
}
assert.deepEqual([...got].sort(), MINTO_CHEKIS.map(c => c.id).sort());
assert.equal(cheki.pickMintoCheki(s), null);
assert.equal(cheki.mintoChekiOfferDue(), false, "nothing left before the reveal");
// 初来店の前（台本の中に記念のチェキがある）は頼む場面を出さない
s = newSave({ story: { minto: 0 } });
assert.equal(cheki.mintoChekiOfferDue(), false);

// 正体だけ知っていて本名を聞く前: サインが本名の一枚は出さない
s = newSave({ flags: { _minto_identity_revealed: true } });
assert.equal(cheki.secretChekiOpen(), false);
assert.equal(cheki.pickMintoCheki(s, () => 0).secret, undefined);

// 正体と本名を知った後: たまに（SECRET_CHEKI_CHANCE 未満）私服の一枚
s = newSave({ flags: { _minto_identity_revealed: true, _minto_name_known: true } });
assert.equal(cheki.SECRET_CHEKI_CHANCE > 0 && cheki.SECRET_CHEKI_CHANCE < 0.5, true, "たまに");
assert.equal(cheki.pickMintoCheki(s, seq(cheki.SECRET_CHEKI_CHANCE - 0.01, 0)).secret, true);
assert.equal(cheki.pickMintoCheki(s, seq(cheki.SECRET_CHEKI_CHANCE, 0)).secret, undefined);
// 普通のチェキを集め終えたら、残りは私服の一枚が必ず。全部そろうと頼む場面は出ない。
s.keepsakes.push(...MINTO_CHEKIS.map(c => c.id));
const secrets = [];
for (let n = 0; n < MINTO_SECRET_CHEKIS.length; n++) {
  assert.equal(cheki.mintoChekiOfferDue(), true);
  const pick = cheki.pickMintoCheki(s, () => 0.999);
  assert.equal(pick.secret, true);
  assert(!s.keepsakes.includes(pick.id));
  s.keepsakes.push(pick.id); secrets.push(pick.id);
}
assert.deepEqual(secrets.sort(), MINTO_SECRET_CHEKIS.map(c => c.id).sort());
assert.equal(cheki.pickMintoCheki(s), null);
assert.equal(cheki.mintoChekiOfferDue(), false);

// 頼む → 撮る。見送ったら撮らない。中断したら何も渡さない。
let current;
const buy = (scene) => { const c = ALL_MINTO_CHEKIS.find(x => x.scene === scene); if (c) current.keepsakes.push(c.id); };
current = newSave();
playImpl = async (scene) => scene === "minto_cheki_ask" ? { id: scene, visited: [scene, "minto_cheki_take"] } : (buy(scene), { id: scene, visited: [scene] });
played = [];
assert.equal(await cheki.offerMintoCheki({ rand: () => 0 }), true);
assert.equal(played[0], "minto_cheki_ask");
assert.equal(played.length, 2);
assert(MINTO_CHEKIS.some(c => c.scene === played[1]));
assert.equal(current.keepsakes.length, 2);

current = newSave();
playImpl = async (scene) => ({ id: scene, visited: [scene] }); // 「今日はやめておく」
played = [];
assert.equal(await cheki.offerMintoCheki(), false);
assert.deepEqual(played, ["minto_cheki_ask"]);

current = newSave();
playImpl = async (scene) => ({ id: scene, visited: [scene], cancelled: true });
played = [];
assert.equal(await cheki.offerMintoCheki(), false);
assert.deepEqual(played, ["minto_cheki_ask"]);
assert.deepEqual(current.keepsakes, ["minto_first_cheki"]);

// こっそりの一枚: 頼んだ後で私服の台本を読む（お代は台本の buy_keepsake が0円で受け取る）
current = newSave({ flags: { _minto_identity_revealed: true, _minto_name_known: true } });
playImpl = async (scene) => scene === "minto_cheki_ask" ? { id: scene, visited: [scene, "minto_cheki_take"] } : (buy(scene), { id: scene, visited: [scene] });
played = [];
assert.equal(await cheki.offerMintoCheki({ rand: seq(0, 0) }), true);
assert(MINTO_SECRET_CHEKIS.some(c => c.scene === played[1]), played[1]);

// ---------------------------------------------------------------- C. 来店への接続
let state, offers = 0;
const spotsModule = await loadWithStubs("remake/js/daily/spots.js", {
  "../core/state.js": { markMet: id => { state.met[id] = true; } },
  "../core/data.js": { DB: { dialogues: { remake_repeat_minto_0: { dialogue_id: "remake_repeat_minto_0", lines: [{ speaker: "minto", text: "repeat" }] },
    ch1_minto_identity_reveal: { dialogue_id: "ch1_minto_identity_reveal", lines: [{ speaker: "minto", text: "reveal" }] } }, manifest: {} } },
  "../core/stats.js": {
    gainAffinity: () => {}, visitAffinity: () => 8, affinityLevel: () => 5, releaseAffinity: () => 0,
    AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], earnStat: () => {}, addStamina: () => {}, addMoney: () => {}, ensureAffinityLevel: () => {},
  },
  "../vn/engine.js": { play: async scene => ({ id: typeof scene === "string" ? scene : scene.dialogue_id, visited: [] }) },
  "../core/affinity-stages.js": { VISIT_SEQ: { minto: ["ch1_minto_first", "ch1_minto_second"] }, visitStorySkipped: () => false },
  "./weather.js": { isRainy: () => false, RAIN_SPOT_TEXTS: {} },
  "./bonds.js": { questionVisitDue: () => false, finaleAtVisit: () => false, afterStory: async () => true },
  "./spot-encounters.js": { spotFollowupDue: () => null },
  "./spot-hours.js": { openingStatus: () => ({ ok: true }) },
  "./minto-cheki.js": { offerMintoCheki: async () => { offers++; return true; } },
});
const spots = spotsModule.ns;
const visitSave = (patch = {}) => {
  state = {
    chapter: 1, phase: "daily", day: 8, slot: 0, story: { minto: 2 }, visits: { minto: 3 }, met: { minto: true }, contacts: ["minto"],
    affinity: { minto: 30 }, lovers: [], visitedDay: {}, keepsakes: [], flags: { _minto_identity_revealed: true }, ...patch,
  };
  spotsModule.set("../core/state.js", "state", state);
};
const peppermint = { id: "peppermint", kind: "rival", charId: "minto", cost: 3000, stamina: -16 };
visitSave(); offers = 0;
assert.equal(await spots.visitRival(peppermint), true);
assert.equal(offers, 1, "いつもの来店の後に頼める");
// 正体がつながった日の来店は、照れた接客で終える
visitSave({ affinity: { minto: 40 }, flags: {} }); offers = 0;
assert.equal(spots.mintoIdentityRevealDue(), true);
assert.equal(await spots.visitRival(peppermint), true);
assert.equal(state.flags._minto_identity_revealed, undefined, "the stub reveal does not set the flag");
assert.equal(offers, 0, "not on the reveal visit");
// 初来店は台本の中に記念のチェキがある
visitSave({ story: { minto: 0 }, visits: {}, met: {} }); offers = 0;
await spots.visitRival(peppermint);
assert.equal(offers, 0, "not on the first visit");
// 立ち寄り（店持ちのおつかい）と、ほかの店では出さない
visitSave(); offers = 0;
await spots.visitRival(peppermint, { expense: true });
assert.equal(offers, 0, "not on an errand visit");

console.log(`OK: minto cheki — ${MINTO_CHEKIS.length} no-repeat chekis, ${MINTO_SECRET_CHEKIS.length} secret ones after the reveal and her name, offered after ordinary PEPPERMINT visits`);
