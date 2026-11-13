import { el } from "./core/util.js";
import { initStageFit } from "./core/stage-fit.js";
initStageFit(document.getElementById("stage")); // 画面の当て方は本編と同じ共通部品（#3076）
import { runAxeThrow } from "./minigames/axe.js";
import { DIFFICULTIES } from "./minigames/axe-match.js";
import { DIVISIONS } from "./minigames/axe-model.js";
import { COMPANIONS } from "./minigames/axe-companions.js";
import { axeRules } from "./minigames/axe-rules.js";
import { adamUnlocked, recordAdamUnlock } from "./minigames/axe-secret-boss.js";
import { DB } from "./core/data.js";
import { unlockAudio, preloadBgm, playBgm, stopBgm } from "./core/audio.js";
const inputMode = new URLSearchParams(location.search).get("input") === "gauges" ? "gauges" : "tap-pull";
const host = document.getElementById("axe-app");
// This standalone page does not run the main game's data loader. Register its one
// packaged track before the first click so bgmUrl() can resolve it immediately.
DB.manifest.bgm = ["bgm_axe.bgm"];
void preloadBgm("bgm_axe");
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);
let opponent = "hiyori", rival = "hiyori", difficulty = "normal", division = "am", bestOf = 1;
function menu(result = null) {
  if (result) recordAdamUnlock(result);
  if (!adamUnlocked()) rival = "hiyori";
  const rivalName = rival === "adam" ? "アダム" : "ひより";
  let lessonOpen = false;
  const busy = () => lessonOpen || buttons.some(b => b.disabled);
  const startGame = async (mode, button, confirmed = false) => {
    if (busy() || intro.inert) return;
    // The competitive modes ask for the division (and the match length) on a small sheet; practice starts at once.
    if (mode !== "practice" && !confirmed) { openSetup(mode, button); return; }
    buttons.forEach(b => { b.disabled = true; }); lesson.disabled = true;
    playBgm("bgm_axe");
    try { const result = await runAxeThrow({ host, inputMode, mode, opponent: mode === "versus" ? rival : opponent,
      difficulty: mode === "versus" && rival === "adam" ? "secret" : difficulty,
      division: mode === "practice" ? "rec" : division, bestOf: mode === "versus" ? bestOf : 1 });
      stopBgm(); menu(result);
    }
    catch (error) { stopBgm(); console.error(error); buttons.forEach(b => { b.disabled = false; }); lesson.disabled = false; message.textContent = "開き直して、もう一度お試しください。"; button.focus(); }
  };
  const modeCard = (kind, test, count, tag, title, description, action) => el("button.axe-button.axe-menu-mode", {
    type: "button", dataset: { test, kind }, onclick: () => startGame(kind, test === "axe-start" ? start : test === "axe-league" ? league : versus),
  }, [
    el("span.axe-menu-mode-top", [el("span.axe-menu-count", { text: count }), el("span.axe-menu-tag", { text: tag })]),
    el("strong.axe-menu-mode-title", { text: title }),
    el("span.axe-menu-mode-description", { text: description }),
    el("span.axe-menu-mode-action", [el("span", { text: action }), el("span", { text: "↗", "aria-hidden": "true" })]),
  ]);
  const start = modeCard("practice", "axe-start", "03 THROWS", "はじめてにおすすめ", "3投で練習", "まずは、斧が刺さる感覚を。", "練習をはじめる");
  const league = modeCard("league", "axe-league", "10 THROWS", "WATL式の1ゲーム", "10投ゲーム", "5投ごとに的を交代。", "記録に挑む");
  const versus = modeCard("versus", "axe-versus", "10 × 2 THROWS", rival === "adam" ? "SECRET BOSS" : "同点はサドンデス", rivalName + "と対戦", rival === "adam" ? "一投ずつ競う、最強の相手。" : "一投ずつ競う、ふたりの勝負。", "対戦をはじめる");
  const buttons = [start, league, versus];
  const levels = el("div.axe-pickers.axe-menu-options", { role: "group", "aria-label": "対戦の難易度" }, Object.entries(DIFFICULTIES).filter(([id]) => id !== "secret").map(([id, level]) => el("button.axe-button", {
    type: "button", text: level.name, "aria-pressed": String(id === difficulty), dataset: { difficulty: id }, onclick: () => {
      if (busy() || intro.inert) return; difficulty = id;
      for (const button of levels.children) button.setAttribute("aria-pressed", String(button.dataset.difficulty === id));
    },
  })));
  /** The setup sheet: division for both competitive modes, match length for the versus. Enter starts with the shown choice. */
  function openSetup(mode, button) {
    intro.inert = true;
    const pressed = (group, value) => { for (const b of group.children) b.setAttribute("aria-pressed", String(b.dataset.value === String(value))); };
    const note = el("p.axe-setup-note", { text: DIVISIONS[division].note, dataset: { test: "axe-setup-note" } });
    const divisionGroup = el("div.axe-setup-options", Object.entries(DIVISIONS).map(([id, d]) => el("button.axe-button", {
      type: "button", text: d.name, dataset: { value: id, division: id }, onclick: () => { division = id; pressed(divisionGroup, id); note.textContent = d.note; } })));
    const lengthGroup = el("div.axe-setup-options", [[1, "1ゲーム"], [3, "マッチ · 2本先取"]].map(([n, label]) => el("button.axe-button", {
      type: "button", text: label, dataset: { value: String(n), bestOf: String(n) }, onclick: () => { bestOf = n; pressed(lengthGroup, n); } })));
    pressed(divisionGroup, division); pressed(lengthGroup, bestOf);
    const close = () => { sheet.remove(); intro.inert = false; };
    const go = el("button.axe-button.axe-primary", { type: "button", text: "はじめる", dataset: { test: "axe-setup-start" }, onclick: () => { close(); startGame(mode, button, true); } });
    const back = el("button.axe-button", { type: "button", text: "戻る", dataset: { test: "axe-setup-back" }, onclick: () => { close(); button.focus(); } });
    const sheet = el("section.axe-setup", { role: "dialog", "aria-modal": "true", "aria-labelledby": "axe-setup-title", dataset: { test: "axe-setup", mode } }, [
      el("div.axe-setup-card", [
        el("h2#axe-setup-title", { text: mode === "versus" ? rivalName + "と対戦" : "10投ゲーム" }),
        mode === "versus" && rival === "adam" ? el("p.axe-setup-note", { text: "アダム「ここまで来たなら、手加減はしない。一本ずつ、見せてみろ」" }) : null,
        el("fieldset.axe-setup-group", [el("legend", { text: "部門（当てた赤と5の閉じ方）" }), divisionGroup, note]),
        mode === "versus" ? el("fieldset.axe-setup-group", [el("legend", { text: "本数" }), lengthGroup]) : null,
        el("div.axe-setup-actions", [go, back]),
      ]),
    ]);
    sheet.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); close(); button.focus(); }
      else if (event.key === "Tab") {
        const nodes = [...sheet.querySelectorAll("button")], at = nodes.indexOf(document.activeElement);
        nodes[(at + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length].focus(); event.preventDefault();
      }
      event.stopPropagation();
    });
    host.append(sheet); go.focus();
  }
  const picker = el("div.axe-pickers.axe-menu-options", { role: "group", "aria-label": "練習を見守る相手" }, Object.entries(COMPANIONS).filter(([id]) => id !== "adam").map(([id, c]) => el("button.axe-button", {
    type: "button", text: c.name, "aria-pressed": String(id === opponent), dataset: { companion: id }, onclick: () => {
      if (busy() || intro.inert) return; opponent = id;
      for (const b of picker.children) b.setAttribute("aria-pressed", String(b.dataset.companion === id));
    } })));
  const message = el("p.axe-menu-message", { "aria-live": "polite", text: result?.completed ? (result.match ? (result.series?.bestOf > 1 ? "マッチ " + result.series.wins.player + "-" + result.series.wins.opponent + " · " : "") + ({player:"あなたの勝ち", opponent:(result.opponent === "adam" ? "アダム" : "ひより") + "の勝ち", draw:"引き分け"})[result.match.winner] + (result.match.suddenDeath ? "（サドンデス" + result.match.suddenDeath.rounds + "本）" : "") + " · " + result.match.playerTotal + " 対 " + result.match.opponentTotal + " / 前回の記録 " : "前回の記録  ") + result.total + " / " + result.maximum + "点 · 平均 " + result.stats.average.toFixed(2) : "狙いを定めて、気持ちいい一投を。" });
  const rivals = el("div.axe-pickers.axe-menu-options", { role: "group", "aria-label": "対戦相手" }, ["hiyori", ...(adamUnlocked() ? ["adam"] : [])].map(id => el("button.axe-button", {
    type: "button", text: id === "adam" ? "アダム · 裏ボス" : "ひより", "aria-pressed": String(id === rival), dataset: { rival: id }, onclick: () => {
      if (busy() || intro.inert) return; rival = id; menu();
    },
  })));
  // 操作・遊び方の説明は常に出さず「？」から開く（#2718 のUI方針）。
  const rules = el("button.axe-button.axe-menu-rules.axe-help", { type: "button", title: "遊び方・得点ルール", dataset: { test: "axe-menu-rules" }, onclick: () => {
    if (busy() || intro.inert) return;
    intro.inert = true;
    const panel = axeRules(() => { panel.remove(); intro.inert = false; rules.focus(); }, { inputMode });
    host.append(panel); panel.querySelector("button").focus();
  } }, [el("span", { "aria-hidden": "true", text: "？" }), el("span.axe-quiet", { text: "遊び方・得点ルール" })]);
  const lesson = el("button.axe-button.axe-menu-lesson", { type: "button", text: "マキの無料1投レッスン", dataset: { test: "axe-menu-lesson" }, onclick: async () => {
    if (busy() || intro.inert || !intro.isConnected) return;
    lessonOpen = true; intro.inert = true;
    playBgm("bgm_axe");
    try { await runAxeThrow({ host, inputMode, tutorial: true, opponent: null, allowRetry: true }); }
    catch (error) { console.error(error); }
    finally {
      stopBgm();
      lessonOpen = false;
      if (intro.isConnected) { intro.inert = false; lesson.focus(); }
    }
  } });
  const intro = el("section.axe-intro.axe-menu", { "aria-labelledby": "axe-menu-title" }, [
    el("header.axe-menu-masthead", [
      el("span.axe-eyebrow", [el("span.axe-menu-mark", { "aria-hidden": "true" }), "水煙前線 -EN:CODE-"]),
      el("span.axe-menu-lounge", { text: "NIGHT LOUNGE" }),
    ]),
    el("h1#axe-menu-title", { text: "AXE THROW" }), message,
    el("div.axe-menu-modes", { role: "group", "aria-label": "遊ぶモードを選ぶ" }, [start, league, versus]),
    el("div.axe-menu-settings", [
      el("div.axe-menu-setting", [el("span.axe-menu-setting-label", { text: "対戦相手" }), rivals]),
      el("div.axe-menu-setting", [el("span.axe-menu-setting-label", { text: "練習を見守る相手" }), picker]),
      el("div.axe-menu-setting", [el("span.axe-menu-setting-label", { text: rival === "adam" ? "アダムの難易度：裏ボス固定" : "ひより対戦の難易度" }), rival === "adam" ? null : levels]),
    ]),
    el("footer.axe-menu-footer", [
      el("a.axe-back", { href: "./", text: "← 本編へ" }),
      lesson, rules,
    ]),
  ]);
  host.replaceChildren(intro);
  if (result) start.focus();
}
menu();

