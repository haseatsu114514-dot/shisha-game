// Caller awaits preceding VN. Practice never reads or writes story/save state.
import { el } from "../core/util.js";
import { imgFileUrl } from "../core/img-file.js";
import { svg } from "../core/transition-kit.js";
import { SE, unlockAudio } from "../core/audio.js";
import { RINGS, KILLS, CLUSTERS, LINE, BLADE, POWER, SWAY, MODES, DIVISIONS, BOARD, RULESET, gaugeAt, axisAt, releaseAimAt, resolveThrow, totalOf, gradeOf, killState, canCall, closuresOf, halfOf } from "./axe-model.js";
import { createMatch, takeTurn, turnOf, planOpponent, matchResult, resolveTurn, inSuddenDeath, suddenDeathTarget, DIFFICULTIES } from "./axe-match.js";
import { COMPANIONS, reaction, matchReaction, portraitFocus } from "./axe-companions.js";
import { axeRules } from "./axe-rules.js";
import { TARGET, FLIGHT, flightPose, flightTime, impactPose } from "./axe-flight.js";
import { createAxe, renderAxe } from "./axe-geometry.js";
import { shotFeedback, sessionStats, impactFeedback, declarationCue, killPlaces, clusterPlaces, quiverAt, zoneLabel, haloFor } from "./axe-presentation.js";
import { coachDialog } from "./axe-coach.js";
import { pickChallenges, evaluateChallenges, heatOf, rankOf, titleOf } from "./axe-challenges.js";
const active = new WeakMap(), artReady = new Map();
let instances = 0;
function decodeArt(url) {
  if (!artReady.has(url)) {
    const image = new Image(); image.src = url;
    artReady.set(url, image.decode().catch(error => { artReady.delete(url); throw error; }));
  }
  return artReady.get(url);
}
// The WATL board (five 2x10 planks, calm light centre) from Codex, #2198 / AXR06. The older square board stays in the repository.
const ART = { bg: imgFileUrl("backgrounds/bg_axe_lounge_night.webp"), board: imgFileUrl("ui/axe_throw/target_board_watl_800.webp") };
// Only the target is decoded early so it appears without a late pop-in; other art waits for the loading step.
if (typeof Image !== "undefined") decodeArt(ART.board).catch(() => {});
const faceArt = (id, face) => imgFileUrl("sprites/characters/" + id + "/chr_" + id + "_" + face + ".webp");
const { x: CX, y: CY, radius: R } = TARGET;
// Solid plank edges inside the 1254px artwork (alpha 250+, asset_sources/ui/axe-watl-20261101/adoption.json); the transparent margin is not wood.
const OPAQUE = { left: 69 / 1254, right: 1185 / 1254, top: 61 / 1254, bottom: 1190 / 1254 };
const PLANK = { left: CX + BOARD.left * R, right: CX + BOARD.right * R, top: CY + BOARD.top * R, bottom: CY + BOARD.bottom * R };
const cycles = { horizontal: 3600, vertical: 3600, power: 2400 };
// The camera frames the scoring area (the 1 ring and the gauge sweep) rather than the whole five planks.
const VIEW = { x: CX - 232, y: CY - 232, size: 464 };
// The judge's close-up after a stuck throw: ±.2 of the 1-ring radius around the blade.
const ZOOM = .2;
const SERIES = [1, 3];
// Where the owner's lesson happens: the first paid throw at the bar, or before hiyori's three throws.
// Each context swaps only the greeting and the send-off; the five teaching steps are shared.
export const LESSON_CONTEXTS = ["first", "event"];
const LESSON_STEPS = ["welcome", "target", "horizontal", "vertical", "power", "result", "finish"];
export function runAxeThrow({ host = document.getElementById("stage") || document.getElementById("axe-app"),
  signal, mode = "practice", tutorial = false, opponent = tutorial ? null : "hiyori", allowRetry = true, difficulty = "normal", seed,
  division = "rec", bestOf = 1, lessonContext = null, reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const versus = mode === "versus";
  if (typeof tutorial !== "boolean" || tutorial && (mode !== "practice" || opponent !== null) || (!versus && !Object.hasOwn(MODES, mode)) || versus && (opponent !== "hiyori" || !Object.hasOwn(DIFFICULTIES, difficulty)) || opponent !== null && !Object.hasOwn(COMPANIONS, opponent)
    || !Object.hasOwn(DIVISIONS, division) || !SERIES.includes(bestOf)
    || lessonContext !== null && (!tutorial || !LESSON_CONTEXTS.includes(lessonContext))) return Promise.reject(new RangeError("Unknown axe mode, division, lesson or companion"));
  const rules = tutorial ? { throws: 1, max: 8, half: 0 } : MODES[versus ? "league" : mode], companion = COMPANIONS[opponent];
  const baseSeed = (seed ?? crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;
  const gameSeed = index => (baseSeed + index * 7919) >>> 0;
  const series = versus ? { bestOf, games: [], wins: { player: 0, opponent: 0 }, winner: null } : null;
  let match, gameIndex = 0;
  try { match = versus ? createMatch(difficulty, gameSeed(0), division) : null; }
  catch (error) { return Promise.reject(error); }
  const soloOptions = { division, throws: rules.throws };
  // Session goals sit on top of the rules: they never change a score or the opponent's plan.
  const challengeIds = tutorial ? [] : pickChallenges(versus ? "league" : mode, baseSeed);
  const result = (completed, shots) => ({ completed, cancelled: !completed, throws: structuredClone(shots), total: totalOf(shots),
    grade: completed ? gradeOf(totalOf(shots), rules.max) : null, ruleset: RULESET, mode, opponent, division, throwCount: rules.throws, maximum: rules.max,
    challenges: evaluateChallenges(challengeIds, shots, completed), rank: completed ? rankOf(totalOf(shots), rules.max) : null,
    title: completed && !tutorial ? titleOf(shots, rules.max) : null, stats: sessionStats(shots),
    ...(tutorial ? { tutorial: true, lessonContext } : {}),
    ...(versus ? { match: { ...matchResult(match), winner: completed ? matchResult(match).winner : null,
      player: structuredClone(match.player), opponent: structuredClone(match.opponent), suddenDeath: structuredClone(match.suddenDeath), difficulty, division, seed: match.seed },
      series: { bestOf, games: structuredClone(series.games), wins: { ...series.wins }, winner: completed ? seriesWinner() : null } } : {}) });
  if (signal?.aborted) return Promise.resolve(result(false, []));
  let finish;
  const promise = new Promise(resolve => { finish = resolve; }); active.set(host, promise);
  const previousFocus = document.activeElement, lifetime = new AbortController();
  // A stage caller can replace #screen while the match overlay is its sibling.
  const callerScreen = (versus || tutorial) && host.id === "stage" ? host.querySelector("#screen") : null;
  const callerContent = callerScreen ? [...callerScreen.childNodes] : [];
  let phase = "loading", elapsed = 0, stamp = null, frame = 0, aim = { x: 0, y: 0 }, power = POWER.ideal;
  let shots = match?.player || [], pending = null, called = null, lastAction = -Infinity;
  let actor = "player", matchLines = null, gameRecorded = false;
  let portraitKey = null;
  let declareTimer = 0, declareNode = null, declareMarker = null, clearedGoals = new Set();
  let held = 0, focusUntil = -1, focusUsed = false, helpPanel = null, coachPanel = null, coachLines = null, quiver = null;
  const taught = new Set();
  const isPaused = () => document.hidden || Boolean(helpPanel || coachPanel);
  const suddenDeath = () => versus && inSuddenDeath(match);
  /** The thrower's newest resolved shot: a sudden-death round once the ten throws are in, else the game history. */
  const latest = id => { const round = match?.suddenDeath.at(-1); return round?.[id] && match[id].length === rules.throws ? round[id] : (versus ? match[id] : shots).at(-1); };
  const seriesWinner = () => {
    const need = Math.ceil((bestOf + 1) / 2);
    if (series.wins.player >= need) return "player";
    if (series.wins.opponent >= need) return "opponent";
    if (series.games.length >= bestOf) return series.wins.player > series.wins.opponent ? "player" : series.wins.player < series.wins.opponent ? "opponent" : "draw";
    return null;
  };
  const root = el("section.axe-game", { role: "dialog", "aria-modal": "true", "aria-label": "斧投げ・" + rules.throws + "投",
    tabindex: "-1", dataset: { test: "axe-game" }, style: { "--axe-bg": "url('" + ART.bg + "')" } });
  root.dataset.mode = mode; root.dataset.division = division;
  root.dataset.tutorial = String(tutorial);
  root.dataset.reducedMotion = String(reducedMotion);
  if (host.id === "stage") root.classList.add("axe-in-stage");
  const round = el("span.axe-round", { dataset: { test: "axe-round" } });
  const rulesButton = el("button.axe-button.axe-rules-button", { text: "ルール", dataset: { test: "axe-rules" }, onclick: openRules });
  const subtitle = tutorial ? "マキの無料1投レッスン" : versus ? "ひよりと10投対戦 · " + DIFFICULTIES[difficulty].name + (bestOf > 1 ? " · " + bestOf + "本マッチ" : "") : mode === "league" ? "10投ゲーム · 5投で的を交代" : "3投の練習";
  const heading = el("header.axe-header", [el("div", [el("h1", { text: tutorial ? "AXE LESSON" : "AXE THROW" }),
    el("p", { text: subtitle + (tutorial ? "" : " · " + DIVISIONS[division].name) })]), round, rulesButton,
    el("button.axe-button.axe-close", { text: "やめる", dataset: { test: "axe-cancel" }, onclick: () => cleanup(false) })]);
  const divisionBadge = el("span.axe-division", { text: DIVISIONS[division].short, title: DIVISIONS[division].name + "：" + DIVISIONS[division].note, dataset: { test: "axe-division" } });
  heading.insertBefore(divisionBadge, round);
  const matchScore = el("div.axe-match-score", { hidden: !versus, "aria-live": "polite", dataset: { test: "axe-match-score" } });
  const matchRecords = el("div.axe-match-records", { hidden: true, dataset: { test: "axe-match-records" } });
  const totalValue = el("strong", { text: "0" });
  const total = el("div.axe-total", { dataset: { test: "axe-total" } }, [
    el("small", { text: versus ? "あなたの合計" : "合計点" }), totalValue, el("span", { text: "/ " + rules.max + "点" }),
  ]);
  heading.insertBefore(total, round);
  const heat = el("span.axe-heat", { hidden: true, "aria-live": "polite", dataset: { test: "axe-heat" } });
  heading.insertBefore(heat, round);
  const scoreboard = el("div.axe-scoreboard", { role: "table", "aria-label": "各投の得点", dataset: { test: "axe-scoreboard" } });
  const goals = el("ul.axe-challenges", { hidden: !challengeIds.length, "aria-label": "この回のチャレンジ", dataset: { test: "axe-challenges" } });
  const portrait = el("img.axe-portrait", { alt: companion?.name || "", dataset: { test: "axe-portrait" } });
  const comment = el("p.axe-comment", { "aria-live": "polite", dataset: { test: "axe-comment" } });
  const companionCard = companion ? el("div.axe-companion", [el("div.axe-portrait-frame", [portrait]), el("div", [el("strong", { text: companion.name }), comment])]) : null;
  const board = svg("svg", { viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.size} ${VIEW.size}`, class: "axe-target", role: "button", tabindex: "0",
    "aria-label": "的。ゲージ操作中はタップでも止められます。構える前は青をタップして宣言できます", "data-test": "axe-target" });
  board.addEventListener("click", event => {
    if (cycles[phase]) { act(); return; }
    if (phase !== "choice" || actor !== "player" || isPaused() || suddenDeath()) return;
    const point = board.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const ctm = board.getScreenCTM(); if (!ctm) return;
    const p = point.matrixTransform(ctm.inverse());
    const nearest = KILLS.map(k => ({ id: k.id, d: Math.hypot(p.x - (CX + k.x * R), p.y - (CY + k.y * R)) })).sort((a, b) => a.d - b.d)[0];
    if (nearest.d <= 26) selectCall(nearest.id);
    else if (called && Math.hypot(p.x - CX, p.y - CY) < R * .7) selectCall(null);
  }, { signal: lifetime.signal });
  const plankWidth = (PLANK.right - PLANK.left) / (OPAQUE.right - OPAQUE.left), plankHeight = (PLANK.bottom - PLANK.top) / (OPAQUE.bottom - OPAQUE.top);
  const plank = svg("g", { class: "axe-plank" }, [svg("image", { href: ART.board, x: PLANK.left - OPAQUE.left * plankWidth, y: PLANK.top - OPAQUE.top * plankHeight,
    width: plankWidth, height: plankHeight, preserveAspectRatio: "none" })]);
  // The wood, its paint and the cuts form one group, so the close-up can show the same board through <use>.
  const artId = "axe-art-" + (++instances), vignetteId = artId + "-vignette";
  const art = svg("g", { id: artId, class: "axe-art" }, [plank,
    svg("rect", { class: "axe-vignette", x: PLANK.left, y: PLANK.top, width: PLANK.right - PLANK.left, height: PLANK.bottom - PLANK.top, fill: `url(#${vignetteId})` })]);
  board.append(svg("defs", {}, [svg("radialGradient", { id: vignetteId, cx: CX, cy: CY, r: R * 1.62, gradientUnits: "userSpaceOnUse" }, [
    svg("stop", { offset: "0", "stop-color": "#fff3d6", "stop-opacity": .08 }), svg("stop", { offset: ".55", "stop-color": "#000", "stop-opacity": 0 }),
    svg("stop", { offset: "1", "stop-color": "#000", "stop-opacity": .58 })])]), art);
  // Painted markings at the official proportions: 20 mm black lines, red bulls, blue killshots with a red outline.
  const markings = svg("g", { class: "axe-markings", "aria-hidden": "true" });
  const lineWidth = LINE * 2 * R;
  for (const ring of RINGS.slice(2)) markings.append(svg("circle", { cx: CX, cy: CY, r: ring.radius * R, fill: "none", stroke: "#1c1410", "stroke-width": lineWidth, opacity: .9 }));
  for (const [i, n] of ["1", "2", "3", "4"].entries()) markings.append(svg("text", { x: CX + 7, y: CY - (RINGS[5 - i].radius - LINE * 2.6) * R, fill: "#f1e3c8", opacity: .8, "font-size": 12, "font-weight": 900, "paint-order": "stroke", stroke: "#1c1410", "stroke-width": 2.5 }, [n]));
  const clusterNodes = new Map();
  for (const c of CLUSTERS) {
    const node = svg("g", { "data-cluster": c.id }, [
      svg("circle", { cx: CX + c.x * R, cy: CY + c.y * R, r: RINGS[1].radius * R, fill: "none", stroke: "#1c1410", "stroke-width": lineWidth, opacity: .9 }),
      svg("circle", { cx: CX + c.x * R, cy: CY + c.y * R, r: RINGS[0].radius * R, fill: "#c23b2a" }),
      svg("path", { class: "axe-closed-mark", d: `M${CX + c.x * R - 13} ${CY + c.y * R - 13}l26 26M${CX + c.x * R + 13} ${CY + c.y * R - 13}l-26 26`, stroke: "#10090a", "stroke-width": 3.5, "stroke-linecap": "round", opacity: 0 }),
    ]);
    markings.append(node); clusterNodes.set(c.id, node);
  }
  const markers = new Map();
  for (const target of KILLS) {
    const marker = svg("g", { "data-killshot": target.id }, [
      svg("circle", { cx: CX + target.x * R, cy: CY + target.y * R, r: target.outer * R, fill: "#2f7fc1", stroke: "#c23b2a", "stroke-width": 2.2 }),
      svg("circle", { cx: CX + target.x * R, cy: CY + target.y * R, r: target.inner * R, fill: "#163f78" }),
    ]); markings.append(marker); markers.set(target.id, marker);
  }
  art.append(markings);
  const cuts = svg("g", { class: "axe-cuts", "aria-hidden": "true" });
  art.append(cuts);
  // While aiming, the zone the blade would score glows: the blade-touch rule made visible.
  const zoneHalo = svg("circle", { class: "axe-zone-halo", r: 0, fill: "none", opacity: 0 });
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
  const trail = svg("path", { class: "axe-flight-trail", fill: "none", stroke: "#fff1cf", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0 });
  const flying = createAxe(); flying.classList.add("axe-flight"); flying.setAttribute("opacity", 0);
  // Two afterimages a few frames behind make the tumble readable at speed.
  const ghosts = [createAxe(), createAxe()];
  ghosts.forEach(node => { node.classList.add("axe-ghost"); node.setAttribute("opacity", 0); node.setAttribute("aria-hidden", "true"); });
  // A soft contact shadow on the wood grows as the axe arrives, so its depth reads.
  const contactShadow = svg("ellipse", { class: "axe-contact-shadow", rx: 0, ry: 0, fill: "#120a05", opacity: 0 });
  const bladePx = BLADE.halfLength * R;
  // The white blade marker is the 4 in cutting edge: the highest zone it touches scores.
  // A dark outline under the white blade keeps it readable on light and dark wood alike.
  const bladeShape = `M0 ${-bladePx}V${bladePx} M-7 ${-bladePx}H7 M-7 ${bladePx}H7 M-16 0H-7 M7 0H16`;
  const crosshairLines = [svg("path", { d: `M0 ${-bladePx}V${bladePx}`, stroke: "#fff5d9", "stroke-width": 4, "stroke-linecap": "round" }),
    svg("path", { d: `M-7 ${-bladePx}H7 M-7 ${bladePx}H7 M-16 0H-7 M7 0H16`, stroke: "#fff5d9", "stroke-width": 2.5, "stroke-linecap": "round" }),
    svg("circle", { r: 3.6, fill: "none", stroke: "#fff5d9", "stroke-width": 2.2 })];
  for (const node of crosshairLines) node.setAttribute("stroke", "currentColor");
  const crosshair = svg("g", { class: "axe-crosshair" }, [
    svg("path", { class: "axe-crosshair-outline", d: bladeShape, stroke: "#160f0a", "stroke-width": 8, "stroke-linecap": "round", fill: "none", opacity: .8 }),
    svg("circle", { class: "axe-crosshair-outline", r: 3.6, fill: "none", stroke: "#160f0a", "stroke-width": 6, opacity: .8 }), ...crosshairLines]);
  const fixedAim = svg("g", { class: "axe-fixed-aim" }, [svg("circle", { r: 7, fill: "none", stroke: "#e5bd70", "stroke-width": 2 }),
    svg("path", { d: "M-12 0H12 M0-12V12", stroke: "#e5bd70", "stroke-width": 1 })]);
  const powerShift = svg("path", { class: "axe-power-shift", fill: "none", stroke: "#aee0c0", "stroke-width": 3 });
  const releaseDot = svg("circle", { class: "axe-release-dot", r: 4, fill: "#aee0c0" });
  const impactMark = svg("g", { class: "axe-impact-mark", opacity: 0 }, [svg("path", { d: `M0 ${-bladePx}V${bladePx}`, stroke: "#fff5d9", "stroke-width": 2, "stroke-dasharray": "3 3" }),
    svg("circle", { r: 3, fill: "#fff5d9" })]);
  const xNeedle = svg("path", { class: "axe-x-needle", d: `M0 ${PLANK.top - 6}V${PLANK.bottom + 6}`, stroke: "#91cfe6", "stroke-width": 2.5 });
  const yNeedle = svg("path", { class: "axe-y-needle", d: `M${PLANK.left - 6} 0H${PLANK.right + 6}`, stroke: "#e5bd70", "stroke-width": 2.5 });
  const sdBadge = svg("text", { class: "axe-sd-badge", x: CX, y: VIEW.y + 26, "text-anchor": "middle", fill: "#9cecff", "font-size": 15, "font-weight": 900, opacity: 0 }, ["SUDDEN DEATH"]);
  const gaugeLabel = (x, y, text, fill, anchor) => svg("text", { class: "axe-gauge-label", x, y, "text-anchor": anchor, fill, "font-size": 16, "font-weight": 900,
    "paint-order": "stroke", stroke: "#140d08", "stroke-width": 4 }, [text]);
  board.append(zoneHalo, powerShift, releaseDot, contactShadow, impacts, impactMark, trail, ...ghosts, flying, fixedAim, crosshair, impactFx,
    gaugeLabel(CX, VIEW.y + VIEW.size - 10, "① 横", "#a9dcef", "middle"), gaugeLabel(VIEW.x + VIEW.size - 8, CY - 10, "② 縦", "#f1c983", "end"), xNeedle, yNeedle, sdBadge);
  const note = el("p.axe-note", { dataset: { test: "axe-note" } });
  const announcement = el("p.axe-announcement", { "aria-live": "polite", "aria-atomic": "true" });
  const resultLabel = el("span.axe-result-label"), resultNumber = el("span"), resultUnit = el("small", { text: "PTS" });
  const resultValue = el("strong.axe-result-value", [resultNumber, resultUnit]), resultTip = el("p.axe-result-tip");
  const rankLetter = el("strong"), rankTitle = el("span");
  const rankBadge = el("div.axe-rank", { hidden: true, dataset: { test: "axe-rank" } }, [el("small", { text: "RANK" }), rankLetter, rankTitle]);
  const resultCard = el("div.axe-result-card", { hidden: true, dataset: { test: "axe-result" } }, [resultLabel, resultValue, rankBadge, resultTip]);
  const status = el("p.axe-call-status", { dataset: { test: "axe-call-status" } });
  const calls = el("div.axe-calls", [el("button.axe-button", { text: "通常", dataset: { call: "normal" }, onclick: () => selectCall(null) }),
    ...KILLS.map(target => el("button.axe-button", { text: killPlaces[target.id] + "の青",
      dataset: { call: target.id }, onclick: () => selectCall(target.id) }))]);
  const liveValue = el("strong"), liveReason = el("span.axe-live-reason");
  const liveScore = el("div.axe-live-score", { hidden: true, dataset: { test: "axe-live-score" } }, [el("span.axe-live-label", { text: "今の刃先" }), liveValue, liveReason]);
  const needle = el("span.axe-needle", { dataset: { test: "axe-needle" } });
  const steps = el("ol.axe-steps", { "aria-label": "投げるまでの3段階", dataset: { test: "axe-steps" } },
    ["① 横", "② 縦", "③ 回転"].map((text, i) => el("li", { dataset: { step: ["horizontal", "vertical", "power"][i] } },
      [el("span", { text }), el("strong", { text: "未確定" })])));
  const powerLabel = el("span.axe-power-label", { text: "③ 回転（放すタイミング）" });
  const powerReadout = el("strong.axe-power-readout", { dataset: { test: "axe-power-cue" } });
  const powerFill = el("span.axe-power-fill");
  const gauge = el("div.axe-gauge", { role: "img", "aria-label": "回転ゲージ。緑の帯が刃から当たる回転" }, [
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
  function resetThrow() { aim = { x: 0, y: 0 }; power = POWER.ideal; held = 0; focusUntil = -1; focusUsed = false; impacts.replaceChildren(); quiver = null; }
  function newGame(index) {
    gameIndex = index; gameRecorded = false;
    if (versus) match = createMatch(difficulty, gameSeed(index), division);
    actor = "player"; shots = match?.player || []; called = null; resetThrow(); taught.clear(); clearedGoals = new Set();
  }
  const retry = el("button.axe-button.axe-retry", { text: "もう一度", dataset: { test: "axe-retry" }, onclick: () => {
    if (!isPaused() && performance.now() - lastAction >= 250 && phase === "summary") {
      lastAction = performance.now();
      if (series) { series.games = []; series.wins = { player: 0, opponent: 0 }; }
      newGame(0); setPhase("choice");
    }
  } });
  const controls = el("div.axe-controls", [focusButton, reaim]);
  const keyhint = el("p.axe-keyhint", { text: "ボタン / 的をタップ / Space・Enter" });
  // The judge's close-up: the same painted board through <use>, the 4in blade and the zone it touched.
  const zoomBlade = svg("g", {}, [svg("path", { stroke: "#160f0a", "stroke-width": 2.6, "stroke-linecap": "round", fill: "none" }),
    svg("path", { stroke: "#fff7e0", "stroke-width": 1.2, "stroke-linecap": "round", fill: "none" })]);
  const zoomView = svg("svg", { class: "axe-zoom-view", viewBox: "0 0 1 1", "aria-hidden": "true" }, [svg("use", { href: "#" + artId }), zoomBlade]);
  const zoomScore = el("strong"), zoomZone = el("span");
  const zoom = el("figure.axe-zoom", { hidden: true, role: "img", dataset: { test: "axe-zoom" } }, [zoomView, el("figcaption", [zoomScore, zoomZone])]);
  const boardPane = el("div.axe-board-pane", [
    el("p.axe-legend", { text: "赤6 · 5の円 · リング4〜1 · 宣言した青7／8" }), board, zoom]),
    panel = el("aside.axe-panel", [matchScore, goals, companionCard, matchRecords, status, calls, steps, note, liveScore, resultCard, timing, feedback, steadiness, stability, action, keyhint, controls, retry]);
  const body = el("div.axe-body", [boardPane, panel]);
  root.append(heading, scoreboard, body, announcement);
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
      helpPanel.remove(); helpPanel = null; heading.inert = body.inert = scoreboard.inert = false;
      stamp = null; render(); rulesButton.focus();
    });
    heading.inert = body.inert = scoreboard.inert = true;
    root.append(helpPanel); stamp = null; render(); helpPanel.querySelector("button").focus();
  }
  function teach(id) {
    if (!tutorial || !coachLines || coachPanel || phase === "closed") return;
    const ids = LESSON_STEPS;
    const titles = { welcome: lessonContext === "first" ? "はじめての一投、マキと。" : lessonContext === "event" ? "投げる前に、マキから。" : "マキと、まずは一投。", target: "的と得点、刃が触れた所", horizontal: "① 横の位置を止める", vertical: "② 縦の位置を止める", power: "③ 緑の回転で放す", result: "今の一投を振り返ろう", finish: "レッスン完了" };
    const last = shots.at(-1);
    const key = lessonContext && coachLines[lessonContext + "_" + id] ? lessonContext + "_" + id : id;
    const text = coachLines[key] + (id === "result" && last ? ` 今回は${last.score}点。${shotFeedback(last).tip}` : "");
    const close = () => {
      coachPanel.remove(); coachPanel = null; heading.inert = body.inert = scoreboard.inert = false;
      stamp = null; render(); root.focus();
    };
    coachPanel = coachDialog({ text, title: titles[id], step: ids.indexOf(id) + 1, total: ids.length, kind: id, context: lessonContext,
      onNext: () => { close(); if (id === "welcome") teach("target"); else if (id === "finish") cleanup(true); },
      onSkip: () => cleanup(false) });
    coachPanel.dataset.lesson = id;
    heading.inert = body.inert = scoreboard.inert = true;
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
                if (!LESSON_STEPS.every(id => typeof coachLines[id] === "string")
                  || lessonContext && !["welcome", "finish"].every(id => typeof coachLines[lessonContext + "_" + id] === "string"))
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
              if (!["before", "call", "hit", "bull", "killshot", "killshot-miss", "miss", "drop", "ahead", "behind", "level", "player", "opponent", "draw", "switch", "sudden", "sudden-call", "sudden-hit", "sudden-miss"].every(key => typeof matchLines[key] === "string"))
                throw new Error("Axe match dialogue incomplete");
            })] : []),
        ]);
      })
      .then(() => { if (phase !== "closed") setPhase("choice"); }, () => { if (phase !== "closed") setPhase("failed"); })
      .finally(() => { stopTimer(); lifetime.signal.removeEventListener("abort", stopTimer); });
  }
  function selectCall(id) {
    if (actor !== "player" || phase !== "choice" || isPaused() || suddenDeath() || performance.now() - lastAction < 250 || id && !canCall(id, shots, rules.throws)) return;
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
  function switching() { return rules.half > 0 && actor === "player" && shots.length === rules.half; }
  /** Big moments only: the final throw, the half switch, sudden death, and a goal clearing on this throw. */
  function phaseCue(next) {
    if (tutorial || isPaused()) return;
    if (next === "choice" && actor === "player" && suddenDeath()) {
      showDeclareCue({ label: "SUDDEN DEATH", kind: "last", test: "axe-sd-cue", duration: 1400, place: "同点 · " + killPlaces[called] + "の青を1本ずつ" });
    } else if (next === "choice" && switching()) {
      showDeclareCue({ label: "SWITCH", kind: "half", test: "axe-half-cue", duration: 1300, place: "後半 · 的を交代" });
    } else if (next === "choice" && actor === "player" && rules.throws > 1 && shots.length === rules.throws - 1) {
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
  function recordGame() {
    if (!series || gameRecorded) return;
    gameRecorded = true;
    const game = matchResult(match);
    series.games.push({ game: gameIndex + 1, playerTotal: game.playerTotal, opponentTotal: game.opponentTotal, winner: game.winner, suddenDeath: game.suddenDeath });
    if (game.winner === "player" || game.winner === "opponent") series.wins[game.winner]++;
  }
  function setPhase(next) {
    clearDeclareCue();
    phase = next; elapsed = 0; stamp = null;
    if (next === "choice" && actor === "player" && suddenDeath()) called = suddenDeathTarget(match.suddenDeath.length);
    if (next === "summary") recordGame();
    phaseCue(next);
    if (next === "flight") {
      root.dataset.slowMotion = String(Boolean(pending.called) && !reducedMotion);
      const pose = flightPose(pending, reducedMotion ? FLIGHT.travel + FLIGHT.fall : 0);
      renderAxe(flying, pose); flying.setAttribute("opacity", pose.opacity);
    }
    render();
    if (tutorial && coachLines && !taught.has(next) && ["choice", "horizontal", "vertical", "power", "result", "summary"].includes(next)) {
      taught.add(next); teach(({ choice: "welcome", summary: "finish" })[next] || next);
    }
  }
  function preview(input) { return versus ? resolveTurn(match, "player", input) : resolveThrow(input, shots, soloOptions); }
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
      pending = { ...preview({ x: release.x, y: release.y, power, called }), baseAim: { ...aim }, sway: release.sway };
      SE.whoosh(); setPhase("flight");
    }
    else if (phase === "result") {
      if (versus && actor === "player" && turnOf(match) === "opponent") {
        actor = "opponent";
        const input = planOpponent(match);
        pending = { ...resolveTurn(match, "opponent", input), baseAim: { x: input.x, y: input.y },
          sway: { x: 0, y: 0, amplitude: 0, fatigue: 0, focused: false } };
        aim = { ...pending.aim }; power = pending.power; called = pending.called;
        impacts.replaceChildren(); quiver = null; setPhase("opponent-ready");
      } else if (versus ? turnOf(match) === null : shots.length === rules.throws) setPhase("summary");
      else { actor = "player"; called = null; resetThrow(); setPhase("choice"); }
    } else if (phase === "summary") {
      if (series && !seriesWinner()) { newGame(gameIndex + 1); setPhase("choice"); }
      else cleanup(true);
    }
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
  function tileMark(shot) { return !shot ? "" : shot.outcome === "killshot" ? "K" : shot.outcome === "bull" ? "●" : !shot.stuck ? "↓" : shot.called ? "×" : ""; }
  function render() {
    const focusedButton = document.activeElement?.tagName === "BUTTON" && root.contains(document.activeElement) ? document.activeElement : null;
    if (phase === "horizontal") aim.x = axisAt(gaugeAt(elapsed, cycles.horizontal));
    if (phase === "vertical") aim.y = axisAt(gaugeAt(elapsed, cycles.vertical));
    if (phase === "power") power = gaugeAt(elapsed, cycles.power);
    const moving = Boolean(cycles[phase]), sd = suddenDeath() || Boolean(versus && match.suddenDeath.length && turnOf(match) === null && phase !== "choice");
    const currentShots = versus ? match[actor] : shots;
    const shown = ["result", "summary"].includes(phase) ? (versus ? latest(actor) : shots.at(-1)) : null;
    const displayedShot = ["flight", "opponent-ready"].includes(phase) ? pending : shown;
    const release = displayedShot?.aim || releaseAimAt(aim, moving ? held : 0, power, shots.length, moving && held < focusUntil);
    const landing = displayedShot?.landing || (moving ? { x: release.x, y: release.y + (phase === "power" ? (POWER.ideal - power) * .28 : 0) } : aim);
    const throwIndex = Math.min(currentShots.length, rules.throws - 1);
    const currentHalf = halfOf(["result", "summary"].includes(phase) && !sd ? Math.max(0, currentShots.length - 1) : throwIndex, rules.throws);
    root.dataset.actor = actor; root.dataset.playerThrows = String(shots.length);
    root.dataset.opponentThrows = String(match?.opponent.length || 0);
    root.dataset.phase = phase; root.dataset.timing = String(gaugeAt(elapsed, cycles[phase] || 3200));
    root.dataset.outcome = displayedShot?.outcome || "";
    root.dataset.special = String(Boolean(displayedShot) && impactFeedback(displayedShot).special);
    root.dataset.focused = String(moving && held < focusUntil);
    root.dataset.aimX = String(aim.x); root.dataset.aimY = String(aim.y); root.dataset.power = String(power);
    root.dataset.paused = String(isPaused()); root.dataset.called = called || "";
    root.dataset.half = String(currentHalf); root.dataset.suddenDeath = String(sd); root.dataset.game = String(gameIndex + 1);
    root.dataset.suddenDeathRounds = String(match?.suddenDeath.length || 0);
    board.dataset.half = String(currentHalf);
    // Secondary readouts stay for screen readers; the board and gauge already show them.
    for (const node of [powerLabel, feedback, steadiness, keyhint]) node.classList.add("axe-quiet");
    note.classList.toggle("axe-quiet", !["choice", "loading", "failed", "opponent-ready"].includes(phase));
    root.dataset.held = String(held); root.dataset.focusRemaining = String(Math.max(0, focusUntil - held));
    root.dataset.releaseX = String(release.x); root.dataset.releaseY = String(release.y);
    root.dataset.landingX = String(landing.x); root.dataset.landingY = String(landing.y);
    const phaseIndex = ["horizontal", "vertical", "power"].indexOf(phase);
    liveScore.hidden = !moving;
    if (moving) {
      const previewShot = preview({ x: release.x, y: release.y, power: phase === "power" ? power : POWER.ideal, called });
      root.dataset.previewScore = String(previewShot.score); root.dataset.previewOutcome = previewShot.outcome;
      liveValue.textContent = previewShot.score + "点";
      crosshair.style.color = previewShot.score > 0 ? "#f8fff1" : "#f0a58b";
      const halo = haloFor(previewShot);
      zoneHalo.setAttribute("opacity", halo ? .95 : 0);
      if (halo) { zoneHalo.setAttribute("cx", CX + halo.x * R); zoneHalo.setAttribute("cy", CY + halo.y * R); zoneHalo.setAttribute("r", halo.r * R); zoneHalo.dataset.kind = halo.kind; }
      liveReason.textContent = previewShot.outcome === "drop" ? previewShot.dropReason === "weak" ? "柄から当たる・落下" : "回りすぎ・落下"
        : !previewShot.stuck ? "板の外" : called && !previewShot.score ? "宣言した青以外は0点" : previewShot.zone?.kind === "closed" ? "閉じた円 · 0点" : "";
    } else { root.dataset.previewScore = ""; root.dataset.previewOutcome = ""; zoneHalo.setAttribute("opacity", 0); }
    const axisText = (value, negative, positive) => Math.abs(value) < .035 ? "中央" : (value < 0 ? negative : positive) + Math.round(Math.abs(value) / 1.2 * 100) + "%";
    for (const [i, step] of [...steps.children].entries()) {
      const locked = Boolean(displayedShot) || phaseIndex > i, live = phaseIndex === i;
      step.dataset.state = live ? "live" : locked ? "locked" : "waiting";
      if (live) step.setAttribute("aria-current", "step"); else step.removeAttribute("aria-current");
      const value = i === 0 ? axisText(aim.x, "左", "右") : i === 1 ? axisText(aim.y, "上", "下") : Math.round(power * 100) + "%";
      step.lastChild.textContent = locked ? "✓ " + value : live ? value : "未確定";
    }
    const powerActive = phase === "power" || Boolean(displayedShot), shift = (POWER.ideal - power) * .28;
    const strength = power < POWER.stickMin ? "弱すぎる・落下" : power > POWER.stickMax ? "強すぎる・落下"
      : power >= POWER.sweetMin && power <= POWER.sweetMax ? "適正" : "刺さる回転";
    powerLabel.textContent = powerActive ? "③ 回転 " + Math.round(power * 100) + "% · " + strength : "③ 回転";
    timing.dataset.quality = strength === "適正" ? "sweet" : power < POWER.stickMin || power > POWER.stickMax ? "drop" : "edge";
    powerReadout.textContent = phase !== "power" ? strength : strength === "適正" ? "いま放す！" : power < POWER.sweetMin ? "緑の帯まで待つ" : "回りすぎ · 次の緑で放す";
    powerFill.style.width = power * 100 + "%";
    gauge.setAttribute("aria-label", powerLabel.textContent + "。緑は適正、茶色は刺さる範囲");
    const shiftText = Math.abs(shift) < .006 ? "回転による上下ずれなし" : "回転の補正 " + (shift > 0 ? "↓ 下" : "↑ 上") + Math.round(Math.abs(shift) * 100) + "%";
    feedback.textContent = powerActive ? shiftText + " · 白い刃先が着地点" : "針から伸びる線で位置を確認";
    timing.hidden = !moving && !displayedShot;
    timing.dataset.active = String(powerActive); feedback.hidden = ["loading", "failed", "summary"].includes(phase);
    const sdRound = versus ? match.suddenDeath.length : 0;
    round.textContent = sd ? (versus ? (actor === "player" ? "あなた " : "ひより ") : "") + "サドンデス " + Math.max(1, sdRound + (phase === "choice" && actor === "player" ? 1 : 0))
      : (versus ? (actor === "player" ? "あなた " : "ひより ") : "") + Math.min(currentShots.length + (["result", "summary"].includes(phase) ? 0 : 1), rules.throws) + " / " + rules.throws + " 投"
      + (rules.half ? (currentHalf ? " · 後半" : " · 前半") : "") + (series && bestOf > 1 ? " · G" + (gameIndex + 1) : "");
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
    // League-style scoreboard: one row per thrower, a divider at the half, calls as axe marks.
    const rows = versus ? ["player", "opponent"] : ["player"];
    const record = rows.map(id => (versus ? match[id] : shots).map(shot => shot.score + ":" + shot.outcome).join(",")).join("|") + "|" + (match?.suddenDeath.map(r => (r.player?.score ?? "-") + "/" + (r.opponent?.score ?? "-")).join(",") || "") + ":" + phase + ":" + actor + ":" + sdRound;
    if (scoreboard.dataset.record !== record) {
      scoreboard.dataset.record = record;
      scoreboard.replaceChildren(...rows.map(id => {
        const list = versus ? match[id] : shots, mine = id === actor;
        const current = ["result", "summary"].includes(phase) ? list.length - 1 : list.length;
        const ks = killState(list, rules.throws);
        const tiles = Array.from({ length: rules.throws }, (_, i) => el("span.axe-tile", {
          dataset: { outcome: list[i]?.outcome || "", filled: String(Boolean(list[i])), current: String(mine && !sd && i === current), half: String(halfOf(i, rules.throws)) },
          "aria-label": (i + 1) + "投目 " + (list[i] ? list[i].score + "点" : "未投擲"), title: list[i] ? (i + 1) + "投目 " + list[i].score + "点" + (list[i].called ? "（" + killPlaces[list[i].called] + "の青）" : "") : (i + 1) + "投目",
        }, [el("i", { text: String(i + 1) }), el("strong", { text: list[i] ? String(list[i].score) : "—" }), el("em", { text: tileMark(list[i]) })]));
        const sdTiles = (match?.suddenDeath || []).map((r, i) => el("span.axe-tile.axe-tile-sd", { dataset: { outcome: r[id]?.outcome || "", filled: String(Boolean(r[id])), current: String(mine && sd && !r[id]) },
          "aria-label": "サドンデス" + (i + 1) + " " + (r[id] ? r[id].score + "点" : "未投擲") }, [el("i", { text: "SD" + (i + 1) }), el("strong", { text: r[id] ? String(r[id].score) : "—" }), el("em", { text: tileMark(r[id]) })]));
        return el("div.axe-score-row", { role: "row", dataset: { thrower: id, active: String(mine) } }, [
          el("span.axe-score-name", { text: versus ? (id === "player" ? "あなた" : "ひより") : "各投" }),
          el("div.axe-score-tiles", [...tiles, ...sdTiles]),
          el("span.axe-score-calls", { title: "キルショットの宣言 残り" + ks.remaining + "回", "aria-label": "宣言 残り" + ks.remaining + "回" },
            Array.from({ length: Math.max(ks.remaining, 0) }, () => el("i", { text: "K" }))),
          el("span.axe-score-total", { text: String(totalOf(list)) }),
        ]);
      }));
    }
    if (versus) {
      const totals = matchResult(match);
      matchScore.textContent = "あなた " + totals.playerTotal + " — " + totals.opponentTotal + " ひより" + (sd && sdRound ? " · SD " + sdRound : "") + (bestOf > 1 ? " · " + series.wins.player + "勝" + series.wins.opponent + "敗" : "");
      matchRecords.hidden = phase !== "summary";
      if (phase === "summary" && matchRecords.dataset.record !== JSON.stringify(match)) {
        matchRecords.dataset.record = JSON.stringify(match);
        matchRecords.replaceChildren(...["player", "opponent"].map(id => el("div", [
          el("strong", { text: id === "player" ? "あなた" : "ひより" }),
          el("p", { text: match[id].map((shot, i) => (i + 1) + ":" + shot.score).join(" · ") + (match.suddenDeath.length ? " · SD " + match.suddenDeath.map(r => r[id]?.score ?? "-").join("/") : "") }),
        ])), ...(bestOf > 1 ? [el("div.axe-series-line", [el("strong", { text: "マッチ" }), el("p", { text: series.games.map(g => "G" + g.game + " " + g.playerTotal + "-" + g.opponentTotal).join(" · ") })])] : []));
      }
    }
    const ks = killState(currentShots, rules.throws);
    status.textContent = sd ? "サドンデス：" + killPlaces[called] + "の青 · 刃が触れれば勝ち" : called ? "宣言中：" + killPlaces[called] + "の青 · 青以外0点"
      : "キルショット（青 7／8点） · 残り" + ks.remaining + "回" + (ks.bonus ? "（落下で+" + ks.bonus + "）" : "") + (ks.mustRow ? " · " + (ks.mustRow === "upper" ? "上" : "下") + "の青だけ" : "");
    for (const button of calls.children) {
      const id = button.dataset.call;
      button.disabled = isPaused() || performance.now() - lastAction < 250 || phase !== "choice" || sd || id !== "normal" && !canCall(id, shots, rules.throws);
      button.setAttribute("aria-pressed", String((called || "normal") === id));
      if (id !== "normal") {
        const target = KILLS.find(t => t.id === id), closed = ks.closed.includes(target.row);
        button.title = closed ? "この高さは成功済み・閉鎖中" : ks.remaining === 0 ? "宣言を使い切りました" : ks.mustRow && ks.mustRow !== target.row ? "追加の宣言は反対の高さの青だけ" : "宣言した青に命中で7／8点。外すと0点";
        button.dataset.closed = String(closed);
        const label = killPlaces[id] + (closed ? " 閉鎖" : "の青");
        if (button.textContent !== label) button.textContent = label;
      }
    }
    for (const target of KILLS) {
      // The blue just thrown stays bright while its result (and close-up) is on screen, even though its height has now closed.
      const justThrown = phase === "result" && shown?.called === target.id;
      const marker = markers.get(target.id); marker.setAttribute("opacity", ks.closed.includes(target.row) && !sd && !justThrown ? .28 : 1);
      marker.style.filter = called === target.id ? "drop-shadow(0 0 6px #fff5b1)" : "";
      marker.setAttribute("data-callable", String(phase === "choice" && actor === "player" && !sd && canCall(target.id, shots, rules.throws)));
    }
    // Closures of this half, from the current thrower's own history.
    const closureIndex = ["result", "summary"].includes(phase) && !sd ? Math.max(0, currentShots.length - 1) : throwIndex;
    const closed = closuresOf(currentShots, closureIndex, rules.throws, division);
    for (const c of CLUSTERS) {
      const node = clusterNodes.get(c.id), gone = division === "pro" ? closed.cluster.has(c.id) : closed.bull.has(c.id);
      node.dataset.closed = String(gone); node.dataset.fiveClosed = String(division === "am" && closed.five.has(c.id));
      node.lastChild.setAttribute("opacity", gone ? .75 : 0);
      node.children[1].setAttribute("opacity", gone ? .35 : 1);
      node.firstChild.setAttribute("opacity", division === "pro" && gone || division === "am" && closed.five.has(c.id) ? .35 : .9);
    }
    // Earlier throws of this half stay as cuts in the wood.
    const cutRecord = currentShots.map((s, i) => halfOf(i, rules.throws) === currentHalf && i !== (displayedShot === shown ? currentShots.length - 1 : -1) && s.stuck ? i : "").join(",") + ":" + actor + ":" + String(sd);
    if (cuts.dataset.record !== cutRecord) {
      cuts.dataset.record = cutRecord;
      cuts.replaceChildren(...currentShots.flatMap((s, i) => halfOf(i, rules.throws) === currentHalf && s.stuck && !(shown && i === currentShots.length - 1) && !sd ? [svg("g", { transform: `translate(${CX + s.landing.x * R} ${CY + s.landing.y * R})` }, [
        svg("path", { d: `M0 ${-bladePx * .9}V${bladePx * .9}`, stroke: "#2a1a10", "stroke-width": 2.6, "stroke-linecap": "round", opacity: .85 }),
        svg("text", { x: 7, y: 4, fill: "#f6e5c8", "font-size": 10, "font-weight": 900, "paint-order": "stroke", stroke: "#1b120c", "stroke-width": 2.5 }, [String(s.score)]),
      ])] : []));
    }
    if (companion) {
      const bonusEarned = shots.length > 0 && killState(shots, rules.throws).bonus > killState(shots.slice(0, -1), rules.throws).bonus;
      const context = { heat: heatOf(shots), last: shots.length === rules.throws - 1, grade: phase === "summary" ? gradeOf(totalOf(shots), rules.max) : null,
        switching: phase === "choice" && switching(), bonus: bonusEarned, suddenDeath: sd };
      const line = versus && matchLines ? matchReaction(matchLines, phase, match, actor, pending, called, context) : reaction(opponent, phase, shots, called, context);
      if (comment.textContent !== line.text) comment.textContent = line.text;
      if (portraitKey) showFace(line.face);
    }
    crosshair.setAttribute("transform", "translate(" + (CX + landing.x * R) + " " + (CY + landing.y * R) + ")");
    fixedAim.setAttribute("transform", "translate(" + (CX + aim.x * R) + " " + (CY + aim.y * R) + ")");
    fixedAim.setAttribute("opacity", moving ? .8 : 0);
    powerShift.setAttribute("d", `M${CX + release.x * R} ${CY + release.y * R}V${CY + landing.y * R}`);
    powerShift.setAttribute("opacity", phase === "power" ? 1 : 0);
    releaseDot.setAttribute("cx", CX + release.x * R); releaseDot.setAttribute("cy", CY + release.y * R);
    releaseDot.setAttribute("opacity", phase === "power" ? 1 : 0);
    impactMark.setAttribute("transform", `translate(${CX + landing.x * R} ${CY + landing.y * R})`);
    impactMark.setAttribute("opacity", displayedShot ? .85 : 0);
    impactMark.style.color = displayedShot?.score > 0 ? "#fff4cb" : "#ef9f86";
    for (const node of impactMark.children) { node.setAttribute("stroke", "currentColor"); if (node.getAttribute("fill") !== "none") node.setAttribute("fill", "currentColor"); }
    crosshair.style.opacity = ["choice", "horizontal", "vertical", "power"].includes(phase) ? "1" : "0";
    xNeedle.setAttribute("transform", "translate(" + (CX + aim.x * R) + " 0)");
    yNeedle.setAttribute("transform", "translate(0 " + (CY + aim.y * R) + ")");
    xNeedle.setAttribute("opacity", phase === "horizontal" ? 1 : moving ? .4 : 0); yNeedle.setAttribute("opacity", phase === "vertical" ? 1 : phase === "power" ? .4 : 0);
    sdBadge.setAttribute("opacity", sd ? 1 : 0);
    if (phase !== "flight") { flying.setAttribute("opacity", 0); trail.setAttribute("opacity", 0); contactShadow.setAttribute("opacity", 0); ghosts.forEach(node => node.setAttribute("opacity", 0)); }
    // The close-up opens on the result of a stuck axe, on the side away from where it landed.
    const zoomShot = phase === "result" && shown?.stuck ? shown : null;
    zoom.hidden = !zoomShot;
    if (zoomShot) {
      const zx = CX + zoomShot.landing.x * R, zy = CY + zoomShot.landing.y * R, half = ZOOM * R;
      zoomView.setAttribute("viewBox", `${zx - half} ${zy - half} ${half * 2} ${half * 2}`);
      for (const line of zoomBlade.children) line.setAttribute("d", `M${zx} ${zy - bladePx}V${zy + bladePx} M${zx - 3} ${zy}H${zx + 3}`);
      zoom.dataset.side = zoomShot.landing.x < 0 ? "right" : "left";
      zoom.dataset.scored = String(zoomShot.score > 0);
      const label = zoneLabel(zoomShot);
      zoomScore.textContent = zoomShot.score + "点"; zoomZone.textContent = label;
      zoom.setAttribute("aria-label", "刃の着地点の拡大。" + zoomShot.score + "点・" + label);
    }
    needle.style.left = power * 100 + "%";
    calls.hidden = phase !== "choice" || sd; reaim.hidden = !cycles[phase]; retry.hidden = !allowRetry || phase !== "summary" || Boolean(series && !seriesWinner());
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
      : "腕の疲れ " + (fatigue < .3 ? "小" : fatigue < .7 ? "中" : "大") + " · 白い刃先を見よう";
    if (steadiness.textContent !== steadyText) steadiness.textContent = steadyText;
    keyhint.hidden = !moving;
    keyhint.textContent = phase === "power" ? "緑の帯でタップ / Space・Enter · Fで集中" : "的をタップ / Space・Enterで止める · Fで集中";
    board.setAttribute("aria-disabled", String(!moving && !(phase === "choice" && actor === "player" && !sd) || actor !== "player" || isPaused()));
    board.setAttribute("aria-label", moving ? ({ horizontal: "横", vertical: "縦", power: "回転" })[phase] + "ゲージ。タップまたはSpaceで止める" : "斧投げの的。赤6点・5の円・リング4〜1点・宣言した青7／8点。青をタップで宣言");
    reaim.disabled = retry.disabled = isPaused() || performance.now() - lastAction < 250;
    action.disabled = isPaused() || ["loading", "flight", "opponent-ready"].includes(phase) || cycles[phase] && elapsed < 250 || performance.now() - lastAction < 250;
    const nextAction = { loading: "読み込み中…", failed: "もう一度読み込む", choice: "構える", horizontal: "横を止める", vertical: "縦を止める", power: strength === "適正" ? "いま放す！" : "緑の帯で放す",
      "opponent-ready": "ひよりが構えています…", flight: "飛んでいく…", result: versus ? turnOf(match) === "opponent" ? "ひよりの番へ" : turnOf(match) === null ? "結果を見る" : "あなたの番へ" : shots.length === rules.throws ? "結果を見る" : "次の投へ",
      summary: series && !seriesWinner() ? "第" + (gameIndex + 2) + "ゲームへ" : "終了" }[phase] || "";
    if (action.textContent !== nextAction) action.textContent = nextAction;
    const last = shown;
    resultCard.hidden = !["result", "summary"].includes(phase);
    rankBadge.hidden = phase !== "summary" || tutorial;
    if (!resultCard.hidden) {
      if (phase === "summary") {
        const stats = sessionStats(shots), totals = versus ? matchResult(match) : null;
        resultLabel.textContent = tutorial ? "LESSON COMPLETE" : versus ? (bestOf > 1 ? "GAME " + (gameIndex + 1) + " · " : "") + ({ player: "YOU WIN", opponent: "GOOD MATCH", draw: "DRAW" })[totals.winner]
          + (totals.suddenDeath ? " · SUDDEN DEATH " + totals.suddenDeath.rounds : "") + (series && seriesWinner() && bestOf > 1 ? " · MATCH " + ({ player: "WON", opponent: "LOST", draw: "DRAW" })[seriesWinner()] : "")
          : ({ great: "GREAT THROWING", good: "NICE SESSION", again: "KEEP THROWING" })[gradeOf(totalOf(shots), rules.max)];
        resultNumber.textContent = String(totalOf(shots)); resultUnit.textContent = "/ " + rules.max;
        const goalsDone = evaluateChallenges(challengeIds, shots, true).filter(c => c.state === "done").length;
        resultTip.textContent = "平均 " + stats.average.toFixed(2) + "点/投 · ブル " + stats.bulls + " · キル " + stats.killshots + "/" + stats.calls + " · 落下 " + stats.drops
          + (challengeIds.length ? " · チャレンジ " + goalsDone + "/" + challengeIds.length : "");
        rankBadge.dataset.rank = tutorial ? "" : rankOf(totalOf(shots), rules.max);
        rankLetter.textContent = rankBadge.dataset.rank; rankTitle.textContent = tutorial ? "" : "「" + titleOf(shots, rules.max) + "」";
      } else if (last) {
        const feedbackText = shotFeedback(last);
        resultLabel.textContent = sd ? (last.score ? "SUDDEN DEATH HIT" : "SUDDEN DEATH MISS") : feedbackText.label;
        resultNumber.textContent = "+" + last.score; resultUnit.textContent = "PTS";
        resultTip.textContent = actor === "player" ? feedbackText.tip : "ひよりの一投 · 回転 " + Math.round(last.power * 100) + "%" + (last.zone?.cluster ? " · " + clusterPlaces[last.zone.cluster] + "の赤" : "");
      }
    }
    drawImpact(displayedShot);
    const nextNote = document.hidden ? "一時停止中" : phase === "loading" ? "準備しています…" : phase === "failed" ? "画像を読み込めませんでした。もう一度お試しください。"
      : phase === "choice" ? sd ? "サドンデス。" + killPlaces[called] + "の青へ、1本。" : switching() ? "後半5投。的を交代。赤と5の閉鎖は開き直す。" : !tutorial && rules.throws > 1 && shots.length === rules.throws - 1 ? lastNote() : "狙いを決めて、構える。" : phase === "horizontal" ? "① 横の位置を止めよう" : phase === "vertical" ? "② 縦の位置を止めよう"
      : phase === "opponent-ready" ? sd ? "ひよりのサドンデス" : called ? "ひよりがキルショットを宣言" : "ひよりの投擲を見よう" : phase === "power" ? "③ 白い刃先＋緑の回転で放す" : phase === "flight" ? "それっ！"
      : phase === "result" ? !last ? "" : last.outcome === "drop" ? (last.dropReason === "weak" ? "柄から当たって落下 · 0点" : "回りすぎて落下 · 0点") : last.outcome === "killshot" ? "キルショット！ " + last.score + "点"
      : last.outcome === "killshot-miss" ? (last.stuck ? "宣言した青い的から外れた · 0点" : "板の外 · 0点") : last.score ? (last.outcome === "bull" ? "ど真ん中！ " : "命中！ ") + last.score + "点" : last.zone?.kind === "closed" ? "閉じた円に触れた · 0点" : "的の外 · 0点"
      : "合計 " + totalOf(shots) + " / " + rules.max + "点";
    const finalNote = versus && phase === "summary" ? ({ player: "あなたの勝ち", opponent: "ひよりの勝ち", draw: "引き分け" })[matchResult(match).winner] + (matchResult(match).suddenDeath ? " · サドンデス" + matchResult(match).suddenDeath.rounds + "本" : "") + (bestOf > 1 ? " · マッチ " + series.wins.player + "-" + series.wins.opponent : "") : nextNote;
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
    const punch = Math.max(0, 1 - elapsed / 200) * (effect.special ? .03 : .014);
    boardPane.style.transform = `translate(${Math.sin(elapsed * .12) * recoil}px, ${Math.cos(elapsed * .15) * recoil * .65}px) scale(${1 + punch})`;
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
      // A called throw (killshot or sudden death) slows down for its final approach.
      const slow = root.dataset.slowMotion === "true";
      const display = reducedMotion ? FLIGHT.travel + FLIGHT.fall : flightTime(elapsed, slow);
      const pose = flightPose(pending, display);
      if (!reducedMotion && display < FLIGHT.travel) {
        const points = [160, 110, 60, 0].map(offset => flightPose(pending, Math.max(0, display - offset)));
        trail.setAttribute("d", points.map((p, i) => `${i ? "L" : "M"}${p.bladeX} ${p.bladeY}`).join(" "));
        trail.setAttribute("opacity", .42 * Math.min(1, display / 120));
        ghosts.forEach((node, i) => {
          renderAxe(node, flightPose(pending, Math.max(0, display - (i + 1) * 40)));
          node.setAttribute("opacity", (i ? .14 : .3) * Math.min(1, display / 80));
        });
        const near = display / FLIGHT.travel, size = 6 + 16 * near;
        contactShadow.setAttribute("cx", CX + pending.landing.x * R); contactShadow.setAttribute("cy", CY + pending.landing.y * R + 4);
        contactShadow.setAttribute("rx", size); contactShadow.setAttribute("ry", size * .42);
        contactShadow.setAttribute("opacity", .42 * near * near);
      } else {
        trail.setAttribute("opacity", 0); contactShadow.setAttribute("opacity", 0);
        ghosts.forEach(node => node.setAttribute("opacity", 0));
      }
      renderAxe(flying, pose); flying.setAttribute("opacity", pose.opacity);
      if (pose.done) {
        let shot = pending;
        if (versus) {
          match = takeTurn(match, actor, { ...shot.aim, power: shot.power, called: shot.called, baseAim: shot.baseAim, sway: shot.sway });
          shots = match.player; shot = latest(actor);
        } else shots.push(shot);
        pending = null;
        if (shot.score > 0) { SE.hit(); if (shot.score >= 6) SE.perfect(); } else SE.miss();
        if (shot.stuck) {
          const embedded = createAxe(); renderAxe(embedded, impactPose(shot)); embedded.dataset.scored = String(shot.score > 0);
          // The handle quivers around the cutting edge for a moment after the thunk; the edge itself never moves.
          if (!reducedMotion) {
            const node = svg("g", { class: "axe-quiver" }); node.append(...embedded.childNodes); embedded.append(node);
            const edge = node.querySelector(".axe-cut-contact");
            quiver = { node, x: Number(edge.getAttribute("cx")), y: Number(edge.getAttribute("cy")) };
          }
          impacts.append(embedded);
        }
        setPhase("result");
      }
    }
    if (phase === "result" && elapsed <= 1250 && !isPaused()) drawImpact(versus ? latest(actor) : shots.at(-1));
    if (phase === "result" && quiver && !isPaused()) {
      const q = quiverAt(elapsed);
      quiver.node.setAttribute("transform", q ? `translate(${quiver.x} ${quiver.y}) rotate(${q.rotate}) scale(1 ${q.scale}) translate(${-quiver.x} ${-quiver.y})` : "");
      if (!q) quiver = null;
    }
    if (cycles[phase] || action.disabled && !["loading", "flight", "opponent-ready"].includes(phase) && !document.hidden && performance.now() - lastAction >= 250) render();
    frame = requestAnimationFrame(tick);
  }
  function cleanup(completed) {
    if (phase === "closed") return;
    clearDeclareCue(); phase = "closed"; cancelAnimationFrame(frame); lifetime.abort(); root.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    root.remove(); active.delete(host); if (previousFocus?.isConnected) previousFocus.focus(); finish(result(completed, shots));
  }
}
