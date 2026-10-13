// マップ画面。ピンを選んで「行く」を押すと、その行き先で解決する Promise を返す。
// 見た目は旧版を踏襲: 栄・大須の街マップ／看板型のピン（面識のある相手は顔ドット絵）／右下の墨×金パネル。
import { el, yen } from "../core/util.js";
import { bgUrl, sceneBg, faceIconUrl, displayName } from "../core/data.js";
import { showScreen, setBg, retire, uiArtReady, imageReady, layers } from "../core/ui.js";
import { cueTransition } from "../core/transitions.js";
import { renderSceneArt, sceneArtUrls } from "../core/scene-art.js";
import { state, timeOfDay } from "../core/state.js";
import { SE } from "../core/audio.js";
import { STAMINA_LOW } from "../core/stats.js";
import { allSpots, SPOT_PREVIEW, isUnlocked, hasNewEvent } from "./spots.js";
import { updateHud } from "./hud.js";
import { mountReel } from "./reel.js";
import { isRainy } from "./weather.js";
import { fortuneToday } from "./fortune.js";
import { spotAvailability, freeGuide as isFreeGuide } from "./spot-access.js";
import { openStreet, canWalkStreet, WALK_STREET, BACK_TO_MAP } from "./street.js";
import { hasStoreLogo, storeLogo } from "../core/store-logos.js";

/** 看板に出す顔（面識のある相手だけ。tonari はスミさん） */
function spotFace(s) {
  if (!s.face) return null;
  if (s.face !== "sumi" && !state.met[s.face]) return null;
  return faceIconUrl(s.face);
}
const knowsOwner = (s) => !s.charId || !!state.met[s.charId];

// 施設は大きな記号、その下に名前。顔のある店は同じ場所に店主の顔を置く。
const PIN_SYMBOLS = {
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

/**
 * @param opts.notice   上部に出す一言（「今夜は約束がある」など）
 * @param opts.eventPin 今夜イベントがある場所のピン id（! バッジ）
 * @param opts.guide    { pin, title, text, free } 1日目の案内・配達用。その1か所だけ選べるようにして光らせる。
 *                      free（表示する一言）があれば、その行き先は代金がかからない
 * @param opts.onShown  マップを出し終えたとき（LIME の初回案内など）
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
    await Promise.all([uiArtReady(), setBg(bgUrl(`bg_osu_map_${timeOfDay()}`), { fast: true, brief: true })]);
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

function openMap({ notice = "", eventPin = null, guide = null, onShown = null }) {
  return new Promise((resolve) => {
    const night = timeOfDay() === "night";
    const tod = night ? "night" : "day";
    setBg(bgUrl(`bg_osu_map_${tod}`), { fast: true });
    updateHud();
    const info = el("div.map-info");
    const pins = el("div.map-pins");
    let selected = null;

    const freeGuide = (s) => isFreeGuide(s, guide);
    const availability = (s) => spotAvailability(s, { guide });

    const movesLeft = () => (state.slot >= 1 ? "夜 ── 今日はあと1回動ける" : "昼 ── 今日はあと2回動ける");
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
      const staminaNote = s.stamina ? (s.stamina > 0 ? "体力が回復する" : "体力を使う") : s.kind === "tonari" ? "体力を使う" : "";
      const warn = s.stamina < 0 && state.stamina + s.stamina < STAMINA_LOW;
      const previewId = s.preview || SPOT_PREVIEW[s.id];
      const pv = previewId ? sceneBg(previewId, tod) : null;
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
      info.replaceChildren(
        el("div.mi-banner", { text: known ? s.label : s.unknownLabel || s.label }),
        preview,
        el("div.mi-area", { text: s.area + (charName ? ` ・ ${charName}` : s.charId ? " ・ ？？？" : "") }),
        el("p.mi-desc", { text: known ? s.desc : s.unknownDesc || s.desc }),
        el("div.mi-tags", [
          s.cost && !freeGuide(s) ? el("span.tag", { text: yen(s.cost) }) : el("span.tag.free", { text: freeGuide(s) ? guide.free : s.kind === "shop" ? "買い物は時間を使わない" : s.kind === "fortune" ? "時間を使わない" : "無料" }),
          staminaNote ? el(`span.tag${warn ? ".warn" : ""}`, { text: warn ? "体力が心配" : staminaNote }) : null,
          known && hasNewEvent(s) ? el("span.tag.new", { text: "新しいイベント" }) : null,
        ]),
        av.ok
          ? el("button.mi-go", { dataset: { test: "map-go" }, onclick: () => go(s) }, [el("span", { text: s.kind === "rest" ? "家に帰る" : "ここへ行く" })])
          : el("div.mi-no", { text: av.why }),
      );
    };

    const select = (s, btn) => {
      selected = s;
      pins.querySelectorAll(".spot-pin").forEach((p) => p.classList.toggle("sel", p === btn));
      SE.click();
      renderInfo(s);
    };

    const go = (s) => {
      if (!availability(s).ok) { renderInfo(s); return; }
      SE.select();
      cueMove(pins.querySelector(`[data-spot="${s.id}"] .shield`), s);
      retire(root);
      info.classList.add("leaving");
      interrupt = null;
      resolve(s.id);
    };

    for (const s of allSpots()) {
      if (s.kind === "fortune" && !fortuneToday()) continue; // 占い師は週2日だけ出店
      const av = availability(s);
      const locked = av.why === "locked";
      const known = knowsOwner(s);
      const face = locked ? null : spotFace(s);
      const logo = !locked && !(!known && s.unknownLabel) && hasStoreLogo(s.id) ? storeLogo(s.id) : null;
      const badge = locked ? null
        : eventPin === s.id || guide?.pin === s.id ? el("i.evt-badge", { text: "!" })
        : known && av.ok && hasNewEvent(s) ? el("i.evt-badge.story", { text: "!", "aria-label": "新しいイベント" })
        : null;
      const caption = pinCaption(s, locked);
      const guideCls = guide ? (guide.pin === s.id ? ".guide" : ".guided-off") : "";
      const btn = el(`button.spot-pin.pin-${locked ? "locked" : s.theme}${av.ok || av.guided ? "" : ".off"}${guideCls}${logo ? ".branded" : ""}`, {
        style: { left: `${s.x}%`, top: `${s.y}%` },
        dataset: { test: `pin-${s.id}`, spot: s.id },
        "aria-label": `${caption}${av.tag ? `（${av.tag}）` : ""}${badge ? "・新しいイベント" : ""}`,
        onclick: () => (selected === s && av.ok ? go(s) : select(s, btn)),
      }, [
        el("div.shield", [
          badge,
          el("div.ico", [logo || (face ? el("img.pin-face", { src: face, alt: "" }) : locked || !known && s.unknownLabel
            ? el("span", { text: "？" }) : pinSymbol(s))]),
          logo && face ? el("img.pin-face.pin-owner-face", { src: face, alt: "" }) : null,
        ]),
        el("div.sub-label", { text: caption }),
        av.tag ? el("small.pin-status", { text: av.tag }) : null,
      ]);
      pins.append(btn);
    }

    idleInfo();
    const rainy = isRainy();
    const root = el("div.map", { dataset: { night: String(night), rain: String(rainy), destinationSelection: "true" } }, [
      rainy ? el("div.map-weather") : null, // 雨の日のオーバーレイ（ピンより下・操作を邪魔しない）
      pins,
      canWalkStreet({ guide }) ? el("button.map-walk", { text: "繁華街を歩く（仮導入）", dataset: { test: "map-walk" }, onclick: () => {
        SE.select(); interrupt = null; retire(root); resolve(WALK_STREET);
      } }) : null,
      notice ? el("div.map-notice", { text: notice }) : null,
      guide ? el("div.map-guide", { dataset: { test: "map-guide" } }, [el("b", { text: "GUIDE" }), el("span", { text: guide.text })]) : null,
      info,
    ]);
    showScreen("map", root);
    interrupt = (v) => { interrupt = null; retire(root); resolve(v); };
    mountReel(root); // 溜まったスロットの結果をここで見せる（報酬は行動時に確定済み）
    onShown?.();
    // 今行ける場所だけを2通信ずつ準備。マップ表示やボタン操作は待たせない。
    const previews = [...new Set(allSpots().filter(isUnlocked)
      .flatMap((spot) => sceneArtUrls(sceneBg(spot.preview || SPOT_PREVIEW[spot.id], tod).url)))];
    let at = 0;
    const warm = async () => {
      while (root.isConnected && !root.classList.contains("done") && at < previews.length) {
        await imageReady(previews[at++], 8000);
      }
    };
    void Promise.all([warm(), warm()]);
  });
}
