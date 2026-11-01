// マップ画面。ピンを選んで「行く」を押すと、その行き先で解決する Promise を返す。
// 見た目は旧版を踏襲: 栄・大須の街マップ／看板型のピン（面識のある相手は顔ドット絵）／右下の墨×金パネル。
import { el, yen } from "../core/util.js";
import { bgUrl, sceneBg, faceIconUrl, displayName } from "../core/data.js";
import { showScreen, setBg, retire, uiArtReady, storeLogosReady, imageReady, layers, toast } from "../core/ui.js";
import { cueTransition } from "../core/transitions.js";
import { trainRide } from "../core/scene-motions.js";
import { TRAIN_ICON_SVG } from "../core/train-icon.js";
import { renderSceneArt, sceneArtUrls } from "../core/scene-art.js";
import { state, save, timeOfDay } from "../core/state.js";
import { growthEnabled, hidaneTotal } from "../core/growth.js";
import { SE } from "../core/audio.js";
import { STAMINA_LOW } from "../core/stats.js";
import { allSpots, SPOT_PREVIEW, isUnlocked, hasNewEvent, spotDetailLabel } from "./spots.js";
import { updateHud } from "./hud.js";
import { mountReel } from "./reel.js";
import { isRainy, tomorrowForecast } from "./weather.js";
import { fortuneToday } from "./fortune.js";
import { spotVisible, spotAvailability, freeGuide as isFreeGuide } from "./spot-access.js";
import { spotPeople } from "./spot-people.js";
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

// 施設は大きな記号、その下に名前。顔のある店は同じ場所に店主の顔を置く。
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
};
function pinSymbol(s) {
  return el("span.pin-symbol", { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PIN_SYMBOLS[s.id] || PIN_SYMBOLS.store}</svg>` });
}
function pinCaption(s, locked) {
  if (locked) return "？？？";
  if (!knowsOwner(s) && s.unknownLabel) return s.unknownLabel;
  return ["tonari", "rival", "shop", "samechan"].includes(s.kind) ? `${s.label}へ行く` : s.label;
}

let interrupt = null;
/** ピン地図・街歩きに共通する、未決定の行き先選択状態。 */
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
 * @param opts.eventPin 今夜イベントがある場所のピン id（! バッジ）
 * @param opts.guide    { pin, title, text, free } 1日目の案内・配達用。その1か所だけ選べるようにして光らせる。
 *                      free（表示する一言）があれば、その行き先は代金がかからない
 * @param opts.onShown  マップと解禁の余韻を出し終えたとき（LIME の初回案内など）
 * @param opts.onBeforeGo (spot) => boolean | Promise<boolean>。false ならマップを開いたまま移動を中止する。
 * 戻り値: スポットID。interruptMap(v) で外から閉じたときは v
 */
export async function chooseSpot(opts = {}) {
  // 初回だけ: 看板の顔とスロットの図柄が読めてから地図を出す（遅い回線でも最大2秒・GUI20・21）
  let notice = null;
  const timer = setTimeout(() => {
    notice = el("div.vn-loading", { role: "status", text: "マップを準備しています…" });
    layers.fx.append(notice);
  }, 500);
  try {
    await Promise.all([uiArtReady(), storeLogosReady(), imageReady(FACILITY_SHEET, 2000, { keep: true }), setBg(backgroundOf(regionOf(opts)) || bgUrl(`bg_osu_map_${timeOfDay()}`), { fast: true, brief: true })]);
  } finally { clearTimeout(timer); notice?.remove(); }
  return await openMap(opts);
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
  });
}

function openMap({ notice = "", eventPin = null, guide = null, onShown = null, onBeforeGo = null, visitBlock = null, regions = null, regionId = null, onRegionChange = null }) {
  return new Promise((resolve) => {
    const night = timeOfDay() === "night";
    const tod = night ? "night" : "day";
    let region = regionOf({ regions, regionId });
    const mapSpots = () => region ? typeof region.spots === "function" ? region.spots() : region.spots : allSpots();
    const setMapBackground = () => setBg(backgroundOf(region) || bgUrl(`bg_osu_map_${tod}`), { fast: true });
    void setMapBackground();
    updateHud();
    const info = el("div.map-info");
    const pins = el("div.map-pins");
    // DS風の上画面：街の全体図に行き先の点を打つ（表示だけ。操作は下画面のカード）。通常版ではCSSで出さない。
    const markers = el("div.ds-map-markers", { "aria-hidden": "true" });
    const markSelected = (id) => markers.querySelectorAll(".ds-map-marker").forEach(m => m.classList.toggle("sel", m.dataset.marker === id));
    let selected = null;
    const owner = state;
    let stationTrip = null;
    let revealing = false;
    let stopReveal = () => {};
    const revealNotice = el("div.map-notice.map-unlock-notice", { role: "status" });
    let mapShown = false, promptsShown = false;
    const showPrompts = () => {
      if (!mapShown || promptsShown || revealing || state !== owner || root.classList.contains("done")) return;
      promptsShown = true;
      mountReel(root); // 中断・旧保存に残った演出も解禁後に提示する。
      onShown?.();
    };

    const freeGuide = (s) => isFreeGuide(s, guide);
    const availability = (s) => spotAvailability(s, { guide, visitBlock });

    const movesLeft = () => (state.slot >= 1 ? "夜 ── 今日はあと1回動ける" : "昼 ── 今日はあと2回動ける")
      + (tomorrowForecast() ? ` ／ 明日は${tomorrowForecast()}` : "");
    const idleInfo = () => {
      if (guide) {
        info.replaceChildren(
          el("div.mi-banner", { text: guide.title || "スミさんの頼み" }),
          el("p.mi-desc", { text: guide.text }),
          el("div.mi-foot", { text: movesLeft() }),
        );
        return;
      }
      info.replaceChildren(
        el("div.mi-banner", { text: "今日はどうする？" }),
        el("p.mi-desc", [el("span", { text: "気になる場所をタップしよう。" }), el("br"), el("span", { text: "行動・所持金・体力に気をつけて。" })]),
        el("div.mi-foot", { text: movesLeft() }),
      );
    };

    const renderInfo = (s) => {
      const av = availability(s);
      if (av.why === "locked") {
        info.replaceChildren(
          el("div.mi-banner", { text: "？？？" }),
          el("p.mi-desc", { text: "まだ知らない場所。誰かと知り合えば、教えてもらえるかもしれない。" }),
          el("div.mi-foot", { text: movesLeft() }),
        );
        return;
      }
      const known = knowsOwner(s);
      const charName = s.charId && known ? displayName(s.charId, state) : null;
      const warn = s.stamina < 0 && state.stamina + s.stamina < STAMINA_LOW;
      const previewId = s.preview || SPOT_PREVIEW[s.id];
      const pv = s.previewUrl ? { url: s.previewUrl, tint: null } : previewId ? sceneBg(previewId, tod) : null;
      const preview = pv?.url ? el("div.mi-preview", { dataset: { tint: pv.tint || "" } }) : null;
      if (preview) {
        preview.classList.add("loading");
        preview.setAttribute("role", "status");
        preview.textContent = "画像を読み込んでいます…";
        Promise.all(sceneArtUrls(pv.url).map((url) => imageReady(url, 15000))).then((loaded) => {
          if (!info.contains(preview)) return;
          preview.classList.remove("loading");
          if (!loaded.every(Boolean)) {
            preview.textContent = `${s.label} — ${s.area || "行き先"}`;
            preview.setAttribute("aria-label", `${s.label}の案内。詳細と入店条件は下に表示しています`);
            return;
          }
          preview.replaceChildren();
          preview.removeAttribute("role");
          renderSceneArt(preview, pv.url);
        });
      }
      // 料金や注意はタグに並べず、行くボタンの右に一言だけ添える（DUI16）。
      const note = s.id === "choizap" && !state.flags?._gym_member ? `初回 入会費${yen(4000)}`
        : s.playCost ? `プレイ ${yen(s.playCost)}` : s.cost && !freeGuide(s) ? yen(s.cost)
        : freeGuide(s) ? guide.free : s.kind === "trpg" ? "入店・部活設立は無料"
        : s.kind === "shop" || s.kind === "fortune" ? "時間を使わない" : s.kind === "rest" ? "" : "無料";
      info.replaceChildren(...[
        el("div.mi-banner", { text: known ? spotDetailLabel(s) : s.unknownLabel || s.label }),
        preview,
        charName ? el("div.mi-area", { text: charName }) : null,
        el("p.mi-desc", { text: av.desc || (known ? s.desc : s.unknownDesc || s.desc) }),
        av.ok
          ? el("button.mi-go", { dataset: { test: "map-go" }, onclick: () => go(s) }, [el("span", { text: s.kind === "rest" ? "家に帰る" : "ここへ行く" }),
            note || warn ? el(`small.mi-note${warn ? ".warn" : ""}`, { text: [note, warn ? "体力が心配" : ""].filter(Boolean).join("・"), dataset: { test: "spot-note" } }) : null])
          : el("div.mi-no", { text: av.why }),
      ].filter(child => child != null));
    };

    const select = (s, btn) => {
      if (moving || revealing || root.classList.contains("done")) return;
      stationTrip?.cancel(); stationTrip = null;
      selected = s;
      pins.querySelectorAll(".spot-pin").forEach((p) => p.classList.toggle("sel", p === btn));
      markSelected(s.id);
      SE.click();
      renderInfo(s);
    };

    let moving = false;
    const stationActive = () => state === owner && root.isConnected && !root.classList.contains("done") && !document.hidden;
    const openStation = () => {
      if (moving || revealing || !stationActive() || !stationDestinations(state, regions || [], region?.id).length) return;
      stationTrip?.cancel(); stationTrip = null; selected = null;
      pins.querySelectorAll(".spot-pin").forEach(p => p.classList.remove("sel"));
      markSelected(null);
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
              const arrive = () => stationArrival(trip, async () => {
                if (!stationActive()) return;
                await setMapBackground();
                if (!stationActive()) return;
                renderPins(); idleInfo();
                root.dataset.stationArrived = item.id;
              });
              // 徒歩は電車の演出を使わない。体力の減りはHUDと一言で伝える。
              if (walk) { await arrive(); toast(`歩いて${item.label}へ帰った。かなり疲れた`); }
              else await trainRide(arrive, { from: trip.from, to: trip.to });
              if (!stationActive()) return;
              // 短いDS縦画面では駅の確認ボタンに合わせて外側がスクロールする。
              // 到着後は新しい街の上画面（HUDと地図）から見せる。
              if (document.body.classList.contains("game-ds")) root.closest("#viewport")?.scrollTo(0, 0);
            } finally { moving = false; }
          };
        const confirm = el("button.mi-go", { type: "button", text: `${yen(trip.fare)}で移動する`,
          dataset: { test: "station-confirm" }, disabled: state.money < trip.required, onclick: depart(false) });
        const walkHome = trip.walkable() ? el("button.mi-go", { type: "button", text: "歩いて帰る（かなり疲れる）",
          dataset: { test: "station-walk" }, onclick: depart(true) }) : null;
        info.replaceChildren(el("div.mi-banner", { text: walkHome ? "帰り道" : "乗車の確認" }),
          el("p.mi-desc", { text: `${region.label} → ${item.label} ／ 片道 ${yen(trip.fare)}` }),
          el("p", { text: `所持金 ${yen(state.money)}${state.money < trip.required ? " ／ 帰りの切符代も残す必要があります" : ""}` }),
          walkHome ? el("p.mi-desc", { text: "電車に乗れないので、歩いて帰れる。お金は使わず、かなり疲れる。時間は進まない。" }) : null,
          walkHome || confirm, el("button.mi-go.mi-go-alt", { type: "button", text: "キャンセル", dataset: { test: "station-cancel" }, onclick: cancel }));
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
        el("p.mi-desc", { text: `現在地 ${region?.label || ""} ／ 片道 ${yen(STATION_FARE)} ／ 時間・行動消費なし` }),
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
      markers.replaceChildren();
      const freshPins = [];
      const spots = mapSpots().filter(s => spotVisible(s) && (s.kind !== "fortune" || fortuneToday()));
      const reveals = newlyRevealedSpots(state, region?.id || "osu", spots.map(s => ({
        id: s.id, revealed: isUnlocked(s) && !(!knowsOwner(s) && s.unknownLabel),
      })));
      for (const s of spots) {
      const av = availability(s);
      const locked = av.why === "locked";
      const known = knowsOwner(s);
      const people = locked ? [] : spotPeople(s, { visitBlock });
      const facility = !(s.id === "trpg_bar" && hasStoreLogo(s.id)) && !locked && !(!known && s.unknownLabel) ? createMapFacilityIcon(s.id) : null;
      const logo = !facility && !locked && !(!known && s.unknownLabel) && hasStoreLogo(s.id) ? storeLogo(s.id, { width: 82, height: 46 }) : null;
      const hidane = s.id === "kannon" && growthEnabled() ? hidaneTotal() : 0;
      const badge = locked ? null
        : hidane > 0 ? el("i.evt-badge.hidane-badge", { text: String(Math.min(99, hidane)), "aria-label": `火種 ${hidane}・内省で灯せる`, dataset: { test: "kannon-hidane" } })
        : eventPin === s.id || guide?.pin === s.id ? el("i.evt-badge", { text: "!" })
        : known && av.ok && hasNewEvent(s) ? el("i.evt-badge.story", { text: "!", "aria-label": "新しいイベント" })
        : null;
      const caption = pinCaption(s, locked);
      const guideCls = guide ? (guide.pin === s.id ? ".guide" : ".guided-off") : "";
      const btn = el(`button.spot-pin.pin-${locked ? "locked" : s.theme}${av.ok || av.guided ? "" : ".off"}${guideCls}${logo ? ".branded" : ""}${hasFacilityIcon(s.id) && !logo ? ".facility-location" : ""}${facility ? ".facility-pin" : ""}`, {
        style: { left: `${s.x}%`, top: `${s.y}%` },
        dataset: { test: `pin-${s.id}`, spot: s.id },
        "aria-label": `${caption}${av.tag ? `（${av.tag}）` : ""}${hidane > 0 ? `・火種 ${hidane}・内省で灯せる` : badge ? "・新しいイベント" : ""}${people.length ? `・在店：${people.map(p => p.name).join("、")}` : ""}`,
        onclick: () => (selected === s && av.ok ? go(s) : select(s, btn)),
      }, [
        el("div.pin-visual", [
          el("div.shield", [
            badge,
            el("div.ico", [facility || logo || (locked || !known && s.unknownLabel
              ? el("span", { text: "？" }) : pinSymbol(s))]),
          ]),
          peopleRow(people),
        ]),
        el("div.sub-label", { text: caption }),
        av.tag ? el("small.pin-status", { text: av.tag }) : null,
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
      markers.append(el("i.ds-map-marker", { className: `ds-map-marker${av.ok || av.guided ? "" : " off"}${selected?.id === s.id ? " sel" : ""}`,
        dataset: { marker: s.id, label: caption }, style: { left: `${s.x}%`, top: `${s.y}%` } }));
      }
      if (!guide && stationDestinations(state, regions || [], region?.id).length) {
        const station = region?.id === "widehanga" ? { x: 15, y: 37 } : { x: 15, y: 36 };
        pins.append(el("button.spot-pin.pin-station", {
          type: "button", style: { left: `${station.x}%`, top: `${station.y}%` },
          dataset: { test: "station-open", spot: "station" },
          "aria-label": "駅から電車で街を移動する",
          onclick: openStation,
        }, [el("div.pin-visual", [el("div.shield", [el("div.ico", [el("span.pin-symbol", { html: TRAIN_ICON_SVG })])])]),
          el("div.sub-label", { text: "駅" })]));
        markers.append(el("i.ds-map-marker", { dataset: { marker: "station", label: "駅" },
          style: { left: `${station.x}%`, top: `${station.y}%` } }));
      }
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
      markers,
      pins,
      notice ? el("div.map-notice", { text: notice }) : null,
      revealNotice,
      guide ? el("div.map-guide", { dataset: { test: "map-guide" } }, [el("b", { text: "GUIDE" }), el("span", { text: guide.text })]) : null,
      info,
    ]);
    if (region) root.dataset.region = region.id;
    renderPins();
    showScreen("map", root);
    interrupt = (v) => { stationTrip?.cancel(); stationTrip = null; interrupt = null; stopReveal(); retire(root); resolve(v); };
    mapShown = true;
    showPrompts();
    // 今行ける場所だけを2通信ずつ準備。マップ表示やボタン操作は待たせない。
    const previews = [...new Set(mapSpots().filter(isUnlocked)
      .flatMap((spot) => sceneArtUrls(spot.previewUrl || sceneBg(spot.preview || SPOT_PREVIEW[spot.id], tod).url)))];
    let at = 0;
    const warm = async () => {
      while (root.isConnected && !root.classList.contains("done") && at < previews.length) {
        await imageReady(previews[at++], 8000);
      }
    };
    void Promise.all([warm(), warm()]);
  });
}
