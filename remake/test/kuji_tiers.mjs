// KJ02: 章が進むと高いくじが並び、景品は主に台と機材。データの約束・章の出し分け・持っている機材の扱いを確かめる。
// KJ11（2026-11-11）: くじは店ごとに1種類。章が進むと新しい街の店に上位のくじがあり、第5章の本店は限定台くじに入れ替わる。
// node remake/test/kuji_tiers.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = file => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const kuji = read("../../data/kuji.json");
const flavors = Object.fromEntries(read("../../data/flavors.json").flavors.map(f => [f.id, f]));
const equipment = Object.fromEntries(read("../../data/equipment.json").equipment.map(e => [e.id, e]));
const GEAR_TYPES = ["bowl", "hms", "charcoal"];

// 1. 値段・並ぶ章・置いてある店（本店500円は第1章から、柚ヶ谷1,000円は第2章／東京3,000円は第3章／ドバイ5,000円は第4章／第5章の本店は10,000円の限定台くじ KJ05・KJ11）。
// 値段は 2026-11-11 に1ランクずつ下げた（KJ15）。くじのIDは箱を作った時の値段の名残で、セーブの箱の名前なので変えない。
const TIERS = { g1000: [500, 1, "home"], g3000: [1000, 2, "widehanga"], g5000: [3000, 3, "tokyo"], g10000: [5000, 4, "dubai"], g20000: [10000, 5, "home"] };
assert.deepEqual(Object.keys(kuji.grades), Object.keys(TIERS), "くじは5種類（旧500円の箱は廃止）");
for (const [id, [price, chapter, shop]] of Object.entries(TIERS)) {
  const g = kuji.grades[id];
  assert(g, `${id} がある`);
  assert.equal(g.price, price, `${id} の値段`);
  assert.equal(g.chapterMin, chapter, `${id} が並ぶ章`);
  assert.equal(g.shop, shop, `${id} を置く店`);
  assert(g.label.includes(`1回${price.toLocaleString("ja-JP")}円`), `${id} の名前に1回の値段: ${g.label}`);
}

// 1b. 抽選器の見た目（GCH16・2026-11-11 オーナー「くじのランクによってガラガラの見た目を変えたり豪華に」）: 上の店のくじほど豪華。
// 見た目の名前は演出（motions/kuji-art.js の KUJI_LOOKS）にある。色替えした絵が実際に出ることは、画像のある
// ブラウザの検査（test/browser/kuji_gacha.mjs の machine-look-per-kuji）が見る（この検査は画像を取得しない環境でも動く）
{
  const { KUJI_LOOKS } = await import("../js/motions/kuji-art.js");
  const MACHINES = { g1000: "walnut", g3000: "steel", g5000: "brass", g10000: "marble", g20000: "lacquer" };
  Object.entries(MACHINES).forEach(([id, look], rung) => {
    assert.equal(kuji.grades[id].machine, look, `${id} の抽選器の見た目`);
    assert.equal(KUJI_LOOKS[look]?.lux, rung, `${look} の豪華さは ${rung}（上の店ほど豪華）`);
  });
  for (const g of Object.values(kuji.legacyGrades)) assert.equal(g.machine, undefined, "旧箱には見た目を持たせない（引き途中の旧箱は本店の抽選器で引く）");
}

// 2. 景品の参照先が実在し、種類が合い、その章より先の品を出さない。
for (const section of ["grades", "legacyGrades"]) {
  for (const [id, g] of Object.entries(kuji[section])) {
    const chapter = g.chapterMin || 1;
    const all = [...g.prizes, ...(g.lastOne ? [g.lastOne] : [])];
    const gearIds = [];
    for (const p of all) {
      const where = `${section}.${id}「${p.name}」`;
      // consumable（演出だけの品）は旧箱の引き切りにだけ残る。
      assert(["goods", "flavor", "stand", "equip", ...(section === "legacyGrades" ? ["consumable"] : [])].includes(p.type), `${where}: 種類 ${p.type}`);
      assert(Number.isInteger(p.count) && p.count > 0, `${where}: 枚数`);
      if (p.equipId) {
        const e = equipment[p.equipId];
        assert(e, `${where}: ${p.equipId} が equipment.json にある`);
        assert(!e.deprecated, `${where}: 廃止品を出さない`);
        assert((e.chapter_min || 1) <= chapter, `${where}: 第${e.chapter_min}章の品を第${chapter}章のくじに入れない`);
        assert.equal(p.type, e.type === "homeware" ? "stand" : "equip", `${where}: 台は stand、ハガル・HMD・炭は equip`);
        assert(e.type === "homeware" || GEAR_TYPES.includes(e.type), `${where}: 台か制作の機材`);
        assert.equal(p.name.replace(/^ラストワン賞・/, ""), e.name, `${where}: 景品名は品の名前と同じ`);
        assert.equal(p.count, 1, `${where}: 機材は1箱に1つ`);
        // 中古評価: 売れる品は店の買い取り額と同じ。売れない台は景品評価（重複時に半額を渡す）を持つ。
        if (!e.unsellable) assert.equal(p.sell, e.sell_price, `${where}: 中古評価＝買い取り額`);
        else assert(p.sell > 0, `${where}: 売れない台にも景品評価`);
        gearIds.push(p.equipId);
      }
      if (p.type === "flavor") {
        const leaves = p.flavorId ? [{ id: p.flavorId, grams: p.grams ?? 50 }] : p.flavors || [];
        if (section === "grades") assert(leaves.length, `${where}: 葉の景品は実在庫に入る`);
        for (const leaf of leaves) {
          const f = flavors[leaf.id];
          assert(f, `${where}: ${leaf.id} が flavors.json にある`);
          assert((f.chapter_min || 1) <= chapter, `${where}: ${leaf.id} は第${f.chapter_min}章の葉`);
          assert.equal(f.leaf || "blond", "blond", `${where}: 家シーシャ・ミックスで使えるブロンドリーフ`);
          assert(f.price > 0, `${where}: 店で値段のある葉（試作品を配らない）`);
          assert(leaf.grams > 0, `${where}: g`);
        }
      }
    }
    if (section === "grades") assert.equal(new Set(gearIds).size, gearIds.length, `${id}: 同じ機材を1箱に2つ入れない（必ず重複する）`);
  }
}

// 3. 上位くじは台と機材が主役。S賞は台で、上の段ほど家シーシャで伸びる台。S・A賞はすべて台か機材。
// 第5章の限定台くじ（KJ05）のS賞はくじ限定の台3種で、伸びは店で一番伸びる台と同じ（くじだけ強い台を作らない）。
const upper = Object.entries(kuji.grades).filter(([, g]) => g.price >= 1000).sort((a, b) => a[1].price - b[1].price);
assert.deepEqual(upper.map(([id]) => id), ["g3000", "g5000", "g10000", "g20000"]);
const topShopXp = Math.max(...Object.values(equipment).filter(e => e.type === "homeware" && !e.not_for_sale).map(e => e.home_xp || 0));
let lastXp = 0;
for (const [id, g] of upper) {
  const tops = g.prizes.filter(p => p.rank === "S");
  for (const s of tops) assert.equal(equipment[s.equipId]?.type, "homeware", `${id}: S賞は台`);
  if (g.limited) {
    assert.equal(tops.length, 3, `${id}: 限定台くじのS賞は3種`);
    for (const s of tops) assert.equal(equipment[s.equipId].home_xp, topShopXp, `${id}「${s.name}」: 店で一番伸びる台と同じ伸び`);
  } else {
    assert.equal(tops.length, 1, `${id}: S賞は1種`);
    const xp = equipment[tops[0].equipId].home_xp;
    assert(xp > lastXp, `${id}: S賞の台は下の段より伸びる（${xp}）`);
    lastXp = xp;
  }
  for (const p of g.prizes.filter(p => p.rank === "S" || p.rank === "A")) assert(p.equipId, `${id}「${p.name}」: S・A賞は台か機材`);
  assert(g.lastOne.equipId, `${id}: ラストワン賞も台か機材`);
  assert(g.prizes.filter(p => p.equipId).length >= 4, `${id}: 台・機材が4種以上`);
}
assert.equal(lastXp, topShopXp, "店の台を出すくじのいちばん上のS賞は、店で一番伸びる台");
assert.equal(Math.max(...Object.values(equipment).filter(e => e.type === "homeware").map(e => e.home_xp || 0)), topShopXp, "くじ・非売品の台も店の一番の台より伸びない");

// 4. 実際の kuji.js の出し分け: くじは店ごとに1種類で、その街へ行ける章から並ぶ（KJ11）。
const source = readFileSync(new URL("../js/daily/kuji.js", import.meta.url), "utf8");
const gradesSource = source.match(/^const grades = \(shop = "home"\) => [\s\S]*?;\n/m)?.[0];
assert(gradesSource, "kuji.js の grades() が見つかる");
const visible = (chapter, shop) => {
  const ctx = { DB: { kuji }, state: { chapter }, shop };
  vm.runInNewContext(`${gradesSource}; result = (shop === undefined ? grades() : grades(shop)).map(g => g.id);`, ctx);
  return [...ctx.result];
};
for (const chapter of [1, 2, 3, 4]) assert.deepEqual(visible(chapter, "home"), ["g1000"], `本店は第${chapter}章もシーシャくじ`);
assert.deepEqual(visible(5, "home"), ["g20000"], "第5章の本店は限定台くじに入れ替わる");
assert.deepEqual(visible(1), ["g1000"], "店を指定しなければ本店");
assert.deepEqual(visible(1, "widehanga"), [], "柚ヶ谷店は第2章から");
for (const chapter of [2, 3, 4, 5]) assert.deepEqual(visible(chapter, "widehanga"), ["g3000"], "柚ヶ谷店は機材くじ");
assert.deepEqual(visible(2, "tokyo"), [], "東京店は第3章から");
for (const chapter of [3, 4, 5]) assert.deepEqual(visible(chapter, "tokyo"), ["g5000"], "東京店は上級機材くじ");
assert.deepEqual(visible(3, "dubai"), [], "ドバイ店は第4章から");
for (const chapter of [4, 5]) assert.deepEqual(visible(chapter, "dubai"), ["g10000"], "ドバイ店は特注台くじ");
// どの店・どの章でも、並ぶくじは1種類まで。新しい街ほど値段が上がる。
for (const shop of ["home", "widehanga", "tokyo", "dubai"]) for (const chapter of [1, 2, 3, 4, 5]) assert(visible(chapter, shop).length <= 1, `${shop} 第${chapter}章`);
assert.deepEqual(["home", "widehanga", "tokyo", "dubai"].map(shop => kuji.grades[visible(4, shop)[0]].price), [500, 1000, 3000, 5000], "新しい街ほど上位のくじ");

// 5. 実際の grant(): 持っていない台・機材は持ち物へ。持っている物は中古買い取りの額をお金で（売れない台は景品評価の半額）。
const grantSource = source.match(/^function grant\(prize\) \{[\s\S]*?^\}\n/m)?.[0];
const dupeSource = source.match(/^const withDupe = [^\n]*\n/m)?.[0];
assert(grantSource && dupeSource, "kuji.js の grant() と withDupe が見つかる");
function setup(owned = []) {
  const ctx = {
    DB: { equipById: equipment },
    state: { owned: [...owned], goods: [], flavorStock: {}, money: 0 },
    FLAVOR_BOX_GRAMS: 50,
    addMoney(n) { ctx.state.money += n; },
    addFlavorStock(id, grams) { ctx.state.flavorStock[id] = (ctx.state.flavorStock[id] || 0) + grams; },
  };
  vm.runInNewContext(`${grantSource}${dupeSource}this.withDupe = withDupe;`, ctx);
  return ctx;
}
const custom = kuji.grades.g10000.prizes.find(p => p.rank === "S");
let t = setup();
assert.equal(t.grant(custom), null, "初めての台は替えない");
assert.deepEqual(t.state.owned, ["stand_custom"]);
assert.equal(t.state.money, 0);
assert.equal(t.grant(custom), 150000, "持っている台は中古買い取り額");
assert.deepEqual(t.state.owned, ["stand_custom"], "同じ台を二つ持たない");
assert.equal(t.state.money, 150000);
assert.deepEqual(t.withDupe(custom, 150000).dupCash, 150000, "結果のカードに額を渡す");
assert.equal(t.withDupe(custom, null), custom, "替えていない景品はそのまま");
t = setup(["home_rig_pro", "nightside_premier_hagal"]);
assert.equal(t.grant(kuji.grades.g5000.lastOne), 1500, "売れない大会公式モデルの台は景品評価の半額（従来の補償）");
assert.equal(t.grant(kuji.grades.g3000.lastOne), 3000, "ナイトサイドは中古買い取り額");
assert.equal(t.state.money, 4500);
t = setup();
const set = kuji.grades.g10000.prizes.find(p => p.flavors);
assert.equal(t.grant(set), null);
assert.deepEqual(t.state.flavorStock, { anise: 50, ginger: 50, cardamom: 50 }, "詰め合わせは全部の葉が加わる");
assert.deepEqual(t.state.goods, [], "葉を小物にしない");
// 古い箱の非売品の台（equipId なし）は今までどおり売れる小物。
t = setup();
assert.equal(t.grant({ type: "stand", name: "旧景品の台", sell: 3000 }), null);
assert.deepEqual(JSON.parse(JSON.stringify(t.state.goods)), [{ name: "旧景品の台", sell: 3000 }]);

// ドバイの葉（アフサール／ドバジのダブルアップル・ミント）は取りやめた（DBS03）ので、くじにも入れない。
for (const [gradeId, g] of Object.entries(kuji.grades)) for (const prize of [...g.prizes, g.lastOne].filter(Boolean)) {
  for (const id of [prize.flavorId, ...(prize.flavors || []).map(f => f.id)].filter(Boolean))
    assert(!['absal_double_apple', 'absal_mint', 'dobaj_double_apple', 'dobaj_mint'].includes(id), `${gradeId} の ${prize.name} にドバイの葉を入れない`);
}
console.log(`[kuji tiers] PASS: ${Object.keys(kuji.grades).length} grades, chapter gates 1-5, gear prizes, duplicate cash, ch5 limited tier`);
