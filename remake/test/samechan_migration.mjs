// node --experimental-vm-modules remake/test/samechan_migration.mjs
// 実際のオート・手動ロードで、旧IDの恋人・予約・読了記録を引き継ぐ。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../js/core/", import.meta.url);
const storage = new Map();
const context = vm.createContext({ console, Date, Math,
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
});
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const module = new vm.SourceTextModule(fs.readFileSync(url, "utf8"), { context, identifier: url.href });
  modules.set(url.href, module);
  await module.link(specifier => load(new URL(specifier, url)));
  return module;
}
const module = await load(new URL("state.js", root));
await module.evaluate();
const core = module.namespace;
const copy = value => JSON.parse(JSON.stringify(value));
const normalized = value => { const result = copy(value); delete result.savedAt; return result; };

function legacySave(schema) {
  const s = copy(core.newState());
  Object.assign(s, { schema, chapter: 2, phase: "daily", day: 6, slot: 1, money: 21000,
    stamina: 71, restDay: { chapter: 2, day: 6, fullDay: false, illnessHealth: "yellow" },
    contacts: ["sumi", "kafuka"], lovers: ["kafuka"],
    limeRead: ["lime_naru_kafuka_nickname", "lime_kafuka_opening"],
    loverEventsSeen: ["lover_kafuka_lv1", "lover_kafuka_lv2"],
    relationshipMemories: ["kafuka_quiet_seat_light"],
    baitoRecent: [{ id: "regular_customer", chapter: 2, day: 5, customers: ["kafuka"] }],
    deferredNightEvents: [{ id: "kafuka_shop_closing_check", chapter: 2, originalDay: 5, deferredOn: 5,
      reason: "illness", prerequisites: ["_kafuka_first_encounter"], doneKeys: ["_kafuka_closing_check_done"] }],
  });
  for (const [key, value] of Object.entries({ met: true, affinity: 84, affinityCarry: 0.7, loveCarry: 0.5,
    story: 5, loveLevel: 3, lovePts: 28, loverSince: 3, lastDate: 4, romance: 2, friendHangouts: 1 })) {
    s[key] = { kafuka: value };
  }
  s.visits.shishark = 5; s.visitedDay.shishark = 5;
  s.flags = { _kafuka_first_encounter: true, _kafuka_name_known: true, _lime_contact_kafuka: true,
    _kafuka_visit: { stamp: "2:6:1", dialogue: "kafuka_shop_closing_check", complete: false },
    _kafuka_date: { stamp: "2:4:1", venue: "shishark", complete: true },
    _kafuka_last_date_chapter: 2, _private_night_char: "kafuka", _qa_preserved: "keep" };
  s.romanceChoices = { bond_q1_kafuka: { char: "kafuka", value: 1, day: 3 },
    bond_q2_kafuka: { char: "kafuka", value: 1, day: 3 } };
  s.finales = { kafuka: { chapter: 2, day: 3, route: "lover" } };
  s.inbox = [{ id: "lover_invite_kafuka_c2_6", originId: "lover_invite_kafuka_c2", day: 6,
    read: true, done: true, replyState: "replied", result: "accepted",
    msg: { sender: "kafuka", type: "invitation", accept_event: "date_kafuka", accept_slot: "night",
      flag: "_lover_invite_kafuka_c2", lines: [{ speaker: "kafuka", text: "会いに来てくれるか？" }] },
    log: [{ speaker: "kafuka", name: "カフカ", text: "待っておるぞ" }] }];
  s.pendingInvite = { sender: "kafuka", event: "date_kafuka", originId: "lover_invite_kafuka_c2",
    day: 6, slot: "night", cost: 3000, afterClose: false };
  s.stats.insight = 32; s.statXp.insight = 0;
  s.reel.count = 7; s.reel.installed = true;
  s.keepsakes = ["minto_cheki_original"];
  return s;
}

function checkProgress(s) {
  assert.equal(s.schema, core.SCHEMA);
  assert.equal(s.money, 21000); assert.equal(s.stamina, 71);
  assert.deepEqual(s.contacts, ["sumi", "samechan"]); assert.deepEqual(s.lovers, ["samechan"]);
  assert.equal(s.met.samechan, true); assert.equal(s.affinity.samechan, 84);
  assert.equal(s.affinityCarry.samechan, 0.7); assert.equal(s.loveCarry.samechan, 0.5);
  assert.equal(s.story.samechan, 5); assert.equal(s.loveLevel.samechan, 3); assert.equal(s.lovePts.samechan, 28);
  assert.equal(s.loverSince.samechan, 3); assert.equal(s.lastDate.samechan, 4);
  assert.equal(s.romance.samechan, 2); assert.equal(s.friendHangouts.samechan, 1);
  assert.deepEqual(s.romanceChoices.bond_q1_samechan, { char: "samechan", value: 1, day: 3 });
  assert.deepEqual(s.romanceChoices.bond_q2_samechan, { char: "samechan", value: 1, day: 3 });
  assert.deepEqual(s.finales.samechan, { chapter: 2, day: 3, route: "lover" });
  assert.deepEqual(s.loverEventsSeen, ["lover_samechan_lv1", "lover_samechan_lv2"]);
  assert.deepEqual(s.relationshipMemories, ["samechan_quiet_seat_light"]);
  assert.deepEqual(s.limeRead, ["lime_naru_samechan_nickname", "lime_samechan_opening"]);
  assert.equal(s.inbox[0].id, "lover_invite_samechan_c2_6");
  assert.equal(s.inbox[0].msg.sender, "samechan"); assert.equal(s.inbox[0].msg.accept_event, "date_samechan");
  assert.equal(s.inbox[0].msg.flag, "_lover_invite_samechan_c2");
  assert.equal(s.inbox[0].msg.lines[0].speaker, "samechan");
  assert.equal(s.inbox[0].log[0].name, "サメちゃん"); assert.equal(s.inbox[0].log[0].text, "待っておるぞ");
  assert.deepEqual(s.pendingInvite, { sender: "samechan", event: "date_samechan", originId: "lover_invite_samechan_c2",
    day: 6, slot: "night", cost: 3000, afterClose: false });
  assert.deepEqual(s.flags._samechan_visit, { stamp: "2:6:1", dialogue: "samechan_shop_closing_check", complete: false });
  assert.deepEqual(s.flags._samechan_date, { stamp: "2:4:1", venue: "shishark", complete: true });
  assert(s.flags._samechan_first_encounter && s.flags._samechan_name_known && s.flags._lime_contact_samechan);
  assert.equal(s.flags._samechan_last_date_chapter, 2); assert.equal(s.flags._private_night_char, "samechan");
  assert.deepEqual(s.baitoRecent[0].customers, ["samechan"]);
  assert.deepEqual(s.deferredNightEvents[0].prerequisites, ["_samechan_first_encounter"]);
  assert.deepEqual(s.deferredNightEvents[0].doneKeys, ["_samechan_closing_check_done"]);
  assert.equal(s.deferredNightEvents[0].id, "samechan_shop_closing_check");
  assert.equal(s.visits.shishark, 5); assert.equal(s.visitedDay.shishark, 5);
  assert.equal(s.stats.insight, 32); assert.equal(s.reel.count, 7); assert(s.reel.installed);
  assert.equal(s.flags._qa_preserved, "keep"); assert.deepEqual(s.keepsakes, ["minto_cheki_original"]);
  assert.deepEqual(s.restDay, { chapter: 2, day: 6, fullDay: false, illnessHealth: "yellow" });
  assert(!/kafuka|カフカ|かふか/i.test(JSON.stringify(s)), "旧名がセーブ内に残った");
}

for (const schema of [5, 12]) {
  const raw = JSON.stringify(legacySave(schema));
  for (const slot of core.SAVE_SLOTS) {
    storage.clear(); storage.set(slot.key, raw);
    core.newGame();
    const migrated = copy(slot.auto ? core.load() : core.loadFromSlot(slot.key));
    checkProgress(migrated);
    if (slot.auto) assert.equal(storage.get(slot.key), raw, "ロード前のオートセーブを書き換えた");
    else assert.equal(storage.get(slot.key), raw, "元の手動セーブを書き換えた");
    core.save();
    assert.deepEqual(normalized(core.load()), normalized(migrated), "再ロードで進行が変化した");
    core.saveToSlot(slot.key); core.newGame();
    assert.deepEqual(normalized(core.loadFromSlot(slot.key)), normalized(migrated), "現行IDの手動保存が変化した");
  }
}

// 新旧の連絡先が混在した場合は重複させず、既存の現行IDの値を優先する。
const mixed = legacySave(12);
mixed.contacts.push("samechan"); mixed.lovers.push("samechan");
mixed.affinity.samechan = 90;
storage.set(core.SAVE_KEY, JSON.stringify(mixed));
const loaded = copy(core.load());
assert.deepEqual(loaded.contacts, ["sumi", "samechan"]); assert.deepEqual(loaded.lovers, ["samechan"]);
assert.equal(loaded.affinity.samechan, 90);

// 再案内だけに新しい受信箱IDが付いた旧保存では、台本に残った元の約束IDを保持する。
const retry = legacySave(12);
retry.inbox[0].id = "lover_invite_kafuka_c2_6_retry1";
delete retry.inbox[0].originId;
retry.inbox[0].msg.origin_id = "lover_invite_kafuka_c2";
storage.set(core.SAVE_KEY, JSON.stringify(retry));
const retryLoaded = copy(core.load());
assert.equal(retryLoaded.inbox[0].originId, "lover_invite_samechan_c2");
assert.equal(retryLoaded.pendingInvite.originId, retryLoaded.inbox[0].originId);
core.save(); assert.deepEqual(normalized(core.load()), normalized(retryLoaded));
console.log("[samechan migration] PASS: all save slots, old schemas, invitations, romance, receipts, read milestones and repeated loads");
