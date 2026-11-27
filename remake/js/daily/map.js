// マップ画面。ピンを選んで「行く」を押すと、その行き先で解決する Promise を返す。
// 見た目は旧版を踏襲: 橙須の街マップ／看板型のピン（面識のある相手は顔ドット絵）／右下の墨×金パネル。
import { el, yen } from "../core/util.js";
import { bgUrl, sceneBg, faceIconUrl } from "../core/data.js";
import { showScreen, setBg, retire, uiArtReady, storeLogosReady, imageReady, layers, toast, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { comicLoadingRequired } from "../core/loading.js";
import { cueTransition } from "../core/transitions.js";
import { trainRide } from "../core/scene-motions.js";
import { TRAIN_ICON_SVG } from "../core/train-icon.js";
import { renderSceneArt, sceneArtUrls } from "../core/scene-art.js";
import { state, save, timeOfDay } from "../core/state.js";
import { growthEnabled, hidaneTotal, readyLessons, nextFreshness } from "../core/growth.js";
import { SE } from "../core/audio.js";
import { allSpots, SPOT_PREVIEW, isUnlocked, hasNewEvent, spotDetailLabel, hasChapterTwoVisitContinuation } from "./spots.js";
import { updateHud } from "./hud.js";
import { mountReel } from "./reel.js";
import { isRainy, tomorrowForecast } from "./weather.js";
// 行き先の人物の立ち絵を、地図を見ている間に読んでおく（入店直後の「場面を準備しています…」を減らす・LD05）
import { portraitInfo } from "../core/data.js";
import { fortuneToday } from "./fortune.js";
import { spotVisible, spotAvailability, freeGuide as isFreeGuide } from "./spot-access.js";
import { spotPeople } from "./spot-people.js";
import { rioUnavailable } from "./spot-hours.js";
import { tsumugiAtTonari } from "./tsumugi-schedule.js";
import { hasStoreLogo, storeLogo } from "../core/store-logos.js";
import { newlyRevealedSpots, startSpotReveal, spotRevealNotice } from "./map-reveals.js";
import { createMapFacilityIcon, hasFacilityIcon, FACILITY_SHEET } from "./facility-icons.js";
import { STATION_FARE, WALK_HOME_STAMINA, stationDestinations, prepareStationTrip, stationArrival } from "./station-travel.js";

/** 未面識の相手は共通の人影。画像URL・名前・DOM属性にも正体を出さない。 */
function peopleRow(people) {
  if (!people.length) return null;
  return el("span.pin-people", { "aria-label": `在店：${people.map(p => p.name).join("、")}` }, people.map(person => {
    const face = person.known && faceIconUrl(person.id);
    return face ? el("img.pin-person", { src: face, alt: person.name, title: person.name, dataset: { personRole: person.role } })
      : el("span.pin-person.pin-unknown", { role: "img", "aria-label": person.name, title: person.name, dataset: { personRole: person.role }, html:
        '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="10" r="6"/><path d="M5 30v-4a11 11 0 0 1 22 0v4Z"/></svg><b>?</b>' });
  }));
}
const knowsOwner = (s) => !s.charId || !!state.met[s.charId];
/** その場所で会う人物の立ち絵（通常の表情。会話で出す画風と同じ）。人物のいない場所は null */
const spotPortrait = (s) => (s.charId ? portraitInfo(s.charId, "normal")?.src || null : null);

// 施設は大きな記号、その下に名前。顔のある店は同じ場所に店主の顔を置く。
const POND_HALL = '<path d="M2 10 12 4l10 6M5 10v8M19 10v8M9 18v-5h6v5M2 21c2.5-1.5 4.5 1.5 7 0s4.5 1.5 7 0 4.5 1.5 6 0"/>';
const PIN_SYMBOLS = {
  axe_bar: '<path d="m7 22 7-18M12 5l7-2 3 8-8-1M11 8l4 2"/>',
  trpg_bar: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01"/>',
  store: '<path d="M3 10v11h18V10M2 10l3-7h14l3 7M2 10h20M9 21v-7h6v7"/>',
  cafe: '<path d="M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9ZM16 10h2a3 3 0 0 1 0 6h-2M3 22h16M7 5V2M12 5V2"/>',
  kannon: '<path d="M3 4h18M4 8h16M7 4v17M17 4v17M5 21h4M15 21h4"/>',
  choizap: '<path d="M7 12h10M3 8H1v8h2M21 8h2v8h-2"/><rect x="3" y="5" width="4" height="14" rx="1"/><rect x="17" y="5" width="4" height="14" rx="1"/>',
  c_station: '<path d="M3 20v-9c4-4 14-4 18 0v9H3ZM3 15c4-3 14-3 18 0M12 3v5M12 3h6l-2 3h-4M8 16v4M16 16v4"/>',
  rest: '<path d="m2 11 10-8 10 8M5 9v12h14V9M9 21v-7h6v7"/>',
  fortune: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2H3v16h2m7-10 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>',
  // 東京の池の弁天堂（IR26。id は仮置きの神社の時のまま）: 水の上のお堂。店の印にしない
  ch3_tokyo_shrine: POND_HALL, ch5_tokyo_shrine: POND_HALL,
};
function pinSymbol(s) {
  return el("span.pin-symbol", { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PIN_SYMBOLS[s.id] || PIN_SYMBOLS.store}</svg>` });
}
// 看板の下の札は名前だけ（「〜へ行く」は出さない。ロゴと札を含むピン全体が押せる・#2853）。読み上げには行き先として伝える。
function pinCaption(s, locked) {
  if (locked) return "？？？";
  if (!knowsOwner(s) && s.unknownLabel) return s.unknownLabel;
  return s.label;
}
const pinSpeech = (s, locked, caption) => !locked && caption === s.label && ["tonari", "rival", "shop", "samechan"].includes(s.kind) ? `${caption}へ行く` : caption;
/** 地図の利用料は「¥3,000」の短い印（読み上げは「利用料 3,000円」のまま・#2853） */
/** 定休日・臨時休業は文字の札ではなく、看板をグレーにして「休」の印を付ける（#2853） */
const CLOSED_TAGS = new Set(["本日定休日", "本日臨時休業"]);
/** 「今日はどうする？」の操作の説明を出すのは、第1章の最初の自由行動の日（1日目は案内つきの用事だけ）まで。日付を読むだけ（#2853） */
const firstFreeDay = () => state.chapter === 1 && state.day <= 2;

let interrupt = null;
let warmImage = null;
let lessonMap = null;
export const activeMapLessons = () => lessonMap?.active() ? lessonMap : null;

function timeTag(s) {
  if (s.boardOnly) return "盤は時間消費なし";
  if (s.id === "shop" && s.kind === "shop") return "1階は時間消費なし";
  return s.noTime || s.reflect || s.kind === "fortune" || s.kind === "shop" ? "時間消費なし" : "";
}
function freshnessTag(s) {
  if (!growthEnabled()) return null;
  const key = s.freshnessKey || (s.kind === "rival" || s.kind === "samechan" ? s.charId || "samechan"
    : s.kind === "spot" || s.kind === "axe" ? s.id : null);
  if (!key) return null;
  const { count, rate } = nextFreshness(key);
  const stage = !count ? "はじめて" : rate === 1 ? "通常" : "なじみ";
  return ["mi-freshness", `${stage}・行動EXP ${Math.round(rate * 100)}%`, "map-freshness"];
}
/** ピン地図・街歩きに共通する、未決定の行き先選択状態。 */
/**
 * その行き先で心得の盤の授業を相談できる相手（SBD141）。相談が始まる処理（calendar.js・ch2-preparation.js・ch5-shops.js・ch5-dubai.js）と同じ人を返す:
 * 第5章の通い店は talkWith、ドバイの屋敷などは teacher、ライバルの店は charId、SHISHARK はサメちゃん、tonari はスミさん（バイト上がり）とつむぎ（客席）、
 * 第1・2章の Dr.fookah は2階の凛想。ひよりは店に居合わせた時だけなので、ピンには出さない
 */
export function spotTeachers(s, chapter = state?.chapter) {
  if (!s) return [];
  if (s.talkWith || s.teacher) return [s.talkWith || s.teacher];
  if (s.kind === "rival" && s.charId) return [s.charId];
  if (s.kind === "samechan") return ["samechan"];
  if (s.kind === "tonari") return ["sumi", "tsumugi"];
  if (s.id === "shop" && s.kind === "shop" && chapter <= 2) return ["rio"];
  return [];
}
/** その行き先で今相談できる授業（灯してあって、♥も届いていて、まだ習っていない） */
export const spotLessons = (s) => growthEnabled() ? spotTeachers(s).flatMap((who) => readyLessons(who)) : [];

export const isChoosingDestination = () => !!document.querySelector("#screen [data-destination-selection]:not(.done)");
/** 表示中のマップを外から閉じる（LIME で誘いに乗ったときなど）。マップが無ければ何もしない */
export function interruptMap(value) {
  if (!interrupt) return false;
  interrupt(value);
  return true;
}

const regionOf = (opts) => opts.regions?.find(region => region.id === opts.regionId) || opts.regions?.[0];
const backgroundOf = (region) => typeof region?.background === "function" ? region.background() : region?.background;

/**
 * @param opts.notice   上部に出す一言（「今夜は約束がある」など）
 * @param opts.reminder 右下の「今日はどうする？」に添える一言（心得の盤の組み直しの期限など。ピンに重ならない所に出す）
 * @param opts.eventPin 今夜イベントがある場所のピン id（! バッジ）
 * @param opts.eventPinLabel 今夜の予定を文字で示す場合の札（任意の新着印と区別する）
 * @param opts.guide    { pin, title, text, free } 1日目の案内・配達用。その1か所だけ選べるようにして光らせる。
 *                      free（表示する一言）があれば、その行き先は代金がかからない
 * @param opts.onShown  マップと解禁の余韻を出し終えたとき（LIME の初回案内など）
 * @param opts.onStationDeparture 運賃の確定後、出発時に読む章固有の場面
 * @param opts.onBeforeGo (spot) => boolean | Promise<boolean>。false ならマップを開いたまま移動を中止する。
 * 戻り値: スポットID。interruptMap(v) で外から閉じたときは v
 */
export async function chooseSpot(opts = {}) {
  // 初回だけ: 看板の顔とスロットの図柄が読めてから地図を出す（遅い回線でも最大2秒・GUI20・21）
  const url = backgroundOf(regionOf(opts)) || bgUrl(`bg_osu_map_${timeOfDay()}`);
  const backdrop = setBg(url, { fast: true, brief: true, mapBackdrop: true });
  const ready = () => Promise.all([uiArtReady(), storeLogosReady(), imageReady(FACILITY_SHEET, 2000, { keep: true }), backdrop]);
  // プレイヤーの既定では、0.5秒を超えた待ちに作業台と同じ漫画つきのロード画面を出す（core/ui.js の loadingNotice）。
  if (comicLoadingRequired()) {
    await withLoadingNotice(ready(), loadingNotice("マップを準備しています…"));
    return await openMap(opts, url, backdrop);
  }
  let notice = null;
  const timer = setTimeout(() => {
    notice = el("div.vn-loading", { role: "status", text: "マップを準備しています…" });
    layers.fx.append(notice);
  }, 500);
  try {
    await ready();
  } finally { clearTimeout(timer); notice?.remove(); }
  return await openMap(opts, url, backdrop);
}

/** 行き先の場面を「移動」の幕で開く。押したピンの位置と、看板に出ている行き先の名前を渡す（core/transition-moves.js） */
function cueMove(shield, spot) {
  const stage = document.getElementById("stage");
  if (!shield || !stage) return;
  const s = stage.getBoundingClientRect();
  const p = shield.getBoundingClientRect();
  if (!s.width || !s.height) return;
  const known = knowsOwner(spot);
  cueTransition("place", {
    spotId: spot.id,
    x: (p.left + p.width / 2 - s.left) * (1280 / s.width),
    y: (p.top + p.height / 2 - s.top) * (720 / s.height),
    label: known ? spot.label : spot.unknownLabel || spot.label,
    area: spot.area || "",
    glyph: known ? spot.glyph || "" : "？",
    // 名前を伏せた行き先（会う前のクラブSEAM＝「地下の店」）では、到着時に店のロゴを見せない。
    anonymous: !known && !!spot.unknownLabel,
  });
}

/** ワイドステージ（#2861）: 街の絵と施設のピンを同じ倍率（ステージ幅 / 1280）で横いっぱいに拡大する（base.css）。
 *  拡大した絵は上下に1割ほどはみ出すので、上から切る量 --map-crop を「どのピンも頭（看板・顔）から先まで画面に入る」範囲で、
 *  できるだけ上下均等に決める（地図ごとにピンの高さの範囲が違う。第4章の砂漠の「砂丘」は y=92%）。
 *  ノッチ（safe-area）にかかる端のピンは、その分だけ内側へ寄せる（--pin-nudge-x）。PC の 16:9 では何もしない。 */
const MAP_TOP_SAFE = 40, MAP_BOTTOM_SAFE = 8, MAP_SIDE_SAFE = 8;
function fitMapCrop(pins) {
  const stage = document.getElementById?.("stage");
  if (!stage?.style?.setProperty || !pins?.isConnected || typeof pins.getBoundingClientRect !== "function") return;
  const width = parseFloat(stage.style.getPropertyValue("--stage-w")) || 1280;
  const height = width * 9 / 16, overflow = height - 720;
  const all = [...pins.querySelectorAll(".spot-pin")];
  for (const pin of all) pin.style.removeProperty?.("--pin-nudge-x");
  if (overflow <= 0) { stage.style.removeProperty?.("--map-crop"); return; }
  const box = pins.getBoundingClientRect();
  if (!box.height) return;
  const unit = box.height / height; // 画面 px ÷ ステージ px
  const probe = el("div", { style: { position: "absolute", left: "0", top: "0", height: "0", width: "var(--stage-safe-l, 0px)", visibility: "hidden" } });
  stage.append(probe);
  const safeL = probe.getBoundingClientRect().width / unit;
  probe.style.width = "var(--stage-safe-r, 0px)";
  const safeR = probe.getBoundingClientRect().width / unit;
  probe.remove();
  let lo = 0, hi = overflow;
  for (const pin of all) {
    const r = pin.getBoundingClientRect();
    if (!r.height) continue;
    const y = parseFloat(pin.style.top) / 100;
    const anchor = box.top + y * box.height;
    hi = Math.min(hi, y * height - (anchor - r.top) / unit - MAP_TOP_SAFE);
    lo = Math.max(lo, y * height + (r.bottom - anchor) / unit - (720 - MAP_BOTTOM_SAFE));
    const left = (r.left - box.left) / unit, right = (r.right - box.left) / unit;
    const nudge = Math.max(0, safeL + MAP_SIDE_SAFE - left) || Math.min(0, width - safeR - MAP_SIDE_SAFE - right);
    if (nudge) pin.style.setProperty("--pin-nudge-x", `${Math.round(nudge)}px`);
  }
  const crop = lo > hi ? Math.min(overflow, Math.max(0, (lo + hi) / 2)) : Math.min(Math.max(overflow / 2, lo), hi);
  stage.style.setProperty("--map-crop", `${Math.round(crop)}px`);
}

function openMap({ notice = "", reminder = "", eventPin = null, eventPinLabel = "", guide = null, onShown = null, onBeforeGo = null, visitBlock = null, regions = null, regionId = null, onRegionChange = null, onStationDeparture = null }, initialUrl, initialBackdrop) {
  return new Promise((resolve) => {
    const night = timeOfDay() === "night";
    const tod = night ? "night" : "day";
    let region = regionOf({ regions, regionId });
    const mapSpots = () => region ? typeof region.spots === "function" ? region.spots() : region.spots : allSpots();
    updateHud();
    const info = el("div.map-info");
    const pins = el("div.map-pins");
    let selected = null;
    const owner = state;
    // Own the pending image by the mounted map and region, not by the shared background layer.
    // A late image after entering a shop, changing region, or loading another save has no authority to draw.
    let backdropRevision = 0;
    const message = el("span", { role: "status" });
    const retry = el("button", { type: "button", text: "地図を再読み込み", dataset: { test: "map-backdrop-retry" } });
    const mapStatus = el("div.map-backdrop-note", { hidden: true, dataset: { test: "map-backdrop-status" } }, [message, retry]);
    const recoverBackdrop = (url, task) => {
      const revision = ++backdropRevision;
      mapStatus.hidden = true;
      if (task.isShown?.() !== false) return;
      const active = () => revision === backdropRevision && state === owner && root.isConnected && !root.classList.contains("done");
      const failed = () => {
        message.textContent = "地図の背景を表示できません。";
        retry.hidden = !url;
      };
      const watch = async (transfer) => {
        message.textContent = "地図を読み込み中…";
        retry.hidden = true;
        if (!transfer || !await transfer) { if (active()) failed(); return; }
        if (!active()) return;
        const draw = setBg(url, { instant: true, mapBackdrop: true });
        await draw;
        if (!active()) return;
        if (draw.isShown()) mapStatus.hidden = true;
        else failed();
      };
      mapStatus.hidden = false;
      retry.onclick = () => { if (active() && !retry.hidden) void watch(imageReady(url, null)); };
      const pending = imageReady.pending(url);
      if (pending) void watch(pending);
      else failed();
    };
    const setMapBackground = async () => {
      ++backdropRevision;
      mapStatus.hidden = true;
      const url = backgroundOf(region) || bgUrl(`bg_osu_map_${tod}`);
      const task = setBg(url, { fast: true, mapBackdrop: true });
      await task;
      if (state === owner && root.isConnected && !root.classList.contains("done")) recoverBackdrop(url, task);
    };
    let stationTrip = null;
    let revealing = false;
    let stopReveal = () => {};
    const revealNotice = el("div.map-notice.map-unlock-notice", { role: "status" });
    const mapNotice = el("div.map-notice", { role: "status" });
    let mapShown = false, promptsShown = false;
    const showPrompts = () => {
      if (!mapShown || promptsShown || revealing || state !== owner || root.classList.contains("done")) return;
      promptsShown = true;
      mountReel(root); // 中断・旧保存に残った演出も解禁後に提示する。
      onShown?.();
    };

    const freeGuide = (s) => isFreeGuide(s, guide);
    const availability = (s) => spotAvailability(s, { guide, visitBlock });
    const spotPreview = (s) => {
      const previewId = s.preview || SPOT_PREVIEW[s.id];
      return s.previewUrl ? { url: s.previewUrl, tint: null } : previewId ? sceneBg(previewId, tod) : null;
    };
    let foregroundLoads = 0;
    let warmGeneration = 0;
    const foregroundWaiters = [];
    const wakeWarm = () => {
      while (foregroundWaiters.length) foregroundWaiters.shift()();
    };
    const waitForegroundIdle = () => foregroundLoads <= 0
      ? Promise.resolve()
      : new Promise((resolve) => foregroundWaiters.push(resolve));
    const beginForegroundLoad = () => { foregroundLoads++; };
    const endForegroundLoad = () => {
      foregroundLoads = Math.max(0, foregroundLoads - 1);
      if (foregroundLoads === 0) wakeWarm();
    };
    const startWarm = () => {
      const gen = ++warmGeneration;
      const warmRegion = region;
      const active = () => gen === warmGeneration && region === warmRegion && state === owner
        && root.isConnected && !root.classList.contains("done");
      const warm = async () => {
        if (!active()) return;
        // 行ける場所の写真から1枚ずつ準備し、閉店中の場所と立ち絵は後に回す（LD05・#3823）。
        const visible = mapSpots().filter((s) => spotVisible(s) && (s.kind !== "fortune" || fortuneToday()) && availability(s).why !== "locked");
        const available = [], unavailable = [];
        for (const s of visible) (availability(s).ok ? available : unavailable).push(s);
        const ordered = [...available, ...unavailable];
        const queue = [...new Set([
          ...ordered.flatMap((s) => sceneArtUrls(spotPreview(s)?.url)),
          ...ordered.map(spotPortrait).filter(Boolean),
        ])];
        for (const url of queue) {
          // 地域の切り替えやマップの開き直しでも、読み込み中の1枚を待つ。
          while (active() && (foregroundLoads > 0 || warmImage)) {
            await (foregroundLoads > 0 ? waitForegroundIdle() : warmImage);
          }
          if (!active()) break;
          if (imageReady.isReady?.(url)) continue;
          // タイムアウト後も通信は続くため、実際に読み込みが終わるまで次の画像は開始しない。
          warmImage = imageReady(url, null);
          await warmImage;
          warmImage = null;
        }
      };
      // 初回の表示・操作と同時に裏の読み込みを始めない。
      if (typeof requestIdleCallback === "function") requestIdleCallback(warm);
      else setTimeout(warm, 750);
    };

    // 残りの行動回数は HUD の札（☀残り2）へ移した。ここには明日の天気だけを添える（#2853）。
    const forecastFoot = () => tomorrowForecast() ? el("div.mi-foot", { text: `明日は${tomorrowForecast()}` }) : null;
    const clearSpotInfo = () => {
      info.classList.remove("spot-selected");
      info.removeAttribute("role");
      info.removeAttribute("tabindex");
      info.removeAttribute("aria-label");
      delete info.dataset.test;
      info.onclick = null;
      info.onkeydown = null;
    };
    const idleInfo = () => {
      clearSpotInfo();
      if (guide) {
        // GUIDE 中は右下の案内箱を出さない。天気予報は GUIDE 側に表示する。
        info.replaceChildren();
        return;
      }
      // 操作の説明は最初の日だけ。以後は期限の一言や明日の天気がある時だけ出す。
      info.replaceChildren(...[
        firstFreeDay() ? el("div.mi-banner", { text: "今日はどうする？" }) : null,
        firstFreeDay() ? el("p.mi-desc", [el("span", { text: "気になる場所をタップしよう。" }), el("br"), el("span", { text: "行動・所持金・体力に気をつけて。" })]) : null,
        reminder ? el("p.mi-reminder", { text: reminder, dataset: { test: "map-reminder" } }) : null,
        forecastFoot(),
      ].filter(Boolean));
    };

    const renderInfo = (s) => {
      const av = availability(s);
      const known = knowsOwner(s);
      const portrait = av.ok ? spotPortrait(s) : null;
      const label = av.why === "locked" ? "？？？" : known ? spotDetailLabel(s) : s.unknownLabel || s.label;
      const visitHint = av.ok && known && (hasChapterTwoVisitContinuation(s) ? "会話の続き" : s.visitHint);
      info.classList.add("spot-selected");
      info.setAttribute("role", "button");
      info.setAttribute("tabindex", "0");
      info.setAttribute("aria-label", `${label}${av.ok ? "へ行く" : `・${av.why}`}${visitHint ? `・${visitHint}` : ""}`);
      if (av.ok) info.dataset.test = "map-go";
      else delete info.dataset.test;
      info.onclick = () => go(s);
      info.onkeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        go(s);
      };
      const lessons = av.why === "locked" ? [] : spotLessons(s);
      const pv = av.why === "locked" ? null : spotPreview(s);
      const preview = pv?.url ? el("div.mi-preview", { dataset: { tint: pv.tint || "" } }) : null;
      if (preview) {
        const previewUrls = sceneArtUrls(pv.url);
        const allReady = previewUrls.length > 0 && previewUrls.every((url) => imageReady.isReady?.(url));
        if (allReady) {
          for (const url of previewUrls) void imageReady(url, 15000);
          renderSceneArt(preview, pv.url);
          if (portrait) void imageReady(portrait, 15000);
        } else {
          preview.classList.add("loading");
          preview.setAttribute("role", "status");
          preview.setAttribute("aria-label", `${label}の写真を読み込んでいます`);
          // 選択した場所の写真を最優先で届けるため、待機中は裏の先読みを一時停止し、人物の立ち絵も写真の後で読み始める。
          beginForegroundLoad();
          let settled = false;
          const finishForeground = () => {
            if (settled) return;
            settled = true;
            endForegroundLoad();
          };
          Promise.all(previewUrls.map((url) => imageReady(url, 15000))).then((loaded) => {
            finishForeground();
            if (portrait && info.contains(preview)) void imageReady(portrait, 15000);
            if (!info.contains(preview)) return;
            preview.classList.remove("loading");
            if (!loaded.every(Boolean)) {
              preview.replaceChildren();
              preview.setAttribute("aria-label", `${label}の写真を表示できませんでした`);
              return;
            }
            preview.replaceChildren();
            preview.removeAttribute("role");
            preview.removeAttribute("aria-label");
            renderSceneArt(preview, pv.url);
          }, finishForeground);
        }
      } else if (portrait) {
        void imageReady(portrait, 15000);
      }
      // 今は入れない行き先は、理由（本日定休日・夜から営業・今日はもう行った 等）を見える文字で添える（#3555。読み上げだけだった）。
      // 説明文は増やさず（#2853 の「店名と写真だけ」）、小さな札で見せる。入れる行き先は料金、入れない時はその理由。
      // 体力は数字で見せない（ゲージでなんとなく把握するゲーム性・MAP04）。料金はピンから外し、ここで見せる（MAP05）。
      // 授業を相談できる店は、その授業の名前を札で添える（SBD141）。入れない日も出す（明日以降に来ればよいと分かる）
      const lessonTag = lessons.length ? ["mi-lesson", `授業の相談「${lessons.map((l) => l.name).join("」「")}」`, "map-lesson"] : null;
      const visitTag = visitHint ? ["mi-visit-hint", visitHint, "map-visit-hint"] : null;
      const timing = timeTag(s);
      // 斧投げBarの料金の札は長いので、狭い時は「・」の後でだけ折る（スマホで右下の案内の幅を超えていた）。文の区切りごとに分けて渡す
      const useCost = s.playCost ? ["mi-cost", [`プレイ ${yen(s.playCost)}・`, "記録閲覧無料"], "map-cost"]
        : s.cost && !freeGuide(s) ? ["mi-cost", `料金 ${yen(s.cost)}`, "map-cost"] : null;
      const tags = av.why === "locked" ? [] : [
        av.ok ? visitTag : ["mi-why", av.why, "map-why"],
        av.ok || s.playCost ? useCost : null,
        timing ? ["mi-time", timing, "map-time-use"] : null,
        av.ok && !freeGuide(s) ? freshnessTag(s) : null,
        lessonTag,
      ].filter(Boolean);
      const tagRow = tags.length ? el("div.mi-tags", tags.map(([cls, text, test]) => Array.isArray(text)
        ? el(`span.mi-tag.${cls}.mi-tag-split`, { dataset: { test } }, text.map((part) => el("span.mi-tag-part", { text: part })))
        : el(`span.mi-tag.${cls}`, { text, dataset: { test } }))) : null;
      info.replaceChildren(...[
        el("div.mi-banner", { text: label }),
        tagRow,
        preview,
      ].filter(child => child != null));
    };

    const select = (s, btn) => {
      if (moving || revealing || root.classList.contains("done")) return;
      stationTrip?.cancel(); stationTrip = null;
      selected = s;
      pins.querySelectorAll(".spot-pin").forEach((p) => p.classList.toggle("sel", p === btn));
      SE.click();
      renderInfo(s);
    };

    let moving = false;
    const stationActive = () => state === owner && root.isConnected && !root.classList.contains("done") && !document.hidden;
    const openStation = () => {
      if (moving || revealing || !stationActive() || !stationDestinations(state, regions || [], region?.id).length) return;
      SE.click(); // ほかのピンと同じ押した音
      clearSpotInfo();
      stationTrip?.cancel(); stationTrip = null; selected = null;
      pins.querySelectorAll(".spot-pin").forEach(p => p.classList.remove("sel"));
      const cancel = () => { stationTrip?.cancel(); stationTrip = null; idleInfo(); };
      const destinations = stationDestinations(state, regions || [], region?.id);
      const choose = (item) => {
        if (moving || !stationActive()) return;
        stationTrip?.cancel();
        const trip = stationTrip = prepareStationTrip(state, regions, item.id);
        if (!trip) return;
        const depart = (walk) => async () => {
            if (moving || !stationActive()) return;
            moving = true; confirm.disabled = true; if (walkHome) walkHome.disabled = true;
            try {
              if (!trip.commit(state, { active: stationActive(), persist: save, walk })) {
                openStationAfterFailure(); return;
              }
              region = item; selected = null; root.dataset.region = item.id;
              onRegionChange?.(item.id);
              SE.select(); updateHud();
              if (onStationDeparture && !walk) {
                await onStationDeparture(trip);
                if (!stationActive()) return;
              }
              const arrive = () => stationArrival(trip, async () => {
                if (!stationActive()) return;
                await setMapBackground();
                if (!stationActive()) return;
                renderPins(); idleInfo(); startWarm();
                root.dataset.stationArrived = item.id;
              });
              // 徒歩は電車の演出を使わない。体力の減りはHUDと一言で伝える。
              if (walk) { await arrive(); toast(`歩いて${item.label}へ帰った。かなり疲れた`); }
              else await trainRide(arrive, { from: trip.from, to: trip.to });
              if (!stationActive()) return;
            } finally { moving = false; }
          };
        const shortOnFare = state.money < trip.required;
        const confirm = el("button.mi-go", { type: "button", text: `${yen(trip.fare)}で移動する`,
          dataset: { test: "station-confirm" }, disabled: shortOnFare, onclick: depart(false) });
        const walkHome = trip.walkable() ? el("button.mi-go", { type: "button", text: "歩いて帰る（かなり疲れる）",
          dataset: { test: "station-walk" }, onclick: depart(true) }) : null;
        const fareNote = trip.required > trip.fare
          ? ` ／ 帰りも${yen(trip.required - trip.fare)}必要${shortOnFare ? "（往復分が不足）" : ""}`
          : "";
        info.replaceChildren(...[el("div.mi-banner", { text: walkHome ? "帰り道" : "乗車の確認" }),
          el("p.mi-desc", { text: `${region.label} → ${item.label} ／ 片道 ${yen(trip.fare)}` }),
          el("p", { text: `所持金 ${yen(state.money)}${fareNote}` }),
          walkHome ? el("p.mi-desc", { text: "電車に乗れないので、歩いて帰れる。お金は使わず、かなり疲れる。時間は進まない。" }) : null,
          walkHome || confirm, el("button.mi-go.mi-go-alt", { type: "button", text: "キャンセル", dataset: { test: "station-cancel" }, onclick: cancel })].filter(Boolean));
      };
      const openStationAfterFailure = () => {
        info.replaceChildren(el("p.mi-desc", { text: "移動できませんでした。運賃は使っていません。駅から選び直してください。" }),
          el("button.mi-go", { text: "戻る", onclick: cancel }));
      };
      if (!destinations.length) {
        info.replaceChildren(el("div.mi-banner", { text: "駅" }),
          el("p.mi-desc", { text: "今日はこの街で過ごそう。街へ出かける用事ができたら、ここから電車に乗れる。" }));
        return;
      }
      info.replaceChildren(el("div.mi-banner", { text: "駅・行き先を選ぶ" }),
        el("p.mi-desc", { text: `現在地 ${region?.label || ""} ／ どこへでも一律 片道${yen(STATION_FARE)} ／ 時間・行動消費なし` }),
        ...destinations.map(item => el("button.mi-go", { type: "button", text: `${item.label} ／ ${yen(STATION_FARE)}`,
          dataset: { test: `station-destination-${item.id}` }, onclick: () => choose(item) })),
        el("button.mi-go.mi-go-alt", { type: "button", text: "キャンセル", dataset: { test: "station-cancel" }, onclick: cancel }));
    };
    const go = async (s, mode = null) => {
      if (moving || revealing || root.classList.contains("done")) return;
      if (!availability(s).ok) { renderInfo(s); return; }
      moving = true;
      try {
        // 移動演出・行動消費より前に、当該スポット固有の確認を行う。
        if (onBeforeGo && !(await onBeforeGo(s))) return;
        if (root.classList.contains("done")) return;
        if (!availability(s).ok) { renderInfo(s); return; }
        SE.select();
        stationTrip?.cancel(); stationTrip = null;
        cueMove(pins.querySelector(`[data-spot="${s.id}"] .shield`), s);
        warmGeneration++;
        wakeWarm();
        stopReveal();
        retire(root);
        info.classList.add("leaving");
        interrupt = null;
        resolve(mode ? `${s.id}:${mode}` : s.id);
      } finally {
        moving = false;
      }
    };

    function renderPins() {
      stopReveal();
      pins.replaceChildren();
      const freshPins = [];
      const spots = mapSpots().filter(s => spotVisible(s) && (s.kind !== "fortune" || fortuneToday()));
      const fortune = guide ? null : spots.find(s => s.kind === "fortune");
      mapNotice.textContent = [notice, fortune ? `辻占のオババが${fortune.area}に来ている。` : ""].filter(Boolean).join(" ／ ");
      mapNotice.dataset.test = fortune ? "map-fortune-notice" : "";
      const reveals = newlyRevealedSpots(state, region?.id || "osu", spots.map(s => ({
        id: s.id, revealed: isUnlocked(s) && !(!knowsOwner(s) && s.unknownLabel),
      })));
      for (const s of spots) {
      const av = availability(s);
      const locked = av.why === "locked";
      const known = knowsOwner(s);
      const people = locked ? [] : spotPeople(s, { visitBlock });
      // facilityIcon: false の行き先は、同じ id でも今の段階では絵を出さない（ラクダレースの「Dr.fookah の店先」）。
      const facility = !(s.id === "trpg_bar" && hasStoreLogo(s.id)) && !locked && !(!known && s.unknownLabel) && s.facilityIcon !== false ? createMapFacilityIcon(s.id) : null;
      const logo = !facility && !locked && !(!known && s.unknownLabel) && hasStoreLogo(s.id) ? storeLogo(s.id, { width: 82, height: 46 }) : null;
      const hidane = s.boardOnly && growthEnabled() ? hidaneTotal() : 0;
      // 灯した授業を相談できる店（SBD141）: 看板の左に「相談」の吹き出し。右上の「!」・火種の数、上の顔とは別の場所に置く
      const lessons = locked ? [] : spotLessons(s);
      const lessonMark = lessons.length ? el("i.lesson-badge", { text: "相談", dataset: { test: `map-lesson-${s.id}` } }) : null;
      const eventLabel = !locked && eventPin === s.id ? eventPinLabel : "";
      const timing = locked ? "" : timeTag(s);
      const status = [eventLabel, av.tag || timing].filter(Boolean).join("・");
      const badge = locked || eventLabel ? null
        : hidane > 0 ? el("i.evt-badge.hidane-badge", { text: String(Math.min(99, hidane)), "aria-label": `火種 ${hidane}・内省で灯せる`, dataset: { test: "kannon-hidane" } })
        : eventPin === s.id || guide?.pin === s.id ? el("i.evt-badge", { text: "!" })
        : known && av.ok && hasNewEvent(s) ? el("i.evt-badge.story", { text: "!", "aria-label": "新しいイベント" })
        : null;
      const caption = pinCaption(s, locked);
      const closed = CLOSED_TAGS.has(av.tag);
      const guideCls = guide ? (guide.pin === s.id ? ".guide" : ".guided-off") : "";
      const btn = el(`button.spot-pin.pin-${locked ? "locked" : s.theme}${av.ok || av.guided ? "" : ".off"}${guideCls}${logo ? ".branded" : ""}${hasFacilityIcon(s.id) && s.facilityIcon !== false && !logo ? ".facility-location" : ""}${facility ? ".facility-pin" : ""}${closed ? ".closed" : ""}`, {
        style: { left: `${s.x}%`, top: `${s.y}%` },
        dataset: { test: `pin-${s.id}`, spot: s.id },
        "aria-label": `${pinSpeech(s, locked, caption)}${s.playCost ? `・プレイ ${yen(s.playCost)}・記録閲覧無料` : s.cost && !freeGuide(s) ? `・利用料 ${yen(s.cost)}` : ""}${status ? `（${status}）` : ""}${hidane > 0 ? `・火種 ${hidane}・内省で灯せる` : badge ? "・新しいイベント" : ""}${people.length ? `・在店：${people.map(p => p.name).join("、")}` : ""}${lessons.length ? `・授業「${lessons.map((l) => l.name).join("」「")}」を相談できる` : ""}`,
        onclick: () => (selected === s && av.ok ? go(s) : select(s, btn)),
      }, [
        el("div.pin-visual", [
          el("div.shield", [
            badge,
            lessonMark,
            el("div.ico", [facility || logo || (locked || !known && s.unknownLabel
              ? el("span", { text: "？" }) : pinSymbol(s))]),
          ]),
          peopleRow(people),
        ]),
        el("div.sub-label", { text: caption }),
        // 料金はピンに出さない（右下のプレビューの「料金」で確かめる・MAP05。読み上げの aria-label には残す）。
        // 休みの札は文字を残したまま、PC・スマホとも CSS で看板の角の「休」の印に置き換える（2画面表示は文字のまま）。
        status ? el(`small.pin-status${closed && !eventLabel ? ".pin-closed" : ""}`, { text: status, title: status }) : null,
      ]);
      if (facility) {
        const crop = facility.querySelector('.facility-icon-crop');
        btn.style.setProperty('--facility-art-width', crop.style.width);
        btn.style.setProperty('--facility-art-height', crop.style.height);
        for (const axis of ['x', 'y']) btn.style.setProperty(`--facility-badge-${axis}`, facility.style.getPropertyValue(`--facility-badge-${axis}`));
      }
      const revealIndex = reveals.indexOf(s.id);
      if (revealIndex >= 0) {
        btn.style.visibility = "hidden";
        freshPins.push({ btn, spot: s, index: revealIndex });
      }
      pins.append(btn);
      }
      if (!guide && stationDestinations(state, regions || [], region?.id).length) {
        const station = region?.id === "widehanga" ? { x: 15, y: 37 } : { x: 15, y: 36 };
        pins.append(el("button.spot-pin.pin-station", {
          type: "button", style: { left: `${station.x}%`, top: `${station.y}%` },
          dataset: { test: "station-open", spot: "station" },
          "aria-label": `駅から電車で街を移動する・どこへでも一律 片道${yen(STATION_FARE)}・時間消費なし`,
          onclick: openStation,
        }, [el("div.pin-visual", [el("div.shield", [el("div.ico", [el("span.pin-symbol", { html: TRAIN_ICON_SVG })])])]),
          el("div.sub-label", { text: `駅・一律${yen(STATION_FARE)}` }), el("small.pin-status", { text: "時間消費なし" })]));
      }
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => fitMapCrop(pins));
      if (freshPins.length) {
        revealing = true;
        root.dataset.revealing = "true";
        const clearReveal = () => {
          for (const { btn } of freshPins) {
            btn.style.visibility = "";
            btn.classList.remove("newly-revealed");
            btn.querySelectorAll(".pin-reveal-ring, .pin-reveal-label").forEach(node => node.remove());
          }
          revealNotice.textContent = "";
        };
        stopReveal = startSpotReveal({
          pop: () => {
            if (freshPins.length) SE.pon?.(); // 新しい店のピンが現れる
            for (const { btn, index } of freshPins) {
              btn.style.visibility = "";
              btn.classList.add("newly-revealed");
              btn.style.setProperty("--reveal-delay", `${Math.min(index * 90, 360)}ms`);
              btn.querySelector(".shield").append(el("span.pin-reveal-ring", { "aria-hidden": "true" }),
                el("span.pin-reveal-label", { text: "NEW", "aria-hidden": "true" }));
            }
            revealNotice.textContent = freshPins.map(({ spot }) => spotRevealNotice(spot, state)).join("。 ");
          },
          settle: () => {
            clearReveal();
            root.dataset.revealPhase = "pause";
          },
          done: ({ cancelled }) => {
            revealing = false;
            delete root.dataset.revealing;
            delete root.dataset.revealPhase;
            clearReveal();
            if (!cancelled) showPrompts();
          },
        });
      }

    }

    idleInfo();
    const rainy = isRainy();
    const root = el("div.map", { dataset: { night: String(night), rain: String(rainy), destinationSelection: "true" } }, [
      rainy ? el("div.map-weather") : null, // 雨の日のオーバーレイ（ピンより下・操作を邪魔しない）
      pins,
      mapNotice,
      revealNotice, mapStatus,
      guide ? el("div.map-guide", { dataset: { test: "map-guide" } }, [
        el("b", { text: "次にやること" }), el("span", { text: guide.text }),
        tomorrowForecast() ? el("span.map-guide-forecast", { text: `明日は${tomorrowForecast()}` }) : null,
      ]) : null,
      info,
    ]);
    if (region) root.dataset.region = region.id;
    const findPin = id => [...pins.children].find(pin => pin.dataset.spot === id);
    lessonMap = {
      active: () => state === owner && root.isConnected && !root.classList.contains("done"),
      visit(who) {
        const candidates = mapSpots().filter(s => (spotTeachers(s).includes(who) || who === "hiyori" && ["rival", "shop", "samechan"].includes(s.kind)
          && spotPeople(s, { visitBlock }).some(p => p.id === who)) && spotVisible(s))
          .map(s => {
            const av = availability(s);
            let why = av.ok ? "" : av.why;
            if (!why && s.kind === "tonari") {
              if (who === "sumi" && state.visitedDay.tonari_baito === state.day) why = "今日のシフトはもう終わった";
              if (who === "tsumugi") why = !tsumugiAtTonari(state) ? "つむぎは今は店にいない" : state.visitedDay.tonari_customer === state.day ? "今日はもう客席を利用した" : "";
            }
            if (!why && s.id === "shop" && who === "rio") why = rioUnavailable(state);
            const route = s.kind === "tonari" ? who === "sumi" ? "（シフト後）" : who === "tsumugi" ? "（客席）" : "" : "";
            return { name: s.label + route, why, focus: () => {
              const pin = findPin(s.id);
              const target = mapSpots().find(spot => spot.id === s.id);
              if (pin && target) { select(target, pin); pin.focus(); }
            } };
          });
        return candidates.find(candidate => !candidate.why) || candidates[0] || null;
      },
      refresh() {
        if (!this.active() || revealing) return;
        const id = selected?.id;
        const focused = id && document.activeElement === findPin(id);
        renderPins();
        if (!id) return;
        const spot = mapSpots().find(s => s.id === id);
        const pin = findPin(id);
        if (!spot || !pin) { selected = null; idleInfo(); return; }
        selected = spot;
        pin.classList.add("sel");
        renderInfo(spot);
        if (focused) pin.focus();
      },
    };
    renderPins();
    showScreen("map", root);
    recoverBackdrop(initialUrl, initialBackdrop);
    // ワイドステージでは絵とピンを横いっぱいに拡大し、上下の切り方をピンの位置から決める（画面の向き・大きさが変わったら決め直す）
    const refit = () => { if (!root.isConnected) { globalThis.removeEventListener?.("resize", refit); return; } fitMapCrop(pins); };
    globalThis.addEventListener?.("resize", refit);
    interrupt = (v) => { stationTrip?.cancel(); stationTrip = null; interrupt = null; warmGeneration++; wakeWarm(); stopReveal(); retire(root); resolve(v); };
    mapShown = true;
    showPrompts();
    startWarm();
  });
}
