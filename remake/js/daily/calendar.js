import { spendableMoney } from "../core/travel-budget.js";
// 日常パートの1日の流れ: 朝（DAYカード・LIME）→ 昼の行動 → 夜の固定イベント → 帰宅 → 翌朝。
import { el, sleep, yen } from "../core/util.js";
import { layers, dayCard, dayTurn, modal, toast, fadeBlack, bannersIdle, setBg, refreshWeather, dropRetired, gainCard } from "../core/ui.js";
import { state, save, holdActionSave } from "../core/state.js";
import { openMenu as openFullMenu } from "./menu.js";
import { addMoney, addStamina, gainAffinity, paidAction, staminaAfter, staminaRatio, maxStamina, currentCondition } from "../core/stats.js";
import { conditionForRatio } from "../core/condition.js";
import { coldRisk, catchesCold, fitActive, FIT_DAYS } from "../core/illness.js";
import { DB, bgUrl, displayName } from "../core/data.js";
import { SE, playBgm } from "../core/audio.js";
import { play } from "../vn/engine.js";
import { initHud, showHud, updateHud, daysLeft, setPhoneBadge, presentSleepRecovery } from "./hud.js";
import { TOURNAMENT_DAY } from "../core/rules.js";
import { runHomeShisha } from "./home-shisha.js";
import { showSumiRigAtHome } from "./home-rig.js";
import { axeBarDiscovered } from "../core/axe-bar-discovery.js";
import { chapterDay } from "../core/chapter-clock.js";
import { chooseSpot, interruptMap, isChoosingDestination } from "./map.js";
import { isRainy, weatherOf, tomorrowForecast } from "./weather.js";
import { spotById, deliverToRival, visitRival, visitSpot, restAtHome, isClosed, isUnlocked, storyCount, CHAR_STAT, bgRef, VISIT_BG, facilityGrowth } from "./spots.js";
import { doFortune } from "./fortune.js";
import { syncFortune } from "./fortune-schedule.js";
import { tonariMenu, tonariCustomer, doBaito } from "./tonari.js";
import { openShop, visitRio, ownsFlavor } from "./shop.js";
import { openingStatus } from "./spot-hours.js";
import { deliverMorning, pushNotice, unreadCount, actionInviteNeedingReply, openLime, limeCoach, expireInvitations, rescheduleInvitation, completeInvitation, invitationReadBeforeMeeting } from "./phone.js";
import { onAction as spinReel, presentNow as showReelNow, installReel } from "./reel.js";
import { maybeConfession, playDate } from "./romance.js";
import { samechanDateReady, playSamechanDate } from "./samechan-date.js";
import { afterStory, isFinaleEvent, playFinale, isFriendEvent, playFriendHangout } from "./bonds.js";
import { syncSamechanKnowledge, maybeSamechanEncounter, visitSamechan } from "./samechan.js";

import { invitationCost, invitationGrowth, storeInvitationSpot, storeInvitationDialogue, invitationVisitSpot, immediateInvitation } from "./invitations.js";
import { bondInvitation } from "./lime-pacing.js";
import { visitHiyoriAtShop, playHiyoriEvent, playHiyoriHangout, hiyoriShopLocation } from "./hiyori.js";
import { cityGuestAtShop, visitCityGuestAtShop } from "./city-guests.js";
import { roamerAt, meetRoamer } from "./roamers.js";
import { recipeFindAfterVisit } from "./recipe-finds.js";
import { petitAfterVisit } from "./petit-shuraba.js";
import { strainMorning, maybeStrainTalk, maybeStrainReunion, strainAfterVisit } from "./lover-strain.js";
import { restingToday, syncNightQueue, nightPlan, nightOccupied, runNightPlan, fixedNightVisitBlock } from "./night-events.js";
import { openTrpgBar } from "./trpg.js";
import { EXP, gainExp, presentNight, reflectAtSpot, consultLessons } from "../core/growth.js";
import { takeChapterBoardNotice, chapterBoardCards, respecMapNotice, takeRespecCloseWarning } from "../core/growth-chapter-notice.js";

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
 * @param def.untilDay 最終日の通算日（大会・勝負の日）。getter でもよい（第5章は日程が決まるまで Infinity）
 * @param def.undatedNote 最終日が決まっていないときの朝・夜明けのカードの一言
 * @param def.dateInvitations false で恋人のデートの誘いを出さない
 * @param def.withLovers () => 恋人ID[]。今いっしょにいて、朝のLIMEを送ってこない恋人（第4章のドバイの同行者）
 * @param def.confessions false で夜の告白の場面を出さない
 * @param def.homeShisha () => false で寝る前の家シーシャを聞かない（家の台が無い泊まり先）
 * @param def.departure true なら最終日は大会ではなく遠出の出発の朝（第3・4章の準備期間・VOL02）。
 *   前夜の内省・家シーシャの見送り・大会の朝の発病の場面など、大会前夜だけの扱いをしない
 * @param def.dayLabel 朝のカード・夜明けの幕の日付の小見出し（既定 "DAY"。準備期間は "出発前"）
 * @param def.slotEvent () => { beat?, run: async () => boolean } | null。この時間帯の行動を使う本筋の場面・約束
 *   （第3章の東京の昼の場面・恋人の東京訪問）。読み終えて true なら行動を一つ使う。中断・失敗は行動を残す
 * @param def.wakeBackground () => 背景ID。朝に目を覚ます場所（無ければ家）
 */
export async function runDaily(def) {
  chapterDef = def;
  onQuit = def.onQuit;
  queuedLimeSender = null;
  const owner = state;
  // 登録済みでも、説明中に保存された初回体験は配達・日付更新より先に完了する。
  // 導入済み旧保存から初回体験を推測せず、既存の確定・報酬処理を再利用する。
  if (owner.flags._pakki_first_spin_pending) {
    await installReel();
    if (state !== owner) return;
  }
  // 中断/旧保存の回転も、日付更新や朝のイベントより先に完了させる。再抽選はしない。
  await showReelNow({ label: "前回のスロット" });
  if (state !== owner) return;
  syncSamechanKnowledge();
  syncNightQueue(chapterDef.nightEvents);
  expireInvitations({ fixedNight });
  initHud({ phone: phoneButton, menu: openMenu });
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
  while (state.day < finalDayAbs()) {
    syncNightQueue(chapterDef.nightEvents);
    if (!state.flags[`_morning_${state.day}`]) {
      state.flags[`_morning_${state.day}`] = true;
      await morning();
      save();
    }
    // 章が変わって最初の日常の朝: 盤に増えたスキルと、組み直せることを知らせる（SPEC 6.3・11章。章・周回ごとに一度）
    announceChapterBoard();
    if (state.chapter === 1 && state.day === 1 && state.slot === 0 && !state.flags._errand_scout_done) {
      await day1Errands();
      if (state !== owner) return;
      save();
    }
    // 旧DAY1夜の保存も、退勤後は再勤務・配達へ戻さない。
    if (state.chapter === 1 && state.day === 1 && state.flags._errand_scout_done) {
      state.flags._day1_shift_ended = true;
      state.flags._delivery_schedule_v2 = true;
      state.slot = 2;
      save();
    }
    // #3819: DAY2の朝、スミさんが「C.STATIONで大会の登録を済ませてこい。ついでに二軒へ届け物を」と頼む。
    // 依頼の説明（tonari）→ 登録 → その足で PEPPERMINT → EDEN → tonariへ報告。この日は固定のシフトを入れない。
    if (state.chapter === 1 && !(await briefDeliveryBatch())) return;
    // なるの紹介を受けた翌朝、配達の前に無料の参加登録を済ませる。
    if (state.chapter === 1 && state.day >= 2
      && (state.day <= DELIVERY_LAST_DAY || state.flags._delivery_schedule_v2)
      && state.flags._errand_scout_done
      && (state.flags._delivery_schedule_v2 || !(state.flags._delivery_adam_done && state.flags._delivery_minto_done))) {
      state.flags._delivery_schedule_v2 = true;
      if (!state.flags._c_station_registered && state.slot < 2 && !restingToday()) await registerTournament();
      if (state !== owner) return;
    }
    // 登録のついでの配達（行動枠・体力を使わない）。休業の店は従来どおり帰り道の配達へ回す。
    if (state.chapter === 1 && state.slot < 2) {
      for (let delivery = dueDelivery({ errand: true }); delivery; delivery = dueDelivery({ errand: true })) {
        const delivered = await deliver(delivery, { errand: true });
        if (state !== owner) return;
        if (!delivered) break;
      }
      if (await reportDeliveryBatch() === false) return;
    }
    await chapterDef.morningDeparture?.();
    if (state !== owner) return;
    // DAY3の朝、地図へ出る前に観音堂へ。昼枠を使わず、昼より先へ進んだ旧セーブは巻き戻さない。
    if (state.chapter === 1 && state.day === 3 && state.slot === 0 && !state.flags._ch1_day3_kannon_done) {
      await reflectAtSpot("kannon", { direct: true, onExit: () => { owner.flags._ch1_day3_kannon_done = true; } });
      if (state !== owner) return;
      updateHud();
    }
    while (state.slot < 2) {
      const story = await chapterDef.slotEvent?.();
      if (story) {
        if (story.beat) await beat(story.beat);
        const read = await story.run();
        if (state !== owner) return;
        if (read) {
          state.slot = Math.min(2, state.slot + 1);
          await afterAction({ exerted: story.exerted === true });
          updateHud();
          save();
          continue;
        }
      }
      await takeAction();
      if (state !== owner) return;
      updateHud();
      save();
    }
    // 登録のついでに届けられなかった店（休業など）は、その日の行動の後の帰り道に。行動枠・体力は使わない。
    for (let delivery = dueDelivery(); delivery; delivery = dueDelivery()) {
      const delivered = await deliver(delivery);
      if (state !== owner) return; // 配達中のLOAD後に、古い流れで次の届け先へ進まない。
      if (!delivered) break;
    }
    // 2件の納品後、最終報告のため一度だけ職場へ戻る。
    const reported = state.chapter === 1 ? await reportDeliveryBatch() : null;
    if (reported === false) return;
    await endDay({ returnedToTonari: reported === true });
    if (state !== owner) return;
    save();
  }
}

/** 章の最終日（大会・勝負の日）の通算日。章定義の untilDay（第5章は日程が決まるまで Infinity の getter）。 */
const finalDayAbs = () => chapterDef?.untilDay ?? TOURNAMENT_DAY;
/** 今夜が最終日の前夜か（寝ると最終日の朝）。 */
const finalEve = () => state.day + 1 >= finalDayAbs();
/** 今夜が大会・勝負の前夜か（遠出の出発の前夜は含めない）。 */
const tournamentEve = () => finalEve() && !chapterDef?.departure;
/** 日付の見出し。準備期間は「出発前 N日目」。 */
const dayTitle = () => chapterDef?.dayLabel ? `${chapterDef.dayLabel} ${chapterDay(state)}日目` : `DAY ${chapterDay(state)}`;
/** 朝の日付カードの小見出し。最終日が決まっていない章は undatedNote（無ければ出さない）。 */
function countdownText() {
  const left = daysLeft();
  if (left === null) return chapterDef?.undatedNote || "";
  return `${chapterDef?.tournamentName || "SMOKE CROWN CUP"} まで あと${left}日`;
}

function announceChapterBoard() {
  const cards = chapterBoardCards(takeChapterBoardNotice(state));
  if (!cards.length) return;
  for (const card of cards) gainCard(card);
  save();
}

async function morning() {
  refreshWeather();
  // 第1・3章は既存の街の曲。第2章は柚ヶ谷、第4章はドバイ、第5章は店の曲（対応表は story-audio.js の chapterHubBgm と同じ）。
  playBgm(state.chapter === 2 ? "bgm_yuzugaya" : state.chapter === 4 ? "bgm_dubai" : state.chapter === 5 ? "tonari" : "kansetsu_shomei_to_black_coffee");
  // 就寝から続けて来た朝は、夜明けの幕でDAYを見せ終えている（見せた印はここで使い切る）
  if (dawnShownDay === state.day) dawnShownDay = null;
  else await dayCard(dayTitle(), countdownText(), { weather: weatherOf(), forecast: tomorrowForecast() });
  // LIME は通知だけ（中身は好きなときにアプリを開いて読む）
  // 恋人のデートの誘いを出さない章（第3章の東京・第4章のドバイ）は、恋人の朝のLIMEだけ届く（lover-entry.js と同じ扱い）。
  // 一緒にいる恋人（ドバイの同行者）からは届かない。
  // 章の側から届く朝のLIME（第3章の東京の恋人からの訪問の相談など）
  const extra = chapterDef.morningLime?.() || 0;
  // すれ違い（恋人の裏の数値）を一日ぶん進める。予兆のLIMEは、いつもの朝のLIMEより先に届ける（同じ相手からは重ねない）
  const strained = strainMorning();
  const n = strained + deliverMorning({ fixedNight, invitations: chapterDef.dateInvitations !== false,
    exclude: chapterDef.withLovers?.() || [] }) + extra;
  if (n) pushNotice(n, { onDayOneHint: save, onOpen: (sender) => {
    if (isChoosingDestination() && !layers.modal.classList.contains("show")) phoneButton({ sender });
    else queuedLimeSender = sender;
  } });
  setPhoneBadge(unreadCount());
}

/** HUD の LIME。行き先を選んでいるときだけ開ける。誘いに乗ったらマップを閉じてそのまま向かう */
async function phoneButton({ sender = null } = {}) {
  if (!isChoosingDestination() || layers.modal.classList.contains("show")) {
    SE.error();
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
  let shortcutUsed = false;
  // 章が足す入口の行（第3章の東京の「地元との連絡」など）。使ったら地図を描き直す。
  const shortcuts = (chapterDef?.limeShortcuts?.() || []).map(shortcut => ({ ...shortcut,
    run: async () => { shortcutUsed = true; await shortcut.run(); } }));
  await openLime({ tutorial: first, sender, fixedNight, shortcuts, beforeClose: async () => {
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
  else if (!interrupted && shortcutUsed) interruptMap("__lime__");
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
    adam: "アダム", tsumugi: "つむぎ", ageha: "あげは", samechan: "サメちゃん" }[sender] || "誰か";
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

// 全画面MENU（daily/menu.js・DUI03）。手動セーブとタイトルへ戻る前の保存は、行き先を選んでいるときだけ。
// 会話や作業の途中（行動の体力だけ引かれた状態など）は残さず、行動前のオートセーブへ戻す（#638）。
function openMenu() {
  return openFullMenu({ canSave: isChoosingDestination });
}

// 地図の GUIDE は「行き先＋用件」を一文に。店名を繰り返さず、共通操作（看板を2回タップ）は初回だけ添える。
// ---------------------------------------------------------------- 1日目の案内

const TONARI_BG = "res://assets/backgrounds/bg_tonari_inside.png";

/**
 * 1日目だけ、自由行動の前にスミさんのおつかいを2つ実地でやる（旧版 N18/N19）。
 * ① Dr.fookah でレモンを仕入れ、大会用に贈られる（買い物は時間を使わない）→ ② KEMURIKUSA を客として偵察（行動1回＋交通費）。
 * 偵察を終えたら退勤済みのまま帰宅。参加登録と配達2件は翌日へ。
 */
async function day1Errands() {
  const owner = state, f = owner.flags;
  const lemon = DB.flavorById.lemon;
  if (!f._errand_shop_done && (!lemon || ownsFlavor("lemon"))) f._errand_shop_done = true;
  const onShown = () => pushNotice(1, {
    dayOneReminder: true, onDayOneHint: save, onOpen: sender => phoneButton({ sender }),
  });
  if (!f._errand_shop_done) {
    if (!f._errand_shop_told) {
      const request = await play("remake_day1_errand_shop", { bg: TONARI_BG });
      if (state !== owner || request?.cancelled) return;
      f._errand_shop_told = true;
      save();
    }
    while (await chooseSpot({ guide: { pin: "shop", text: "Dr.fookahでレモンを仕入れる。看板を2回タップ。" }, onShown }) !== "shop") {
      if (state !== owner) return;
    }
    if (state !== owner) return;
    await openShop({ errand: "lemon", expense: true, expenseFlag: "_errand_lemon_expensed" });
    if (state !== owner) return;
    f._errand_shop_done = true;
    save();
    await bannersIdle();
    if (state !== owner) return;
  }
  if (!f._lemon_gift_read) {
    const gift = await play("remake_lemon_gift", { bg: TONARI_BG });
    if (state !== owner || gift?.cancelled) return;
    f._lemon_gift_read = true;
    save();
  }
  const naru = spotById("naru");
  if (!naru || (!f._errand_naru_visited && (isClosed(naru) || spendableMoney(state) < (naru.cost || 0)))) { f._errand_scout_done = true; return; }
  if (!f._errand_scout_told) {
    const request = await play("remake_day1_errand_scout", { bg: TONARI_BG });
    if (state !== owner || request?.cancelled) return;
    f._errand_scout_told = true;
    save();
  }
  if (!f._errand_naru_visited) {
    while (await chooseSpot({ guide: { pin: "naru", text: "KEMURIKUSAへ偵察に。" }, onShown }) !== "naru") {
      if (state !== owner) return;
    }
    if (state !== owner) return;
    const completed = await visitRival(naru, { scout: true });
    if (state !== owner) return;
    if (!completed) { f._errand_scout_done = true; return; }
    state.visitedDay.naru = state.day;
    f._errand_naru_visited = true;
    gainExp(EXP.tutorial, { key: "ch1_scout", tag: "偵察" });
    save(); // 訪問済みと経験値を一緒に保存。旧保存・再開では後から加算しない。
  }
  f._errand_scout_done = true;
  state.slot = 2; // 偵察でこの日は終了。消耗・費用・行動後処理は従来の1回だけ。
  await afterAction({ exerted: true });
}

async function registerTournament() {
  const venue = spotById("c_station");
  // 偵察を見送った旧保存などでは、未解放/休業の受付へ案内して進行を止めない。
  if (!venue || !isUnlocked(venue) || isClosed(venue) || state.flags._c_station_registered) return;
  await chooseSpot({ guide: { pin: "c_station", text: "C.STATIONで大会に登録する。", free: "参加登録（代金なし）" } });
  const owner = state;
  await visitSpot({ ...venue, cost: 0, stamina: 0 });
  if (state !== owner) return;
  if (owner.flags._c_station_registered && !owner.flags._ch1_rules_read) {
    if (owner.day === 2) await (await import("../scenes/day2-guide.js")).openDay2Guide();
    else await (await import("../scenes/rule-sheet.js")).openRuleSheet();
    if (state !== owner) return;
    owner.flags._ch1_rules_read = true;
  }
  save(); // 無料の登録で行動枠・追加の抽選を使わない。
}

// ---------------------------------------------------------------- tonari の配達

/**
 * 第1章は、スミさんの届け物でEDEN・PEPPERMINTの初来店を必ず通す（DL01）。DAY1 のおつかいに続けて
 * DAY2朝に「登録のついでに」二軒分をまとめて受注し、C.STATIONの登録の足でPEPPERMINT→EDEN。納品後にtonariへ一度だけ報告する。
 * #3819: DAY2は固定のシフトを入れない（常連さんの話は、次に入ったシフトの接客で読む。regularCustomerStory）。
 * #2213 B01: 配達は無料の手順（行動枠・体力を使わない）。届けられなかった店は、その日の帰り道に回す。
 * EDENは従来の無料体験、PEPPERMINTは店内で荷物だけを渡し一服は任意。
 * 自分で先に行った旧セーブの店は飛ばし、DAY2 を過ぎた旧セーブには割り込まない
 */
const DELIVERIES = [
  { charId: "minto", scene: "remake_delivery_minto", text: "PEPPERMINTにミントを届ける。" },
  { charId: "adam", scene: "remake_delivery_eden", text: "EDENに古いダブルアップルを届ける。" },
];
const DELIVERY_LAST_DAY = 2;

/** #2213 B02・#3819: 常連の鉄仮面さん（サラリーマン）の話（夜イベント「常連さんの話」）は、DAY2より後に初めて入った
 * シフトの接客として流す（自分で入ったシフトも、スミさんのLIMEで呼ばれたシフトも）。DAY7までにシフトへ入らなかった時は、
 * 夜イベントの定義（ch1.js の freeNights）どおり DAY8 以降の夜に読む。 */
const carriedShiftStory = () => state.chapter === 1 && state.day >= 2 && !state.flags._ev_salaryman ? regularCustomerStory : null;
async function regularCustomerStory() {
  const scene = DB.dialogues.ch1_salaryman_regular;
  if (state.flags._ev_salaryman || !scene) return null;
  // 冒頭の「顔を出すと、カウンターを頼まれた」は夜の来店用。シフト中は接客の場面から入る。
  const lines = scene.lines[0]?.text?.includes("顔を出すと") ? scene.lines.slice(1) : scene.lines;
  await play({ ...scene, lines }, { bg: TONARI_BG });
  state.flags._ev_salaryman = true;
  return scene.dialogue_id;
}

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

function deliveryRequested(charId, f = state.flags) {
  return !!(f?.[`_delivery_${charId}_told`] || f?.[`_delivery_${charId}`] || f?._delivery_batch_started);
}

/** 配達依頼を受けている未配達の店か。旧セーブで依頼前に自主来店済みの店は除外して完了扱いにする。 */
function pendingDelivery(charId) {
  if (state.chapter !== 1) return null;
  const d = DELIVERIES.find(item => item.charId === charId);
  if (!d) return null;
  const f = state.flags;
  const done = `_delivery_${d.charId}_done`;
  if (f[done]) return null;
  if (!deliveryRequested(d.charId, f)) {
    if (state.day < 2 || !f._errand_scout_done
      || (state.day > DELIVERY_LAST_DAY && !f._delivery_schedule_v2) || restingToday()) return null;
    if (storyCount(d.charId) > 0) { f[done] = true; return null; } // もう自分で行った店
  }
  return d;
}

function dueDelivery({ errand = false } = {}) {
  // 帰り道（その日の行動枠を使い終えた後）か、朝に受注した日の「登録のついで」（errand。行動枠を使う前）。
  if (errand ? state.slot >= 2 || !state.flags._delivery_batch_started : state.slot < 2) return null;
  if (state.chapter !== 1 || state.day < 2 || !state.flags._errand_scout_done
    || (state.day > DELIVERY_LAST_DAY && !state.flags._delivery_schedule_v2) || restingToday()) return null;
  for (const d of DELIVERIES) {
    if (!pendingDelivery(d.charId)) continue;
    const spot = spotById(d.charId);
    // 先の配達先が休業なら順番を入れ替えず、次の営業枠へ延期する。
    return spot && !isClosed(spot) ? d : null;
  }
  return null;
}

async function deliver({ charId, scene, text }, { guide = true, errand = false } = {}) {
  const owner = state;
  const f = state.flags;
  if (!f[`_delivery_${charId}_told`]) {
    const result = await play(scene, { bg: TONARI_BG });
    if (state !== owner || result?.cancelled) return false;
    f[`_delivery_${charId}_told`] = true;
    save();
  }
  if (guide) {
    const destination = await chooseSpot({ guide: { pin: charId, text, free: errand ? "配達（登録のついで・代金なし）" : "配達（帰り道・代金なし）" } });
    if (state !== owner || destination !== charId) return false;
  }
  return deliverToRival(spotById(charId));
}

// ---------------------------------------------------------------- 行動

async function staminaGuard(cost, { mandatory = false } = {}) {
  if (!(cost < 0) || !coldRisk(staminaAfter(cost) / maxStamina({ forCondition: true }))) return true;
  const go = await modal({
    title: "行動後の体力に注意",
    body: "この行動の後は、体力が赤い範囲になる。行動後の残りが少ないほど、翌朝に風邪で寝込む危険が高くなる。"
      + (mandatory ? "<br>今日のシフトは外せない。" : "<br>無事に済むこともあるけど、今は「家に帰る」で休める。")
      + (fitActive(state) ? "<br>（チョコザップで体を整えたので、今は風邪をひきにくい）" : ""),
    options: mandatory ? [{ label: "わかった", value: true, test: "stamina-go" }]
      : [{ label: "やめておく", value: false }, { label: "それでも行く", value: true, test: "stamina-go" }],
  });
  return go;
}

async function confirmRespecClose() {
  // 組み直しが開いている間の最初の行動は、確定する前に閉じることを一度だけ知らせる（SPEC 5.2）
  const closing = takeRespecCloseWarning(state);
  if (!closing || await modal({ title: "心得の盤の組み直し", body: `${closing}。<br>このまま向かいますか？`,
    options: [{ label: "このまま向かう", value: "go", primary: true, test: "respec-close-go" },
      { label: "戻る", value: null, test: "respec-close-back" }] }) === "go") return true;
  save();
  return false;
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
    await travelToInvitation(inv);
    const { done, spent } = await runInvitation(inv, { advanceSlot: true });
    if (!done || state !== invOwner) return;
    await afterAction({ exerted: true, spent });
    return;
  }
  // 占い師（台帳 URA）: 予定の時間帯が来ていて、今が予定と重ならなければ、この時間帯だけ街のどこかに現れる。
  const invite = state.pendingInvite;
  const fortuneBusy = (state.slot >= 1 && fixedNight(state.day)) || restingToday()
    || !!invite && (invite.day ?? state.day) === state.day && invite.slot === state.slot;
  // 柚ヶ谷・ドバイ（第4章）にいる間は現れない（地元か東京へ戻った時間帯へずれる）。
  const fortuneWhere = ["tokyo", "widehanga", "dubai"].includes(state.flags._ch2_region) ? state.flags._ch2_region : "home";
  // ここでは保存しない（記録は次の行動の精算で保存される。読み直しても同じ時間帯に同じく現れる）。
  syncFortune(state, { busy: fortuneBusy, where: fortuneWhere });
  const visitBlock = spot => fixedNightVisitBlock(chapterDef.nightEvents, spot);
  const ev = nightPlan(chapterDef.nightEvents)[0];
  syncSamechanKnowledge();
  const mapOptions = { ...chapterDef.mapOptions?.() };
  if (mapOptions.eventPinLabel && ev?.label && !ev.done?.()) {
    const tonight = `${mapOptions.eventPinLabel}：${ev.label}`;
    const reminder = mapOptions.reminder || respecMapNotice(state);
    mapOptions.reminder = [tonight, reminder].filter(Boolean).join(" ／ ");
  }
  const spotId = await chooseSpot({
    ...mapOptions,
    reminder: mapOptions.reminder || respecMapNotice(state),
    visitBlock,
    eventPin: ev && !ev.done?.() ? ev.pin : null,
    onShown: () => {
      mapOptions.onShown?.();
      if (queuedLimeSender) { const sender = queuedLimeSender; queuedLimeSender = null; phoneButton({ sender }); }
      else limeCoach(phoneButton);
    }, // 通知を先にタップした場合は、マップが開いたところで目的のトークへ
    onBeforeGo: async (destination) => {
      if (destination.boardOnly) return true; // 行動枠も約束も進めない
      const spendsAction = !["shop", "fortune", "rest"].includes(destination.kind)
        && !(typeof pendingDelivery === "function" && pendingDelivery(destination.charId));
      if (spendsAction && !await confirmRespecClose()) return false;
      return confirmLimeReminder(destination, { spendsAction });
    },
  });
  if (spotId === "__lime__") return; // LIME で誘いに乗った → 次の takeAction で約束へ
  // 廃止前の rest:practice も通常の帰宅として扱う（#783）。
  const [baseId] = String(spotId).split(":");
  const spot = chapterDef.spotById?.(baseId) || spotById(baseId);
  if (!spot) throw new Error(`行き先が見つかりません: ${spotId}`);
  const blocked = visitBlock(spot);
  if (blocked) { toast(blocked.why); return; }
  if (spot.boardOnly) {
    await reflectAtSpot(spot.id);
    return;
  }
  if (spot.kind === "rival" && typeof pendingDelivery === "function" && pendingDelivery(spot.charId)) {
    if (!openingStatus(spot, state).ok || isClosed(spot)) return;
    await deliver(pendingDelivery(spot.charId), { guide: false });
    return;
  }
  const spotOwner = state, saveGate = { release: null };
  let outcome;
  try {
    outcome = await paidAction(() => performSpotAction(spot, saveGate), {
      ...facilityGrowth(spot),
      consumed: (result) => result.used && spot.kind === "spot",
      exp: (result) => result.exp || spotExpTarget(spot),
    });
  } finally { saveGate.release?.(); }
  const { value: { used, exerted, slotsUsed = 1 }, spent } = outcome;
  if (!used || state !== spotOwner) return;
  state.visitedDay[spot.id] = state.day;
  // 章が足す、行き先の行動を終えた後の記録（第5章の店めぐり帳の判子など）。保存は下の afterAction が行う
  chapterDef.afterSpot?.(spot);
  // チョコザップ（地元の店と、spot.gym の付いた東京の店＝第3章・第5章）: その日から数日、風邪をひきにくい
  if ((spot.id === "choizap" || spot.gym) && state.flags._gym_member) {
    state.flags._fit_since = { chapter: state.chapter, day: state.day };
    toast(`体が整った。${FIT_DAYS}日間は風邪をひきにくい`, { kind: "good" });
  }
  state.slot = Math.min(2, state.slot + slotsUsed);
  await afterAction({ exerted, spent });
}

async function performSpotAction(spot, saveGate) {
  const actionOwner = state;
  const scheduledGuestSpot = hiyoriShopLocation();
  const scheduledCityVisit = cityGuestAtShop(spot);
  // よその店に居合わせる人は、入る前に地図で見た人（来店で「今日行った店」が変わっても変えない）
  const scheduledRoamer = roamerAt(spot);
  // 背景は店の絵（東京の店は preview、柚ヶ谷の店は previewUrl）
  const roamerBg = () => spot.previewUrl || spot.bgUrl || bgRef(spot.bg || spot.preview || VISIT_BG[spot.charId] || "bg_tonari_inside");
  if (!openingStatus(spot, state).ok) return { used: false, exerted: false };
  if (spot.kind === "axe") {
    // 直接呼び出された入口にも、地図と同じ発見条件を適用する。
    if (!axeBarDiscovered(state)) return { used: false, exerted: false };
    const { visitAxeBar } = await import("./axe-bar.js");
    const completed = await visitAxeBar({ staminaGuard });
    return { used: completed, exerted: completed };
  }
  if (chapterDef.performSpot) {
    const result = await chapterDef.performSpot(spot, { staminaGuard,
      // 移動先・同行の会話・使った行動を、同じ時点のセーブにする。
      holdSaveUntilActionEnds: () => { saveGate.release ??= holdActionSave(actionOwner); },
    });
    if (result) {
      // 第3章以降の店の人が、配合を教える／名前を付けた一台を受け取る（#2020 G・daily/recipe-finds.js）
      if (result.used && state === actionOwner) await recipeFindAfterVisit(spot, { bg: roamerBg() });
      // プチ修羅場（恋人が2人以上・一度きり）: 居合わせ・予約表・映画館・なるの釘。訪問は済んでいて、行動も料金も使わない
      if (result.used && state === actionOwner) { strainAfterVisit(spot); await petitAfterVisit(spot, { bg: roamerBg() }); }
      if (result.used && state === actionOwner) await meetRoamer(spot, scheduledRoamer, { bg: roamerBg() });
      return result;
    }
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
    const selected = await tonariMenu({ talks: chapterDef?.tonariTalks?.() });
    const floor = selected === "baito_floor";
    const sub = floor ? "baito" : selected; // 同じ勤務。固定夜・訪問日・体力・成長の経路を分けない。
    if (state !== actionOwner || !sub) return { used: false, exerted };
    if (chapterDef?.performTonariTalk) {
      const talk = await chapterDef.performTonariTalk(sub);
      if (talk) return talk;
      if (state !== actionOwner) return { used: false, exerted };
    }
    exp = TONARI_EXP[sub] || null;
    if (sub === "ichidai") {
      const { visitIchidaiTable } = await import("./ichidai-table.js");
      await visitIchidaiTable({ isCurrent: () => state === actionOwner });
      return { used: false, exerted };
    }
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
    if (state !== actionOwner) return { used: false, exerted: false };
    if (floor && saveGate) {
      saveGate.release = holdActionSave(actionOwner);
    }
    exerted = true;
    state.visitedDay[makanai ? "tonari_practice" : `tonari_${sub}`] = state.day;
    // #2213 B04: 「まかないで練習」はシフト上がりのメニューで選ぶ（tonari.js）。独立の行動としては選べない。
    if (sub === "strawberry") {
      const { runStrawberryTrial } = await import("../chapters/ch2-strawberry-trial.js");
      addStamina(-16);
      const { masteryGained } = await runStrawberryTrial({ bg: TONARI_BG, isCurrent: () => state === actionOwner });
      if (masteryGained) toast("使ったフレーバーの熟練度が育った。持ち物で確認できる", { kind: "good" });
    } else if (sub === "baito") {
      // 本編の「常連さんの話」を読むシフト（carriedShiftStory）は、いつものシフトとして進む（フロア営業の札は、その間は出ない。tonari.js）
      if (await doBaito({ floor, story: carriedShiftStory() }) === false || state !== actionOwner) return { used: false, exerted: false };
    }
    else if (await tonariCustomer() === false) return { used: false, exerted: false };
  } else if (spot.kind === "samechan") {
    if (!(await staminaGuard(spot.stamina))) return { used: false, exerted };
    used = await visitSamechan(spot);
    exerted = spot.stamina < 0;
    if (used) await consultLessons("samechan"); // 心得の盤で灯した授業があれば相談する（SBD61: 会った時だけ）
  } else if (spot.kind === "rival") {
    if (isClosed(spot)) return { used: false, exerted };
    const delivery = pendingDelivery(spot.charId);
    if (delivery) {
      await deliver(delivery, { guide: false });
      return { used: false, exerted: false, slotsUsed: 0 };
    }
    if (!(await staminaGuard(spot.stamina)) || isClosed(spot)) return { used: false, exerted };
    used = (await visitRival(spot)) !== false;
    // 心得の盤で灯した授業があれば、そのまま相談して話を聞く（SBD50）
    if (used) await consultLessons(spot.charId);
    exerted = used;
  } else if (spot.kind === "shop") {
    const r = await openShop();
    if (r !== "rio") used = false;
    else if (!(await confirmLimeReminder(spot))) used = false;
    else if (await staminaGuard(-14) && await confirmRespecClose()) { used = await visitRio(); exerted = used; if (used) await consultLessons("rio"); }
    else used = false;
  } else if (spot.kind === "spot") {
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
    await doFortune(); // 時間は使わない（占ってもらったら、この出現はおしまい）
    save();
    return { used: false, exerted };
  }
  if (used) {
    const guestBg = bgRef(spot.bg || VISIT_BG[spot.charId] || (spot.kind === "shop" ? "bg_fookah_showroom" : "bg_tonari_inside"));
    if (await visitHiyoriAtShop(spot, { scheduledSpot: scheduledGuestSpot, bg: guestBg })) await consultLessons("hiyori", { bg: guestBg });
  }
  if (used) await visitCityGuestAtShop(spot, { scheduledVisit: scheduledCityVisit });
  if (used && state === actionOwner) { strainAfterVisit(spot); await petitAfterVisit(spot, { bg: roamerBg() }); } // すれ違いの埋め合わせ・プチ修羅場（上の章の分岐と同じ）
  if (used && state === actionOwner) await meetRoamer(spot, scheduledRoamer, { bg: roamerBg() });
  return { used, exerted, slotsUsed, exp };
}

// 経験値の鍵（SPEC 1.3）: 相手のいる行動は相手のキャラID、相手のいない行動はスポットか行動の種類。
const TONARI_EXP = {
  baito: { key: "tonari_shift", place: "tonari_shift" },
  practice: { key: "tonari_practice", place: "tonari_practice" },
  strawberry: { key: "tonari_practice", place: "tonari_practice" },
  customer: { key: "tonari_seat", place: "tonari_seat" },
};
/**
 * 大会前夜に内省する場所（SPEC 2.8）。今いる地域の静かな場所: 地元は観音堂、東京は池の弁天堂、ドバイはモスクの見える水辺、
 * 柚ヶ谷は宿の窓辺（参拝の場所を置かない。SBD34）。2026-11-02: 東京の日常ループ（第3章・第5章）でも地元の観音堂になっていたのを直す
 */
export function evePlaceFor(s) {
  const region = s.flags?._ch2_region;
  if (region === "tokyo") return "tokyo_shrine";
  if (region === "dubai") return "dubai_waterside"; // 夜はモスクの見学ができないので、モスクの見える水辺
  if (region === "widehanga") return "inn_window";
  return "kannon";
}

function spotExpTarget(spot) {
  if (spot.kind === "shop") return { key: "rio", person: "rio" };
  if (spot.charId && ["rival", "samechan"].includes(spot.kind)) return { key: spot.charId, person: spot.charId };
  if (spot.kind === "samechan") return { key: "samechan", person: "samechan" };
  if (spot.kind === "rest" || spot.kind === "fortune") return null; // 休養・占いは学びにしない
  return { key: spot.id, place: spot.id };
}
// 絆の深い相手（恋人・締めくくりを読んだ相手）からの誘いは、新鮮さで減らさず多めに入る（LM11）
const invitationExp = (inv) => inv?.sender ? { key: inv.sender, person: inv.sender, bond: bondInvitation(inv.event, inv.sender) } : null;

function postponeUnaffordableInvitation(inv) {
  const cost = invitationCost(inv.event);
  if (spendableMoney(state) >= cost) return false;
  rescheduleInvitation(inv, "所持金が足りなかったため、約束を別の日に改めることにした");
  toast(`約束の店には${yen(cost)}必要です。今日は見送り、別の日に改めます`, { kind: "warn" });
  save();
  return true;
}

async function guardInvitation(inv) {
  if (await staminaGuard(inv.event === "__sumi_baito__" ? -24 : inv.event === "__mukai_baito__" ? -14 : -10)) return true;
  rescheduleInvitation(inv, "体調を考え、約束を別の日に改めることにした");
  save();
  return false;
}

function invitationSourceMessage(inv) {
  return state.inbox?.find(item => item.id === inv.originId || item.originId === inv.originId)?.msg
    || DB.lime.find(message => message.id === inv.originId)
    || DB.lime.find(message => message.accept_event === inv.event && message.sender === inv.sender);
}

// 移動が終わるまで約束・面会費用・行動報酬は確定しない。
async function travelToInvitation(inv) {
  const owner = state, day = state.day, slot = state.slot;
  const id = invitationVisitSpot(inv, invitationSourceMessage(inv));
  const destination = chapterDef.spotById?.(id) || spotById(id);
  if (await chapterDef.beforeInvitation?.(destination) === false
    || state !== owner || state.day !== day || state.slot !== slot || state.pendingInvite !== inv) {
    throw new Error("約束へ向かう移動が中断されました");
  }
}

async function runInvitation(inv, { advanceSlot = false } = {}) {
  if (inv.event === "date_samechan") {
    if (!samechanDateReady()) {
      cancelSamechanAppointment(inv);
      return { done: false, spent: 0 };
    }
    const owner = state;
    const result = await playSamechanDate({ invite: inv, cost: invitationCost(inv.event), advanceSlot });
    if (result.done && state === owner) completeInvitation(inv);
    return result;
  }
  const owner = state, slot = state.slot;
  const releaseSave = holdActionSave(owner);
  try {
    const { value: done, spent } = await paidAction(() => meetInvitation(inv), {
      ...invitationGrowth(inv.event), primary: CHAR_STAT[inv.sender], exp: invitationExp(inv), cancelled: met => !met,
    });
    if (done && state === owner) {
      if (slot >= 1) {
        state.flags._private_night_day = state.day;
        state.flags._private_night_char = inv.sender;
      }
      if (advanceSlot) state.slot++;
    }
    return { done, spent };
  } finally { releaseSave(); }
}

async function meetInvitation(inv) {
  if (postponeUnaffordableInvitation(inv)) return false;
  const owner = state;
  const destination = invitationVisitSpot(inv, invitationSourceMessage(inv));
  const cost = invitationCost(inv.event);
  if (inv.event === "__sumi_baito__") {
    // シフト中は消耗後の体調を使う。中断したら出勤前の体力と出勤回数に戻す。
    const { stamina, baitoCount, lastBaitoDay } = state;
    let completed = false;
    try { completed = await doBaito({ called: true, story: carriedShiftStory() }); }
    finally {
      if (!completed && state === owner) {
        addStamina(stamina - state.stamina);
        state.baitoCount = baitoCount;
        state.lastBaitoDay = lastBaitoDay;
      }
    }
    if (!completed || state !== owner) return false;
    state.visitedDay.tonari_baito = state.day;
    state.visitedDay.tonari = state.day;
  } else if (inv.event === "__mukai_baito__") {
    // ムカイさんのLIMEで呼ばれた東京の mukai のシフト（VOL10）。シフトの中身は章の側（chapters/tokyo-mukai.js）
    if (!await chapterDef.mukaiShift?.({ called: true }) || state !== owner) return false;
    if (inv.visitSpot) state.visitedDay[inv.visitSpot] = state.day;
  } else if (inv.event === "hiyori_tonari_return") {
    if (!await playHiyoriEvent("tonari_return") || state !== owner) return false;
    state.visitedDay.tonari = state.day;
    addStamina(-10);
  } else if (inv.event === "__hiyori_shop__") {
    const spot = spotById(inv.visitSpot);
    if (!await playHiyoriHangout({ bg: bgRef(spot.bg || VISIT_BG[spot.charId]) }) || state !== owner) return false;
    await consultLessons("hiyori", { bg: bgRef(spot.bg || VISIT_BG[spot.charId]) });
    if (state !== owner) return false;
    state.visitedDay[spot.id] = state.day;
    addStamina(-10);
  } else if (/^date_/.test(inv.event)) {
    if (!await playDate(inv.sender) || state !== owner) return false; // 絆・ステ・体力はデート側で
    // ひよりの feelings_spoken（#1434 決定B）。恋人・絆Lv2以降のデートの帰りに一度だけ。条件は route.events。
    if (inv.sender === "hiyori") await playHiyoriEvent("feelings_spoken");
  } else if (isFriendEvent(inv.event)) {
    // 友人からのシーシャのお誘い（HF09）。ステは場面側の apply
    if (!await playFriendHangout(inv.sender) || state !== owner) return false;
    gainAffinity(inv.sender, 5);
    addStamina(-10);
  } else if (isFinaleEvent(inv.event)) {
    // 私的な約束で会う締めくくり（みんと）。専用ハガルの贈呈・ルートの記録は bonds.js
    if (!await playFinale(inv.sender) || state !== owner) return false;
    gainAffinity(inv.sender, 10);
    addStamina(-10);
  } else {
    const result = await play(storeInvitationSpot({ accept_event: inv.event })
      ? storeInvitationDialogue(DB.dialogues[inv.event], state.slot) : inv.event, { growthScene: true });
    if (state !== owner || !result || result.cancelled) return false;
    if (inv.event === `outing_${inv.sender}_1`) state.flags[`_outing_done_${inv.sender}`] = true;
    if (inv.event === "ch1_minto_fifth") state.flags._minto_fifth_done = true;
    if (inv.event === "ch1_adam_outing_dagurikura") state.flags._adam_arcade_done = true;
    gainAffinity(inv.sender, 10);
    addStamina(-10);
    await afterStory(inv.event); // 私服の約束のあとの、途中の質問（みんと）
  }
  if (state !== owner) return false;
  addMoney(-cost);
  if (destination) {
    state.visitedDay[destination] = state.day;
    state.flags[`_invitation_visit_${destination}`] = `${state.chapter}:${state.day}`;
  }
  if (!["__sumi_baito__", "__mukai_baito__"].includes(inv.event) && CHAR_STAT[inv.sender]) {
    const { earnStat } = await import("../core/stats.js");
    earnStat(CHAR_STAT[inv.sender], 1);
  }
  completeInvitation(inv);
  if (state.pendingInvite === inv) state.pendingInvite = null;
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
  if (exerted && !state.flags._cold_pending && catchesCold(staminaRatio({ forCondition: true }), Math.random, { fit: fitActive(state) })) state.flags._cold_pending = true;
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
    // #2775: 夜の枠で「家（休む）」を選んだ直後は、家で横になった流れから店の場面へ飛ばさず、出かけ直す一行を挟む。
    const restedTonight = !!state.flags._home_tonight;
    delete state.flags._home_tonight; // 休息後でも、固定イベントの場所へ出かける。
    // 配達報告の直後だけは同じ来店で話を続ける。別の目的地・後続予定の到着は残す。
    const sameVisit = returnedToTonari && ev.pin === "tonari";
    returnedToTonari = false;
    if (rested || state.restDay?.illnessHealth) await beat("今日は休んでいたが、この予定だけは外せない——");
    else if (restedTonight) await beat("少し横になってから、もう一度出かけた——");
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
      if (state !== apptOwner || state.pendingInvite !== appointment) return;
    }
    await travelToInvitation(appointment);
    await beat(appointment.afterClose ? "——店の営業が終わってから、約束の場所へ。"
      : rested ? "休養のあと、LIMEで約束した場所へ——" : "仕事を終え、LIMEで約束した場所へ。");
    if (state !== apptOwner || state.pendingInvite !== appointment) return;
    const { done, spent } = await runInvitation(appointment);
    if (state !== apptOwner || !done && state.pendingInvite === appointment) return;
    if (done) {
      delete state.flags._home_tonight;
      await afterAction({ exerted: true, spent });
      if (state !== apptOwner) return;
      metTonight = true;
      companion = appointment.sender;
    }
  }
  // 別の約束で人と会った夜に告白は重ねない（予約は残り、落ち着いた夜に回る）
  // 告白は第1〜3章の物語。第5章（confessions: false）では夜に告白の場面を始めない。
  const strainOwner = state;
  const confessed = chapterDef.confessions === false ? false
    : await maybeConfession(beat, { busyNight: metTonight || rested || state.flags._eve_slept === state.day, companion });
  if (state !== strainOwner) return;
  if (confessed) { delete state.flags._home_tonight; await bannersIdle(); }
  // 別れ話（すれ違いが溜まりきった恋人が帰り道で待っている。daily/lover-strain.js）。告白・約束・休養・夜の予定・大会前夜の夜と、
  // 夜を家で過ごした日（帰り道が無い）には重ねない
  if (state !== strainOwner) return;
  const strainBusy = confessed || metTonight || rested || nightCount > 0
    || !!state.flags._home_tonight || state.flags._eve_slept === state.day || tournamentEve() || finalEve();
  const talked = await maybeStrainTalk(beat, { busyNight: strainBusy });
  if (state !== strainOwner) return;
  // やり直し（友達に戻った相手に、章をまたいだ後こちらから一度だけ申し込める）。別れ話のあった夜には重ねない
  const reunion = talked ? false : await maybeStrainReunion(beat, { busyNight: strainBusy });
  if (state !== strainOwner) return;
  if (talked || reunion) { delete state.flags._home_tonight; await bannersIdle(); }
  await chapterDef.beforeHomecoming?.();
  const athome = !!state.flags._home_tonight;
  delete state.flags._home_tonight;
  // 帰り道と家では、店の曲（tonari・ライバル店など）を持ち帰らない。朝の曲と同じ街の曲へ戻す（第5章も家では店の曲にしない）。
  playBgm(state.chapter === 2 ? "bgm_yuzugaya" : state.chapter === 4 ? "bgm_dubai" : "kansetsu_shomei_to_black_coffee");
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
  // 家に台が無い泊まり先（第5章の東京の屋根裏）では聞かない。
  if (chapterDef.homeShisha?.() !== false && await runHomeShisha({ eve: tournamentEve() })) await bannersIdle();
  delete state.flags._home_trial_plan; // 予約方式の旧セーブを読んだ場合も持ち越さない
  // 寝る直前（夜明けの幕の前）にその日の経験値を精算する。大会前夜もここで火種が届く（REPORT P2・R1）
  // 大会前夜は、火種が残っていれば精算のあとにひとりで内省しに行く（SPEC 2.8・#1690）。柚ヶ谷の夜は宿の窓辺
  const eve = tournamentEve();
  await presentNight({ evePlace: eve ? evePlaceFor(state) : null });
  if (state !== homeOwner) return;
  await advanceDay();
}

async function advanceDay() {
  const exhausted = !!state.flags._cold_pending;
  const illnessHealth = conditionForRatio(staminaRatio({ forCondition: true })).health;
  delete state.flags._cold_pending;
  delete state.flags._overwork; // 旧セーブの固定発病カウンターは使わない。
  const sleepBefore = state.stamina;
  const fromDay = chapterDay(state);
  const fromLeft = daysLeft();
  // 寝ると最終日（大会・勝負の日）の朝になる夜か。判定は日が進む前に一度だけ。
  const eveOfFinal = finalEve();
  const wake = () => {
    // 大会の朝に発病しても大会日を飛ばさない。その夜は回復せず、不調の残量で本番へ。
    addStamina(exhausted && eveOfFinal && !chapterDef?.departure ? 0 : SLEEP_RECOVERY, { sleep: true });
    state.day += 1;
    state.slot = 0;
    state.restDay = exhausted ? { chapter: state.chapter, day: state.day, fullDay: false, illnessHealth } : null;
    refreshWeather();
    updateHud();
    // 朝は寝た場所で目を覚ます（ふだんは家。前の夜の場面の絵を持ち越さない）
    setBg(bgUrl(chapterDef?.wakeBackground?.() || "bg_home", "day"), { instant: true });
  };
  if (!eveOfFinal) {
    // 夜の紫が降りて、DAYと残り日数がめくれ、地平線が昇って朝になる（大会当日は当日の演出に任せる）
    await dayTurn(async () => {
      wake();
      return { fromDay, day: chapterDay(state), fromLeft, left: daysLeft(), rain: isRainy(), weather: weatherOf(), forecast: tomorrowForecast(), sick: exhausted, tournamentName: chapterDef?.tournamentName, undatedNote: chapterDef?.undatedNote, dayLabel: chapterDef?.dayLabel };
    });
    dawnShownDay = state.day;
  } else await fadeBlack(wake, 500);
  await presentSleepRecovery({ before: sleepBefore, after: state.stamina });
  if (!exhausted) return;
  // 遠出の出発の朝は、熱っぽさを持ち越さずに発つ（大会の朝の場面は使わない）。
  if (state.day >= finalDayAbs() && chapterDef?.departure) {
    state.restDay = null;
    updateHud();
    return;
  }
  if (state.day >= finalDayAbs()) {
    await play("remake_sick_tournament");
    updateHud();
    return;
  }
  state.flags._overwork = 0;
  const first = !state.flags._sick_once;
  state.flags._sick_once = true;
  state.flags[`_morning_${state.day}`] = true;
  if (dawnShownDay !== state.day) await dayCard(dayTitle(), "……熱っぽい");
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

