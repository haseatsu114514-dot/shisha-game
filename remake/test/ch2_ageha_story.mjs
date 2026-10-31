// 第2章のあげは（#626）: 強制の夜・店に通う回の順番・ダメな日・答え合わせ・試煙会の配合・LIME・控室の分岐。
import assert from "node:assert/strict";
import fs from "node:fs";
import { CITY_BACKGROUNDS } from "../js/core/city-locations.js";
import { CH2_NIGHTS, AGEHA_VISITS, AGEHA_BADDAY, C_STATION_TASTING_BG, agehaStoryScene, syncAgehaVibes } from "../js/chapters/ch2-story-data.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const story = Object.fromEntries(read("data/dialogue/ch2_ageha_story.json").dialogues.map((d) => [d.dialogue_id, d]));

// 強制の夜: 3日目（なるの祝福のあと）の偵察返し・9日目の試煙会・10日目のスランプ来店。
// 2日目と8日目（サメのTRPG）は自由に使える夜として空けたまま（#639）
const night = (day) => CH2_NIGHTS.find((n) => n.day === day);
assert.deepEqual(night(3).steps.map((s) => s.id), ["ch2_naru_warm", "remake_ch2_ageha_scout"]);
// 連絡先は台本の set_flag で交換する（交換の演出が出る・#2023）。偵察の夜も店の初回も、つながっていない時だけ
assert.equal(night(3).steps[1].contact, undefined, "コードで連絡先を付けない");
assert.equal(night(3).steps[1].met, "ageha", "偵察の夜に会ったら面識を記録する");
{
  const chat = read("data/dialogue/ch2_preparation.json").dialogues.find((d) => d.dialogue_id === "remake_ch2_ageha_chat");
  for (const d of [story.remake_ch2_ageha_scout, chat]) {
    const cond = d.lines.find((l) => l.type === "condition" && l.flag === "_lime_contact_ageha");
    assert(cond && d.branches[cond.next_false], `${d.dialogue_id}: 未交換の分岐`);
    assert(d.branches[cond.next_false].some((l) => l.type === "set_flag" && l.flag === "_lime_contact_ageha"), d.dialogue_id);
    assert(!d.lines.some((l) => l.type === "set_flag" && l.flag === "_lime_contact_ageha"), `${d.dialogue_id}: 交換済みなら交換し直さない`);
    if (cond.next_true) assert(!d.branches[cond.next_true].some((l) => l.type === "set_flag"), d.dialogue_id);
  }
}
assert(!night(2), "2日目は自由な夜");
assert.deepEqual(night(9).steps.map((s) => s.id), ["remake_ch2_ageha_tasting", "ch2_strawberry_sample"]);
// 9日目はMELTY PUFFではなくC.STATION柚ヶ谷店の客席（#929）。旧IDのまま読了フラグを引き継ぐ
assert.equal(night(9).pin, "ch2_c_station");
assert.equal(night(9).steps[0].room, undefined);
assert.equal(night(9).steps[0].bg, C_STATION_TASTING_BG);
assert.equal(C_STATION_TASTING_BG, CITY_BACKGROUNDS.c_station_night, "柚ヶ谷店の客席の夜景を使う");
assert.match(C_STATION_TASTING_BG, /bg_yuzugaya_c_station_night\.webp$/, "地元店や県大会ホールの背景と区別する");
assert.notEqual(C_STATION_TASTING_BG, CITY_BACKGROUNDS.c_station, "昼の通常訪問用背景を変えない");
assert.doesNotMatch(night(9).label, /試飲|店長同士/);
assert.deepEqual(night(10).steps.map((s) => s.id), ["remake_ch2_ageha_slump", "ch2_sumi_silence"]);
// #1733: 閉店間際のtonariであげはと会い、駅まで送ってから灯りの落ちた店へ戻る（帰宅後に引き返して終電後に会う順にしない）
{
  const silence = read("data/dialogue/ch2_main.json").dialogues.find((d) => d.dialogue_id === "ch2_sumi_silence");
  assert.match(story.remake_ch2_ageha_slump.lines[0].text, /閉店間際のtonari/);
  assert.doesNotMatch(story.remake_ch2_ageha_slump.lines.map((l) => l.text).join("\n"), /家に着いても|引き返した/);
  assert.match(silence.lines[0].text, /あげはを駅まで送った。終電には、まだ間に合った/);
  assert.match(silence.lines[1].text, /^店へ戻ると/);
}
assert(!night(8), "8日目はサメのTRPG参加日");
for (const step of CH2_NIGHTS.flatMap((n) => n.steps).filter((s) => s.file === "ch2_ageha_story")) assert(story[step.id], step.id);

// 店に通う回: 7日目より前はギャル友→初めての客→雑誌取材の順、7日目以降はダメな日が先。全部読んだら null
const save = { flags: {}, affinity: {ageha:66} };
assert.equal(agehaStoryScene(save, 3, story), AGEHA_VISITS[0]);
assert.equal(agehaStoryScene(save, 7, story), AGEHA_BADDAY.id);
for (const id of [AGEHA_BADDAY.id, ...AGEHA_VISITS]) {
  assert.equal(agehaStoryScene(save, 9, story), id);
  save.flags[`_ch2_read_${id}`] = true;
}
assert.equal(agehaStoryScene(save, 9, story), null);
assert.equal(agehaStoryScene({ flags: {} }, 9, {}), null, "台本が無ければいつもの会話");

// 各♥段階と次の実会話を対応させる。高値の旧保存も未読順を飛ばさない。
for (const [index,id] of AGEHA_VISITS.entries()) {
  const thresholds=[0,9,20,33,48,66], flags={};
  for(const prev of AGEHA_VISITS.slice(0,index)) flags[`_ch2_read_${prev}`]=true;
  assert.equal(agehaStoryScene({flags,affinity:{ageha:thresholds[index+2]-1}},3,story),null);
  assert.equal(agehaStoryScene({flags,affinity:{ageha:thresholds[index+2]}},3,story),id);
}
assert.equal(agehaStoryScene({flags:{},affinity:{ageha:66}},3,{[AGEHA_VISITS[1]]:story[AGEHA_VISITS[1]]}),null,"欠落した前段を飛ばさない");

// ♥3の分岐（#1988）: 「初めての客」の直後に恋愛／友情の二択。選択肢は返答の台詞だけで、関係名の札を付けない
{
  const q = story.ch2_ageha_bond_question;
  assert(q?.lines?.length, "ch2_ageha_bond_question exists");
  const ids = read("data/dialogue/ch2_ageha_story.json").dialogues.map((d) => d.dialogue_id);
  assert.equal(ids.indexOf("ch2_ageha_bond_question"), ids.indexOf("remake_ch2_ageha_newcomer") + 1);
  const choice = q.lines.find((l) => l.type === "choice");
  assert.equal(choice.id, "bond_q1_ageha"); assert.equal(choice.romance_char, "ageha");
  assert.deepEqual(choice.choices.map((c) => c.romance), [1, 0]);
  for (const c of choice.choices) {
    assert(q.branches[c.next]?.length, c.next);
    assert.doesNotMatch(c.text, /恋愛|友情|友達として/, "no relationship labels on the choice");
    assert([...c.text].reduce((n, ch) => n + (ch.charCodeAt(0) < 128 ? .5 : 1), 0) <= 26, c.text);
  }
  const all = [...q.lines, ...Object.values(q.branches).flat()];
  assert(!all.some((l) => l.type === "apply" || l.type === "set_flag"), "the answer is the only record");
  assert.doesNotMatch(all.map((l) => l.text || "").join("\n"), /大会|本番|いよいよ/, "no tournament-bound wording");
}

// ♥5（#2023）: 白・赤のグミベアの試作が最後の通う回で、味の会話を兼ねる。締めくくりは専用ハガルを渡し、大会の前後で分岐する
{
  assert.equal(AGEHA_VISITS.at(-1), "remake_ch2_ageha_gummy");
  const gummy = story.remake_ch2_ageha_gummy;
  assert.deepEqual(gummy.metadata.flavor_lesson, { white_gummy_bear: 1, red_gummy_bear: 1 });
  const choice = gummy.lines.find((l) => l.type === "choice");
  for (const c of choice.choices) assert(gummy.branches[c.next]?.length, c.next);
  assert(gummy.lines.some((l) => l.type === "condition" && l.flag === "_ch2_ageha_secret" && gummy.branches[l.next_true]));
  const gummyText = [...gummy.lines, ...Object.values(gummy.branches).flat()].map((l) => l.text || "").join("\n");
  assert.doesNotMatch(gummyText, /大会|本番|いよいよ|病院/, "大会の前後どちらでも読め、病気の理由を先取りしない");

  const finale = story.ch2_ageha_bond_finale;
  assert.equal(finale.metadata.bond_finale, "ageha");
  const when = finale.lines.find((l) => l.type === "condition" && l.condition_type === "tournament_finished");
  assert.equal(when.tournament_chapter, 2);
  assert(finale.branches[when.next_true]?.length && finale.branches[when.next_false]?.length, "大会前／大会後");
  assert.doesNotMatch(finale.branches[when.next_true].map((l) => l.text || "").join("\n"), /大会前|いよいよ|明日/);
  const route = finale.lines.find((l) => l.type === "condition" && l.condition_type === "romance_open");
  assert.equal(route.char_id, "ageha");
  assert(finale.branches[route.next_true]?.length && finale.branches[route.next_false]?.length);
  const all = [...finale.lines, ...Object.values(finale.branches).flat()];
  assert(!all.some((l) => l.type === "choice"), "方向は♥3の答えで決まり、最後の質問を置かない");
  assert(!all.some((l) => l.type === "set_flag"), "受け取りと記録は bonds.js の playFinale だけ");
  const gift = read("data/equipment.json").equipment.find((e) => e.id === "suyaki_ageha");
  assert.equal(gift.gift.from, "ageha"); assert.equal(gift.gift.flavor, "white_gummy_bear");
  assert(gift.unsellable && gift.not_for_sale);
}

// 答え合わせ: 2回当てたら試煙会で不安を話す
const flags = { _ch2_vibes_hit_scout: true };
assert.equal(syncAgehaVibes(flags), 1); assert(!flags._ch2_vibes_understood);
flags._ch2_vibes_hit_magazine = true;
assert.equal(syncAgehaVibes(flags), 2); assert(flags._ch2_vibes_understood);

// 各回の答え合わせ: 選択肢の行き先がそろい、当たりの枝だけが当たりの印を付ける（♥5のグミベアの回は答え合わせではない）
const vibesVisits = AGEHA_VISITS.filter((id) => id !== "remake_ch2_ageha_gummy");
assert.deepEqual(vibesVisits, ["remake_ch2_ageha_gyaru", "remake_ch2_ageha_newcomer", "remake_ch2_ageha_magazine"]);
for (const id of ["remake_ch2_ageha_scout", ...vibesVisits]) {
  const d = story[id];
  const choice = d.lines.find((l) => l.type === "choice");
  for (const c of choice.choices) assert(d.branches[c.next], `${id}: ${c.next}`);
  const marks = Object.entries(d.branches).filter(([, lines]) => lines.some((l) => l.type === "set_flag" && l.flag.startsWith("_ch2_vibes_hit_")));
  assert.deepEqual(marks.map(([k]) => k), ["hit"], id);
}
// ダメな日で秘密を知る。試煙会・スランプ・控室はそれで分岐する
assert(story[AGEHA_BADDAY.id].lines.some((l) => l.type === "set_flag" && l.flag === "_ch2_ageha_secret"));
for (const id of ["remake_ch2_ageha_tasting", "remake_ch2_ageha_slump"]) {
  assert(story[id].lines.some((l) => l.type === "condition" && l.flag === "_ch2_ageha_secret" && story[id].branches.secret), id);
}
const lobby = read("data/dialogue/ch2_tournament.json").dialogues.find((d) => d.dialogue_id === "ch2_tournament_lobby");
assert(lobby.lines.some((l) => l.flag === "_ch2_ageha_secret") && lobby.branches.secret.length);

// 試煙会の配合: こはくのひらめきと同じ印で「試したい配合」に入る
const tasting = story.remake_ch2_ageha_tasting;
const note = tasting.lines.find((l) => l.type === "note");
const recipe = read("data/recipes.json").recipes.find((r) => `idea_${r.id}` === note.note_id);
assert.deepEqual(recipe?.flavors, ["mango", "peach", "mint"]);

// 試煙会（#929）: 第1章・第2章のライバル6人とはじめが全員話す。会場・メーカー・課題の葉を本文で示し、旧会場を残さない
const allLines = [...tasting.lines, ...Object.values(tasting.branches).flat()];
const text = allLines.map((l) => l.text || "").join("\n");
const mainSpeakers = new Set(tasting.lines.map((l) => l.speaker));
for (const id of ["hajime", "naru", "adam", "minto", "ageha", "kumicho", "rei"]) assert(mainSpeakers.has(id), `試煙会で ${id} が話す`);
assert.match(text, /C\.STATION柚ヶ谷店/); assert.match(text, /アフサール/); assert.match(text, /ストロベリー/);
assert.doesNotMatch(text, /試飲会|店長同士|MELTY PUFFの客席|夜のMELTY PUFF/);
for (const id of ["ageha", "kumicho", "rei"]) {
  const cond = tasting.lines.find((l) => l.type === "condition" && l.condition_type === "met" && l.char_id === id);
  assert(tasting.branches[cond.next_true] && tasting.branches[cond.next_false], `${id}: 面識あり／なし`);
  assert(tasting.branches[cond.next_false].some((l) => l.type === "set_flag" && l.flag === `_met_${id}`), `${id}: 名乗ったら面識を記録`);
  assert(!tasting.branches[cond.next_true].some((l) => l.type === "set_flag"), `${id}: 既知なら何も足さない`);
}
const turn = tasting.lines.find((l) => l.type === "choice");
for (const c of turn.choices) assert(tasting.branches[c.next], c.next);
assert(!allLines.some((l) => l.type === "apply"), "強制の夜に能力・好感度の報酬を付けない");
assert(tasting.lines.some((l) => l.type === "set_flag" && l.flag === "_ch2_afsahr_tasting"));

// 課題の葉: 支給はアフサールの新作。判定は苺の系統で、AFの持ち込みも数える（旧在庫を壊さない）
const flavors = Object.fromEntries(read("data/flavors.json").flavors.map((f) => [f.id, f]));
const steps = fs.readFileSync(new URL("../js/craft/steps.js", import.meta.url), "utf8");
assert.match(steps, /2: \{ flavor: "strawberry", supply: "afsahr_strawberry"/);
assert.equal(flavors.afsahr_strawberry.maker, "afsahr");
assert.equal(flavors.afsahr_strawberry.family, "strawberry");
assert.equal(flavors.afsahr_strawberry.name, "アフサール ストロベリー");
assert(flavors.afsahr_strawberry.heat_tolerance < 1, "熱に弱い（試煙会の神崎の助言と一致）");
assert.equal(flavors.strawberry.maker, "af", "既存のAFストロベリーは上書きしない");

// 朝のLIME: 第2章の章内日で届く（4日目は感覚ある日、7日目はダメな日）。返信は19字まで
const lime = read("data/lime_messages.json").messages;
for (const [id, day] of [["lime_ageha_ch2_goodday", 4], ["lime_ageha_ch2_badday", 7]]) {
  const m = lime.find((x) => x.id === id);
  assert.equal(m.chapter, 2, id); assert.equal(m.trigger_day, day, id);
  for (const r of m.replies || []) assert([...r.text].reduce((n, c) => n + (c.charCodeAt(0) < 128 ? .5 : 1), 0) <= 19, r.text);
}
console.log("[ch2 ageha] PASS: forced nights, visit order, bad day, vibes, secret branches, C.STATION tasting, supplied strawberry, recipe, LIME");

// 第2章の人間関係の改稿（#929）も同じquick検査で確かめる（tools/ci を変えると全ブラウザ検査が走るため、ここから実行する）
await import("./ch2_relationships_929.mjs");
