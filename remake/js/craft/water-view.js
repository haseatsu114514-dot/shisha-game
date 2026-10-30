import { el } from "../core/util.js";
import { toast } from "../core/ui.js";
import { state } from "../core/state.js";
import { SE } from "../core/audio.js";
import { stepPanel, benchRoot, craftTest, setBenchWater } from "./session.js";
import { STEP_BRIEFS } from "./bench-ui.js";
import { waterQuantity, changeWater, waterComfort, STEM_TIP } from "./water.js";

function ensureStyle() {
  if (document.querySelector('link[data-craft-water]')) return;
  const link = el("link", { rel: "stylesheet", href: new URL("../../css/craft-water.css", import.meta.url).href, "data-craft-water": "" });
  document.head.append(link);
}

// 入力と波はこの画面だけの寿命。確定時に返すのは実qだけ。
// 開始時は空（0）。途中再開はcs.waterの実量をそのまま渡すので保たれる。
export function mountWater(panel, { quantity = 0, isCurrent = () => true, signal } = {}) {
  let q = waterQuantity(quantity), direction = null, input = null, last = null;
  let raf = 0, done = false, wave = 0, velocity = 0, nextWaterSound = 0;
  let resolve, reject;
  const result = new Promise((yes, no) => { resolve = yes; reject = no; });
  const listeners = [];
  const listen = (target, type, fn, options) => {
    const settings = typeof options === "boolean" ? { capture: options } : options;
    target.addEventListener(type, fn, settings);
    listeners.push(() => target.removeEventListener(type, fn, settings));
  };
  const fill = el("div.craft-water-fill");
  const tip = el("div.craft-water-tip", { text: "ステムの先", dataset: { test: "water-tip" } });
  tip.style.bottom = `${STEM_TIP * 100}%`;
  const meter = el("div.craft-water-meter", { role: "meter", "aria-label": "水量", "aria-valuemin": 0, "aria-valuemax": 100, dataset: { test: "water-meter" } }, [
    fill, el("div.craft-water-band", { "aria-hidden": "true" }), tip,
  ]);
  const status = el("span.craft-water-status", { dataset: { test: "water-status" } });
  const pour = el("button.btn", { type: "button", text: "注ぐ（長押し）", dataset: { test: "water-pour" } });
  const drain = el("button.btn", { type: "button", text: "少しこぼす（長押し）", dataset: { test: "water-drain" } });
  const confirm = el("button.btn.primary", { type: "button", text: "この水量で進む", dataset: { test: "water-confirm" } });
  const root = el("section.craft-water", { dataset: { test: "water-step" } }, [
    el("div.craft-water-display", [meter, el("div", [status, el("p", { text: "目安：ステムが少し浸かるまで（二本の線のあいだ）" })])]),
    el("p.craft-water-help", { text: "押している間だけ水量が変わります。離すと止まり、何度でも調整できます。キーボードはボタンに合わせてSpace / Enterを長押し。" }),
    el("div.craft-water-actions", [pour, drain, confirm]),
  ]);
  panel.append(root);
  const available = () => !done && root.isConnected && isCurrent() && !document.hidden
    && !panel.closest('[inert], .done') && !document.querySelector('#modal.show, .bench-guide[open], .bench-condition[open]');
  function render() {
    fill.style.height = `${q * 100}%`;
    fill.style.setProperty("--water-wave", `${wave}px`);
    meter.setAttribute("aria-valuenow", String(q * 100));
    const band = waterComfort(q).band;
    status.textContent = { none: "ステムに届いていない", shallow: "浸かりが浅い", ideal: "ちょうどよく浸かっている", deep: "深い" }[band];
    status.dataset.band = band;
    meter.setAttribute("aria-valuetext", status.textContent);
    root.dataset.flow = direction || "stopped";
  }
  function advance(now) {
    if (direction && last !== null) q = changeWater(q, direction, Math.max(0, now - last) / 1000);
    last = now;
  }
  function stop() {
    if (direction) {
      advance(performance.now());
      velocity += direction === "pour" ? 12 : -9;
    }
    direction = null; input = null; last = null;
    render();
  }
  function start(flow, token) {
    if (!available() || input) return;
    direction = flow; input = token; last = performance.now();
    if (q !== (flow === "pour" ? 1 : 0)) { SE.pour(); nextWaterSound = last + 260; }
    velocity += flow === "pour" ? 15 : -12;
    render();
  }
  for (const [button, flow] of [[pour, "pour"], [drain, "drain"]]) {
    listen(button, "pointerdown", event => {
      if (event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      start(flow, `pointer:${event.pointerId}`);
      if (input === `pointer:${event.pointerId}`) button.setPointerCapture?.(event.pointerId);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture", "pointerleave"]) {
      listen(button, type, event => { if (input === `pointer:${event.pointerId}`) stop(); });
    }
    listen(button, "pointerout", event => {
      if (input === `pointer:${event.pointerId}` && !button.contains(event.relatedTarget)) stop();
    });
    // capture中もボタン外へ出た時点で止める。戻っても自動再開しない。
    listen(button, "pointermove", event => {
      if (input !== `pointer:${event.pointerId}`) return;
      const box = button.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) stop();
    });
    listen(button, "keydown", event => {
      if (![" ", "Enter"].includes(event.key)) return;
      event.preventDefault();
      if (!event.repeat) start(flow, `key:${event.key}`);
    });
    listen(button, "keyup", event => {
      if (![" ", "Enter"].includes(event.key)) return;
      event.preventDefault();
      if (input === `key:${event.key}`) stop();
    });
    listen(button, "blur", stop);
    listen(button, "contextmenu", event => { event.preventDefault(); stop(); });
  }
  for (const type of ["pointerup", "pointercancel"]) listen(window, type, event => {
    if (input === `pointer:${event.pointerId}`) stop();
  }, true);
  listen(window, "keyup", event => { if (input === `key:${event.key}`) stop(); }, true);
  listen(window, "blur", stop);
  listen(window, "pagehide", () => cancel());
  listen(document, "visibilitychange", () => { if (document.hidden) stop(); });
  // MENU/LOAD/説明を開く入力の時点で止める。閉じても再押下が必要。
  for (const type of ["pointerdown", "click", "keydown"]) listen(document, type, event => {
    if (!root.contains(event.target)) stop();
  }, true);
  function cleanup() {
    cancelAnimationFrame(raf);
    observer.disconnect();
    for (const remove of listeners) remove();
  }
  function finish() {
    if (!available()) return;
    stop(); done = true; cleanup(); confirm.disabled = true;
    resolve(q);
  }
  function cancel() {
    if (done) return;
    stop(); done = true; cleanup();
    reject(new DOMException("Water step interrupted", "AbortError"));
  }
  listen(confirm, "click", finish);
  if (signal) listen(signal, "abort", cancel);
  const observer = new MutationObserver(() => {
    if (!root.isConnected || !isCurrent() || panel.closest('.done')) cancel();
    else if (!available()) stop();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "inert", "open"] });
  let previous = performance.now();
  function frame(now) {
    if (!root.isConnected || !isCurrent() || panel.closest('.done')) { cancel(); return; }
    if (!available()) stop();
    advance(now);
    if (direction && q !== (direction === "pour" ? 1 : 0) && now >= nextWaterSound) {
      SE.pour(); nextWaterSound = now + 260;
    }
    const dt = Math.min(.05, Math.max(0, now - previous) / 1000); previous = now;
    // 波だけ安定化用にdtを制限する。実qには制限せず実経過秒を使う。
    velocity += (-wave * 24 - velocity * 7 + (direction === "pour" ? Math.sin(now / 90) * 12 : 0)) * dt;
    wave = Math.max(-7, Math.min(7, wave + velocity * dt));
    render(); raf = requestAnimationFrame(frame);
  }
  render();
  if (signal?.aborted) cancel();
  else raf = requestAnimationFrame(frame);
  return { root, result, stop, cancel, confirm: finish };
}

export async function stepWater(cs) {
  ensureStyle();
  const ownerState = state;
  // 水はSETUP内の準備。既存の番号付き工程と進捗表示を保つ。
  // 説明文は water 専用（常設 brief と初回レッスン）を使い、setup の文は流用しない。
  const panel = stepPanel("setup", "水入れ", cs.mode === "tutorial"
    ? "スミ「注ぐときは長押し。二本の線を目安に、こぼして戻してもいい」"
    : "長押しで注ぐ・こぼす。水量を決めてから配合へ進む", { brief: STEP_BRIEFS.water, lessonStep: "water" });
  const view = mountWater(panel, { quantity: cs.water, isCurrent: () => state === ownerState && !!benchRoot(cs) });
  if (craftTest.auto) queueMicrotask(view.confirm);
  cs.water = await view.result;
  // 確定した水位を左の作業風景のボトル内部へ描く（本編・練習共通）。
  setBenchWater(cs);
  toast({
    ideal: "ステムがほどよく浸かった。すっきりした吸い心地になりそう",
    shallow: "浅め。煙が冷えきらず、喉に当たるかも",
    deep: "深め。吸い心地が重くなりそう",
    none: "ステムが水に届いていない。煙が冷えないぞ",
  }[waterComfort(cs.water).band]);
  return cs.water;
}
