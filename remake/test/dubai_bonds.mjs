// 太陽・シェイクの好感度ルート（2026-11-11 オーナー「ルートを新設」RVE03）: 段階の選び方・記録・締めくくりの前提・手紙・台本・配線。
// node remake/test/dubai_bonds.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DUBAI_BOND_FLAG, DUBAI_BOND_STORIES, pendingAffinityStage } from "../js/core/affinity-stages.js";
import { DUBAI_BOND_FINALES, FESTA_BOND_IDS, SHEIKH_BOND_IDS, SHEIKH_BOND_LETTERS, TAIYO_BOND_IDS, dubaiBondRead, dubaiBondRecord,
  dubaiBondStoriesDone, nextDubaiBondStory, recordDubaiBondRead, recordSheikhBondLetter, sheikhBondLetterDue } from "../js/chapters/dubai-bonds.js";
import { classifyFlag } from "../js/core/carry.js";

const read = rel => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const text = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const byId = name => Object.fromEntries(read(`../../data/dialogue/${name}.json`).dialogues.map(d => [d.dialogue_id, d]));
const save = (extra = {}) => ({ chapter: 5, flags: {}, finales: {}, lovers: [], ...extra });

// ---- 段階: 必要ハートに届いた最古の未読を、その場所だけで選ぶ --------------------------------
{
  const s = save({ chapter: 4 });
  assert.equal(nextDubaiBondStory(s, "da_silva", "festa", 0), null, "♥0 ではまだ段階はない");
  assert.equal(nextDubaiBondStory(s, "da_silva", "festa", 1), "ch4_festa_bond_1");
  assert.equal(nextDubaiBondStory(s, "da_silva", "festa", 5), "ch4_festa_bond_1", "高い♥でも最古の未読から");
  assert.equal(nextDubaiBondStory(s, "da_silva", "courtyard", 5), "ch5_taiyo_bond_4", "中庭では第5章の段階だけ");
  assert.equal(nextDubaiBondStory(s, "sheikh", "festa", 5), null, "シェイクの段階はFESTAに無い");
  assert(recordDubaiBondRead(s, "ch4_festa_bond_1"));
  assert(!recordDubaiBondRead(s, "ch4_festa"), "知らない場面は記録しない");
  assert.equal(nextDubaiBondStory(s, "da_silva", "festa", 1), null, "♥2の段階は♥2から");
  assert.equal(nextDubaiBondStory(s, "da_silva", "festa", 2), "ch4_festa_bond_2");
  assert(dubaiBondRead(s, "ch4_festa_bond_1"));
  // 壊れた保存値は空として読み、例外にしない
  for (const bad of [null, 1, "x", [], { read: [] }, { read: null, letters: 3 }]) {
    const broken = save({ flags: { [DUBAI_BOND_FLAG]: bad } });
    assert.deepEqual(dubaiBondRecord(broken), { read: {}, letters: {} });
    assert.equal(nextDubaiBondStory(broken, "sheikh", "residence", 1), "ch5_sheikh_bond_1");
  }
}

// ---- 締めくくりの前提: 太陽は第5章の段階だけ（FESTAは第4章だけの前日譚）、シェイクは5本すべて -------
{
  const s = save();
  assert(!dubaiBondStoriesDone(s, "da_silva"));
  for (const scene of ["ch5_taiyo_bond_4", "ch5_taiyo_bond_5"]) recordDubaiBondRead(s, scene);
  assert(dubaiBondStoriesDone(s, "da_silva"), "FESTAの段階を読んでいなくても、第5章の段階で締めくくりへ");
  const sheikh = save();
  for (const entry of DUBAI_BOND_STORIES.sheikh.slice(0, 4)) recordDubaiBondRead(sheikh, entry.scene);
  assert(!dubaiBondStoriesDone(sheikh, "sheikh"));
  recordDubaiBondRead(sheikh, DUBAI_BOND_STORIES.sheikh[4].scene);
  assert(dubaiBondStoriesDone(sheikh, "sheikh"));
  assert.deepEqual(DUBAI_BOND_STORIES.sheikh.map(entry => entry.heart), [1, 1, 2, 3, 4]);
  assert(DUBAI_BOND_STORIES.da_silva.filter(entry => entry.where === "festa").every(entry => entry.prelude));
}

// ---- MENU の残件: FESTAの段階は第4章だけ、屋敷の段階は第5章だけ。着地後は残さない -----------------
{
  assert.equal(pendingAffinityStage(save({ chapter: 4 }), "da_silva")?.scene, "ch4_festa_bond_1");
  assert.equal(pendingAffinityStage(save({ chapter: 5 }), "da_silva")?.scene, "ch5_taiyo_bond_4", "第5章ではFESTAの段階を約束しない");
  assert.equal(pendingAffinityStage(save({ chapter: 4 }), "sheikh"), null, "第4章では屋敷の段階を約束しない");
  assert.equal(pendingAffinityStage(save({ chapter: 5 }), "sheikh")?.scene, "ch5_sheikh_bond_1");
  assert.equal(pendingAffinityStage(save({ chapter: 5, finales: { sheikh: { route: "friend" } } }), "sheikh"), null);
}

// ---- シェイクの手紙: 段階の後・締めくくりの後に一度ずつ。読んだ手紙は二度届かない -------------------
{
  const s = save();
  assert.equal(sheikhBondLetterDue(s), null);
  recordDubaiBondRead(s, "ch5_sheikh_bond_1");
  assert.equal(sheikhBondLetterDue(s), null);
  recordDubaiBondRead(s, "ch5_sheikh_bond_2");
  assert.equal(sheikhBondLetterDue(s), "ch5_dubai_letter_bond_1");
  assert(recordSheikhBondLetter(s, "ch5_dubai_letter_bond_1"));
  assert(!recordSheikhBondLetter(s, "ch5_dubai_letter_again"), "いつもの手紙は記録しない");
  assert.equal(sheikhBondLetterDue(s), null);
  for (const scene of ["ch5_sheikh_bond_3", "ch5_sheikh_bond_4"]) recordDubaiBondRead(s, scene);
  assert.equal(sheikhBondLetterDue(s), "ch5_dubai_letter_bond_2");
  recordSheikhBondLetter(s, "ch5_dubai_letter_bond_2");
  assert.equal(sheikhBondLetterDue(s), null);
  s.finales.sheikh = { route: "friend", chapter: 5 };
  assert.equal(sheikhBondLetterDue(s), "ch5_dubai_letter_bond_3");
  recordSheikhBondLetter(s, "ch5_dubai_letter_bond_3");
  assert.equal(sheikhBondLetterDue(s), null);
  assert(dubaiBondRead(s, "ch5_sheikh_bond_4"), "手紙の記録で段階の既読を消さない");
}

// ---- 台本: すべての段階・締めくくり・手紙があり、話者と連絡先の交換がそろっている ----------------------
{
  const taiyo = byId("taiyo_bond"), sheikh = byId("sheikh_bond");
  for (const id of TAIYO_BOND_IDS) assert(taiyo[id]?.lines?.length, `taiyo_bond.json: ${id}`);
  for (const id of SHEIKH_BOND_IDS) assert(sheikh[id]?.lines?.length, `sheikh_bond.json: ${id}`);
  const all = d => [...d.lines, ...Object.values(d.branches || {}).flat()];
  for (const id of TAIYO_BOND_IDS) assert(all(taiyo[id]).some(line => line.speaker === "da_silva"), `${id}: 太陽が話す`);
  for (const id of DUBAI_BOND_STORIES.sheikh.map(entry => entry.scene).concat(DUBAI_BOND_FINALES.sheikh)) {
    assert(all(sheikh[id]).some(line => line.speaker === "sheikh"), `${id}: シェイクが話す`);
  }
  assert.deepEqual(taiyo[DUBAI_BOND_FINALES.da_silva].metadata?.bond_finale, "da_silva");
  assert.deepEqual(sheikh[DUBAI_BOND_FINALES.sheikh].metadata?.bond_finale, "sheikh");
  // 太陽の連絡先はFESTAの♥2の段階で、分岐の外（必ず通る位置）で交換する
  assert(taiyo.ch4_festa_bond_2.lines.some(line => line.type === "set_flag" && line.flag === "_lime_contact_da_silva"));
  // FESTA（大会前）の段階で、審査員だと明かさない（2026-11-07 オーナー指示）
  for (const id of FESTA_BOND_IDS) assert(!/審査/.test(JSON.stringify(all(taiyo[id]))), `${id}: 大会前に審査員だと言わない`);
  assert.deepEqual(SHEIKH_BOND_LETTERS.map(letter => letter.scene), ["ch5_dubai_letter_bond_1", "ch5_dubai_letter_bond_2", "ch5_dubai_letter_bond_3"]);
}

// ---- 配線: 締めくくり・贈り物・前提・保存の分類 ------------------------------------------------------
{
  const bonds = text("../js/daily/bonds.js");
  assert.match(bonds, /da_silva: \{ dialogue: DUBAI_BOND_FINALES\.da_silva, gift: "suyaki_da_silva" \}/);
  assert.match(bonds, /sheikh: \{ dialogue: DUBAI_BOND_FINALES\.sheikh, gift: "suyaki_sheikh" \}/);
  assert.match(bonds, /id === "da_silva" \|\| id === "sheikh" \? dubaiBondStoriesDone\(state, id\)/);
  const gear = read("../../data/equipment.json").equipment;
  const flavors = new Set((read("../../data/flavors.json").flavors || read("../../data/flavors.json")).map(f => f.id));
  for (const [id, who, flavor] of [["suyaki_da_silva", "da_silva", "passion_fruit"], ["suyaki_sheikh", "sheikh", "grape"]]) {
    const gift = gear.find(e => e.id === id);
    assert.equal(gift?.gift?.from, who, id);
    assert.equal(gift.gift.flavor, flavor, id);
    assert(flavors.has(flavor), `${id}: ${flavor} is a real flavor`);
    assert(gift.unsellable && gift.not_for_sale && gift.art === "suyaki_hagal", id);
  }
  assert.equal(classifyFlag(DUBAI_BOND_FLAG), "progression");
  assert.equal(classifyFlag("_lime_contact_da_silva"), "person");
  const ch4 = text("../js/chapters/ch4-dubai-daily.js"), ch5 = text("../js/chapters/ch5-dubai.js");
  assert.match(ch4, /readDialogues\("taiyo_bond", FESTA_BOND_IDS\)/);
  assert.match(ch4, /visitAffinity\(festaBond \? "story" : "talk"\)/);
  assert.match(ch5, /readDialogues\("sheikh_bond", SHEIKH_BOND_IDS\), readDialogues\("taiyo_bond", TAIYO_BOND_IDS\)/);
  assert.match(ch5, /sheikhBondLetterDue\(state\)/);
}

console.log("PASS dubai bonds: stage order per place, records, finale prerequisites, MENU stages, Sheikh letters, scripts, wiring");
