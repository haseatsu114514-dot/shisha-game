// 日常パートの1日の流れ: 朝（DAYカード・LIME）→ 昼の行動 → 夜の行動 → 夜の固定イベント → 帰宅 → 翌朝。
import { el, sleep } from "../core/util.js";
import { layers, dayCard, modal, toast, fadeBlack, bannersIdle, setBg } from "../core/ui.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { addStamina, gainAffinity, gainStat, STAMINA_LOW, maxStamina } from "../core/stats.js";
import { DB, bgUrl } from "../core/data.js";
import { SE, playBgm } from "../core/audio.js";
import { play } from "../vn/engine.js";
import { glossaryPanel } from "../vn/glossary.js";
import { initHud, showHud, updateHud, daysLeft, MAX_DAYS, setPhoneBadge } from "./hud.js";
import { chooseSpot, interruptMap } from "./map.js";
import { isRainy } from "./weather.js";
import { spotById, visitRival, visitSpot, restAtHome, isClosed } from "./spots.js";
import { doFortune } from "./fortune.js";
import { tonariMenu, tonariCustomer, doBaito } from "./tonari.js";
import { openShop, visitRin, ownsFlavor } from "./shop.js";
import { deliverMorning, pushNotice, hasUnread, openLime, limeCoach, expireInvitations } from "./phone.js";
import { openStatus } from "./status.js";
import { onAction as spinReel, presentNow as showReelNow } from "./reel.js";
import { maybeConfession, playDate } from "./romance.js";
import { afterStory, isFinaleEvent, playFinale, isFriendEvent, playFriendHangout } from "./bonds.js";
import { syncKafukaKnowledge, maybeKafukaEncounter, visitKafuka } from "./kafuka.js";

const SLEEP_RECOVERY = 14;

let chapterDef = null;
let onQuit = null;
let queuedLimeSender = null;

/**
 * 日常パートを DAY1〜MAX_DAYS まで回す。大会当日の朝の手前で返る。
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
  while (state.day <= MAX_DAYS) {
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
      await takeAction();
      updateHud();
      save();
    }
    await endDay();
    save();
  }
}

async function morning() {
  playBgm("daily_part");
  await dayCard(`DAY ${state.day}`, `SMOKE CROWN CUP まで あと${daysLeft()}日${isRainy() ? "　☂ 雨" : ""}`);
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
 * マップは行き先の1か所だけ選べる案内つき。DAY1 の夜からが本当の自由行動
 */
async function day1Errands() {
  const f = state.flags;
  const mint = DB.flavorById.mint;
  if (!f._errand_shop_done && (!mint || ownsFlavor("mint") || state.money < mint.price)) f._errand_shop_done = true;
  if (!f._errand_shop_done) {
    if (!f._errand_shop_told) {
      await play("remake_day1_errand_shop", { bg: TONARI_BG });
      f._errand_shop_told = true;
      save();
    }
    await chooseSpot({ guide: { pin: "shop", text: "スミさんに頼まれた仕入れへ。Dr.fookah をタップ！" } });
    await openShop({ errand: "mint" });
    f._errand_shop_done = true;
    gainStat("insight", 2); // 仕入れの感覚を掴んだ
    toast("スミ「上出来だ。……この調子で、ちゃんと店を回せ」", { ms: 3200 });
    save();
    await bannersIdle();
  }
  const naru = spotById("naru");
  if (!naru || isClosed(naru) || state.money < (naru.cost || 0)) { f._errand_scout_done = true; return; }
  if (!f._errand_scout_told) {
    await play("remake_day1_errand_scout", { bg: TONARI_BG });
    f._errand_scout_told = true;
    save();
  }
  await chooseSpot({ guide: { pin: "naru", text: "ケムリクサへ偵察に。KEMURIKUSA をタップ！" } });
  f._errand_scout_done = true;
  await visitRival(naru);
  state.visitedDay.naru = state.day;
  state.slot++;
  await afterAction();
}

// ---------------------------------------------------------------- 行動

async function staminaGuard(cost) {
  if (!(cost < 0) || state.stamina + cost >= STAMINA_LOW) return true;
  const go = await modal({
    title: "体が重い……",
    body: "体力が残り少ない。このまま無理をすると、寝込むかもしれない。<br>「家に帰る」で休むこともできる。",
    options: [{ label: "やめておく", value: false }, { label: "それでも行く", value: true, test: "stamina-go" }],
  });
  if (go) state.flags._overwork = (state.flags._overwork || 0) + 1;
  return go;
}

async function takeAction() {
  expireInvitations({ fixedNight: (d) => !!chapterDef.nightEvents[d] });
  // 約束（LIMEの誘い）がこの時間帯にあれば、そのまま向かう
  const inv = state.pendingInvite;
  if (inv && (inv.day ?? state.day) === state.day && inv.slot === state.slot) {
    if (inv.afterClose) {
      // 夜の行動枠を予約し、会う場面は営業イベント後・帰宅前まで待つ。
      inv.queuedAfterClose = true;
      state.slot++;
      return;
    }
    state.pendingInvite = null;
    if (state.slot === 1) state.flags._private_night_day = state.day;
    await meetInvitation(inv);
    state.slot++;
    await afterAction();
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
  let used = true;
  if (spot.kind === "tonari") {
    const sub = await tonariMenu();
    if (!sub) return;
    if (state.visitedDay[`tonari_${sub}`] === state.day) {
      toast(sub === "baito" ? "今日のシフトはもう終わった" : "今日はもう客席で一服した");
      return;
    }
    if (!(await staminaGuard(sub === "baito" ? -24 : -10))) return;
    state.visitedDay[`tonari_${sub}`] = state.day;
    if (sub === "baito") await doBaito();
    else await tonariCustomer();
  } else if (spot.kind === "kafuka") {
    if (!(await staminaGuard(spot.stamina))) return;
    used = await visitKafuka(spot);
  } else if (spot.kind === "rival") {
    if (!(await staminaGuard(spot.stamina))) return;
    await visitRival(spot);
  } else if (spot.kind === "shop") {
    const r = await openShop();
    if (r !== "rin") used = false;
    else if (await staminaGuard(-14)) await visitRin();
    else used = false;
  } else if (spot.kind === "spot") {
    if (!(await staminaGuard(spot.stamina))) return;
    await visitSpot(spot);
  } else if (spot.kind === "rest") {
    await restAtHome(spot);
  } else if (spot.kind === "fortune") {
    await doFortune(); // 時間は使わない（占ってもらったら今日はもう寄れない）
    save();
    return;
  }
  if (!used) return;
  state.visitedDay[spot.id] = state.day;
  state.slot++;
  await afterAction();
}


async function meetInvitation(inv) {
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
}

/** 行動を1回使ったあと: スロットが1回転（昼は次のマップで・夜はその場で見せる）。告白は営業後に endDay で扱う */
async function afterAction() {
  spinReel();
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
  if (appointment?.afterClose && appointment.queuedAfterClose && (appointment.day ?? state.day) === state.day) {
    state.pendingInvite = null;
    await beat("——店の営業が終わってから、約束の場所へ。");
    await meetInvitation(appointment);
    await afterAction();
    metTonight = true;
  }
  // 別の約束で人と会った夜に告白は重ねない（予約は残り、落ち着いた夜に回る）
  const confessed = await maybeConfession(beat, { busyNight: metTonight });
  if (confessed) await bannersIdle();
  const athome = !!state.flags._home_tonight;
  delete state.flags._home_tonight;
  const next = chapterDef.nightEvents[state.day + 1];
  if (!athome) {
    await maybeKafukaEncounter({ hasNightEvent: !!ev,
      hasAppointment: !!appointment && (appointment.day ?? state.day) === state.day, hadConfession: confessed, athome });
    await play(`remake_homecoming_${state.day % 3}`);
  }
  if (next && next.teaser && state.day < MAX_DAYS) toast(`（明日、${next.teaser}で何かありそうな気がする）`, { ms: 2400 });
  await bannersIdle();
  await advanceDay();
}

async function advanceDay() {
  const exhausted = state.stamina <= 0 || (state.flags._overwork || 0) >= 2;
  await fadeBlack(async () => {
    addStamina(SLEEP_RECOVERY);
    state.day += 1;
    state.slot = 0;
    updateHud();
    setBg(bgUrl("bg_home", "day"), { instant: true }); // 朝は家で目を覚ます（前の夜の場面の絵を持ち越さない）
  }, 500);
  if (!exhausted || state.day > MAX_DAYS) return;
  state.flags._overwork = 0;
  const first = !state.flags._sick_once;
  state.flags._sick_once = true;
  state.flags[`_morning_${state.day}`] = true;
  await dayCard(`DAY ${state.day}`, "……熱っぽい");
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

