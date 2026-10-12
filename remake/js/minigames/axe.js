// Reusable interactive scene. Caller waits for preceding VN to finish, then
// handles the returned result; this module never reads/writes relationship/save state.
import { el, clamp } from "../core/util.js";
import { svg } from "../core/transition-kit.js";
import { SE, unlockAudio } from "../core/audio.js";
import { RINGS, THROW_COUNT, gaugeAt, resolveThrow, totalOf, gradeOf } from "./axe-model.js";

const active = new WeakMap();
const artReady = new Map();
function decodeArt(url) {
  if (!artReady.has(url)) {
    const image = new Image(); image.src = url;
    artReady.set(url, image.decode().catch(error => { artReady.delete(url); throw error; }));
  }
  return artReady.get(url);
}
const art = name => new URL("../../img/" + name, import.meta.url).href;
const ART = { bg: art("backgrounds/bg_axe_lounge_night.webp"),
  board: art("ui/axe_throw/target_board.webp"), axe: art("ui/axe_throw/throwing_axe.webp") };
const CX = 330, CY = 245, R = 164;
const presets = [{ x: -.42, y: .24 }, { x: .36, y: -.3 }, { x: -.3, y: -.36 }];
const emptyResult = () => ({ completed: false, cancelled: true, throws: [], total: 0, grade: null });

export function runAxeThrow({ host = document.getElementById("stage") || document.getElementById("axe-app"),
  signal, reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  if (signal?.aborted) return Promise.resolve(emptyResult());
  let finish;
  const promise = new Promise(resolve => { finish = resolve; });
  active.set(host, promise);
  const previousFocus = document.activeElement, lifetime = new AbortController();
  let phase = "loading", elapsed = 0, stamp = null, frame = 0, aim = { ...presets[0] };
  let shots = [], pending = null, lastAction = -Infinity, heldPointer = null;
  const root = el("section.axe-game", { role: "dialog", "aria-modal": "true", "aria-label": "斧投げ3投",
    tabindex: "-1", dataset: { test: "axe-game" }, style: { "--axe-bg": "url('" + ART.bg + "')" } });
  if (host.id === "stage") root.classList.add("axe-in-stage");
  const round = el("span.axe-round", { dataset: { test: "axe-round" } });
  const score = el("div.axe-scores");
  const close = el("button.axe-button.axe-close", { text: "やめる", dataset: { test: "axe-cancel" },
    onclick: () => cleanup(false) });
  const heading = el("header.axe-header", [el("div", [el("h1", { text: "AXE THROW" }),
    el("p", { text: "狙って、投げよう。" })]), round, close]);
  const board = svg("svg", { viewBox: "0 0 660 520", class: "axe-target", tabindex: 0,
    role: "img", "aria-label": "的。タップまたは方向キーで照準を合わせる", "data-test": "axe-target" });
  board.append(svg("image", { href: ART.board, x: 135, y: 50, width: 390, height: 390 }));
  for (const ring of [...RINGS].reverse()) board.append(svg("circle", {
    cx: CX, cy: CY, r: R * ring.radius, fill: ring.score === 6 ? "#ac382a" : "none",
    stroke: "#2d2019", "stroke-width": ring.score === 6 ? 3 : 4 }));
  const impacts = svg("g", { class: "axe-impacts" });
  const flying = svg("g", { class: "axe-flight", opacity: 0 }, [
    svg("image", { href: ART.axe, x: -20.5, y: -27.6, width: 106, height: 159 }),
  ]);
  const crosshair = svg("g", { class: "axe-crosshair", "data-test": "axe-crosshair" }, [
    svg("circle", { r: 13, fill: "none", stroke: "#fff5d9", "stroke-width": 3 }),
    svg("path", { d: "M-23 0H-7 M7 0H23 M0-23V-7 M0 7V23", stroke: "#fff5d9", "stroke-width": 3 }),
  ]);
  board.append(impacts, flying, crosshair);
  const note = el("p.axe-note", { "aria-live": "polite", dataset: { test: "axe-note" } });
  const gauge = el("div.axe-gauge", { role: "img", "aria-label": "往復する針。中央の帯が投げ時" }, [
    el("span.axe-sweet"), el("span.axe-needle", { dataset: { test: "axe-needle" } }),
  ]);
  const needle = gauge.querySelector(".axe-needle");
  const action = el("button.axe-button.axe-primary", { dataset: { test: "axe-action" }, onclick: act });
  const reaim = el("button.axe-button.axe-reaim", { text: "狙い直す", dataset: { test: "axe-reaim" },
    onclick: () => { if (phase === "timing") setPhase("aim"); } });
  const retry = el("button.axe-button.axe-retry", { text: "もう一度", dataset: { test: "axe-retry" },
    onclick: () => { if (phase === "summary") { shots = []; impacts.replaceChildren(); aim = { ...presets[0] }; setPhase("aim"); } } });
  const arrows = el("div.axe-arrows", [
    ...[["←", -1, 0, "左"], ["↑", 0, -1, "上"], ["↓", 0, 1, "下"], ["→", 1, 0, "右"]].map(([label, x, y, direction]) =>
      el("button.axe-button", { text: label, "aria-label": direction + "へ狙う", dataset: { test: "axe-aim-" + direction },
        onclick: () => nudge(x, y) })),
  ]);
  root.append(heading, el("div.axe-body", [
    el("div.axe-board-pane", [board, el("p.axe-legend", { text: "中心6点 · 外側1〜5点 · 外れ0点" })]),
    el("aside.axe-panel", [score, note, el("div.axe-timing", [el("span", { text: "中央の帯で投げる" }), gauge]),
      action, reaim, arrows, retry,
      el("p.axe-help", { text: "タップ／矢印で照準。Spaceでも投げられます。" })]),
  ]), el("p.axe-footer", { text: "3投で最大18点。何度でも挑戦できます。" }));
  host.append(root); root.focus();
  root.addEventListener("keydown", key, { signal: lifetime.signal });
  root.addEventListener("pointerup", event => event.stopPropagation(), { signal: lifetime.signal });
  board.addEventListener("pointerdown", event => {
    if (phase !== "aim" || !event.isPrimary) return;
    event.preventDefault(); unlockAudio(); board.focus(); heldPointer = event.pointerId;
    board.setPointerCapture(event.pointerId); pointAt(event);
  }, { signal: lifetime.signal });
  board.addEventListener("pointermove", event => { if (event.pointerId === heldPointer) pointAt(event); }, { signal: lifetime.signal });
  const releasePointer = () => { heldPointer = null; };
  board.addEventListener("pointerup", releasePointer, { signal: lifetime.signal });
  board.addEventListener("pointercancel", releasePointer, { signal: lifetime.signal });
  document.addEventListener("visibilitychange", () => { stamp = null; render(); }, { signal: lifetime.signal });
  signal?.addEventListener("abort", () => cleanup(false), { once: true, signal: lifetime.signal });
  loadArt();
  frame = requestAnimationFrame(tick);
  return promise;

  function loadArt() {
    setPhase("loading");
    Promise.all(Object.values(ART).map(decodeArt)).then(() => {
      if (phase !== "closed") setPhase("aim");
    }, () => { if (phase !== "closed") setPhase("failed"); });
  }

  function pointAt(event) {
    if (phase !== "aim") return;
    const matrix = board.getScreenCTM(); if (!matrix) return;
    const p = board.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    const local = p.matrixTransform(matrix.inverse());
    aim = { x: clamp((local.x - CX) / R, -1.05, 1.05), y: clamp((local.y - CY) / R, -1.05, 1.05) };
    render();
  }
  function nudge(x, y) {
    if (phase !== "aim") return;
    unlockAudio(); aim = { x: clamp(aim.x + x * .12, -1.05, 1.05), y: clamp(aim.y + y * .12, -1.05, 1.05) };
    render();
  }
  function setPhase(next) {
    phase = next; elapsed = 0; stamp = null; render();
  }
  function act() {
    if (document.hidden || !["aim","timing","result","summary","failed"].includes(phase)
      || phase === "timing" && elapsed < 250 || performance.now() - lastAction < 250) return;
    lastAction = performance.now(); unlockAudio();
    if (phase === "failed") loadArt();
    else if (phase === "aim") { SE.select(); setPhase("timing"); }
    else if (phase === "timing" && elapsed >= 250) {
      pending = resolveThrow(aim, gaugeAt(elapsed)); SE.whoosh(); setPhase("flight");
    } else if (phase === "result") { aim = { ...presets[shots.length] }; setPhase("aim"); }
    else if (phase === "summary") cleanup(true);
  }
  function key(event) {
    if (event.key === "Tab") {
      const nodes = [...root.querySelectorAll("button:not([disabled]):not([hidden]), svg[tabindex]")].filter(n => n.getClientRects().length);
      const index = nodes.indexOf(document.activeElement);
      nodes[(index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length]?.focus();
      event.preventDefault(); event.stopPropagation(); return;
    }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cleanup(false); return; }
    const vectors = { ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowRight: [1, 0] };
    if (vectors[event.key]) { event.preventDefault(); event.stopPropagation(); nudge(...vectors[event.key]); return; }
    if (event.key === " " || event.key === "Enter") {
      event.stopPropagation();
      if (event.target.tagName === "BUTTON") { if (event.repeat) event.preventDefault(); return; }
      event.preventDefault(); if (!event.repeat) act();
    }
  }
  function render() {
    root.dataset.phase = phase; root.dataset.timing = String(gaugeAt(elapsed));
    root.dataset.aimX = String(aim.x); root.dataset.aimY = String(aim.y);
    root.dataset.paused = String(document.hidden);
    const count = shots.length;
    round.textContent = Math.min(count + 1, 3) + " / 3 投";
    const record = shots.map(shot => shot.score).join(",");
    if (score.dataset.record !== record) {
      score.dataset.record = record;
      score.replaceChildren(...Array.from({ length: 3 }, (_, i) => el("span", { text: (i + 1) + "投目  " + (shots[i] ? shots[i].score + "点" : "—") })));
    }
    crosshair.setAttribute("transform", "translate(" + (CX + aim.x * R) + " " + (CY + aim.y * R) + ")");
    crosshair.style.opacity = phase === "aim" || phase === "timing" ? "1" : "0";
    flying.setAttribute("opacity", phase === "flight" ? 1 : 0);
    needle.style.left = gaugeAt(elapsed) * 100 + "%";
    arrows.hidden = phase !== "aim"; reaim.hidden = phase !== "timing"; retry.hidden = phase !== "summary";
    root.querySelector(".axe-timing").hidden = phase !== "timing";
    action.disabled = document.hidden || phase === "loading" || phase === "flight" || phase === "timing" && elapsed < 250
      || performance.now() - lastAction < 250;
    const nextAction = { loading: "読み込み中…", failed: "もう一度読み込む", aim: "構える", timing: "投げる！", flight: "飛んでいく…", result: "次の投へ", summary: "終了" }[phase] || "";
    if (action.textContent !== nextAction) action.textContent = nextAction;
    const last = shots.at(-1);
    const nextNote = document.hidden ? "一時停止中" : phase === "loading" ? "準備しています…" : phase === "failed" ? "画像を読み込めませんでした。もう一度お試しください。"
      : phase === "aim" ? "照準を合わせよう" : phase === "timing" ? "針が中央に来たら投げる！"
      : phase === "flight" ? "それっ！" : phase === "result" ? (last.score === 6 ? "中心に命中！ 6点" : last.score ? "命中！ " + last.score + "点" : "惜しい、的の外！ 0点")
      : "合計 " + totalOf(shots) + " / 18点";
    if (note.textContent !== nextNote) note.textContent = nextNote;
  }
  function tick(now) {
    if (phase === "closed") return;
    if (!host.isConnected) { cleanup(false); return; }
    const delta = stamp === null ? 0 : Math.min(50, Math.max(0, now - stamp)); stamp = now;
    if (!document.hidden) elapsed += delta;
    if (phase === "flight" && !document.hidden) {
      const t = reducedMotion ? 1 : Math.min(1, elapsed / 520);
      const endX = CX + pending.landing.x * R, endY = CY + pending.landing.y * R;
      const x = CX + (endX - CX) * t, y = 530 + (endY - 530) * t - 180 * Math.sin(Math.PI * t);
      flying.setAttribute("transform", "translate(" + x + " " + y + ") rotate(" + (360 * t) + ")");
      if (t === 1) {
        shots.push(pending); pending = null; SE.hit();
        impacts.append(svg("g", { transform: "translate(" + endX + " " + endY + ") rotate(" + [-8, 8, 0][shots.length - 1] + ")" }, [
          svg("image", { href: ART.axe, x: -20.5, y: -27.6, width: 106, height: 159 }),
        ]));
        setPhase(shots.length === THROW_COUNT ? "summary" : "result");
      }
    }
    if (phase === "timing" || action.disabled && ["aim","result","summary","failed"].includes(phase)
      && !document.hidden && performance.now() - lastAction >= 250) render();
    frame = requestAnimationFrame(tick);
  }
  function cleanup(completed) {
    if (phase === "closed") return;
    phase = "closed"; cancelAnimationFrame(frame); lifetime.abort();
    root.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    root.remove(); active.delete(host);
    if (previousFocus?.isConnected) previousFocus.focus();
    const copy = structuredClone(shots), total = totalOf(copy);
    finish({ completed, cancelled: !completed, throws: copy, total, grade: completed ? gradeOf(total) : null });
  }
}
