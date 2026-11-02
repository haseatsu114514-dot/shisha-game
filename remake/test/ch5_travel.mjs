// 第5章の遠出の交通（FIN13・FIN14 / 2026-11-02 オーナー「東京は配送便で」「ドバイの交通費はシェイクの手紙で」）。
// 東京: Dr.fookah の配送便は無料・昼に出て夜に着く（2行動）。ドバイ: シェイクの手紙に毎回往復の切符が入っていて無料。
// ブラウザ不要（chapters/ch5-travel.js は状態を読む・記録するだけ）。画面での通しは browser/ch5_full_flow.mjs。
import assert from "node:assert/strict";
import {
  TOKYO_VAN_SLOTS, DUBAI_LETTER_DAYS, DUBAI_LETTER_AGAIN, tokyoVanBlock, hasDubaiTicket, dubaiTripStatus,
  receiveDubaiLetter, useDubaiTicket, recordDubaiReturn,
} from "../js/chapters/ch5-travel.js";
import { returnFareReserve, spendableMoney } from "../js/core/travel-budget.js";

const save = (fields = {}) => ({ chapter: 5, day: 51, slot: 0, money: 30000, pendingInvite: null, flags: {}, ...fields });

// ---- 東京: 配送便
assert.equal(TOKYO_VAN_SLOTS, 2, "The van takes one action more than the old one-action train");
assert.equal(tokyoVanBlock(save()), null, "The van leaves in the daytime");
assert.deepEqual(tokyoVanBlock(save({ slot: 1 })), { why: "配送便は昼に出る。夜は便が無い", tag: "便は昼だけ" });
// 今夜にLIMEの約束がある日は乗らない（今日の夜をまるごと使うので、約束を飛ばさない）。別の日・昼の約束は関係ない。
assert.equal(tokyoVanBlock(save({ pendingInvite: { day: 51, slot: 1, sender: "sumi" } })).tag, "今夜は約束");
assert.equal(tokyoVanBlock(save({ pendingInvite: { day: 52, slot: 1, sender: "sumi" } })), null);
assert.equal(tokyoVanBlock(save({ pendingInvite: { day: 51, slot: 0, sender: "sumi" } })), null);
// 東京でも帰りの分を取り置かない（使える金額＝所持金）。柚ヶ谷の帰りの200円はそのまま。
{
  const tokyo = save({ money: 4000, flags: { _ch2_region: "tokyo", _ch2_preparation_started: true } });
  assert.equal(returnFareReserve(tokyo), 0, "No return fare is reserved in Tokyo");
  assert.equal(spendableMoney(tokyo), 4000, "A 4,000-yen Tokyo shop is affordable with exactly 4,000 yen");
}
assert.equal(returnFareReserve(save({ flags: { _ch2_region: "widehanga", _ch2_preparation_started: true } })), 200);
assert.equal(returnFareReserve(save({ flags: { _ch2_region: "dubai" } })), 0);

// ---- ドバイ: シェイクの手紙と往復の切符
{
  const value = save();
  // 最初の手紙は「ドバイへ」を選んだらすぐ読める。
  assert.equal(hasDubaiTicket(value), false);
  assert.deepEqual(dubaiTripStatus(value), { ok: true, letter: "ch5_dubai_letter" });
  receiveDubaiLetter(value);
  assert.equal(value.flags._ch5_dubai_letter, true);
  assert.equal(value.flags._ch5_dubai_letters, 1);
  assert.equal(hasDubaiTicket(value), true);
  assert.deepEqual(dubaiTripStatus(value), { ok: true, letter: null }, "Holding the ticket: no letter to read");
  // 飛ぶと切符を使う（帰りの便も同じ切符）。
  useDubaiTicket(value);
  assert.equal(value.flags._ch5_dubai_flights, 1);
  assert.equal(hasDubaiTicket(value), false);
  // 帰った日から DUBAI_LETTER_DAYS 日後の朝に、次の手紙が届く。
  value.day = 52;
  recordDubaiReturn(value);
  assert.equal(value.flags._ch5_dubai_back_day, 52);
  assert.deepEqual(dubaiTripStatus(value), { ok: false, daysLeft: DUBAI_LETTER_DAYS });
  value.day = 52 + DUBAI_LETTER_DAYS - 1;
  assert.deepEqual(dubaiTripStatus(value), { ok: false, daysLeft: 1 });
  value.day = 52 + DUBAI_LETTER_DAYS;
  assert.deepEqual(dubaiTripStatus(value), { ok: true, letter: DUBAI_LETTER_AGAIN[0] }, "The second letter arrives");
  receiveDubaiLetter(value);
  assert.equal(value.flags._ch5_dubai_letters, 2);
  assert.deepEqual(dubaiTripStatus(value), { ok: true, letter: null });
  // 3通目は別の文面、4通目でまた最初の文面へ（巡回）。
  useDubaiTicket(value); recordDubaiReturn(value); value.day += DUBAI_LETTER_DAYS;
  assert.equal(dubaiTripStatus(value).letter, DUBAI_LETTER_AGAIN[1]);
  receiveDubaiLetter(value); useDubaiTicket(value); recordDubaiReturn(value); value.day += DUBAI_LETTER_DAYS;
  assert.equal(dubaiTripStatus(value).letter, DUBAI_LETTER_AGAIN[0]);
  assert.equal(value.flags._ch5_dubai_flights, 3);
  // 状態は保存に入れて読み戻せる。
  assert.deepEqual(dubaiTripStatus(structuredClone(value)), dubaiTripStatus(value));
}
// 旧保存（切符の記録が無い）: 最初の手紙を読んで、まだ飛んでいなければ同封の切符がある。
assert.equal(hasDubaiTicket(save({ flags: { _ch5_dubai_letter: true } })), true);
assert.deepEqual(dubaiTripStatus(save({ flags: { _ch5_dubai_letter: true } })), { ok: true, letter: null });
// 旧保存（前の決まりで2回目から往復を払っていた・帰った日の記録が無い）: 次の手紙はもう届いている。
assert.deepEqual(dubaiTripStatus(save({ flags: { _ch5_dubai_letter: true, _ch5_dubai_flights: 2 } })),
  { ok: true, letter: DUBAI_LETTER_AGAIN[0] });
// まだドバイにいる旧保存は、帰った日から数え始める。
{
  const value = save({ day: 60, flags: { _ch5_dubai_letter: true, _ch5_dubai_flights: 1, _ch2_region: "dubai" } });
  assert.equal(hasDubaiTicket(value), false);
  recordDubaiReturn(value);
  assert.deepEqual(dubaiTripStatus(value), { ok: false, daysLeft: DUBAI_LETTER_DAYS });
}

console.log("PASS ch5_travel: Tokyo van (free, daytime, two actions, no fare reserve) and Dubai letters (a ticket per letter, next letter after the return)");
