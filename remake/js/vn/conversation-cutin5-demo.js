// 会話カットイン追加5案（#2845）の見比べデモ（#2924）。はじめの既存の立ち絵（表情の切り抜き）を会話中に出す5案を、
// 実際の台詞の数行で1場面ずつ再生して見比べる。判断用のデモ: 本編の台本・進行・保存には触れない。
// 形式・開き方は PR #2910 の conversation-cutin-demo に揃え、ファイル名だけ別にしている（両方を取り込んでも衝突しない）。
// URL: ?cut=2a・2c・1・5・5b・4・4m・3・3m、&off=1（カットインなし比較）、&reduce=1（動きを減らす）、&hold=1（2c を消さずに止める）、&auto=1
import { loadAll, portraitInfo, sceneBg, displayName, DB } from "../core/data.js";
import { newGame, state, config } from "../core/state.js";
import { initLayers, layers, setBg } from "../core/ui.js";
import { SE, unlockAudio } from "../core/audio.js";
import { applyUiTheme } from "../core/ui-theme.js";
import { markIntroSeen } from "./intro.js";
import { SPRITE, spriteSrc, FOCUS, FRAMES, CUTINS, PLAN_NAMES, sampleLines } from "./conversation-cutin5-demo-data.js";

const $ = (s) => document.querySelector(s);
const status = $("#preview-status"), stage = $("#stage");
const ctOn = $("#ct-on"), ctReduce = $("#ct-reduce"), ctHold = $("#ct-hold"), ctAuto = $("#ct-auto");
const byId = new Map(CUTINS.map((c) => [c.id, c]));
const FRAMING = { target: 1.675, sink: 0.58 }; // engine.js の立ち絵の枠取りと同じ値
const CHAR_MS = 26;                               // 文字送り「ふつう」

const query = new URL(location.href).searchParams;
let current = byId.has(query.get("cut")?.toLowerCase()) ? query.get("cut").toLowerCase() : CUTINS[0].id;
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
  dom.cond = Object.assign(document.createElement("div"), { id: "ct-cond" });
  dom.end = Object.assign(document.createElement("div"), { id: "ct-end", textContent: "おしまい · ▶ 再生でもう一度" });
  stage.append(dom.label, dom.cond, dom.end);
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
  const f = FRAMES[cut.frame], p = cut.pose;
  const [fx, fy] = FOCUS[p.focus || "face"][cut.face];
  const node = document.createElement("div");
  node.className = "ct-cutin";
  Object.assign(node.dataset, { plan: String(cut.plan), face: cut.face, enter: cut.enter, still: String(reduced()) });
  node.classList.toggle("sink", !!cut.sink);
  node.classList.toggle("amber", !!cut.amber);
  node.classList.toggle("dim", !!cut.dim);
  Object.assign(node.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
  const clip = document.createElement("div");
  clip.className = "ct-clip";
  clip.style.clipPath = `polygon(${f.poly.split(" ").map((xy) => xy.split(",").map((v) => `${v}px`).join(" ")).join(",")})`;
  // 既存の立ち絵をそのまま縮尺して、顔（または帽子のつば〜目元）が枠内の指定位置に来るように置くだけ。回転・加筆はしない
  const art = Object.assign(document.createElement("img"), { className: "ct-art", src: spriteSrc(cut.face), alt: "", draggable: false });
  Object.assign(art.style, {
    width: `${SPRITE.w * p.scale}px`, height: `${SPRITE.h * p.scale}px`,
    left: `${p.fx - fx * p.scale}px`, top: `${p.fy - fy * p.scale}px`,
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
  if (cut.ms && !ctHold.checked) cutTimer = setTimeout(() => node === cutNode && clearCutin(), cut.ms);
}

/** #2845 オーナー決定の出せる条件: 相手の立ち絵の枚数（相手の行は1枚だけ、案3・4は独白の0枚も可）と、1会話に1回まで */
function allowed(cut) {
  const n = dom.portraits.querySelectorAll("img").length;
  return !run.shown && cut.partners.includes(n);
}

// ---------------------------------------------------------------- 再生

async function playLine(line, token, cut) {
  dom.next.classList.remove("show");
  dom.text.textContent = "";
  dom.box.classList.toggle("narration", !line.speaker);
  dom.text.classList.toggle("demo-inner", /^（/.test(line.text));
  showName(line.speaker);
  showPortrait(line);
  if (line.cue) {
    const n = dom.portraits.querySelectorAll("img").length, ok = allowed(cut);
    dom.cond.textContent = `この行: 相手の立ち絵 ${n}枚 → ${ok ? "出せる" : "条件外で出さない"}`;
    dom.cond.classList.toggle("ng", !ok);
    if (ok && ctOn.checked) { showCutin(cut); run.shown = true; }
  }
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
    token, typing: false, shown: false, instant: false, advance: null,
    wait: (ms) => new Promise((r) => { wakeup = r; timer = setTimeout(r, ms); }),
    interrupt() { run.instant = true; clearTimeout(timer); wakeup?.(); },
    stop() { clearTimeout(timer); wakeup?.(); run.advance?.(); },
  };
  document.body.classList.toggle("reduce-shake", reduced());
  try { unlockAudio(); } catch {}
  clearCutin();
  dom.portraits.replaceChildren();
  dom.end.classList.remove("show");
  dom.label.innerHTML = `<i>案${cut.plan}</i>${esc(cut.name)}`;
  dom.label.dataset.cut = cut.id;
  dom.cond.textContent = `出せる条件: 相手の立ち絵 ${cut.partners.map((n) => `${n}枚`).join("・")}／1会話1回まで`;
  dom.cond.classList.remove("ng");
  const bg = sceneBg(cut.bg, "night");
  setBg(bg.url, { instant: true, tint: bg.tint });
  dom.label.classList.toggle("off", !ctOn.checked);
  const lines = sampleLines(cut, DB.dialogues);
  if (!lines.length) { status.textContent = `台詞が見つかりません（${cut.sample.dialogue}）`; return; }
  status.textContent = `${cut.ms ? `${cut.ms / 1000}秒で消える` : cut.stay === "line" ? "その行の間だけ" : cut.stay === "fade" ? "次の行で0.3秒かけて薄れる" : "次の行まで残る"} · 表情 ${cut.face} · 会話 ${cut.sample.dialogue} · 画面をクリックで会話送り（セーブへの影響なし）`;
  for (const line of lines) {
    await playLine(line, token, cut);
    if (run?.token !== token) return;
    await nextClick(token);
    if (run?.token !== token) return;
    clearCutin({ fade: cut.stay === "fade" });
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
    b.dataset.short = String(!!c.ms);
    b.innerHTML = `${c.id} ${esc(c.name)}<span class="tag">試す順${c.order}</span>`;
    b.classList.toggle("on", c.id === current);
    b.setAttribute("aria-pressed", String(c.id === current));
    b.onclick = () => select(c.id);
    return b;
  }));
}
function renderDesc() {
  const c = byId.get(current);
  $("#ct-desc").innerHTML = `<b>案${c.plan} ${esc(PLAN_NAMES[c.plan])}</b>（#2845・試す順 ${c.order}／5）<b>場面:</b> ${esc(c.scene)} <b>表情:</b> ${esc(c.faceNote)} <b>素材:</b> 既存の立ち絵（new）の切り抜きのみ・新素材0枚`;
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
  await Promise.all([document.fonts.load('700 24px "Suien Name"', "つむぎハジメスミサメなる"), document.fonts.load('500 32px "Suien Gothic"')]);
  newGame();
  config.textSpeed = 2;
  for (const id of Object.keys(DB.characters)) { state.met[id] = true; markIntroSeen(id); }
  buildDom();
  for (const face of new Set(CUTINS.map((c) => c.face))) new Image().src = spriteSrc(face);
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
