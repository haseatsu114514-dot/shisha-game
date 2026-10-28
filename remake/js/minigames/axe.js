// Caller awaits preceding VN. Practice never reads or writes story/save state.
import { el } from "../core/util.js";
import { imgFileUrl } from "../core/img-file.js";
import { svg } from "../core/transition-kit.js";
import { SE, unlockAudio } from "../core/audio.js";
import { RINGS, BULLS, KILLS, POWER, SWAY, MODES, RULESET, gaugeAt, axisAt, releaseAimAt, resolveThrow, totalOf, gradeOf, killState, canCall } from "./axe-model.js";
import { createMatch, takeTurn, turnOf, planOpponent, matchResult, DIFFICULTIES } from "./axe-match.js";
import { COMPANIONS, reaction, matchReaction, portraitFocus } from "./axe-companions.js";
import { axeRules } from "./axe-rules.js";
import { TARGET, FLIGHT, flightPose, impactPose } from "./axe-flight.js";
import { createAxe, renderAxe } from "./axe-geometry.js";
import { shotFeedback, sessionStats, impactFeedback, declarationCue } from "./axe-presentation.js";
import { coachDialog } from "./axe-coach.js";
import { CHALLENGES, pickChallenges, evaluateChallenges, heatOf, rankOf, titleOf } from "./axe-challenges.js";
const active = new WeakMap(), artReady = new Map();
function decodeArt(url) {
  if (!artReady.has(url)) {
    const image = new Image(); image.src = url;
    artReady.set(url, image.decode().catch(error => { artReady.delete(url); throw error; }));
  }
  return artReady.get(url);
}
const ART = { bg: imgFileUrl("backgrounds/bg_axe_lounge_night.webp"), board: imgFileUrl("ui/axe_throw/target_board_display.webp") };
// Only the target is decoded early so it appears without a late pop-in; other art waits for the loading step.
if (typeof Image !== "undefined") decodeArt(ART.board).catch(() => {});
const faceArt = (id, face) => imgFileUrl("sprites/characters/" + id + "/chr_" + id + "_" + face + ".webp");
const { x: CX, y: CY, radius: R } = TARGET;
const cycles = { horizontal: 3200, vertical: 3600, power: 2400 };
export function runAxeThrow({ host = document.getElementById("stage") || document.getElementById("axe-app"),
  signal, mode = "practice", tutorial = false, opponent = tutorial ? null : "hiyori", allowRetry = true, difficulty = "normal", seed, reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const versus = mode === "versus";
  if (typeof tutorial !== "boolean" || tutorial && (mode !== "practice" || opponent !== null) || (!versus && !Object.hasOwn(MODES, mode)) || versus && (opponent !== "hiyori" || !Object.hasOwn(DIFFICULTIES, difficulty)) || opponent !== null && !Object.hasOwn(COMPANIONS, opponent)) return Promise.reject(new RangeError("Unknown axe mode or companion"));
  const rules = tutorial ? { throws: 1, max: 8 } : MODES[versus ? "league" : mode], companion = COMPANIONS[opponent];
  let match;
  try { match = versus ? createMatch(difficulty, seed ?? crypto.getRandomValues(new Uint32Array(1))[0]) : null; }
  catch (error) { return Promise.reject(error); }
  // Session goals sit on top of the rules: they never change a score or the opponent's plan.
  const challengeIds = tutorial ? [] : pickChallenges(versus ? "league" : mode, (seed ?? crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0);
  const result = (completed, shots) => ({ completed, cancelled: !completed, throws: structuredClone(shots), total: totalOf(shots),
    grade: completed ? gradeOf(totalOf(shots), rules.max) : null, ruleset: RULESET, mode, opponent, throwCount: rules.throws, maximum: rules.max,
    challenges: evaluateChallenges(challengeIds, shots, completed), rank: completed ? rankOf(totalOf(shots), rules.max) : null,
    title: completed && !tutorial ? titleOf(shots, rules.max) : null,
    ...(tutorial ? { tutorial: true } : {}),
    ...(versus ? { match: { ...matchResult(match), winner: completed ? matchResult(match).winner : null,
      player: structuredClone(match.player), opponent: structuredClone(match.opponent), difficulty, seed: match.seed } } : {}) });
  if (signal?.aborted) return Promise.resolve(result(false, []));
  let finish;
  const promise = new Promise(resolve => { finish = resolve; }); active.set(host, promise);
  const previousFocus = document.activeElement, lifetime = new AbortController();
  // A stage caller can replace #screen while the match overlay is its sibling.
  const callerScreen = (versus || tutorial) && host.id === "stage" ? host.querySelector("#screen") : null;
  const callerContent = callerScreen ? [...callerScreen.childNodes] : [];
  let phase = "loading", elapsed = 0, stamp = null, frame = 0, aim = { x: 0, y: 0 }, power = POWER.ideal;
  let shots = match?.player || [], pending = null, called = null, lastAction = -Infinity;
  let actor = "player", matchLines = null;
  let portraitKey = null;
  let declareTimer = 0, declareNode = null, declareMarker = null, clearedGoals = new Set();
  let held = 0, focusUntil = -1, focusUsed = false, helpPanel = null, coachPanel = null, coachLines = null;
  const taught = new Set();
  const isPaused = () => document.hidden || Boolean(helpPanel || coachPanel);
  const root = el("section.axe-game", { role: "dialog", "aria-modal": "true", "aria-label": "斧投げ・" + rules.throws + "投",
    tabindex: "-1", dataset: { test: "axe-game" }, style: { "--axe-bg": "url('" + ART.bg + "')" } });
  root.dataset.mode = mode;
  root.dataset.tutorial = String(tutorial);
  root.dataset.reducedMotion = String(reducedMotion);
  if (host.id === "stage") root.classList.add("axe-in-stage");
  const round = el("span.axe-round", { dataset: { test: "axe-round" } }), score = el("div.axe-scores");
  const rulesButton = el("button.axe-button.axe-rules-button", { text: "ルール", dataset: { test: "axe-rules" }, onclick: openRules });
  const heading = el("header.axe-header", [el("div", [el("h1", { text: tutorial ? "AXE LESSON" : "AXE THROW" }),
    el("p", { text: tutorial ? "マキの無料1投レッスン" : versus ? "ひよりと10投対戦 · " + DIFFICULTIES[difficulty].name : mode === "league" ? "10投の競技練習" : "3投の練習" })]), round, rulesButton,
    el("button.axe-button.axe-close", { text: "やめる", dataset: { test: "axe-cancel" }, onclick: () => cleanup(false) })]);
  const matchScore = el("div.axe-match-score", { hidden: !versus, "aria-live": "polite", dataset: { test: "axe-match-score" } });
  const matchRecords = el("div.axe-match-records", { hidden: true, dataset: { test: "axe-match-records" } });
  const totalValue = el("strong", { text: "0" });
  const total = el("div.axe-total", { dataset: { test: "axe-total" } }, [
    el("small", { text: versus ? "あなたの合計" : "合計点" }), totalValue, el("span", { text: "/ " + rules.max + "点" }),
  ]);
  heading.insertBefore(total, round);
  const heat = el("span.axe-heat", { hidden: true, "aria-live": "polite", dataset: { test: "axe-heat" } });
  heading.insertBefore(heat, round);
  const goals = el("ul.axe-challenges", { hidden: !challengeIds.length, "aria-label": "この回のチャレンジ", dataset: { test: "axe-challenges" } });
  const portrait = el("img.axe-portrait", { alt: companion?.name || "", dataset: { test: "axe-portrait" } });
  const comment = el("p.axe-comment", { "aria-live": "polite", dataset: { test: "axe-comment" } });
  const companionCard = companion ? el("div.axe-companion", [el("div.axe-portrait-frame", [portrait]), el("div", [el("strong", { text: companion.name }), comment])]) : null;
  const board = svg("svg", { viewBox: "100 10 540 510", class: "axe-target", role: "button", tabindex: "0",
    "aria-label": "的。ゲージ操作中はタップでも止められます", "data-test": "axe-target" });
  board.addEventListener("click", () => { if (cycles[phase]) act(); }, { signal: lifetime.signal });
  board.append(svg("image", { href: ART.board, x: 135, y: 50, width: 390, height: 390 }));
  for (const ring of [...RINGS].reverse()) board.append(svg("circle", { cx: CX, cy: CY, r: R * ring.radius,
    fill: ring.score === 6 ? "#ac382a" : "none", stroke: "#2d2019", "stroke-width": ring.score === 6 ? 2 : 3 }));
  for (const bull of BULLS) for (const [radius, fill] of [[bull.outer, "#bb6a44"], [bull.inner, "#ac382a"]])
    board.append(svg("circle", { cx: CX + bull.x * R, cy: CY + bull.y * R, r: radius * R, fill, stroke: "#241815", "stroke-width": 2 }));
  const markers = new Map();
  for (const target of KILLS) {
    const marker = svg("g", { "data-killshot": target.id }, [
      svg("circle", { cx: CX + target.x * R, cy: CY + target.y * R, r: target.outer * R, fill: "#5cafd6", stroke: "#172640", "stroke-width": 2 }),
      svg("circle", { cx: CX + target.x * R, cy: CY + target.y * R, r: target.inner * R, fill: "#23669f", stroke: "#bd4d43", "stroke-width": 1.5 }),
    ]); board.append(marker); markers.set(target.id, marker);
  }
  const impacts = svg("g", { class: "axe-impacts" });
  // This effect follows the active game clock so rules and background tabs freeze it too.
  const impactRing = svg("circle", { r: 18, fill: "none", "stroke-width": 3 });
  const echoRing = svg("circle", { r: 18, fill: "none", "stroke-width": 1.5 });
  const impactFlash = svg("circle", { r: 30, fill: "#fff5da" });
  const dust = Array.from({ length: 10 }, () => svg("circle", { r: 3, fill: "#d8b477" }));
  const splinters = Array.from({ length: 24 }, (_, i) => svg("path", {
    d: "M0 -3L" + (i % 2 ? 10 : 6) + " 0L0 3Z", fill: i % 3 ? "#e6ba70" : "#fff3d5",
  }));
  const burst = svg("text", { class: "axe-score-burst", "text-anchor": "middle", "font-size": 38,
    "font-weight": 900, "paint-order": "stroke", stroke: "#17120e", "stroke-width": 4 });
  const impactFx = svg("g", { class: "axe-impact-fx", opacity: 0, "aria-hidden": "true", "pointer-events": "none" }, [impactFlash, impactRing, echoRing, ...dust, ...splinters, burst]);
  const trail = svg("path", { class: "axe-flight-trail", fill: "none", stroke: "#f3dbaf", "stroke-width": 4, "stroke-linecap": "round", opacity: 0 });
  const flying = createAxe(); flying.classList.add("axe-flight"); flying.setAttribute("opacity", 0);
  const crosshair = svg("g", { class: "axe-crosshair" }, [svg("circle", { r: 12, fill: "none", stroke: "#fff5d9", "stroke-width": 3 }),
    svg("path", { d: "M-23 0H-7 M7 0H23 M0-23V-7 M0 7V23", stroke: "#fff5d9", "stroke-width": 3 })]);
  for (const node of crosshair.children) node.setAttribute("stroke", "currentColor");
  const fixedAim = svg("g", { class: "axe-fixed-aim" }, [svg("circle", { r: 7, fill: "none", stroke: "#e5bd70", "stroke-width": 2 }),
    svg("path", { d: "M-12 0H12 M0-12V12", stroke: "#e5bd70", "stroke-width": 1 })]);
  const guides = svg("path", { class: "axe-aim-guides", fill: "none", stroke: "#e5bd70", "stroke-width": 1.5, "stroke-dasharray": "5 7" });
  const powerShift = svg("path", { class: "axe-power-shift", fill: "none", stroke: "#aee0c0", "stroke-width": 3 });
  const releaseDot = svg("circle", { class: "axe-release-dot", r: 4, fill: "#aee0c0" });
  const impactMark = svg("g", { class: "axe-impact-mark", opacity: 0 }, [svg("circle", { r: 15, fill: "none", stroke: "#fff5d9", "stroke-width": 2 }),
    svg("circle", { r: 3, fill: "#fff5d9" })]);
  const xNeedle = svg("path", { class: "axe-x-needle", d: "M0 -10V10", stroke: "#91cfe6", "stroke-width": 4 });
  const yNeedle = svg("path", { class: "axe-y-needle", d: "M-10 0H10", stroke: "#e5bd70", "stroke-width": 4 });
  board.append(guides, powerShift, releaseDot, impacts, impactMark, trail, flying, fixedAim, crosshair, impactFx,
    svg("rect", { x: CX - R * 1.08, y: 456, width: R * 2.16, height: 12, rx: 4, fill: "#392743", stroke: "#c4a766" }),
    svg("rect", { x: 558, y: CY - R * 1.08, width: 12, height: R * 2.16, rx: 4, fill: "#392743", stroke: "#c4a766" }),
    svg("text", { x: CX, y: 496, "text-anchor": "middle", fill: "#91cfe6", "font-size": 21 }, ["① 横"]),
    svg("text", { x: 580, y: 252, fill: "#e5bd70", "font-size": 20 }, ["② 縦"]), xNeedle, yNeedle);
  const note = el("p.axe-note", { dataset: { test: "axe-note" } });
  const announcement = el("p.axe-announcement", { "aria-live": "polite", "aria-atomic": "true" });
  const resultLabel = el("span.axe-result-label"), resultNumber = el("span"), resultUnit = el("small", { text: "PTS" });
  const resultValue = el("strong.axe-result-value", [resultNumber, resultUnit]), resultTip = el("p.axe-result-tip");
  const rankLetter = el("strong"), rankTitle = el("span");
  const rankBadge = el("div.axe-rank", { hidden: true, dataset: { test: "axe-rank" } }, [el("small", { text: "RANK" }), rankLetter, rankTitle]);
  const resultCard = el("div.axe-result-card", { hidden: true, dataset: { test: "axe-result" } }, [resultLabel, resultValue, rankBadge, resultTip]);
  const status = el("p.axe-call-status", { dataset: { test: "axe-call-status" } });
  const calls = el("div.axe-calls", [el("button.axe-button", { text: "通常", dataset: { call: "normal" }, onclick: () => selectCall(null) }),
    ...KILLS.map(target => el("button.axe-button", { text: ({ "upper-left": "左上", "upper-right": "右上", "lower-left": "左下", "lower-right": "右下" })[target.id] + "の青",
      dataset: { call: target.id }, onclick: () => selectCall(target.id) }))]);
  const liveValue = el("strong"), liveReason = el("span.axe-live-reason");
  const liveScore = el("div.axe-live-score", { hidden: true, dataset: { test: "axe-live-score" } }, [el("span.axe-live-label", { text: "今の照準" }), liveValue, liveReason]);
  const needle = el("span.axe-needle", { dataset: { test: "axe-needle" } });
  const steps = el("ol.axe-steps", { "aria-label": "投げるまでの3段階", dataset: { test: "axe-steps" } },
    ["① 横", "② 縦", "③ 力"].map((text, i) => el("li", { dataset: { step: ["horizontal", "vertical", "power"][i] } },
      [el("span", { text }), el("strong", { text: "未確定" })])));
  const powerLabel = el("span.axe-power-label", { text: "③ 投げる力" });
  const powerReadout = el("strong.axe-power-readout", { dataset: { test: "axe-power-cue" } });
  const powerFill = el("span.axe-power-fill");
  const gauge = el("div.axe-gauge", { role: "img", "aria-label": "力ゲージ。緑の帯が適切な力" }, [
    el("span.axe-stick", { style: { left: POWER.stickMin * 100 + "%", width: (POWER.stickMax - POWER.stickMin) * 100 + "%" } }),
    el("span.axe-sweet", { style: { left: POWER.sweetMin * 100 + "%", width: (POWER.sweetMax - POWER.sweetMin) * 100 + "%" } }), powerFill, needle]);
  const timing = el("div.axe-timing", [powerLabel, powerReadout, gauge]);
  const feedback = el("p.axe-feedback", { dataset: { test: "axe-feedback" } });
  const action = el("button.axe-button.axe-primary", { dataset: { test: "axe-action" }, onclick: act });
  const steadiness = el("p.axe-steadiness", { dataset: { test: "axe-steadiness" } });
  const stability = el("div.axe-stability-meter", { role: "meter", "aria-label": "腕の安定", "aria-valuemin": "0", "aria-valuemax": "100" }, [el("i")]);
  const focusButton = el("button.axe-button", { text: "息を整える · 1回", dataset: { test: "axe-focus" }, onclick: focusAim });
  function focusAim() {
    if (actor !== "player" || isPaused() || !cycles[phase] || focusUsed || performance.now() - lastAction < 250) return;
    focusUsed = true; focusUntil = held + SWAY.focusDuration; SE.select(); render();
  }
  const reaim = el("button.axe-button.axe-reaim", { text: "構え直す", dataset: { test: "axe-reaim" }, onclick: () => {
    if (actor === "player" && !isPaused() && performance.now() - lastAction >= 250 && ["horizontal", "vertical", "power"].includes(phase)) {
      lastAction = performance.now(); aim = { x: 0, y: 0 }; power = POWER.ideal; held = 0; focusUntil = -1; setPhase("choice");
    }
  } });
  const retry = el("button.axe-button.axe-retry", { text: "もう一度", dataset: { test: "axe-retry" }, onclick: () => {
    if (!isPaused() && performance.now() - lastAction >= 250 && phase === "summary") {
      lastAction = performance.now(); if (versus) match = createMatch(difficulty, seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
      actor = "player"; shots = match?.player || []; called = null; aim = { x: 0, y: 0 }; power = POWER.ideal; held = 0; focusUntil = -1; focusUsed = false; impacts.replaceChildren(); taught.clear(); clearedGoals = new Set(); setPhase("choice");
    }
  } });
  const controls = el("div.axe-controls", [focusButton, reaim]);
  const keyhint = el("p.axe-keyhint", { text: "ボタン / 的をタップ / Space・Enter" });
  const boardPane = el("div.axe-board-pane", [
    el("p.axe-legend", { text: "赤6点 · リング1〜5点 · 宣言した青7／8点" }), board]),
    panel = el("aside.axe-panel", [matchScore, score, goals, companionCard, matchRecords, status, calls, steps, note, liveScore, resultCard, timing, feedback, steadiness, stability, action, keyhint, controls, retry]);
  const body = el("div.axe-body", [boardPane, panel]);
  root.append(heading, body, announcement);
  host.append(root); root.focus();
  root.addEventListener("keydown", key, { signal: lifetime.signal });
  root.addEventListener("pointerup", event => event.stopPropagation(), { signal: lifetime.signal });
  document.addEventListener("visibilitychange", () => { stamp = null; render(); }, { signal: lifetime.signal });
  signal?.addEventListener("abort", () => cleanup(false), { once: true, signal: lifetime.signal });
  window.addEventListener("pagehide", () => cleanup(false), { signal: lifetime.signal });
  loadArt(); frame = requestAnimationFrame(tick); return promise;
  function showFace(face) {
    const url = faceArt(portraitKey, face);
    if (portrait.src === url) return;
    const focus = portraitFocus(opponent, face);
    portrait.style.setProperty("--focus-x", focus.x); portrait.style.setProperty("--focus-y", focus.y);
    portrait.src = url;
  }
  function openRules() {
    if (helpPanel || coachPanel || phase === "closed") return;
    helpPanel = axeRules(() => {
      helpPanel.remove(); helpPanel = null; heading.inert = body.inert = false;
      stamp = null; render(); rulesButton.focus();
    });
    heading.inert = body.inert = true;
    root.append(helpPanel); stamp = null; render(); helpPanel.querySelector("button").focus();
  }
  function teach(id) {
    if (!tutorial || !coachLines || coachPanel || phase === "closed") return;
    const ids = ["welcome", "target", "horizontal", "vertical", "power", "result", "finish"];
    const titles = { welcome: "マキと、まずは一投。", target: "赤と青、得点の違い", horizontal: "① 横の位置を止める", vertical: "② 縦の位置を止める", power: "③ 緑の力で投げる", result: "今の一投を振り返ろう", finish: "レッスン完了" };
    const last = shots.at(-1);
    const text = coachLines[id] + (id === "result" && last ? ` 今回は${last.score}点。${shotFeedback(last).tip}` : "");
    const close = () => {
      coachPanel.remove(); coachPanel = null; heading.inert = body.inert = false;
      stamp = null; render(); root.focus();
    };
    coachPanel = coachDialog({ text, title: titles[id], step: ids.indexOf(id) + 1, total: ids.length, kind: id,
      onNext: () => { close(); if (id === "welcome") teach("target"); else if (id === "finish") cleanup(true); },
      onSkip: () => cleanup(false) });
    coachPanel.dataset.lesson = id;
    heading.inert = body.inert = true;
    root.append(coachPanel); stamp = null; render(); coachPanel.querySelector('[data-test="axe-coach-next"]').focus();
  }
  function loadArt() {
    setPhase("loading");
    const timeout = new AbortController(), timer = setTimeout(() => timeout.abort(), 15000);
    const stopTimer = () => clearTimeout(timer);
    lifetime.signal.addEventListener("abort", stopTimer, { once: true });
    fetch(new URL("../../data/manifest.json", import.meta.url), { cache: "no-cache", signal: AbortSignal.any([lifetime.signal, timeout.signal]) })
      .then(response => { if (!response.ok) throw new Error("Axe artwork catalogue unavailable"); return response.json(); })
      .then(manifest => {
        if (phase === "closed") return;
        const lessonArt = [];
        if (tutorial) {
          if (!manifest.portraits?.maki?.faces?.includes("normal")) throw new Error("Teacher artwork missing from catalogue");
          lessonArt.push(decodeArt(faceArt("maki", "normal")),
            fetch(new URL("../../../data/dialogue/axe_tutorial.json", import.meta.url), { signal: AbortSignal.any([lifetime.signal, timeout.signal]) })
              .then(response => { if (!response.ok) throw new Error("Axe lesson unavailable"); return response.json(); })
              .then(data => {
                coachLines = Object.fromEntries(data.dialogues.map(dialogue => [dialogue.lines[0].id, dialogue.lines.map(line => line.text).join("\n")]));
                if (!["welcome", "target", "horizontal", "vertical", "power", "result", "finish"].every(id => typeof coachLines[id] === "string"))
                  throw new Error("Axe lesson incomplete");
              }));
        }
        if (!companion) return Promise.all([...Object.values(ART).map(decodeArt), ...lessonArt]);
        portraitKey = companion.portraitKey || manifest.titleArts?.find(entry => entry.file.endsWith(companion.titleSuffix))?.character;
        if (!portraitKey || !companion.faces.every(face => manifest.portraits?.[portraitKey]?.faces?.includes(face)))
          throw new Error("Companion artwork missing from catalogue");
        showFace(companion.faces[0]);
        return Promise.all([
          ...[...Object.values(ART), ...companion.faces.map(face => faceArt(portraitKey, face))].map(decodeArt),
          ...(versus ? [fetch(new URL("../../../data/dialogue/axe_versus.json", import.meta.url), { signal: AbortSignal.any([lifetime.signal, timeout.signal]) })
            .then(response => { if (!response.ok) throw new Error("Axe match dialogue unavailable"); return response.json(); })
            .then(data => {
              matchLines = Object.fromEntries(data.axe_versus.lines.map(line => [line.id, line.text]));
              if (!["before", "call", "hit", "bull", "killshot", "killshot-miss", "miss", "drop", "ahead", "behind", "level", "player", "opponent", "draw"].every(key => typeof matchLines[key] === "string"))
                throw new Error("Axe match dialogue incomplete");
            })] : []),
        ]);
      })
      .then(() => { if (phase !== "closed") setPhase("choice"); }, () => { if (phase !== "closed") setPhase("failed"); })
      .finally(() => { stopTimer(); lifetime.signal.removeEventListener("abort", stopTimer); });
  }
  function selectCall(id) {
    if (actor !== "player" || phase !== "choice" || isPaused() || performance.now() - lastAction < 250 || id && !canCall(id, shots)) return;
    const cue = declarationCue(called, id);
    called = id; render();
    if (cue) showDeclareCue(cue);
  }
  function showDeclareCue(cue) {
    clearDeclareCue();
    declareMarker = markers.get(cue.target) || null;
    declareMarker?.classList.add("axe-declare-flash");
    declareNode = el("div.axe-declare", { "aria-hidden": "true", dataset: { test: cue.test || "axe-declare", kind: cue.kind || "declare" } }, [
      el("strong", { text: cue.label }), el("span", { text: cue.place }),
    ]);
    root.append(declareNode);
    SE.good();
    declareTimer = setTimeout(clearDeclareCue, cue.duration || 950);
  }
  /** Big moments only: the final throw, and a goal clearing on this throw. */
  function phaseCue(next) {
    if (tutorial || isPaused()) return;
    if (next === "choice" && actor === "player" && rules.throws > 1 && shots.length === rules.throws - 1) {
      const gap = versus ? matchResult(match).playerTotal - matchResult(match).opponentTotal : 0;
      showDeclareCue({ label: "LAST THROW", kind: "last", test: "axe-last-cue", duration: 1300,
        place: !versus ? "最後の一投" : gap > 0 ? gap + "点リード · 逃げ切れ" : gap < 0 ? -gap + "点差 · 逆転を狙え" : "同点 · この一投で決まる" });
    } else if (next === "result" && actor === "player" && challengeIds.length) {
      const fresh = evaluateChallenges(challengeIds, shots).filter(c => c.state === "done" && !clearedGoals.has(c.id));
      fresh.forEach(c => clearedGoals.add(c.id));
      if (fresh.length) showDeclareCue({ label: "CHALLENGE CLEAR", kind: "goal", test: "axe-goal-cue", duration: 1400, place: fresh.map(c => c.label).join(" / ") });
    }
  }
  function clearDeclareCue() {
    clearTimeout(declareTimer); declareTimer = 0;
    declareNode?.remove(); declareNode = null;
    declareMarker?.classList.remove("axe-declare-flash"); declareMarker = null;
  }
  function setPhase(next) {
    clearDeclareCue();
    phase = next; elapsed = 0; stamp = null;
    phaseCue(next);
    if (next === "flight") {
      const pose = flightPose(pending, reducedMotion ? FLIGHT.travel + FLIGHT.fall : 0);
      renderAxe(flying, pose); flying.setAttribute("opacity", pose.opacity);
    }
    render();
    if (tutorial && coachLines && !taught.has(next) && ["choice", "horizontal", "vertical", "power", "result", "summary"].includes(next)) {
      taught.add(next); teach(({ choice: "welcome", summary: "finish" })[next] || next);
    }
  }
  function act() {
    if (isPaused() || !["choice", "horizontal", "vertical", "power", "result", "summary", "failed"].includes(phase)
      || cycles[phase] && elapsed < 250 || performance.now() - lastAction < 250) return;
    lastAction = performance.now(); unlockAudio();
    if (phase === "failed") loadArt();
    else if (phase === "choice") { held = 0; SE.select(); setPhase("horizontal"); }
    else if (phase === "horizontal") { aim.x = axisAt(gaugeAt(elapsed, cycles.horizontal)); SE.select(); setPhase("vertical"); }
    else if (phase === "vertical") { aim.y = axisAt(gaugeAt(elapsed, cycles.vertical)); SE.select(); setPhase("power"); }
    else if (phase === "power") {
      power = gaugeAt(elapsed, cycles.power);
      const release = releaseAimAt(aim, held, power, shots.length, held < focusUntil);
      pending = { ...resolveThrow({ x: release.x, y: release.y, power, called }, shots), baseAim: { ...aim }, sway: release.sway };
      SE.whoosh(); setPhase("flight");
    }
    else if (phase === "result") {
      if (versus && actor === "player") {
        actor = "opponent";
        const input = planOpponent(match);
        pending = { ...resolveThrow(input, match.opponent), baseAim: { x: input.x, y: input.y },
          sway: { x: 0, y: 0, amplitude: 0, fatigue: 0, focused: false } };
        aim = { ...pending.aim }; power = pending.power; called = pending.called;
        impacts.replaceChildren(); setPhase("opponent-ready");
      } else if (versus ? turnOf(match) === null : shots.length === rules.throws) setPhase("summary");
      else { actor = "player"; called = null; aim = { x: 0, y: 0 }; power = POWER.ideal; held = 0; focusUntil = -1; focusUsed = false; impacts.replaceChildren(); setPhase("choice"); }
    } else if (phase === "summary") cleanup(true);
  }
  function key(event) {
    if (event.key === "Tab") {
      const nodes = [...root.querySelectorAll('button:not([disabled]):not([hidden]),.axe-target[aria-disabled="false"]')].filter(n => n.getClientRects().length);
      const index = nodes.indexOf(document.activeElement);
      nodes[(index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length]?.focus(); event.preventDefault(); event.stopPropagation(); return;
    }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cleanup(false); return; }
    if (event.key.toLowerCase() === "f" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); event.stopPropagation(); if (!event.repeat) focusAim(); return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.stopPropagation();
      if (event.target.tagName === "BUTTON") { if (event.repeat) event.preventDefault(); return; }
      event.preventDefault(); if (!event.repeat) act();
    }
  }
  function render() {
    const focusedButton = document.activeElement?.tagName === "BUTTON" && root.contains(document.activeElement) ? document.activeElement : null;
    if (phase === "horizontal") aim.x = axisAt(gaugeAt(elapsed, cycles.horizontal));
    if (phase === "vertical") aim.y = axisAt(gaugeAt(elapsed, cycles.vertical));
    if (phase === "power") power = gaugeAt(elapsed, cycles.power);
    const moving = Boolean(cycles[phase]);
    const currentShots = versus ? match[actor] : shots;
    const displayedShot = ["flight", "opponent-ready"].includes(phase) ? pending : ["result", "summary"].includes(phase) ? currentShots.at(-1) : null;
    const release = displayedShot?.aim || releaseAimAt(aim, moving ? held : 0, power, shots.length, moving && held < focusUntil);
    const landing = displayedShot?.landing || (moving ? { x: release.x, y: release.y + (phase === "power" ? (POWER.ideal - power) * .28 : 0) } : aim);
    root.dataset.actor = actor; root.dataset.playerThrows = String(shots.length);
    root.dataset.opponentThrows = String(match?.opponent.length || 0);
    root.dataset.phase = phase; root.dataset.timing = String(gaugeAt(elapsed, cycles[phase] || 3200));
    root.dataset.outcome = displayedShot?.outcome || "";
    root.dataset.special = String(Boolean(displayedShot) && impactFeedback(displayedShot).special);
    root.dataset.focused = String(moving && held < focusUntil);
    root.dataset.aimX = String(aim.x); root.dataset.aimY = String(aim.y); root.dataset.power = String(power);
    root.dataset.paused = String(isPaused()); root.dataset.called = called || "";
    // Secondary readouts stay for screen readers; the board and gauge already show them.
    for (const node of [powerLabel, feedback, steadiness, keyhint]) node.classList.add("axe-quiet");
    note.classList.toggle("axe-quiet", !["choice", "loading", "failed", "opponent-ready"].includes(phase));
    root.dataset.held = String(held); root.dataset.focusRemaining = String(Math.max(0, focusUntil - held));
    root.dataset.releaseX = String(release.x); root.dataset.releaseY = String(release.y);
    root.dataset.landingX = String(landing.x); root.dataset.landingY = String(landing.y);
    const phaseIndex = ["horizontal", "vertical", "power"].indexOf(phase);
    liveScore.hidden = !moving;
    if (moving) {
      const preview = resolveThrow({ x: release.x, y: release.y, power: phase === "power" ? power : POWER.ideal, called }, shots);
      root.dataset.previewScore = String(preview.score); root.dataset.previewOutcome = preview.outcome;
      liveValue.textContent = preview.score + "点";
      crosshair.style.color = preview.score > 0 ? "#f8fff1" : "#f0a58b";
      liveReason.textContent = preview.outcome === "drop" ? preview.dropReason === "weak" ? "力が弱い・落下" : "力が強い・回転が合わず落下"
        : called && !preview.score ? "宣言した青以外は0点" : "";
    } else { root.dataset.previewScore = ""; root.dataset.previewOutcome = ""; }
    const axisText = (value, negative, positive) => Math.abs(value) < .035 ? "中央" : (value < 0 ? negative : positive) + Math.round(Math.abs(value) / 1.08 * 100) + "%";
    for (const [i, step] of [...steps.children].entries()) {
      const locked = Boolean(displayedShot) || phaseIndex > i, live = phaseIndex === i;
      step.dataset.state = live ? "live" : locked ? "locked" : "waiting";
      if (live) step.setAttribute("aria-current", "step"); else step.removeAttribute("aria-current");
      const value = i === 0 ? axisText(aim.x, "左", "右") : i === 1 ? axisText(aim.y, "上", "下") : Math.round(power * 100) + "%";
      step.lastChild.textContent = locked ? "✓ " + value : live ? value : "未確定";
    }
    const powerActive = phase === "power" || Boolean(displayedShot), shift = (POWER.ideal - power) * .28;
    const strength = power < POWER.stickMin ? "弱すぎる・落下" : power > POWER.stickMax ? "強すぎる・落下"
      : power >= POWER.sweetMin && power <= POWER.sweetMax ? "適正" : "刺さる力";
    powerLabel.textContent = powerActive ? "③ 投げる力 " + Math.round(power * 100) + "% · " + strength : "③ 投げる力";
    timing.dataset.quality = strength === "適正" ? "sweet" : power < POWER.stickMin || power > POWER.stickMax ? "drop" : "edge";
    powerReadout.textContent = phase !== "power" ? strength : strength === "適正" ? "いま投げる！" : power < POWER.sweetMin ? "緑の帯まで待つ" : "強すぎる · 次の緑で投げる";
    powerFill.style.width = power * 100 + "%";
    gauge.setAttribute("aria-label", powerLabel.textContent + "。緑は適正、茶色は刺さる範囲");
    const shiftText = Math.abs(shift) < .006 ? "力による上下ずれなし" : "力の補正 " + (shift > 0 ? "↓ 下" : "↑ 上") + Math.round(Math.abs(shift) * 100) + "%";
    feedback.textContent = powerActive ? shiftText + " · 白が着地点" : "針から伸びる線で位置を確認";
    timing.hidden = !moving && !displayedShot;
    timing.dataset.active = String(powerActive); feedback.hidden = ["loading", "failed", "summary"].includes(phase);
    round.textContent = (versus ? (actor === "player" ? "あなた " : "ひより ") : "") + Math.min(currentShots.length + (["result", "summary"].includes(phase) ? 0 : 1), rules.throws) + " / " + rules.throws + " 投";
    totalValue.textContent = String(totalOf(shots));
    const heatValue = actor === "player" && !tutorial ? heatOf(shots) : 0;
    root.dataset.heat = String(heatValue);
    heat.hidden = heatValue < 2;
    if (!heat.hidden && heat.textContent !== "連続 ×" + heatValue) heat.textContent = "連続 ×" + heatValue;
    if (challengeIds.length) {
      const finished = phase === "summary", goalState = evaluateChallenges(challengeIds, shots, finished);
      const goalRecord = goalState.map(c => c.state + c.value).join(",");
      goals.hidden = moving || ["flight", "opponent-ready", "loading", "failed"].includes(phase);
      if (goals.dataset.record !== goalRecord) {
        goals.dataset.record = goalRecord;
        goals.replaceChildren(...goalState.map(c => el("li", { dataset: { state: c.state, goal: c.id }, title: c.label,
          "aria-label": c.label + (c.state === "done" ? "・達成" : c.state === "failed" ? "・未達成" : c.end ? "・継続中" : "・" + c.value + "/" + c.goal) }, [
          el("i", { text: c.state === "done" ? "✓" : c.state === "failed" ? "×" : "◇", "aria-hidden": "true" }),
          el("span", { text: c.short }),
          c.state === "open" && !c.end && c.goal > 1 ? el("small", { text: c.value + "/" + c.goal }) : null,
        ])));
      }
    }
    const record = currentShots.map(shot => shot.score + ":" + shot.outcome).join(",") + ":" + phase;
    if (score.dataset.record !== record) {
      score.dataset.record = record;
      score.replaceChildren(...Array.from({ length: rules.throws }, (_, i) => el("span", {
        dataset: { outcome: currentShots[i]?.outcome || "", filled: String(Boolean(currentShots[i])),
          current: String(i === (["result", "summary"].includes(phase) ? currentShots.length - 1 : currentShots.length)) },
        "aria-label": (i + 1) + "投目 " + (currentShots[i] ? currentShots[i].score + "点" : "未投擲"),
        title: currentShots[i] ? (i + 1) + "投目 " + currentShots[i].score + "点" : (i + 1) + "投目",
      }, [el("i", { text: String(i + 1) }), el("strong", { text: currentShots[i] ? String(currentShots[i].score) : "—" })])));
    }
    if (versus) {
      const totals = matchResult(match);
      matchScore.textContent = "あなた " + totals.playerTotal + " — " + totals.opponentTotal + " ひより";
      matchRecords.hidden = phase !== "summary";
      score.hidden = phase === "summary";
      if (phase === "summary" && matchRecords.dataset.record !== JSON.stringify(match)) {
        matchRecords.dataset.record = JSON.stringify(match);
        matchRecords.replaceChildren(...["player", "opponent"].map(id => el("div", [
          el("strong", { text: id === "player" ? "あなた" : "ひより" }),
          el("p", { text: match[id].map((shot, i) => (i + 1) + ":" + shot.score).join(" · ") }),
        ])));
      }
    }
    const ks = killState(currentShots);
    const targetNames = { "upper-left": "左上", "upper-right": "右上", "lower-left": "左下", "lower-right": "右下" };
    status.textContent = called ? "宣言中：" + targetNames[called] + "の青 · 青以外0点"
      : "キルショット（青 7／8点） · 残り" + ks.remaining + "回";
    for (const button of calls.children) {
      const id = button.dataset.call;
      button.disabled = isPaused() || performance.now() - lastAction < 250 || phase !== "choice" || id !== "normal" && !canCall(id, shots);
      button.setAttribute("aria-pressed", String((called || "normal") === id));
      if (id !== "normal") {
        const target = KILLS.find(t => t.id === id), closed = ks.closed.includes(target.row);
        button.title = closed ? "この高さは成功済み・閉鎖中" : ks.remaining === 0 ? "宣言を2回使いました" : "宣言した青に命中で7／8点。外すと0点";
        button.dataset.closed = String(closed);
        const label = targetNames[id] + (closed ? " 閉鎖" : "の青");
        if (button.textContent !== label) button.textContent = label;
      }
    }
    for (const target of KILLS) {
      const marker = markers.get(target.id); marker.setAttribute("opacity", ks.closed.includes(target.row) ? .22 : 1);
      marker.style.filter = called === target.id ? "drop-shadow(0 0 6px #fff5b1)" : "";
    }
    if (companion) {
      const context = { heat: heatOf(shots), last: shots.length === rules.throws - 1, grade: phase === "summary" ? gradeOf(totalOf(shots), rules.max) : null };
      const line = versus && matchLines ? matchReaction(matchLines, phase, match, actor, pending, called, context) : reaction(opponent, phase, shots, called, context);
      if (comment.textContent !== line.text) comment.textContent = line.text;
      if (portraitKey) showFace(line.face);
    }
    crosshair.setAttribute("transform", "translate(" + (CX + landing.x * R) + " " + (CY + landing.y * R) + ")");
    fixedAim.setAttribute("transform", "translate(" + (CX + aim.x * R) + " " + (CY + aim.y * R) + ")");
    fixedAim.setAttribute("opacity", moving ? .8 : 0);
    guides.setAttribute("d", `M${CX + aim.x * R} 456V${CY + aim.y * R}H558`);
    guides.setAttribute("opacity", moving ? .55 : 0);
    powerShift.setAttribute("d", `M${CX + release.x * R} ${CY + release.y * R}V${CY + landing.y * R}`);
    powerShift.setAttribute("opacity", phase === "power" ? 1 : 0);
    releaseDot.setAttribute("cx", CX + release.x * R); releaseDot.setAttribute("cy", CY + release.y * R);
    releaseDot.setAttribute("opacity", phase === "power" ? 1 : 0);
    impactMark.setAttribute("transform", `translate(${CX + landing.x * R} ${CY + landing.y * R})`);
    impactMark.setAttribute("opacity", displayedShot ? .85 : 0);
    impactMark.style.color = displayedShot?.score > 0 ? "#fff4cb" : "#ef9f86";
    for (const node of impactMark.children) { node.setAttribute("stroke", "currentColor"); if (node.getAttribute("fill") !== "none") node.setAttribute("fill", "currentColor"); }
    crosshair.style.opacity = ["choice", "horizontal", "vertical", "power"].includes(phase) ? "1" : "0";
    xNeedle.setAttribute("transform", "translate(" + (CX + aim.x * R) + " 462)");
    yNeedle.setAttribute("transform", "translate(564 " + (CY + aim.y * R) + ")");
    xNeedle.setAttribute("opacity", phase === "horizontal" ? 1 : .5); yNeedle.setAttribute("opacity", phase === "vertical" ? 1 : .5);
    if (phase !== "flight") { flying.setAttribute("opacity", 0); trail.setAttribute("opacity", 0); }
    needle.style.left = power * 100 + "%";
    calls.hidden = phase !== "choice"; reaim.hidden = !cycles[phase]; retry.hidden = !allowRetry || phase !== "summary";
    controls.hidden = steadiness.hidden = !moving;
    focusButton.disabled = isPaused() || focusUsed || performance.now() - lastAction < 250;
    const remaining = Math.max(0, focusUntil - held);
    const fatigue = (displayedShot?.sway || release.sway).fatigue;
    stability.hidden = !moving;
    stability.dataset.focused = String(remaining > 0);
    const stabilityValue = remaining > 0 ? remaining / SWAY.focusDuration : 1 - fatigue;
    stability.style.setProperty("--axe-steady", (stabilityValue * 100).toFixed(1) + "%");
    stability.setAttribute("aria-label", remaining > 0 ? "集中の残り時間" : "腕の安定");
    stability.setAttribute("aria-valuenow", String(Math.round(stabilityValue * 100)));
    const focusText = remaining > 0 ? "集中中" : focusUsed ? "集中は使用済み" : "息を整える · 1回";
    if (focusButton.textContent !== focusText) focusButton.textContent = focusText;
    const steadyText = remaining > 0 ? "集中 · あと" + (remaining / 1000).toFixed(1) + "秒"
      : "腕の疲れ " + ((displayedShot?.sway || release.sway).fatigue < .3 ? "小" : (displayedShot?.sway || release.sway).fatigue < .7 ? "中" : "大") + " · 白い刃先を見よう";
    if (steadiness.textContent !== steadyText) steadiness.textContent = steadyText;
    keyhint.hidden = !moving;
    keyhint.textContent = phase === "power" ? "緑の帯でタップ / Space・Enter · Fで集中" : "的をタップ / Space・Enterで止める · Fで集中";
    board.setAttribute("aria-disabled", String(!moving || actor !== "player" || isPaused()));
    board.setAttribute("aria-label", moving ? ({ horizontal: "横", vertical: "縦", power: "力" })[phase] + "ゲージ。タップまたはSpaceで止める" : "斧投げの的。赤6点・リング1〜5点・宣言した青7／8点");
    reaim.disabled = retry.disabled = isPaused() || performance.now() - lastAction < 250;
    action.disabled = isPaused() || ["loading", "flight", "opponent-ready"].includes(phase) || cycles[phase] && elapsed < 250 || performance.now() - lastAction < 250;
    const nextAction = { loading: "読み込み中…", failed: "もう一度読み込む", choice: "構える", horizontal: "横を止める", vertical: "縦を止める", power: strength === "適正" ? "いま投げる！" : "緑の帯で投げる",
      "opponent-ready": "ひよりが構えています…", flight: "飛んでいく…", result: versus ? actor === "player" ? "ひよりの番へ" : turnOf(match) === null ? "結果を見る" : "あなたの番へ" : shots.length === rules.throws ? "結果を見る" : "次の投へ", summary: "終了" }[phase] || "";
    if (action.textContent !== nextAction) action.textContent = nextAction;
    const last = currentShots.at(-1);
    resultCard.hidden = !["result", "summary"].includes(phase);
    rankBadge.hidden = phase !== "summary" || tutorial;
    if (!resultCard.hidden) {
      if (phase === "summary") {
        const stats = sessionStats(shots);
        resultLabel.textContent = tutorial ? "LESSON COMPLETE" : versus ? ({ player: "YOU WIN", opponent: "GOOD MATCH", draw: "DRAW" })[matchResult(match).winner]
          : ({ great: "GREAT THROWING", good: "NICE SESSION", again: "KEEP THROWING" })[gradeOf(totalOf(shots), rules.max)];
        resultNumber.textContent = String(totalOf(shots)); resultUnit.textContent = "/ " + rules.max;
        const goalsDone = evaluateChallenges(challengeIds, shots, true).filter(c => c.state === "done").length;
        resultTip.textContent = "ブル " + stats.bulls + "回 · キルショット " + stats.killshots + "回 · 平均 " + stats.average.toFixed(1) + "点"
          + (challengeIds.length ? " · チャレンジ " + goalsDone + "/" + challengeIds.length : "");
        rankBadge.dataset.rank = tutorial ? "" : rankOf(totalOf(shots), rules.max);
        rankLetter.textContent = rankBadge.dataset.rank; rankTitle.textContent = tutorial ? "" : "「" + titleOf(shots, rules.max) + "」";
      } else {
        const feedback = shotFeedback(last);
        resultLabel.textContent = feedback.label;
        resultNumber.textContent = "+" + last.score; resultUnit.textContent = "PTS";
        resultTip.textContent = actor === "player" ? feedback.tip : "ひよりの一投 · 力 " + Math.round(last.power * 100) + "%";
      }
    }
    drawImpact(displayedShot);
    const nextNote = document.hidden ? "一時停止中" : phase === "loading" ? "準備しています…" : phase === "failed" ? "画像を読み込めませんでした。もう一度お試しください。"
      : phase === "choice" ? shots.length === 5 ? "後半5投。キルショットの閉鎖は引き継ぎます。" : !tutorial && rules.throws > 1 && shots.length === rules.throws - 1 ? lastNote() : "狙いを決めて、構える。" : phase === "horizontal" ? "① 横の位置を止めよう" : phase === "vertical" ? "② 縦の位置を止めよう"
      : phase === "opponent-ready" ? called ? "ひよりがキルショットを宣言" : "ひよりの投擲を見よう" : phase === "power" ? "③ 白い着地点＋緑の力で投げる" : phase === "flight" ? "それっ！"
      : phase === "result" ? last.outcome === "drop" ? (last.dropReason === "weak" ? "力が足りず落下 · 0点" : "回転が合わず落下 · 0点") : last.outcome === "killshot" ? "キルショット！ " + last.score + "点"
      : last.outcome === "killshot-miss" ? "宣言した青い的から外れた · 0点" : last.score ? (last.outcome === "bull" ? "ど真ん中！ " : "命中！ ") + last.score + "点" : "的の外 · 0点"
      : "合計 " + totalOf(shots) + " / " + rules.max + "点";
    const finalNote = versus && phase === "summary" ? ({ player: "あなたの勝ち", opponent: "ひよりの勝ち", draw: "引き分け · 延長なし" })[matchResult(match).winner] : nextNote;
    if (note.textContent !== finalNote) note.textContent = finalNote;
    if (announcement.textContent !== finalNote) announcement.textContent = finalNote;
    // Disabling a focused native button otherwise sends Space/Enter to the VN below.
    if (focusedButton?.disabled) root.focus();
  }
  function lastNote() {
    if (!versus) return "ラスト1投。いま合計" + totalOf(shots) + "点。";
    const { playerTotal: p, opponentTotal: o } = matchResult(match);
    return "ラスト1投。" + (p > o ? p - o + "点リード、ひよりの最後の一投が残る。" : p < o ? o - p + "点差。ここで詰めたい。" : "同点。この一投が流れを決める。");
  }
  function drawImpact(shot) {
    const effect = impactFeedback(shot);
    const show = phase === "result" && effect.hit && !reducedMotion && elapsed < effect.duration;
    impactFx.setAttribute("opacity", show ? Math.min(1, (1 - elapsed / effect.duration) * 2) : 0);
    boardPane.style.transform = "";
    total.style.setProperty("--score-glow", "0");
    if (!show) return;
    const progress = Math.min(1, elapsed / effect.duration), x = CX + shot.landing.x * R, y = CY + shot.landing.y * R;
    const color = effect.color, recoil = Math.max(0, 1 - elapsed / 260) ** 2 * effect.strength * (effect.special ? 1.6 : 1);
    boardPane.style.transform = `translate(${Math.sin(elapsed * .12) * recoil}px, ${Math.cos(elapsed * .15) * recoil * .65}px)`;
    total.style.setProperty("--score-glow", String(Math.max(0, 1 - progress)));
    impactFx.setAttribute("transform", `translate(${x} ${y})`);
    impactFlash.setAttribute("r", 8 + Math.min(1, elapsed / 130) * (effect.special ? 55 : 35));
    impactFlash.setAttribute("opacity", Math.max(0, 1 - elapsed / (effect.special ? 220 : 150)) * (effect.special ? .9 : .7));
    impactRing.setAttribute("r", 8 + Math.sqrt(progress) * (effect.special ? 130 : shot.score >= 6 ? 100 : 65));
    impactRing.setAttribute("stroke", color);
    impactRing.setAttribute("opacity", (1 - progress) * .8);
    echoRing.setAttribute("r", 5 + Math.sqrt(progress) * (shot.score >= 6 ? 70 : 44));
    echoRing.setAttribute("stroke", color); echoRing.setAttribute("opacity", (1 - progress) * .5);
    for (const [i, mote] of dust.entries()) {
      const angle = i * 2.4, distance = 8 + progress * (28 + i * 4);
      mote.setAttribute("cx", Math.cos(angle) * distance); mote.setAttribute("cy", Math.sin(angle) * distance + progress * 12);
      mote.setAttribute("r", 2 + progress * 7); mote.setAttribute("opacity", (1 - progress) * .25);
    }
    for (const [i, shard] of splinters.entries()) {
      const angle = i * 137.5, radian = angle * Math.PI / 180, distance = 6 + progress * (i % 3 ? 65 : 105);
      shard.setAttribute("transform", `translate(${Math.cos(radian) * distance} ${Math.sin(radian) * distance + progress * progress * 55}) rotate(${angle + progress * 200}) scale(${(1 - progress * .8) * (i % 2 ? .65 : 1)})`);
    }
    burst.textContent = "+" + shot.score;
    burst.setAttribute("y", -32 - progress * 38); burst.setAttribute("fill", color);
  }
  function tick(now) {
    if (phase === "closed") return;
    if (!host.isConnected || !root.isConnected || callerScreen && (!callerScreen.isConnected
      || callerScreen.childNodes.length !== callerContent.length
      || callerContent.some((node, i) => callerScreen.childNodes[i] !== node))) { cleanup(false); return; }
    const delta = stamp === null ? 0 : Math.min(50, Math.max(0, now - stamp)); stamp = now;
    if (!isPaused()) { elapsed += delta; if (cycles[phase]) held += delta; }
    if (phase === "opponent-ready" && !isPaused() && elapsed >= 1000) {
      SE.whoosh(); setPhase("flight");
    }
    if (phase === "flight" && !isPaused()) {
      const pose = flightPose(pending, reducedMotion ? FLIGHT.travel + FLIGHT.fall : elapsed);
      if (!reducedMotion && elapsed < FLIGHT.travel) {
        const points = [130, 65, 0].map(offset => flightPose(pending, Math.max(0, elapsed - offset)));
        trail.setAttribute("d", points.map((p, i) => `${i ? "L" : "M"}${p.bladeX} ${p.bladeY}`).join(" "));
        trail.setAttribute("opacity", .22 * Math.min(1, elapsed / 150));
      } else trail.setAttribute("opacity", 0);
      renderAxe(flying, pose); flying.setAttribute("opacity", pose.opacity);
      if (pose.done) {
        let shot = pending;
        if (versus) {
          match = takeTurn(match, actor, { ...shot.aim, power: shot.power, called: shot.called, baseAim: shot.baseAim, sway: shot.sway });
          shots = match.player; shot = match[actor].at(-1);
        } else shots.push(shot);
        pending = null;
        if (shot.score > 0) { SE.hit(); if (shot.score >= 6) SE.perfect(); } else SE.miss();
        if (shot.stuck) { const embedded = createAxe(); renderAxe(embedded, impactPose(shot)); embedded.dataset.scored = String(shot.score > 0); impacts.append(embedded); }
        setPhase("result");
      }
    }
    if (phase === "result" && elapsed <= 1250 && !isPaused()) drawImpact((versus ? match[actor] : shots).at(-1));
    if (cycles[phase] || action.disabled && !["loading", "flight", "opponent-ready"].includes(phase) && !document.hidden && performance.now() - lastAction >= 250) render();
    frame = requestAnimationFrame(tick);
  }
  function cleanup(completed) {
    if (phase === "closed") return;
    clearDeclareCue(); phase = "closed"; cancelAnimationFrame(frame); lifetime.abort(); root.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    root.remove(); active.delete(host); if (previousFocus?.isConnected) previousFocus.focus(); finish(result(completed, shots));
  }
}
