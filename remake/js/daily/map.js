// マップ画面。ピンを選んで「行く」を押すと、その行き先で解決する Promise を返す。
import { el, yen } from "../core/util.js";
import { bgUrl, faceIconUrl, displayName } from "../core/data.js";
import { showScreen, setBg, retire } from "../core/ui.js";
import { state, timeOfDay } from "../core/state.js";
import { SE } from "../core/audio.js";
import { STAMINA_LOW } from "../core/stats.js";
import { SPOTS, isClosed, visitedToday, isUnlocked, hasNewStory } from "./spots.js";
import { updateHud } from "./hud.js";

/**
 * @param opts.notice   上部に出す一言（「夜になった」など）
 * @param opts.eventPin 今夜イベントがある場所のピン id（! バッジ）
 */
export function chooseSpot({ notice = "", eventPin = null } = {}) {
  return new Promise((resolve) => {
    const night = timeOfDay() === "night";
    setBg(bgUrl("bg_map_local", night ? "night" : "day"));
    updateHud();
    const info = el("div.map-info.panel");
    const pins = el("div.map-pins");
    let selected = null;

    const availability = (s) => {
      if (!isUnlocked(s)) return { ok: false, why: "hidden" };
      if (isClosed(s)) return { ok: false, why: "今日は定休日" };
      if (s.kind !== "shop" && s.kind !== "rest" && s.kind !== "tonari" && visitedToday(s.id)) return { ok: false, why: "今日はもう行った" };
      if (s.cost && state.money < s.cost) return { ok: false, why: `お金が足りない（${yen(s.cost)}）` };
      return { ok: true };
    };

    const renderInfo = (s) => {
      const av = availability(s);
      const charName = s.charId ? (state.met[s.charId] ? displayName(s.charId, state) : "？？？") : null;
      const face = s.charId && state.met[s.charId] ? faceIconUrl(s.charId) : null;
      const staminaNote = s.stamina ? (s.stamina > 0 ? "体力が回復する" : "体力を使う") : s.kind === "tonari" ? "体力を使う" : "";
      const warn = s.stamina < 0 && state.stamina + s.stamina < STAMINA_LOW;
      info.replaceChildren(
        el("div.mi-head", [
          face ? el("img.mi-face", { src: face, alt: "" }) : el("span.mi-icon", { text: s.icon }),
          el("div", [el("div.mi-name", { text: s.label }), el("div.mi-area", { text: s.area + (charName ? ` ・ ${charName}` : "") })]),
        ]),
        el("p.mi-desc", { text: s.desc }),
        el("div.mi-tags", [
          s.cost ? el("span.tag", { text: yen(s.cost) }) : el("span.tag.free", { text: s.kind === "shop" ? "買い物は時間を使わない" : "無料" }),
          staminaNote ? el(`span.tag${warn ? ".warn" : ""}`, { text: warn ? "⚠ 体力が心配" : staminaNote }) : null,
          s.charId && hasNewStory(s.charId) && state.met[s.charId] ? el("span.tag.new", { text: "新しい話がありそう" }) : null,
        ]),
        av.ok
          ? el("button.btn.primary.mi-go", { dataset: { test: "map-go" }, onclick: () => go(s) }, [el("span.btn-label", { text: s.kind === "rest" ? "家に帰る" : "ここへ行く" })])
          : el("div.mi-no", { text: av.why }),
      );
    };

    const select = (s, btn) => {
      selected = s;
      pins.querySelectorAll(".pin").forEach((p) => p.classList.toggle("sel", p === btn));
      SE.click();
      renderInfo(s);
    };

    const go = (s) => {
      SE.select();
      retire(root);
      info.classList.add("leaving");
      resolve(s.id);
    };

    for (const s of SPOTS) {
      const av = availability(s);
      if (av.why === "hidden") continue;
      const badge = eventPin === s.id ? "!" : s.charId && state.met[s.charId] && hasNewStory(s.charId) ? "…" : "";
      const btn = el(`button.pin.k-${s.kind}${av.ok ? "" : ".off"}`, {
        style: { left: `${s.x}%`, top: `${s.y}%` },
        dataset: { test: `pin-${s.id}`, spot: s.id },
        onclick: () => (selected === s && av.ok ? go(s) : select(s, btn)),
      }, [
        el("span.pin-dot", { text: s.icon }),
        el("span.pin-label", { text: s.label }),
        badge ? el("em.pin-badge", { text: badge }) : null,
      ]);
      pins.append(btn);
    }

    const head = el("div.map-head", [
      el("div.map-when", { text: night ? "夜 ── どこへ行こう？" : "昼 ── どこへ行こう？" }),
      notice ? el("div.map-notice", { text: notice }) : null,
    ]);
    info.append(el("p.mi-hint", { text: "行き先をタップして選ぶ。1日に動けるのは昼と夜の2回。" }));
    const root = el("div.map", { dataset: { night: String(night) } }, [head, pins, info]);
    showScreen("map", root);
  });
}
