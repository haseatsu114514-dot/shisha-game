// 通いの続き（#2020 D）の配線: 本物の chapters/visit-chain-play.js と各章の行き先の処理を vm で読み、会話エンジンの
// 選択（hooks.onChoice）・条件（hooks.evalCondition）の呼び方を再現した読み手で通す。
// 巡回を一通り読んだ後に段が出る・小会話の巡回を進めない・代金と体力はいつもの来店と同じ・後日・夜・中断・地図の「！」。
// node --experimental-vm-modules remake/test/visit_chains_wiring.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { spendableMoney } from "../js/core/travel-budget.js";
import * as chains from "../js/chapters/visit-chains.js";
import * as desertRules from "../js/chapters/ch4-desert-progress.js";
import { recordShopStamp, shopStampsProgress } from "../js/chapters/ch5-shop-stamps-model.js";
import { chapterFiveTalkIds } from "../js/chapters/ch5-talks.js";
import * as longlongRules from "../js/chapters/ch4-longlong.js";
import { CH5_FIRST_TALKS } from "../js/chapters/ch5-first-talks.js";

const text = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const plainOf = value => JSON.parse(JSON.stringify(value)); // vm の中で作られた値を、この試験の側の素の値へ写す
const realScenes = Object.fromEntries(JSON.parse(text("../../data/dialogue/visit_chains.json")).dialogues.map(d => [d.dialogue_id, d]));

/** remake/js/<rel> を vm で読み、import の名前を overrides（無ければ何もしない関数）につなぐ。 */
async function load(rel, overrides, dynamic = {}) {
  const source = text(`../js/${rel}`);
  const context = vm.createContext({ console, structuredClone, AbortController });
  const module = new vm.SourceTextModule(source, { context, identifier: rel, async importModuleDynamically(specifier) {
    const exports = dynamic[specifier];
    assert(exports, `unexpected dynamic import ${specifier}`);
    const mod = new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
    await mod.link(() => {});
    await mod.evaluate();
    return mod;
  } });
  const bindings = new Map();
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
    const names = match[1].split(",").map(name => name.trim()).filter(Boolean);
    bindings.set(match[2], [...new Set([...(bindings.get(match[2]) || []), ...names])]);
  }
  const linked = new Map();
  await module.link(specifier => {
    const names = bindings.get(specifier) || [];
    const synthetic = new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, name in overrides ? overrides[name] : () => {});
    }, { context, identifier: specifier });
    linked.set(specifier, synthetic);
    return synthetic;
  });
  await module.evaluate();
  // 保存の差し替え（新しい保存・LOAD）を、このモジュールの state にも伝える
  if (bindings.get("../core/state.js")?.includes("state")) stateSetters.push(value => linked.get("../core/state.js").setExport("state", value));
  return { ns: module.namespace, setExport: (specifier, name, value) => linked.get(specifier)?.setExport(name, value) };
}
const stateSetters = [];

// ---- 共通の場: 保存・台本・会話エンジンの読み手 ------------------------------------------------------------------
let state;
const DB = { dialogues: {} };
const hooks = { onChoice: null, evalCondition: null };
const played = [];
let shown = [];
let chooser = () => 0;
let cancelNext = false;
const stub = id => ({ dialogue_id: id, lines: [{ speaker: "", face: "", text: id }] });
const readDialogues = async (name, ids) => Object.fromEntries(ids.map(id => [id, name === "visit_chains" ? realScenes[id] : stub(id)]));
const { ns: bondAfter } = await load("core/bond-after.js", { readDialogues });
/** vn/engine.js の play と同じ順で、選択→分岐の差し込み、条件→分岐の差し込みを行う（台詞は shown に残す）。 */
async function play(idOrDialogue) {
  const dialogue = typeof idOrDialogue === "string" ? DB.dialogues[idOrDialogue] : idOrDialogue;
  assert(dialogue?.lines?.length, `missing dialogue ${idOrDialogue?.dialogue_id || idOrDialogue}`);
  played.push(dialogue.dialogue_id);
  if (cancelNext === true || cancelNext === dialogue.dialogue_id) { cancelNext = false; return { cancelled: true }; }
  const queue = [...dialogue.lines];
  while (queue.length) {
    const line = queue.shift();
    if (line.type === "choice") {
      const choice = line.choices[chooser(line)];
      hooks.onChoice?.(dialogue.dialogue_id, String(line.id || ""), choice.next, "", choice, line);
      queue.unshift(...dialogue.branches[choice.next]);
    } else if (line.type === "condition") {
      const ok = hooks.evalCondition ? hooks.evalCondition(line) : undefined;
      assert.notEqual(ok, undefined, `unknown condition ${line.condition_type}`);
      const key = ok ? line.next_true : line.next_false;
      if (key) queue.unshift(...dialogue.branches[key]);
    } else if (!line.type) shown.push(line.text);
  }
  return { id: dialogue.dialogue_id, visited: [] };
}

const playModule = await load("chapters/visit-chain-play.js", {
  get state() { return state; }, DB, hooks, readDialogues, ...chains,
});
const setState = value => { state = value; for (const set of stateSetters) set(value); };
const { chainVisitDue, playChainStage, loadVisitChains } = playModule.ns;

// ---- visit-chain-play.js: 一段を読む間だけ選択と条件を受け持ち、読み終えた時だけ記録する ---------------------------
{
  setState({ chapter: 3, day: 30, slot: 0, flags: { _ch3_outings: { mukai_help: 2 } } });
  const previous = [];
  const previousChoice = (...args) => previous.push(["choice", args[1]]);
  const previousCondition = line => line.condition_type === "flag" ? true : undefined;
  hooks.onChoice = previousChoice; hooks.evalCondition = previousCondition;
  assert.equal(await chainVisitDue("enmaku"), null, "段の無い行き先");
  const due = await chainVisitDue("mukai");
  assert.equal(due?.stage.id, "ch3_chain_tofu_1");
  assert(DB.dialogues.ch3_chain_tofu_1?.lines?.length, "台詞を読み込んだ");
  chooser = () => 1;
  let during = null;
  const ok = await playChainStage(due, async id => {
    during = hooks.evalCondition({ condition_type: "flag", flag: "_x" });
    return !!(await play(id));
  });
  assert(ok);
  assert.equal(during, true, "ほかの条件は前の判定へ渡す");
  assert.deepEqual(previous, [["choice", "tofu_first"]], "前の選択の記録（恋愛の答えなど）も呼ぶ");
  assert.equal(hooks.onChoice, previousChoice, "読み終えたら元のフックへ戻す");
  assert.equal(hooks.evalCondition, previousCondition);
  assert.deepEqual(chains.chainRecord(state, "ch3_tofu"), { done: 1, day: 30, picks: { ch3_chain_tofu_1: "leaf" } });
  // 中断（LOAD・キャンセル）は何も残さない。例外でもフックは戻る
  state.day = 31;
  const second = await chainVisitDue("mukai");
  assert.equal(await playChainStage(second, async () => false), false);
  assert.equal(chains.chainRecord(state, "ch3_tofu").done, 1);
  await assert.rejects(playChainStage(second, async () => { throw new Error("boom"); }), /boom/);
  assert.equal(hooks.onChoice, previousChoice);
  assert.equal(hooks.evalCondition, previousCondition);
  const before = state;
  assert.equal(await playChainStage(second, async () => { setState(structuredClone(before)); return true; }), false, "読んでいる間にLOADした");
  assert.equal(chains.chainRecord(before, "ch3_tofu").done, 1, "古い保存に記録しない");
  assert.equal(chains.chainRecord(state, "ch3_tofu").done, 1, "新しい保存にも記録しない");
  hooks.onChoice = null; hooks.evalCondition = null;
  // 読み込みに失敗したら null（いつもの会話へ）。次の呼び出しで読み直す
  const failing = await load("chapters/visit-chain-play.js", { get state() { return state; }, DB: { dialogues: {} }, hooks,
    readDialogues: async () => { throw new Error("offline"); }, ...chains });
  assert.equal(await failing.ns.chainVisitDue("mukai"), null);
  await loadVisitChains();
}

// ---- 第5章の東京: Smoke & Glory ------------------------------------------------------------------------------
{
  const money = { spent: 0 };
  const affinity = {};
  const stats = {};
  const tokyo = await load("chapters/ch5-tokyo.js", { chapterFiveTalkIds, ...bondAfter,
    get state() { return state; }, save() {}, timeOfDay: () => "day", markMet() {}, DB, sceneBg: () => ({ url: "", tint: null }),
    setBg: async () => {}, toast() {}, vanRide: async () => {}, play, readDialogues,
    addMoney: n => { state.money += n; money.spent -= n; }, addStamina: n => { state.stamina += n; },
    earnStat: (key, n) => { stats[key] = (stats[key] || 0) + n; }, gainAffinity: (id, n) => { affinity[id] = (affinity[id] || 0) + n; },
    visitAffinity: kind => kind === "talk" ? 5 : 10, earnSceneCompletion() {}, spendableMoney: value => value.money,
    tokyoVanBlock: () => null, TOKYO_VAN_SLOTS: 2, TOKYO_VISIT_COST: 3500, MUKAI_SHIFT_STAMINA: -14, mukaiShiftPay: () => 16000, mukaiShiftPayText: () => "基本給16,000円＋売上の10%", loadMukaiShift: async () => {},
    TOKYO_OUTINGS: [{ id: "tetsuko", stages: [], loop: [] }], OUTINGS_FLAG: "_ch3_outings", outingCounts: () => ({}),
    consultLessons: async () => {}, finaleAtVisit: () => false,
    // ましろと過ごす時間（BLC03・mashiro-time.js）。台本の一覧は配列で読むので、空で差し込む
    MASHIRO_TIME_SCENES: [], MASHIRO_TIME_FILE: "mashiro_time", mashiroTimeOpen: () => false, loverMilestonesDue: () => [],
    chainStageAt: chains.chainStageAt, chainVisitDue, playChainStage, recordChapterFiveTalk: chains.recordChapterFiveTalk,
    modal: async ({ options }) => options.find(option => option.test === "tokyo-mukai-friend")?.value,
  });
  const { performTokyoSpot, tokyoSpotsNow, TOKYO_SPOTS } = tokyo.ns;
  setState({ chapter: 5, day: 80, slot: 0, money: 100000, stamina: 100, flags: { _ch2_region: "tokyo" }, met: { steve: true } });
  assert.match(tokyoSpotsNow().find(entry => entry.id === "ch5_tokyo_mukai").desc, /16,000円/, "world champion mukai map shows the tonari wage");
  const steve = () => tokyoSpotsNow().find(entry => entry.id === "ch5_tokyo_steve");
  const visit = () => performTokyoSpot(steve(), { staminaGuard: async () => true });
  const talks = ["ch5_tokyo_steve", "ch5_tokyo_steve_b", "ch5_tokyo_steve_c"];
  for (const id of talks) {
    assert.equal(steve().hasNew, undefined, "小会話の間は、いつもの判定（締めくくり等）");
    assert.deepEqual(plainOf(await visit()), { used: true, exerted: true });
    assert.equal(played.at(-1), id);
  }
  assert.equal(steve().hasNew?.(), true, "一通り読んだら「！」");
  assert.equal(steve().cost, 3500, "写しでも代金は同じ");
  const spent = money.spent, stamina = state.stamina, love = affinity.steve;
  chooser = () => 2; // 先に、最近のことを聞かせてください
  shown = [];
  assert.deepEqual(plainOf(await visit()), { used: true, exerted: true });
  assert.equal(played.at(-1), "ch5_chain_guest_1");
  assert.equal(state.flags._ch5_tokyo_talks.ch5_tokyo_steve, 3, "巡回は進めない");
  assert.equal(money.spent - spent, 3500, "代金はいつもの来店と同じ");
  assert.equal(stamina - state.stamina, 16, "体力もいつもの来店と同じ");
  assert.equal(affinity.steve - love, 5, "好感度は通いの小会話と同じ");
  assert(shown.some(t => t.includes("ぽつぽつ")), "選んだ答えの分岐を読んだ");
  assert.equal(steve().hasNew, undefined, "同じ日は次の段を出さない");
  await visit();
  assert.equal(played.at(-1), "ch5_tokyo_steve_d", "同じ日にもう一度来たら、いつもの小会話");
  state.day += 1;
  chooser = line => line.id === "guest_timer" ? 1 : 0;
  cancelNext = true;
  assert.deepEqual(plainOf(await visit()), { used: false, exerted: false }, "中断した段は使わない");
  assert.equal(chains.chainRecord(state, "ch5_steve_guest").done, 1);
  shown = [];
  await visit();
  assert.equal(played.at(-1), "ch5_chain_guest_2");
  assert(shown.some(t => t.includes("疲れた日")), "1段目の答え（話を聞く）で作り方が変わる");
  state.day += 1;
  shown = [];
  await visit();
  assert.equal(played.at(-1), "ch5_chain_guest_3");
  assert(shown.some(t => t.includes("話してから吸う")) && shown.some(t => t.includes("秒数の欄は空けてある")), "1・2段目の答えが返る");
  assert(chains.chainFinished(state, "ch5_steve_guest"));
  state.day += 1;
  await visit();
  assert.equal(played.at(-1), "ch5_tokyo_steve_e", "終わった後は小会話の巡回の続き");
  assert(TOKYO_SPOTS.every(entry => !Object.hasOwn(entry, "hasNew")), "元の行き先は変えない");

  setState({ chapter: 5, day: 90, slot: 0, money: 50000, stamina: 100, met: { mashiro: true },
    finales: { mashiro: { route: "friend" } }, owned: ["suyaki_mashiro"],
    flags: { _ch2_region: "tokyo", _ch5: { part: "free", read: {} },
      _bond_after: { mashiro: bondAfter.BOND_AFTER.mashiro.scenes.map(scene => scene.id) } } });
  const mukai = () => tokyoSpotsNow().find(entry => entry.id === "ch5_tokyo_mukai");
  for (const id of chapterFiveTalkIds("ch5_tokyo_mashiro")) {
    assert((await performTokyoSpot(mukai())).used);
    assert.equal(played.at(-1), id, "♥5後の5本を読み終えたら、第5章の小会話を読む");
  }
  assert.equal(mukai().hasNew?.(), true);
  assert((await performTokyoSpot(mukai())).used);
  assert.equal(played.at(-1), "ch5_chain_mashiro_handle_1");
  state.day++;
  assert((await performTokyoSpot(mukai())).used);
  assert.equal(played.at(-1), "ch5_chain_mashiro_handle_2");
  assert.deepEqual([state.money, state.stamina], [50000, 100]);
}

// ---- 第5章の地元: 通い店と tonari の任意の会話 --------------------------------------------------------------
{
  const shops = await load("chapters/ch5-shops.js", {
    get state() { return state; }, chapterFiveTalkIds, CH5_FIRST_TALKS,
    SPOTS: [{ id: "naru", cost: 3000, stamina: -16 }], VISIT_BG: { naru: "bg_naru_shop" },
    CHAR_STAT: { naru: "insight" }, PREPARATION_SPOTS: [],
    DB, readDialogues, play, timeOfDay: () => "day", sceneBg: () => ({ url: "" }),
    setBg: async () => {}, spendableMoney: value => value.money,
    addMoney: n => { state.money += n; }, addStamina: n => { state.stamina += n; },
    chainVisitDue, playChainStage, recordChapterFiveTalk: chains.recordChapterFiveTalk,
  });
  const { chapterFiveShopById, performChapterFiveShop, performChapterFiveTonariTalk } = shops.ns;
  for (const [place, base, chainId, visit] of [
    ["naru", "ch5_naru_shop", "ch5_naru_towel", () => performChapterFiveShop(chapterFiveShopById("naru"))],
    ["ch5_tonari_sumi", "ch5_tonari_sumi", "ch5_sumi_seat", () => performChapterFiveTonariTalk("ch5_tonari_sumi")],
  ]) {
    setState({ chapter: 5, day: 60, money: 200000, stamina: 200, flags: { _ch5: { part: "free", read: {} } } });
    assert.equal(await chainVisitDue(place), null);
    for (const topic of chapterFiveTalkIds(base)) {
      assert((await visit()).used);
      assert.equal(played.at(-1), topic);
    }
    const [first, second] = chains.VISIT_CHAINS[chainId].stages;
    assert.equal((await chainVisitDue(place))?.stage.id, first.id);
    cancelNext = true;
    assert.equal((await visit()).used, false);
    assert.deepEqual(state.flags._ch5_shop_talks[place], 8);
    assert.equal(chains.chainRecord(state, chainId).done, 0);
    assert((await visit()).used);
    assert.equal(played.at(-1), first.id);
    assert.equal(await chainVisitDue(place), null, "同じ日は次の段を出さない");
    state.day += 1;
    assert((await visit()).used);
    assert.equal(played.at(-1), second.id);
    assert.deepEqual(state.flags._ch5_shop_talks[place], 8, "続きの段で巡回を進めない");
    assert((await visit()).used);
    assert.equal(played.at(-1), base, "8本の先頭へ戻る");
  }
}

// ---- 第5章の居合わせ: 店を替えても、ひよりの続きは同じ記録で進む --------------------------------------------
{
  const roamer = await load("daily/roamers.js", {
    get state() { return state; }, DB, readDialogues, play, isPlaying: () => false, on: () => () => {},
    chainVisitDue, playChainStage, recordChapterFiveTalk: chains.recordChapterFiveTalk,
  });
  setState({ chapter: 5, day: 60, flags: { _ch5: { part: "free", read: {} }, _roam_seen_hiyori: 8 } });
  const visit = id => roamer.ns.meetRoamer({ id }, { id: "hiyori", spotId: id });
  assert(await visit("naru"));
  assert.equal(played.at(-1), "roam_hiyori_h");
  assert.equal(await visit("minto"), false, "同じ日の別の店では読まない");
  state.day++;
  assert(await visit("minto"));
  assert.equal(played.at(-1), "ch5_chain_hiyori_bag_1");
  state.day++;
  assert(await visit("shishark"));
  assert.equal(played.at(-1), "ch5_chain_hiyori_bag_2");
  assert.equal(roamer.ns.roamerCount("hiyori", state), 9, "段では巡回を進めない");
  assert.equal(roamer.ns.roamerScene("hiyori", state), "roam_hiyori_a");
}

// ---- 第5章のドバイ: 路地裏のカフェ（閉店後の段は夜だけ・代金なし） ---------------------------------------------
{
  const gained = [];
  const desert = await load("chapters/ch4-desert.js", { ...desertRules, ...bondAfter,
    get state() { return state; }, DB, readDialogues, play, spendableMoney: value => value.money,
    addMoney: n => { state.money += n; }, visitAffinity: () => 5, gainAffinity() {}, save() {},
    showScreen() {}, layers: { hud: { replaceChildren() {}, classList: { remove() {} } } }, setBg: async () => {},
  }, { "../core/data.js": { bgUrl: id => id } });
  const dubai = await load("chapters/ch5-dubai.js", { chapterFiveTalkIds, ...bondAfter, ...desertRules,
    get state() { return state; }, save() {}, timeOfDay: () => (state.slot ? "night" : "day"), markMet() {}, DB,
    sceneBg: () => ({ url: "", tint: null }), setBg: async () => {}, toast() {}, modal: async () => null, layers: { hud: {} },
    play, readDialogues, addMoney: n => { state.money += n; }, addStamina: n => { state.stamina += n; }, earnStat() {}, gainAffinity: (id, n) => { gained.push([id, n]); },
    visitAffinity: () => 5, affinityLevel: () => 0, spendableMoney, finaleAtVisit: () => false,
    consultLessons: async () => {}, nextDubaiBondStory: () => null, DUBAI_LETTER_AGAIN: [], DUBAI_LETTER_DAYS: 2,
    CH5_CAMEL_MEET: { scene: "ch5_camel_meet" }, CH4_CAMEL_SCENE_FILES: { ch4_camel_race: [] }, SHEIKH_BOND_IDS: [], TAIYO_BOND_IDS: [],
    CAMEL_DAILY_SPOT_ID: "camel", MOSQUE_VISITING_HOURS: {},
    // クリーク沿いの場面の束（SPV03・ch4-dubai-local.js）。台本の一覧は配列で読むので、空で差し込む
    CREEK_SCENES: { day: [], night: [] }, CREEK_SPOT_IDS: [], CREEK_TURN: "dubai_creek", creekSpotScenes: () => ({}), quietTurn: () => null,
    chainStageAt: chains.chainStageAt, chainVisitDue, playChainStage,
  }, { "./ch4-desert.js": desert.ns });
  const { performDubaiSpot, DUBAI_SPOTS } = dubai.ns;
  const stamps = await load("chapters/ch5-shop-stamps.js", { get state() { return state; }, recordShopStamp, grantKujiTickets: n => n });
  const daily = await load("chapters/ch5-daily.js", { get state() { return state; }, performDubaiSpot, noteShopStamp: stamps.ns.noteShopStamp });
  const definition = daily.ns.chapterFiveDailyDefinition({});
  const visitShop = async spot => {
    const result = await definition.performSpot(spot);
    if (result.used) definition.afterSpot(spot);
    return result;
  };
  setState({ chapter: 5, day: 90, slot: 0, money: 50000, stamina: 100, finales: { noor: { chapter: 4, route: "friend" } },
    flags: { _ch2_region: "dubai", _ch5: { part: "free", read: {} },
      _ch4_desert: { v: 2, talks: 6, chats: 7, lastTalkDay: 10, outings: 1, lastOutingDay: 9 } } });
  state.owned = ["suyaki_noor"];
  const desk = { id: desertRules.CH5_NOOR_DESK_ID, region: "dubai", preview: "bg_dubai_cafe_salim_day" };
  cancelNext = true;
  assert.equal((await visitShop(desk)).used, false);
  assert.equal(shopStampsProgress(state).optionalCount, 0, "中断した来店には判子を押さない");
  assert.equal(state.flags._bond_after, undefined, "中断した場面は既読にしない");
  for (const { id } of bondAfter.BOND_AFTER.noor.scenes) {
    assert((await visitShop(desk)).used);
    assert.equal(shopStampsProgress(state).optionalCount, 1, "締めくくり後もオアシスの判子は一つ");
    assert.equal(played.at(-1), id);
    assert(state.flags._bond_after.noor.includes(id));
    assert.equal((await performDubaiSpot(desk)).used, false, "♥5後の場面も一日にひと話");
    state.day++;
  }
  assert.equal(state.flags._ch4_desert.chats, 7, "♥5後の場面では小会話の巡回を進めない");
  assert((await performDubaiSpot(desk)).used);
  assert.equal(played.at(-1), "ch5_noor_cafe_chat_h");
  assert.equal((await performDubaiSpot(desk)).used, false, "一日にひと話");
  state.flags._met_faris = true;
  const { seat, again } = desertRules.NOOR_FARIS_SCENES;
  cancelNext = seat;
  for (const phase of [1, 2]) {
    state.day++;
    assert((await performDubaiSpot(desk)).used);
    assert.deepEqual(played.slice(-2), [`ch5_chain_noor_photo_${phase}`, seat]);
    assert.equal(state.flags._noor_story_faris_seat, phase === 1 ? undefined : state.day, "中断した席の会話は次の来店で読み直す");
    assert.equal((await performDubaiSpot(desk)).used, false);
  }
  assert.equal(state.flags._ch4_desert.chats, 8);
  assert.equal(state.money, 50000);
  assert.deepEqual(gained, []);

  state.day++;
  assert((await performDubaiSpot(desk)).used);
  assert.equal(played.at(-1), again);
  assert.equal(state.flags._noor_story_faris_seat_again, true);
  state.day++;
  assert((await performDubaiSpot(desk)).used);
  assert(![seat, again].includes(played.at(-1)), "両方読んだ後はデスクの会話だけ");

  // 締めくくり前の元のカフェ。第4章の地図から一台頼んでも、同じ読了記録が付く。
  setState({ chapter: 4, day: 8, slot: 0, money: 5000, flags: { _met_faris: true, _ch4_desert: { talks: 1 } } });
  assert((await desert.ns.performDesertSpot({ place: "tour_desk" }, { day: state.day })).used);
  assert.equal(played.at(-1), seat);
  assert.equal(state.flags._noor_story_faris_seat, state.day);
  assert.equal(state.money, 5000 - desertRules.DESERT_CAFE_PRICE);

  // 締めくくり前の保存で第5章へ進んだ場合も、元の入口から判子をもらえる。
  state.chapter = 5;
  state.day++;
  state.money = 5000;
  assert((await visitShop({ id: desertRules.DESERT_SPOT_IDS.desk, region: "dubai", place: "tour_desk" })).used);
  assert.equal(shopStampsProgress(state).optionalCount, 1);
  assert.deepEqual(gained, [["noor", 5]]);
  gained.length = 0;

  setState({ chapter: 5, day: 90, slot: 0, money: 50000, stamina: 100, flags: { _ch2_region: "dubai" }, met: {} });
  const alley = DUBAI_SPOTS.find(entry => entry.id === "ch5_dubai_alley");
  const visit = () => performDubaiSpot(alley, { staminaGuard: async () => true });
  state.flags._ch2_preparation_started = true;
  state.money = alley.cost - 1;
  assert.equal((await visit()).used, false);
  assert.equal(state.money, alley.cost - 1);
  for (const id of ["ch5_dubai_alley", "ch5_dubai_alley_b", "ch5_dubai_alley_c"]) {
    assert.equal(alley.hasNew(), false);
    state.money = alley.cost;
    assert((await visit()).used);
    assert.equal(state.money, 0);
    assert.equal(played.at(-1), id);
  }
  assert.equal(alley.hasNew(), true, "一通り読んだら「！」");
  chooser = () => 1; // この店の葉を、俺の作り方で
  state.money = alley.cost - 1;
  assert.equal((await visit()).used, false);
  assert.equal(state.money, alley.cost - 1);
  state.money = alley.cost;
  const before = state.money;
  await visit();
  assert.equal(played.at(-1), "ch5_chain_gift_1");
  assert.equal(before - state.money, 3000, "一台を頼む来店は代金どおり");
  assert.equal(state.flags._ch5_dubai_talks.ch5_dubai_alley, 3);
  state.money = 50000;
  state.day += 1;
  assert.equal(alley.hasNew(), false, "閉店後の段は昼には出さない");
  await visit();
  assert.equal(played.at(-1), "ch5_dubai_alley", "昼はいつもの小会話");
  state.slot = 1;
  assert.equal(alley.hasNew(), true);
  const evening = state.money;
  state.money = 0; // 一台分のお金が無くても、閉店後の段は読める
  shown = [];
  assert.deepEqual(plainOf(await visit()), { used: true, exerted: true });
  assert.equal(played.at(-1), "ch5_chain_gift_2");
  assert.equal(state.money, 0, "閉店後の段は代金を取らない");
  assert(shown.some(t => t.includes("ゆっくり開きます")), "1段目の答えが返る");
  assert(chains.chainFinished(state, "ch5_alley_gift"));
  state.money = evening;
  // 中庭の太陽（#4010）: 小会話3本の後に旗の続き。人に会う行き先なので、小会話と同じだけ好感度が付く（路地裏のカフェには付けない）
  assert.deepEqual(gained.filter(([id]) => id !== "sheikh" && id !== "da_silva"), [], "店の続きでは好感度を動かさない");
  const { dubaiBondHasNew } = dubai.ns;
  const taiyo = DUBAI_SPOTS.find(entry => entry.id === "ch5_dubai_taiyo");
  const meet = () => performDubaiSpot(taiyo, { staminaGuard: async () => true });
  for (const id of ["ch5_dubai_taiyo", "ch5_dubai_taiyo_b", "ch5_dubai_taiyo_c"]) {
    assert.equal(dubaiBondHasNew(taiyo), false);
    await meet();
    assert.equal(played.at(-1), id);
  }
  assert.equal(dubaiBondHasNew(taiyo), true, "一通り読んだら「！」");
  chooser = () => 1; // 「またあした」と書く
  gained.length = 0;
  const purse = state.money;
  assert.deepEqual(plainOf(await meet()), { used: true, exerted: true });
  assert.equal(played.at(-1), "ch5_chain_flag_1");
  assert.deepEqual(gained, [["da_silva", 5]], "いつもの小会話と同じ好感度");
  assert.equal(state.money, purse, "中庭は代金を取らない");
  assert.equal(state.flags._ch5_dubai_talks.ch5_dubai_taiyo, 3, "小会話の巡回は進めない");
  assert.equal(dubaiBondHasNew(taiyo), false, "同じ日は次の段を出さない");
  await meet();
  assert.equal(played.at(-1), "ch5_dubai_taiyo_d", "同じ日にもう一度来たら、いつもの小会話");
  state.day += 1;
  shown = [];
  await meet();
  assert.equal(played.at(-1), "ch5_chain_flag_2");
  assert(shown.some(t => t.includes("これを読んでから、帰る")) && shown.some(t => t === "「またあした」。"), "1段目の答えが返る");
  assert(!chains.chainFinished(state, "ch5_taiyo_flag"), "3段目（太陽の旗）が残っている");
  await meet();
  assert.match(played.at(-1), /^ch5_dubai_taiyo(_[b-h])?$/, "同じ日は小会話（巡回の続き）");
  state.day += 1;
  shown = [];
  await meet();
  assert.equal(played.at(-1), "ch5_chain_flag_3");
  assert(shown.some(t => t.includes("休暇、延ばすかな")), "1段目の一語で、太陽の旗の言葉が決まる");
  assert(chains.chainFinished(state, "ch5_taiyo_flag"));
  assert.equal(dubaiBondHasNew(taiyo), false);
  // シェイクの屋敷（#4016）: 同じ仕組み。炭場の人を選ぶと、2段目で屋敷の中で初めて負ける
  const sheikh = DUBAI_SPOTS.find(entry => entry.id === "ch5_dubai_sheikh");
  const call = () => performDubaiSpot(sheikh, { staminaGuard: async () => true });
  for (const id of ["ch5_dubai_sheikh", "ch5_dubai_sheikh_b", "ch5_dubai_sheikh_c"]) {
    assert.equal(dubaiBondHasNew(sheikh), false);
    await call();
    assert.equal(played.at(-1), id);
  }
  assert.equal(dubaiBondHasNew(sheikh), true, "一通り読んだら「！」");
  chooser = () => 1; // 炭場の年配の人に頼む
  gained.length = 0;
  await call();
  assert.equal(played.at(-1), "ch5_chain_pair_1");
  assert.deepEqual(gained, [["sheikh", 5]], "いつもの小会話と同じ好感度");
  await call();
  assert.equal(played.at(-1), "ch5_dubai_sheikh_d", "同じ日にもう一度来たら、いつもの小会話");
  state.day += 1;
  shown = [];
  await call();
  assert.equal(played.at(-1), "ch5_chain_pair_2");
  assert(shown.some(t => t === "だから目を閉じた、だそうだ"), "1段目の答えが返る");
  assert(chains.chainFinished(state, "ch5_sheikh_pair"));
}

// ---- 第4章のドバイ: 中心地のカフェ → 宿 → カフェ ------------------------------------------------------------------
{
  const cafeOrders = [];
  let innPick = "chain";
  const modalCalls = [];
  const ch4 = await load("chapters/ch4-dubai-daily.js", {
    get state() { return state; }, save() {}, timeOfDay: () => "day", DB, bgUrl: id => id, layers: { hud: { firstElementChild: null } },
    setBg: async () => {}, toast() {}, play, readDialogues,
    modal: async options => { modalCalls.push(options.title); return options.className === "ch4-cafe-order" ? "omakase" : innPick; },
    addMoney: n => { state.money += n; }, addStamina: n => { state.stamina += n; }, earnStat() {}, gainAffinity() {},
    affinityLevel: () => 0, visitAffinity: () => 5, spendableMoney: value => value.money, finaleAtVisit: () => false,
    consultLessons: async () => {}, canReflect: () => false,
    CH4_PLACE_BG: { inn: "bg_inn" }, CH4_SCENE_BG: {}, CH4_DAILY_EVE_DAY: 13, CH4_FREE_SCENE_IDS: [],
    chapterFourProgress: value => value.flags._ch4, syncChapterFourDay() {}, chapterFourSecondAvailable: () => false,
    camelDailySpot: () => null, desertDailySpots: () => [], desertDailySpotById: () => null,
    CAFE_MENU: [{ id: "mint", label: "ミント" }], CAFE_PLACES: ["center_cafe", "alley_cafe"], CAFE_TASTE_IDS: [], OMAKASE: "omakase",
    OMAKASE_LINE: { center_cafe: "おまかせで頼んだ。" }, SMOKED_IN_SCENE: [], TALKS_AFTER_ORDER: [], resolveCafeOrder: () => "mint", tasteScene: () => "taste_mint",
    recordCafeOrder: (value, id) => cafeOrders.push(id), LONGLONG_IDS: [], LONGLONG_LOAD_IDS: [], NIGHT_SCENE_IDS: [], STALL_SCENE_IDS: [],
    STALL_PLACE: "souq", dubaiSpotAt: entry => entry, nightVisit: () => null, stallChoices: () => [], priceText: n => `${n}`,
    INN_TRIAL_FLAG: "_ch4_inn_trial", INN_TRIAL_IDS: [], innTrialDue: () => false, REHEARSAL_FLAG: "_ch4_rehearsal", REHEARSAL_IDS: [],
    rehearsalDue: () => false, chapterFourStaffNightEvent: () => null,
    // この試験は通いの優先順位を見る。通常の休憩は先頭の台本を返す（巡回自体は rest_variations.mjs）。
    quietTurn: (id, pool) => ({ id: pool[0], key: `_spot_turn_${id}`, count: 0 }),
    companionTimeOpen: () => false, // 同行した恋人と過ごせる日（BLC08・companion-time.js）。この試験では開かない
    chainStageAt: chains.chainStageAt, chainVisitDue, playChainStage,
    // 龍龍水煙所（王煙楼の店。#4010 の通いの続き）は本物の決まりで動かす
    LONGLONG_CHAR: longlongRules.LONGLONG_CHAR, LONGLONG_BG: longlongRules.LONGLONG_BG, nextLonglongVisit: longlongRules.nextLonglongVisit,
    longlongHasNew: longlongRules.longlongHasNew, recordLonglongVisit: longlongRules.recordLonglongVisit, bondAfterNext: () => null,
  });
  const { CH4_DUBAI_SPOTS, chapterFourDubaiDefinition } = ch4.ns;
  const pool = ["ch4_dubai_cafe_revisit", "ch4_cafe_talk_b", "ch4_cafe_culture_hose", "ch4_cafe_talk_c", "ch4_cafe_culture_coffee", "ch4_cafe_talk_d"];
  for (const id of [...pool, "ch4_inn_rest", "taste_mint"]) DB.dialogues[id] = stub(id);
  setState({ chapter: 4, day: 50, slot: 0, money: 100000, stamina: 100, phase: "daily",
    flags: { _ch4: { startDay: 48, part: "free", read: { ch4_dubai_cafe: true, ch4_inn_tool_care: true } } } });
  const io = { readAndCommit: async id => { state.flags._ch4.read[id] = true; return true; } };
  const perform = entry => chapterFourDubaiDefinition(io).performSpot(entry, { staminaGuard: async () => true });
  const cafe = CH4_DUBAI_SPOTS.find(entry => entry.place === "center_cafe");
  const inn = CH4_DUBAI_SPOTS.find(entry => entry.place === "inn");
  // 再訪の会話のあとに一台頼む（味わいの場面 taste_mint）
  for (const id of pool.slice(0, 3)) { await perform(cafe); assert.deepEqual(played.slice(-2), [id, "taste_mint"]); }
  assert.equal(cafe.hasNew(), true, "ホースの回まで読んだら「！」");
  const money = state.money;
  await perform(cafe);
  assert.equal(played.at(-1), "ch4_chain_bowl_1");
  assert.equal(cafeOrders.length, 4, "段の来店でも一台頼む");
  assert.equal(money - state.money, 3000, "代金はいつもの来店と同じ");
  assert.equal(state.flags._ch4_dubai_talks.center_cafe, 3, "巡回は進めない");
  assert.equal(inn.hasNew(), false, "宿の段は後日");
  state.day += 1;
  assert.equal(inn.hasNew(), true);
  // 「いつもの宿」を選ぶと、休む（いつもの宿の処理）へ。段は残る
  innPick = "inn";
  await perform(inn);
  assert.equal(played.at(-1), "ch4_inn_rest");
  assert.equal(chains.chainRecord(state, "ch4_second_bowl").done, 1);
  // 講評の途中は、そちらが先（段を出さない）
  state.flags._ch4_inn_trial = { result: "rough", feedbackRead: false };
  modalCalls.length = 0;
  innPick = "chain";
  await perform(inn).catch(() => {});
  assert(!modalCalls.includes("宿"), "講評の途中は段を出さない");
  state.flags._ch4_inn_trial = { result: "failed", feedbackRead: true };
  chooser = () => 1; // 一つ目の香りを受ける、別の葉にする
  shown = [];
  const stamina = state.stamina;
  assert.deepEqual(plainOf(await perform(inn)), { used: true, exerted: true });
  assert.equal(played.at(-1), "ch4_chain_bowl_2");
  assert.equal(stamina - state.stamina, 10, "宿の段は体力10（休まない）");
  assert(shown.some(t => t.includes("時間をずらして")), "読んでいる段の答えで後半が変わる");
  state.day += 1;
  shown = [];
  await perform(cafe);
  assert.equal(played.at(-1), "ch4_chain_bowl_3");
  assert(shown.some(t => t.includes("別の葉を重ねました")), "宿の答えが返る");
  assert(shown.some(t => t.includes("煙が薄くなって")), "宿の試作の結果（失敗）が返る");
  assert(chains.chainFinished(state, "ch4_second_bowl"));
  await perform(cafe);
  assert.deepEqual(played.slice(-2), ["ch4_cafe_talk_c", "taste_mint"], "終わった後は再訪の会話の続き");

  // 龍龍水煙所（#4010）: 段階を読み終え、小会話を3本読んだ後の小会話の番に、通いの続きを読む（代金はいつもの来店・巡回は進めない）
  const longlong = CH4_DUBAI_SPOTS.find(entry => entry.place === "longlong");
  for (const id of longlongRules.LONGLONG_IDS) DB.dialogues[id] = DB.dialogues[id] || stub(id);
  state.flags._ch4_longlong = { read: Object.fromEntries(longlongRules.LONGLONG_IDS.slice(0, 5).map(id => [id, true])), talks: 2 };
  await perform(longlong);
  assert.equal(played.at(-1), longlongRules.LONGLONG_TALKS[2], "小会話2本の後は、まだ小会話");
  assert.equal(longlong.hasNew?.() ?? true, true);
  chooser = () => 1; // ドバイの甘い茶にする
  const before = state.money;
  await perform(longlong);
  assert.equal(played.at(-1), "ch4_chain_tea_1");
  assert.equal(before - state.money, longlong.cost, "代金はいつもの来店と同じ");
  assert.equal(state.flags._ch4_longlong.talks, 3, "巡回は進めない");
  await perform(longlong);
  assert.equal(played.at(-1), longlongRules.LONGLONG_TALKS[3], "同じ日は小会話");
  state.day += 1;
  shown = [];
  await perform(longlong);
  assert.equal(played.at(-1), "ch4_chain_tea_2");
  assert(shown.some(t => t.includes("甘すぎる")), "1段目の答えが返る");
  assert(chains.chainFinished(state, "ch4_longlong_tea"));
}

// ---- 第3章の東京: mukai の選択肢の最後に段が出る ------------------------------------------------------------------
{
  let mukaiPick = null;
  const options = [];
  const ch3 = await load("chapters/ch3-tokyo-daily.js", {
    get state() { return state; }, save() {}, timeOfDay: () => "day", DB, bgUrl: id => id, displayName: id => id,
    layers: { hud: { firstElementChild: null } }, setBg: async () => {}, toast() {}, play, readDialogues, showHud() {},
    modal: async config => { options.splice(0, options.length, ...config.options); return mukaiPick(config.options); },
    addMoney() {}, addStamina: n => { state.stamina += n; }, earnStat() {}, gainAffinity() {}, earnSceneCompletion() {},
    TOKYO_VISIT_COST: 3500, spendableMoney: value => value.money, canReflect: () => false, consultLessons: async () => {},
    loadStoryRoutes: async () => ({}), availableOptionalScenes: () => [], chapterThreeOutingCandidates: () => [],
    availableChapterThreeTrials: () => [], loverMilestonesDue: () => [], questionVisitDue: () => false, finaleAtVisit: () => false,
    OUTING_DIALOGUE_IDS: [], ROOM_REST_IDS: [], OUTINGS_FLAG: "_ch3_outings", outingCounts: value => value.flags._ch3_outings || {}, mukaiShiftPay: () => 10000,
    MUKAI_SHIFT_STAMINA: -14, TOKYO_FREE_TIMES_V3: [], CH3_DAILY_PLAN: {}, chapterThreeScenes: () => [], chapterThreeProgress: () => ({ stage: 0, startDay: 1 }),
    chainStageAt: chains.chainStageAt, chainVisitDue, playChainStage,
  });
  const { chapterThreeTokyoDefinition, CH3_TOKYO_SPOTS } = ch3.ns;
  setState({ chapter: 3, day: 20, slot: 0, money: 10000, stamina: 100, phase: "daily", flags: { _ch3_outings: { mukai_help: 1 } } });
  const mukai = CH3_TOKYO_SPOTS.find(entry => entry.place === "mukai");
  const perform = () => chapterThreeTokyoDefinition({}).performSpot(mukai, { staminaGuard: async () => true });
  mukaiPick = () => null;
  await perform();
  assert(!options.some(option => String(option.value).startsWith("chain:")), "1回働いただけでは出さない");
  assert.equal(mukai.hasNew(), false);
  state.flags._ch3_outings.mukai_help = 2;
  assert.equal(mukai.hasNew(), true, "2回働いたら「！」");
  await perform();
  assert.equal(options.at(-2).label, "常連さんの相談を聞く", "選択肢の最後（やめておくの前）に出す");
  mukaiPick = config => config.find(option => String(option.value).startsWith("chain:")).value;
  chooser = () => 2; // 炭を載せたら、少し待ってください
  const stamina = state.stamina;
  assert.deepEqual(plainOf(await perform()), { used: true, exerted: true });
  assert.equal(played.at(-1), "ch3_chain_tofu_1");
  assert.equal(stamina - state.stamina, 10);
  assert.equal(chains.chainRecord(state, "ch3_tofu").picks.ch3_chain_tofu_1, "wait");
  mukaiPick = () => null;
  await perform();
  assert(!options.some(option => String(option.value).startsWith("chain:")), "同じ日は次の段を出さない");
  state.day += 1;
  mukaiPick = config => config.find(option => String(option.value).startsWith("chain:")).value;
  chooser = () => 0;
  shown = [];
  await perform();
  assert.equal(played.at(-1), "ch3_chain_tofu_2");
  assert(shown.some(t => t.includes("三回聞いた")), "1段目の答え（待つ）が返る");
  state.day += 1;
  shown = [];
  await perform();
  assert.equal(played.at(-1), "ch3_chain_tofu_3");
  assert(shown.some(t => t.includes("家内とベランダ")) && shown.some(t => t.includes("俺のだ")), "1・2段目の答えが返る");
  assert(chains.chainFinished(state, "ch3_tofu"));
}

console.log("OK: visit chains wiring — play wrapper (hooks, records, interruption, load failure), ch5 Tokyo Smoke & Glory, ch5 Dubai alley (night, no fee) and courtyard flags / residence pair (affinity), ch4 cafe→inn→cafe (inn trial result) and longlong tea, ch3 mukai option");
