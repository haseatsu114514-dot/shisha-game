// マップ画面。ピンを選んで「行く」を押すと、その行き先で解決する Promise を返す。
// 見た目は旧版を踏襲: 栄・大須の街マップ／看板型のピン（面識のある相手は顔ドット絵）／右下の墨×金パネル。
import { el, yen } from "../core/util.js";
import { bgUrl, sceneBg, faceIconUrl, displayName } from "../core/data.js";
import { showScreen, setBg, retire, uiArtReady } from "../core/ui.js";
import { cueTransition } from "../core/transitions.js";
import { renderSceneArt } from "../core/scene-art.js";
import { state, timeOfDay } from "../core/state.js";
import { SE } from "../core/audio.js";
import { STAMINA_LOW } from "../core/stats.js";
import { allSpots, SPOT_PREVIEW, isClosed, isTemporaryClosed, visitedToday, isUnlocked, hasNewEvent } from "./spots.js";
import { updateHud } from "./hud.js";
import { mountReel } from "./reel.js";
import { isRainy } from "./weather.js";
import { fortuneToday } from "./fortune.js";

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
  return ["tonari", "rival", "shop", "kafuka"].includes(s.kind) ? `${s.label}へ行く` : s.label;
}

let interrupt = null;
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
 * @param opts.onBeforeGo (spot) => boolean | Promise<boolean>。false ならマップを開いたまま移動を中止する。
 * 戻り値: スポットID。interruptMap(v) で外から閉じたときは v
 */
export async function chooseSpot(opts = {}) {
  // 初回だけ: 看板の顔とスロットの図柄が読めてから地図を出す（遅い回線でも最大2秒・GUI20・21）
  const wait = uiArtReady();
  if (wait) await wait;
  return openMap(opts);
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

function openMap({ notice = "", eventPin = null, guide = null, onShown = null, onBeforeGo = null }) {
  return new Promise((resolve) => {
    const night = timeOfDay() === "night";
    const tod = night ? "night" : "day";
    setBg(bgUrl(`bg_osu_map_${tod}`), { fast: true });
    updateHud();
    const info = el("div.map-info");
    const pins = el("div.map-pins");
    let selected = null;

    const freeGuide = (s) => !!guide?.free && guide.pin === s.id;
    const availability = (s) => {
      if (!isUnlocked(s)) return { ok: false, why: "locked" };
      if (s.unavailable) return { ok: false, why: s.unavailable, tag: s.unavailableTag || s.unavailable };
      if (s.kind === "fortune" && state.fortuneDay === state.day) return { ok: false, why: "今日はもう占ってもらった", tag: "今日はもう占った" };
      if (guide && s.id !== guide.pin) return { ok: false, why: "今はスミさんの頼みが先", guided: true };
      if (isClosed(s)) {
        const tag = isTemporaryClosed(s) ? "本日臨時休業" : "本日定休日";
        return { ok: false, why: tag, tag };
      }
      if (s.kind !== "shop" && s.kind !== "rest" && s.kind !== "tonari" && visitedToday(s.id)) return { ok: false, why: "今日はもう行った", tag: "今日はもう行った" };
      if (s.cost && !freeGuide(s) && state.money < s.cost) return { ok: false, why: `お金が足りない（${yen(s.cost)}）`, tag: "お金が足りない" };
      return { ok: true };
    };

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
      if (preview) renderSceneArt(preview, pv.url);
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

    let moving = false;
    const go = async (s) => {
      if (moving) return;
      moving = true;
      try {
        // 移動演出・行動消費より前に、当該スポット固有の確認を行う。
        if (onBeforeGo && !(await onBeforeGo(s))) return;
        SE.select();
        cueMove(pins.querySelector(`[data-spot="${s.id}"] .shield`), s);
        retire(root);
        info.classList.add("leaving");
        interrupt = null;
        resolve(s.id);
      } finally {
        moving = false;
      }
    };

    for (const s of allSpots()) {
      if (s.kind === "fortune" && !fortuneToday()) continue; // 占い師は週2日だけ出店
      const av = availability(s);
      const locked = av.why === "locked";
      const known = knowsOwner(s);
      const face = locked ? null : spotFace(s);
      const badge = locked ? null
        : eventPin === s.id || guide?.pin === s.id ? el("i.evt-badge", { text: "!" })
        : known && av.ok && hasNewEvent(s) ? el("i.evt-badge.story", { text: "!", "aria-label": "新しいイベント" })
        : null;
      const caption = pinCaption(s, locked);
      const guideCls = guide ? (guide.pin === s.id ? ".guide" : ".guided-off") : "";
      const btn = el(`button.spot-pin.pin-${locked ? "locked" : s.theme}${av.ok || av.guided ? "" : ".off"}${guideCls}`, {
        style: { left: `${s.x}%`, top: `${s.y}%` },
        dataset: { test: `pin-${s.id}`, spot: s.id },
        "aria-label": `${caption}${av.tag ? `（${av.tag}）` : ""}${badge ? "・新しいイベント" : ""}`,
        onclick: () => (selected === s && av.ok ? go(s) : select(s, btn)),
      }, [
        el("div.shield", [
          badge,
          el("div.ico", [face ? el("img.pin-face", { src: face, alt: "" }) : locked || !known && s.unknownLabel
            ? el("span", { text: "？" }) : pinSymbol(s)]),
        ]),
        el("div.sub-label", { text: caption }),
        av.tag ? el("small.pin-status", { text: av.tag }) : null,
      ]);
      pins.append(btn);
    }

    idleInfo();
    const rainy = isRainy();
    const root = el("div.map", { dataset: { night: String(night), rain: String(rainy) } }, [
      rainy ? el("div.map-weather") : null, // 雨の日のオーバーレイ（ピンより下・操作を邪魔しない）
      pins,
      notice ? el("div.map-notice", { text: notice }) : null,
      guide ? el("div.map-guide", { dataset: { test: "map-guide" } }, [el("b", { text: "GUIDE" }), el("span", { text: guide.text })]) : null,
      info,
    ]);
    showScreen("map", root);
    interrupt = (v) => { interrupt = null; retire(root); resolve(v); };
    mountReel(root); // 溜まったスロットの結果をここで見せる（報酬は行動時に確定済み）
    onShown?.();
  });
}
