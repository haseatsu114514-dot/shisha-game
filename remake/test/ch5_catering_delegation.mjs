// 委託予約・手取りの純粋モデル回帰。既存 ch5_catering.mjs からも実行する。
import assert from "node:assert/strict";
import * as M from "../js/chapters/ch5-catering-model.js";
const make = () => ({ chapter: 5, day: 42, slot: 0, money: 1000,
  flags: { _ch5: { startDay: 40, part: "free" }, _ch2_region: "home" } });
const offer = (id = "wedding_party") => {
  const value = make();
  assert(M.recordCateringOffer(value, id, "request"));
  return value;
};
const pay = value => amount => { value.money += amount; return amount; };

assert.equal(M.CATERING_REQUESTS.length, 8);
for (const entry of M.CATERING_REQUESTS) {
  assert(Number.isInteger(entry.payout) && entry.payout >= 15000 && entry.payout <= 25000);
  const value = offer(entry.id);
  const snapshot = JSON.stringify(value);
  for (const day of [42, 46, 43.5, null]) assert.equal(M.delegateCatering(value, "request", { day }), false);
  assert.equal(M.delegateCatering(value, "wrong", { day: 43 }), false);
  assert.equal(M.delegateCatering(value, "request", { day: 43, blocked: true }), false);
  assert.equal(JSON.stringify(value), snapshot, "無効予約は状態を変えない");
  assert(M.delegateCatering(value, "request", { day: 43 }));
  assert.equal(value.money, 1000, "予約時は受け取らない");
  assert.equal(value.slot, 0, "予約時は行動を使わない");
  assert.equal(M.cateringJob(value), null, "委託中は自分の行き先を出さない");
  assert.equal(M.isTsumugiCateringAway(value, 43, entry.slot), true);
  assert.equal(M.isTsumugiCateringAway(value, 43, 1 - entry.slot), false);
  assert.equal(M.isTsumugiCateringAway(value, 44, entry.slot), false);
  assert.equal(M.delegateCatering(value, "request", { day: 44 }), false, "予約を重ねない");
  const payout = pay(value);
  assert.equal(M.settleDelegatedCatering(value, { throughDay: 43, throughSlot: entry.slot - 1, pay: payout }), null);
  assert.equal(M.settleCatering(value, 0, () => { throw Error("委託にくじ券はない"); }, payout), null);
  value.day = 43;
  value.slot = entry.slot;
  value.flags._ch2_region = "dubai";
  const result = M.settleDelegatedCatering(value, { throughDay: 43, throughSlot: entry.slot, pay: payout });
  assert.deepEqual(result, { id: entry.id, day: 43, performer: "tsumugi", fit: "delegated", tickets: 0, payout: entry.payout, paid: entry.payout });
  assert.equal(value.money, 1000 + entry.payout, "遠出中も手取りだけ受け取る");
  assert.equal(value.slot, entry.slot, "委託の精算で行動を進めない");
  assert.equal(M.isTsumugiCateringAway(value), false);
  assert.equal(M.cateringState(value).served[entry.id], 1);
  const loaded = JSON.parse(JSON.stringify(value));
  assert.equal(M.settleDelegatedCatering(loaded, { throughDay: 99, throughSlot: 1, pay: pay(loaded) }), null);
  assert.equal(loaded.money, value.money, "精算済みLOADで二重に受け取らない");
}
{
  const value = offer();
  value.pendingInvite = { sender: "tsumugi", day: 43, slot: 1 };
  assert.match(M.cateringDelegationBlock(value, 43), /予定/);
  assert.equal(M.delegateCatering(value, "request", { day: 43 }), false);
  assert.equal(M.cateringDelegationBlock(value, 44), null, "別の日なら既存予定と重ならない");
  value.pendingInvite.sender = "minto";
  assert.equal(M.cateringDelegationBlock(value, 43), null, "はじめの別行動は並行できる");
}
{
  const value = offer();
  assert(M.acceptCatering(value, "request"));
  value.day++;
  assert(M.delegateCatering(value, "request", { day: 45 }), "本人の受諾から委託へ変更できる");
  assert.equal(M.cateringDelegation(value).until, 45, "元の期限を延長しない");
}
{
  const value = offer();
  assert(M.acceptCatering(value, "request"));
  value.day = 45;
  assert.equal(M.delegateCatering(value, "request", { day: 46 }), false, "期限のあとへ先延ばししない");
}
{
  const value = offer();
  assert(M.delegateCatering(value, "request", { day: 43 }));
  value.day = 50;
  value.slot = 0;
  assert.equal(M.expireCatering(value), null, "未精算の委託を期限切れで消さない");
  assert(M.settleDelegatedCatering(value, { pay: pay(value) }), "休養・LOADで飛ばした枠も翌朝に後追い精算");
  assert.equal(value.money, 26000);
}
{
  const value = offer();
  assert(M.delegateCatering(value, "request", { day: 44 }));
  value.flags._ch5.part = "scheduled";
  value.flags._ch5.matchDay = 43;
  assert.equal(M.settleDelegatedCatering(value, { pay: pay(value) }), null, "勝負の日を決めても未来分は払わない");
  assert.equal(M.closeCatering(value).assigned, "tsumugi");
  assert.equal(M.cateringDelegation(value), null);
  assert.equal(value.money, 1000);
  assert.equal(M.closeCatering(value), null);
}
{
  const value = offer();
  assert(M.delegateCatering(value, "request", { day: 43 }));
  value.day = 43;
  value.slot = 2;
  value.flags._ch5.part = "scheduled";
  assert(M.settleDelegatedCatering(value, { pay: pay(value) }), "終盤へ入った時も終了済み枠は精算");
  assert.equal(M.closeCatering(value), null);
}
{
  const value = offer();
  assert(M.acceptCatering(value, "request"));
  const old = JSON.parse(JSON.stringify(value));
  old.day++;
  old.slot = 0;
  assert.equal(M.cateringDelegation(old), null, "旧受諾は本人の仕事");
  assert.equal(M.settleCatering(old, 1, n => n, pay(old)), null, "本人は別の枠で精算できない");
  old.slot = 1;
  old.flags._ch2_region = "tokyo";
  assert.equal(M.settleCatering(old, 1, n => n, pay(old)), null, "本人は遠出先で精算できない");
  old.flags._ch2_region = "home";
  assert.equal(M.settleCatering(old, 1, n => n, pay(old)).paid, 25000);
  assert.equal(M.settleCatering(old, 1, n => n, pay(old)), null);
}
{
  const value = offer();
  M.delegateCatering(value, "request", { day: 43 });
  value.day = 44;
  assert.equal(M.settleDelegatedCatering(value, { pay: () => 500 }).paid, 500, "財布の上限で実受取額を記録");
  assert.equal(M.cateringState(value).last.payout, 25000, "表示用の契約手取りを維持");
}
for (const fields of [{ jobDay: "43" }, { jobDay: 42 }, { jobDay: 46 }, { accepted: null }]) {
  const value = offer();
  M.delegateCatering(value, "request", { day: 43 });
  Object.assign(value.flags[M.CATERING_FLAG].offer, fields);
  assert.equal(M.cateringDelegation(value), null, "壊れた委託予約を精算しない");
  assert.equal(M.cateringJob(value), null, "壊れた委託予約を本人の仕事へ変えない");
}
// 既存のTRPG参加判定が先頭の個別予定を読む契約を守り、完了・取消で元の予定を復帰する。
for (const finish of ["settle", "close"]) {
  const value = offer();
  const existing = [
    { id: "tsumugi", chapter: 5, day: 43, slot: 1, busy: false, reason: "休みの予定" },
    { id: "tsumugi", chapter: 5, day: 44, slot: 1, busy: true, reason: "別の仕事", cateringMsg: "other" },
    { id: "ageha", chapter: 5, day: 43, slot: 1, busy: true, reason: "先の約束" },
  ];
  value.trpg = { shifts: structuredClone(existing), owned: ["book"], club: { founded: { chapter: 2, day: 20 } } };
  assert(M.delegateCatering(value, "request", { day: 43 }));
  assert.equal(value.trpg.shifts[0].busy, true);
  assert.equal(value.trpg.shifts[0].cateringMsg, "request");
  assert.deepEqual(value.trpg.shifts.slice(1), existing, "先の予定は編集しない");
  const loaded = JSON.parse(JSON.stringify(value));
  loaded.day = 43;
  loaded.slot = 1;
  if (finish === "settle") assert(M.settleDelegatedCatering(loaded, { throughDay: 43, throughSlot: 1, pay: pay(loaded) }));
  else assert(M.closeCatering(loaded));
  assert.deepEqual(loaded.trpg.shifts, existing, "自分の委託の一時予定だけを取り除く");
  assert.deepEqual(loaded.trpg.owned, ["book"]);
}
{
  const value = offer();
  const existing = [{ id: "tsumugi", chapter: 5, day: 43, slot: 1, busy: true, reason: "別の仕事" }];
  value.trpg = { shifts: structuredClone(existing) };
  const before = JSON.stringify(value);
  assert.match(M.cateringDelegationBlock(value, 43), /予定/);
  assert.equal(M.delegateCatering(value, "request", { day: 43 }), false);
  assert.equal(JSON.stringify(value), before, "busy予定への重複予約では状態を変えない");
  assert.equal(M.cateringDelegationBlock(value, 44), null);
}
console.log("[ch5 catering delegation] PASS: payouts, reservations, conflicts, parallel action, absence, expiry, reload, finale, legacy saves");

// Each delegated location has its own report, in Tsumugi's voice. No extra relationship/stat rewards.
assert.equal(new Set(M.CATERING_REQUESTS.map(r => r.report.join("|"))).size, M.CATERING_REQUESTS.length);
for (const entry of M.CATERING_REQUESTS) {
  assert.equal(entry.report.length, 3);
  for (const text of [...entry.report, entry.reportReply]) {
    assert(text && text.length <= 48 && !text.includes("\n"), entry.id);
    assert.doesNotMatch(text, /好感度|上がった|手当|売上|円/);
  }
}
