// Caller awaits preceding VN. Practice never reads or writes story/save state.
import { el } from "../core/util.js";
import { svg } from "../core/transition-kit.js";
import { SE, unlockAudio } from "../core/audio.js";
import { RINGS, BULLS, KILLS, POWER, MODES, RULESET, gaugeAt, axisAt, resolveThrow, totalOf, gradeOf, killState, canCall } from "./axe-model.js";
import { COMPANIONS, reaction } from "./axe-companions.js";
const active = new WeakMap(), artReady = new Map();
function decodeArt(url) {
  if (!artReady.has(url)) {
    const image = new Image(); image.src = url;
    artReady.set(url, image.decode().catch(error => { artReady.delete(url); throw error; }));
  }
  return artReady.get(url);
}
const art = name => new URL("../../img/" + name, import.meta.url).href;
const ART = { bg: art("backgrounds/bg_axe_lounge_night.webp"), board: art("ui/axe_throw/target_board.webp"), axe: art("ui/axe_throw/throwing_axe.webp") };
const faceArt = (id, face) => art("sprites/characters/" + id + "/chr_" + id + "_" + face + ".webp");
const CX = 330, CY = 245, R = 164;
const cycles = { horizontal: 3200, vertical: 3600, power: 2400 };
export function runAxeThrow({ host = document.getElementById("stage") || document.getElementById("axe-app"),
  signal, mode = "practice", opponent = "hiyori", reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  if (!Object.hasOwn(MODES, mode) || !Object.hasOwn(COMPANIONS, opponent)) return Promise.reject(new RangeError("Unknown axe mode or companion"));
  const rules = MODES[mode], companion = COMPANIONS[opponent];
  const result = (completed, shots) => ({ completed, cancelled: !completed, throws: structuredClone(shots), total: totalOf(shots),
    grade: completed ? gradeOf(totalOf(shots), rules.max) : null, ruleset: RULESET, mode, opponent, throwCount: rules.throws, maximum: rules.max });
  if (signal?.aborted) return Promise.resolve(result(false, []));
  let finish;
  const promise = new Promise(resolve => { finish = resolve; }); active.set(host, promise);
  const previousFocus = document.activeElement, lifetime = new AbortController();
  let phase = "loading", elapsed = 0, stamp = null, frame = 0, aim = { x: 0, y: 0 }, power = POWER.ideal;
  let shots = [], pending = null, called = null, lastAction = -Infinity;
  const root = el("section.axe-game", { role: "dialog", "aria-modal": "true", "aria-label": "斧投げ・" + rules.throws + "投",
    tabindex: "-1", dataset: { test: "axe-game" }, style: { "--axe-bg": "url('" + ART.bg + "')" } });
  if (host.id === "stage") root.classList.add("axe-in-stage");
  const round = el("span.axe-round", { dataset: { test: "axe-round" } }), score = el("div.axe-scores");
  const heading = el("header.axe-header", [el("div", [el("h1", { text: "AXE THROW" }),
    el("p", { text: mode === "league" ? "10投の競技練習" : "3投の練習" })]), round,
    el("button.axe-button.axe-close", { text: "やめる", dataset: { test: "axe-cancel" }, onclick: () => cleanup(false) })]);
  const portrait = el("img.axe-portrait", { alt: companion.name, src: faceArt(opponent, companion.faces[0]), dataset: { test: "axe-portrait" } });
  const comment = el("p.axe-comment", { "aria-live": "polite", dataset: { test: "axe-comment" } });
  const companionCard = el("div.axe-companion", [portrait, el("div", [el("strong", { text: companion.name }), comment])]);
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
  const axeImage = () => svg("image", { href: ART.axe, x: -20.5, y: -27.6, width: 106, height: 159 });
  const flying = svg("g", { class: "axe-flight", opacity: 0 }, [axeImage()]);
  const crosshair = svg("g", { class: "axe-crosshair" }, [svg("circle", { r: 12, fill: "none", stroke: "#fff5d9", "stroke-width": 3 }),
    svg("path", { d: "M-23 0H-7 M7 0H23 M0-23V-7 M0 7V23", stroke: "#fff5d9", "stroke-width": 3 })]);
  const xNeedle = svg("path", { d: "M0 -10V10", stroke: "#fff7df", "stroke-width": 4 });
  const yNeedle = svg("path", { d: "M-10 0H10", stroke: "#fff7df", "stroke-width": 4 });
  board.append(impacts, flying, crosshair,
    svg("rect", { x: CX - R * 1.08, y: 456, width: R * 2.16, height: 12, rx: 4, fill: "#392743", stroke: "#c4a766" }),
    svg("rect", { x: 558, y: CY - R * 1.08, width: 12, height: R * 2.16, rx: 4, fill: "#392743", stroke: "#c4a766" }),
    svg("text", { x: CX, y: 496, "text-anchor": "middle", fill: "#f8dfa7", "font-size": 23 }, ["横ゲージ"]),
    svg("text", { x: 594, y: 260, fill: "#f8dfa7", "font-size": 23 }, ["縦"]), xNeedle, yNeedle);
  const note = el("p.axe-note", { "aria-live": "polite", dataset: { test: "axe-note" } });
  const status = el("p.axe-call-status", { dataset: { test: "axe-call-status" } });
  const calls = el("div.axe-calls", [el("button.axe-button", { text: "通常", dataset: { call: "normal" }, onclick: () => selectCall(null) }),
    ...KILLS.map(target => el("button.axe-button", { text: ({ "upper-left": "左上", "upper-right": "右上", "lower-left": "左下", "lower-right": "右下" })[target.id] + " K",
      dataset: { call: target.id }, onclick: () => selectCall(target.id) }))]);
  const needle = el("span.axe-needle", { dataset: { test: "axe-needle" } });
  const powerLabel = el("span", { text: "力 · 緑の帯で刃の回転を合わせる" });
  const gauge = el("div.axe-gauge", { role: "img", "aria-label": "力ゲージ。緑の帯が適切な力" }, [
    el("span.axe-sweet", { style: { left: POWER.sweetMin * 100 + "%", width: (POWER.sweetMax - POWER.sweetMin) * 100 + "%" } }), needle]);
  const action = el("button.axe-button.axe-primary", { dataset: { test: "axe-action" }, onclick: act });
  const reaim = el("button.axe-button.axe-reaim", { text: "構え直す", dataset: { test: "axe-reaim" }, onclick: () => {
    if (["horizontal", "vertical", "power"].includes(phase)) { aim = { x: 0, y: 0 }; power = POWER.ideal; setPhase("choice"); }
  } });
  const retry = el("button.axe-button.axe-retry", { text: "もう一度", dataset: { test: "axe-retry" }, onclick: () => {
    if (phase === "summary") { shots = []; called = null; aim = { x: 0, y: 0 }; power = POWER.ideal; impacts.replaceChildren(); setPhase("choice"); }
  } });
  root.append(heading, el("div.axe-body", [el("div.axe-board-pane", [companionCard, board,
    el("p.axe-legend", { text: "赤6点 · リング1〜5点 · 宣言した青7／8点" })]),
    el("aside.axe-panel", [score, status, calls, note, el("div.axe-timing", [powerLabel, gauge]), action, reaim, retry,
      el("p.axe-help", { text: "横 → 縦 → 力。ボタン／Spaceで順に止める。キルショット宣言は2回、外すと0点。" })])]),
    el("p.axe-footer", { text: "ラウンジ競技ルール · キルショット成功で同じ高さの2つが閉じる · 力が合わず落ちると0点" }));
  host.append(root); root.focus();
  root.addEventListener("keydown", key, { signal: lifetime.signal });
  root.addEventListener("pointerup", event => event.stopPropagation(), { signal: lifetime.signal });
  document.addEventListener("visibilitychange", () => { stamp = null; render(); }, { signal: lifetime.signal });
  signal?.addEventListener("abort", () => cleanup(false), { once: true, signal: lifetime.signal });
  loadArt(); frame = requestAnimationFrame(tick); return promise;
  function loadArt() {
    setPhase("loading");
    Promise.all([...Object.values(ART), ...companion.faces.map(face => faceArt(opponent, face))].map(decodeArt))
      .then(() => { if (phase !== "closed") setPhase("choice"); }, () => { if (phase !== "closed") setPhase("failed"); });
  }
  function selectCall(id) {
    if (phase !== "choice" || document.hidden || id && !canCall(id, shots)) return;
    called = id; render();
  }
  function setPhase(next) { phase = next; elapsed = 0; stamp = null; render(); }
  function act() {
    if (document.hidden || !["choice", "horizontal", "vertical", "power", "result", "summary", "failed"].includes(phase)
      || cycles[phase] && elapsed < 250 || performance.now() - lastAction < 250) return;
    lastAction = performance.now(); unlockAudio();
    if (phase === "failed") loadArt();
    else if (phase === "choice") { SE.select(); setPhase("horizontal"); }
    else if (phase === "horizontal") { aim.x = axisAt(gaugeAt(elapsed, cycles.horizontal)); SE.select(); setPhase("vertical"); }
    else if (phase === "vertical") { aim.y = axisAt(gaugeAt(elapsed, cycles.vertical)); SE.select(); setPhase("power"); }
    else if (phase === "power") { power = gaugeAt(elapsed, cycles.power); pending = resolveThrow({ ...aim, power, called }, shots); SE.whoosh(); setPhase("flight"); }
    else if (phase === "result") {
      if (shots.length === rules.throws) setPhase("summary");
      else { called = null; aim = { x: 0, y: 0 }; power = POWER.ideal; impacts.replaceChildren(); setPhase("choice"); }
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
    if (phase === "horizontal") aim.x = axisAt(gaugeAt(elapsed, cycles.horizontal));
    if (phase === "vertical") aim.y = axisAt(gaugeAt(elapsed, cycles.vertical));
    if (phase === "power") power = gaugeAt(elapsed, cycles.power);
    root.dataset.phase = phase; root.dataset.timing = String(gaugeAt(elapsed, cycles[phase] || 3200));
    root.dataset.aimX = String(aim.x); root.dataset.aimY = String(aim.y); root.dataset.power = String(power);
    root.dataset.paused = String(document.hidden); root.dataset.called = called || "";
    round.textContent = Math.min(shots.length + 1, rules.throws) + " / " + rules.throws + " 投";
    const record = shots.map(shot => shot.score).join(",");
    if (score.dataset.record !== record) {
      score.dataset.record = record;
      score.replaceChildren(...Array.from({ length: rules.throws }, (_, i) => el("span", { text: (i + 1) + ": " + (shots[i] ? shots[i].score : "—"),
        title: shots[i] ? (i + 1) + "投目 " + shots[i].score + "点" : (i + 1) + "投目" })));
    }
    const ks = killState(shots);
    status.textContent = called ? "宣言中：" + ({ "upper-left": "左上", "upper-right": "右上", "lower-left": "左下", "lower-right": "右下" })[called] + "キルショット"
      : "キルショット宣言 · 残り" + ks.remaining + "回";
    for (const button of calls.children) {
      const id = button.dataset.call;
      button.disabled = document.hidden || phase !== "choice" || id !== "normal" && !canCall(id, shots);
      button.setAttribute("aria-pressed", String((called || "normal") === id));
    }
    for (const target of KILLS) {
      const marker = markers.get(target.id); marker.setAttribute("opacity", ks.closed.includes(target.row) ? .22 : 1);
      marker.style.filter = called === target.id ? "drop-shadow(0 0 6px #fff5b1)" : "";
    }
    const line = reaction(opponent, phase, shots, called);
    if (comment.textContent !== line.text) comment.textContent = line.text;
    const url = faceArt(opponent, line.face); if (portrait.src !== url) portrait.src = url;
    crosshair.setAttribute("transform", "translate(" + (CX + aim.x * R) + " " + (CY + aim.y * R) + ")");
    crosshair.style.opacity = ["choice", "horizontal", "vertical", "power"].includes(phase) ? "1" : "0";
    xNeedle.setAttribute("transform", "translate(" + (CX + aim.x * R) + " 462)");
    yNeedle.setAttribute("transform", "translate(564 " + (CY + aim.y * R) + ")");
    xNeedle.setAttribute("opacity", phase === "horizontal" ? 1 : .5); yNeedle.setAttribute("opacity", phase === "vertical" ? 1 : .5);
    flying.setAttribute("opacity", phase === "flight" ? 1 : 0); needle.style.left = power * 100 + "%";
    calls.hidden = phase !== "choice"; reaim.hidden = !cycles[phase]; retry.hidden = phase !== "summary";
    action.disabled = document.hidden || ["loading", "flight"].includes(phase) || cycles[phase] && elapsed < 250 || performance.now() - lastAction < 250;
    const nextAction = { loading: "読み込み中…", failed: "もう一度読み込む", choice: "構える", horizontal: "横を止める", vertical: "縦を止める", power: "力を止めて投げる！",
      flight: "飛んでいく…", result: shots.length === rules.throws ? "結果を見る" : "次の投へ", summary: "終了" }[phase] || "";
    if (action.textContent !== nextAction) action.textContent = nextAction;
    const last = shots.at(-1);
    const nextNote = document.hidden ? "一時停止中" : phase === "loading" ? "準備しています…" : phase === "failed" ? "画像を読み込めませんでした。もう一度お試しください。"
      : phase === "choice" ? shots.length === 5 ? "後半5投。キルショットの閉鎖は引き継ぎます。" : "通常の得点か、青いキルショットか。" : phase === "horizontal" ? "① 横の位置を止めよう" : phase === "vertical" ? "② 縦の位置を止めよう"
      : phase === "power" ? "③ 力は緑の帯へ。強すぎても落ちる！" : phase === "flight" ? "それっ！"
      : phase === "result" ? last.outcome === "drop" ? (last.dropReason === "weak" ? "力が足りず落下 · 0点" : "回転が合わず落下 · 0点") : last.outcome === "killshot" ? "キルショット！ " + last.score + "点"
      : last.outcome === "killshot-miss" ? "宣言した青い的から外れた · 0点" : last.score ? "命中！ " + last.score + "点" : "的の外 · 0点"
      : "合計 " + totalOf(shots) + " / " + rules.max + "点";
    if (note.textContent !== nextNote) note.textContent = nextNote;
  }
  function tick(now) {
    if (phase === "closed") return;
    if (!host.isConnected) { cleanup(false); return; }
    const delta = stamp === null ? 0 : Math.min(50, Math.max(0, now - stamp)); stamp = now;
    if (!document.hidden) elapsed += delta;
    if (phase === "flight" && !document.hidden) {
      const t = reducedMotion ? 1 : Math.min(1, elapsed / 600);
      const endX = CX + pending.landing.x * R, endY = CY + pending.landing.y * R;
      const x = CX + (endX - CX) * t;
      const y = 530 + (endY - 530) * t - 180 * Math.sin(Math.PI * t) + (!pending.stuck ? 90 * t * t : 0);
      flying.setAttribute("transform", "translate(" + x + " " + y + ") rotate(" + pending.rotation * t + ")");
      if (t === 1) {
        const shot = pending; shots.push(shot); pending = null;
        if (shot.stuck) { SE.hit(); impacts.append(svg("g", { transform: "translate(" + endX + " " + endY + ") rotate(" + (shot.rotation - 360) + ")" }, [axeImage()])); }
        setPhase("result");
      }
    }
    if (cycles[phase] || action.disabled && !["loading", "flight"].includes(phase) && !document.hidden && performance.now() - lastAction >= 250) render();
    frame = requestAnimationFrame(tick);
  }
  function cleanup(completed) {
    if (phase === "closed") return;
    phase = "closed"; cancelAnimationFrame(frame); lifetime.abort(); root.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    root.remove(); active.delete(host); if (previousFocus?.isConnected) previousFocus.focus(); finish(result(completed, shots));
  }
}
