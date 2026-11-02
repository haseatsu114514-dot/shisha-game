import { el } from "./core/util.js";
import { runAxeThrow } from "./minigames/axe.js";
import { DIFFICULTIES } from "./minigames/axe-match.js";
import { DIVISIONS } from "./minigames/axe-model.js";
import { COMPANIONS } from "./minigames/axe-companions.js";
import { axeRules } from "./minigames/axe-rules.js";
const host = document.getElementById("axe-app");
let opponent = "hiyori", difficulty = "normal", division = "am", bestOf = 1;
function menu(result = null) {
  let lessonOpen = false;
  const busy = () => lessonOpen || buttons.some(b => b.disabled);
  const startGame = async (mode, button, confirmed = false) => {
    if (busy() || intro.inert) return;
    // The competitive modes ask for the division (and the match length) on a small sheet; practice starts at once.
    if (mode !== "practice" && !confirmed) { openSetup(mode, button); return; }
    buttons.forEach(b => { b.disabled = true; }); lesson.disabled = true;
    try { menu(await runAxeThrow({ host, mode, opponent: mode === "versus" ? "hiyori" : opponent, difficulty, division: mode === "practice" ? "rec" : division, bestOf: mode === "versus" ? bestOf : 1 })); }
    catch (error) { console.error(error); buttons.forEach(b => { b.disabled = false; }); lesson.disabled = false; message.textContent = "開き直して、もう一度お試しください。"; button.focus(); }
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
  const versus = modeCard("versus", "axe-versus", "10 × 2 THROWS", "同点はサドンデス", "ひよりと対戦", "一投ずつ競う、ふたりの勝負。", "対戦をはじめる");
  const buttons = [start, league, versus];
  const levels = el("div.axe-pickers.axe-menu-options", { role: "group", "aria-label": "対戦の難易度" }, Object.entries(DIFFICULTIES).map(([id, level]) => el("button.axe-button", {
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
        el("h2#axe-setup-title", { text: mode === "versus" ? "ひよりと対戦" : "10投ゲーム" }),
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
  const picker = el("div.axe-pickers.axe-menu-options", { role: "group", "aria-label": "練習を見守る相手" }, Object.entries(COMPANIONS).map(([id, c]) => el("button.axe-button", {
    type: "button", text: c.name, "aria-pressed": String(id === opponent), dataset: { companion: id }, onclick: () => {
      if (busy() || intro.inert) return; opponent = id;
      for (const b of picker.children) b.setAttribute("aria-pressed", String(b.dataset.companion === id));
    } })));
  const message = el("p.axe-menu-message", { "aria-live": "polite", text: result?.completed ? (result.match ? (result.series?.bestOf > 1 ? "マッチ " + result.series.wins.player + "-" + result.series.wins.opponent + " · " : "") + ({player:"あなたの勝ち", opponent:"ひよりの勝ち", draw:"引き分け"})[result.match.winner] + (result.match.suddenDeath ? "（サドンデス" + result.match.suddenDeath.rounds + "本）" : "") + " · " + result.match.playerTotal + " 対 " + result.match.opponentTotal + " / 前回の記録 " : "前回の記録  ") + result.total + " / " + result.maximum + "点 · 平均 " + result.stats.average.toFixed(2) : "狙いを定めて、気持ちいい一投を。" });
  const rules = el("button.axe-button.axe-menu-rules", { type: "button", text: "遊び方・得点ルール", dataset: { test: "axe-menu-rules" }, onclick: () => {
    if (busy() || intro.inert) return;
    intro.inert = true;
    const panel = axeRules(() => { panel.remove(); intro.inert = false; rules.focus(); });
    host.append(panel); panel.querySelector("button").focus();
  } });
  const lesson = el("button.axe-button.axe-menu-lesson", { type: "button", text: "マキの無料1投レッスン", dataset: { test: "axe-menu-lesson" }, onclick: async () => {
    if (busy() || intro.inert || !intro.isConnected) return;
    lessonOpen = true; intro.inert = true;
    try { await runAxeThrow({ host, tutorial: true, opponent: null, allowRetry: true }); }
    catch (error) { console.error(error); }
    finally {
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
    el("div.axe-menu-guide", [
      el("span.axe-menu-guide-label", { text: "ボタン / Spaceで、順番に止める" }),
      el("ol", [["01", "横"], ["02", "縦"], ["03", "回転"]].map(([step, label]) => el("li", [
        el("span", { text: step }), el("strong", { text: label }),
      ]))),
    ]),
    el("div.axe-menu-modes", { role: "group", "aria-label": "遊ぶモードを選ぶ" }, [start, league, versus]),
    el("div.axe-menu-settings", [
      el("div.axe-menu-setting", [el("span.axe-menu-setting-label", { text: "練習を見守る相手" }), picker]),
      el("div.axe-menu-setting", [el("span.axe-menu-setting-label", { text: "ひより対戦の難易度" }), levels]),
    ]),
    el("footer.axe-menu-footer", [
      el("a.axe-back", { href: "./", text: "← 本編へ" }),
      el("span.axe-menu-tip", { text: "回転は緑の帯で放す。白い刃先が触れた最高点が入る。" }), lesson, rules,
    ]),
  ]);
  host.replaceChildren(intro);
  if (result) start.focus();
}
menu();
