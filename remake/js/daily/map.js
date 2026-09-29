// マップ画面。ピンを選んで「行く」を押すと、その行き先で解決する Promise を返す。
// 見た目は旧版を踏襲: 栄・大須の街マップ／看板型のピン（面識のある相手は顔ドット絵）／右下の墨×金パネル。
import { el, yen } from "../core/util.js";
import { bgUrl, sceneBg, faceIconUrl, displayName } from "../core/data.js";
import { showScreen, setBg, retire } from "../core/ui.js";
import { state, timeOfDay } from "../core/state.js";
import { SE } from "../core/audio.js";
import { STAMINA_LOW } from "../core/stats.js";
import { SPOTS, SPOT_PREVIEW, isClosed, visitedToday, isUnlocked, hasNewStory } from "./spots.js";
import { updateHud } from "./hud.js";
import { mountReel } from "./reel.js";

/** 看板に出す顔（面識のある相手だけ。tonari はスミさん） */
function spotFace(s) {
  if (!s.face) return null;
  if (s.face !== "sumi" && !state.met[s.face]) return null;
  return faceIconUrl(s.face);
}
const knowsOwner = (s) => !s.charId || !!state.met[s.charId];

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
 * @param opts.guide    { pin, title, text } 1日目の案内用。その1か所だけ選べるようにして光らせる
 * @param opts.onShown  マップを出し終えたとき（LIME の初回案内など）
 * 戻り値: スポットID。interruptMap(v) で外から閉じたときは v
 */
export function chooseSpot({ notice = "", eventPin = null, guide = null, onShown = null } = {}) {
  return new Promise((resolve) => {
    const night = timeOfDay() === "night";
    const tod = night ? "night" : "day";
    setBg(bgUrl(`bg_osu_map_${tod}`));
    updateHud();
    const info = el("div.map-info");
    const pins = el("div.map-pins");
    let selected = null;

    const availability = (s) => {
      if (!isUnlocked(s)) return { ok: false, why: "locked" };
      if (guide && s.id !== guide.pin) return { ok: false, why: "今はスミさんの頼みが先", guided: true };
      if (isClosed(s)) return { ok: false, why: "本日定休日", tag: "本日定休日" };
      if (s.kind !== "shop" && s.kind !== "rest" && s.kind !== "tonari" && visitedToday(s.id)) return { ok: false, why: "今日はもう行った", tag: "今日はもう行った" };
      if (s.cost && state.money < s.cost) return { ok: false, why: `お金が足りない（${yen(s.cost)}）`, tag: "お金が足りない" };
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
      const pv = SPOT_PREVIEW[s.id] ? sceneBg(SPOT_PREVIEW[s.id], tod) : null;
      info.replaceChildren(
        el("div.mi-banner", { text: s.label }),
        pv?.url ? el("div.mi-preview", { style: { backgroundImage: `url("${pv.url}")` }, dataset: { tint: pv.tint || "" } }) : null,
        el("div.mi-area", { text: s.area + (charName ? ` ・ ${charName}` : s.charId ? " ・ ？？？" : "") }),
        el("p.mi-desc", { text: s.desc }),
        el("div.mi-tags", [
          s.cost ? el("span.tag", { text: yen(s.cost) }) : el("span.tag.free", { text: s.kind === "shop" ? "買い物は時間を使わない" : "無料" }),
          staminaNote ? el(`span.tag${warn ? ".warn" : ""}`, { text: warn ? "体力が心配" : staminaNote }) : null,
          s.charId && known && hasNewStory(s.charId) ? el("span.tag.new", { text: "新しい話がありそう" }) : null,
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
      SE.select();
      retire(root);
      info.classList.add("leaving");
      interrupt = null;
      resolve(s.id);
    };

    for (const s of SPOTS) {
      const av = availability(s);
      const locked = av.why === "locked";
      const known = knowsOwner(s);
      const face = locked ? null : spotFace(s);
      const badge = locked ? null
        : eventPin === s.id || guide?.pin === s.id ? el("i.evt-badge", { text: "!" })
        : s.charId && known && av.ok && hasNewStory(s.charId) ? el("i.evt-badge.story", { text: "話" })
        : null;
      const sub = locked ? null : av.tag || (known ? s.sub : s.unknownSub || s.sub);
      const guideCls = guide ? (guide.pin === s.id ? ".guide" : ".guided-off") : "";
      const btn = el(`button.spot-pin.pin-${locked ? "locked" : s.theme}${av.ok || av.guided ? "" : ".off"}${guideCls}`, {
        style: { left: `${s.x}%`, top: `${s.y}%` },
        dataset: { test: `pin-${s.id}`, spot: s.id },
        onclick: () => (selected === s && av.ok ? go(s) : select(s, btn)),
      }, [
        el("div.shield", [
          badge,
          el("div.ico", [face ? el("img.pin-face", { src: face, alt: "" }) : el("span", { text: locked ? "？" : s.glyph })]),
          el("div.label", [el("span", { text: locked ? "？？？" : s.label }), locked ? el("em.lock", { text: "LOCK" }) : null]),
        ]),
        sub ? el(`div.sub-label${av.tag ? ".closed-tag" : ""}`, { text: sub }) : null,
      ]);
      pins.append(btn);
    }

    idleInfo();
    const root = el("div.map", { dataset: { night: String(night) } }, [
      pins,
      notice ? el("div.map-notice", { text: notice }) : null,
      guide ? el("div.map-guide", { dataset: { test: "map-guide" } }, [el("b", { text: "GUIDE" }), el("span", { text: guide.text })]) : null,
      el("div.map-side", [el("div.map-time", { text: `${night ? "夜" : "昼"} / 栄` })]),
      info,
    ]);
    showScreen("map", root);
    interrupt = (v) => { interrupt = null; retire(root); resolve(v); };
    mountReel(root); // 溜まったスロットの結果をここで見せる（報酬は行動時に確定済み）
    onShown?.();
  });
}
