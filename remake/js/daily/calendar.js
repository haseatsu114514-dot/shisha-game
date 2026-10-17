// 日常パートの1日の流れ: 朝（DAYカード・LIME）→ 昼の行動 → 夜の行動 → 夜の固定イベント → 帰宅 → 翌朝。
import { el, sleep, yen } from "../core/util.js";
import { layers, dayCard, dayTurn, modal, toast, fadeBlack, bannersIdle, setBg, refreshWeather } from "../core/ui.js";
import { state, save, loadFromSlot, requestResumeOnBoot, markMet } from "../core/state.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { addMoney, addStamina, gainAffinity, paidAction, staminaAfter, staminaRatio, maxStamina, currentCondition } from "../core/stats.js";
import { conditionForRatio } from "../core/condition.js";
import { coldRisk, catchesCold, fitActive, FIT_DAYS } from "../core/illness.js";
import { DB, bgUrl, displayName } from "../core/data.js";
import { SE, playBgm } from "../core/audio.js";
import { play } from "../vn/engine.js";
import { glossaryPanel } from "../vn/glossary.js";
import { initHud, showHud, updateHud, daysLeft, setPhoneBadge, presentSleepRecovery } from "./hud.js";
import { TOURNAMENT_DAY } from "../core/rules.js";
import { runHomeShisha } from "./home-shisha.js";
import { chapterDay } from "../core/chapter-clock.js";
import { chooseSpot, interruptMap, isChoosingDestination } from "./map.js";
import { isRainy, weatherOf } from "./weather.js";
import { spotById, visitRival, visitSpot, visitChar, restAtHome, isClosed, storyCount, CHAR_STAT, bgRef, VISIT_BG } from "./spots.js";
import { doFortune } from "./fortune.js";
import { tonariMenu, tonariCustomer, tonariPractice, doBaito } from "./tonari.js";
import { openShop, visitRin, ownsFlavor } from "./shop.js";
import { openingStatus } from "./spot-hours.js";
import { deliverMorning, pushNotice, unreadCount, actionInviteNeedingReply, openLime, limeCoach, expireInvitations, rescheduleInvitation, completeInvitation } from "./phone.js";
import { openStatus } from "./status.js";
import { onAction as spinReel, presentNow as showReelNow, changeSetting as changeReelSetting } from "./reel.js";
import { maybeConfession, playDate } from "./romance.js";
import { samechanDateReady, playSamechanDate } from "./samechan-date.js";
import { afterStory, isFinaleEvent, playFinale, isFriendEvent, playFriendHangout } from "./bonds.js";
import { syncSamechanKnowledge, maybeSamechanEncounter, visitSamechan } from "./samechan.js";

import { invitationCost, invitationGrowth, storeInvitationSpot, storeInvitationDialogue } from "./invitations.js";
import { visitHiyoriAtShop, playHiyoriEvent, playHiyoriHangout } from "./hiyori.js";
import { restingToday, syncNightQueue, nightPlan, nightOccupied, runNightPlan } from "./night-events.js";
import { openTrpgBar } from "./trpg.js";

const SLEEP_RECOVERY = 14;

let chapterDef = null;
let onQuit = null;
let queuedLimeSender = null;
let dawnShownDay = null; // 夜明けの幕でDAYカードを見せた日（同じ日の朝のDAYカードを重ねない）
const fixedNight = (day) => nightOccupied(chapterDef.nightEvents, day);

/**
 * 日常パート。章側は実装済みの最終日、街の選択と固有行動だけを差し替えられる。
 * @param def.nightEvents { [day]: { pin, beat, run: async () => {} } }
 * @param def.onQuit タイトルへ戻る処理
 */
export async function runDaily(def) {
  chapterDef = def;
  onQuit = def.onQuit;
  queuedLimeSender = null;
  syncSamechanKnowledge();
  syncNightQueue(chapterDef.nightEvents);
  expireInvitations({ fixedNight });
  initHud({ phone: phoneButton, status: openStatus, menu: openMenu });
  showHud(true);
  setPhoneBadge(unreadCount()); // つづきから再開したときも未読の赤丸を出す
  if (def.startNextDay && chapterDay(state) === 1) { await advanceDay(); save(); }
  while (state.day < (def.untilDay ?? TOURNAMENT_DAY)) {
    syncNightQueue(chapterDef.nightEvents);
    if (!state.flags[`_morning_${state.day}`]) {
      state.flags[`_morning_${state.day}`] = true;
      await morning();
      save();
    }
    if (state.chapter === 1 && state.day === 1 && state.slot === 0 && !state.flags._errand_scout_done) {
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
  refreshWeather();
  playBgm("kansetsu_shomei_to_black_coffee");
  // 就寝から続けて来た朝は、夜明けの幕でDAYを見せ終えている（見せた印はここで使い切る）
  if (dawnShownDay === state.day) dawnShownDay = null;
  else await dayCard(`DAY ${chapterDay(state)}`, `${chapterDef.tournamentName || "SMOKE CROWN CUP"} まで あと${daysLeft()}日`, { weather: weatherOf() });
  // LIME は通知だけ（中身は好きなときにアプリを開いて読む）
  const n = deliverMorning({ fixedNight });
  if (n) pushNotice(n, { onOpen: (sender) => {
    if (isChoosingDestination() && !layers.modal.classList.contains("show")) phoneButton({ sender });
    else queuedLimeSender = sender;
  } });
  setPhoneBadge(unreadCount());
}

/** HUD の LIME。行き先を選んでいるときだけ開ける。誘いに乗ったらマップを閉じてそのまま向かう */
async function phoneButton({ sender = null } = {}) {
  if (!isChoosingDestination() || layers.modal.classList.contains("show")) {
    SE.cancel();
    toast("LIME は行き先を選んでいるときに開ける");
    return;
  }
  SE.select();
  await readLime(sender);
}

async function readLime(sender) {
  const first = !state.flags._lime_opened;
  state.flags._lime_opened = true;
  state.flags._lime_tut = 1; // 自分で開けたなら案内はいらない
  const before = state.pendingInvite;
  await openLime({ tutorial: first, sender, fixedNight });
  syncSamechanKnowledge();
  setPhoneBadge(unreadCount());
  save();
  // 乗った誘い: 今の時間帯ならすぐ向かう／今夜の約束ならマップを出し直して「約束がある」を見せる
  if (state.pendingInvite && state.pendingInvite !== before) interruptMap("__lime__");
}

async function confirmLimeReminder(destination, { spendsAction = true, slotsUsed = 1 } = {}) {
  const dayPrefix = `${state.chapter}:${state.day}:`;
  const remembered = Array.isArray(state.flags._venue_lime_reminders)
    ? state.flags._venue_lime_reminders.filter((id) => id.startsWith(dayPrefix)) : [];
  // 既に思い出した招待は飛ばし、同日中に別の招待があればそちらを確認する。
  const ignoredIds = remembered.map((id) => id.slice(dayPrefix.length));
  if (state.flags._minto_store_lime_reminder?.startsWith(dayPrefix)) {
    ignoredIds.push(state.flags._minto_store_lime_reminder.slice(dayPrefix.length));
  }
  const reminder = actionInviteNeedingReply(destination?.id,
    { fixedNight, spendsAction, slotsUsed }, ignoredIds);
  if (!reminder) return true;
  const { item: pending, kind } = reminder;
  const reminderId = `${dayPrefix}${pending.id}`;
  state.flags._venue_lime_reminders = [...remembered, reminderId];
  const sender = pending.msg.sender;
  const senderName = { minto: "みんと", sumi: "スミさん", hiyori: "ひより", naru: "なる",
    adam: "アダム", tsumugi: "つむぎ", ageha: "アゲハ", samechan: "サメちゃん" }[sender] || "誰か";
  const choice = await modal({
    title: "LIMEのお誘い",
    body: kind === "venue"
      ? `そういえば、${senderName}からLIMEが来てたな……`
      : `このまま行くと、${senderName}からの今日のお誘いに返事しそびれそうだ……`,
    options: [
      { label: "LIMEを確認する", value: "lime", primary: true, test: "venue-invite-check" },
      { label: "そのまま向かう", value: "go", test: "venue-invite-go" },
    ],
  });
  if (choice === "lime") {
    await readLime(pending.account || sender);
    return false;
  }
  return true;
}

async function openMenu() {
  SE.select();
  const v = await modal({
    title: "MENU",
    className: "menu-modal",
    body: `DAY ${chapterDay(state)}・${state.slot >= 1 ? "夜" : "昼"}　／　行動のたびに自動でセーブされています。`,
    options: [
      { label: "セーブ", value: "save", test: "menu-save" },
      { label: "ロード", value: "load", test: "menu-load" },
      { label: "用語集", value: "glossary" },
      { label: "タイトルへ戻る", value: "title", test: "menu-title" },
      { label: "閉じる", value: null, primary: true },
    ],
  });
  if (v === "save") {
    // 手動セーブは行き先を選んでいるときだけ。会話や作業の途中の状態は残さない
    if (!isChoosingDestination()) { toast("セーブは行き先を選んでいるときにできる"); return; }
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
  await chooseSpot({ guide: { pin: "c_station", text: "大会を運営する C.STATION へ。店舗の受付で参加登録！" } });
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
 * DAY1 夜に EDEN、DAY2 昼に PEPPERMINT。配達先までは案内し、完了後に自由行動へ戻す（DL02更新）。
 * EDENは従来の無料体験、PEPPERMINTは店先で荷物だけを渡し一服は任意。手当をバイト代に上乗せする。
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
  f[`_delivery_${charId}`] = true;
  addStamina(DELIVERY_STAMINA);
  playBgm("tonari");
  if (charId === "minto") {
    // 配達は店先まで。勝手に客席へ進まず、店内の初来店は後の自由行動に任せる。
    await play("remake_delivery_minto_handoff", { bg: "res://assets/backgrounds/bg_street_day.png" });
    f.known_name_minto = true;
    f._met_minto = true;
    markMet("minto");
  } else {
    // EDENの初来店は従来どおりスミさんの指定による体験。
    await visitChar(charId);
    state.visitedDay[charId] = state.day;
  }
  addMoney(DELIVERY_PAY);
  toast(`配達の手当 +${DELIVERY_PAY.toLocaleString()}円（バイト代に上乗せ）`, { kind: "good" });
  f[`_delivery_${charId}_done`] = true;
  state.slot++;
  await afterAction();
}

// ---------------------------------------------------------------- 行動

async function staminaGuard(cost) {
  if (!(cost < 0) || !coldRisk(staminaAfter(cost) / maxStamina())) return true;
  const go = await modal({
    title: "体が重い……",
    body: "体力が赤い状態での行動だ。残りが少ないほど、翌朝に風邪で寝込む危険が高くなる。<br>無事に済むこともあるけど、今は「家に帰る」で休める。"
      + (fitActive(state) ? "<br>（チョコザップで体を整えたので、今は風邪をひきにくい）" : ""),
    options: [{ label: "やめておく", value: false }, { label: "それでも行く", value: true, test: "stamina-go" }],
  });
  return go;
}

async function takeAction() {
  syncNightQueue(chapterDef.nightEvents);
  expireInvitations({ fixedNight });
  // 約束（LIMEの誘い）がこの時間帯にあれば、そのまま向かう
  const inv = state.pendingInvite;
  if (inv?.event === "date_samechan" && !samechanDateReady()) {
    cancelSamechanAppointment(inv);
    return;
  }
  if (inv && (inv.day ?? state.day) === state.day && inv.slot === state.slot) {
    if (postponeUnaffordableInvitation(inv)) return;
    if (inv.afterClose) {
      // 夜の行動枠を予約し、会う場面は営業イベント後・帰宅前まで待つ。
      inv.queuedAfterClose = true;
      state.slot++;
      return;
    }
    if (inv.event === "date_samechan") {
      const result = await playSamechanDate({ invite: inv, cost: invitationCost(inv.event), advanceSlot: true });
      if (result.done) { completeInvitation(inv); await afterAction({ exerted: true, spent: result.spent }); }
      return;
    }
    state.pendingInvite = null;
    if (state.slot === 1) state.flags._private_night_day = state.day;
    if (state.slot === 1) state.flags._private_night_char = inv.sender;
    const { value: met, spent } = await paidAction(() => meetInvitation(inv), { ...invitationGrowth(inv.event), primary: CHAR_STAT[inv.sender] });
    if (!met) {
      if (state.flags._private_night_day === state.day && state.flags._private_night_char === inv.sender) {
        delete state.flags._private_night_day;
        delete state.flags._private_night_char;
      }
      return;
    }
    state.slot++;
    await afterAction({ exerted: true, spent });
    return;
  }
  const ev = nightPlan(chapterDef.nightEvents)[0];
  syncSamechanKnowledge();
  const spotId = await chooseSpot({
    ...chapterDef.mapOptions?.(),
    eventPin: ev && !ev.done?.() ? ev.pin : null,
    notice: inv && (inv.day ?? state.day) > state.day ? `DAY ${inv.day}に約束がある` : inv && inv.slot > state.slot ? "今夜は約束がある" : "",
    onShown: () => {
      if (queuedLimeSender) { const sender = queuedLimeSender; queuedLimeSender = null; phoneButton({ sender }); }
      else limeCoach(phoneButton);
    }, // 通知を先にタップした場合は、マップが開いたところで目的のトークへ
    onBeforeGo: (destination) => confirmLimeReminder(destination, {
      spendsAction: !["shop", "fortune"].includes(destination.kind),
    }),
  });
  if (spotId === "__lime__") return; // LIME で誘いに乗った → 次の takeAction で約束へ
  const spot = chapterDef.spotById?.(spotId) || spotById(spotId);
  if (!spot) throw new Error(`行き先が見つかりません: ${spotId}`);
  const facility = ["kannon", "choizap"].includes(spot.id);
  const { value: { used, exerted, slotsUsed = 1 }, spent } = await paidAction(() => performSpotAction(spot), {
    ...(facility ? { budget: 1, points: 2, primary: spot.stat } : {}),
    consumed: (result) => result.used && spot.kind === "spot",
  });
  if (!used) return;
  state.visitedDay[spot.id] = state.day;
  // 施設のおまけ（#621）。説明はキャラではなくシステムの通知で短く
  // 観音堂: パッキースロットの設定が変わる（次に筐体が出たときに光って知らせる）
  if (spot.id === "kannon" && changeReelSetting()) toast("お参りした。パッキースロットの設定が変わったようだ", { kind: "good" });
  // チョコザップ: その日から数日、風邪をひきにくい
  if (spot.id === "choizap" && state.flags._gym_member) {
    state.flags._fit_since = { chapter: state.chapter, day: state.day };
    toast(`体が整った。${FIT_DAYS}日間は風邪をひきにくい`, { kind: "good" });
  }
  state.slot = Math.min(2, state.slot + slotsUsed);
  await afterAction({ exerted, spent });
}

async function performSpotAction(spot) {
  if (!openingStatus(spot, state).ok) return { used: false, exerted: false };
  if (spot.kind === "axe") {
    const { visitAxeBar } = await import("./axe-bar.js");
    const completed = await visitAxeBar({ staminaGuard });
    return { used: completed, exerted: completed };
  }
  if (chapterDef.performSpot) {
    const result = await chapterDef.performSpot(spot, { staminaGuard });
    if (result) return result;
  }
  if (spot.kind === "trpg") {
    const result = await openTrpgBar({ nightBusy: () => fixedNight(state.day) });
    return { used: result.completed, exerted: false, slotsUsed: 0 };
  }
  let used = true;
  let exerted = false;
  let slotsUsed = 1;
  if (spot.kind === "tonari") {
    const sub = await tonariMenu();
    if (!sub) return { used: false, exerted };
    if (sub === "hiyori_axe") {
      if (!(await staminaGuard(-10))) return { used: false, exerted };
      const completed = await playHiyoriEvent("axe_reveal");
      if (completed) state.visitedDay.tonari_hiyori_axe = state.day;
      // 料金・体力・読了と一緒に行動を保存済み。共通末尾で二重に進めない。
      return { used: completed, exerted: completed, slotsUsed: 0 };
    }
    if (state.visitedDay[`tonari_${sub}`] === state.day) {
      toast(sub === "baito" ? "今日のシフトはもう終わった" : "今日はもう客席で一服した");
      return { used: false, exerted };
    }
    if (!(await staminaGuard(sub === "baito" ? -24 : sub === "practice" ? -12 : -10))) return { used: false, exerted };
    exerted = true;
    state.visitedDay[`tonari_${sub}`] = state.day;
    if (sub === "baito") await doBaito();
    else if (sub === "practice") await tonariPractice();
    else await tonariCustomer();
  } else if (spot.kind === "samechan") {
    if (!(await staminaGuard(spot.stamina))) return { used: false, exerted };
    used = await visitSamechan(spot);
    exerted = spot.stamina < 0;
  } else if (spot.kind === "rival") {
    if (!(await staminaGuard(spot.stamina))) return { used: false, exerted };
    await visitRival(spot);
    exerted = true;
  } else if (spot.kind === "shop") {
    const r = await openShop();
    if (r !== "rin") used = false;
    else if (!(await confirmLimeReminder(spot))) used = false;
    else if (await staminaGuard(-14)) { used = await visitRin(); exerted = used; }
    else used = false;
  } else if (spot.kind === "spot") {
    if (!(await staminaGuard(spot.stamina))) return { used: false, exerted };
    await visitSpot(spot);
    exerted = spot.stamina < 0;
  } else if (spot.kind === "rest") {
    const unwell = currentCondition().health === "red" || !!state.flags._cold_pending
      || state.restDay?.chapter === state.chapter && state.restDay.day === state.day && !!state.restDay.illnessHealth;
    if (unwell) {
      const plan = nightPlan(chapterDef.nightEvents, { resting: true });
      const booked = state.pendingInvite && (state.pendingInvite.day ?? state.day) === state.day && state.pendingInvite.slot === 1;
      const choice = await modal({ title: "家で休む", className: "rest-modal",
        body: `今は${state.slot === 0 ? "昼" : "夜"}。残り${2 - state.slot}枠${booked ? "のうち夜は約束へ、それ以外" : ""}を休養に使えます。通常の夜の予定は後日へ。<br>${plan.length ? `今日の予定：${plan.map(ev => ev.label || "大切な予定").join("・")}には参加します。<br>` : ""}${booked ? `${displayName(state.pendingInvite.sender, state)}との今夜のLIMEの約束には参加します。<br>` : ""}回復は1枠につき体力+${spot.stamina}（上限まで）。`,
        options: [{ label: "半日休む（1行動）", value: "half", test: "rest-half" },
          { label: "今日は残りを全部休む", value: "full", test: "rest-full", primary: true },
          { label: "戻る", value: null, test: "rest-cancel" }] });
      if (!choice) return { used: false, exerted };
      if (choice === "full") {
        slotsUsed = 2 - state.slot;
        if (!(await confirmLimeReminder(spot, { slotsUsed }))) return { used: false, exerted };
        // 受諾済みの夜の約束の1枠は休養として回復させない。会う処理はendDayで保持する。
        const restSlots = Math.max(1, slotsUsed - (booked ? 1 : 0));
        const illnessHealth = state.restDay?.day === state.day ? state.restDay.illnessHealth : null;
        state.restDay = { chapter: state.chapter, day: state.day, fullDay: true, illnessHealth };
        await restAtHome({ ...spot, stamina: spot.stamina * restSlots }, { fullDay: true });
        state.flags._home_tonight = true;
        syncNightQueue(chapterDef.nightEvents);
        toast(`${restSlots}枠を休養へ${booked ? "。夜の約束には参加" : ""}。体力 ${state.stamina}/${maxStamina()}。通常の夜の予定は後日へ`, { ms: 4000 });
      } else await restAtHome(spot);
    } else await restAtHome(spot);
  } else if (spot.kind === "fortune") {
    await doFortune(); // 時間は使わない（占ってもらったら今日はもう寄れない）
    save();
    return { used: false, exerted };
  }
  if (used) await visitHiyoriAtShop(spot, { bg: bgRef(spot.bg || VISIT_BG[spot.charId] || (spot.kind === "shop" ? "bg_fookah_showroom" : "bg_tonari_inside")) });
  return { used, exerted, slotsUsed };
}


function postponeUnaffordableInvitation(inv) {
  const cost = invitationCost(inv.event);
  if (state.money >= cost) return false;
  rescheduleInvitation(inv, "所持金が足りなかったため、約束を別の日に改めることにした");
  toast(`約束の店には${yen(cost)}必要です。今日は見送り、別の日に改めます`, { kind: "warn" });
  save();
  return true;
}

async function meetInvitation(inv) {
  if (postponeUnaffordableInvitation(inv)) return false;
  const cost = invitationCost(inv.event);
  addMoney(-cost);
  await fadeBlack(null, 300);
  if (inv.event === "__sumi_baito__") {
    // スミさんのLIMEで急に呼ばれたシフト。そのまま tonari で働く（給料に上乗せ）
    state.visitedDay.tonari_baito = state.day;
    state.visitedDay.tonari = state.day;
    await doBaito({ called: true });
  } else if (inv.event === "hiyori_tonari_return") {
    await playHiyoriEvent("tonari_return");
    state.visitedDay.tonari = state.day;
    addStamina(-10);
  } else if (inv.event === "__hiyori_shop__") {
    const spot = spotById(inv.visitSpot);
    await playHiyoriHangout({ bg: bgRef(spot.bg || VISIT_BG[spot.charId]) });
    state.visitedDay[spot.id] = state.day;
    addStamina(-10);
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
    await play(storeInvitationSpot({ accept_event: inv.event })
      ? storeInvitationDialogue(DB.dialogues[inv.event], state.slot) : inv.event);
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
  completeInvitation(inv);
  return true;
}

function cancelSamechanAppointment(inv) {
  state.pendingInvite = null;
  const item = inv.originId && (state.inbox || []).find(i => i.id === inv.originId || i.originId === inv.originId);
  if (item) {
    item.result = "cancelled";
    (item.log ||= []).push({ note: "この約束には、今は出かけられない。" });
  }
  toast("この約束には、今は出かけられない。");
  save();
}

/** 行動を1回使ったあと: スロットが1回転（昼は次のマップで・夜はその場で見せる）。告白は営業後に endDay で扱う */
async function afterAction({ exerted = false, spent = 0 } = {}) {
  // 警告の承諾回数ではなく、実際に消耗した行動の終了時に一度だけ抽選する。
  if (exerted && !state.flags._cold_pending && catchesCold(staminaRatio(), Math.random, { fit: fitActive(state) })) state.flags._cold_pending = true;
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
  syncNightQueue(chapterDef.nightEvents);
  const rested = restingToday();
  const nightCount = await runNightPlan(chapterDef.nightEvents, async (ev) => {
    await bannersIdle();
    delete state.flags._home_tonight; // 休息後でも、固定イベントの場所へ出かける。
    if (rested || state.restDay?.illnessHealth) await beat("今日は休んでいたが、この予定だけは外せない——");
    if (ev.beat) await beat(ev.beat);
  });
  save();
  await bannersIdle();
  const appointment = state.pendingInvite;
  let metTonight = state.flags._private_night_day === state.day; // 夜の行動枠で約束の相手に会った
  let companion = metTonight ? state.flags._private_night_char : null;
  if (appointment && (appointment.day ?? state.day) === state.day
    && (appointment.afterClose && appointment.queuedAfterClose || rested && appointment.slot === 1)
    && !postponeUnaffordableInvitation(appointment)) {
    if (appointment.event !== "date_samechan") state.pendingInvite = null;
    delete state.flags._home_tonight;
    await beat(appointment.afterClose ? "——店の営業が終わってから、約束の場所へ。" : "休養のあと、LIMEで約束した場所へ——");
    if (appointment.event === "date_samechan") {
      if (!samechanDateReady()) cancelSamechanAppointment(appointment);
      else {
        const result = await playSamechanDate({ invite: appointment, cost: invitationCost(appointment.event) });
        if (result.done) {
          completeInvitation(appointment);
          await afterAction({ exerted: true, spent: result.spent });
          metTonight = true; companion = appointment.sender;
        }
      }
    } else {
      const { value: met, spent } = await paidAction(() => meetInvitation(appointment), { ...invitationGrowth(appointment.event), primary: CHAR_STAT[appointment.sender] });
      if (met) {
        await afterAction({ exerted: true, spent });
        metTonight = true;
        companion = appointment.sender;
      }
    }
  }
  // 別の約束で人と会った夜に告白は重ねない（予約は残り、落ち着いた夜に回る）
  const confessed = await maybeConfession(beat, { busyNight: metTonight || rested, companion });
  if (confessed) { delete state.flags._home_tonight; await bannersIdle(); }
  const athome = !!state.flags._home_tonight;
  delete state.flags._home_tonight;
  if (!athome) {
    await maybeSamechanEncounter({ hasNightEvent: nightCount > 0 || !!chapterDef.nightEvents[state.day]
      || state.flags._night_event_day === `${state.chapter}:${state.day}`,
      hasAppointment: !!appointment && (appointment.day ?? state.day) === state.day, hadConfession: confessed, athome });
    await play(`remake_homecoming_${state.day % 3}`);
  }
  await bannersIdle();
  // 寝る前の一服（家シーシャ・#638）: 行動の枠は使わないちょい足し。大会前夜は聞かない
  if (await runHomeShisha({ eve: state.day + 1 >= (chapterDef.untilDay ?? TOURNAMENT_DAY) })) await bannersIdle();
  await advanceDay();
}

async function advanceDay() {
  const exhausted = !!state.flags._cold_pending;
  const illnessHealth = conditionForRatio(staminaRatio()).health;
  delete state.flags._cold_pending;
  delete state.flags._overwork; // 旧セーブの固定発病カウンターは使わない。
  const sleepBefore = state.stamina;
  const fromDay = chapterDay(state);
  const fromLeft = daysLeft();
  const wake = () => {
    // 大会の朝に発病しても大会日を飛ばさない。その夜は回復せず、不調の残量で本番へ。
    addStamina(exhausted && chapterDay(state) + 1 >= TOURNAMENT_DAY ? 0 : SLEEP_RECOVERY);
    state.day += 1;
    state.slot = 0;
    state.restDay = exhausted ? { chapter: state.chapter, day: state.day, fullDay: false, illnessHealth } : null;
    refreshWeather();
    updateHud();
    setBg(bgUrl("bg_home", "day"), { instant: true }); // 朝は家で目を覚ます（前の夜の場面の絵を持ち越さない）
  };
  if (chapterDay(state) + 1 < TOURNAMENT_DAY) {
    // 夜の紫が降りて、DAYと残り日数がめくれ、地平線が昇って朝になる（大会当日は当日の演出に任せる）
    await dayTurn(async () => {
      wake();
      return { fromDay, day: chapterDay(state), fromLeft, left: daysLeft(), rain: isRainy(), weather: weatherOf(), sick: exhausted };
    });
    dawnShownDay = state.day;
  } else await fadeBlack(wake, 500);
  await presentSleepRecovery({ before: sleepBefore, after: state.stamina });
  if (!exhausted) return;
  if (chapterDay(state) >= TOURNAMENT_DAY) {
    await play("remake_sick_tournament");
    updateHud();
    return;
  }
  state.flags._overwork = 0;
  const first = !state.flags._sick_once;
  state.flags._sick_once = true;
  state.flags[`_morning_${state.day}`] = true;
  if (dawnShownDay !== state.day) await dayCard(`DAY ${chapterDay(state)}`, "……熱っぽい");
  if (first) {
    await play("remake_sick_half");
    addStamina(Math.max(0, 60 - state.stamina));
    state.slot = 1; // 初回だけは半日で回復（夜の1行動は残る）
    state.restDay = null; // 台詞どおり熱が引いた初回は、不調を人工的に夜まで延ばさない。
  } else {
    await play("remake_sick_full");
    addStamina(Math.max(0, 80 - state.stamina));
    state.slot = 2;
    state.restDay.fullDay = true;
    state.flags._home_tonight = true;
  }
  updateHud();
}
