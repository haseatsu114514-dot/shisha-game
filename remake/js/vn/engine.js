// 会話エンジン。data/dialogue/*.json のスキーマをそのまま解釈する。
//   play(idOrDialogue, opts) → Promise（会話が終わると解決）
// 分岐（condition / choice）の行は「残りの行の前」に差し込む（旧版・Godot版と同じ挙動）。
import { el } from "../core/util.js";
import { DB, displayName, portraitInfo, sceneBg, cgUrl, preload } from "../core/data.js";
import { state, markMet, STAT_EN, timeOfDay, config } from "../core/state.js";
import { applyStats, gainAffinity, addMoney, affinityLevel } from "../core/stats.js";
import { setBg, layers, toast, flash, shake, modal } from "../core/ui.js";
import { SE, playSe } from "../core/audio.js";
import { paginate, formatHtml, sliceHtml, visibleLength, stripTags } from "./text.js";
import { glossaryPanel } from "./glossary.js";

// 立ち絵を出さない話者（主人公は一人称視点）
const NO_PORTRAIT = new Set(["hajime", "hazime", "", "everyone", "customer", "shop_clerk", "old_man"]);
// 立ち絵の枠（ステージ高さに対する本体の高さ・足元の沈み込み）
const FRAMING = { target: 1.36, sink: 0.4, pakkiTarget: 0.94, pakkiSink: 0.08 };

/** 章の台本側が差し込むフック（特定の会話の選択肢で状態を変える等） */
export const hooks = {
  onChoice: null,      // (dialogueId, choiceId, branchKey, nextId) => void
  interpolate: null,   // (text) => text（{daysLeft} など）
  evalCondition: null, // (line) => boolean | undefined（未知の条件タイプ）
  contextChar: null,   // 「【好感度】が上がった」の宛先（いま会っている相手）
};

const log = [];
let dom = null;
let running = null;     // 再生中の会話の状態
let autoMode = false;
let skipMode = false;
let autoFxGap = 0;

export const vnTest = { turbo: false, choose: null }; // テスト用: 瞬時表示＋自動送り・選択肢の方針

function buildDom() {
  const host = layers.vn;
  dom = {
    effect: el("div.vn-effect"),
    cg: el("div.vn-cg"),
    portraits: el("div.vn-portraits"),
    name: el("div.vn-name"),
    text: el("div.vn-text", { "aria-live": "polite" }),
    next: el("div.vn-next", { text: "▼" }),
    choices: el("div.vn-choices"),
    log: el("div.vn-log"),
    controls: el("div.vn-controls"),
  };
  dom.box = el("div.vn-box", [dom.name, dom.text, dom.next]);
  const ctl = (label, fn, test) => el("button.vn-ctl", { text: label, dataset: { test }, onclick: (e) => { e.stopPropagation(); fn(); } });
  dom.autoBtn = ctl("AUTO", () => setAuto(!autoMode), "vn-auto");
  dom.skipBtn = ctl("SKIP", () => setSkip(!skipMode), "vn-skip");
  dom.controls.append(dom.autoBtn, dom.skipBtn, ctl("LOG", openLog, "vn-log"), ctl("用語", openGlossary, "vn-glossary"));
  host.replaceChildren(dom.effect, dom.cg, dom.portraits, dom.box, dom.choices, dom.controls, dom.log);
  host.addEventListener("pointerup", (e) => {
    if (!running || e.target.closest(".vn-ctl, .vn-choices, .vn-log")) return;
    if (performance.now() < running.openLockUntil) return;
    if (autoMode || skipMode) { setAuto(false); setSkip(false); }
    advance();
  });
  window.addEventListener("keydown", (e) => {
    if (!running || !layers.vn.classList.contains("active")) return;
    if (layers.modal.classList.contains("show")) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advance(); }
    if (e.key === "Control") setSkip(true);
  });
  window.addEventListener("keyup", (e) => { if (e.key === "Control") setSkip(false); });
}

function setAuto(v) { autoMode = v; dom?.autoBtn.classList.toggle("on", v); if (v) kickAuto(); }
function setSkip(v) { skipMode = v; dom?.skipBtn.classList.toggle("on", v); if (v) kickAuto(); }

let autoTimer = 0;
function kickAuto() {
  clearTimeout(autoTimer);
  if (!running) return;
  const fast = vnTest.turbo || skipMode;
  if (!fast && !autoMode) return;
  if (running.waitingChoice) {
    if (vnTest.turbo) autoTimer = setTimeout(() => autoChoose(), 10);
    return;
  }
  const delay = vnTest.turbo ? 5 : skipMode ? 40 : running.typing ? 200 : 1200 + visibleLength(running.fullHtml || "") * 45;
  autoTimer = setTimeout(() => {
    if (!running) return;
    if (running.typing && !vnTest.turbo && !skipMode) return kickAuto();
    advance();
  }, delay);
}

// ---------------------------------------------------------------- 再生

/**
 * 会話を再生する。
 * @param idOrDlg dialogue_id か dialogue オブジェクト
 * @param opts.bg  背景の上書き（res:// パス可）
 */
export function play(idOrDlg, opts = {}) {
  if (!dom) buildDom();
  const dlg = typeof idOrDlg === "string" ? DB.dialogues[idOrDlg] : idOrDlg;
  if (!dlg) {
    console.warn("[vn] dialogue not found:", idOrDlg);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    running = {
      id: dlg.dialogue_id || "",
      dlg,
      queue: (dlg.lines || []).slice(),
      branches: dlg.branches || {},
      resolve,
      waitingChoice: false,
      typing: false,
      pages: null,
      pageIdx: 0,
      fullHtml: "",
      slots: {},
      speaker: "",
      openLockUntil: performance.now() + 320,
    };
    autoFxGap = 0;
    dom.portraits.replaceChildren();
    dom.choices.replaceChildren();
    dom.text.innerHTML = "";
    dom.name.textContent = "";
    dom.name.classList.remove("show");
    const meta = dlg.metadata || {};
    const bg = opts.bg || meta.bg;
    if (bg) sceneSetBg(bg);
    dom.effect.dataset.effect = meta.effect || "";
    layers.vn.classList.add("active");
    document.body.classList.add("in-vn");
    prefetch(dlg);
    next();
  });
}

/** 会話の背景（昼夜の差分・夜の色調補正つき） */
function sceneSetBg(ref) {
  const { url, tint } = sceneBg(ref, timeOfDay());
  if (url) setBg(url, { tint });
}

function prefetch(dlg) {
  const urls = new Set();
  const collect = (lines) => {
    for (const l of lines || []) {
      if (l.speaker && !NO_PORTRAIT.has(l.speaker)) {
        const p = portraitInfo(l.speaker, l.face);
        if (p) urls.add(p.src);
      }
      if (l.type === "show_cg") urls.add(cgUrl(l.cg_id));
    }
  };
  collect(dlg.lines);
  Object.values(dlg.branches || {}).forEach(collect);
  preload([...urls].slice(0, 16), 0);
}

function finish() {
  const r = running;
  running = null;
  clearTimeout(autoTimer);
  const meta = r.dlg.metadata || {};
  // metadata / growth_stats の報酬（会話の最後にまとめて付く）
  if (meta.add_stat) applyStats(meta.add_stat);
  if (meta.add_affinity) for (const [id, n] of Object.entries(meta.add_affinity)) gainAffinity(id, n * 6);
  if (r.dlg.growth_stats) applyStats(r.dlg.growth_stats);
  layers.vn.classList.remove("active");
  document.body.classList.remove("in-vn");
  dom.cg.classList.remove("show");
  dom.portraits.replaceChildren();
  dom.effect.dataset.effect = "";
  layers.vn.classList.remove("sepia");
  setSkip(false);
  r.resolve({ id: r.id });
}

function advance() {
  if (!running || running.waitingChoice) return;
  if (running.typing) return completeTyping();
  if (running.pages && running.pageIdx < running.pages.length - 1) {
    running.pageIdx++;
    renderPage();
    return;
  }
  SE.click();
  next();
}

function next() {
  const r = running;
  if (!r) return;
  r.pages = null;
  // 制御行はまとめて処理し、表示する台詞行に着いたら止まる
  for (;;) {
    const line = r.queue.shift();
    if (line === undefined) return finish();
    const type = line.type || "";
    if (!type) return showLine(line);
    if (type === "choice") return showChoices(line);
    if (type === "game_over") return finish();
    if (type === "condition") { handleCondition(line); continue; }
    if (type === "jump") { if (line.next_id) jumpTo(line.next_id); continue; }
    if (type === "set_flag") {
      state.flags[line.flag] = true;
      const m = /^_met_(.+)$/.exec(line.flag || "");
      if (m) markMet(m[1]);
      continue;
    }
    if (type === "show_cg") { showCg(line.cg_id); continue; }
    if (type === "hide_cg") { dom.cg.classList.remove("show"); continue; }
    if (type === "apply") { applyLine(line); continue; }
    if (type === "note") { onNote(line); continue; }
    if (type === "bg") { if (line.bg) sceneSetBg(line.bg); continue; }
    if (type === "sfx") { playSe(line.id); continue; }
    if (type === "fx") { runFx(line); continue; }
    if (type === "customer_note") { state.notes[line.note_id] = (state.notes[line.note_id] || 0) + 1; continue; }
    // 未知の行タイプは黙って飛ばす（データ先行で書けるように）
  }
}

function jumpTo(id) {
  const target = DB.dialogues[id];
  if (!target) return;
  running.queue = (target.lines || []).slice();
  running.branches = target.branches || {};
  if (target.metadata?.bg) sceneSetBg(target.metadata.bg);
}

function handleCondition(line) {
  const kind = line.condition_type || "stat";
  let ok;
  if (kind === "stat") {
    const key = STAT_EN[line.stat] || line.stat;
    ok = (state.stats[key] || 0) >= Number(line.threshold || 0);
  } else if (kind === "flag") {
    ok = !!state.flags[line.flag];
  } else if (kind === "customer_note") {
    ok = (state.notes[line.note_id] || 0) >= Number(line.threshold || 1);
  } else if (kind === "affinity") {
    ok = affinityLevel(line.char_id) >= Number(line.threshold || 0);
  } else {
    ok = hooks.evalCondition ? !!hooks.evalCondition(line) : false;
  }
  const key = String((ok ? line.next_true : line.next_false) || "");
  if (key && running.branches[key]) running.queue.unshift(...running.branches[key]);
  else if (key && DB.dialogues[key]) jumpTo(key);
}

function applyLine(line) {
  if (line.stats) applyStats(line.stats);
  if (line.money) addMoney(line.money);
  if (line.affinity) for (const [id, n] of Object.entries(line.affinity)) gainAffinity(id, n * 6);
}

function onNote(line) {
  state.flags[`_note_${line.note_id}`] = true;
  toast(`📝 メモした ──「${line.label || "話の要点"}」`, { kind: "good" });
}

function runFx(line) {
  const id = line.id;
  autoFxGap = 6;
  if (id === "shake") { shake(); SE.hit(); }
  else if (id === "flash" || id === "imp") flash(id === "imp" ? "gold" : "white");
  else if (id === "cutin") { flash("gold"); SE.just(); }
  else if (id === "sepia") layers.vn.classList.add("sepia");
  else if (id === "sepia_off") layers.vn.classList.remove("sepia");
  else if (id === "scent") scent(line.color || "#e8c27a", line.color2 || line.color || "#b8743a");
}

function scent(c1, c2) {
  const puff = el("div.vn-scent", { style: { "--c1": c1, "--c2": c2 } });
  layers.vn.append(puff);
  setTimeout(() => puff.remove(), 4200);
}

function showCg(id) {
  const url = cgUrl(id);
  if (!url) return; // 素材待ちのCGは黙って飛ばす
  dom.cg.style.backgroundImage = `url("${url}")`;
  dom.cg.classList.add("show");
}

// ---------------------------------------------------------------- 台詞行

function showLine(line) {
  const r = running;
  const speaker = String(line.speaker || "");
  const face = String(line.face || "");
  r.speaker = speaker;
  if (speaker) {
    dom.name.textContent = displayName(speaker, state);
    dom.name.classList.add("show");
  } else {
    dom.name.classList.remove("show");
  }
  dom.box.classList.toggle("narration", !speaker);
  dom.box.classList.toggle("thought", speaker === "hajime" && /^（/.test(line.text || ""));
  updatePortraits(speaker, face);
  // 行付き演出（"fx":"shake" 等）／自動の軽演出（驚き・叫び）
  if (line.fx) runFx({ id: line.fx });
  else autoFx(line);
  let text = String(line.text || "");
  if (hooks.interpolate) text = hooks.interpolate(text);
  const cue = parseCue(text);
  dom.box.classList.toggle("reward", !!cue);
  if (cue) applyCue(cue);
  log.push({ name: speaker ? displayName(speaker, state) : "", text: stripTags(text) });
  if (log.length > 300) log.shift();
  r.pages = paginate(text);
  r.pageIdx = 0;
  renderPage();
}

// 報酬キュー: 「……【技術】と【センス】が少し上がった。」の規定フレーズを読んで加算する
// （1〜2=少し／3〜4=無印／5〜7=かなり／8〜=大きく）。台詞側の書式は CLAUDE.md が正本
const CUE_AMOUNT = [["大きく上がった", 8], ["かなり上がった", 6], ["少し上がった", 2], ["上がった", 3]];
const CUE_STAT = { 技術: "technique", センス: "sense", 根性: "guts", 魅力: "charm", 洞察: "insight" };
function parseCue(text) {
  if (!text.startsWith("……") || !text.includes("上がった")) return null;
  const gains = {};
  for (const clause of text.slice(2).split("。")) {
    const names = [...clause.matchAll(/【(技術|センス|根性|魅力|洞察|好感度)】/g)].map((m) => m[1]);
    const amt = (CUE_AMOUNT.find(([w]) => clause.includes(w)) || [null, 0])[1];
    for (const n of names) if (amt) gains[n] = (gains[n] || 0) + amt;
  }
  return Object.keys(gains).length ? gains : null;
}
function applyCue(gains) {
  for (const [ja, amt] of Object.entries(gains)) {
    if (CUE_STAT[ja]) applyStats({ [CUE_STAT[ja]]: amt });
    else if (ja === "好感度" && hooks.contextChar) gainAffinity(hooks.contextChar, amt * 3);
  }
}

function autoFx(line) {
  if (autoFxGap > 0) { autoFxGap--; return; }
  const t = String(line.text || "");
  let id = null;
  if (/[！!][！!]|[！!][？?]|[？?][！!]/.test(t)) id = "shake-soft";
  else if (line.face === "surprise" || /[…—][！!]/.test(t)) id = "imp";
  if (!id) return;
  autoFxGap = 6;
  if (id === "imp") flash("gold");
  else shake(document.getElementById("stage"), 300);
}

function renderPage() {
  const r = running;
  const raw = r.pages[r.pageIdx];
  r.fullHtml = formatHtml(raw);
  const total = visibleLength(r.fullHtml);
  clearInterval(r.typeTimer);
  dom.next.classList.remove("show");
  const speed = vnTest.turbo ? 4 : config.textSpeed;
  if (speed >= 4 || skipMode) {
    r.typing = false;
    dom.text.innerHTML = r.fullHtml;
    dom.next.classList.add("show");
    kickAuto();
    return;
  }
  // 重要行（[imp]）は一拍の「溜め」を置いてから出す
  const hold = raw.includes("[imp]") && r.pageIdx === 0 ? 380 : 0;
  r.typing = true;
  dom.text.innerHTML = "";
  let shown = 0;
  const interval = { 1: 46, 2: 26, 3: 12 }[speed] || 26;
  const step = Math.max(1, Math.round(total / 90));
  const start = () => {
    r.typeTimer = setInterval(() => {
      shown += step;
      dom.text.innerHTML = sliceHtml(r.fullHtml, shown);
      if (shown % 3 < step) SE.blip(r.speaker);
      if (shown >= total) completeTyping();
    }, interval);
  };
  if (hold) r.typeTimer = setTimeout(start, hold);
  else start();
  kickAuto();
}

function completeTyping() {
  const r = running;
  if (!r) return;
  clearInterval(r.typeTimer);
  clearTimeout(r.typeTimer);
  r.typing = false;
  dom.text.innerHTML = r.fullHtml;
  dom.next.classList.add("show");
  kickAuto();
}

// ---------------------------------------------------------------- 立ち絵

function updatePortraits(speaker, face) {
  const r = running;
  const info = speaker && !NO_PORTRAIT.has(speaker) ? portraitInfo(speaker, face) : null;
  if (info) {
    let img = dom.portraits.querySelector(`img[data-speaker="${speaker}"]`);
    if (!img) {
      const used = Object.values(r.slots);
      let slot = [0, 1].find((s) => !used.includes(s));
      if (slot === undefined) {
        const oldest = Object.keys(r.slots)[0];
        slot = r.slots[oldest];
        delete r.slots[oldest];
        dom.portraits.querySelector(`img[data-speaker="${oldest}"]`)?.remove();
      }
      r.slots[speaker] = slot;
      img = el("img.portrait.enter", { alt: "", dataset: { speaker, slot: String(slot) }, draggable: "false" });
      img.onerror = () => { img.remove(); delete r.slots[speaker]; layoutPortraits(); };
      dom.portraits.append(img);
      requestAnimationFrame(() => requestAnimationFrame(() => img.classList.remove("enter")));
    }
    if (img.getAttribute("src") !== info.src) img.src = info.src;
    frame(img, info);
  }
  for (const img of dom.portraits.querySelectorAll("img")) img.classList.toggle("active", img.dataset.speaker === speaker);
  layoutPortraits();
}

/** 透過余白の差を補正し、本体の高さ・足元位置をキャラ間でそろえる */
function frame(img, p) {
  const pakki = p.folder === "pakki";
  const target = (pakki ? FRAMING.pakkiTarget : FRAMING.target) * p.scale;
  const sink = pakki ? FRAMING.pakkiSink : FRAMING.sink;
  const hPct = Math.min(target / p.h, 2.4) * 100;             // 画像の高さ（ステージ高さ比 %）
  const contentTop = p.h * hPct - sink * 100;                // 本体上端（下からの %）
  const extra = Math.max(0, contentTop - 97);                // 頭が見切れないように沈める
  img.style.height = `${hPct}%`;
  img.style.bottom = `${-(p.b * hPct + sink * 100 + extra)}%`;
  img.style.setProperty("--ax", `${-(p.ax * 100)}%`);
}

function layoutPortraits() {
  const imgs = [...dom.portraits.querySelectorAll("img")];
  dom.portraits.dataset.count = String(imgs.length);
  for (const img of imgs) {
    const pos = imgs.length <= 1 ? "center" : img.dataset.slot === "0" ? "left" : "right";
    img.dataset.pos = pos;
  }
}

// ---------------------------------------------------------------- 選択肢

function showChoices(line) {
  const r = running;
  r.waitingChoice = true;
  dom.choices.replaceChildren();
  (line.choices || []).forEach((c, i) => {
    const b = el("button.vn-choice", {
      html: formatHtml(c.text || "……"),
      style: { animationDelay: `${i * 80}ms` },
      dataset: { test: `choice-${i}` },
      onclick: (e) => { e.stopPropagation(); pickChoice(line, c); },
    });
    dom.choices.append(b);
  });
  dom.choices.classList.add("show");
  kickAuto();
}

function autoChoose() {
  const r = running;
  if (!r || !r.waitingChoice) return;
  const btns = [...dom.choices.querySelectorAll(".vn-choice")];
  const idx = vnTest.choose ? vnTest.choose(r.id, btns.map((b) => b.textContent)) : 0;
  btns[Math.max(0, Math.min(btns.length - 1, idx | 0))]?.click();
}

function pickChoice(line, c) {
  const r = running;
  SE.select();
  r.waitingChoice = false;
  dom.choices.classList.remove("show");
  dom.choices.replaceChildren();
  const key = String(c.next || "");
  if (key && r.branches[key]) r.queue.unshift(...r.branches[key]);
  else if (c.next_id) jumpTo(String(c.next_id));
  log.push({ name: "▶", text: stripTags(c.text || "") });
  if (hooks.onChoice) hooks.onChoice(r.id, String(line.id || ""), key, String(c.next_id || ""));
  next();
}

// ---------------------------------------------------------------- ログ・用語

function openLog() {
  SE.select();
  const list = el("div.log-list", log.slice(-120).map((l) => el("div.log-row", [
    l.name ? el("b", { text: l.name }) : null,
    el("span", { text: l.text }),
  ])));
  dom.log.replaceChildren(
    el("div.log-head", [el("span", { text: "LOG" }), el("button.btn.small", { text: "閉じる", onclick: (e) => { e.stopPropagation(); dom.log.classList.remove("show"); } })]),
    list,
  );
  dom.log.classList.add("show");
  requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
}

async function openGlossary() {
  SE.select();
  await modal({ title: "用語集", body: glossaryPanel(), options: [{ label: "閉じる", value: true, primary: true }], className: "glossary-modal" });
}

export const isPlaying = () => !!running;
export const backlog = () => log;
