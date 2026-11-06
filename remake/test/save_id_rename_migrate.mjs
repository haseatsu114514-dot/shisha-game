// スキーマ26（IDREN01）: キャラID改名の旧セーブ付け替えテスト。
// 旧ID（nagumo/rin/kuze/saif/rashid）で保存されたデータが、新ID（sui/kuyuri/saku/faris/khalil）で復元されること。
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
  assert.equal(s.schema, 26);
  // キーの付け替え（好感度・面識・固有会話・絆）
  assert.equal(s.affinity.kuyuri, 40);
  assert.equal(s.affinity.sui, 10);
  assert.equal(s.affinity.saku, 5);
  assert.equal(s.affinity.faris, 3);
  assert.equal(s.affinity.khalil, 2);
  assert.equal(s.affinity.sumi, 7);
  for (const old of ["nagumo", "rin", "kuze", "saif", "rashid"]) assert(!(old in s.affinity), old + " が残らない");
  assert.equal(s.met.kuyuri, true);
  assert.equal(s.story.kuyuri, 2);
  assert.equal(s.affinityCarry.kuyuri, 0.5);
  assert.equal(s.loveCarry.saku, 0.25);
  assert.equal(s.loveLevel.kuyuri, 2);
  assert.equal(s.lovePts.kuyuri, 30);
  assert.equal(s.loverSince.kuyuri, 5);
  assert.equal(s.lastDate.kuyuri, 6);
  assert.equal(s.romance.kuyuri, 1);
  assert.equal(s.finales.saku.route, "friend");
  assert.equal(s.friendHangouts.sui, 1);
  // フラグキーと、_kuyuri_sample を見る既存補完（フレーバー在庫）が新IDで効く
  assert.equal(s.flags._kuyuri_sample, true);
  assert.equal(s.flags._read_ch1_kuyuri_first, true);
  assert.equal(s.flavorStock.nightside_earlgrey, 50);
  // 配列・値側のID
  assert.deepEqual(s.contacts, ["sumi", "kuyuri", "saku"]);
  assert.deepEqual(s.lovers, ["kuyuri"]);
  assert.equal(s.romanceChoices.q1.char, "kuyuri");
  assert.deepEqual(s.limeRead, ["kuyuri_1", "sumi_2"]);
  assert.deepEqual(s.flavorLessons, ["ch1_kuyuri_first"]);
  assert.deepEqual(s.relationshipMemories, ["kuyuri_memory_1"]);
  assert.deepEqual(s.loverEventsSeen, ["kuyuri_date_1"]);
  assert.deepEqual(s.usedBaito, ["baito_kuyuri_day"]);
  assert.deepEqual(s.baitoRecent[0].customers, ["kuyuri", "minto"]);
  // LIME受信箱・予約
  assert.equal(s.inbox[0].id, "kuyuri_invite_1");
  assert.equal(s.inbox[0].msg.sender, "kuyuri");
  assert.equal(s.inbox[0].msg.accept_event, "outing_kuyuri_1");
  assert.equal(s.pendingInvite.sender, "sui");
  // TRPG・東京訪問
  assert.equal(s.trpg.cleared.t1.gm, "faris");
  assert.deepEqual(s.trpg.cleared.t1.participants, ["kuyuri", "sai"]);
  assert.deepEqual(Object.keys(s.trpg.club.members), ["kuyuri"]);
  assert.equal(s.tokyoVisits.plans[0].characterId, "khalil");
  assert.equal(s.tokyoVisits.offers.khalil.characterId, "khalil");
}

// --- 付け替え先に既存値がある場合は新ID側を優先する ---
{
  const s = loadSave({ schema: 25, day: 1, affinity: { rin: 40, kuyuri: 99 }, lovers: ["rin", "kuyuri"] });
  assert.equal(s.affinity.kuyuri, 99);
  assert(!("rin" in s.affinity));
  assert.deepEqual(s.lovers, ["kuyuri"]);
}

// --- schema 23 の旧セーブ: 後段の移行（第4回の味の話）も新IDで効く ---
{
  const s = loadSave({ schema: 23, day: 2, story: { rin: 4 } });
  assert.equal(s.story.kuyuri, 4);
  assert(s.flavorLessons.includes("ch1_kuyuri_fourth"), "ch1_kuyuri_fourth が補われる");
}

// --- 現行スキーマのセーブはそのまま ---
{
  const s = loadSave({ schema: 26, day: 1, affinity: { sui: 5, kuyuri: 3 } });
  assert.deepEqual(s.affinity, { sui: 5, kuyuri: 3 });
}

console.log("save id rename migrate: PASS (all structures renamed, new-key priority, legacy lesson backfill, current schema untouched)");
