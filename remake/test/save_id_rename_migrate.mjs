// スキーマ26（IDREN01）: キャラID改名の旧セーブ付け替えテスト。
// 旧ID（nagumo/rin/kuze/saif/rashid）で保存されたデータが、新ID（sensu/rio/ayatori/faris/khalil）で復元されること。
// 付け替え先に既存値がある場合は新ID側を優先する。
// node --experimental-vm-modules remake/test/save_id_rename_migrate.mjs
import assert from "node:assert/strict";
import * as core from "../js/core/state.js";

const files = new Map();
globalThis.localStorage = {
  getItem: (key) => files.get(key) ?? null,
  setItem(key, value) { files.set(key, String(value)); },
  removeItem(key) { files.delete(key); },
};

function loadSave(save) {
  files.clear();
  core.setState(null);
  files.set(core.SAVE_KEY, JSON.stringify(save));
  const loaded = core.load();
  assert(loaded, "旧セーブが読み込める");
  return loaded;
}

// --- 旧IDを含む schema 25 セーブ（全構造） ---
{
  const s = loadSave({
    schema: 25, day: 3,
    flavors: ["double_apple"],
    met: { rin: true, nagumo: true, sumi: true },
    affinity: { rin: 40, nagumo: 10, kuze: 5, saif: 3, rashid: 2, sumi: 7 },
    affinityCarry: { rin: 0.5 },
    loveCarry: { kuze: 0.25 },
    story: { rin: 2, kuze: 1 },
    flags: { _rin_sample: true, _read_ch1_rin_first: true, pakki_app_installed: true },
    contacts: ["sumi", "rin", "kuze"],
    lovers: ["rin"],
    loveLevel: { rin: 2 },
    lovePts: { rin: 30 },
    loverSince: { rin: 5 },
    lastDate: { rin: 6 },
    romance: { rin: 1 },
    romanceChoices: { q1: { char: "rin", value: 1, day: 2 } },
    finales: { kuze: { day: 2, chapter: 3, route: "friend" } },
    friendHangouts: { nagumo: 1 },
    limeRead: ["rin_1", "sumi_2"],
    flavorLessons: ["ch1_rin_first"],
    relationshipMemories: ["rin_memory_1"],
    loverEventsSeen: ["rin_date_1"],
    usedBaito: ["baito_rin_day"],
    baitoRecent: [{ id: "b1", chapter: 1, day: 2, customers: ["rin", "minto"] }],
    inbox: [{
      id: "rin_invite_1", day: 2, read: false, done: false, log: [],
      msg: { sender: "rin", type: "invitation", accept_event: "outing_rin_1", origin_id: "rin_invite_1" },
    }],
    pendingInvite: { sender: "nagumo", event: "visit_nagumo", originId: "nagumo_x", day: 3 },
    deferredNightEvents: [],
    trpg: {
      stock: [], owned: [], shifts: [],
      cleared: { t1: { ending: "good", chapter: 3, day: 4, gm: "saif", participants: ["rin", "sai"] } },
      club: { founded: { chapter: 2, day: 3 }, members: { rin: { chapter: 2, day: 5 } } },
    },
    tokyoVisits: {
      version: 1, closedSlots: [], chats: {},
      plans: [{
        id: "p1", characterId: "rashid", status: "booked", arrivalDay: 2, returnDay: 5,
        meetup: { day: 2, slot: 0, id: "d2-noon" }, date: { day: 3, slot: 1, id: "d3-night" },
        met: false, dateDone: false,
      }],
      offers: {
        rashid: {
          characterId: "rashid", arrivalDay: 2, returnDay: 5,
          meetup: { day: 2, slot: 0, id: "d2-noon" }, date: { day: 3, slot: 1, id: "d3-night" },
        },
      },
    },
  });
  assert.equal(s.schema, core.SCHEMA);
  // キーの付け替え（好感度・面識・固有会話・絆）
  assert.equal(s.affinity.rio, 40);
  assert.equal(s.affinity.sensu, undefined);
  assert.equal(s.affinity.ayatori, 5);
  assert.equal(s.affinity.faris, undefined);
  assert.equal(s.affinity.khalil, undefined);
  assert.equal(s.affinity.sumi, 9);
  assert.equal(s.affinity.tsumugi, 9);
  for (const old of ["nagumo", "rin", "kuze", "saif", "rashid"]) assert(!(old in s.affinity), old + " が残らない");
  assert.equal(s.met.rio, true);
  assert.equal(s.story.rio, 2);
  assert.equal(s.affinityCarry.rio, 0.5);
  assert.equal(s.loveCarry.ayatori, 0.25);
  assert.equal(s.loveLevel.rio, 2);
  assert.equal(s.lovePts.rio, 30);
  assert.equal(s.loverSince.rio, 5);
  assert.equal(s.lastDate.rio, 6);
  assert.equal(s.romance.rio, 1);
  assert.equal(s.finales.ayatori.route, "friend");
  assert.equal(s.friendHangouts.sensu, 1);
  // フラグキーと、_rio_sample を見る既存補完（フレーバー在庫）が新IDで効く
  assert.equal(s.flags._rio_sample, true);
  assert.equal(s.flags._read_ch1_rio_first, true);
  assert.equal(s.flavorStock.nightside_earlgrey, 50);
  // 配列・値側のID
  assert.deepEqual(s.contacts, ["sumi", "rio", "ayatori"]);
  assert.deepEqual(s.lovers, ["rio"]);
  assert.equal(s.romanceChoices.q1.char, "rio");
  assert.deepEqual(s.limeRead, ["rio_1", "sumi_2"]);
  assert.deepEqual(s.flavorLessons, ["ch1_rio_first"]);
  assert.deepEqual(s.relationshipMemories, ["rio_memory_1"]);
  assert.deepEqual(s.loverEventsSeen, ["rio_date_1"]);
  assert.deepEqual(s.usedBaito, ["baito_rio_day"]);
  assert.deepEqual(s.baitoRecent[0].customers, ["rio", "minto"]);
  // LIME受信箱・予約
  assert.equal(s.inbox[0].id, "rio_invite_1");
  assert.equal(s.inbox[0].msg.sender, "rio");
  assert.equal(s.inbox[0].msg.accept_event, "outing_rio_1");
  assert.equal(s.pendingInvite.sender, "sensu");
  // TRPG・東京訪問
  assert.equal(s.trpg.cleared.t1.gm, "faris");
  assert.deepEqual(s.trpg.cleared.t1.participants, ["rio", "sai"]);
  assert.deepEqual(Object.keys(s.trpg.club.members), ["rio"]);
  assert.equal(s.tokyoVisits.plans[0].characterId, "khalil");
  assert.equal(s.tokyoVisits.offers.khalil.characterId, "khalil");
}

// --- 付け替え先に既存値がある場合は新ID側を優先する ---
{
  const s = loadSave({ schema: 25, day: 1, affinity: { rin: 40, rio: 99 }, lovers: ["rin", "rio"] });
  assert.equal(s.affinity.rio, 99);
  assert(!("rin" in s.affinity));
  assert.deepEqual(s.lovers, ["rio"]);
}

// --- schema 23 の旧セーブ: 後段の移行（第4回の味の話）も新IDで効く ---
{
  const s = loadSave({ schema: 23, day: 2, story: { rin: 4 } });
  assert.equal(s.story.rio, 4);
  assert(s.flavorLessons.includes("ch1_rio_fourth"), "ch1_rio_fourth が補われる");
}

// --- 現行スキーマのセーブはそのまま ---
{
  const s = loadSave({ schema: core.SCHEMA, day: 1, affinity: { sumi: 9, tsumugi: 9, rio: 3 } });
  assert.deepEqual(s.affinity, { sumi: 9, tsumugi: 9, rio: 3 });
}



// Current cast IDs are not another save migration. Physical art and item identifiers are independent.
{
  const { readFileSync } = await import("node:fs");
  const { characterArtStem, resolvePortrait } = await import("../js/core/portrait-resolver.js");
  const { costumeUrl } = await import("../js/trpg/costumes.js");
  const { STOPS, ROOMS } = await import("../js/chapters/ch2-city-data.js");
  const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
  const cast = json("../../data/characters.json"), manifest = json("../data/manifest.json");
  const names = { kuraudo: "rei", uezono: "maezono", ayatori: "saku", sensu: "sui", dr_charcoal: "dr_kemuri" };
  for (const [actor, art] of Object.entries(names)) {
    assert.equal(cast.find(c => c.id === actor)?.art_stem, art);
    assert.equal(characterArtStem(actor), art);
    assert(!cast.some(c => c.id === art));
    assert(!Object.hasOwn(core.CHAR_ID_RENAMES, art));
    for (const style of ["new", "classic"]) {
      const pic = resolvePortrait(manifest, actor, "normal", style);
      assert.equal(pic.folder, actor);
      assert(pic.rel.endsWith(`/${art}/chr_${art}_normal.png`));
      assert(manifest.webp.includes(pic.rel), pic.rel);
    }
  }
  const spot = STOPS.find(s => s.id === "kuraudo");
  assert.equal(spot.shopId, "ch2_rei");
  assert(ROOMS[spot.id].endsWith("/bg_ch2_rei_entry.webp"));
  assert.equal(json("../../data/equipment.json").equipment.find(e => e.id === "suyaki_rei").gift.from, "kuraudo");
  assert(costumeUrl("purikura-hero", "kuraudo", "nocturne").endsWith("/rei_nocturne.webp"));
  assert.equal(costumeUrl("purikura-hero", "rei", "nocturne"), null);
}

console.log("save id rename migrate: PASS (legacy remaps, no new migrations, canonical actors, stable art and item IDs)");
