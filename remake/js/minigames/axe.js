// Caller awaits preceding VN. Practice never reads or writes story/save state.
import { el } from "../core/util.js";
import { svg } from "../core/transition-kit.js";
import { SE, unlockAudio } from "../core/audio.js";
import { RINGS, BULLS, KILLS, POWER, SWAY, MODES, RULESET, gaugeAt, axisAt, releaseAimAt, resolveThrow, totalOf, gradeOf, killState, canCall } from "./axe-model.js";
import { createMatch, takeTurn, turnOf, planOpponent, matchResult, DIFFICULTIES } from "./axe-match.js";
import { COMPANIONS, reaction, matchReaction } from "./axe-companions.js";
import { axeRules } from "./axe-rules.js";
import { TARGET, FLIGHT, flightPose, impactPose } from "./axe-flight.js";
import { createAxe, renderAxe } from "./axe-geometry.js";
const active = new WeakMap(), artReady = new Map();
function decodeArt(url) {
  if (!artReady.has(url)) {
    const image = new Image(); image.src = url;
    artReady.set(url, image.decode().catch(error => { artReady.delete(url); throw error; }));
  }
  return artReady.get(url);
}
const art = name => new URL("../../img/" + name, import.meta.url).href;
const ART = { bg: art("backgrounds/bg_axe_lounge_night.webp"), board: art("ui/axe_throw/target_board.webp") };
const faceArt = (id, face) => art("sprites/characters/" + id + "/chr_" + id + "_" + face + ".webp");
const { x: CX, y: CY, radius: R } = TARGET;
const cycles = { horizontal: 3200, vertical: 3600, power: 2400 };
export function runAxeThrow({ host = document.getElementById("stage") || document.getElementById("axe-app"),
  signal, mode = "practice", opponent = "hiyori", allowRetry = true, difficulty = "normal", seed, reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const versus = mode === "versus";
  if ((!versus && !Object.hasOwn(MODES, mode)) || versus && (opponent !== "hiyori" || !Object.hasOwn(DIFFICULTIES, difficulty)) || opponent !== null && !Object.hasOwn(COMPANIONS, opponent)) return Promise.reject(new RangeError("Unknown axe mode or companion"));
  const rules = MODES[versus ? "league" : mode], companion = COMPANIONS[opponent];
  let match;
  try { match = versus ? createMatch(difficulty, seed ?? crypto.getRandomValues(new Uint32Array(1))[0]) : null; }
  catch (error) { return Promise.reject(error); }
  const result = (completed, shots) => ({ completed, cancelled: !completed, throws: structuredClone(shots), total: totalOf(shots),
    grade: completed ? gradeOf(totalOf(shots), rules.max) : null, ruleset: RULESET, mode, opponent, throwCount: rules.throws, maximum: rules.max,
    ...(versus ? { match: { ...matchResult(match), winner: completed ? matchResult(match).winner : null,
      player: structuredClone(match.player), opponent: structuredClone(match.opponent), difficulty, seed: match.seed } } : {}) });
  if (signal?.aborted) return Promise.resolve(result(false, []));
  let finish;
  const promise = new Promise(resolve => { finish = resolve; }); active.set(host, promise);
  const previousFocus = document.activeElement, lifetime = new AbortController();
  // A stage caller can replace #screen while the match overlay is its sibling.
  const callerScreen = versus && host.id === "stage" ? host.querySelector("#screen") : null;
  const callerContent = callerScreen ? [...callerScreen.childNodes] : [];
  let phase = "loading", elapsed = 0, stamp = null, frame = 0, aim = { x: 0, y: 0 }, power = POWER.ideal;
  let shots = match?.player || [], pending = null, called = null, lastAction = -Infinity;
  let actor = "player", matchLines = null;
  let portraitKey = null;
  let held = 0, focusUntil = -1, focusUsed = false, helpPanel = null;
  const root = el("section.axe-game", { role: "dialog", "aria-modal": "true", "aria-label": "斧投げ・" + rules.throws + "投",
    tabindex: "-1", dataset: { test: "axe-game" }, style: { "--axe-bg": "url('" + ART.bg + "')" } });
  root.dataset.mode = mode;
  if (host.id === "stage") root.classList.add("axe-in-stage");
  const round = el("span.axe-round", { dataset: { test: "axe-round" } }), score = el("div.axe-scores");
  const rulesButton = el("button.axe-button.axe-rules-button", { text: "ルール", dataset: { test: "axe-rules" }, onclick: openRules });
  const heading = el("header.axe-header", [el("div", [el("h1", { text: "AXE THROW" }),
    el("p", { text: versus ? "ひよりと10投対戦 · " + DIFFICULTIES[difficulty].name : mode === "league" ? "10投の競技練習" : "3投の練習" })]), round, rulesButton,
    el("button.axe-button.axe-close", { text: "やめる", dataset: { test: "axe-cancel" }, onclick: () => cleanup(false) })]);
  const matchScore = el("div.axe-match-score", { hidden: !versus, "aria-live": "polite", dataset: { test: "axe-match-score" } });
  const matchRecords = el("div.axe-match-records", { hidden: true, dataset: { test: "axe-match-records" } });
  const portrait = el("img.axe-portrait", { alt: companion?.name || "", dataset: { test: "axe-portrait" } });
  const comment = el("p.axe-comment", { "aria-live": "polite", dataset: { test: "axe-comment" } });
  const companionCard = companion ? el("div.axe-companion", [el("div.axe-portrait-frame", [portrait]), el("div", [el("strong", { text: companion.name }), comment])]) : null;
  const board = svg("svg", { viewBox: "0 0 660 520", class: "axe-target", role: "img",
    "aria-label": "5か所の赤い得点圏と4か所の青いキルショット。横・縦ゲージを止めて照準を決める", "data-test": "axe-target" });
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
  const flying = createAxe(); flying.classList.add("axe-flight"); flying.setAttribute("opacity", 0);
  const crosshair = svg("g", { class: "axe-crosshair" }, [svg("circle", { r: 12, fill: "none", stroke: "#fff5d9", "stroke-width": 3 }),
    svg("path", { d: "M-23 0H-7 M7 0H23 M0-23V-7 M0 7V23", stroke: "#fff5d9", "stroke-width": 3 })]);
  const fixedAim = svg("g", { class: "axe-fixed-aim" }, [svg("circle", { r: 7, fill: "none", stroke: "#e5bd70", "stroke-width": 2 }),
    svg("path", { d: "M-12 0H12 M0-12V12", stroke: "#e5bd70", "stroke-width": 1 })]);
  const guides = svg("path", { class: "axe-aim-guides", fill: "none", stroke: "#e5bd70", "stroke-width": 1.5, "stroke-dasharray": "5 7" });
  const powerShift = svg("path", { class: "axe-power-shift", fill: "none", stroke: "#aee0c0", "stroke-width": 3 });
  const releaseDot = svg("circle", { class: "axe-release-dot", r: 4, fill: "#aee0c0" });
  const impactMark = svg("g", { class: "axe-impact-mark", opacity: 0 }, [svg("circle", { r: 15, fill: "none", stroke: "#fff5d9", "stroke-width": 2 }),
    svg("circle", { r: 3, fill: "#fff5d9" })]);
  const xNeedle = svg("path", { class: "axe-x-needle", d: "M0 -10V10", stroke: "#91cfe6", "stroke-width": 4 });
  const yNeedle = svg("path", { class: "axe-y-needle", d: "M-10 0H10", stroke: "#e5bd70", "stroke-width": 4 });
  board.append(guides, powerShift, releaseDot, impacts, impactMark, flying, fixedAim, crosshair,
    svg("rect", { x: CX - R * 1.08, y: 456, width: R * 2.16, height: 12, rx: 4, fill: "#392743", stroke: "#c4a766" }),
    svg("rect", { x: 558, y: CY - R * 1.08, width: 12, height: R * 2.16, rx: 4, fill: "#392743", stroke: "#c4a766" }),
    svg("text", { x: CX, y: 496, "text-anchor": "middle", fill: "#91cfe6", "font-size": 21 }, ["左 ← ① 横 → 右"]),
    svg("text", { x: 588, y: 200, fill: "#e5bd70", "font-size": 20 }, ["上"]),
    svg("text", { x: 580, y: 252, fill: "#e5bd70", "font-size": 20 }, ["②縦"]),
    svg("text", { x: 588, y: 302, fill: "#e5bd70", "font-size": 20 }, ["下"]), xNeedle, yNeedle);
  const note = el("p.axe-note", { "aria-live": "polite", dataset: { test: "axe-note" } });
  const status = el("p.axe-call-status", { dataset: { test: "axe-call-status" } });
  const calls = el("div.axe-calls", [el("button.axe-button", { text: "通常", dataset: { call: "normal" }, onclick: () => selectCall(null) }),
    ...KILLS.map(target => el("button.axe-button", { text: ({ "upper-left": "左上", "upper-right": "右上", "lower-left": "左下", "lower-right": "右下" })[target.id] + " K",
      dataset: { call: target.id }, onclick: () => selectCall(target.id) }))]);
  const needle = el("span.axe-needle", { dataset: { test: "axe-needle" } });
  const steps = el("ol.axe-steps", { "aria-label": "投げるまでの3段階", dataset: { test: "axe-steps" } },
    ["① 横", "② 縦", "③ 力"].map((text, i) => el("li", { dataset: { step: ["horizontal", "vertical", "power"][i] } },
      [el("span", { text }), el("strong", { text: "未確定" })])));
  const powerLabel = el("span.axe-power-label", { text: "③ 力 · 緑の帯で刃の回転を合わせる" });
  const gauge = el("div.axe-gauge", { role: "img", "aria-label": "力ゲージ。緑の帯が適切な力" }, [
    el("span.axe-stick", { style: { left: POWER.stickMin * 100 + "%", width: (POWER.stickMax - POWER.stickMin) * 100 + "%" } }),
    el("span.axe-sweet", { style: { left: POWER.sweetMin * 100 + "%", width: (POWER.sweetMax - POWER.sweetMin) * 100 + "%" } }), needle]);
  const timing = el("div.axe-timing", [powerLabel, gauge,
    el("div.axe-power-scale", [el("span", { text: "弱い・落下" }), el("span", { text: "緑＝適正" }), el("span", { text: "強い・落下" })])]);
  const feedback = el("p.axe-feedback", { dataset: { test: "axe-feedback" } });
  const action = el("button.axe-button.axe-primary", { dataset: { test: "axe-action" }, onclick: act });
  const steadiness = el("p.axe-steadiness", { dataset: { test: "axe-steadiness" } });
  const focusButton = el("button.axe-button", { text: "息を整える · 1回", dataset: { test: "axe-focus" }, onclick: () => {
    if (actor !== "player" || document.hidden || helpPanel || !cycles[phase] || focusUsed || performance.now() - lastAction < 250) return;
    focusUsed = true; focusUntil = held + SWAY.focusDuration; SE.select(); render();
  } });
  const reaim = el("button.axe-button.axe-reaim", { text: "構え直す", dataset: { test: "axe-reaim" }, onclick: () => {
    if (actor === "player" && !document.hidden && !helpPanel && performance.now() - lastAction >= 250 && ["horizontal", "vertical", "power"].includes(phase)) {
      lastAction = performance.now(); aim = { x: 0, y: 0 }; power = POWER.ideal; held = 0; focusUntil = -1; setPhase("choice");
    }
  } });
  const retry = el("button.axe-button.axe-retry", { text: "もう一度", dataset: { test: "axe-retry" }, onclick: () => {
    if (!document.hidden && performance.now() - lastAction >= 250 && phase === "summary") {
      lastAction = performance.now(); if (versus) match = createMatch(difficulty, seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
      actor = "player"; shots = match?.player || []; called = null; aim = { x: 0, y: 0 }; power = POWER.ideal; held = 0; focusUntil = -1; focusUsed = false; impacts.replaceChildren(); setPhase("choice");
    }
  } });
  const controls = el("div.axe-controls", [focusButton, reaim]);
  const body = el("div.axe-body", [el("div.axe-board-pane", [companionCard, board,
    el("p.axe-legend", { text: "赤6点 · リング1〜5点 · 宣言した青7／8点" })]),
    el("aside.axe-panel", [matchScore, score, matchRecords, status, calls, steps, note, timing, feedback, steadiness, action, controls, retry,
      el("p.axe-help", { text: "横 → 縦 → 力。白い刃先の揺れを見て投げる。詳しくは「ルール」。" })])]);
  const footer = el("p.axe-footer", { text: "金色＝止めた狙い · 緑の線＝力による上下ずれ · 白＝予測着地点" });
  root.append(heading, body, footer);
  host.append(root); root.focus();
  root.addEventListener("keydown", key, { signal: lifetime.signal });
  root.addEventListener("pointerup", event => event.stopPropagation(), { signal: lifetime.signal });
  document.addEventListener("visibilitychange", () => { stamp = null; render(); }, { signal: lifetime.signal });
  signal?.addEventListener("abort", () => cleanup(false), { once: true, signal: lifetime.signal });
  window.addEventListener("pagehide", () => cleanup(false), { signal: lifetime.signal });
  loadArt(); frame = requestAnimationFrame(tick); return promise;
  function openRules() {
    if (helpPanel || phase === "closed") return;
    helpPanel = axeRules(() => {
      helpPanel.remove(); helpPanel = null; heading.inert = body.inert = footer.inert = false;
      stamp = null; render(); rulesButton.focus();
    });
    heading.inert = body.inert = footer.inert = true;
    root.append(helpPanel); stamp = null; render(); helpPanel.querySelector("button").focus();
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
        if (!companion) return Promise.all(Object.values(ART).map(decodeArt));
        portraitKey = companion.portraitKey || manifest.titleArts?.find(entry => entry.file.endsWith(companion.titleSuffix))?.character;
        if (!portraitKey || !companion.faces.every(face => manifest.portraits?.[portraitKey]?.faces?.includes(face)))
          throw new Error("Companion artwork missing from catalogue");
        portrait.src = faceArt(portraitKey, companion.faces[0]);
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
    if (actor !== "player" || phase !== "choice" || document.hidden || helpPanel || performance.now() - lastAction < 250 || id && !canCall(id, shots)) return;
    called = id; render();
  }
  function setPhase(next) {
    phase = next; elapsed = 0; stamp = null;
    if (next === "flight") {
      const pose = flightPose(pending, reducedMotion ? FLIGHT.travel + FLIGHT.fall : 0);
      renderAxe(flying, pose); flying.setAttribute("opacity", pose.opacity);
    }
    render();
  }
  function act() {
    if (document.hidden || helpPanel || !["choice", "horizontal", "vertical", "power", "result", "summary", "failed"].includes(phase)
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
      const nodes = [...root.querySelectorAll("button:not([disabled]):not([hidden])")].filter(n => n.getClientRects().length);
      const index = nodes.indexOf(document.activeElement);
      nodes[(index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length]?.focus(); event.preventDefault(); event.stopPropagation(); return;
    }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cleanup(false); return; }
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
    root.dataset.aimX = String(aim.x); root.dataset.aimY = String(aim.y); root.dataset.power = String(power);
    root.dataset.paused = String(document.hidden || Boolean(helpPanel)); root.dataset.called = called || "";
    root.dataset.held = String(held); root.dataset.focusRemaining = String(Math.max(0, focusUntil - held));
    root.dataset.releaseX = String(release.x); root.dataset.releaseY = String(release.y);
    root.dataset.landingX = String(landing.x); root.dataset.landingY = String(landing.y);
    const phaseIndex = ["horizontal", "vertical", "power"].indexOf(phase);
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
    powerLabel.textContent = powerActive ? "③ 力 " + Math.round(power * 100) + "% · " + strength : "③ 力 · 横と縦を止めたら合わせる";
    gauge.setAttribute("aria-label", powerLabel.textContent + "。緑は適正、茶色は刺さる範囲");
    const shiftText = Math.abs(shift) < .006 ? "力による上下ずれなし" : "力の補正 " + (shift > 0 ? "↓ 下" : "↑ 上") + Math.round(Math.abs(shift) * 100) + "%";
    feedback.textContent = powerActive ? shiftText + " · 白が着地点" : "針から伸びる線で位置を確認";
    timing.hidden = !moving && !displayedShot;
    timing.dataset.active = String(powerActive); feedback.hidden = ["loading", "failed", "summary"].includes(phase);
    round.textContent = (versus ? (actor === "player" ? "あなた " : "ひより ") : "") + Math.min(currentShots.length + (["result", "summary"].includes(phase) ? 0 : 1), rules.throws) + " / " + rules.throws + " 投";
    const record = currentShots.map(shot => shot.score).join(",");
    if (score.dataset.record !== record) {
      score.dataset.record = record;
      score.replaceChildren(...Array.from({ length: rules.throws }, (_, i) => el("span", { text: (i + 1) + ": " + (currentShots[i] ? currentShots[i].score : "—"),
        title: currentShots[i] ? (i + 1) + "投目 " + currentShots[i].score + "点" : (i + 1) + "投目" })));
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
    status.textContent = called ? "宣言中：" + ({ "upper-left": "左上", "upper-right": "右上", "lower-left": "左下", "lower-right": "右下" })[called] + "キルショット"
      : "キルショット宣言 · 残り" + ks.remaining + "回";
    for (const button of calls.children) {
      const id = button.dataset.call;
      button.disabled = document.hidden || performance.now() - lastAction < 250 || phase !== "choice" || id !== "normal" && !canCall(id, shots);
      button.setAttribute("aria-pressed", String((called || "normal") === id));
    }
    for (const target of KILLS) {
      const marker = markers.get(target.id); marker.setAttribute("opacity", ks.closed.includes(target.row) ? .22 : 1);
      marker.style.filter = called === target.id ? "drop-shadow(0 0 6px #fff5b1)" : "";
    }
    if (companion) {
      const line = versus && matchLines ? matchReaction(matchLines, phase, match, actor, pending, called) : reaction(opponent, phase, shots, called);
      if (comment.textContent !== line.text) comment.textContent = line.text;
      if (portraitKey) { const url = faceArt(portraitKey, line.face); if (portrait.src !== url) portrait.src = url; }
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
    crosshair.style.opacity = ["choice", "horizontal", "vertical", "power"].includes(phase) ? "1" : "0";
    xNeedle.setAttribute("transform", "translate(" + (CX + aim.x * R) + " 462)");
    yNeedle.setAttribute("transform", "translate(564 " + (CY + aim.y * R) + ")");
    xNeedle.setAttribute("opacity", phase === "horizontal" ? 1 : .5); yNeedle.setAttribute("opacity", phase === "vertical" ? 1 : .5);
    if (phase !== "flight") flying.setAttribute("opacity", 0);
    needle.style.left = power * 100 + "%";
    calls.hidden = phase !== "choice"; reaim.hidden = !cycles[phase]; retry.hidden = !allowRetry || phase !== "summary";
    controls.hidden = steadiness.hidden = !moving;
    focusButton.disabled = document.hidden || Boolean(helpPanel) || focusUsed || performance.now() - lastAction < 250;
    const remaining = Math.max(0, focusUntil - held);
    const focusText = remaining > 0 ? "集中中" : focusUsed ? "集中は使用済み" : "息を整える · 1回";
    if (focusButton.textContent !== focusText) focusButton.textContent = focusText;
    const steadyText = remaining > 0 ? "集中 · あと" + (remaining / 1000).toFixed(1) + "秒"
      : "腕の疲れ " + ((displayedShot?.sway || release.sway).fatigue < .3 ? "小" : (displayedShot?.sway || release.sway).fatigue < .7 ? "中" : "大") + " · 白い刃先を見よう";
    if (steadiness.textContent !== steadyText) steadiness.textContent = steadyText;
    reaim.disabled = retry.disabled = document.hidden || performance.now() - lastAction < 250;
    action.disabled = document.hidden || ["loading", "flight", "opponent-ready"].includes(phase) || cycles[phase] && elapsed < 250 || performance.now() - lastAction < 250;
    const nextAction = { loading: "読み込み中…", failed: "もう一度読み込む", choice: "構える", horizontal: "横を止める", vertical: "縦を止める", power: "力を止めて投げる！",
      "opponent-ready": "ひよりが構えています…", flight: "飛んでいく…", result: versus ? actor === "player" ? "ひよりの番へ" : turnOf(match) === null ? "結果を見る" : "あなたの番へ" : shots.length === rules.throws ? "結果を見る" : "次の投へ", summary: "終了" }[phase] || "";
    if (action.textContent !== nextAction) action.textContent = nextAction;
    const last = currentShots.at(-1);
    const nextNote = document.hidden ? "一時停止中" : phase === "loading" ? "準備しています…" : phase === "failed" ? "画像を読み込めませんでした。もう一度お試しください。"
      : phase === "choice" ? shots.length === 5 ? "後半5投。キルショットの閉鎖は引き継ぎます。" : "通常の得点か、青いキルショットか。" : phase === "horizontal" ? "① 横の位置を止めよう" : phase === "vertical" ? "② 縦の位置を止めよう"
      : phase === "opponent-ready" ? called ? "ひよりがキルショットを宣言" : "ひよりの投擲を見よう" : phase === "power" ? "③ 白い着地点＋緑の力で投げる" : phase === "flight" ? "それっ！"
      : phase === "result" ? last.outcome === "drop" ? (last.dropReason === "weak" ? "力が足りず落下 · 0点" : "回転が合わず落下 · 0点") : last.outcome === "killshot" ? "キルショット！ " + last.score + "点"
      : last.outcome === "killshot-miss" ? "宣言した青い的から外れた · 0点" : last.score ? "命中！ " + last.score + "点" : "的の外 · 0点"
      : "合計 " + totalOf(shots) + " / " + rules.max + "点";
    const finalNote = versus && phase === "summary" ? ({ player: "あなたの勝ち", opponent: "ひよりの勝ち", draw: "引き分け · 延長なし" })[matchResult(match).winner] : nextNote;
    if (note.textContent !== finalNote) note.textContent = finalNote;
    // Disabling a focused native button otherwise sends Space/Enter to the VN below.
    if (focusedButton?.disabled) root.focus();
  }
  function tick(now) {
    if (phase === "closed") return;
    if (!host.isConnected || !root.isConnected || callerScreen && (!callerScreen.isConnected
      || callerScreen.childNodes.length !== callerContent.length
      || callerContent.some((node, i) => callerScreen.childNodes[i] !== node))) { cleanup(false); return; }
    const delta = stamp === null ? 0 : Math.min(50, Math.max(0, now - stamp)); stamp = now;
    if (!document.hidden && !helpPanel) { elapsed += delta; if (cycles[phase]) held += delta; }
    if (phase === "opponent-ready" && !document.hidden && !helpPanel && elapsed >= 1000) {
      SE.whoosh(); setPhase("flight");
    }
    if (phase === "flight" && !document.hidden && !helpPanel) {
      const pose = flightPose(pending, reducedMotion ? FLIGHT.travel + FLIGHT.fall : elapsed);
      renderAxe(flying, pose); flying.setAttribute("opacity", pose.opacity);
      if (pose.done) {
        let shot = pending;
        if (versus) {
          match = takeTurn(match, actor, { ...shot.aim, power: shot.power, called: shot.called, baseAim: shot.baseAim, sway: shot.sway });
          shots = match.player; shot = match[actor].at(-1);
        } else shots.push(shot);
        pending = null;
        if (shot.stuck) { SE.hit(); const embedded = createAxe(); renderAxe(embedded, impactPose(shot)); impacts.append(embedded); }
        setPhase("result");
      }
    }
    if (cycles[phase] || action.disabled && !["loading", "flight", "opponent-ready"].includes(phase) && !document.hidden && performance.now() - lastAction >= 250) render();
    frame = requestAnimationFrame(tick);
  }
  function cleanup(completed) {
    if (phase === "closed") return;
    phase = "closed"; cancelAnimationFrame(frame); lifetime.abort(); root.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    root.remove(); active.delete(host); if (previousFocus?.isConnected) previousFocus.focus(); finish(result(completed, shots));
  }
}
