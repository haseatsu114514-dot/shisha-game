// 日常パートの1日の流れ: 朝（DAYカード・LIME）→ 昼の行動 → 夜の行動 → 夜の固定イベント → 帰宅 → 翌朝。
import { el, sleep, yen } from "../core/util.js";
import { layers, dayCard, dayTurn, modal, toast, fadeBlack, bannersIdle, setBg } from "../core/ui.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { addMoney, addStamina, gainAffinity, paidAction, staminaAfter, staminaRatio, maxStamina } from "../core/stats.js";
import { coldRisk, catchesCold } from "../core/illness.js";
import { DB, bgUrl } from "../core/data.js";
import { SE, playBgm } from "../core/audio.js";
import { play } from "../vn/engine.js";
import { glossaryPanel } from "../vn/glossary.js";
import { initHud, showHud, updateHud, daysLeft, setPhoneBadge, presentSleepRecovery } from "./hud.js";
import { TOURNAMENT_DAY } from "../core/rules.js";
import { chooseSpot, interruptMap } from "./map.js";
import { isRainy, weatherOf } from "./weather.js";
import { spotById, visitRival, visitSpot, visitChar, restAtHome, isClosed, storyCount, CHAR_STAT } from "./spots.js";
import { doFortune } from "./fortune.js";
import { tonariMenu, tonariCustomer, doBaito } from "./tonari.js";
import { openShop, visitRin, ownsFlavor } from "./shop.js";
import { deliverMorning, pushNotice, hasUnread, openLime, limeCoach, expireInvitations } from "./phone.js";
import { openStatus } from "./status.js";
import { onAction as spinReel, presentNow as showReelNow } from "./reel.js";
import { maybeConfession, playDate } from "./romance.js";
import { afterStory, isFinaleEvent, playFinale, isFriendEvent, playFriendHangout } from "./bonds.js";
import { syncKafukaKnowledge, maybeKafukaEncounter, visitKafuka } from "./kafuka.js";

import { invitationCost, invitationGrowth } from "./invitations.js";

const SLEEP_RECOVERY = 14;

let chapterDef = null;
let onQuit = null;
let queuedLimeSender = null;
let dawnShownDay = null; // 夜明けの幕でDAYカードを見せた日（同じ日の朝のDAYカードを重ねない）

/**
 * 日常パートを DAY1〜13 まで回す。DAY14の大会当日の朝の手前で返る。
 * @param def.nightEvents { [day]: { pin, beat, run: async () => {} } }
 * @param def.onQuit タイトルへ戻る処理
 */
export async function runDaily(def) {
  chapterDef = def;
  onQuit = def.onQuit;
  queuedLimeSender = null;
  syncKafukaKnowledge();
  expireInvitations({ fixedNight: (d) => !!chapterDef.nightEvents[d] });
  initHud({ phone: phoneButton, status: openStatus, menu: openMenu });
  showHud(true);
  setPhoneBadge(hasUnread()); // つづきから再開したときも未読の赤丸を出す
  while (state.day < TOURNAMENT_DAY) {
    if (!state.flags[`_morning_${state.day}`]) {
      state.flags[`_morning_${state.day}`] = true;
      await morning();
      save();
    }
    if (state.day === 1 && state.slot === 0 && !state.flags._errand_scout_done) {
      await day1Errands();
      save();
    }
    while (state.slot < 2) {
      const delivery = dueDelivery();
      if (delivery) await deliver(delivery);
      else await takeAction();
      updateHud();
      save();
    }
    await endDay();
    save();
  }
}

async function morning() {
  playBgm("kansetsu_shomei_to_black_coffee");
  // 就寝から続けて来た朝は、夜明けの幕でDAYを見せ終えている（見せた印はここで使い切る）
  if (dawnShownDay === state.day) dawnShownDay = null;
  else await dayCard(`DAY ${state.day}`, `SMOKE CROWN CUP まで あと${daysLeft()}日`, { weather: weatherOf() });
  // LIME は通知だけ（中身は好きなときにアプリを開いて読む）
  const n = deliverMorning({ fixedNight: (d) => !!chapterDef.nightEvents[d] });
  if (n) pushNotice(n, { onOpen: (sender) => {
    if (document.querySelector("#screen .map:not(.done)") && !layers.modal.classList.contains("show")) phoneButton({ sender });
    else queuedLimeSender = sender;
  } });
  setPhoneBadge(hasUnread());
}

/** HUD の LIME。街に出ているとき（マップ）だけ開ける。誘いに乗ったらマップを閉じてそのまま向かう */
async function phoneButton({ sender = null } = {}) {
  if (!document.querySelector("#screen .map:not(.done)") || layers.modal.classList.contains("show")) {
    SE.cancel();
    toast("LIME は街に出ているとき（マップ）に開ける");
    return;
  }
  SE.select();
  const first = !state.flags._lime_opened;
  state.flags._lime_opened = true;
  state.flags._lime_tut = 1; // 自分で開けたなら案内はいらない
  const before = state.pendingInvite;
  await openLime({ tutorial: first, sender });
  syncKafukaKnowledge();
  setPhoneBadge(hasUnread());
  save();
  // 乗った誘い: 今の時間帯ならすぐ向かう／今夜の約束ならマップを出し直して「約束がある」を見せる
  if (state.pendingInvite && state.pendingInvite !== before) interruptMap("__lime__");
}

async function openMenu() {
  SE.select();
  const v = await modal({
    title: "MENU",
    className: "menu-modal",
    body: `DAY ${state.day}・${state.slot >= 1 ? "夜" : "昼"}　／　行動のたびに自動でセーブされています。`,
    options: [
      { label: "セーブ", value: "save", test: "menu-save" },
      { label: "ロード", value: "load", test: "menu-load" },
      { label: "用語集", value: "glossary" },
      { label: "タイトルへ戻る", value: "title", test: "menu-title" },
      { label: "閉じる", value: null, primary: true },
    ],
  });
  if (v === "save") {
    // 手動セーブは街に出ているとき（マップ）だけ。会話や作業の途中の状態は残さない
    if (!document.querySelector("#screen .map:not(.done)")) { toast("セーブは街に出ているとき（マップ）にできる"); return; }
    await saveFlow();
  }
  if (v === "load") {
    const key = await loadFlow({ inGame: true });
    if (key && loadFromSlot(key)) { requestResumeOnBoot(); location.reload(); }
  }
  if (v === "glossary") await modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal", options: [{ label: "閉じる", value: true, primary: true }] });
  if (v === "title") { save(); location.reload(); }
}

// ---------------------------------------------------------------- 1日目の案内

const TONARI_BG = "res://assets/backgrounds/bg_tonari_inside.png";

/**
 * 1日目だけ、自由行動の前にスミさんのおつかいを2つ実地でやる（旧版 N18/N19）。
 * ① Dr.fookah でミントを仕入れる（買い物は時間を使わない）→ ② KEMURIKUSA を客として偵察（行動1回＋交通費）。
 * マップは行き先の1か所だけ選べる案内つき。続く配達（DAY1 夜・DAY2 昼）が済んでからが本当の自由行動
 */
async function day1Errands() {
  const f = state.flags;
  const mint = DB.flavorById.mint;
  if (!f._errand_shop_done && (!mint || ownsFlavor("mint"))) f._errand_shop_done = true;
  if (!f._errand_shop_done) {
    if (!f._errand_shop_told) {
      await play("remake_day1_errand_shop", { bg: TONARI_BG });
      f._errand_shop_told = true;
      save();
    }
    await chooseSpot({ guide: { pin: "shop", text: "スミさんに頼まれた仕入れへ。Dr.fookah をタップ！" } });
    await openShop({ errand: "mint", expense: true });
    f._errand_shop_done = true;
    toast("スミ「上出来だ。……この調子で、ちゃんと店を回せ」", { ms: 3200 });
    save();
    await bannersIdle();
  }
  const naru = spotById("naru");
  if (!naru || (!f._errand_naru_visited && (isClosed(naru) || state.money < (naru.cost || 0)))) { f._errand_scout_done = true; return; }
  if (!f._errand_scout_told) {
    await play("remake_day1_errand_scout", { bg: TONARI_BG });
    f._errand_scout_told = true;
    save();
  }
  if (!f._errand_naru_visited) await chooseSpot({ guide: { pin: "naru", text: "ケムリクサへ偵察に。KEMURIKUSA をタップ！" } });
  if (!f._errand_naru_visited) {
    await visitRival(naru);
    state.visitedDay.naru = state.day;
    f._errand_naru_visited = true;
    save();
  }
  await chooseSpot({ guide: { pin: "c_station", text: "なるに教わった大会会場へ。C.STATION で参加登録！" } });
  // 初回は一服する来店ではなく、無料の会場見学・参加登録。
  const venue = spotById("c_station");
  await visitSpot({ ...venue, cost: 0, stamina: 0 });
  state.visitedDay.c_station = state.day;
  f._errand_scout_done = true;
  state.slot++;
  await afterAction({ exerted: true });
}

// ---------------------------------------------------------------- tonari の配達

/**
 * 第1章は、スミさんの届け物でEDEN・PEPPERMINTの初来店を必ず通す（DL01）。DAY1 のおつかいに続けて
 * DAY1 夜に EDEN、DAY2 昼に PEPPERMINT。配達が全部済むまでマップは届け先だけを選べる（DL02）。
 * 一服の代金はかからず、手当をバイト代に上乗せする。強制の行動なので能力とスロットは伸びない。
 * 自分で先に行った旧セーブの店は飛ばし、DAY2 を過ぎた旧セーブには割り込まない
 */
const DELIVERIES = [
  { charId: "adam", day: 1, slot: 1, scene: "remake_delivery_eden", text: "古いダブルアップルの缶を EDEN へ。EDEN をタップ！" },
  { charId: "minto", day: 2, slot: 0, scene: "remake_delivery_minto", text: "まとめ買いのミントを PEPPERMINT へ。PEPPERMINT をタップ！" },
];
const DELIVERY_LAST_DAY = 2;
const DELIVERY_PAY = 2000;
const DELIVERY_STAMINA = -10;

function dueDelivery() {
  if (state.chapter !== 1 || state.day > DELIVERY_LAST_DAY || !state.flags._errand_scout_done) return null;
  const inv = state.pendingInvite;
  if (inv && (inv.day ?? state.day) === state.day && inv.slot === state.slot) return null; // 先にした約束を守る
  for (const d of DELIVERIES) {
    const done = `_delivery_${d.charId}_done`;
    if (state.flags[done] || state.day * 2 + state.slot < d.day * 2 + d.slot) continue;
    if (storyCount(d.charId) > 0) { state.flags[done] = true; continue; } // もう自分で行った店
    const spot = spotById(d.charId);
    if (spot && !isClosed(spot)) return d;
  }
  return null;
}

async function deliver({ charId, scene, text }) {
  const f = state.flags;
  if (!f[`_delivery_${charId}_told`]) {
    await play(scene, { bg: TONARI_BG });
    f[`_delivery_${charId}_told`] = true;
    save();
  }
  await chooseSpot({ guide: { pin: charId, text, free: "配達（代金なし）" } });
  f[`_delivery_${charId}`] = true; // 初来店の入りを配達の場面にする
  addStamina(DELIVERY_STAMINA);
  playBgm("tonari");
  await visitChar(charId);
  addMoney(DELIVERY_PAY);
  toast(`配達の手当 +${DELIVERY_PAY.toLocaleString()}円（バイト代に上乗せ）`, { kind: "good" });
  state.visitedDay[charId] = state.day;
  f[`_delivery_${charId}_done`] = true;
  state.slot++;
  await afterAction();
}

// ---------------------------------------------------------------- 行動

async function staminaGuard(cost) {
  if (!(cost < 0) || !coldRisk(staminaAfter(cost) / maxStamina())) return true;
  const go = await modal({
    title: "体が重い……",
    body: "体力が赤い状態での行動だ。残りが少ないほど、翌朝に風邪で寝込む危険が高くなる。<br>無事に済むこともあるけど、今は「家に帰る」で休める。",
    options: [{ label: "やめておく", value: false }, { label: "それでも行く", value: true, test: "stamina-go" }],
  });
  return go;
}

async function takeAction() {
  expireInvitations({ fixedNight: (d) => !!chapterDef.nightEvents[d] });
  // 約束（LIMEの誘い）がこの時間帯にあれば、そのまま向かう
  const inv = state.pendingInvite;
  if (inv && (inv.day ?? state.day) === state.day && inv.slot === state.slot) {
    if (state.money < invitationCost(inv.event)) {
      state.pendingInvite = null;
      toast(`約束の店には${yen(invitationCost(inv.event))}必要です。今日は見送ります`, { kind: "warn" });
      save();
      return;
    }
    if (inv.afterClose) {
      // 夜の行動枠を予約し、会う場面は営業イベント後・帰宅前まで待つ。
      inv.queuedAfterClose = true;
      state.slot++;
      return;
    }
    state.pendingInvite = null;
    if (state.slot === 1) state.flags._private_night_day = state.day;
    if (state.slot === 1) state.flags._private_night_char = inv.sender;
    const { spent } = await paidAction(() => meetInvitation(inv), { ...invitationGrowth(inv.event), primary: CHAR_STAT[inv.sender] });
    state.slot++;
    await afterAction({ exerted: true, spent });
    return;
  }
  const ev = chapterDef.nightEvents[state.day];
  syncKafukaKnowledge();
  const spotId = await chooseSpot({
    eventPin: ev && !ev.done?.() ? ev.pin : null,
    notice: inv && (inv.day ?? state.day) > state.day ? `DAY ${inv.day}に約束がある` : inv && inv.slot > state.slot ? "今夜は約束がある" : "",
    onShown: () => {
      if (queuedLimeSender) { const sender = queuedLimeSender; queuedLimeSender = null; phoneButton({ sender }); }
      else limeCoach(phoneButton);
    }, // 通知を先にタップした場合は、マップが開いたところで目的のトークへ
  });
  if (spotId === "__lime__") return; // LIME で誘いに乗った → 次の takeAction で約束へ
  const spot = spotById(spotId);
  const { value: { used, exerted }, spent } = await paidAction(() => performSpotAction(spot));
  if (!used) return;
  state.visitedDay[spot.id] = state.day;
  state.slot++;
  await afterAction({ exerted, spent });
}

async function performSpotAction(spot) {
  let used = true;
  let exerted = false;
  if (spot.kind === "tonari") {
    const sub = await tonariMenu();
    if (!sub) return { used: false, exerted };
    if (state.visitedDay[`tonari_${sub}`] === state.day) {
      toast(sub === "baito" ? "今日のシフトはもう終わった" : "今日はもう客席で一服した");
      return { used: false, exerted };
    }
    if (!(await staminaGuard(sub === "baito" ? -24 : -10))) return { used: false, exerted };
    exerted = true;
    state.visitedDay[`tonari_${sub}`] = state.day;
    if (sub === "baito") await doBaito();
    else await tonariCustomer();
  } else if (spot.kind === "kafuka") {
    if (!(await staminaGuard(spot.stamina))) return { used: false, exerted };
    used = await visitKafuka(spot);
    exerted = spot.stamina < 0;
  } else if (spot.kind === "rival") {
    if (!(await staminaGuard(spot.stamina))) return { used: false, exerted };
    await visitRival(spot);
    exerted = true;
  } else if (spot.kind === "shop") {
    const r = await openShop();
    if (r !== "rin") used = false;
    else if (await staminaGuard(-14)) { await visitRin(); exerted = true; }
    else used = false;
  } else if (spot.kind === "spot") {
    if (!(await staminaGuard(spot.stamina))) return { used: false, exerted };
    await visitSpot(spot);
    exerted = spot.stamina < 0;
  } else if (spot.kind === "rest") {
    await restAtHome(spot);
  } else if (spot.kind === "fortune") {
    await doFortune(); // 時間は使わない（占ってもらったら今日はもう寄れない）
    save();
    return { used: false, exerted };
  }
  return { used, exerted };
}


async function meetInvitation(inv) {
  const cost = invitationCost(inv.event);
  if (state.money < cost) {
    toast(`約束の店には${yen(cost)}必要です。所持金が足りません`, { kind: "warn" });
    return;
  }
  addMoney(-cost);
  await fadeBlack(null, 300);
  if (inv.event === "__sumi_baito__") {
    // スミさんのLIMEで急に呼ばれたシフト。そのまま tonari で働く（給料に上乗せ）
    state.visitedDay.tonari_baito = state.day;
    state.visitedDay.tonari = state.day;
    await doBaito({ called: true });
  } else if (/^date_/.test(inv.event)) {
    await playDate(inv.sender); // 恋人とのデート（絆・ステ・体力はデート側で）
  } else if (isFriendEvent(inv.event)) {
    // 友人からのシーシャのお誘い（HF09）。ステは場面側の apply
    await playFriendHangout(inv.sender);
    gainAffinity(inv.sender, 5);
    addStamina(-10);
  } else if (isFinaleEvent(inv.event)) {
    // 私的な約束で会う締めくくり（みんと）。専用ハガルの贈呈・ルートの記録は bonds.js
    await playFinale(inv.sender);
    gainAffinity(inv.sender, 10);
    addStamina(-10);
  } else {
    await play(inv.event);
    if (inv.event === `outing_${inv.sender}_1`) state.flags[`_outing_done_${inv.sender}`] = true;
    if (inv.event === "ch1_minto_fifth") state.flags._minto_fifth_done = true;
    if (inv.event === "ch1_adam_outing_dagurikura") state.flags._adam_arcade_done = true;
    gainAffinity(inv.sender, 10);
    addStamina(-10);
    await afterStory(inv.event); // 私服の約束のあとの、途中の質問（みんと）
  }
  if (inv.event !== "__sumi_baito__" && CHAR_STAT[inv.sender]) {
    const { earnStat } = await import("../core/stats.js");
    earnStat(CHAR_STAT[inv.sender], 1);
  }
}

/** 行動を1回使ったあと: スロットが1回転（昼は次のマップで・夜はその場で見せる）。告白は営業後に endDay で扱う */
async function afterAction({ exerted = false, spent = 0 } = {}) {
  // 警告の承諾回数ではなく、実際に消耗した行動の終了時に一度だけ抽選する。
  if (exerted && !state.flags._cold_pending && catchesCold(staminaRatio())) state.flags._cold_pending = true;
  spinReel({ spent });
  save();
  // 昼の行動の分は次のマップで回る。夜の行動の分は、その夜のうちにここで回す
  if (state.slot >= 2) await showReelNow();
  await bannersIdle();
}

// ---------------------------------------------------------------- 夜・翌朝

/** 場面のつなぎの一行（「夜、tonariに顔を出す──」など）。前の場面の絵はここで暗転させる */
async function beat(text) {
  setBg(null);
  const b = el("div.beat", { text });
  layers.fx.append(b);
  await sleep(20);
  b.classList.add("show");
  await sleep(1500);
  b.classList.remove("show");
  await sleep(400);
  b.remove();
}

async function endDay() {
  const ev = chapterDef.nightEvents[state.day];
  if (ev && !(ev.done && ev.done())) {
    await bannersIdle();
    if (ev.beat) await beat(ev.beat);
    await ev.run();
    await bannersIdle();
  }
  const appointment = state.pendingInvite;
  let metTonight = state.flags._private_night_day === state.day; // 夜の行動枠で約束の相手に会った
  let companion = metTonight ? state.flags._private_night_char : null;
  if (appointment?.afterClose && appointment.queuedAfterClose && (appointment.day ?? state.day) === state.day) {
    state.pendingInvite = null;
    await beat("——店の営業が終わってから、約束の場所へ。");
    const { spent } = await paidAction(() => meetInvitation(appointment), { ...invitationGrowth(appointment.event), primary: CHAR_STAT[appointment.sender] });
    await afterAction({ exerted: true, spent });
    metTonight = true;
    companion = appointment.sender;
  }
  // 別の約束で人と会った夜に告白は重ねない（予約は残り、落ち着いた夜に回る）
  const confessed = await maybeConfession(beat, { busyNight: metTonight, companion });
  if (confessed) await bannersIdle();
  const athome = !!state.flags._home_tonight;
  delete state.flags._home_tonight;
  const next = chapterDef.nightEvents[state.day + 1];
  if (!athome) {
    await maybeKafukaEncounter({ hasNightEvent: !!ev,
      hasAppointment: !!appointment && (appointment.day ?? state.day) === state.day, hadConfession: confessed, athome });
    await play(`remake_homecoming_${state.day % 3}`);
  }
  if (next && next.teaser && state.day + 1 < TOURNAMENT_DAY) toast(`（明日、${next.teaser}で何かありそうな気がする）`, { ms: 2400 });
  await bannersIdle();
  await advanceDay();
}

async function advanceDay() {
  const exhausted = !!state.flags._cold_pending;
  delete state.flags._cold_pending;
  delete state.flags._overwork; // 旧セーブの固定発病カウンターは使わない。
  const sleepBefore = state.stamina;
  const fromDay = state.day;
  const fromLeft = daysLeft();
  const wake = () => {
    // 大会の朝に発病しても大会日を飛ばさない。その夜は回復せず、不調の残量で本番へ。
    addStamina(exhausted && state.day + 1 >= TOURNAMENT_DAY ? 0 : SLEEP_RECOVERY);
    state.day += 1;
    state.slot = 0;
    updateHud();
    setBg(bgUrl("bg_home", "day"), { instant: true }); // 朝は家で目を覚ます（前の夜の場面の絵を持ち越さない）
  };
  if (state.day + 1 < TOURNAMENT_DAY) {
    // 夜の紫が降りて、DAYと残り日数がめくれ、地平線が昇って朝になる（大会当日は当日の演出に任せる）
    await dayTurn(async () => {
      wake();
      return { fromDay, day: state.day, fromLeft, left: daysLeft(), rain: isRainy(), weather: weatherOf(), sick: exhausted };
    });
    dawnShownDay = state.day;
  } else await fadeBlack(wake, 500);
  await presentSleepRecovery({ before: sleepBefore, after: state.stamina });
  if (!exhausted) return;
  if (state.day >= TOURNAMENT_DAY) {
    await play("remake_sick_tournament");
    updateHud();
    return;
  }
  state.flags._overwork = 0;
  const first = !state.flags._sick_once;
  state.flags._sick_once = true;
  state.flags[`_morning_${state.day}`] = true;
  if (dawnShownDay !== state.day) await dayCard(`DAY ${state.day}`, "……熱っぽい");
  if (first) {
    await play("remake_sick_half");
    addStamina(Math.max(0, 60 - state.stamina));
    state.slot = 1; // 初回だけは半日で回復（夜の1行動は残る）
  } else {
    await play("remake_sick_full");
    addStamina(Math.max(0, 80 - state.stamina));
    state.slot = 2;
    state.flags._home_tonight = true;
  }
  updateHud();
}
