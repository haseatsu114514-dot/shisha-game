// 会話カットイン案デモ（#2903）。はじめの顔（登場グラフィックカットインの絵柄）を会話中に出す案を、
// 実際の台詞の数行で1案ずつ再生して見比べる。判断用のデモ: 本編の台本・進行・保存には触れない。
// URL: ?cut=A1〜A7 / C1〜C5、&off=1（カットインなし比較）、&reduce=1（動きを減らす）、&hold=1（C を消さずに止める）、&auto=1
import { loadAll, portraitInfo, sceneBg, displayName, DB } from "../core/data.js";
import { newGame, state, config } from "../core/state.js";
import { initLayers, layers, setBg } from "../core/ui.js";
import { SE, unlockAudio } from "../core/audio.js";
import { applyUiTheme } from "../core/ui-theme.js";
import { markIntroSeen } from "./intro.js";
import { ART, FACE, BRIM, FRAMES, CUTINS, sampleLines } from "./conversation-cutin-demo-data.js";

const $ = (s) => document.querySelector(s);
const status = $("#preview-status"), stage = $("#stage");
const ctOn = $("#ct-on"), ctReduce = $("#ct-reduce"), ctHold = $("#ct-hold"), ctAuto = $("#ct-auto");
const byId = new Map(CUTINS.map((c) => [c.id, c]));
const FRAMING = { target: 1.675, sink: 0.58 }; // engine.js の立ち絵の枠取りと同じ値
const CHAR_MS = 26;                               // 文字送り「ふつう」

const query = new URL(location.href).searchParams;
let current = byId.has(query.get("cut")?.toUpperCase()) ? query.get("cut").toUpperCase() : CUTINS[0].id;
ctOn.checked = query.get("off") !== "1";
ctReduce.checked = query.get("reduce") === "1";
ctHold.checked = query.get("hold") === "1";
ctAuto.checked = query.get("auto") === "1";
let run = null;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const reduced = () => ctReduce.checked || matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- 画面

let dom = null;
function buildDom() {
  const host = layers.vn;
  dom = {
    portraits: Object.assign(document.createElement("div"), { className: "vn-portraits" }),
    cutins: Object.assign(document.createElement("div"), { id: "ct-layer" }),
    name: Object.assign(document.createElement("div"), { className: "vn-name" }),
    text: Object.assign(document.createElement("div"), { className: "vn-text" }),
    next: Object.assign(document.createElement("div"), { className: "vn-next", textContent: "▼" }),
  };
  dom.cutins.setAttribute("aria-hidden", "true");
  dom.box = Object.assign(document.createElement("div"), { className: "vn-box" });
  dom.box.append(dom.name, dom.text, dom.next);
  host.replaceChildren(dom.portraits, dom.cutins, dom.box);
  host.classList.add("active");
  document.body.classList.add("in-vn", "vn-open");
  dom.label = Object.assign(document.createElement("div"), { id: "ct-label" });
  dom.end = Object.assign(document.createElement("div"), { id: "ct-end", textContent: "おしまい · ▶ 再生でもう一度" });
  stage.append(dom.label, dom.end);
}

function frame(img, p) {
  const hPct = Math.min(FRAMING.target * p.scale / p.h, 2.4) * 100;
  const extra = Math.max(0, (p.h + (p.topOverhang || 0)) * hPct - FRAMING.sink * 100 - 97);
  img.style.height = `${hPct}%`;
  img.style.bottom = `${-(p.b * hPct + FRAMING.sink * 100 + extra)}%`;
  img.style.setProperty("--ax", `${-(p.ax * 100)}%`);
}

/** 相手の立ち絵（はじめは本編と同じく立ち絵を出さない） */
function showPortrait(line) {
  const { speaker, face } = line;
  const info = speaker && speaker !== "hajime" ? portraitInfo(speaker, face) : null;
  if (info) {
    let img = dom.portraits.querySelector(`img[data-speaker="${speaker}"]`);
    if (!img) {
      dom.portraits.replaceChildren(); // デモは相手1人だけ
      img = Object.assign(document.createElement("img"), { className: "portrait", alt: "", draggable: false });
      img.dataset.speaker = speaker; img.dataset.slot = "0"; img.dataset.pos = "center";
      dom.portraits.append(img);
    }
    if (img.getAttribute("src") !== info.src) img.src = info.src;
    img.dataset.face = face;
    frame(img, info);
  }
  dom.portraits.dataset.count = String(dom.portraits.querySelectorAll("img").length);
  for (const i of dom.portraits.querySelectorAll("img")) i.classList.toggle("active", i.dataset.speaker === speaker);
}

function showName(speaker) {
  const name = speaker ? displayName(speaker, state) : "";
  dom.name.textContent = name;
  dom.name.classList.toggle("show", !!name);
  dom.name.style.setProperty("--vn-name-length", String([...name].length));
}

// ---------------------------------------------------------------- カットイン

let cutNode = null, cutTimer = null;
function clearCutin({ fade = false } = {}) {
  clearTimeout(cutTimer); cutTimer = null;
  const node = cutNode; cutNode = null;
  if (!node) return;
  if (fade && !reduced()) {
    node.classList.add("leave");
    setTimeout(() => node.remove(), 300);
  } else node.remove();
}

function showCutin(cut) {
  clearCutin();
  const f = FRAMES[cut.frame], p = cut.pose, focus = p.focus === "brim" ? BRIM : FACE;
  const node = document.createElement("div");
  node.className = "ct-cutin";
  Object.assign(node.dataset, { kind: cut.kind, enter: cut.enter, still: String(reduced()) });
  node.classList.toggle("sink", !!cut.sink);
  node.classList.toggle("amber", !!cut.amber);
  node.classList.toggle("dim", !!cut.dim);
  Object.assign(node.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
  const clip = document.createElement("div");
  clip.className = "ct-clip";
  clip.style.clipPath = `polygon(${f.poly.split(" ").map((xy) => xy.split(",").map((v) => `${v}px`).join(" ")).join(",")})`;
  const art = Object.assign(document.createElement("img"), { className: "ct-art", src: ART, alt: "", draggable: false });
  Object.assign(art.style, {
    width: `${p.w}px`, height: `${p.w}px`,
    left: `${p.cx - focus.x * p.w}px`, top: `${p.cy - focus.y * p.w}px`,
    transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`, transform: `rotate(${p.rot}deg)`,
  });
  clip.append(art);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${f.w} ${f.h}`);
  const border = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  border.setAttribute("points", f.poly);
  svg.append(border);
  node.append(clip, svg);
  dom.cutins.append(node);
  cutNode = node;
  if (cut.kind === "C" && !ctHold.checked) cutTimer = setTimeout(() => node === cutNode && clearCutin(), cut.ms);
}

// ---------------------------------------------------------------- 再生

async function playLine(line, token, cut) {
  dom.next.classList.remove("show");
  dom.text.textContent = "";
  dom.box.classList.toggle("narration", !line.speaker);
  dom.text.classList.toggle("demo-inner", /^（/.test(line.text));
  showName(line.speaker);
  showPortrait(line);
  if (line.cue && ctOn.checked) showCutin(cut);
  const chars = [...line.text];
  run.typing = true;
  for (let i = 0; i < chars.length && !run.instant; i++) {
    dom.text.innerHTML = esc(chars.slice(0, i + 1).join("")).replace(/\n/g, "<br>");
    if (i % 3 === 0 && line.speaker) try { SE.blip(line.speaker); } catch {}
    await run.wait(CHAR_MS);
    if (run?.token !== token) return;
  }
  dom.text.innerHTML = esc(line.text).replace(/\n/g, "<br>");
  run.typing = false; run.instant = false;
  dom.next.classList.add("show");
}

function nextClick(token) {
  return new Promise((resolve) => {
    run.advance = resolve;
    if (ctAuto.checked) setTimeout(() => run?.token === token && resolve(), 1600);
  });
}

async function start() {
  const cut = byId.get(current);
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
  try { unlockAudio(); } catch {}
  clearCutin();
  dom.portraits.replaceChildren();
  dom.end.classList.remove("show");
  dom.label.innerHTML = `<i>${cut.id}</i>${esc(cut.name)}`;
  dom.label.classList.toggle("off", !ctOn.checked);
  const lines = sampleLines(cut, DB.dialogues);
  if (!lines.length) { status.textContent = `台詞が見つかりません（${cut.sample.dialogue}）`; return; }
  status.textContent = `${cut.kind === "A" ? "A系・残る" : `C系・${cut.ms / 1000}秒で消える`} · 会話 ${cut.sample.dialogue} · 画面をクリックで会話送り（セーブへの影響なし）`;
  for (const line of lines) {
    await playLine(line, token, cut);
    if (run?.token !== token) return;
    await nextClick(token);
    if (run?.token !== token) return;
    clearCutin({ fade: !!cut.sink });
  }
  dom.next.classList.remove("show");
  dom.end.classList.add("show");
  status.textContent = "おしまい · ▶ 再生でもう一度";
}

// ---------------------------------------------------------------- UI

function renderChips() {
  $("#ct-chips").replaceChildren(...CUTINS.map((c) => {
    const b = Object.assign(document.createElement("button"), { type: "button" });
    b.dataset.cut = c.id;
    b.innerHTML = `${c.id} ${esc(c.name)}<span class="tag">${c.kind === "A" ? "残る" : "消える"}</span>`;
    b.classList.toggle("on", c.id === current);
    b.setAttribute("aria-pressed", String(c.id === current));
    b.onclick = () => select(c.id);
    return b;
  }));
}
function renderDesc() {
  const c = byId.get(current);
  $("#ct-desc").innerHTML = `<b>${c.id} ${esc(c.name)}</b>（${esc(c.origin)}）<b>想定場面:</b> ${esc(c.scene)} <b>現行構図からの変化:</b> ${esc(c.change)}`;
}
function syncUrl() {
  const url = new URL(location.href);
  url.searchParams.set("cut", current);
  for (const [key, on] of [["off", !ctOn.checked], ["reduce", ctReduce.checked], ["hold", ctHold.checked], ["auto", ctAuto.checked]]) {
    if (on) url.searchParams.set(key, "1"); else url.searchParams.delete(key);
  }
  history.replaceState(null, "", url);
}
function select(id) {
  current = id;
  renderChips(); renderDesc(); syncUrl();
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
  applyUiTheme(query.get("theme"));
  initLayers();
  await loadAll();
  // 本編では章ごとに後から読む会話もあるので、デモで使う会話ファイルだけ直接読む
  await Promise.all([...new Set(CUTINS.map((c) => c.sample.file))].map(async (file) => {
    const data = await (await fetch(`../data/dialogue/${file}.json`)).json();
    for (const d of data.dialogues || []) DB.dialogues[d.dialogue_id] ??= d;
  }));
  await Promise.all([document.fonts.load('700 24px "Suien Name"', "つむぎハジメ"), document.fonts.load('500 32px "Suien Gothic"')]);
  newGame();
  config.textSpeed = 2;
  for (const id of Object.keys(DB.characters)) { state.met[id] = true; markIntroSeen(id); }
  buildDom();
  const bg = sceneBg("bg_tonari_inside_night.png", "night");
  setBg(bg.url, { instant: true, tint: bg.tint });
  new Image().src = ART;
  stage.addEventListener("pointerup", (ev) => {
    if (ev.target.closest(".preview-tools") || !run) return;
    if (run.typing) run.interrupt();
    else run.advance?.();
  });
  addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || !run) return;
    if (run.typing) run.interrupt(); else run.advance?.();
  });
  $("#ct-play").onclick = start;
  $("#ct-fold").onclick = (ev) => {
    const folded = document.body.classList.toggle("ct-folded");
    ev.currentTarget.textContent = folded ? "ひらく" : "たたむ";
    ev.currentTarget.setAttribute("aria-pressed", String(folded));
  };
  for (const c of [ctOn, ctReduce, ctHold, ctAuto]) c.addEventListener("change", () => { syncUrl(); start(); });
  renderChips(); renderDesc(); syncUrl();
  await start();
} catch (error) {
  status.textContent = "読み込みに失敗しました。再読み込みしてください。";
  console.error(error);
}
