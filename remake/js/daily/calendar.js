import { spendableMoney } from "../core/travel-budget.js";
// 日常パートの1日の流れ: 朝（DAYカード・LIME）→ 昼の行動 → 夜の固定イベント → 帰宅 → 翌朝。
import { el, sleep, yen } from "../core/util.js";
import { layers, dayCard, dayTurn, modal, toast, fadeBlack, bannersIdle, setBg, refreshWeather, dropRetired } from "../core/ui.js";
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
import { showSumiRigAtHome } from "./home-rig.js";
import { axeBarDiscovered } from "../core/axe-bar-discovery.js";
import { chapterDay } from "../core/chapter-clock.js";
import { chooseSpot, interruptMap, isChoosingDestination } from "./map.js";
import { isRainy, weatherOf } from "./weather.js";
import { spotById, visitRival, visitSpot, visitChar, restAtHome, isClosed, isUnlocked, storyCount, CHAR_STAT, bgRef, VISIT_BG, facilityGrowth } from "./spots.js";
import { doFortune } from "./fortune.js";
import { tonariMenu, tonariCustomer, doBaito } from "./tonari.js";
import { openShop, visitRin, ownsFlavor } from "./shop.js";
import { openingStatus } from "./spot-hours.js";
import { deliverMorning, pushNotice, unreadCount, actionInviteNeedingReply, openLime, limeCoach, expireInvitations, rescheduleInvitation, completeInvitation, invitationReadBeforeMeeting } from "./phone.js";
import { openStatus } from "./status.js";
import { onAction as spinReel, presentNow as showReelNow, changeSetting as changeReelSetting, installReel } from "./reel.js";
import { maybeConfession, playDate } from "./romance.js";
import { samechanDateReady, playSamechanDate } from "./samechan-date.js";
import { afterStory, isFinaleEvent, playFinale, isFriendEvent, playFriendHangout } from "./bonds.js";
import { syncSamechanKnowledge, maybeSamechanEncounter, visitSamechan } from "./samechan.js";

import { invitationCost, invitationGrowth, storeInvitationSpot, storeInvitationDialogue, invitationVisitSpot, immediateInvitation } from "./invitations.js";
import { visitHiyoriAtShop, playHiyoriEvent, playHiyoriHangout, hiyoriShopLocation } from "./hiyori.js";
import { cityGuestAtShop, visitCityGuestAtShop } from "./city-guests.js";
import { restingToday, syncNightQueue, nightPlan, nightOccupied, runNightPlan, fixedNightVisitBlock } from "./night-events.js";
import { openTrpgBar } from "./trpg.js";
import { presentNight, growthMenuItems, openGrowthBoard, reflectAtSpot, consultLessons } from "../core/growth.js";

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
  const owner = state;
  // 登録済みでも、説明中に保存された初回体験は配達・日付更新より先に完了する。
  // 導入済み旧保存から初回体験を推測せず、既存の確定・報酬処理を再利用する。
  if (owner.flags._pakki_first_spin_pending) {
    if (owner.flags._c_station_registered && owner.visitedDay.c_station == null) {
      owner.visitedDay.c_station = owner.day;
      // 初回確定でpendingが消え、その演出中に再中断しても訪問日を失わない。
      save(); // 会話・訪問回数・成長・行動は繰り返さない。
    }
    await installReel();
    if (state !== owner) return;
  }
  // 中断/旧保存の回転も、日付更新や朝のイベントより先に完了させる。再抽選はしない。
  await showReelNow({ label: "前回のスロット" });
  if (state !== owner) return;
  syncSamechanKnowledge();
  syncNightQueue(chapterDef.nightEvents);
  expireInvitations({ fixedNight });
  initHud({ phone: phoneButton, status: openStatus, menu: openMenu });
  showHud(true);
  setPhoneBadge(unreadCount()); // つづきから再開したときも未読の赤丸を出す
  // 承諾後・閉じる前のSAVEはLIMEへ戻す。LOADだけで出発したことにしない。
  if (state.pendingInvite?.awaitingLimeClose) {
    await readLime();
    if (state !== owner) return;
  }
  // 第2章の初日配達は章側で行動・帰店報告まで完了済み。
  // 日付だけを飛ばさず、通常日と同じ夜予定・帰宅・就寝を経て翌朝へ進む。
  if (def.startNextDay && chapterDay(state) === 1) { await endDay({ returnedToTonari: true }); save(); }
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
    // 旧DAY1夜の保存も、退勤後は再勤務・配達へ戻さない。
    if (state.chapter === 1 && state.day === 1 && state.flags._errand_scout_done) {
      state.flags._day1_shift_ended = true;
      state.flags._delivery_schedule_v2 = true;
      state.slot = 2;
      save();
    }
    // DAY2の出発前に二軒分をtonariでまとめて受注する（登録より先）。
    if (state.chapter === 1 && !(await briefDeliveryBatch())) return;
    // なるの紹介を受けた翌朝、配達前に無料の参加登録を済ませる。
    if (state.chapter === 1 && state.day >= 2
      && (state.day <= DELIVERY_LAST_DAY || state.flags._delivery_schedule_v2)
      && state.flags._errand_scout_done
      && (state.flags._delivery_schedule_v2 || !(state.flags._delivery_adam_done && state.flags._delivery_minto_done))) {
      state.flags._delivery_schedule_v2 = true;
      if (!state.flags._c_station_registered && state.slot < 2 && !restingToday()) await registerTournament();
    }
    await chapterDef.morningDeparture?.();
    while (state.slot < 2) {
      const delivery = dueDelivery();
      if (delivery) await deliver(delivery);
      else await takeAction();
      updateHud();
      save();
    }
    // 2件の納品後、最終報告のため一度だけ職場へ戻る。
    const reported = state.chapter === 1 ? await reportDeliveryBatch() : null;
    if (reported === false) return;
    await endDay({ returnedToTonari: reported === true });
    if (state !== owner) return;
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
  const session = state;
  const first = !state.flags._lime_opened;
  state.flags._lime_opened = true;
  state.flags._lime_tut = 1; // 自分で開けたなら案内はいらない
  const before = state.pendingInvite;
  const wasWaiting = !!before?.awaitingLimeClose;
  let interrupted = false;
  await openLime({ tutorial: first, sender, fixedNight, beforeClose: async () => {
    const invite = state.pendingInvite;
    if (!invite || invite === before && !wasWaiting || !immediateInvitation(invite, state)) return;
    const owner = state;
    const source = invitationSourceMessage(invite);
    const destination = spotById(invitationVisitSpot(invite, source));
    const background = DB.dialogues[invite.event]?.metadata?.bg
      || (destination && (destination.bg || VISIT_BG[destination.charId] || (destination.id === "tonari" ? "bg_tonari_inside" : null)));
    if (background) await setBg(bgUrl(background, state.slot ? "night" : "day"), { fast: true });
    if (state === owner && state.pendingInvite === invite) {
      interrupted = interruptMap("__lime__");
      if (interrupted) dropRetired(); // スマホが消える前にマップのピンも片付ける。
    }
  } });
  if (state !== session) return;
  syncSamechanKnowledge();
  setPhoneBadge(unreadCount());
  save();
  // 後の時間帯の約束もデータは維持する。常設バナーは出さない。
  if (!interrupted && state.pendingInvite && state.pendingInvite !== before) interruptMap("__lime__");
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
      ...growthMenuItems(),
      { label: "セーブ", value: "save", test: "menu-save" },
      { label: "ロード", value: "load", test: "menu-load" },
      { label: "設定", value: "config", test: "menu-config" },
      { label: "用語集", value: "glossary", test: "menu-glossary" },
      { label: "大会の規則", value: "rules", test: "menu-rules" },
      { label: "タイトルへ戻る", value: "title", test: "menu-title" },
      { label: "閉じる", value: null, primary: true, test: "menu-close" },
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
  if (v === "board") await openGrowthBoard();
  if (v === "config") await (await import("../scenes/title.js")).openConfig();
  if (v === "glossary") await modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal", options: [{ label: "閉じる", value: true, primary: true }] });
  if (v === "rules") await (await import("../scenes/rule-sheet.js")).openRuleSheet();
  // タイトルへ戻るときも、手動セーブと同じく行き先を選んでいるときだけ保存する。
  // 会話や作業の途中（行動の体力だけ引かれた状態など）は残さず、行動前のオートセーブへ戻す（#638）
  if (v === "title") { if (isChoosingDestination()) save(); location.reload(); }
}

// ---------------------------------------------------------------- 1日目の案内

const TONARI_BG = "res://assets/backgrounds/bg_tonari_inside.png";

/**
 * 1日目だけ、自由行動の前にスミさんのおつかいを2つ実地でやる（旧版 N18/N19）。
 * ① Dr.fookah でレモンを仕入れ、大会用に贈られる（買い物は時間を使わない）→ ② KEMURIKUSA を客として偵察（行動1回＋交通費）。
 * 偵察を終えたら退勤済みのまま帰宅。参加登録と配達2件は翌日へ。
 */
async function day1Errands() {
  const f = state.flags;
  const lemon = DB.flavorById.lemon;
  if (!f._errand_shop_done && (!lemon || ownsFlavor("lemon"))) f._errand_shop_done = true;
  if (!f._errand_shop_done) {
    if (!f._errand_shop_told) {
      await play("remake_day1_errand_shop", { bg: TONARI_BG });
      f._errand_shop_told = true;
      save();
    }
    await chooseSpot({ guide: { pin: "shop", text: "スミさんに頼まれた仕入れへ。Dr.fookah をタップ！" } });
    await openShop({ errand: "lemon", expense: true, expenseFlag: "_errand_lemon_expensed" });
    f._errand_shop_done = true;
    save();
    await bannersIdle();
  }
  if (!f._lemon_gift_read) {
    const gift = await play("remake_lemon_gift", { bg: TONARI_BG });
    if (gift?.cancelled) return;
    f._lemon_gift_read = true;
    save();
  }
  const naru = spotById("naru");
  if (!naru || (!f._errand_naru_visited && (isClosed(naru) || spendableMoney(state) < (naru.cost || 0)))) { f._errand_scout_done = true; return; }
  if (!f._errand_scout_told) {
    await play("remake_day1_errand_scout", { bg: TONARI_BG });
    f._errand_scout_told = true;
    save();
  }
  if (!f._errand_naru_visited) await chooseSpot({ guide: { pin: "naru", text: "KEMURIKUSAへ偵察に。KEMURIKUSA をタップ！" } });
  if (!f._errand_naru_visited) {
    await visitRival(naru);
    state.visitedDay.naru = state.day;
    f._errand_naru_visited = true;
    save();
  }
  f._errand_scout_done = true;
  state.slot = 2; // 偵察でこの日は終了。消耗・費用・行動後処理は従来の1回だけ。
  await afterAction({ exerted: true });
}

async function registerTournament() {
  const venue = spotById("c_station");
  // 偵察を見送った旧保存などでは、未解放/休業の受付へ案内して進行を止めない。
  if (!venue || !isUnlocked(venue) || isClosed(venue) || state.visitedDay.c_station === state.day) return;
  await chooseSpot({ guide: { pin: "c_station", text: "配達の前に、大会の参加登録へ。C.STATION の受付をタップ！", free: "参加登録（代金なし）" } });
  await visitSpot({ ...venue, cost: 0, stamina: 0 });
  if (state.flags._c_station_registered && !state.flags._ch1_rules_read) {
    await (await import("../scenes/rule-sheet.js")).openRuleSheet();
    state.flags._ch1_rules_read = true;
  }
  state.visitedDay.c_station = state.day;
  save(); // 無料の登録で行動枠・追加の抽選を使わない。
}

// ---------------------------------------------------------------- tonari の配達

/**
 * 第1章は、スミさんの届け物でEDEN・PEPPERMINTの初来店を必ず通す（DL01）。DAY1 のおつかいに続けて
 * DAY2朝に二軒分をまとめて受注し、昼にPEPPERMINT、夜にEDEN。納品後にtonariへ一度だけ報告する。
 * EDENは従来の無料体験、PEPPERMINTは店内で荷物だけを渡し一服は任意。手当をバイト代に上乗せする。
 * 自分で先に行った旧セーブの店は飛ばし、DAY2 を過ぎた旧セーブには割り込まない
 */
const DELIVERIES = [
  { charId: "minto", day: 2, slot: 0, scene: "remake_delivery_minto", text: "まとめ買いのミントを PEPPERMINT へ。PEPPERMINT をタップ！" },
  { charId: "adam", day: 2, slot: 1, scene: "remake_delivery_eden", text: "次は古いダブルアップルを EDEN へ。EDEN をタップ！" },
];
const DELIVERY_LAST_DAY = 2;
const DELIVERY_PAY = 2000;
const DELIVERY_STAMINA = -10;

/** DAY2朝の一括受注。旧途中セーブの既読・訪問済み状態を新規受注に戻さない。 */
async function briefDeliveryBatch() {
  const f = state.flags;
  if (state.chapter !== 1 || state.day < 2 || state.slot >= 2
    || !f._errand_scout_done || restingToday()) return true;
  if (!f._delivery_batch_started) {
    if (state.day !== 2 || state.slot !== 0
      || DELIVERIES.some(d => f[`_delivery_${d.charId}_told`]
        || f[`_delivery_${d.charId}_done`] || f[`_delivery_${d.charId}`]
        || storyCount(d.charId) > 0)) return true;
    f._delivery_batch_started = true;
    save();
  }
  const owner = state;
  for (const d of DELIVERIES) {
    if (f[`_delivery_${d.charId}_told`] || f[`_delivery_${d.charId}_done`]) continue;
    const result = await play(d.scene, { bg: TONARI_BG });
    if (state !== owner || result?.cancelled) return false;
    f[`_delivery_${d.charId}_told`] = true;
    save(); // 1件目の依頼説明後に中断しても再度読まない。
  }
  return true;
}

/** 報酬・体力・枠を二重計上せず、最後の勤務報告のみ一度再生。
 * true: 今回帰店した / null: 報告不要 / false: 会話中断・別セーブへの切替。
 */
async function reportDeliveryBatch() {
  const f = state.flags;
  if (!f._delivery_batch_started || f._delivery_report_done
    || !DELIVERIES.every(d => f[`_delivery_${d.charId}_done`])) return null;
  const owner = state;
  const result = await play("remake_delivery_report", { bg: TONARI_BG });
  if (state !== owner || result?.cancelled) return false;
  f._delivery_report_done = true;
  save();
  return true;
}

function dueDelivery() {
  if (state.chapter !== 1 || state.day < 2 || !state.flags._errand_scout_done
    || (state.day > DELIVERY_LAST_DAY && !state.flags._delivery_schedule_v2) || restingToday()) return null;
  const inv = state.pendingInvite;
  if (inv && (inv.day ?? state.day) === state.day && inv.slot === state.slot) return null; // 先にした約束を守る
  for (const d of DELIVERIES) {
    const done = `_delivery_${d.charId}_done`;
    if (state.flags[done] || state.day * 2 + state.slot < d.day * 2 + d.slot) continue;
    if (storyCount(d.charId) > 0) { state.flags[done] = true; continue; } // もう自分で行った店
    const spot = spotById(d.charId);
    // 先の配達先が休業なら順番を入れ替えず、次の営業枠へ延期する。
    return spot && !isClosed(spot) ? d : null;
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
  await staminaGuard(DELIVERY_STAMINA, { mandatory: true });
  await chooseSpot({ guide: { pin: charId, text, free: "配達（代金なし）" } });
  f[`_delivery_${charId}`] = true;
  addStamina(DELIVERY_STAMINA);
  playBgm("tonari");
  if (charId === "minto") {
    // 最初の背景・人物・台詞から店内。客としての初回接客は自由行動に残す。
    await play("remake_delivery_minto_handoff", { bg: "res://assets/backgrounds/peppermint.png" });
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
  await afterAction({ exerted: true });
}

// ---------------------------------------------------------------- 行動

async function staminaGuard(cost, { mandatory = false } = {}) {
  if (!(cost < 0) || !coldRisk(staminaAfter(cost) / maxStamina())) return true;
  const go = await modal({
    title: "体が重い……",
    body: "体力が赤い状態での行動だ。残りが少ないほど、翌朝に風邪で寝込む危険が高くなる。"
      + (mandatory ? "<br>この配達は続ける必要がある。" : "<br>無事に済むこともあるけど、今は「家に帰る」で休める。")
      + (fitActive(state) ? "<br>（チョコザップで体を整えたので、今は風邪をひきにくい）" : ""),
    options: mandatory ? [{ label: "わかった", value: true, test: "stamina-go" }]
      : [{ label: "やめておく", value: false }, { label: "それでも行く", value: true, test: "stamina-go" }],
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
    // C04: 未読のLIMEを前提に約束の場面を始めない。先に該当トークを開いて読ませる（自動で承諾・返信はしない）。
    const invOwner = state;
    const unreadThread = invitationReadBeforeMeeting(inv);
    if (unreadThread) {
      await readLime(unreadThread);
      // ロードで別セッションに切り替わった／LIME内で予約が変わったら、次の行動で選び直す。
      if (state !== invOwner || state.pendingInvite !== inv) return;
    }
    if (!(await guardInvitation(inv))) return;
    if (inv.event === "date_samechan") {
      const result = await playSamechanDate({ invite: inv, cost: invitationCost(inv.event), advanceSlot: true });
      if (result.done) { completeInvitation(inv); await afterAction({ exerted: true, spent: result.spent }); }
      return;
    }
    state.pendingInvite = null;
    if (state.slot === 1) state.flags._private_night_day = state.day;
    if (state.slot === 1) state.flags._private_night_char = inv.sender;
    const { value: met, spent } = await paidAction(() => meetInvitation(inv), { ...invitationGrowth(inv.event), primary: CHAR_STAT[inv.sender], exp: invitationExp(inv) });
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
  const visitBlock = spot => fixedNightVisitBlock(chapterDef.nightEvents, spot);
  const ev = nightPlan(chapterDef.nightEvents)[0];
  syncSamechanKnowledge();
  const spotId = await chooseSpot({
    ...chapterDef.mapOptions?.(),
    visitBlock,
    eventPin: ev && !ev.done?.() ? ev.pin : null,
    onShown: () => {
      if (queuedLimeSender) { const sender = queuedLimeSender; queuedLimeSender = null; phoneButton({ sender }); }
      else limeCoach(phoneButton);
    }, // 通知を先にタップした場合は、マップが開いたところで目的のトークへ
    onBeforeGo: (destination) => confirmLimeReminder(destination, {
      spendsAction: !["shop", "fortune"].includes(destination.kind),
    }),
  });
  if (spotId === "__lime__") return; // LIME で誘いに乗った → 次の takeAction で約束へ
  // 廃止前の rest:practice も通常の帰宅として扱う（#783）。
  const [baseId] = String(spotId).split(":");
  const spot = chapterDef.spotById?.(baseId) || spotById(baseId);
  if (!spot) throw new Error(`行き先が見つかりません: ${spotId}`);
  const blocked = visitBlock(spot);
  if (blocked) { toast(blocked.why); return; }
  const { value: { used, exerted, slotsUsed = 1 }, spent } = await paidAction(() => performSpotAction(spot), {
    ...facilityGrowth(spot),
    consumed: (result) => result.used && spot.kind === "spot",
    exp: (result) => result.exp || spotExpTarget(spot),
  });
  if (!used) return;
  state.visitedDay[spot.id] = state.day;
  // 施設のおまけ（#621）。説明はキャラではなくシステムの通知で短く
  // 観音堂: パッキースロットの設定が変わる（次に筐体が出たときに光って知らせる）
  // 場所は明かさない（遊び方は「特定のスポット」とだけ書く・#634）
  if (spot.id === "kannon" && changeReelSetting()) toast("……ふと、パッキースロットの設定が変わった気がする", { kind: "good" });
  // チョコザップ: その日から数日、風邪をひきにくい
  if (spot.id === "choizap" && state.flags._gym_member) {
    state.flags._fit_since = { chapter: state.chapter, day: state.day };
    toast(`体が整った。${FIT_DAYS}日間は風邪をひきにくい`, { kind: "good" });
  }
  state.slot = Math.min(2, state.slot + slotsUsed);
  await afterAction({ exerted, spent });
}

async function performSpotAction(spot) {
  const actionOwner = state;
  const scheduledGuestSpot = hiyoriShopLocation();
  const scheduledCityVisit = cityGuestAtShop(spot);
  if (!openingStatus(spot, state).ok) return { used: false, exerted: false };
  if (spot.kind === "axe") {
    // 直接呼び出された入口にも、地図と同じ発見条件を適用する。
    if (!axeBarDiscovered(state)) return { used: false, exerted: false };
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
  let exp = null;
  if (spot.kind === "tonari") {
    const sub = await tonariMenu();
    if (!sub) return { used: false, exerted };
    exp = TONARI_EXP[sub] || null;
    if (sub === "hiyori_axe") {
      if (!(await staminaGuard(-10))) return { used: false, exerted };
      const completed = await playHiyoriEvent("axe_reveal");
      if (completed) state.visitedDay.tonari_hiyori_axe = state.day;
      // 料金・体力・読了と一緒に行動を保存済み。共通末尾で二重に進めない。
      return { used: completed, exerted: completed, slotsUsed: 0 };
    }
    const makanai = sub === "practice" || sub === "strawberry";
    // 旧セーブの苺専用記録も、同じ日のまかないとして扱う。
    if (state.visitedDay[`tonari_${sub}`] === state.day || makanai &&
        (state.visitedDay.tonari_practice === state.day || state.visitedDay.tonari_strawberry === state.day)) {
      toast(makanai ? "今日はもうまかないで練習した" : sub === "baito" ? "今日のシフトはもう終わった" : "今日はもう客席で一服した");
      return { used: false, exerted };
    }
    if (!(await staminaGuard(sub === "baito" ? -24 : -16))) return { used: false, exerted };
    exerted = true;
    state.visitedDay[makanai ? "tonari_practice" : `tonari_${sub}`] = state.day;
    if (sub === "practice") {
      const { runFullPractice } = await import("../craft/practice.js");
      addStamina(-16);
      await play("remake_staff_practice", { bg: TONARI_BG });
      const cs = await runFullPractice({ kind: "self", staffPractice: true, isCurrent: () => state === actionOwner });
      if (cs.masteryGained) toast("使ったフレーバーの熟練度が育った。持ち物で確認できる", { kind: "good" });
    } else if (sub === "strawberry") {
      const { runStrawberryTrial } = await import("../chapters/ch2-strawberry-trial.js");
      addStamina(-16);
      const { masteryGained } = await runStrawberryTrial({ bg: TONARI_BG, isCurrent: () => state === actionOwner });
      if (masteryGained) toast("使ったフレーバーの熟練度が育った。持ち物で確認できる", { kind: "good" });
    } else if (sub === "baito") await doBaito();
    else if (await tonariCustomer() === false) return { used: false, exerted: false };
  } else if (spot.kind === "samechan") {
    if (!(await staminaGuard(spot.stamina))) return { used: false, exerted };
    used = await visitSamechan(spot);
    exerted = spot.stamina < 0;
  } else if (spot.kind === "rival") {
    if (isClosed(spot) || !(await staminaGuard(spot.stamina)) || isClosed(spot)) return { used: false, exerted };
    used = (await visitRival(spot)) !== false;
    // 心得の盤で灯した授業があれば、そのまま相談して話を聞く（SBD50）
    if (used) await consultLessons(spot.charId);
    exerted = used;
  } else if (spot.kind === "shop") {
    const r = await openShop();
    if (r !== "rin") used = false;
    else if (!(await confirmLimeReminder(spot))) used = false;
    else if (await staminaGuard(-14)) { used = await visitRin(); exerted = used; }
    else used = false;
  } else if (spot.kind === "spot") {
    // 観音堂で内省（心得の盤 SPEC 2.8）: 火種を灯す。時間も体力も使わない。true=行動にしない
    if (await reflectAtSpot(spot.id) === true) return { used: false, exerted: false };
    if (!(await staminaGuard(spot.stamina))) return { used: false, exerted };
    if (await visitSpot(spot) === false) return { used: false, exerted: false };
    exerted = spot.stamina < 0;
  } else if (spot.kind === "rest") {
    const unwell = currentCondition().health === "red" || !!state.flags._cold_pending
      || state.restDay?.chapter === state.chapter && state.restDay.day === state.day && !!state.restDay.illnessHealth;
    if (unwell) {
      const plan = nightPlan(chapterDef.nightEvents, { resting: true });
      const booked = state.pendingInvite && (state.pendingInvite.day ?? state.day) === state.day && state.pendingInvite.slot === 1;
      const choice = await modal({ title: "家で休む", className: "rest-modal",
        body: `今は${state.slot === 0 ? "昼" : "夜"}。残り${2 - state.slot}枠${booked ? "のうち夜は約束へ、それ以外" : ""}を休養に使えます。通常の夜の予定は後日へ。<br>${plan.length ? `今日の予定：${plan.map(ev => ev.label || "大切な予定").join("・")}には参加します。<br>` : ""}${booked ? `${displayName(state.pendingInvite.sender, state)}との今夜のLIMEの約束には参加します。<br>` : ""}しっかり休めば体力が大きく戻ります。`,
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
        toast(`${restSlots}枠を休養へ${booked ? "。夜の約束には参加" : ""}。体力が回復した。通常の夜の予定は後日へ`, { ms: 4000 });
      } else await restAtHome(spot);
    } else await restAtHome(spot);
  } else if (spot.kind === "fortune") {
    await doFortune(); // 時間は使わない（占ってもらったら今日はもう寄れない）
    save();
    return { used: false, exerted };
  }
  if (used) await visitHiyoriAtShop(spot, { scheduledSpot: scheduledGuestSpot, bg: bgRef(spot.bg || VISIT_BG[spot.charId] || (spot.kind === "shop" ? "bg_fookah_showroom" : "bg_tonari_inside")) });
  if (used) await visitCityGuestAtShop(spot, { scheduledVisit: scheduledCityVisit });
  return { used, exerted, slotsUsed, exp };
}

// 経験値の鍵（SPEC 1.3）: 相手のいる行動は相手のキャラID、相手のいない行動はスポットか行動の種類。
const TONARI_EXP = {
  baito: { key: "tonari_shift", place: "tonari_shift" },
  practice: { key: "tonari_practice", place: "tonari_practice" },
  strawberry: { key: "tonari_practice", place: "tonari_practice" },
  customer: { key: "tonari_seat", place: "tonari_seat" },
};
function spotExpTarget(spot) {
  if (spot.kind === "shop") return { key: "rin", person: "rin" };
  if (spot.charId && ["rival", "samechan"].includes(spot.kind)) return { key: spot.charId, person: spot.charId };
  if (spot.kind === "samechan") return { key: "samechan", person: "samechan" };
  if (spot.kind === "rest" || spot.kind === "fortune") return null; // 休養・占いは学びにしない
  return { key: spot.id, place: spot.id };
}
const invitationExp = (inv) => inv?.sender ? { key: inv.sender, person: inv.sender } : null;

function postponeUnaffordableInvitation(inv) {
  const cost = invitationCost(inv.event);
  if (spendableMoney(state) >= cost) return false;
  rescheduleInvitation(inv, "所持金が足りなかったため、約束を別の日に改めることにした");
  toast(`約束の店には${yen(cost)}必要です。今日は見送り、別の日に改めます`, { kind: "warn" });
  save();
  return true;
}

async function guardInvitation(inv) {
  if (await staminaGuard(inv.event === "__sumi_baito__" ? -24 : -10)) return true;
  rescheduleInvitation(inv, "体調を考え、約束を別の日に改めることにした");
  save();
  return false;
}

function invitationSourceMessage(inv) {
  return state.inbox?.find(item => item.id === inv.originId || item.originId === inv.originId)?.msg
    || DB.lime.find(message => message.id === inv.originId)
    || DB.lime.find(message => message.accept_event === inv.event && message.sender === inv.sender);
}

async function meetInvitation(inv) {
  if (postponeUnaffordableInvitation(inv)) return false;
  const owner = state;
  const destination = invitationVisitSpot(inv, invitationSourceMessage(inv));
  let result;
  const cost = invitationCost(inv.event);
  addMoney(-cost);
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
    // ひよりの feelings_spoken（#1434 決定B）。恋人・絆Lv2以降のデートの帰りに一度だけ。条件は route.events。
    if (inv.sender === "hiyori") await playHiyoriEvent("feelings_spoken");
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
    result = await play(storeInvitationSpot({ accept_event: inv.event })
      ? storeInvitationDialogue(DB.dialogues[inv.event], state.slot) : inv.event);
    if (state !== owner || result?.cancelled) return false;
    if (inv.event === `outing_${inv.sender}_1`) state.flags[`_outing_done_${inv.sender}`] = true;
    if (inv.event === "ch1_minto_fifth") state.flags._minto_fifth_done = true;
    if (inv.event === "ch1_adam_outing_dagurikura") state.flags._adam_arcade_done = true;
    gainAffinity(inv.sender, 10);
    addStamina(-10);
    await afterStory(inv.event); // 私服の約束のあとの、途中の質問（みんと）
  }
  if (state !== owner || result?.cancelled) return false;
  if (destination) {
    state.visitedDay[destination] = state.day;
    state.flags[`_invitation_visit_${destination}`] = `${state.chapter}:${state.day}`;
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

/** 行動を1回使ったあと: そのイベントの終わりにスロットが1回転。告白は営業後に endDay で扱う */
async function afterAction({ exerted = false, spent = 0 } = {}) {
  // 警告の承諾回数ではなく、実際に消耗した行動の終了時に一度だけ抽選する。
  if (exerted && !state.flags._cold_pending && catchesCold(staminaRatio(), Math.random, { fit: fitActive(state) })) state.flags._cold_pending = true;
  spinReel({ spent });
  save();
  // 昼夜とも、別イベントやマップ・翌朝へ進む前に、この行動の演出を完了する。
  await showReelNow({ label: "今回のスロット" });
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

async function endDay({ returnedToTonari = false } = {}) {
  syncNightQueue(chapterDef.nightEvents);
  const rested = restingToday();
  const nightCount = await runNightPlan(chapterDef.nightEvents, async (ev) => {
    const owner = state, day = state.day;
    // 帰路の中断/LOADでは、その後の夜イベントを開始しない。
    if (await chapterDef.beforeNightEvent?.(ev) === false || state !== owner || state.day !== day) {
      throw new Error("夜の予定へ向かう移動が中断されました");
    }
    await bannersIdle();
    delete state.flags._home_tonight; // 休息後でも、固定イベントの場所へ出かける。
    // 配達報告の直後だけは同じ来店で話を続ける。別の目的地・後続予定の到着は残す。
    const sameVisit = returnedToTonari && ev.pin === "tonari";
    returnedToTonari = false;
    if (rested || state.restDay?.illnessHealth) await beat("今日は休んでいたが、この予定だけは外せない——");
    if (ev.beat && !sameVisit) await beat(ev.beat);
    return sameVisit ? { returnedToTonari: true } : undefined;
  });
  save();
  await bannersIdle();
  const appointment = state.pendingInvite;
  let metTonight = state.flags._private_night_day === state.day; // 夜の行動枠で約束の相手に会った
  let companion = metTonight ? state.flags._private_night_char : null;
  if (appointment && (appointment.day ?? state.day) === state.day
    && (appointment.afterClose && appointment.queuedAfterClose || rested && appointment.slot === 1
      || state.day === 1 && state.flags._day1_shift_ended && appointment.slot === 1)
    && !postponeUnaffordableInvitation(appointment) && await guardInvitation(appointment)) {
    // C04: 営業後・休養後の約束も、未読のLIMEを前提に場面を始めない。先に該当トークを読ませる。
    const apptOwner = state;
    const unreadAppt = invitationReadBeforeMeeting(appointment);
    if (unreadAppt) {
      await readLime(unreadAppt);
      if (state !== apptOwner) return;
    }
    if (appointment.event !== "date_samechan") state.pendingInvite = null;
    delete state.flags._home_tonight;
    await beat(appointment.afterClose ? "——店の営業が終わってから、約束の場所へ。"
      : rested ? "休養のあと、LIMEで約束した場所へ——" : "仕事を終え、LIMEで約束した場所へ。");
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
      const { value: met, spent } = await paidAction(() => meetInvitation(appointment), { ...invitationGrowth(appointment.event), primary: CHAR_STAT[appointment.sender], exp: invitationExp(appointment) });
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
  await chapterDef.beforeHomecoming?.();
  const athome = !!state.flags._home_tonight;
  delete state.flags._home_tonight;
  if (!athome) {
    await maybeSamechanEncounter({ hasNightEvent: nightCount > 0 || !!chapterDef.nightEvents[state.day]
      || state.flags._night_event_day === `${state.chapter}:${state.day}`,
      hasAppointment: !!appointment && (appointment.day ?? state.day) === state.day, hadConfession: confessed, athome });
    await play(`remake_homecoming_${state.day % 3}`);
  }
  await bannersIdle();
  const homeOwner = state;
  await showSumiRigAtHome();
  if (state !== homeOwner) return;
  // 夜の行動を終え、余力があるときだけ家シーシャを選べる。大会前夜は聞かない。
  if (await runHomeShisha({ eve: state.day + 1 >= (chapterDef.untilDay ?? TOURNAMENT_DAY) })) await bannersIdle();
  delete state.flags._home_trial_plan; // 予約方式の旧セーブを読んだ場合も持ち越さない
  // 寝る直前（夜明けの幕の前）にその日の経験値を精算する。大会前夜もここで火種が届く（REPORT P2・R1）
  // 大会前夜は、火種が残っていれば精算のあとにひとりで内省しに行く（SPEC 2.8・#1690）。柚ヶ谷の夜は宿の窓辺
  const eve = state.day + 1 >= (chapterDef.untilDay ?? TOURNAMENT_DAY);
  await presentNight({ evePlace: eve ? (state.chapter === 2 && state.flags._ch2_region === "widehanga" ? "inn_window" : "kannon") : null });
  if (state !== homeOwner) return;
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
      return { fromDay, day: chapterDay(state), fromLeft, left: daysLeft(), rain: isRainy(), weather: weatherOf(), sick: exhausted, tournamentName: chapterDef?.tournamentName };
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

