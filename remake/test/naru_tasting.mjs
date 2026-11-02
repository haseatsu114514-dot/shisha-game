import assert from "node:assert/strict";
import fs from "node:fs";
import { DB } from "../js/core/data.js";
import { temperatureBands } from "../js/craft/temperature-model.js";
import { naruTastingCategory, naruTastingLine } from "../js/craft/naru-tasting.js";
import { recognitionId } from "../js/craft/recognition.js";
import { tournamentStoryDialogue } from "../js/craft/tournament-story-data.js";

// 審査待ちのなるの一言が、提供＋2回調整の実績区分と一致すること。直前の試飲演出とも食い違わないこと。
DB.flavorById = { lemon: { short_name: "AF レモン", heat_tolerance: 1 }, mint: { short_name: "AF ミント", heat_tolerance: 1 } };
Object.assign(DB.dialogues, Object.fromEntries(
  JSON.parse(fs.readFileSync(new URL("../../data/dialogue/tournament_craft.json", import.meta.url))).dialogues.map(d => [d.dialogue_id, d])));

const base = { chapter: 1, mix: { lemon: 8, mint: 4 }, pack: "normal", tournamentStory: { servedAroma: 85, seen: [] } };
const b = temperatureBands(base);
const good = { temp: b.center, score: 90 }, hot = { temp: b.ideal[1] + 0.02, score: 70 }, cold = { temp: b.ideal[0] - 0.02, score: 40 };
const tastingText = cs => tournamentStoryDialogue(cs, "tasting").lines.map(l => l.text).join("\n");

// 代表3種＋中立の区分判定。
const steady = { ...base, pull: good, careHistory: [good, good] };
const recovered = { ...base, pull: cold, careHistory: [cold, good] };
const offbandHot = { ...base, pull: good, careHistory: [good, hot] };
const offbandCold = { ...base, pull: good, careHistory: [good, cold] };
const legacy = { ...base, pull: good, careHistory: [good] }; // 旧セーブ・記録不足

assert.equal(naruTastingCategory(steady), "steady");
assert.equal(naruTastingCategory(recovered), "recovered");
assert.equal(naruTastingCategory(offbandHot), "offband");
assert.equal(naruTastingCategory(offbandCold), "offband");
assert.equal(naruTastingCategory(legacy), "unknown");
assert.equal(naruTastingCategory({}), "unknown");
assert.equal(naruTastingCategory(), "unknown");

// recognitionId の安定／立て直しと同じ出来事を逆に評さない。
assert.equal(recognitionId(steady), "steady");
assert.equal(recognitionId(recovered), "recovered");
assert.notEqual(recognitionId(offbandHot), "steady");
assert.notEqual(recognitionId(offbandHot), "recovered");

// 直前の試飲演出（tournamentStoryDialogue "tasting"）の care 判定と食い違わない。
assert.match(tastingText(steady), /最後まで届けた/);
assert.match(tastingText(recovered), /最後の調整で戻した/);
assert.match(tastingText(offbandHot), /最後の調整は熱が強い/);
assert.match(tastingText(offbandCold), /最後の調整は熱が足りない/);
assert.match(tastingText(legacy), /提供後の変化/);

// 区分ごとに別の台詞が出る。中立文は品質を捏造しない。
const lines = [steady, recovered, offbandHot, legacy].map(naruTastingLine);
assert.equal(new Set(lines).size, 4, "安定／立て直し／終盤帯外／記録不足は別の一言");
assert.equal(naruTastingLine(legacy), naruTastingLine({}));
assert.match(naruTastingLine(steady), /最後まで熱を保った/);
assert.match(naruTastingLine(recovered), /そこから戻したの、見てたよ/);
assert.match(naruTastingLine(offbandHot), /まだ詰められる/);
assert.match(naruTastingLine(legacy), /結果が出たら、また話そうぜ/);
// 中立文は安定や立て直しのような品質の断定を含まない。
for (const w of ["保った", "戻した", "詰められる"]) assert(!naruTastingLine(legacy).includes(w));

// 台詞の体裁（lint 準拠）：末尾「。」なし・「。」3個未満・全角48字以内・旧名/略記なし。
for (const line of [...lines]) {
  assert(!/。$/.test(line.replace(/[」』）]+$/, "")), `台詞の末尾は「。」なし: ${line}`);
  assert((line.match(/。/g) || []).length < 3, `「。」は3個未満: ${line}`);
  const flen = [...line].reduce((n, ch) => n + (ch.charCodeAt(0) <= 0xff ? 0.5 : 1), 0);
  assert(flen <= 48, `全角48字以内: ${line}`);
  for (const bad of ["にしお", "ましろさん", "技術力", "洞察力"]) assert(!line.includes(bad));
}

// セッションを書き換えない。
const snapshot = JSON.stringify(steady);
naruTastingLine(steady);
assert.equal(JSON.stringify(steady), snapshot, "評価の生成でセッションを変えない");

console.log("PASS: naru tasting line matches steady/recovered/offband/unknown, agrees with recognitionId and tasting, neutral old-save");
