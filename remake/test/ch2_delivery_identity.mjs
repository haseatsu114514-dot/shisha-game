// #1081 C05/J05: 第2章配達の面識（met）と名前表示の整合。経済・時間・好感度には触れない純関数の検査。
// node remake/test/ch2_delivery_identity.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DELIVERY_STOPS,
  snapshotDeliveryIdentity,
  confirmDeliveryIdentity,
  reconcileDeliveryIdentity,
  deliveryPending,
  finishChapterTwoDelivery,
} from '../js/chapters/ch2-deliveries.js';

let count = 0;
function check(name, fn) { fn(); count++; console.log('PASS ' + name); }

const fresh = () => ({ chapter: 2, day: 1, slot: 0, met: {}, flags: { _ch2_deliveries: { accepted: true, done: {} } },
  money: 9000, stamina: 75, affinity: {}, relationshipMemories: [] });

// 配達先は3軒で、id がそのまま char_id（_met_<id> / met[<id>]）。
check('delivery stops are the three shop owners', () => {
  assert.deepEqual(DELIVERY_STOPS, ['ageha', 'kumicho', 'rei']);
});

// snapshot→(完読せず中断)→restore：会話中に付いた面識とカットインだけ巻き戻す。
check('restore rolls back identity written mid-scene when read is not completed', () => {
  const v = fresh();
  for (const id of DELIVERY_STOPS) {
    const before = JSON.parse(JSON.stringify(v));
    const restore = snapshotDeliveryIdentity(v, id);
    // VNが名乗り（set_flag _met_）とカットイン（_intro_）を書いた後に中断した状態を模す。
    v.met[id] = true; v.flags[`_met_${id}`] = true; v.flags[`_intro_${id}`] = true; v.flags[`_intro_${id}_known`] = true;
    restore();
    assert.deepEqual(v, before, `restore left residue for ${id}`);
    assert.equal(v.met[id], undefined);
    assert.equal(v.flags[`_met_${id}`], undefined);
    assert.equal(v.flags[`_intro_${id}`], undefined);
  }
});

// 既存の面識・他人の面識・関係の記録は巻き戻しで壊さない。
check('restore keeps prior own/other identities and relationship history', () => {
  const v = fresh();
  v.met.ageha = true; v.flags._met_ageha = true; v.flags._intro_ageha = true; // 既に会っている（再訪）
  v.met.sumi = true; v.flags._met_sumi = true;                                 // 別人の面識
  v.relationshipMemories = ['rel_ageha_1'];
  const restore = snapshotDeliveryIdentity(v, 'ageha');
  v.flags._intro_ageha_rare = true; // 会話中に増えた別variant
  restore();
  assert.equal(v.met.ageha, true);
  assert.equal(v.flags._met_ageha, true);
  assert.equal(v.flags._intro_ageha, true);
  assert.equal(v.flags._intro_ageha_rare, undefined);
  assert.equal(v.met.sumi, true);
  assert.deepEqual(v.relationshipMemories, ['rel_ageha_1']);
});

// confirm：完読で面識と名前表示を確定。初回だけ changed=true、二度目は false（二重付与なし）。
check('confirm commits identity once and is idempotent', () => {
  const v = fresh();
  assert.equal(confirmDeliveryIdentity(v, 'rei'), true);
  assert.equal(v.met.rei, true);
  assert.equal(v.flags._met_rei, true);
  assert.equal(confirmDeliveryIdentity(v, 'rei'), false, 'second read must not re-grant');
  assert.equal(confirmDeliveryIdentity(v, 'c_station'), false, 'venue is not a character');
  assert.equal(v.met.c_station, undefined);
});

// 完読の正常系：snapshot→confirm で面識が残る（中断用の巻き戻しは呼ばない）。
check('completed read keeps identity (snapshot then confirm)', () => {
  const v = fresh();
  const restore = snapshotDeliveryIdentity(v, 'kumicho');
  v.met.kumicho = true; v.flags._met_kumicho = true; v.flags._intro_kumicho = true; // VNが書いた
  // 完読したので restore は呼ばず confirm で確定。
  confirmDeliveryIdentity(v, 'kumicho');
  void restore;
  assert.equal(v.met.kumicho, true);
  assert.equal(v.flags._met_kumicho, true);
  assert.equal(v.flags._intro_kumicho, true);
});

// SAVE移行：配達済みなのに面識が付いていない（＝「？」のまま）を読み込み時に整合。好感度は不変。
check('reconcile fixes delivered-but-unmet saves without touching affinity', () => {
  const v = fresh();
  v.flags._ch2_deliveries.done = { ageha: true, rei: true }; // 2軒配達済み・kumicho未
  v.affinity = { ageha: 42 };
  assert.equal(reconcileDeliveryIdentity(v), true);
  assert.equal(v.met.ageha, true); assert.equal(v.flags._met_ageha, true);
  assert.equal(v.met.rei, true); assert.equal(v.flags._met_rei, true);
  assert.equal(v.met.kumicho, undefined, 'undelivered stop stays unmet');
  assert.deepEqual(v.affinity, { ageha: 42 }, 'affinity untouched');
  assert.equal(reconcileDeliveryIdentity(v), false, 'idempotent once reconciled');
});

check('reconcile is a no-op when deliveries never accepted', () => {
  const v = { chapter: 2, met: {}, flags: {} };
  assert.equal(reconcileDeliveryIdentity(v), false);
  assert.deepEqual(v.met, {});
});

// deliveryPending/finish との整合：配達完了後は pending でなくなり、二度目の完了はしない。
check('delivery pending flips off exactly once after finish', () => {
  const v = fresh();
  assert.equal(deliveryPending(v, 'ageha'), true);
  assert.equal(finishChapterTwoDelivery(v, 'ageha'), true);
  assert.equal(deliveryPending(v, 'ageha'), false);
  assert.equal(finishChapterTwoDelivery(v, 'ageha'), false, 'cannot finish twice');
});

// 台詞側の保険（会話中の名前表示）: 各 ch2_city_<id> の初対面分岐に set_flag _met_<id> が残っている。
// 配達台詞自体は面識・報酬を確定しない（engine/イベント側に一本化）。
check('city greeting scripts still reveal names in-scene; delivery scripts commit nothing', () => {
  const city = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch2_city.json', import.meta.url), 'utf8')).dialogues;
  const deliveries = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch2_deliveries.json', import.meta.url), 'utf8')).dialogues;
  const byId = (list, id) => list.find(s => s.dialogue_id === id);
  for (const id of DELIVERY_STOPS) {
    const greet = byId(city, `ch2_city_${id}`);
    assert(greet, `missing ch2_city_${id}`);
    const lines = [...(greet.lines || []), ...Object.values(greet.branches || {}).flat()];
    assert(lines.some(l => l.type === 'set_flag' && l.flag === `_met_${id}`),
      `ch2_city_${id} lost its _met_${id} reveal`);
    const handoff = byId(deliveries, `remake_ch2_delivery_${id}`);
    assert(handoff, `missing remake_ch2_delivery_${id}`);
    for (const l of handoff.lines || []) {
      assert(!['set_flag', 'affinity', 'money', 'stats'].includes(l.type),
        `delivery handoff for ${id} must not commit identity or rewards`);
    }
  }
});

// #1706: 配達で来た初対面は別れ際を読まずに受け渡しへ続く。別れ際は ch2_city_<id>_farewell へ切り出し、
// 初対面分岐の末尾 jump だけを ch2.js が外す。配達の報告は夜の会話（day1_night）の中で読む。
check('greeting farewell is a separate jump; delivery report lives inside the night talk', () => {
  const city = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch2_city.json', import.meta.url), 'utf8')).dialogues;
  const deliveries = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch2_deliveries.json', import.meta.url), 'utf8')).dialogues;
  const night = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/remake_ch2.json', import.meta.url), 'utf8')).dialogues
    .find(s => s.dialogue_id === 'remake_ch2_day1_night');
  for (const id of DELIVERY_STOPS) {
    const first = city.find(s => s.dialogue_id === `ch2_city_${id}`).branches.first;
    assert.deepEqual(first.at(-1), { type: 'jump', next_id: `ch2_city_${id}_farewell` });
    assert(first.filter(l => l.type === 'jump').length === 1, `ch2_city_${id} has one farewell jump`);
    assert(city.find(s => s.dialogue_id === `ch2_city_${id}_farewell`)?.lines.length, `missing ch2_city_${id}_farewell`);
    const handoff = deliveries.find(s => s.dialogue_id === `remake_ch2_delivery_${id}`).lines;
    assert(!handoff[0].text.startsWith('それと'), `delivery for ${id} must not reopen a closed greeting`);
  }
  assert.equal(deliveries.some(s => s.dialogue_id === 'remake_ch2_delivery_report'), false);
  assert(night.lines.some(l => l.type === 'condition' && l.flag === '_ch2_deliveries' && l.next_true === 'deliveries'));
  assert(night.branches.deliveries.some(l => /荷物をお渡ししました/.test(l.text || '')));
});

console.log(`ch2 delivery identity: ${count} checks PASS; real AUTO/SKIP/LOAD not run`);
