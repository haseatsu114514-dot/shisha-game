// 第5章の各地の店めぐり帳（MGR・chapters/ch5-shop-stamps-model.js）の決まりを、ブラウザ無しで確かめる。
// 必須の店が第5章の地図に必ず出ること、任意の店が会っている保存で出ること・判子は第5章で一店に一つ・
// 地域と全部がそろった時のくじ券の枚数（お金は動かさない）・周回で持ち越さないこと・#2455（火種・心得の盤・大会・
// エンディング・進行の条件につながない）。実際の来店・LIMEの帳面は remake/test/browser/ch5_shop_stamps.mjs。
// quick CI は画像を取得しないので、画像のファイルは読まない。
// node remake/test/ch5_shop_stamps.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const root = new URL("../../", import.meta.url);
const readText = file => fs.readFileSync(new URL(file, root), "utf8");
const M = await import("../js/chapters/ch5-shop-stamps-model.js");
const { grantKujiTickets } = await import("../js/daily/kuji-tickets.js");
const { KUJI_TICKET_MAX } = await import("../js/core/rules.js");
const carry = await import("../js/core/carry.js");
const core = await import("../js/core/state.js");
const { spotDetailLabel, isUnlocked } = await import("../js/daily/spots.js");
const daily = await import("../js/chapters/ch5-daily.js");
// SHISHARK の行き先は台本データ（samechan.json の spot）から作る。地図の判定を本物と同じにするため読み込んでおく
const { DB } = await import("../js/core/data.js");
DB.samechan = JSON.parse(readText("data/dialogue/samechan.json"));

const START = 40;
const flat = M.SHOP_STAMP_REGIONS.flatMap(region => region.shops.map(shop => ({ ...shop, region: region.id })));

// ---------------------------------------------------------------- 1. 必須店は第5章の地図に必ず出る。任意店は条件が合う保存で出る
// 「必ず会う人」＝本編の大会で必ず面識が付く人（第1章・第2章・第3章の大会の markMet）。好感度・運の要る出会いは数えない。
const mandatoryMet = (() => {
  const ch1 = readText("remake/js/chapters/ch1.js").match(/for \(const id of \[([^\]]+)\]\) markMet\(id\)/);
  const ch2 = readText("remake/js/chapters/ch2-tournament.js");
  const ch3 = readText("remake/js/chapters/ch3-tournament.js").match(/name === "tournament_day" \? \[([^\]]+)\]/);
  assert(ch1 && ch3, "第1章・第3章の大会で面識を付ける行がある");
  assert.match(ch2, /markMet\("ageha"\)/, "第2章の大会であげはに会う");
  const ch2Loop = ch2.match(/for \(const who of \[([^\]]+)\]\) markMet\(who\)/);
  assert(ch2Loop, "第2章の大会で神崎・クラウドに会う");
  const ids = text => [...text.matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
  return new Set([...ids(ch1[1]), "ageha", ...ids(ch2Loop[1]), ...ids(ch3[1])]);
})();
for (const id of ["naru", "adam", "minto", "ageha", "kumicho", "rei", "steve", "volk"]) assert(mandatoryMet.has(id), `${id} には本編で必ず会う`);

// C.STATION の地図の解放（daily/spots.js の isUnlocked）は、第1章の初日にスミさんに頼まれて KEMURIKUSA へ偵察に行った印。
// 偵察は初日の案内つきの用事（daily/calendar.js）で、そのあと C.STATION で大会の参加登録をする。
assert.match(readText("remake/js/daily/calendar.js"), /guide: \{ pin: "naru", text: "KEMURIKUSAへ偵察に。/, "第1章の初日に KEMURIKUSA へ案内される");

/** 第5章の自由行動の保存（本編で必ず会う人だけに会っている。サメちゃん・ヌールなど任意の出会いは無し）。 */
function freeSave({ met = [...mandatoryMet], region = "home", fields = {}, scouted = true } = {}) {
  const value = core.newState();
  Object.assign(value, { chapter: 5, day: START + 3, slot: 0, phase: "daily", money: 50000, seed: 0, kujiTickets: 0, ...fields });
  value.flags = { ...value.flags, _ch5: { startDay: START, part: "free" }, _ch2_region: region, _ch5_region_started: true,
    ...(scouted ? { _spot_guide_naru: true } : {}) };
  value.met = Object.fromEntries(met.map(id => [id, true]));
  return value;
}
const regionSpots = (value, region) => {
  core.setState(value);
  value.flags._ch2_region = region;
  return { home: daily.chapterFiveHomeSpots, widehanga: daily.chapterFiveCitySpots, tokyo: daily.chapterFiveTokyoSpots,
    dubai: daily.chapterFiveDubaiSpots }[region]();
};
assert.deepEqual(M.SHOP_STAMP_REGIONS.map(r => r.id), ["home", "widehanga", "tokyo", "dubai"], "地図の地域と同じ並び");
assert.equal(M.SHOP_STAMP_TOTAL, flat.filter(s => !s.optional).length);
assert.equal(new Set(flat.map(s => s.id)).size, flat.length, "店のIDが重ならない");
assert.deepEqual(M.SHOP_STAMP_REGIONS.map(r => r.shops.length), [5, 3, 2, 2]);
assert.equal(flat.filter(s => s.optional).length, 2);
for (const region of M.SHOP_STAMP_REGIONS) {
  // 昼と夜、どの曜日でも地図に出る（定休日は週に一日まで。地図からは消えず、別の日に行ける）
  for (const slot of [0, 1]) for (let dow = 0; dow < 7; dow++) {
    const value = freeSave({ fields: { slot, day: START + 7 + dow } });
    const spots = regionSpots(value, region.id);
    for (const shop of region.shops.filter(shop => !shop.optional)) {
      const spot = spots.find(s => s.id === shop.id);
      assert(spot, `${shop.label}（${shop.id}）が第5章の${region.label}の地図に出る（slot ${slot}・day ${value.day}）`);
      assert(isUnlocked(spot), `${shop.label}: 地図で「？？？」にならない`);
      assert.equal(spot.label, shop.label, `${shop.id}: 帳面の名前は地図の店名と同じ`);
      assert((spot.cost || 0) > 0, `${shop.label}: 代金を払って一台を吸う店`);
      assert(!spot.unavailable, `${shop.label}: 行けない理由が付いていない`);
    }
  }
}
{
  const value = freeSave({ scouted: false });
  core.setState(value);
  assert.equal(isUnlocked(regionSpots(value, "home").find(s => s.id === "c_station")), false, "C.STATION は第1章の偵察の印で地図に出る");
  value.spotVisits = { c_station: 1 };
  assert.equal(isUnlocked(regionSpots(value, "home").find(s => s.id === "c_station")), true, "大会の参加登録の来店でも出る");
}
// 地図のシーシャ屋で帳面に無いのは、自分が働く店だけ
{
  const EXCLUDED = {
    tonari: "はじめのバイト先",
    ch5_tokyo_mukai: "ムカイさんの店のシフト（働く店）",
  };
  const shishaShops = (value, region) => regionSpots(value, region).filter(spot => isUnlocked(spot) && (
    /（シーシャ屋）$/.test(spotDetailLabel(spot)) || ["tokyo", "dubai"].includes(region) && ((spot.cost || 0) > 0 || spot.shift)));
  // 出会いの多い保存（サメちゃん・ヌールにも会っている・ジムの会員）でも、帳面の外は上の店だけ
  const seen = [];
  const rich = freeSave({ met: [...mandatoryMet, "samechan", "noor"], fields: { slot: 1 } });
  rich.flags._gym_member = true;
  for (const region of M.SHOP_STAMP_REGIONS) {
    const extra = shishaShops(rich, region.id).map(s => s.id).filter(id => !M.shopStampEntry(id));
    for (const id of extra) assert(Object.hasOwn(EXCLUDED, id), `${region.label}の ${id} は帳面に載せるか、載せない理由を書く`);
    seen.push(...extra);
  }
  assert.deepEqual(seen.sort(), ["ch5_tokyo_mukai", "tonari"], "帳面の外のシーシャ屋が、実際に地図に出ている");
  for (const [region, id] of [["home", "shishark"], ["dubai", "ch4_dubai_tour_desk"]]) {
    const spot = regionSpots(rich, region).find(s => s.id === id);
    assert(spot && !spot.unavailable, `${id} は会っている保存で来店できる`);
  }
  // 必ず会う人だけの保存では、SHISHARK は地図に出ない（帳面の完成には不要）
  const plain = freeSave();
  assert(!regionSpots(plain, "home").some(s => s.id === "shishark"), "サメちゃんに会っていなければ SHISHARK は出ない");
  for (const id of Object.keys(EXCLUDED)) assert.equal(M.shopStampEntry(id), null, `${id}（${EXCLUDED[id]}）は載せない`);
  for (const id of ["shishark", "ch4_dubai_tour_desk"]) assert(M.shopStampEntry(id)?.shop.optional, `${id} は任意の店`);
}
// 東京とドバイには第5章でいつでも行ける（東京は配送便・ドバイは最初の手紙）。第5章の遠出の決まりと同じ
{
  const { chapterFiveTokyoPin, TO_TOKYO_SPOT } = await import("../js/chapters/ch5-tokyo.js");
  const { chapterFiveDubaiPin } = await import("../js/chapters/ch5-dubai.js");
  const value = freeSave();
  core.setState(value);
  assert(!chapterFiveTokyoPin(value).unavailable, "昼なら東京へ行ける");
  assert(!chapterFiveDubaiPin(value).unavailable, "最初の手紙で、ドバイへ行ける");
  assert(regionSpots(value, "home").some(s => s.id === TO_TOKYO_SPOT.id));
}

// ---------------------------------------------------------------- 2. 判子: 第5章で、一店に一つ
const grantTo = value => n => grantKujiTickets(n, "shop_stamps", value);
{
  for (const chapter of [1, 2, 3, 4]) {
    const value = freeSave({ fields: { chapter } });
    assert.equal(M.recordShopStamp(value, "naru", grantTo(value)), null, `第${chapter}章の来店は数えない`);
    assert(!(M.SHOP_STAMPS_FLAG in value.flags), "記録も作らない");
  }
  const value = freeSave();
  for (const id of ["tonari", "cafe", "kannon", "ch5_tokyo_mukai", "ch5_dubai_sheikh", "ch5_dubai_souq", "", null, undefined]) {
    assert.equal(M.recordShopStamp(value, id, grantTo(value)), null, `帳面に無い行き先（${id}）`);
  }
  const first = M.recordShopStamp(value, "adam", grantTo(value));
  assert.deepEqual({ ...first, shop: first.shop.id, region: first.region.id },
    { shop: "adam", region: "home", count: 1, total: M.SHOP_STAMP_TOTAL, firstStamp: true, regionDone: false, complete: false, tickets: 0 });
  assert.deepEqual(M.shopStampsState(value), { shops: { adam: START + 3 }, rewards: {}, opened: false }, "押した日を記録する");
  assert.equal(M.recordShopStamp(value, "adam", grantTo(value)), null, "二度目の来店は何も増えない");
  value.day += 1;
  assert.equal(M.recordShopStamp(value, "adam", grantTo(value)), null, "別の日でも増えない");
  assert.equal(value.kujiTickets, 0);
  assert.equal(value.money, 50000, "お金は動かない");
  const progress = M.shopStampsProgress(value);
  assert.equal(progress.count, 1);
  assert.deepEqual(progress.regions[0].shops.map(s => s.stamped), [false, true, false, false, false]);
  // 壊れた記録は空として読む（知らない店・鍵・日付でない値は数えない）
  for (const broken of [null, 5, "x", [], { shops: [], rewards: "1" }, { shops: { nope: 3, naru: "3" }, rewards: { nowhere: 1, home: -1 } }]) {
    const v = freeSave();
    v.flags[M.SHOP_STAMPS_FLAG] = broken;
    assert.deepEqual(M.shopStampsState(v), { shops: {}, rewards: {}, opened: false }, JSON.stringify(broken));
    assert(M.recordShopStamp(v, "naru", grantTo(v)), "壊れた記録でも判子は押せる");
  }
}

// ---------------------------------------------------------------- 3. そろった時のくじ券（地域ごとに1枚・全部で+1枚・任意店は各1枚）
{
  assert.equal(M.REGION_TICKETS, 1);
  assert.equal(M.COMPLETE_BONUS_TICKETS, 1);
  assert.equal(M.OPTIONAL_SHOP_TICKETS, 1);
  const value = freeSave();
  let calls = 0;
  const grant = n => { calls += 1; return grantKujiTickets(n, "shop_stamps", value); };
  const order = ["naru", "ch5_tokyo_steve", "adam", "minto", "ch5_dubai_alley", "ch2_ageha", "ch2_kumicho", "ch5_tokyo_volk", "ch2_rei", "c_station"];
  assert.deepEqual([...order].sort(), flat.filter(s => !s.optional).map(s => s.id).sort());
  const got = order.map(id => {
    const before = value.kujiTickets;
    const result = M.recordShopStamp(value, id, grant);
    assert.equal(value.kujiTickets - before, result.tickets, `${id}: 実際に増えた枚数を返す`);
    return [id, result.regionDone, result.complete, result.tickets];
  });
  assert.deepEqual(got, [
    ["naru", false, false, 0], ["ch5_tokyo_steve", false, false, 0], ["adam", false, false, 0], ["minto", false, false, 0],
    ["ch5_dubai_alley", true, false, 1], // ドバイは一店でそろう
    ["ch2_ageha", false, false, 0], ["ch2_kumicho", false, false, 0],
    ["ch5_tokyo_volk", true, false, 1], ["ch2_rei", true, false, 1],
    ["c_station", true, true, 2], // 地元の1枚＋全部そろった1枚
  ]);
  assert.equal(value.kujiTickets, 4 * M.REGION_TICKETS + M.COMPLETE_BONUS_TICKETS, "必須10店で5枚");
  assert.equal(calls, 5, "地域の4回と全部の1回だけ渡す");
  assert.equal(value.money, 50000, "お金は動かない");
  assert.deepEqual(M.shopStampsState(value).rewards, { dubai: 1, tokyo: 1, widehanga: 1, home: 1, all: 1 });
  const progress = M.shopStampsProgress(value);
  assert.equal(progress.complete, true);
  assert(progress.regions.every(r => r.complete && r.rewarded));
  for (const id of order) assert.equal(M.recordShopStamp(value, id, grant), null, "そろった後は何も増えない");
  assert.equal(value.kujiTickets, 5);
  for (const id of ["shishark", "ch4_dubai_tour_desk"]) {
    const extra = M.recordShopStamp(value, id, grant);
    assert.equal(extra.tickets, 1, `${id}: 任意の店は1枚`);
    assert.equal(extra.count, 10, "必須の判子数は増えない");
  }
  assert.equal(value.kujiTickets, 7, "12店で最大7枚");
  assert.equal(M.shopStampsProgress(value).optionalCount, 2);
}
{
  const value = freeSave();
  const extra = M.recordShopStamp(value, "shishark", grantTo(value));
  assert.deepEqual([extra.count, extra.firstStamp, extra.tickets], [0, true, 1], "任意店が初来店でも案内と券を渡す");
  assert.equal(M.shopStampsProgress(value).complete, false);
  assert.equal(M.shopStampsProgress(value).optionalCount, 1);
}
{
  // 受け取りの記録がある地域・全部は、二度渡さない（記録だけ先に残った保存）
  const value = freeSave();
  value.flags[M.SHOP_STAMPS_FLAG] = { shops: { naru: 1, adam: 1, minto: 1 }, rewards: { home: 1 } };
  assert.equal(M.recordShopStamp(value, "c_station", grantTo(value)).tickets, 0);
  assert.equal(value.kujiTickets, 0);
  // 上限を超える分は渡さず、実際の枚数を記録する
  const full = freeSave({ fields: { kujiTickets: KUJI_TICKET_MAX } });
  const result = M.recordShopStamp(full, "ch5_dubai_alley", grantTo(full));
  assert.deepEqual([result.regionDone, result.tickets], [true, 0]);
  assert.equal(full.kujiTickets, KUJI_TICKET_MAX);
  assert.deepEqual(M.shopStampsState(full).rewards, { dubai: 0 }, "持ちきれなかった分は、あとから渡し直さない");
}
{
  // 帳面を開いた印（LIMEの行の赤い丸）。判子の記録は変えない
  const value = freeSave();
  M.recordShopStamp(value, "naru", grantTo(value));
  assert.equal(M.shopStampsProgress(value).opened, false);
  assert.equal(M.markShopStampsOpened(value), true);
  assert.equal(M.markShopStampsOpened(value), false, "二度目は変わらない");
  assert.deepEqual(M.shopStampsState(value), { shops: { naru: START + 3 }, rewards: {}, opened: true });
  M.recordShopStamp(value, "adam", grantTo(value));
  assert.equal(M.shopStampsState(value).opened, true, "判子を押しても開いた印は残る");
}

// ---------------------------------------------------------------- 4. 周回（NG+）: 帳面もくじ券も持ち越さない
{
  assert.equal(carry.classifyFlag(M.SHOP_STAMPS_FLAG), "progression");
  assert.equal(carry.flagVerdict(M.SHOP_STAMPS_FLAG), "reset");
  assert.equal(carry.STATE_KEY_RULES.kujiTickets.verdict, "reset");
  const s = core.newGame();
  s.chapter = 5;
  s.kujiTickets = 6;
  s.flags[M.SHOP_STAMPS_FLAG] = { shops: { naru: 9 }, rewards: { home: 1 }, opened: true };
  const pkg = carry.buildCarryPackage(s);
  assert(!(M.SHOP_STAMPS_FLAG in pkg.flags), "帳面は持ち越さない");
  assert(!("kujiTickets" in pkg), "くじ券は持ち越さない");
}

// ---------------------------------------------------------------- 5. #2455: 火種・心得の盤・大会・エンディング・進行の条件につながない
{
  const code = file => readText(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const file of ["remake/js/chapters/ch5-shop-stamps.js", "remake/js/chapters/ch5-shop-stamps-model.js"]) {
    const src = code(file);
    assert.doesNotMatch(src, /addMoney|spendableMoney|\.money\b/, `${file}: お金を動かさない`);
    assert.doesNotMatch(src, /growth|hidane|火種|giveColored|PLAY_REWARDS|claimPlayRewards|award\w*Exp|earnSceneCompletion|earnStat|addStamina/,
      `${file}: 火種・経験値・能力・体力を足さない（来店の分は店のいつもの来店が付ける）`);
    assert.doesNotMatch(src, /gainAffinity|affinity\[|lovers|romance/, `${file}: 好感度・恋愛を動かさない`);
    assert.doesNotMatch(src, /tournament|ending|chapterFiveProgress|completeChapterFiveScene/, `${file}: 大会・エンディング・進行を動かさない`);
  }
  // 帳面の記録・決まりを参照してよいのは、帳面の仕組みと第5章の日常ループ・周回の分類だけ
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(new URL(dir, root), { withFileTypes: true })) {
      const rel = `${dir}${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(`${rel}/`, out); }
      else if (/\.(js|json)$/.test(e.name)) out.push(rel);
    }
    return out;
  };
  const files = [...walk("remake/js/"), ...walk("remake/data/"), ...walk("data/")];
  assert(files.length > 100, "走査が働いている");
  const allowed = ["remake/js/chapters/ch5-shop-stamps.js", "remake/js/chapters/ch5-shop-stamps-model.js", "remake/js/chapters/ch5-daily.js",
    "remake/js/core/carry.js"];
  const hits = files.filter(f => /ch5[-_]shop[-_]stamps|SHOP_STAMP|shopStamp|ShopStamp/.test(readText(f)));
  assert.deepEqual(hits.filter(f => !allowed.includes(f)).sort(), [], "ほかの仕組み（心得の盤・大会・エンディング・進行）から参照しない");
  // 日常ループの差し込み口は、行き先の行動を終えた後の一つだけ（判子の判定は章の側が持つ）
  const calendar = readText("remake/js/daily/calendar.js").split("\n").filter(line => /afterSpot/.test(line));
  assert.equal(calendar.filter(line => !/^\s*\/\//.test(line)).length, 1, "calendar.js は afterSpot を一度だけ呼ぶ");
}

console.log("[ch5 shop stamps] PASS: required shops on the ch5 maps, optional shops, one stamp per shop, tickets (1×4+1+2 optional, no money), NG+ reset, #2455");
