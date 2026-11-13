// KJ05: 第5章の限定台くじ（g20000）と、くじ限定の台3種・くじ券。
// データの約束（性能は店で一番伸びる台と同じ・店で売らない）、重複→くじ券、くじ券で1回引く、SAVE/LOAD、
// #2455（火種を付けない・心得の盤／大会／エンディング／進行の条件から参照しない）を確かめる。
// NG+ で持ち越さないことは ngplus_carry.mjs・ngplus_cycle_start.mjs が確かめる。
// node remake/test/kuji_limited.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const root = new URL("../../", import.meta.url);
const readText = file => fs.readFileSync(new URL(file, root), "utf8");
const readJson = file => JSON.parse(readText(file));
const kuji = readJson("data/kuji.json");
const equipmentList = readJson("data/equipment.json").equipment;
const equipment = Object.fromEntries(equipmentList.map(e => [e.id, e]));
const flavors = Object.fromEntries(readJson("data/flavors.json").flavors.map(f => [f.id, f]));
const { KUJI_LIMITED_GRADES, KUJI_ONLY_EQUIPMENT, KUJI_TICKET_MAX } = await import("../js/core/rules.js");

const { DB } = await import("../js/core/data.js");
DB.flavors = Object.values(flavors);
DB.flavorById = flavors;
DB.equipment = equipmentList;
DB.equipById = equipment;
DB.recipes = readJson("data/recipes.json").recipes;
DB.ngMixes = [];
DB.dialogues = {};
DB.kuji = kuji;
const core = await import("../js/core/state.js");
const tickets = await import("../js/daily/kuji-tickets.js");
const { forSale } = await import("../js/daily/shop.js");
const rig = await import("../js/daily/home-rig.js");
const home = await import("../js/daily/home-shisha.js");
const growth = await import("../js/core/growth.js");

// ---------------------------------------------------------------- 1. 限定台くじのデータ
const limitedIds = Object.entries(kuji.grades).filter(([, g]) => g.limited).map(([id]) => id);
assert.deepEqual(limitedIds, ["g20000"], "限定台くじは1つ");
assert.deepEqual(KUJI_LIMITED_GRADES, limitedIds, "rules.js の一覧と data/kuji.json が一致");
assert(!Object.values(kuji.legacyGrades).some(g => g.limited), "旧箱に限定台くじは無い");
const g = kuji.grades.g20000;
const shopTop = Math.max(...Object.values(kuji.grades).filter(x => !x.limited).map(x => x.price));
assert.equal(g.chapterMin, 5, "第5章から");
assert(g.price > shopTop, `いちばん高いくじ（${g.price} > ${shopTop}）`);
assert.equal(g.label, "限定台くじ（1回10,000円）"); // 値段は1ランク下げた（KJ15）
assert(g.boxSize >= 20 && g.boxSize <= 50, "箱の枚数は既存の箱と同じ幅");
assert.equal(g.prizes.reduce((n, p) => n + p.count, 0), g.boxSize);
assert.equal(g.lastOne.secret, true);

// くじ限定の台: ちょうど3種。S賞はその3種だけで、ほかの箱・ラストワン賞には入れない。
const onlyIds = equipmentList.filter(e => e.kuji_only).map(e => e.id);
assert.equal(onlyIds.length, 3, "くじ限定の台は3種");
assert.deepEqual([...KUJI_ONLY_EQUIPMENT].sort(), [...onlyIds].sort(), "rules.js の一覧と data/equipment.json が一致");
const sPrizes = g.prizes.filter(p => p.rank === "S");
assert.deepEqual(sPrizes.map(p => p.equipId).sort(), [...onlyIds].sort(), "S賞はくじ限定の台3種");
assert(sPrizes.every(p => p.count === 1 && p.type === "stand"));
assert(g.prizes.filter(p => p.rank !== "S").every(p => !onlyIds.includes(p.equipId)) && !onlyIds.includes(g.lastOne.equipId));
for (const [section, grades] of Object.entries({ grades: kuji.grades, legacyGrades: kuji.legacyGrades })) for (const [id, other] of Object.entries(grades)) {
  if (other === g) continue;
  for (const p of [...other.prizes, other.lastOne].filter(Boolean)) assert(!onlyIds.includes(p.equipId), `${section}.${id} に限定の台を入れない`);
}

// 性能は店で一番伸びる台（職人仕立ての特注台）と同じ。店では売らず、売れない。絵は台ごとの専用絵（2026-11-11 採用・#3336）。
const shopStands = equipmentList.filter(e => e.type === "homeware" && !e.not_for_sale);
const best = shopStands.reduce((a, b) => (b.home_xp || 0) > (a.home_xp || 0) ? b : a);
assert.equal(best.id, "stand_custom", "店で一番伸びる台");
const NOT_PERFORMANCE = new Set(["id", "name", "description", "value", "art", "chapter_min", "buy_price", "sell_price", "price",
  "unsellable", "not_for_sale", "kuji_only", "base"]);
const shopArt = fs.readFileSync(new URL("remake/js/daily/shop-equipment-art.js", root), "utf8");
const names = new Set(equipmentList.filter(e => !e.kuji_only).map(e => e.name));
for (const id of onlyIds) {
  const e = equipment[id];
  assert.equal(e.base, best.id, `${id}: 元の台は店で一番伸びる台`);
  for (const key of new Set([...Object.keys(best), ...Object.keys(e)])) {
    if (!NOT_PERFORMANCE.has(key)) assert.deepEqual(e[key], best[key], `${id}.${key}: 性能は ${best.id} と同じ`);
  }
  assert.equal(rig.homeRigXp(id), rig.homeRigXp(best.id), `${id}: 家シーシャの経験値も同じ`);
  assert(e.not_for_sale && e.unsellable && e.buy_price === 0 && e.sell_price === 0 && e.price === 0, `${id}: 店で売らず、売れない`);
  for (const stock of [1, 2, 3, 4, 5, 99]) assert.equal(forSale(e, stock), false, `${id}: 品揃え${stock}の店に並ばない`);
  assert.equal(e.chapter_min, 5);
  assert.equal(e.art, id, `${id}: 台ごとの専用絵（元の台の絵を借りない）`);
  assert.match(shopArt, new RegExp(`"${id}": \\{ url: new URL\\("\\.\\./\\.\\./img/shop/equipment-v2/${id}\\.webp"`), `${id}: 店とくじの札に専用絵を出す`);
  assert(fs.existsSync(new URL(`remake/img/shop/equipment-v2/${id}.webp`, root)), `${id}: 専用絵の WebP がある`);
  assert(!names.has(e.name), `${id}: 名前が既存の品と重ならない`);
  const prize = sPrizes.find(p => p.equipId === id);
  assert.equal(prize.name, e.name);
  assert.equal(prize.sell, best.sell_price, `${id}: 景品評価＝元の台の中古評価（非売品の数え方）`);
}
assert.deepEqual(equipmentList.filter(e => e.kuji_only).map(e => e.name), ["MELTY PUFF柄の特注台", "橙須限定色の特注台", "名入れの特注台（逢縁）"]);
// 取りやめたドバイの葉（DBS03）は入れない。ほかの景品は店にある品だけ（kuji_tiers.mjs が参照先を確かめる）。
for (const p of [...g.prizes, g.lastOne]) for (const id of [p.flavorId, ...(p.flavors || []).map(f => f.id)].filter(Boolean)) {
  assert(!["absal_double_apple", "absal_mint", "dobaj_double_apple", "dobaj_mint"].includes(id), `${p.name}: ドバイの葉を入れない`);
  assert(flavors[id]?.price > 0, `${p.name}: ${id} は店の葉`);
}

// 家シーシャ: 限定の台だけを持っていれば、それを使い、地の文は元の特注台のもの。
let s = core.newGame();
s.owned.push("stand_custom_engraved");
assert.deepEqual([rig.homeRig().id, rig.homeRig().xp], ["stand_custom_engraved", 9]);
assert.match(home.homeShishaDialogue({ mix: { lemon: 12 } }, rig.homeRig(), () => 0).lines[0].text, /特注の台/);

// ---------------------------------------------------------------- 2. くじ券の出し入れ
const T = tickets;
assert.equal(T.kujiTickets({}), 0);
for (const bad of [-3, 1.5, "2", null, NaN]) assert.equal(T.kujiTickets({ kujiTickets: bad }), 0, `壊れた値 ${bad} は0枚`);
let w = { kujiTickets: 0 };
assert.equal(T.grantKujiTickets(1, "kuji_dupe", w), 1);
assert.equal(w.kujiTickets, 1);
for (const [n, reason] of [[0, "x"], [-1, "x"], [1.5, "x"], ["1", "x"], [1, ""], [1, undefined]]) {
  assert.equal(T.grantKujiTickets(n, reason, w), 0, `渡さない: ${n} ${reason}`);
  assert.equal(w.kujiTickets, 1);
}
assert.equal(T.grantKujiTickets(500, "delivery", w), KUJI_TICKET_MAX - 1, "上限を超える分は渡さない");
assert.equal(w.kujiTickets, KUJI_TICKET_MAX);
assert.equal(T.grantKujiTickets(1, "delivery", w), 0);
w = { kujiTickets: 1 };
assert.equal(T.spendKujiTicket(w), true);
assert.equal(w.kujiTickets, 0);
assert.equal(T.spendKujiTicket(w), false, "0枚では使えない");
assert.equal(w.kujiTickets, 0, "0枚より下にしない");
w = { kujiTickets: -4 };
assert.equal(T.spendKujiTicket(w), false);
assert.equal(T.kujiTickets(w), 0);
// 既定はゲームの state。第5章の寄り道（出張シーシャ・店めぐり帳）はこの形で呼ぶ。
s = core.newGame();
assert.equal(s.kujiTickets, 0, "新しいゲームは0枚");
assert.equal(T.grantKujiTickets(2, "delivery"), 2);
assert.equal(core.state.kujiTickets, 2);

// ---------------------------------------------------------------- 3. 実際の kuji.js: 重複はくじ券1枚、くじ券で1回引く
const source = readText("remake/js/daily/kuji.js");
const pick = (re, label) => { const m = source.match(re)?.[0]; assert(m, `kuji.js の ${label} が見つかる`); return m; };
const grantSource = pick(/^function grant\(prize\) \{[\s\S]*?^\}\n/m, "grant()");
const takeSource = pick(/^function takeTicket\(g, box, pay = "money"\) \{[\s\S]*?^\}\n/m, "takeTicket()");
const dupeSource = pick(/^const withDupe = [^\n]*\n/m, "withDupe");
const ticketSource = readText("remake/js/daily/kuji-tickets.js").replace(/^import .*;\s*$/gm, "").replace(/\bexport /g, "");
function setup({ owned = [], money = 0, tickets = 0 } = {}) {
  const ctx = {
    DB: { equipById: equipment }, KUJI_TICKET_MAX, FLAVOR_BOX_GRAMS: 50, saves: 0,
    state: { owned: [...owned], goods: [], flavorStock: {}, money, kujiTickets: tickets, day: 7 },
    addMoney(n) { ctx.state.money += n; },
    addFlavorStock(id, grams) { ctx.state.flavorStock[id] = (ctx.state.flavorStock[id] || 0) + grams; },
    spendableMoney: st => st.money,
    save() { ctx.saves += 1; },
  };
  vm.runInNewContext(`${ticketSource}${grantSource}${dupeSource}${takeSource}this.grant = grant; this.withDupe = withDupe; this.takeTicket = takeTicket;`, ctx);
  return ctx;
}
const melty = sPrizes.find(p => p.equipId === "stand_custom_melty");
let t = setup({ money: 1000 });
assert.equal(t.grant(melty), null, "初めての限定の台は持ち物へ");
assert.deepEqual([...t.state.owned], ["stand_custom_melty"]);
const dupe = t.grant(melty);
assert.deepEqual({ ...dupe }, { dupTicket: 1 }, "持っている限定の台はくじ券1枚");
assert.equal(t.state.money, 1000, "お金にしない");
assert.equal(t.state.kujiTickets, 1);
assert.deepEqual([...t.state.owned], ["stand_custom_melty"], "同じ台を二つ持たない");
const card = t.withDupe(melty, dupe);
assert.equal(card.dupTicket, 1);
assert.equal(card.dupCash, undefined);
assert.equal(t.withDupe(melty, null), melty);
assert.equal(t.withDupe(melty, 7000).dupCash, 7000, "ほかの品は従来どおり買い取り額");
t = setup({ owned: ["stand_custom_tosu"], tickets: KUJI_TICKET_MAX });
assert.deepEqual({ ...t.grant(sPrizes.find(p => p.equipId === "stand_custom_tosu")) }, { dupTicket: 0 }, "上限ならくじ券は増えない");
assert.equal(t.state.kujiTickets, KUJI_TICKET_MAX);
assert.equal(t.state.money, 0, "上限でもお金にしない");
t = setup({ owned: ["stand_walnut"] });
assert.equal(t.grant(g.prizes.find(p => p.equipId === "stand_walnut")), 50000, "限定台くじの店の台は従来どおり中古買い取り額");
assert.equal(t.state.kujiTickets, 0);

// くじ券で引く: 1枚減り、お金は動かない。0枚・ほかのくじには使えない。お金で引くのは従来どおり。
const boxOf = (grade, first) => {
  const order = grade.prizes.flatMap((p, i) => Array(p.count).fill(i));
  const at = grade.prizes.findIndex(p => p.equipId === first);
  if (at >= 0) { order.splice(order.indexOf(at), 1); order.unshift(at); }
  return { order, drawn: 0, emptyDay: null, prizes: structuredClone(grade.prizes), lastOne: structuredClone(grade.lastOne) };
};
t = setup({ money: 50000, tickets: 1 });
let box = boxOf(g, "stand_custom_engraved");
let got = t.takeTicket(g, box, "ticket");
assert.equal(got.prize.equipId, "stand_custom_engraved");
assert.equal(box.drawn, 1);
assert.equal(t.state.kujiTickets, 0, "くじ券を1枚使った");
assert.equal(t.state.money, 50000, "お金は使わない");
assert.equal(t.saves, 1, "引いた直後に保存");
assert.equal(t.takeTicket(g, box, "ticket"), undefined, "0枚では引けない");
assert.equal(box.drawn, 1);
assert.equal(t.state.kujiTickets, 0);
assert.equal(t.state.money, 50000);
t.state.kujiTickets = 1;
const other = kuji.grades.g10000, otherBox = boxOf(other);
assert.equal(t.takeTicket(other, otherBox, "ticket"), undefined, "くじ券は限定台くじだけ");
assert.equal(otherBox.drawn, 0);
assert.equal(t.state.kujiTickets, 1, "使えないくじでは減らない");
got = t.takeTicket(g, box);
assert(got, "お金で引ける");
assert.equal(t.state.money, 40000, "1回10,000円");
assert.equal(t.state.kujiTickets, 1, "お金で引いてもくじ券は減らない");
// 引き切った箱にはくじ券を使わない。
box.drawn = box.order.length;
assert.equal(t.takeTicket(g, box, "ticket"), undefined);
assert.equal(t.state.kujiTickets, 1);

// ---------------------------------------------------------------- 4. SAVE/LOAD: 周回の中ではくじ券・限定の台・箱を保つ。壊れた値は0
s = core.newGame();
Object.assign(s, { chapter: 5, kujiTickets: 3 });
s.owned.push("stand_custom_melty");
s.kuji.g20000 = { order: [0, 1, 2], drawn: 1, emptyDay: null, prizes: [], lastOne: null };
core.save();
s = core.load();
assert.equal(s.kujiTickets, 3, "くじ券はSAVE/LOADで残る");
assert(s.owned.includes("stand_custom_melty"));
assert.equal(s.kuji.g20000.drawn, 1);
for (const [raw, want] of [[-2, 0], ["5", 0], [2.5, 0], [500, KUJI_TICKET_MAX], [undefined, 0]]) {
  const saved = JSON.parse(localStorage.getItem(core.SAVE_KEY));
  if (raw === undefined) delete saved.kujiTickets; else saved.kujiTickets = raw;
  localStorage.setItem(core.SAVE_KEY, JSON.stringify(saved));
  assert.equal(core.load().kujiTickets, want, `保存の値 ${raw} → ${want}`);
}

// ---------------------------------------------------------------- 5. #2455: 火種を付けない・どの条件からも参照しない
{
  const emptied = grade => ({ order: [0, 0], drawn: 2, emptyDay: 9 });
  const g1 = growth.newGrowth();
  const limitedOnly = growth.claimPlayRewards(g1, { chapter: 5, flags: {}, trpg: { cleared: {} }, kuji: { g20000: emptied() } });
  assert.deepEqual(limitedOnly, [], "限定台くじを引き切っても火種は無い");
  assert(!Object.keys(g1.rewards).some(k => k.includes("g20000")), "受け取りの記録も作らない");
  const g2 = growth.newGrowth();
  const control = growth.claimPlayRewards(g2, { chapter: 5, flags: {}, trpg: { cleared: {} }, kuji: { g10000: emptied(), g20000: emptied() } });
  assert.deepEqual(control.map(x => x.label), ["くじのラストワン賞"], "ほかの箱のラストワン賞の火種は従来どおり（1つだけ）");
}
// 限定の台・限定台くじ・くじ券を参照してよいファイルは、くじと保存・周回の仕組みだけ。
// 心得の盤（growth-board-data.js）・大会・エンディング・進行・実績は参照しない。
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(new URL(dir, root), { withFileTypes: true })) {
    const rel = `${dir}${e.name}`;
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(`${rel}/`, out); }
    else if (/\.(js|mjs|json)$/.test(e.name)) out.push(rel);
  }
  return out;
};
const files = [...walk("remake/js/"), ...walk("remake/data/"), ...walk("data/")];
assert(files.length > 100, "走査が働いている");
const RULES = [
  // shop-equipment-art.js は tools/build_shop_equipment_art.py が作る絵の対応表（絵の場所だけで、性能・入手の判定は無い）
  [new RegExp(`\\b(${[...onlyIds, "g20000"].join("|")})\\b`), ["data/equipment.json", "data/kuji.json", "remake/js/core/rules.js", "remake/js/daily/shop-equipment-art.js"]],
  [/\b(KUJI_LIMITED_GRADES|KUJI_ONLY_EQUIPMENT)\b/, ["remake/js/core/rules.js", "remake/js/core/carry.js", "remake/js/core/cycle-start.js", "remake/js/core/growth.js", "remake/js/core/growth-board-data.js"]],
  // くじ券を渡してよい寄り道: 第5章の出張シーシャの依頼（DLV・chapters/ch5-catering.js）と各地の店めぐり帳（MGR・chapters/ch5-shop-stamps.js）。
  // どちらもお金・火種は動かさない
  [/\b(kujiTickets|grantKujiTickets|spendKujiTicket|KUJI_TICKET_MAX)\b|kuji-tickets\.js/, ["remake/js/core/rules.js", "remake/js/core/state.js", "remake/js/core/carry.js", "remake/js/core/cycle-start.js", "remake/js/daily/kuji-tickets.js", "remake/js/daily/kuji.js",
    "remake/js/chapters/ch5-catering.js", "remake/js/chapters/ch5-shop-stamps.js"]],
  [/\bkuji_only\b/, ["data/equipment.json", "remake/js/daily/kuji.js", "remake/js/daily/shop.js"]],
];
for (const [re, allowed] of RULES) {
  const hits = files.filter(f => re.test(readText(f)));
  assert.deepEqual(hits.filter(f => !allowed.includes(f)), [], `${re} を参照してよいのは ${allowed.join("・")} だけ`);
}
// 心得の盤の定義には名前（説明の注記）しか出てこない。growth.js では「火種を付けない」除外にだけ使う。
assert.doesNotMatch(readText("remake/js/core/growth-board-data.js").replace(/\/\*\*[\s\S]*?\*\//g, ""), /KUJI_LIMITED_GRADES|KUJI_ONLY_EQUIPMENT/);
const growthUses = readText("remake/js/core/growth.js").split("\n").filter(l => /KUJI_LIMITED_GRADES|KUJI_ONLY_EQUIPMENT/.test(l) && !/^\s*import /.test(l));
assert.deepEqual(growthUses.map(l => l.trim()), ["if (KUJI_LIMITED_GRADES.includes(grade)) continue;"], "growth.js は限定台くじを火種から外すだけ");

console.log("[kuji limited] PASS: ch5 tier data, 3 kuji-only stands = top shop stand, dupe→ticket, ticket draw, save/load, no hidane / no references (#2455)");
