// 第4章ドバイのカフェで一台頼んで吸う（2026-11-02 オーナー「カフェで吸えたりとかにしよう」「一台注文して味わう」
// 「現地のシーシャ文化の会話」「シーシャは6000 カフェは3000 できりよくいく」）。DOM を持たない判定・記録と、台本・値段のつながり。
// 実際の画面の流れは remake/test/browser/ch4_dubai_daily.mjs。
// node remake/test/ch4_dubai_cafe.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAFE_ORDERS_FLAG, CAFE_MENU, CAFE_PLACES, CAFE_TASTE_IDS, OMAKASE, OMAKASE_LINE, SMOKED_IN_SCENE, TALKS_AFTER_ORDER,
  cafeOrders, tasteScene, tasteSceneId, omakaseChoice, resolveCafeOrder, recordCafeOrder } from "../js/chapters/ch4-dubai-cafe.js";
import { classifyFlag, flagVerdict } from "../js/core/carry.js";

const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const json = rel => JSON.parse(read(rel));
const daily = Object.fromEntries(json("../../data/dialogue/ch4_dubai_daily.json").dialogues.map(d => [d.dialogue_id, d]));
const main = Object.fromEntries(json("../../data/dialogue/ch4_main.json").dialogues.map(d => [d.dialogue_id, d]));
const flavors = new Set(json("../../data/flavors.json").flavors.map(f => f.id));
const linesOf = d => [...(d.lines || []), ...Object.values(d.branches || {}).flat()];

// ---- メニューと記録 ---------------------------------------------------------------------
assert.deepEqual(CAFE_MENU.map(item => item.id), ["double_apple", "grape_mint", "lemon_mint", "mint"], "現地のメニュー（先頭が定番）");
assert.deepEqual([...CAFE_PLACES], ["center_cafe", "alley_cafe"]);
assert(Object.isFrozen(CAFE_MENU) && CAFE_MENU.every(Object.isFrozen));
const value = { day: 50, flags: {} };
assert.deepEqual(cafeOrders(value), {});
assert.equal(tasteScene(value, "double_apple"), "ch4_dubai_taste_double_apple", "初めての一台は本編");
assert.equal(tasteScene(value, "nope"), null);
assert.equal(omakaseChoice(value), "double_apple", "おまかせはまだ頼んでいない一台から（メニュー順）");
assert.equal(resolveCafeOrder(value, "lemon_mint"), "lemon_mint");
assert.equal(resolveCafeOrder(value, OMAKASE), "double_apple");
assert.equal(resolveCafeOrder(value, "unknown"), null);
const before = structuredClone(value);
omakaseChoice(value); tasteScene(value, "mint");
assert.deepEqual(value, before, "選ぶだけでは保存を変えない");
assert.equal(recordCafeOrder(value, "double_apple"), true);
assert.equal(recordCafeOrder(value, "nope"), false);
assert.deepEqual(value.flags[CAFE_ORDERS_FLAG], { double_apple: 1 });
assert.equal(tasteScene(value, "double_apple"), "ch4_dubai_taste_double_apple_again", "二度目からは短い方");
assert.equal(omakaseChoice(value), "grape_mint", "おまかせは次の未体験の一台");
for (const id of ["grape_mint", "lemon_mint", "mint"]) recordCafeOrder(value, id);
for (const day of [48, 49, 50, 51]) assert.equal(omakaseChoice({ ...value, day }), CAFE_MENU[day % 4].id, "全部頼んだ後は日付で回す");
value.flags[CAFE_ORDERS_FLAG] = "broken";
assert.deepEqual(cafeOrders(value), {}, "壊れた記録は空として読む");
assert.equal(classifyFlag(CAFE_ORDERS_FLAG), "progression");
assert.equal(flagVerdict(CAFE_ORDERS_FLAG), "reset", "周回では持ち越さない");

// ---- 味わいの台本 -----------------------------------------------------------------------
assert.deepEqual([...CAFE_TASTE_IDS], CAFE_MENU.flatMap(item => [tasteSceneId(item.id), tasteSceneId(item.id, true)]));
for (const item of CAFE_MENU) {
  const first = daily[tasteSceneId(item.id)], again = daily[tasteSceneId(item.id, true)];
  assert(first?.lines?.length >= 4, `${item.id} の初めての一台`);
  assert(again?.lines?.length >= 2 && again.lines.length < first.lines.length, `${item.id} の二度目は短い`);
  const lesson = first.metadata?.flavor_lesson;
  assert(lesson && Object.keys(lesson).length, `${item.id} は初めての一台で熟練度が少し伸びる`);
  for (const id of Object.keys(lesson)) assert(flavors.has(id), `${item.id}: ${id} は実在の葉`);
  assert.equal(again.metadata, undefined, `${item.id} の二度目は熟練度を付けない`);
  assert(first.lines[0].text.includes(item.label), `${item.id}: 頼んだ一台の名前から始まる`);
  for (const line of [...first.lines, ...again.lines]) {
    assert(["", "hajime"].includes(line.speaker), `${item.id}: 両方の店で使うので店員は出さない`);
    assert(!/【(技術|センス|根性|魅力|洞察)】/.test(line.text), "能力の報酬文を書かない");
  }
}
// ダブルアップルの正史（アニスとリコリスの二つのスパイス。果汁の林檎味にしない）
const apple = daily.ch4_dubai_taste_double_apple.lines.map(line => line.text).join("");
assert(apple.includes("アニス") && apple.includes("リコリス") && !/林檎飴|果汁感|甘酸っぱい林檎/.test(apple));
for (const place of CAFE_PLACES) assert(OMAKASE_LINE[place]?.endsWith("。"), place);

// ---- 来店の場面との並び・文化の会話 ---------------------------------------------------------
const dailySource = read("../js/chapters/ch4-dubai-daily.js");
const rotation = place => JSON.parse(new RegExp(`${place}: (\\[[^\\]]*\\])`).exec(dailySource)[1]);
const center = rotation("center_cafe"), alley = rotation("alley_cafe");
for (const id of ["ch4_dubai_cafe_revisit", "ch4_cafe_talk_b", "ch4_cafe_talk_c", "ch4_cafe_talk_d"]) assert(center.includes(id), `既存の再訪 ${id} を残す`);
for (const id of ["ch4_alley_cafe_quiet", "ch4_alley_talk_b", "ch4_alley_talk_c"]) assert(alley.includes(id), `既存の再訪 ${id} を残す`);
assert.equal(alley[0], "ch4_alley_cafe_quiet", "路地裏の最初の再訪は、あの男の葉の場面のまま");
const culture = [...center, ...alley].filter(id => /_culture_/.test(id));
assert.deepEqual(culture.sort(), ["ch4_alley_culture_clay", "ch4_alley_culture_majlis", "ch4_cafe_culture_coffee", "ch4_cafe_culture_hose"]);
for (const id of [...TALKS_AFTER_ORDER, ...SMOKED_IN_SCENE]) assert(daily[id] || main[id], `${id} の台本がある`);
for (const id of culture) {
  assert(TALKS_AFTER_ORDER.includes(id), `${id} は吸いながら聞く（注文の後）`);
  const lines = linesOf(daily[id]);
  assert(lines.length >= 6, id);
  assert(!lines.some(line => ["traveler", "sheikh", "master_hookah", "da_silva"].includes(line.speaker)), `${id}: 旅装の男・王煙楼・太陽は出さない`);
  assert(!lines.some(line => /王煙楼|シェイク|旅装/.test(line.text)), `${id}: 本筋の人物に触れない`);
}
// 閉店前の茶は、一台を吸い終えた後に読む（来た時に閉店前、とは書かない）
assert(TALKS_AFTER_ORDER.includes("ch4_alley_talk_c"));
assert.match(daily.ch4_alley_talk_c.lines[0].text, /^吸い終えるころには/);
// 場面の中で吸う回（約束の一台・あの男の葉）には注文を重ねない
assert.deepEqual([...SMOKED_IN_SCENE], ["ch4_stranger_second", "ch4_alley_cafe_quiet"]);
// 中心地のカフェの最初の場面は、店を出る選択肢で終わらない（そのまま一台頼む）
const firstCafe = json("../../data/dialogue/ch4_spots.json").dialogues.find(d => d.dialogue_id === "ch4_dubai_cafe");
assert(!firstCafe.lines.some(line => line.type === "choice"), "ch4_dubai_cafe は一台頼む前に店を出ない");
// 読み込みの一覧に文化の会話と味わいが入っている
assert.match(dailySource, /culture_\[a-z\]\+/);
assert.match(dailySource, /\.\.\.CAFE_TASTE_IDS/);

// ---- ドバイの相場（2026-11-02 オーナー）: 専門店 6,000円・カフェ（中心地・路地裏）3,000円 ----
for (const [id, cost] of [["ch4_dubai_festa", 6000], ["ch4_dubai_cafe", 3000], ["ch4_dubai_alley", 3000]]) {
  assert.match(dailySource, new RegExp(`id: "${id}"[^}]*cost: ${cost},`), `${id} は一台 ${cost}円`);
  assert.match(dailySource, new RegExp(`id: "${id}"[^}]*desc: "[^"]*${cost.toLocaleString("en-US")}円`), `${id} の説明も ${cost}円`);
}
const ch5Dubai = read("../js/chapters/ch5-dubai.js");
assert.match(ch5Dubai, /id: "ch5_dubai_alley"[^}]*cost: 3000,/, "第5章のドバイの路地裏のカフェも 3,000円");

console.log("PASS ch4 Dubai cafe: local menu, omakase, tasting scenes, culture talks, local Dubai prices");
