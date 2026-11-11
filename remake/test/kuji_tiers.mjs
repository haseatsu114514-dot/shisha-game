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
// 値段は 2026-11-11 に1ランクずつ下げた（KJ15。景品と枚数はそのまま）。くじのIDは箱を作った時の値段の名残で、セーブの箱の名前なので変えない。
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

// 5. 実際の grant(): 持っていない台・機材は持ち物へ（そのくじで手に入れた物として覚える）。持っている物は中古買い取りの額をお金で
// （売れない台は景品評価の半額）。ただし、どちらも「そのくじ1回の値段」まで（KJ16。値下げした箱を買い切って売っても、お金が増えない）。
const grantSource = source.match(/^function grant\(prize, g\) \{[\s\S]*?^\}\n/m)?.[0];
const dupeSource = source.match(/^const withDupe = [^\n]*\n/m)?.[0];
assert(grantSource && dupeSource, "kuji.js の grant() と withDupe が見つかる");
function setup(owned = []) {
  const ctx = {
    DB: { equipById: equipment },
    state: { owned: [...owned], goods: [], flavorStock: {}, money: 0 },
    FLAVOR_BOX_GRAMS: 50,
    addMoney(n) { ctx.state.money += n; },
    addFlavorStock(id, grams) { ctx.state.flavorStock[id] = (ctx.state.flavorStock[id] || 0) + grams; },
    won: [], noteKujiGear(gradeId, equipId) { ctx.won.push([gradeId, equipId]); },
  };
  vm.runInNewContext(`${grantSource}${dupeSource}this.withDupe = withDupe;`, ctx);
  return ctx;
}
// 本体の grades() と同じく、くじのIDを添えて渡す
const graded = id => ({ id, ...kuji.grades[id] });
const dubai = graded("g10000"), tokyo = graded("g5000"), yuzu = graded("g3000"), home = graded("g1000");
const custom = dubai.prizes.find(p => p.rank === "S");
let t = setup();
assert.equal(t.grant(custom, dubai), null, "初めての台は替えない");
assert.deepEqual(t.state.owned, ["stand_custom"]);
assert.deepEqual(JSON.parse(JSON.stringify(t.won)), [["g10000", "stand_custom"]], "このくじで手に入れた物として覚える（売るときの上限）");
assert.equal(t.state.money, 0);
const capped = t.grant(custom, dubai);
assert.deepEqual({ ...capped }, { dupCash: 5000, dupCapped: true }, "持っている台は、中古買い取り額（150,000円）ではなくくじ1回分の5,000円まで");
assert.deepEqual(t.state.owned, ["stand_custom"], "同じ台を二つ持たない");
assert.equal(t.state.money, 5000);
assert.equal(t.won.length, 1, "重複は覚え直さない");
assert.deepEqual({ ...t.withDupe(custom, capped) }, { ...custom, dupCash: 5000, dupCapped: true }, "結果のカードに額と、1回分で頭打ちになった印を渡す");
assert.deepEqual(t.withDupe(custom, 1500).dupCash, 1500, "頭打ちにならない額はそのまま渡す");
assert.equal(t.withDupe(custom, null), custom, "替えていない景品はそのまま");
// 中古買い取り額が1回の値段より安い品は、今までどおりその額（ドバイ店5,000円のくじの、ビッグタヌキッシュリッド1,500円）
t = setup(["winkwink_hagal"]);
assert.equal(t.grant(dubai.prizes.find(p => p.equipId === "winkwink_hagal"), dubai), 1500, "1回の値段より安い買い取り額はそのまま");
t = setup(["home_rig_pro", "nightside_premier_hagal"]);
assert.equal(t.grant(tokyo.lastOne, tokyo), 1500, "売れない大会公式モデルの台は景品評価の半額（従来の補償。東京店3,000円のくじでは頭打ちにならない）");
assert.deepEqual({ ...t.grant(home.prizes.find(p => p.rank === "S"), home) }, { dupCash: 500, dupCapped: true }, "本店500円のくじでは、その補償も1回分の500円まで");
assert.deepEqual({ ...t.grant(yuzu.lastOne, yuzu) }, { dupCash: 1000, dupCapped: true }, "ナイトサイド（中古買い取り3,000円）も柚ヶ谷店1,000円のくじでは1,000円まで");
assert.equal(t.state.money, 3000);
// どのくじでも、台・機材1つで戻るお金は1回の値段を超えない（買い切って売ってもお金が増えない）。
for (const [id, g] of Object.entries(kuji.grades)) for (const p of [...g.prizes, g.lastOne].filter(x => x.equipId)) {
  const own = setup([p.equipId]);
  own.state.kujiTickets = 0; own.grantKujiTickets = () => 1;
  const back = own.grant(p, { id, ...g });
  assert((typeof back === "object" ? back.dupCash ?? 0 : back) <= g.price, `${id}「${p.name}」: 重複で戻るお金は1回の値段まで`);
}
t = setup();
const set = kuji.grades.g10000.prizes.find(p => p.flavors);
assert.equal(t.grant(set, dubai), null);
assert.deepEqual(t.state.flavorStock, { anise: 50, ginger: 50, cardamom: 50 }, "詰め合わせは全部の葉が加わる");
assert.deepEqual(t.state.goods, [], "葉を小物にしない");
// 古い箱の非売品の台（equipId なし）は今までどおり売れる小物。
t = setup();
assert.equal(t.grant({ type: "stand", name: "旧景品の台", sell: 3000 }, home), null);
assert.deepEqual(JSON.parse(JSON.stringify(t.state.goods)), [{ name: "旧景品の台", sell: 3000 }]);

// 6. くじで手に入れた台・機材を売るときの上限（KJ16・daily/kuji-resale.js）。記録はその箱（state.kuji[くじのID].won）に持つ。
{
  const resaleSource = readFileSync(new URL("../js/daily/kuji-resale.js", import.meta.url), "utf8").replace(/^import .*;\s*$/gm, "").replace(/\bexport /g, "");
  const ctx = { DB: { kuji }, state: { kuji: { g3000: { order: [], drawn: 0 }, g10000: { order: [], drawn: 0 }, g500: { order: [], drawn: 0, won: ["lotos_plus"] } } } };
  vm.runInNewContext(`${resaleSource}; this.api = { noteKujiGear, kujiResaleCap, forgetKujiGear, resalePrice };`, ctx);
  const R = ctx.api, stainless = equipment.stand_stainless, lotos = equipment.lotos_plus;
  assert.equal(R.kujiResaleCap("stand_stainless"), null, "くじで手に入れていない物に上限は無い");
  assert.equal(R.resalePrice(stainless), stainless.sell_price, "店で買った物・前から持っている物は今までどおりの買い取り額");
  R.noteKujiGear("g10000", "stand_stainless"); R.noteKujiGear("g10000", "stand_stainless");
  assert.deepEqual([...ctx.state.kuji.g10000.won], ["stand_stainless"], "同じ物を二重に覚えない");
  assert.equal(R.resalePrice(stainless), 5000, "ドバイ店のくじで手に入れた台は、1回分の5,000円まで");
  R.noteKujiGear("g3000", "stand_stainless");
  assert.equal(R.kujiResaleCap("stand_stainless"), 1000, "複数のくじの記録にあれば安い方");
  R.noteKujiGear("g3000", "winkwink_hagal");
  assert.equal(R.resalePrice(equipment.winkwink_hagal), 1000, "中古買い取り1,500円の機材も、柚ヶ谷店1,000円のくじなら1,000円まで");
  R.noteKujiGear("g10000", "dense_flat_charcoal");
  assert.equal(R.resalePrice(equipment.dense_flat_charcoal), equipment.dense_flat_charcoal.sell_price, "1回の値段より安い買い取り額はそのまま");
  assert.equal(R.resalePrice(lotos), lotos.sell_price, "今は無いくじ（廃止した箱）の記録は上限にしない");
  R.noteKujiGear("g99999", "stand_walnut");
  assert.equal(R.kujiResaleCap("stand_walnut"), null, "箱が無いくじには覚えない");
  R.forgetKujiGear("stand_stainless");
  assert.equal(R.kujiResaleCap("stand_stainless"), null, "手放したら記録を消す（店で買い直した物は店の買い取り額）");
  assert.deepEqual([...ctx.state.kuji.g3000.won], ["winkwink_hagal"]);
  // 上限つきなら、どの箱も「買い切って全部売る」でお金が増えない（上限が無いと柚ヶ谷店は増える）。
  for (const [id, g] of Object.entries(kuji.grades)) {
    const gear = [...g.prizes, g.lastOne].filter(p => p.equipId && !equipment[p.equipId].unsellable);
    const st = { kuji: { [id]: { order: [], drawn: 0 } } };
    const c2 = { DB: { kuji }, state: st };
    vm.runInNewContext(`${resaleSource}; this.api = { noteKujiGear, resalePrice };`, c2);
    for (const p of gear) c2.api.noteKujiGear(id, p.equipId);
    const back = gear.reduce((n, p) => n + c2.api.resalePrice(equipment[p.equipId]), 0);
    assert(back < g.price * g.boxSize / 2, `${id}: 箱を買い切って台・機材を全部売っても半分も戻らない（${back} / ${g.price * g.boxSize}）`);
  }
}

// ドバイの葉（アフサール／ドバジのダブルアップル・ミント）は取りやめた（DBS03）ので、くじにも入れない。
for (const [gradeId, g] of Object.entries(kuji.grades)) for (const prize of [...g.prizes, g.lastOne].filter(Boolean)) {
  for (const id of [prize.flavorId, ...(prize.flavors || []).map(f => f.id)].filter(Boolean))
    assert(!['absal_double_apple', 'absal_mint', 'dobaj_double_apple', 'dobaj_mint'].includes(id), `${gradeId} の ${prize.name} にドバイの葉を入れない`);
}
console.log(`[kuji tiers] PASS: ${Object.keys(kuji.grades).length} grades, chapter gates 1-5, gear prizes, duplicate cash capped at one draw, resale cap, ch5 limited tier`);
