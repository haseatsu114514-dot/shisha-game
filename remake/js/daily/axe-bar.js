// 自由来店のソロ斧投げ。正式なひよりイベントの読了・関係には触れない。
import { state } from "../core/state.js";
import { on } from "../core/bus.js";
import { el, yen } from "../core/util.js";
import { DB, bgUrl } from "../core/data.js";
import { layers, showScreen, setBg, toast } from "../core/ui.js";
import { venueHost } from "../core/venue-host.js";
import { addMoney, addStamina, earnStat } from "../core/stats.js";
import { showHud } from "./hud.js";
import { AXE_BAR } from "./axe-bar-data.js";
import { runAxeThrow } from "../minigames/axe.js";
import { axeBarDiscovered, axeBarSightingDue } from "../core/axe-bar-discovery.js";
import { playAxeBarSighting } from "./axe-bar-discovery.js";
import { playBgm, currentBgm } from "../core/audio.js";

const modes = { practice: "3投練習", league: "10投スコアアタック" };
let active = false;

/** 入店・記録閲覧・中断は無料。完走時だけ消費し、行動と保存はcalendarが確定する。 */
export async function visitAxeBar({ staminaGuard = async () => true, signal } = {}) {
  if (active || !state || !axeBarDiscovered(state) || state.chapter < 1 || state.phase !== "daily" || state.slot !== 1 || signal?.aborted) return false;
  active = true;
  const owner = state, day = state.day, slot = state.slot, chapter = state.chapter;
  const abort = new AbortController();
  const current = () => !abort.signal.aborted && state === owner && state.day === day && state.slot === slot && state.chapter === chapter;
  const cancel = () => abort.abort();
  const unsubscribe = on("hud", () => { if (!current()) cancel(); });
  signal?.addEventListener("abort", cancel, { once: true });
  window.addEventListener("pagehide", cancel, { once: true });
  const hadHud = document.getElementById("hud")?.classList.contains("show");
  const host = el("div.sub-menu.axe-bar-menu", { dataset: { test: "axe-bar-menu" } });
  host.hidden = true; // 目撃VNの間は空の枠を見せない。メニュー構築時に表示する。
  showScreen("axe-bar", host); showHud(false);
  const bgmBefore = currentBgm() || "kansetsu_shomei_to_black_coffee"; playBgm("bgm_axe"); // #788 入店中は斧投げ曲
  const observer = new MutationObserver(() => { if (!host.isConnected) cancel(); });
  observer.observe(layers.screen, { childList: true });
  const available = () => current() && owner.visitedDay.axe_bar !== day && owner.money >= AXE_BAR.playCost && owner.stamina > 0;
  try {
    await setBg(bgUrl(AXE_BAR.preview), { fast: true });
    if (!current()) return false;
    // 実来店の無料目撃。プレイ／レッスンの完走や精算とは独立して完読だけを保存する。
    if (axeBarSightingDue(owner)) {
      if (!await playAxeBarSighting({ signal: abort.signal }) || !current()) return false;
    }
    const mode = await new Promise(resolve => {
      host.hidden = false;
      let lessonOpen = false, picked = false;
      const pick = value => { if (!lessonOpen && !picked) { picked = true; resolve(value); } };
      abort.signal.addEventListener("abort", () => { picked = true; resolve(null); }, { once: true });
      const records = owner.flags._axe_bar_records || {};
      const welcome = Object.keys(records).length ? "venue_maki_return" : "venue_maki_greet";
      const status = owner.visitedDay.axe_bar === day ? "今日はもう投げ終えた。記録を見ていこう。"
        : owner.money < AXE_BAR.playCost ? "プレイには3,000円必要。記録を見るだけなら無料。"
        : owner.stamina <= 0 ? "今日は体を休めよう。記録を見るだけなら無料。"
        : `参加 ${yen(AXE_BAR.playCost)}・体力10・1行動。途中でやめた場合は消費しません。`;
      const lesson = el("button.btn.ghost.axe-bar-lesson", { type: "button", text: "マキに教わる・無料1投", dataset: { test: "axe-bar-lesson" }, onclick: async () => {
        if (lessonOpen || picked || !current()) return;
        lessonOpen = true; host.hidden = true; host.inert = true;
        try { await runAxeThrow({ host: document.getElementById("stage"), tutorial: true, opponent: null, signal: abort.signal, allowRetry: true }); }
        catch (error) { if (current()) { console.error(error); toast("レッスンを開けませんでした。もう一度お試しください。"); } }
        finally {
          lessonOpen = false;
          if (current() && host.isConnected) { host.hidden = false; host.inert = false; lesson.focus(); }
        }
      } });
      host.append(el("h2.sub-title", { text: AXE_BAR.label }),
        venueHost("maki", DB.dialogues[welcome]?.lines?.[0]?.text || "", DB), el("p.sub-lead", { text: status }),
        lesson,
        el("div.sub-choices", Object.entries(modes).map(([id, label]) => el("button.big-choice", {
          disabled: !available(), dataset: { test: "axe-bar-" + id }, onclick: () => { if (available()) pick(id); },
        }, [el("b", { text: label }), el("small", { text: records[id] ? `自己ベスト ${records[id].best.total}点 · ${records[id].plays}回プレイ` : "まだ記録はありません" })]))),
        el("div.axe-bar-records", [Object.keys(records).length ? el("strong", { text: "マキがつけた、はじめの記録" }) : null, ...Object.entries(modes).map(([id, label]) => {
          const last = records[id]?.last;
          return el("p", { text: last ? `${label}の前回：${last.total}点（各投 ${last.throws.map(shot => shot.score).join(" / ")}）` : `${label}：完走すると各投の結果が残ります。` });
        })]),
        el("button.btn.ghost.small.sub-back", { text: "← マップに戻る", dataset: { test: "axe-bar-back" }, onclick: () => pick(null) }));
    });
    if (!mode || !available() || !await staminaGuard(AXE_BAR.stamina) || !available()) return false;
    host.hidden = true;
    const result = await runAxeThrow({ host: document.getElementById("stage"), mode, opponent: null, allowRetry: false, signal: abort.signal });
    if (!result.completed || !available()) return false;
    const records = owner.flags._axe_bar_records ||= {};
    const entry = { chapter, day, total: result.total, maximum: result.maximum, ruleset: result.ruleset, throws: result.throws };
    const previous = records[mode];
    const newBest = !previous?.best || result.total > previous.best.total;
    records[mode] = { plays: (previous?.plays || 0) + 1, last: entry,
      best: newBest ? entry : previous.best };
    addMoney(-AXE_BAR.playCost); addStamina(AXE_BAR.stamina); earnStat("guts", 1);
    const reply = result.total === 0 ? "venue_maki_miss" : previous && newBest ? "venue_maki_record" : "venue_maki_finish";
    toast(`斧崎マキ「${DB.dialogues[reply]?.lines?.[0]?.text || ""}」`, { kind: "good" });
    return true;
  } finally {
    observer.disconnect(); unsubscribe(); window.removeEventListener("pagehide", cancel);
    signal?.removeEventListener("abort", cancel); abort.abort(); active = false;
    if (state === owner && host.isConnected) showHud(hadHud);
    if (state === owner && currentBgm() === "bgm_axe") playBgm(bgmBefore); // #788 退店・中断で元の曲へ
  }
}
