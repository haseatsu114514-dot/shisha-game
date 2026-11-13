// 会話演出デモ（#2732）。#2666 の候補12件を、サンプル会話で1件ずつ・ON/OFFつきで再生して見比べる。
// #3417: 章ごとの新顔6件（10・9・5・37・38・32）を別の段に足した。選別済みの12件の挙動は変えない。
// 判断用のデモ: 本編の台本・進行・保存には触れない。実際の会話UI（CSS・立ち絵・背景・文字送りの音）を使い、
// 文字送りだけデモ専用のプレイヤーで行う（演出が文字送りの速さを変えるため）。新しい画像・音の収録なし。
import { loadAll, portraitInfo, sceneBg, displayName, DB } from "../core/data.js";
import { newGame, state, config } from "../core/state.js";
import { initLayers, layers, setBg } from "../core/ui.js";
import { SE, unlockAudio } from "../core/audio.js";
import { applyUiTheme } from "../core/ui-theme.js";
import { markIntroSeen } from "./intro.js";
import { EFFECTS, EFFECT_ORDER, NEW_FACE_ORDER } from "./conversation-effects-data.js";

const $ = (s) => document.querySelector(s);
const status = $("#preview-status"), stage = $("#stage");
const fxOn = $("#fx-on"), fxReduce = $("#fx-reduce"), fxSkip = $("#fx-skip"), fxAuto = $("#fx-auto"), fxSpeed = $("#fx-speed");
const byNo = new Map(EFFECTS.map((e) => [e.no, e]));
const FRAMING = { target: 1.675, sink: 0.58 }; // engine.js の立ち絵の枠取りと同じ値
const INTERVAL = { 1: 46, 2: 26, 3: 12 };       // 文字送りの1字あたり（engine.js と同じ基準）
const PAUSE_MS = 400, DECL_MS = 90, SLOW_RATE = 2.4, DIM_MS = 120;
const HOLD_LEVEL = 0.03, LEAVE_MS = 400; // 37 息を止める（約 −30dB）／32 退場の薄れ

const query = new URL(location.href).searchParams;
let current = byNo.has(Number(query.get("fx"))) ? Number(query.get("fx")) : EFFECT_ORDER[0];
let run = null;
let pad = null; // 29 用の合成パッド音（新素材なし）

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => fxReduce.checked || matchMedia("(prefers-reduced-motion: reduce)").matches;
/** 演出 no が今この再生で効くか（SKIP中は省く） */
const active = (no) => fxOn.checked && current === no && !fxSkip.checked;
/** テスト用の記録（32 の効果音など）。画面には出さない */
const fxLog = (event) => { (window.__demoFx ||= []).push(event); };

// ---------------------------------------------------------------- 本文

/** 印つきの本文 → 1文字ごとの単位。「……」の区間・震え区間を持たせる */
function parseUnits(text) {
  const units = [];
  let shiver = false, whisper = false, blur = false, pause = false, pauseMs = 0;
  for (let i = 0; i < text.length;) {
    const rest = text.slice(i);
    const tag = /^\[(?:(pause)(?:=(\d+))?|(\/?)(shiver|whisper|blur))\]/.exec(rest);
    if (tag) {
      if (tag[1]) { pause = true; pauseMs = tag[2] ? Math.min(800, Math.max(300, Number(tag[2]))) : 0; }
      else if (tag[4] === "shiver") shiver = !tag[3];
      else if (tag[4] === "whisper") whisper = !tag[3];
      else blur = !tag[3];
      i += tag[0].length;
      continue;
    }
    const ch = String.fromCodePoint(text.codePointAt(i));
    units.push({ ch, shiver, whisper, blur, pause, pauseMs });
    pause = false; pauseMs = 0;
    i += ch.length;
  }
  // 「…」が2つ以上続く区間を言いよどみとして印づける（2）
  for (let i = 0; i < units.length;) {
    if (units[i].ch !== "…") { i++; continue; }
    let j = i;
    while (j < units.length && units[j].ch === "…") j++;
    if (j - i >= 2) for (let k = i; k < j; k++) units[k].hesitate = true;
    i = j;
  }
  return units;
}

function htmlOf(units, n) {
  let html = "", open = "";
  for (let i = 0; i < n; i++) {
    const u = units[i];
    // 8 震え・10 ささやき・9 にじみ。区間の見た目が変わる所で span を閉じて開き直す
    const cls = [
      u.shiver && active(8) && !reduced() && "shiver",
      u.whisper && active(10) && "demo-whisper",
      u.blur && active(9) && !reduced() && "demo-nijimi",
    ].filter(Boolean).join(" ");
    if (cls !== open) {
      if (open) html += "</span>";
      if (cls) html += `<span class="${cls}">`;
      open = cls;
    }
    html += u.ch === "\n" ? "<br>" : esc(u.ch);
  }
  return html + (open ? "</span>" : "");
}

// ---------------------------------------------------------------- 画面

let dom = null, bgReady = null;
function buildDom() {
  const host = layers.vn;
  dom = {
    vignette: Object.assign(document.createElement("div"), { id: "demo-vignette" }),
    portraits: Object.assign(document.createElement("div"), { className: "vn-portraits" }),
    name: Object.assign(document.createElement("div"), { className: "vn-name" }),
    text: Object.assign(document.createElement("div"), { className: "vn-text" }),
    next: Object.assign(document.createElement("div"), { className: "vn-next", textContent: "▼" }),
  };
  dom.box = Object.assign(document.createElement("div"), { className: "vn-box" });
  dom.box.append(dom.name, dom.text, dom.next);
  host.replaceChildren(dom.portraits, dom.vignette, dom.box);
  host.classList.add("active");
  document.body.classList.add("in-vn", "vn-open");
  dom.label = Object.assign(document.createElement("div"), { id: "fx-label" });
  dom.meter = Object.assign(document.createElement("div"), { id: "demo-bgm-meter" });
  dom.meter.innerHTML = '<span>BGM <b id="demo-bgm-db">0 dB</b></span><div class="bar"><b></b></div>';
  dom.end = Object.assign(document.createElement("div"), { id: "demo-end", textContent: "おしまい · ▶ 再生でもう一度" });
  stage.append(dom.label, dom.meter, dom.end);
}

function frame(img, p) {
  const hPct = Math.min(FRAMING.target * p.scale / p.h, 2.4) * 100;
  const extra = Math.max(0, (p.h + (p.topOverhang || 0)) * hPct - FRAMING.sink * 100 - 97);
  img.style.height = `${hPct}%`;
  img.style.bottom = `${-(p.b * hPct + FRAMING.sink * 100 + extra)}%`;
  img.style.setProperty("--ax", `${-(p.ax * 100)}%`);
}

const faceSeen = new Map();
async function showPortrait(line, token) {
  const { speaker, face } = line;
  const info = speaker ? portraitInfo(speaker, face) : null;
  let img = info && dom.portraits.querySelector(`img[data-speaker="${speaker}"]`);
  if (info && !img) {
    const all = [...dom.portraits.querySelectorAll("img")];
    if (all.length >= 2) all[0].remove(); // 同時に出す立ち絵は2枚まで（本編と同じ）
    const used = [...dom.portraits.querySelectorAll("img")].map((i) => i.dataset.slot);
    const slot = used.includes("0") ? "1" : "0";
    img = Object.assign(document.createElement("img"), { className: "portrait enter", alt: "", draggable: false });
    img.dataset.speaker = speaker; img.dataset.slot = slot;
    dom.portraits.append(img);
    requestAnimationFrame(() => requestAnimationFrame(() => img.classList.remove("enter")));
  }
  if (info) {
    // 13: 表情が変わる直前だけ立ち絵を暗くしてから替える
    const changed = faceSeen.has(speaker) && faceSeen.get(speaker) !== face;
    if (changed && active(13) && !reduced()) {
      img.classList.add("demo-dim");
      await sleep(DIM_MS);
      if (run?.token !== token) return;
    }
    if (img.getAttribute("src") !== info.src) img.src = info.src;
    img.dataset.face = face;
    frame(img, info);
    img.classList.remove("demo-dim");
    faceSeen.set(speaker, face);
  }
  const imgs = [...dom.portraits.querySelectorAll("img")];
  dom.portraits.dataset.count = String(imgs.length);
  for (const i of imgs) {
    i.dataset.pos = imgs.length <= 1 ? "center" : i.dataset.slot === "0" ? "left" : "right";
    i.classList.toggle("active", i.dataset.speaker === speaker);
  }
  return img;
}

function showName(speaker) {
  const name = speaker ? displayName(speaker, state) : "";
  dom.name.textContent = name;
  dom.name.classList.toggle("show", !!name);
  dom.name.style.setProperty("--vn-name-length", String([...name].length));
  const color = DB.manifest.introArt?.[speaker]?.color;
  dom.name.classList.toggle("demo-theme", active(12) && !!color);
  if (color) dom.name.style.setProperty("--demo-theme", color);
}

// ---------------------------------------------------------------- 音（29）

function padStart() {
  if (pad) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(), tone = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900;
    tone.gain.value = 0.09; master.gain.value = 1;
    for (const f of [110, 164.8, 277.2, 329.6]) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8; o.connect(tone); o.start();
    }
    tone.connect(lp); lp.connect(master); master.connect(ctx.destination);
    pad = { ctx, master };
  } catch { pad = null; }
}
function padStop() { try { pad?.ctx.close(); } catch {} pad = null; }
/** level 1＝そのまま、0.5＝約 −6dB */
function duck(level, sec) {
  pad?.master.gain.setTargetAtTime(level, pad.ctx.currentTime, sec / 3);
  dom.meter.querySelector(".bar b").style.width = `${level * 100}%`;
  dom.meter.querySelector("#demo-bgm-db").textContent = level < 0.1 ? "無音（−30 dB）" : level < 1 ? "−6 dB" : "0 dB";
}

// ---------------------------------------------------------------- 再生

function blip(line, unit, idx) {
  if (fxSkip.checked || !unit || idx % 3) return;
  try {
    if (active(11) && line.decl) SE.tick();
    else if (active(2) && unit.hesitate) return;
    else if (active(7) && /^（/.test(line.text)) return;
    else if (active(10) && unit.whisper && idx % 6) return;
    else SE.blip(line.speaker);
  } catch {}
}

async function playLine(line, token) {
  const units = parseUnits(line.text);
  dom.next.classList.remove("show");
  dom.text.className = "vn-text";
  dom.text.innerHTML = "";
  dom.box.classList.toggle("narration", !line.speaker);
  showName(line.speaker);
  // 行単位の演出（22 周辺減光 / 23 ピント送り / 29 息継ぎ）
  dom.vignette.classList.toggle("on", active(22) && !!line.vignette);
  $("#bg").classList.toggle("demo-blur", active(23) && !!line.focus);
  if (current === 29) duck(active(29) && line.duck ? 0.5 : 1, active(29) && line.duck ? 0.15 : 0.4);
  // 37 息を止める: ON はほぼ無音、OFF は採用済みの息継ぎ（−6dB）。戻りは0.8秒
  if (current === 37) duck(line.duck ? (active(37) ? HOLD_LEVEL : 0.5) : 1, line.duck ? 0.15 : 0.8);
  // 5 無言の一コマ: 台詞欄を薄くして、立ち絵と背景だけを見せる
  const silent = active(5) && !!line.silent;
  dom.box.classList.toggle("demo-silent", silent);
  // 32 扉の合図: 退場は風の音と0.4秒の薄れ（OFF は音なしで即座に外す）
  if (line.exit) {
    const gone = dom.portraits.querySelector(`img[data-speaker="${line.exit}"]`);
    if (gone) {
      if (active(32)) {
        fxLog("whoosh");
        try { SE.whoosh(); } catch {}
        if (!reduced()) { gone.classList.add("demo-leave"); await sleep(LEAVE_MS); }
        if (run?.token !== token) return;
      }
      gone.remove();
      faceSeen.delete(line.exit);
      const rest = [...dom.portraits.querySelectorAll("img")];
      dom.portraits.dataset.count = String(rest.length);
      for (const i of rest) i.dataset.pos = "center";
    }
  }
  // 32 扉の合図: 入場は店のベル（立ち絵がまだ無い人の行だけ）
  if (line.door === "in" && active(32) && line.speaker && !dom.portraits.querySelector(`img[data-speaker="${line.speaker}"]`)) {
    fxLog("doorbell");
    try { SE.doorbell(); } catch {}
  }
  await showPortrait(line, token);
  if (run?.token !== token) return;
  const img = line.speaker && dom.portraits.querySelector(`img[data-speaker="${line.speaker}"]`);
  // 15: うなずき・首振り（人物だけが動く）
  if (active(15) && line.nod && img && !reduced()) {
    const base = "0 -3px";
    const path = line.nod === "nod" ? ["0 1px", base, "0 1px", base] : ["-4px -3px", "4px -3px", "-4px -3px", "4px -3px", base];
    img.animate([{ translate: base }, ...path.map((translate) => ({ translate }))], { duration: 520, easing: "ease-in-out" });
  }
  run.typing = true; // 溜め・文中ポーズの間のクリックも「最後まで出す」として受ける
  // 1: 溜めの一拍（何も起きない時間）
  if (active(1) && line.beat) await run.wait(line.beat);
  if (run?.token !== token) return;
  if (active(7) && /^（/.test(line.text)) dom.text.classList.add("demo-inner");
  if (silent) { // 本文は出さない。▼は薄れた台詞欄の中に残し、クリックで次へ
    showName("");
    run.typing = false; run.instant = false;
    dom.next.classList.add("show");
    return;
  }
  const speed = Number(fxSpeed.value);
  for (let i = 0; i < units.length && !run.instant && !fxSkip.checked; i++) {
    const u = units[i];
    dom.text.innerHTML = htmlOf(units, i + 1);
    blip(line, u, i);
    let ms = INTERVAL[speed];
    if (active(2) && u.hesitate) ms *= SLOW_RATE;
    if (active(11) && line.decl) ms = DECL_MS;
    await run.wait(ms);
    if (run?.token !== token) return;
    // 3: 文中ポーズ（▼を出さずに止まる）
    const nextUnit = units[i + 1];
    if (nextUnit?.pause && active(3)) await run.wait(PAUSE_MS);
    // 38 文中ポーズの長さ指定: ON は書いた長さ、OFF は採用済みの0.4秒（SKIP中は止まらない）
    else if (nextUnit?.pause && current === 38 && !fxSkip.checked) await run.wait(active(38) ? nextUnit.pauseMs || PAUSE_MS : PAUSE_MS);
    if (run?.token !== token) return;
  }
  dom.text.innerHTML = htmlOf(units, units.length);
  run.typing = false; run.instant = false;
  dom.next.classList.add("show");
}

function nextClick(token) {
  return new Promise((resolve) => {
    run.advance = resolve;
    if (fxAuto.checked || fxSkip.checked) setTimeout(() => run?.token === token && resolve(), fxSkip.checked ? 150 : 1300);
  });
}

async function start() {
  const effect = byNo.get(current);
  const token = Symbol("run");
  run?.stop();
  let timer = null, wakeup = null;
  run = {
    token, typing: false, instant: false, advance: null,
    wait: (ms) => new Promise((r) => { wakeup = r; timer = setTimeout(r, ms); }),
    interrupt() { run.instant = true; clearTimeout(timer); wakeup?.(); },
    stop() { clearTimeout(timer); wakeup?.(); run.advance?.(); },
  };
  document.body.classList.toggle("reduce-shake", reduced());
  document.body.classList.toggle("vn-skip", fxSkip.checked);
  config.textSpeed = Number(fxSpeed.value);
  config.mute = false;
  try { unlockAudio(); } catch {}
  padStop();
  faceSeen.clear();
  dom.portraits.replaceChildren();
  dom.end.classList.remove("show");
  dom.box.classList.remove("demo-silent");
  window.__demoFx = [];
  dom.vignette.classList.remove("on");
  $("#bg").classList.remove("demo-blur");
  dom.label.innerHTML = `<i>${effect.no}</i>${effect.name}`;
  dom.label.classList.toggle("off", !fxOn.checked);
  dom.meter.classList.toggle("show", effect.bgm);
  if (effect.bgm) { padStart(); duck(1, 0.1); }
  status.textContent = `${effect.tag} · ${effect.weight} · 画面をクリックで会話送り（セーブへの影響なし）`;
  for (const line of effect.lines) {
    await playLine(line, token);
    if (run?.token !== token) return;
    await nextClick(token);
    if (run?.token !== token) return;
  }
  dom.vignette.classList.remove("on");
  dom.box.classList.remove("demo-silent");
  $("#bg").classList.remove("demo-blur");
  if (effect.bgm) { duck(1, 0.4); setTimeout(padStop, 900); }
  dom.next.classList.remove("show");
  dom.end.classList.add("show");
  status.textContent = "おしまい · ▶ 再生でもう一度";
}

// ---------------------------------------------------------------- UI

function renderChips() {
  renderChipRow($("#fx-chips"), EFFECT_ORDER);
  renderChipRow($("#fx-chips-new"), NEW_FACE_ORDER);
}
function renderChipRow(chips, order) {
  chips.replaceChildren(...order.map((no) => {
    const e = byNo.get(no);
    const b = Object.assign(document.createElement("button"), { type: "button" });
    b.dataset.fx = String(no);
    b.innerHTML = `${e.no} ${e.name}<span class="tag">${e.tag}</span>`;
    b.classList.toggle("on", no === current);
    b.setAttribute("aria-pressed", String(no === current));
    b.onclick = () => select(no);
    return b;
  }));
}
function renderDesc() {
  const e = byNo.get(current);
  $("#fx-desc").innerHTML = `<b>${e.no} ${e.name}</b>（${e.tag}${e.chapter ? `・${esc(e.chapter)}` : ""}・${e.weight}）${esc(e.summary)} <b>見どころ:</b> ${esc(e.watch)}`;
}
function select(no) {
  current = no;
  renderChips(); renderDesc();
  const url = new URL(location.href); url.searchParams.set("fx", String(no)); history.replaceState(null, "", url);
  start();
}

function fit() {
  const h = $(".preview-tools").offsetHeight;
  $("#viewport").style.top = `${h}px`;
  stage.style.setProperty("--k", String(Math.min(innerWidth / 1280, (innerHeight - h) / 720)));
}

try {
  fit();
  addEventListener("resize", fit);
  new ResizeObserver(fit).observe($(".preview-tools"));
  applyUiTheme(query.get("theme")); // 本編の既定（紙とラベンダー）
  initLayers();
  await loadAll();
  await Promise.all([document.fonts.load('700 24px "Suien Name"', "ひよりハジメ"), document.fonts.load('500 32px "Suien Gothic"')]);
  newGame();
  for (const id of Object.keys(DB.characters)) { state.met[id] = true; markIntroSeen(id); }
  buildDom();
  const bg = sceneBg("bg_tonari_inside_night.png", "night");
  setBg(bg.url, { instant: true, tint: bg.tint });
  // 表情の画像を先に読んで、予兆（13）の切り替えを素早くする
  for (const e of EFFECTS) for (const l of e.lines) { const p = portraitInfo(l.speaker, l.face); if (p) new Image().src = p.src; }
  stage.addEventListener("pointerup", (ev) => {
    if (ev.target.closest(".preview-tools") || !run) return;
    if (run.typing) run.interrupt();
    else run.advance?.();
  });
  $("#fx-play").onclick = start;
  for (const c of [fxOn, fxReduce, fxSkip, fxSpeed]) c.addEventListener("change", start);
  renderChips(); renderDesc();
  await start();
} catch (error) {
  status.textContent = "読み込みに失敗しました。再読み込みしてください。";
  console.error(error);
}
