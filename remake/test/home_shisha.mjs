// Issue #638: 家シーシャ（寝る前の一服）。行動の枠を使わないちょい足し・一番低い能力・台による伸び・葉12g・体力 −6。
// node remake/test/home_shisha.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const { DB } = await import("../js/core/data.js");
const { newGame, STAT_KEYS, SCHEMA, SAVE_KEY, save: saveGame, load: loadGame, saveToSlot, loadFromSlot } = await import("../js/core/state.js");
const { mixPercents } = await import("../js/craft/mix-ratio.js");
let state;
const home = await import("../js/daily/home-shisha.js");
const rig = await import("../js/daily/home-rig.js");

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const flavors = read("../../data/flavors.json").flavors;
const equipment = read("../../data/equipment.json").equipment;
DB.flavors = flavors;
DB.flavorById = Object.fromEntries(flavors.map((f) => [f.id, f]));
DB.equipment = equipment;
DB.equipById = Object.fromEntries(equipment.map((e) => [e.id, e]));
DB.recipes = read("../../data/recipes.json").recipes;
DB.ngMixes = read("../../data/ng_mixes.json").ng_mixes;
DB.dialogues = {};

// データ: スミさんの卓上台（ミャア）と、くじの大会公式モデルの台。どちらも非売品・売れない
const sumiRig = DB.equipById[rig.SUMI_RIG], proRig = DB.equipById[rig.PRO_RIG];
// D01: 受取で見せるのは、採用済みで自室の机上にも置いている同じ台。
{
  const { sceneArtUrls } = await import("../js/core/scene-art.js");
  const { img } = await import("../js/core/data.js");
  const oldManifest = DB.manifest;
  DB.manifest = read("../data/manifest.json");
  const s = newGame(); s.owned.push(rig.SUMI_RIG);
  assert(sceneArtUrls("img/backgrounds/bg_home_day.webp").includes(img(rig.SUMI_RIG_IMAGE)), "受取と自室で同じ採用済み台を使う");
  assert(DB.manifest.webp.includes(rig.SUMI_RIG_IMAGE), "既存の配信用WebPを使う");
  // CI の quick ジョブは画像を取得しない（sparse checkout）。画像がある環境でだけ中身を確かめる。
  const originalUrl = new URL(`../../assets/${rig.SUMI_RIG_IMAGE}`, import.meta.url);
  if (fs.existsSync(originalUrl)) {
    const original = fs.readFileSync(originalUrl);
    assert.equal(original.subarray(1, 4).toString(), "PNG", "LFSポインタではなく画像実体がある");
  }
  const servedUrl = new URL(`../img/${rig.SUMI_RIG_IMAGE.replace(/\.png$/, ".webp")}`, import.meta.url);
  if (fs.existsSync(servedUrl)) assert.equal(fs.readFileSync(servedUrl).subarray(8, 12).toString(), "WEBP");
  DB.manifest = oldManifest;
}
assert.equal(sumiRig.name, "ミャア 卓上台");
assert.equal(proRig.name, "大会公式モデルの台");
for (const e of [sumiRig, proRig]) { assert.equal(e.chapter_min, 1); assert(e.unsellable && e.not_for_sale, e.id); }
assert.equal(sumiRig.home_growth, 0.5);
assert.equal(proRig.home_growth, 0.75);
const kuji = read("../../data/kuji.json").grades.g1000;
assert.equal(kuji.chapterMin, 1, "台が当たるくじは第1章から");
assert.equal(kuji.prizes.find((p) => p.rank === "S").equipId, rig.PRO_RIG);
const sumiScene = read("../../data/dialogue/ch1_sumi.json").dialogues.find((d) => d.dialogue_id === rig.RIG_SCENE);
assert(sumiScene?.lines.some((l) => l.text?.includes("ミャア")), "スミさんがミャアの卓上台を譲る場面");
assert.equal(sumiScene.lines.find((l) => l.speaker === "sumi").text, "これやる", "スミさんの最初の一言は「これやる」");
// 中盤の修行（DAY7 の中間準備）の最後に渡す
const ch1Source = fs.readFileSync(new URL("../js/chapters/ch1.js", import.meta.url), "utf8");
const midPrep = ch1Source.slice(ch1Source.indexOf("async function midPreparation"), ch1Source.indexOf("async function rehearsal"));
assert(midPrep.includes("giveSumiRig("), "中間準備の最後にスミさんが台を渡す");

// D03: 受取日だけの自室演出。体力や葉の有無は誘いの条件と分ける。
{
  const scene = read("../../data/dialogue/ch1_sumi.json").dialogues.find(d => d.dialogue_id === rig.RIG_HOME_SCENE);
  assert.equal(scene.metadata.bg, "res://assets/backgrounds/bg_home_night.png");
  assert.equal(scene.lines.length, 2);
  assert(scene.lines.every(l => l.speaker === "" && l.text.length <= 48 && !l.text.includes("\n")));
  assert(scene.lines.some(l => l.text.includes("卓上台") && l.text.includes("机")));
  const s = newGame(); Object.assign(s, { day: 2, slot: 2 });
  assert.equal(rig.sumiRigHomecomingDue(), false, "受取前");
  await rig.giveEarlyHomeRig();
  assert.equal(s.flags._sumi_rig_received_day, "1:2", "D01の受取確定と同時に記録する");
  assert.equal(rig.sumiRigHomecomingDue(), true);
  for (const stamina of [0, 25, 50, 80]) {
    s.stamina = stamina;
    assert.equal(rig.sumiRigHomecomingDue(), true, `体力${stamina}でも置いたことは伝える`);
  }
  assert.equal(rig.sumiRigHomecomingDue({ ...s, owned: [rig.PRO_RIG] }), false);
  assert.equal(rig.sumiRigHomecomingDue({ ...s, day: 3 }), false, "翌日に持ち越さない");
  assert.equal(rig.sumiRigHomecomingDue({ ...s, chapter: 2 }), false, "別章の同じ日付に出さない");
  assert.equal(rig.sumiRigHomecomingDue({ ...s, flags: {} }), false, "台だけ持つ旧セーブでは再生しない");
  saveGame();
  assert.equal(rig.sumiRigHomecomingDue(loadGame()), true, "受取後のLOADでもその夜に表示できる");
  const loaded = loadGame(); loaded.flags._sumi_rig_home_seen = true; saveGame();
  const seen = loadGame();
  const before = JSON.stringify(seen);
  assert.equal(await rig.showSumiRigAtHome(), false, "既読の実行はSAVE/LOAD後もスキップする");
  assert.equal(JSON.stringify(seen), before);

  // 本物のhome-rig全体を評価し、VNだけを読了待ちにする。保存とLOADは実API。
  let current, finishScene;
  const played = [];
  const source = fs.readFileSync(new URL("../js/daily/home-rig.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "").replace(/^export /gm, "");
  const isolated = vm.runInNewContext(`${source}\n({ showSumiRigAtHome });`, {
    get state() { return current; }, save: saveGame,
    DB: { dialogues: { [rig.RIG_HOME_SCENE]: scene } },
    play: id => { played.push(id); return new Promise(resolve => { finishScene = resolve; }); },
  });
  current = newGame(); Object.assign(current, { day: 2, slot: 2 });
  await rig.giveEarlyHomeRig();
  const pending = isolated.showSumiRigAtHome();
  assert.equal(current.flags._sumi_rig_home_seen, true);
  assert.equal(await isolated.showSumiRigAtHome(), false, "表示中の重複呼出しを防ぐ");
  current = loadGame();
  assert.equal(current.flags._sumi_rig_home_seen, true, "読了前でもオートセーブに既読が残る");
  assert.equal(await isolated.showSumiRigAtHome(), false, "表示中のLOADで再生しない");
  finishScene({});
  assert.equal(await pending, false, "旧SAVEの継続を止める");
  assert.deepEqual(played, [rig.RIG_HOME_SCENE]);

  current = newGame(); Object.assign(current, { day: 2, slot: 2 });
  saveToSlot("suien_remake_slot1"); // 台のない別の保存
  await rig.giveEarlyHomeRig();
  const interrupted = isolated.showSumiRigAtHome();
  current = loadFromSlot("suien_remake_slot1");
  const otherSave = JSON.stringify(current);
  finishScene({});
  assert.equal(await interrupted, false);
  assert.equal(JSON.stringify(current), otherSave, "別SAVEに台や既読を付けない");

  await rig.giveEarlyHomeRig();
  const completed = isolated.showSumiRigAtHome();
  finishScene({});
  assert.equal(await completed, true);
  saveToSlot("suien_remake_slot2");
  current = loadFromSlot("suien_remake_slot2");
  assert.equal(await isolated.showSumiRigAtHome(), false, "読了後の手動SAVE/LOADで再生しない");
  assert.equal(played.length, 3);
}

// 比率の表示: 整数%で合計がちょうど100（表示用）
assert.deepEqual(mixPercents({ lemon: 9, mint: 3 }), { lemon: 75, mint: 25 });
assert.deepEqual(mixPercents({ a: 4, b: 4, c: 4 }), { a: 34, b: 33, c: 33 });
assert.deepEqual(mixPercents({ a: 7, b: 5 }), { a: 58, b: 42 });
assert.deepEqual(mixPercents({ a: 0, b: 5 }), { a: 0, b: 100 });
const stepsSource = fs.readFileSync(new URL("../js/craft/steps.js", import.meta.url), "utf8");
assert(stepsSource.includes("mixPercents(cs.mix)") && stepsSource.includes("fr-ratio"), "大会・練習の配合画面にも比率を出す");

// 自宅練習は廃止。「寝る前の一服」はこのファイルの他のケースで維持する。
const src = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
assert(!src("../js/daily/map.js").includes("map-home-practice"));
assert(!fs.existsSync(new URL("../js/daily/home-practice.js", import.meta.url)));
const { benchBgRef, benchPlaceTag } = await import("../js/craft/worker.js");
assert.deepEqual([benchBgRef({ mode: "rehearsal", venue: "home" }), benchPlaceTag({ mode: "drill", venue: "home" })], ["bg_home", "HOME"]);
assert.deepEqual([benchBgRef({ mode: "rehearsal" }), benchPlaceTag({ mode: "rehearsal" })], ["bg_tonari_inside", "TONARI"]);

// 最初の一杯でも使う配合の上限処理。
{
  const { fitMixToStock } = await import("../js/craft/steps.js");
  // 配合を手持ちに収める: 並んでいない葉は外し、残量まで・器の量まで。minTotal で足りない分を足す
  const stock = { double_apple: 7, mint: 3, lemon: 20 };
  const lim = (id) => stock[id] ?? 0;
  const ids = ["double_apple", "mint", "lemon"];
  assert.deepEqual(fitMixToStock({ double_apple: 10, mint: 2, rose: 4 }, ids, lim, 25), { double_apple: 7, mint: 2 });
  assert.deepEqual(fitMixToStock({ double_apple: 9, mint: 3 }, ids, lim, 12, 12), { double_apple: 7, mint: 3, lemon: 2 });
  assert.deepEqual(fitMixToStock({ lemon: 20 }, ids, lim, 15), { lemon: 15 }, "器の量を超えない");
  assert.deepEqual(fitMixToStock({}, ["mint"], (id) => (id === "mint" ? 3 : 0), 12, 12), { mint: 3 }, "足りなければ足せる分だけ");

}

// 旧セーブ: 中間準備を終えていれば読み込み時に卓上台を渡す。終えていなければ渡さない（スミさんの会話の数では決めない）
const loadWith = (patch) => { const s = newGame(); Object.assign(s, patch); saveGame(); return loadGame(); };
assert(loadWith({ flags: { _ev_midcheck: true } }).owned.includes(rig.SUMI_RIG), "中間準備を終えた旧セーブ");
assert(loadWith({ chapter: 2, flags: {} }).owned.includes(rig.SUMI_RIG), "第2章の旧セーブ");
assert(!loadWith({ story: { sumi: 6 }, flags: {} }).owned.includes(rig.SUMI_RIG), "中間準備の前は渡さない");

// オート／手動の実LOADを通す。差分は承認済みの卓上台1個とschema更新だけ。
// 所持品・能力・端数・在庫・所持金・装備・進行・関係を丸ごと比べ、再読込で二重付与しない。
for (const schema of [14, SCHEMA]) for (const [label, patch, grant] of [
  ["before training", { day: 7, flags: { _ch1_mid: { practiceDone: true } } }, false],
  ["story count alone", { day: 14, story: { sumi: 6 } }, false],
  ["completed training", { day: 7, flags: { _ev_midcheck: true } }, true],
  ["feedback read", { day: 7, flags: { _ch1_mid: { feedbackRead: true } } }, true],
  ["chapter two", { chapter: 2, day: 16 }, true],
  ["later chapter", { chapter: 3, day: 30 }, true],
  ["tabletop already owned", { chapter: 2, day: 16, extra: [rig.SUMI_RIG] }, true],
  ["pro already owned", { chapter: 2, day: 16, extra: [rig.PRO_RIG] }, true],
]) for (const key of [SAVE_KEY, "suien_remake_slot1"]) {
  const s = newGame();
  const { extra = [], ...fields } = patch;
  Object.assign(s, { schema, money: 45678, stamina: 67, ...fields });
  s.owned.push("glass_bowl", ...extra);
  s.stats = { technique: 36, sense: 27, guts: 25, charm: 28, insight: 32 };
  s.statXp = { technique: .25, sense: .6, guts: .75 };
  s.flavorStock = { double_apple: 12.5, mint: 22 };
  s.affinity = { tsumugi: 31 }; s.affinityCarry = { tsumugi: .25 };
  const original = JSON.stringify(s);
  store.set(key, original);
  const expected = JSON.parse(original);
  expected.schema = SCHEMA;
  if (schema < 19) expected.flags._sumi_double_apple_received = true;
  if (schema < 16) expected.flags._axe_bar_legacy_access = true; // #577の旧保存互換だけを追加。資源の厳密比較は維持
  if (grant && !expected.owned.includes(rig.SUMI_RIG)) expected.owned.push(rig.SUMI_RIG);
  const loaded = key === SAVE_KEY ? loadGame() : loadFromSlot(key);
  // 手動LOADのみ自動保存日時を更新する。元の手動枠は変更しない。
  const resources = v => { const copy = JSON.parse(JSON.stringify(v)); delete copy.savedAt; return copy; };
  assert.deepEqual(resources(loaded), resources(expected), `${label}: ${schema}/${key}`);
  if (key !== SAVE_KEY) assert.equal(store.get(key), original, "Manual source slot is preserved byte for byte");
  saveGame();
  assert.deepEqual(resources(loadGame()), resources(expected), `${label}: saved migrated state reload`);
  assert.deepEqual(resources(loadGame()), resources(expected), `${label}: repeated reload`);
  assert.equal(loaded.owned.filter(id => id === rig.SUMI_RIG).length, grant ? 1 : 0);
}

// 台: 持っていなければ null、両方あれば伸びのいい大会公式モデル
state = newGame();
state.stats = { technique: 20, sense: 12, guts: 30, charm: 12, insight: 25 };
assert.equal(rig.homeRig(), null);
state.owned.push(rig.SUMI_RIG);
assert.deepEqual([rig.homeRig().id, rig.homeRig().growth], [rig.SUMI_RIG, 0.5]);
state.owned.push(rig.PRO_RIG);
assert.deepEqual([rig.homeRig().id, rig.homeRig().growth], [rig.PRO_RIG, 0.75]);
state.owned = state.owned.filter((id) => id !== rig.PRO_RIG);

// 聞くかどうか: 葉12g未満・今日もう吸った・大会前夜・台なしでは聞かない
state.flavorStock = { lemon: 6, mint: 5 };
state.stamina = 80;
assert.equal(home.homeShishaOffer(), null, "葉が12g未満");
state.flavorStock = { lemon: 9, mint: 3, double_apple: 0 };
assert.equal(home.homeShishaOffer()?.id, rig.SUMI_RIG);
assert.equal(home.homeShishaOffer(state, { eve: true }), null, "大会前夜は聞かない");

// #1081 D05: HUDと同じ現在残量の色。病気の制作補正とは分ける。
{
  const { maxStamina, addStamina } = await import("../js/core/stats.js");
  const { conditionForRatio } = await import("../js/core/condition.js");
  for (const guts of [0, 30, 100]) {
    state.stats.guts = guts;
    const max = maxStamina();
    for (const ratio of [0, .25, .2501, .5, .5001, 1]) {
      state.stamina = max * ratio;
      assert.equal(!!home.homeShishaOffer(), conditionForRatio(ratio).health === "green", `guts=${guts} ratio=${ratio}`);
    }
  }
  state.stats.guts = 30;
  const max = maxStamina();
  for (const [before, after, expected] of [[.7,.45,false],[.1,.4,false],[.4,.7,true]]) {
    state.stamina = Math.round(max * before);
    addStamina(Math.round(max * after) - state.stamina);
    assert.equal(!!home.homeShishaOffer(), expected, `${before}→${after}`);
    saveGame(); state = loadGame();
    assert.equal(!!home.homeShishaOffer(), expected, "LOAD後も現在の色で判定");
  }
  state.stamina = 80;
}

// レシピ帳から作る: 黄金比があればそれで（氷レモネード 12g → レモン8・ミント4）、なければ主役2:1
const lemonade = DB.recipes.find((r) => r.id === "ice_lemonade");
state.flavorStock = { lemon: 20, mint: 20, double_apple: 20, cinnamon: 20 };
assert.deepEqual(home.recipeMix(lemonade), { mint: 4, lemon: 8 });
assert.deepEqual(home.recipeMix(DB.recipes.find((r) => r.id === "apple_pie")), { double_apple: 8, cinnamon: 4 });
state.flavorStock = { lemon: 3, mint: 20 };
assert.equal(home.recipeMix(lemonade), null, "在庫が足りなければ作れない");

// 味の手応え: 単体も完成した一台。知らないレシピや種類数だけでは失敗にしない。
const { evaluateMix } = await import("../js/craft/steps.js");
for (const flavor of flavors) for (const mode of ["home", "drill", "rehearsal", "tournament"]) {
  const info = evaluateMix({ mode, mix: { [flavor.id]: 12 }, equip: { bowl: "silicone_bowl" } });
  assert(info.score >= 80, `${mode}/${flavor.id}: 単体を種類数だけで減点しない`);
  assert.equal(home.tasteOf(info), "great", `${flavor.id}: 単体の完成した香り`);
  assert(!info.notes.some(note => note.includes("他の香りが隠れている")));
  if (mode === "tournament") assert.equal(info.regOk, (flavor.family || flavor.id) === "lemon", "第1章の課題はレモン");
}
state = newGame(); state.owned.push(rig.SUMI_RIG); state.flavorStock = { mint: 50 }; state.stamina = 80;
const singleMix = { mint: 12 };
const single = home.applyHomeShisha(singleMix, rig.homeRig());
assert.equal(single.taste, "great");
assert.equal(state.flavorStock.mint, 38);
assert.equal(single.found, null, "単体を架空レシピとして登録しない");
assert.deepEqual(single.mix, { mint: 12 }, "感想には今回使った葉を渡す（SAVE項目は増やさない）");
assert.notEqual(single.mix, singleMix, "結果は選択画面のmixの参照を持ち続けない");
assert(!home.homeShishaDialogue(single, rig.homeRig()).lines.some(l => /イマイチ|もう一歩/.test(l.text)));
assert.equal(home.tasteOf({ recipe: lemonade, score: 100 }), "great");
assert.equal(home.tasteOf({ recipe: null, score: 88 }), "fine");
assert.equal(home.tasteOf({ recipe: null, score: 68 }), "meh");

// 一服: 葉12g・体力24（根性で軽減）・行動枠不変・レシピ帳へ。熟練度のみ、能力成長なし
state = newGame();
state.stats = { technique: 20, sense: 12, guts: 30, charm: 14, insight: 25 };
state.statXp = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
state.owned.push(rig.SUMI_RIG);
state.flavorStock = { lemon: 20, mint: 20 };
state.stamina = 80;
const slotBefore = state.slot;
const statsBefore = structuredClone({stats:state.stats,xp:state.statXp});
const r1 = home.applyHomeShisha({ lemon: 9, mint: 3 }, rig.homeRig());
assert.deepEqual(state.flavorStock, { lemon: 11, mint: 17 });
assert.equal(state.stamina, 57);
assert.equal(state.slot, slotBefore, "行動の枠は使わない");
assert.equal(r1.taste, "great");
assert.equal(r1.info.golden, "hit");
assert.equal(r1.found?.id, "ice_lemonade");
assert(state.recipes.ice_lemonade?.home);
assert.deepEqual({stats:state.stats,xp:state.statXp},statsBefore,"レシピ発見を含め、家ではステータスは育たない");
assert.deepEqual(state.flavorMastery,{lemon:4.5,mint:1.5});
assert.equal(home.homeShishaOffer(), null, "同じ日に二度は聞かない");
saveGame();
const savedHomeState = JSON.parse(store.get(SAVE_KEY));
state = loadGame();
const reloadedHomeState = JSON.parse(JSON.stringify(state));
delete savedHomeState.savedAt; delete reloadedHomeState.savedAt;
assert.deepEqual(reloadedHomeState, savedHomeState, "感想追加後もSAVEの既存資源・フラグをそのまま復元");
assert.equal(Object.hasOwn(savedHomeState, "mix"), false, "使用した葉の感想用データはSAVEに追加しない");
assert.equal(home.homeShishaOffer(), null, "LOAD後も同じ日の消費・成長を繰り返さない");
// 大会公式モデルも熟練度のみ。6gずつなら半分ずつ育つ。
state.day++;state.owned.push(rig.PRO_RIG);
home.applyHomeShisha({lemon:6,mint:6},rig.homeRig());
assert.deepEqual(state.flavorMastery,{lemon:8.25,mint:5.25});
assert.deepEqual({stats:state.stats,xp:state.statXp},statsBefore);

// #1081 D07: 単品もミックスも使った銘柄の味を学ぶ。内部評価・量の講評は出さない。
const dialogueFor = (mix, taste = "great", distant = false) => home.homeShishaDialogue({ mix, taste }, { id: rig.SUMI_RIG }, () => 0, { distant });
const textLines = (d) => d.lines.filter((l) => typeof l.text === "string");
for (const flavor of flavors) {
  const mix = { [flavor.id]: 12 };
  const d = dialogueFor(mix);
  const name = (flavor.short_name || flavor.name).split(" ").pop();
  assert(textLines(d)[1].text.includes(name), flavor.id);
  assert(!/確かめたい/.test(textLines(d)[1].text), `${flavor.id}: 現行の葉には具体的な感想がある`);
  assert.deepEqual(dialogueFor(mix, "meh"), d, "点数で出来栄え感想へ戻さない");
  for (const l of textLines(d)) assert(!/美味しい|普通に吸える|もう一歩|イマイチ|点|[0-9]|多すぎ|少なすぎ|配合/.test(l.text), l.text);
}
const lemonMint = dialogueFor({ lemon: 9, mint: 3, rose: 0 });
assert.match(textLines(lemonMint)[1].text, /レモン.*酸味/);
assert.match(textLines(lemonMint)[2].text, /ミント.*清涼感/);
assert.equal(textLines(lemonMint).length, 4, "使った葉だけを一言ずつ振り返る");
assert.match(textLines(dialogueFor({ double_apple: 12 }))[1].text, /アニス/);
assert.match(textLines(dialogueFor({ dobaj_double_apple: 12 }))[1].text, /クリーミー/);
assert.match(textLines(dialogueFor({ dobaj_mint: 12 }))[1].text, /甘/);
assert.match(textLines(dialogueFor({ absal_mint: 12 }))[1].text, /苦/);
assert.notEqual(textLines(dialogueFor({ strawberry: 12 }))[1].text, textLines(dialogueFor({ afsahr_strawberry: 12 }))[1].text);
assert.doesNotThrow(() => dialogueFor({ unknown_legacy_leaf: 12 }));
assert.match(textLines(dialogueFor({ unknown_legacy_leaf: 12 }))[1].text, /確かめたい/);
assert.equal(textLines(dialogueFor(single.mix))[1].text, textLines(home.homeShishaDialogue(single, { id: rig.SUMI_RIG }, () => 0))[1].text);
assert.equal(Object.hasOwn(state, "mix"), false, "感想のためのSAVEフィールドは追加しない");

// 場面の台本: 全角48字以内・手動改行なし・心の声は（）で閉じる
const width = (t) => [...t].reduce((n, c) => n + (c.charCodeAt(0) < 128 ? .5 : 1), 0);
for (const taste of ["great", "fine", "meh"]) for (const id of [rig.SUMI_RIG, rig.PRO_RIG]) for (const pick of [0, .5, .99]) for (const distant of [false, true]) {
  const d = home.homeShishaDialogue({ taste, mix: Object.fromEntries(flavors.map(f => [f.id, 1])) }, { id }, () => pick, { distant });
  for (const l of textLines(d)) {
    assert(!l.text.includes("配合"), l.text);
    assert(width(l.text) <= 48 && !l.text.includes("\n"), l.text);
    if (l.speaker === "hajime") assert(l.text.startsWith("（") && l.text.endsWith("）"), l.text);
  }
}

// #952: 第2章の味覚不調中は「舌では受け取れない」主観を保つ。評価・成長・消費は同じ。
{
  const lines = taste => ({ normal: textLines(home.homeShishaDialogue({ taste }, { id: rig.SUMI_RIG }, () => 0))[1].text,
    distant: textLines(home.homeShishaDialogue({ taste }, { id: rig.SUMI_RIG }, () => 0, { distant: true }))[1].text });
  for (const taste of ["great", "fine", "meh"]) {
    const { normal, distant } = lines(taste);
    assert.notEqual(normal, distant);
    assert(!/美味しい/.test(distant), "Distant taste does not claim the flavour was received");
  }
  assert.match(lines("great").distant, /遠い/);
  const distant = dialogueFor({ lemon: 9, mint: 3 }, "great", true);
  assert.equal(textLines(distant).length, 3);
  assert(!textLines(distant).some(l => /酸味|冴え|覚えておこう/.test(l.text)), "味覚不調中に味の特徴を受け取ったと断定しない");
  // 演出: 炭を置く→吹かす→パチパチの順の効果音と、会話中だけの曲
  const normal = dialogueFor({ lemon: 9, mint: 3 });
  assert.deepEqual(normal.lines.filter((l) => l.type === "sfx").map((l) => l.id), ["coalPlace", "bubbling", "crackle"], "効果音は炭→泡→パチパチの順");
  assert.equal(normal.metadata.bgm, "kansetsu_shomei_to_black_coffee");
  assert.equal(distant.metadata.bgm, "bgm_taste_distant", "味覚不調中は ch2 の曲");
  const s = newGame();
  assert.equal(home.tasteDistant(s), false, "Chapter 1 never");
  s.chapter = 2; assert.equal(home.tasteDistant(s), false, "Before the DAY5 slump");
  s.flags._ch2_taste_distant = true; assert.equal(home.tasteDistant(s), true, "During the chapter 2 slump");
  s.chapter = 3; assert.equal(home.tasteDistant(s), false, "Later chapters own their own recovery scenes");
}
// つむぎの授業は相談済み・その夜に使ったラベンダーだけ。無料の一服をEXPへ換算しない。
{
  const growth=await import("../js/core/growth.js"),stats=await import("../js/core/stats.js");
  growth.setGrowthPreview(true);state=newGame();Object.assign(state,{day:4,slot:2,stamina:80});
  state.owned.push(rig.SUMI_RIG);state.flavors.push("lavender");state.flavorStock={lavender:24};
  growth.ensureGrowth().nodes=["M-S3"];assert(growth.learnLesson("M-S3"));
  const raw={...state.stats};assert(home.applyHomeShisha({lavender:12},rig.homeRig()));
  assert.equal(state.flags._home_lavender_sleep,"1:4");assert.equal(state.slot,2);assert.equal(state.day,4);
  assert.deepEqual(state.stats,raw);assert.equal(state.growth.xp,0);
  saveGame();state=loadGame();state.stamina=20;stats.addStamina(20,{sleep:true});assert.equal(state.stamina,44);
  state.stamina=20;stats.addStamina(20);assert.equal(state.stamina,40);
  state.day++;state.stamina=20;stats.addStamina(20,{sleep:true});assert.equal(state.stamina,40,"翌晩へ効き目を持ち越さない");
  growth.setGrowthPreview(false);
}
console.log("[home shisha] PASS: rigs, kuji from ch1, offer rules, recipe mix, taste, 12g/24 stamina/no slot, proportional mastery only, no stat gain, lines");
