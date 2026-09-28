// 日常パートの1日の流れ: 朝（DAYカード・LIME）→ 昼の行動 → 夜の行動 → 夜の固定イベント → 帰宅 → 翌朝。
import { el, sleep } from "../core/util.js";
import { layers, dayCard, modal, toast, fadeBlack, bannersIdle } from "../core/ui.js";
import { state, save } from "../core/state.js";
import { addStamina, gainAffinity, STAMINA_LOW, maxStamina } from "../core/stats.js";
import { SE, playBgm } from "../core/audio.js";
import { play } from "../vn/engine.js";
import { glossaryPanel } from "../vn/glossary.js";
import { initHud, showHud, updateHud, daysLeft, MAX_DAYS, setPhoneBadge } from "./hud.js";
import { chooseSpot } from "./map.js";
import { spotById, visitRival, visitSpot, restAtHome } from "./spots.js";
import { tonariMenu, tonariCustomer, doBaito } from "./tonari.js";
import { openShop, visitRin } from "./shop.js";
import { morningMessages, openPhone } from "./phone.js";
import { openStatus } from "./status.js";
import { onAction as spinReel } from "./reel.js";
import { maybeConfession, playDate } from "./romance.js";

const SLEEP_RECOVERY = 14;

let chapterDef = null;
let onQuit = null;

/**
 * 日常パートを DAY1〜MAX_DAYS まで回す。大会当日の朝の手前で返る。
 * @param def.nightEvents { [day]: { pin, beat, run: async () => {} } }
 * @param def.onQuit タイトルへ戻る処理
 */
export async function runDaily(def) {
  chapterDef = def;
  onQuit = def.onQuit;
  initHud({ phone: phoneButton, status: openStatus, menu: openMenu });
  showHud(true);
  while (state.day <= MAX_DAYS) {
    if (!state.flags[`_morning_${state.day}`]) {
      state.flags[`_morning_${state.day}`] = true;
      await morning();
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
  await dayCard(`DAY ${state.day}`, `SMOKE CROWN CUP まで あと${daysLeft()}日`);
  const msgs = morningMessages({ fixedNight: (d) => !!chapterDef.nightEvents[d] });
  if (msgs.length) {
    SE.phone();
    const accepted = await openPhone(msgs, { time: "AM 8:12" });
    for (const a of accepted) state.pendingInvite = a;
  }
  setPhoneBadge(0);
}

async function phoneButton() {
  SE.select();
  toast("新しいメッセージはない");
}

async function openMenu() {
  SE.select();
  const v = await modal({
    title: "MENU",
    body: `DAY ${state.day}・${state.slot >= 1 ? "夜" : "昼"}　／　行動のたびに自動でセーブされています。`,
    options: [
      { label: "用語集", value: "glossary" },
      { label: "タイトルへ戻る", value: "title", test: "menu-title" },
      { label: "閉じる", value: null, primary: true },
    ],
  });
  if (v === "glossary") await modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal", options: [{ label: "閉じる", value: true, primary: true }] });
  if (v === "title") { save(); location.reload(); }
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
  // 約束（LIMEの誘い）がこの時間帯にあれば、そのまま向かう
  const inv = state.pendingInvite;
  if (inv && inv.slot === state.slot) {
    state.pendingInvite = null;
    await fadeBlack(null, 300);
    if (/^date_/.test(inv.event)) {
      await playDate(inv.sender); // 恋人とのデート（絆・ステ・体力はデート側で）
    } else {
      await play(inv.event);
      state.flags[`_outing_done_${inv.sender}`] = true;
      gainAffinity(inv.sender, 10);
      addStamina(-10);
    }
    state.slot++;
    await afterAction();
    return;
  }
  const ev = chapterDef.nightEvents[state.day];
  const spotId = await chooseSpot({
    eventPin: ev && !ev.done?.() ? ev.pin : null,
    notice: state.slot === 1 && inv ? "今夜は約束がある" : "",
  });
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
  }
  if (!used) return;
  state.visitedDay[spot.id] = state.day;
  state.slot++;
  await afterAction();
}

/** 行動を1回使ったあと: スロットが1回転（結果は次にマップを開いたとき見せる）→ 告白の予約があれば */
async function afterAction() {
  spinReel();
  save();
  await bannersIdle();
  if (await maybeConfession(beat)) await bannersIdle();
}

// ---------------------------------------------------------------- 夜・翌朝

async function beat(text) {
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
  const athome = !!state.flags._home_tonight;
  delete state.flags._home_tonight;
  const next = chapterDef.nightEvents[state.day + 1];
  if (!athome) {
    await play(`remake_homecoming_${state.day % 3}`);
  }
  if (next && next.teaser && state.day < MAX_DAYS) toast(`（明日、${next.teaser}で何かありそうな気がする）`, { ms: 2400 });
  await bannersIdle();
  await advanceDay();
}

async function advanceDay() {
  const exhausted = state.stamina <= 0 || (state.flags._overwork || 0) >= 2;
  await fadeBlack(async () => {
    state.stamina = Math.min(maxStamina(), state.stamina + SLEEP_RECOVERY);
    state.day += 1;
    state.slot = 0;
    updateHud();
  }, 500);
  if (!exhausted || state.day > MAX_DAYS) return;
  state.flags._overwork = 0;
  const first = !state.flags._sick_once;
  state.flags._sick_once = true;
  state.flags[`_morning_${state.day}`] = true;
  await dayCard(`DAY ${state.day}`, "……熱っぽい");
  if (first) {
    await play("remake_sick_half");
    state.stamina = Math.max(state.stamina, 60);
    state.slot = 1; // 初回だけは半日で回復（夜の1行動は残る）
  } else {
    await play("remake_sick_full");
    state.stamina = Math.max(state.stamina, 80);
    state.slot = 2;
    state.flags._home_tonight = true;
  }
  updateHud();
}

