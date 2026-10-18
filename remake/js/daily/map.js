// マップ画面。ピンを選んで「行く」を押すと、その行き先で解決する Promise を返す。
// 見た目は旧版を踏襲: 栄・大須の街マップ／看板型のピン（面識のある相手は顔ドット絵）／右下の墨×金パネル。
import { el, yen } from "../core/util.js";
import { bgUrl, sceneBg, faceIconUrl, displayName } from "../core/data.js";
import { showScreen, setBg, retire, uiArtReady, imageReady, layers } from "../core/ui.js";
import { cueTransition } from "../core/transitions.js";
import { renderSceneArt, sceneArtUrls } from "../core/scene-art.js";
import { state, timeOfDay } from "../core/state.js";
import { SE } from "../core/audio.js";
import { actionPreview, previewCard } from "./action-preview.js";
import { todayPlan } from "./day-plan.js";
import { createFacilityIcon } from "./map-stickers.js";
import { storeInvitationSpot } from "./invitations.js";
import { allSpots, SPOT_PREVIEW, isUnlocked, hasNewEvent } from "./spots.js";
import { updateHud } from "./hud.js";
import { mountReel } from "./reel.js";
import { isRainy } from "./weather.js";
import { fortuneToday } from "./fortune.js";
import { spotAvailability, freeGuide as isFreeGuide } from "./spot-access.js";
import { spotTimeNote } from "./spot-hours.js";
import { openStreet, canWalkStreet, WALK_STREET, BACK_TO_MAP } from "./street.js";
import { spotPeople } from "./spot-people.js";
import { hasStoreLogo, storeLogo } from "../core/store-logos.js";

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
let requestedSpot = null;
let lastView = null;
const FACILITIES = { kannon: "kannondo", rest: "home", cafe: "kohaku", choizap: "choizap" };
/** 手帳から場所を選択するだけ。行動は確定しない。 */
export function locateMapSpot(id) {
  const pin = document.querySelector(`#screen .map:not(.done) [data-spot="${id}"]`);
  if (pin) { pin.hidden = false; pin.click(); pin.scrollIntoView({ block: "nearest" }); return true; }
  requestedSpot = id;
  return interruptMap("__locate__");
}
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
 * @param opts.onShown  マップを出し終えたとき（LIME の初回案内など）
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
    await Promise.all([uiArtReady(), setBg(backgroundOf(regionOf(opts)) || bgUrl(`bg_osu_map_${timeOfDay()}`), { fast: true, brief: true })]);
  } finally { clearTimeout(timer); notice?.remove(); }
  let walking = false;
  for (;;) {
    const value = walking ? await openStreet(opts, (handler) => { interrupt = handler; }) : await openMap(opts);
    if (value === WALK_STREET) { walking = true; continue; }
    if (value === BACK_TO_MAP) { walking = false; continue; }
    return value;
  }
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

function openMap({ notice = "", eventPin = null, guide = null, onShown = null, onBeforeGo = null, regions = null, regionId = null, onRegionChange = null, schedule = [] }) {
  return new Promise((resolve) => {
    const night = timeOfDay() === "night";
    const tod = night ? "night" : "day";
    let region = regionOf({ regions, regionId });
    if (requestedSpot && regions) {
      const destination = regions.find(r => (typeof r.spots === "function" ? r.spots() : r.spots).some(s => s.id === requestedSpot));
      if (destination) { region = destination; onRegionChange?.(region.id); }
    }
    let view = lastView || (window.matchMedia("(max-width: 1000px), (max-height: 600px)").matches ? "list" : "map");
    const invite = state.pendingInvite;
    const bookedPin = invite && (invite.day ?? state.day) === state.day
      ? invite.visitSpot || storeInvitationSpot({ accept_event: invite.event })
        || (["__sumi_baito__", "hiyori_tonari_return"].includes(invite.event) ? "tonari" : null) : null;
    const mapSpots = () => region ? typeof region.spots === "function" ? region.spots() : region.spots : allSpots();
    const setMapBackground = () => setBg(backgroundOf(region) || bgUrl(`bg_osu_map_${tod}`), { fast: true });
    void setMapBackground();
    updateHud();
    const info = el("div.map-info");
    const pins = el("div.map-pins");
    let selected = null;

    const freeGuide = (s) => isFreeGuide(s, guide);
    const availability = (s) => spotAvailability(s, { guide });

    const movesLeft = () => `${state.slot >= 1 ? "夜" : "昼"} ── 自由に選べる行動はあと${todayPlan(schedule).free}回`;
    const idleInfo = () => {
      info.dataset.empty = "true";
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
      info.dataset.empty = "false";
      const av = availability(s);
      const closeInfo = () => {
        selected = null; root.dataset.selected = "false";
        pins.querySelectorAll(".spot-pin").forEach(p => { p.classList.remove("sel"); p.setAttribute("aria-pressed", "false"); });
        idleInfo();
      };
      if (av.why === "locked") {
        info.replaceChildren(
          el("div.mi-heading", [el("div.mi-banner", { text: "？？？" }), el("button.mi-close", { text: "×", "aria-label": "場所の詳細を閉じる", onclick: closeInfo })]),
          el("p.mi-desc", { text: "まだ知らない場所。誰かと知り合えば、教えてもらえるかもしれない。" }),
          el("div.mi-foot", { text: movesLeft() }),
        );
        return;
      }
      const known = knowsOwner(s);
      const charName = s.charId && known ? displayName(s.charId, state) : null;
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
          if (!loaded.every(Boolean)) { preview.textContent = "画像を表示できませんでした"; return; }
          preview.replaceChildren();
          preview.removeAttribute("role");
          renderSceneArt(preview, pv.url);
        });
      }
      const forecasts = s.kind === "tonari" ? [actionPreview(s, { mode: "customer" }), actionPreview(s, { mode: "baito" })]
        : s.kind === "shop" ? [actionPreview(s), actionPreview(s, { mode: "rin" })]
        : [actionPreview(s, { free: freeGuide(s) })];
      info.replaceChildren(
        el("div.mi-heading", [el("div.mi-banner", { text: known ? s.label : s.unknownLabel || s.label }),
          el("button.mi-close", { text: "×", "aria-label": "場所の詳細を閉じる", onclick: closeInfo })]),
        el("div.mi-content", [
          ...forecasts.map(previewCard),
          preview,
          el("div.mi-area", { text: s.area + (charName ? ` ・ ${charName}` : s.charId ? " ・ ？？？" : "") }),
          el("p.mi-desc", { text: known ? s.desc : s.unknownDesc || s.desc }),
          el("div.mi-tags", [
            spotTimeNote(s, state) ? el("span.tag", { text: spotTimeNote(s, state), dataset: { test: "spot-hours" } }) : null,
            known && hasNewEvent(s) ? el("span.tag.new", { text: "NEW：未読の交流" }) : null,
            eventPin === s.id ? el("span.tag", { text: "夜の行動後に自動で始まる予定" }) : null,
            bookedPin === s.id ? el("span.tag", { text: "LIMEの約束あり" }) : null,
          ]),
          ["tonari", "shop"].includes(s.kind) ? el("p.action-preview-note", { text: "入店だけなら0行動。店内で内容を選んで確定します。" }) : null,
          s.kind === "rest" ? previewCard(actionPreview(s, { mode: "practice" })) : null,
        ]),
        el("div.mi-actions", [
          av.ok ? el("button.mi-go", { dataset: { test: "map-go" }, onclick: () => go(s) },
            [el("span", { text: s.kind === "rest" ? "家で休む（1行動）" : ["tonari", "shop", "trpg"].includes(s.kind) ? "入店して選ぶ（0行動）" : "ここへ行く" })])
            : el("div.mi-no", { text: av.why }),
          av.ok && s.kind === "rest" ? el("button.mi-go.mi-go-alt", { dataset: { test: "map-home-practice" }, onclick: () => go(s, "practice") },
            [el("span", { text: "家で練習内容を選ぶ" })]) : null,
        ]),
      );
    };

    const select = (s, btn) => {
      selected = s;
      root.dataset.selected = "true";
      pins.querySelectorAll(".spot-pin").forEach(p => { p.classList.toggle("sel", p === btn); p.setAttribute("aria-pressed", String(p === btn)); });
      SE.click();
      renderInfo(s);
    };

    let moving = false;
    const go = async (s, mode = null) => {
      if (moving || root.classList.contains("done")) return;
      if (!availability(s).ok) { renderInfo(s); return; }
      moving = true;
      try {
        // 移動演出・行動消費より前に、当該スポット固有の確認を行う。
        if (onBeforeGo && !(await onBeforeGo(s))) return;
        if (root.classList.contains("done")) return;
        if (!availability(s).ok) { renderInfo(s); return; }
        SE.select();
        cueMove(pins.querySelector(`[data-spot="${s.id}"] .shield`), s);
        retire(root);
        info.classList.add("leaving");
        interrupt = null;
        resolve(mode ? `${s.id}:${mode}` : s.id); // 家で練習は "rest:practice"
      } finally {
        moving = false;
      }
    };

    function renderPins() {
      pins.replaceChildren();
      for (const s of mapSpots()) {
      if (s.kind === "fortune" && !fortuneToday()) continue; // 占い師は週2日だけ出店
      const av = availability(s);
      const locked = av.why === "locked";
      const known = knowsOwner(s);
      const people = locked ? [] : spotPeople(s);
      const logo = !FACILITIES[s.id] && !locked && !(!known && s.unknownLabel) && hasStoreLogo(s.id) ? storeLogo(s.id, { width: 92, height: 52 }) : null;
      const badgeKind = locked ? null : guide?.pin === s.id ? "guide" : bookedPin === s.id ? "booked"
        : eventPin === s.id ? "automatic" : known && av.ok && hasNewEvent(s) ? "story" : null;
      const badgeText = { guide: "案内", booked: "約束", automatic: "自動", story: "NEW" };
      const badge = badgeKind ? el(`i.evt-badge.${badgeKind}`, { text: badgeText[badgeKind], "aria-label": badgeText[badgeKind] }) : null;
      const facility = !locked && FACILITIES[s.id] ? createFacilityIcon(FACILITIES[s.id], { size: 128, decorative: true }) : null;
      const caption = pinCaption(s, locked);
      const guideCls = guide ? (guide.pin === s.id ? ".guide" : ".guided-off") : "";
      const btn = el(`button.spot-pin.pin-${locked ? "locked" : s.theme}${av.ok || av.guided ? "" : ".off"}${guideCls}${logo ? ".branded" : ""}${facility ? ".facility-pin" : ""}`, {
        style: { left: `${s.x}%`, top: `${s.y}%` },
        dataset: { test: `pin-${s.id}`, spot: s.id },
        "aria-pressed": "false",
        "aria-label": `${caption}${av.tag ? `（${av.tag}）` : ""}${badge ? `・${badgeText[badgeKind]}` : ""}${people.length ? `・在店：${people.map(p => p.name).join("、")}` : ""}`,
        onclick: () => select(s, btn),
      }, [
        el("div.shield", [
          badge,
          el("div.ico", [facility || logo || (locked || !known && s.unknownLabel
            ? el("span", { text: "？" }) : pinSymbol(s))]),
        ]),
        peopleRow(people),
        el("div.sub-label", { text: caption }),
        av.tag ? el("small.pin-status", { text: av.tag }) : null,
      ]);
      pins.append(btn);
      }
    }

    idleInfo();
    const rainy = isRainy();
    const root = el("div.map", { dataset: { night: String(night), rain: String(rainy), destinationSelection: "true", view, selected: "false" } }, [
      rainy ? el("div.map-weather") : null, // 雨の日のオーバーレイ（ピンより下・操作を邪魔しない）
      el("nav.map-toolbar", { "aria-label": "行き先の探し方" }, [
        el("div.map-view-toggle", ["map", "list"].map(mode => el("button", {
          text: mode === "map" ? "地図" : "一覧", "aria-pressed": String(view === mode), dataset: { test: `map-view-${mode}` },
          onclick: () => { view = lastView = mode; root.dataset.view = mode;
            root.querySelectorAll(".map-view-toggle button").forEach(n => n.setAttribute("aria-pressed", String(n.dataset.test === `map-view-${mode}`))); },
        }))),
      ]),
      el("div.map-surface", [pins]),
      regions ? el("nav.map-regions", { "aria-label": "街を選ぶ" }, regions.map(item => el("button", {
        type: "button", text: item.label, "aria-pressed": String(item === region),
        dataset: { test: `map-region-${item.id}`, region: item.id },
        onclick: () => {
          if (moving || root.classList.contains("done") || region === item) return;
          region = item; selected = null; root.dataset.selected = "false";
          onRegionChange?.(item.id);
          root.dataset.region = item.id;
          root.querySelectorAll(".map-regions button").forEach(node => node.setAttribute("aria-pressed", String(node.dataset.region === item.id)));
          void setMapBackground(); updateHud(); renderPins(); idleInfo();
        },
      }))) : null,
      canWalkStreet({ guide }) ? el("button.map-walk", { text: "繁華街を歩く（仮導入）", dataset: { test: "map-walk" }, onclick: () => {
        SE.select(); interrupt = null; retire(root); resolve(WALK_STREET);
      } }) : null,
      notice ? el("div.map-notice", { text: notice }) : null,
      guide ? el("div.map-guide", { dataset: { test: "map-guide" } }, [el("b", { text: "GUIDE" }), el("span", { text: guide.text })]) : null,
      info,
    ]);
    if (region) root.dataset.region = region.id;
    renderPins();
    showScreen("map", root);
    if (requestedSpot) {
      const id = requestedSpot; requestedSpot = null;
      const button = [...pins.querySelectorAll("[data-spot]")].find(n => n.dataset.spot === id);
      if (button) { button.hidden = false; button.click(); }
    }
    root.addEventListener("keydown", e => {
      if (e.key === "Escape" && selected) { e.preventDefault(); info.querySelector(".mi-close")?.click(); }
    });
    interrupt = (v) => { interrupt = null; retire(root); resolve(v); };
    mountReel(root); // 溜まったスロットの結果をここで見せる（報酬は行動時に確定済み）
    onShown?.();
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
