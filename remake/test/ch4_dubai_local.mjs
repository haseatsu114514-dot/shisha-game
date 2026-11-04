// 第4章ドバイの街の手触り（2026-11-02 オーナー「2以外は採用」）: 昼の屋外の暑さ・夜がにぎわう店・スークの屋台・ディルハム。
// DOM を持たない判定・記録と、台本・行き先の値のつながり。実際の画面の流れは remake/test/browser/ch4_dubai_daily.mjs。
// node remake/test/ch4_dubai_local.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { YEN_PER_DIRHAM, dirhamOf, dirhamText, priceText, dubaiDaytime, DUBAI_HEAT, dubaiSpotAt,
  DUBAI_NIGHT_PLACES, NIGHT_SCENE_IDS, NIGHT_FLAG, nightSceneId, dubaiNights, nightVisit, recordNightVisit,
  STALL_MENU, STALL_NONE, STALL_PLACE, STALL_SCENE_IDS, stallSceneId, stallLabel, stallChoices, stallItem } from "../js/chapters/ch4-dubai-local.js";
import { classifyFlag, flagVerdict } from "../js/core/carry.js";

const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const json = rel => JSON.parse(read(rel));
const daily = Object.fromEntries(json("../../data/dialogue/ch4_dubai_daily.json").dialogues.map(d => [d.dialogue_id, d]));
const spots = Object.fromEntries(json("../../data/dialogue/ch4_spots.json").dialogues.map(d => [d.dialogue_id, d]));
const main = Object.fromEntries(json("../../data/dialogue/ch4_main.json").dialogues.map(d => [d.dialogue_id, d]));
const dailySource = read("../js/chapters/ch4-dubai-daily.js");
const fullwidth = text => [...text].reduce((sum, ch) => sum + (ch.codePointAt(0) <= 0xff ? 0.5 : 1), 0);

// ---- ディルハム（1ディルハム≒43.5円。DBS02 の相場と同じ） --------------------------------------------
assert.equal(YEN_PER_DIRHAM, 43.5);
assert.deepEqual([6000, 3000, 500, 100].map(dirhamOf), [140, 70, 10, 2], "専門店・カフェ・屋台の値段のおおよそ");
assert.equal(dirhamOf(0), 0);
assert.equal(dirhamText(3000), "約70ディルハム");
assert.equal(priceText(6000), "6,000円（約140ディルハム）");
// 地図の説明の値段は、円とおおよそのディルハムを両方書く（値段は DBS02 のまま）
for (const [id, cost] of [["ch4_dubai_festa", 6000], ["ch4_dubai_cafe", 3000], ["ch4_dubai_alley", 3000], ["ch4_dubai_longlong", 6000]]) {
  assert.match(dailySource, new RegExp(`id: "${id}"[^}]*cost: ${cost},`), `${id} は一台 ${cost}円のまま`);
  const desc = new RegExp(`id: "${id}"[^}]*desc: "([^"]*)"`).exec(dailySource)[1];
  assert(desc.includes(`一台${priceText(cost)}`), `${id} の説明に ${priceText(cost)}`);
}
assert.match(read("../js/chapters/ch5-dubai.js"), /id: "ch5_dubai_alley"[^}]*cost: 3000,[^}]*desc: "[^"]*一台3,000円（約70ディルハム）/, "第5章の路地裏のカフェも同じ書き方");
// 中心地のカフェの最初の場面: はじめが現地の値段を円に直す
assert(spots.ch4_dubai_cafe.lines.some(line => line.speaker === "hajime" && line.text.includes(`一台${dirhamOf(3000)}ディルハム、3,000円くらい`)));
assert.match(dailySource, /お金が足りない（\$\{priceText\(entry\.cost\)\}）/, "足りない時の値段もディルハムを添える");

// ---- 暑さ（昼の屋外） ------------------------------------------------------------------------
assert.equal(dubaiDaytime(0), true); assert.equal(dubaiDaytime(undefined), true); assert.equal(dubaiDaytime(1), false);
assert.deepEqual(Object.keys(DUBAI_HEAT), ["souq", "creek"], "昼の屋外はスークとクリーク沿い（屋内・砂丘・ラクダレースは足さない）");
const base = (place, stamina) => Object.freeze({ id: `x_${place}`, place, stamina, desc: "説明。", hasNew: () => true });
const souq = base("souq", -10), creek = base("creek", 20), cafe = base("center_cafe", -10);
const souqDay = dubaiSpotAt(souq, 0), creekDay = dubaiSpotAt(creek, 0);
assert.equal(souqDay.stamina, -15, "昼のスークは体力を多めに使う（-10→-15）");
assert.equal(creekDay.stamina, 12, "昼のクリーク沿いは夜ほど休まらない（+20→+12）");
assert.equal(souqDay.desc, `説明。${DUBAI_HEAT.souq.desc}`);
assert.equal(souqDay.heat, "昼の暑さで、いつもより体力を使った");
assert.equal(creekDay.heat, "昼の日差しで、夜ほどは休めなかった");
assert(Object.isFrozen(souqDay) && souqDay.hasNew() === true && souqDay.id === souq.id, "行き先の写し（印・id はそのまま）");
assert.equal(dubaiSpotAt(souq, 1), souq, "夜はそのまま"); assert.equal(dubaiSpotAt(creek, 1), creek);
assert.equal(dubaiSpotAt(cafe, 0), cafe, "屋内の行き先は昼もそのまま");
assert.equal(dubaiSpotAt(undefined, 0), undefined, "見つからない行き先はそのまま（砂丘などの解決へ進む）");
assert.equal(souq.stamina, -10, "元の行き先は変えない");
// 地図と行き先の解決の両方で、今の時間の行き先を使う
assert.match(dailySource, /\}\)\.map\(spotNow\);/);
assert.match(dailySource, /spotNow\(CH4_DUBAI_SPOTS\.find\(entry => entry\.id === id\)\) \|\| desertDailySpotById\(state, dubaiDay\(\), id\)/);
assert.match(dailySource, /if \(entry\.heat\) toast\(entry\.heat\);/);
for (const place of ["souq", "creek"]) assert.match(dailySource, new RegExp(`place: "${place}"[^}]*stamina: ${place === "souq" ? -10 : 20},`), `${place} の夜の値は今までどおり`);

// ---- 夜がにぎわう店 ------------------------------------------------------------------------
assert.deepEqual([...DUBAI_NIGHT_PLACES], ["festa", "center_cafe", "alley_cafe", "longlong"]);
assert.deepEqual([...NIGHT_SCENE_IDS], DUBAI_NIGHT_PLACES.map(nightSceneId));
const value = { day: 50, slot: 0, flags: {} };
assert.equal(nightVisit(value, "festa"), null, "昼は夜の場面なし");
value.slot = 1;
assert.equal(nightVisit(value, "souq"), null, "スーク・クリーク沿いなどは夜の場面なし");
assert.deepEqual(nightVisit(value, "festa"), { id: "ch4_dubai_night_festa", first: true });
const before = structuredClone(value);
nightVisit(value, "longlong");
assert.deepEqual(value, before, "判定だけでは保存を変えない");
assert.equal(recordNightVisit(value, "festa"), true);
assert.equal(recordNightVisit(value, "souq"), false);
assert.deepEqual(value.flags[NIGHT_FLAG], { festa: 1 });
assert.deepEqual(nightVisit(value, "festa"), { id: "ch4_dubai_night_festa", first: false }, "二度目からは一行だけ");
assert.equal(nightVisit(value, "center_cafe").first, true, "店ごとに数える");
value.flags[NIGHT_FLAG] = ["broken"];
assert.deepEqual(dubaiNights(value), {}, "壊れた記録は空として読む");
assert.equal(classifyFlag(NIGHT_FLAG), "progression");
assert.equal(flagVerdict(NIGHT_FLAG), "reset", "周回では持ち越さない");
// 夜の場面: 先に店の夜を読み、読み終えた来店だけ記録する。初めての夜はスポット固有の場面（経験値 X5s の候補）
assert.match(dailySource, /const night = nightVisit\(state, entry\.place\);\n\s*if \(night && !await readNight\(night, entry, owner\)\) return unused;/);
assert.match(dailySource, /if \(!done \|\| state !== owner\) return unused;\n\s*if \(night\) recordNightVisit\(state, entry\.place\);/);
assert.match(dailySource, /lines: scene\.lines\.slice\(0, 1\) \}, entry\.preview, owner, \{ growthScene: night\.first \}/);
for (const place of DUBAI_NIGHT_PLACES) {
  const scene = daily[nightSceneId(place)];
  assert(scene?.lines?.length >= 3, `${place} の夜の場面`);
  assert.equal(scene.lines[0].speaker, "", `${place}: 二度目からの一行は地の文`);
  assert.match(scene.lines[0].text, /夜|日が落ち/, `${place}: 最初の一行で夜と分かる`);
  for (const line of scene.lines) {
    assert(["", "hajime"].includes(line.speaker), `${place}: どの場面の前にも置けるよう、店の人物は話さない`);
    assert(!/太陽|王煙楼|旅装|シェイク|[0-9０-９]+℃|[0-9０-９]+度|[0-9０-９]+月/.test(line.text), `${place}: 人物・気温・日付に触れない`);
  }
}
assert(daily.ch4_dubai_night_alley_cafe.lines.some(line => line.text.includes("「マルハバ」")), "路地裏の常連のあいさつ");
assert(!/にぎわ|埋ま|いっぱい/.test(daily.ch4_dubai_night_alley_cafe.lines.map(line => line.text).join("")), "路地裏は混む店にしない（客は奥に二人だけ、の回と並ぶ）");
assert.match(daily.ch4_dubai_night_longlong.lines[0].text, /明かりが入っていく/, "開店前の通い（visit_c）の前にも置ける一行");

// ---- スークの屋台 ---------------------------------------------------------------------------
assert.equal(STALL_PLACE, "souq");
assert.deepEqual(STALL_MENU.map(item => [item.id, item.label, item.price, item.stamina]), [
  ["karak", "カラクチャイ", 100, 5], ["shawarma", "シャワルマ", 500, 12], ["luqaimat", "ルカイマット", 500, 8],
], "現地の屋台の値段（1〜2ディルハム／10〜15ディルハム）と、少し戻る体力");
assert(Object.isFrozen(STALL_MENU) && STALL_MENU.every(Object.isFrozen));
assert.deepEqual(STALL_MENU.map(stallLabel), ["カラクチャイ 100円（約2ディルハム）", "シャワルマ 500円（約10ディルハム）", "ルカイマット 500円（約10ディルハム）"]);
assert.deepEqual(stallChoices(10000).map(item => item.id), ["karak", "shawarma", "luqaimat"]);
assert.deepEqual(stallChoices(499).map(item => item.id), ["karak"], "買えないものは並べない");
assert.deepEqual(stallChoices(99), []);
assert.deepEqual(stallChoices(undefined), []);
assert.equal(stallItem("shawarma").price, 500); assert.equal(stallItem(STALL_NONE), null); assert.equal(stallItem("nope"), null);
assert.deepEqual([...STALL_SCENE_IDS], STALL_MENU.map(item => stallSceneId(item.id)));
const taste = { karak: /カルダモン/, shawarma: /削いで[\s\S]*巻いた/, luqaimat: /揚げ[\s\S]*蜜/ };
for (const item of STALL_MENU) {
  const scene = daily[stallSceneId(item.id)];
  assert(scene?.lines?.length >= 3, `${item.id} の味の場面`);
  assert.match(scene.lines.map(line => line.text).join(""), taste[item.id], `${item.id} の中身`);
  assert.equal(scene.metadata, undefined, `${item.id}: 食べ物は熟練度・能力を付けない`);
  for (const line of scene.lines) assert(!/【(技術|センス|根性|魅力|洞察)】|体力/.test(line.text), `${item.id}: 報酬・体力の文を書かない（コード側）`);
}
assert(daily.ch4_souq_stall_karak.lines.some(line => line.speaker === "hajime" && line.text === "シュクラン"), "受け取ってお礼を言う");
// 屋台は体力を使った後に戻し、時間は使わない（スークの行動の中）。選んだ時に代金と体力を確定する
assert.match(dailySource, /addStamina\(innTrial \? 0 : entry\.stamina \|\| 0\);\n\s*if \(entry\.heat\)[^\n]*\n[^\n]*\n\s*if \(entry\.place === STALL_PLACE && state === owner\) await visitStall\(owner\);/);
assert.match(dailySource, /stallChoices\(spendableMoney\(state\)\)/);
assert.match(dailySource, /\{ label: "何も買わない", value: STALL_NONE, test: `stall-\$\{STALL_NONE\}` \}/);
assert.match(dailySource, /addMoney\(-item\.price\);\n\s*addStamina\(item\.stamina\);/);
assert.match(dailySource, /「マルハバ」/, "屋台の店主のあいさつ");
// 読み込みの一覧に夜の場面と味の場面が入っている
assert.match(dailySource, /\.\.\.CAFE_TASTE_IDS, \.\.\.NIGHT_SCENE_IDS, \.\.\.STALL_SCENE_IDS/);

// ---- 店員のあいさつ（マルハバ＝ようこそ・こんにちは／シュクラン＝ありがとう） --------------------------------
assert.match(main.ch4_dubai_cafe_revisit.lines.find(line => line.speaker === "cafe_staff").text, /^マルハバ。/, "中心地のカフェの店員");
// 台詞の長さ（1台詞48字・選択肢の外の文字。dialogue-edit スキル）
for (const id of [...NIGHT_SCENE_IDS, ...STALL_SCENE_IDS]) for (const line of daily[id].lines) {
  assert(fullwidth(line.text) <= 48, `${id}: ${line.text}`);
  if (line.speaker) assert(!line.text.endsWith("。"), `${id}: 台詞の末尾に「。」を付けない`);
}

console.log("PASS ch4 Dubai local feel: daytime heat, lively nights, souq stall, dirham prices and greetings");
