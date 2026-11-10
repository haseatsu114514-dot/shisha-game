// セーブの書き出し／読み込みと、全画面・ホーム画面追加の案内（#2856）。
// iOS のホーム画面アプリは Safari と保存領域が別なので、セーブを文字列／ファイルで持ち運べるようにする。
// 形式は変えない: 各セーブ枠の保存内容（localStorage の文字列）をそのまま包むだけ。
import { el } from "../core/util.js";
import { layers, toast } from "../core/ui.js";
import { SAVE_SLOTS, readSlot, isLoadableSave } from "../core/state.js";
import { GALLERY_PROGRESS_KEY, normalizeGalleryProgress, purikuraId } from "../core/gallery-progress.js";
import { CYCLE_META_KEY, CYCLE_META_VERSION, normalizeCycleMeta } from "../core/cycle-meta.js";

const PREFIX = "SUIEN-SAVE1:";
const FORMAT = "suien-save";
const FILE_NAME = "suien-save.txt";
const GALLERY_KEY = "suien_remake_gallery";
const PROGRESS_KEYS = [GALLERY_KEY, GALLERY_PROGRESS_KEY, CYCLE_META_KEY];

const union = (a, b) => [...new Set([...a, ...b])];
const cgIds = value => [...new Set((Array.isArray(value) ? value : []).filter(id => typeof id === "string"))];
const object = value => value && typeof value === "object" && !Array.isArray(value);

function mergeGalleryProgress(a, b) {
  const left = normalizeGalleryProgress(a), right = normalizeGalleryProgress(b);
  const photos = new Map(left.purikura.map(p => [purikuraId(p), p]));
  for (const photo of right.purikura) {
    const old = photos.get(purikuraId(photo));
    photos.set(purikuraId(photo), { ...old, ...photo,
      ...(old?.chapterDay && !photo.chapterDay ? { chapterDay: old.chapterDay } : {}) });
  }
  const routeRecords = { ...left.routeRecords };
  for (const [id, record] of Object.entries(right.routeRecords)) {
    const old = routeRecords[id];
    routeRecords[id] = old ? {
      becameLover: old.becameLover || record.becameLover,
      eventsSeen: union(old.eventsSeen, record.eventsSeen),
      trueEndAsLover: old.trueEndAsLover || record.trueEndAsLover,
    } : record;
  }
  return {
    completeAnnounced: left.completeAnnounced || right.completeAnnounced,
    clearedChapters: union(left.clearedChapters, right.clearedChapters).sort(),
    keepsakes: union(left.keepsakes, right.keepsakes),
    purikura: [...photos.values()], routeRecords,
  };
}

function mergeCycleMeta(a, b) {
  const left = normalizeCycleMeta(a), right = normalizeCycleMeta(b);
  const trueEnds = new Map(left.trueEnds.map(e => [e.cycleId, e]));
  for (const entry of right.trueEnds) {
    const old = trueEnds.get(entry.cycleId);
    trueEnds.set(entry.cycleId, old ? {
      ...old, cycle: Math.max(old.cycle, entry.cycle),
      at: old.at || entry.at,
      loversAtEnd: union(old.loversAtEnd, entry.loversAtEnd),
    } : entry);
  }
  const carryPackage = !left.carryPackage ? right.carryPackage : !right.carryPackage ? left.carryPackage
    : (right.carryPackage.at || "") > (left.carryPackage.at || "") ? right.carryPackage : left.carryPackage;
  return {
    version: CYCLE_META_VERSION,
    unlocked: left.unlocked || right.unlocked,
    trueEnds: [...trueEnds.values()],
    highestCycleStarted: Math.max(left.highestCycleStarted, right.highestCycleStarted),
    carryPackage,
    // 同じ周回が両側に含まれ得るため加算せず、記録済みの大きい値を残す。
    lifetime: {
      tournamentWins: Math.max(left.lifetime.tournamentWins, right.lifetime.tournamentWins),
      tournamentAttempts: Math.max(left.lifetime.tournamentAttempts, right.lifetime.tournamentAttempts),
    },
  };
}

function readProgress(raw, key) {
  const value = JSON.parse(raw);
  if (key === GALLERY_KEY) {
    if (!Array.isArray(value)) throw new Error("Invalid gallery");
    return cgIds(value);
  }
  if (!object(value) || key === CYCLE_META_KEY && value.version !== CYCLE_META_VERSION) {
    throw new Error("Invalid progress");
  }
  return key === GALLERY_PROGRESS_KEY ? normalizeGalleryProgress(value) : normalizeCycleMeta(value);
}

function mergedProgress(key, source, destination) {
  if (key === GALLERY_KEY) return union(cgIds(destination), source);
  if (key === GALLERY_PROGRESS_KEY) return mergeGalleryProgress(destination, source);
  return mergeCycleMeta(destination, source);
}


// ---------------------------------------------------------------- 重ねて開く小窓
// 設定画面の上に重ねる。modal() は下の設定画面ごと消してしまうので、ここだけ重ねて閉じる。

/** options: { label, value, primary?, test?, keep?: () => void }。keep は閉じずに動かす */
function modal({ title, body, options, className = "" }) {
  return new Promise((resolve) => {
    const box = el(`div.modal-box.xfer-box${className ? "." + className : ""}`, { role: "dialog", "aria-modal": "true" }, [
      el("h3", { text: title }),
      el("div.modal-body", typeof body === "string" ? { text: body } : {}, typeof body === "string" ? [] : [body]),
      el("div.modal-actions", options.map((o) => el(`button.btn${o.primary ? ".primary" : ""}`, {
        type: "button", text: o.label, dataset: { test: o.test || "" },
        onclick: () => { if (o.keep) { o.keep(); return; } close(o.value); },
      }))),
    ]);
    const layer = el("div.xfer-layer", [el("div.modal-backdrop"), box]);
    const buttons = [...box.querySelectorAll(".modal-actions button")];
    const dismiss = [...buttons].reverse().find((b) => !b.classList.contains("primary")) || buttons[0];
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault(); e.stopImmediatePropagation(); dismiss?.click();
    };
    const close = (value) => { window.removeEventListener("keydown", onKey, true); layer.remove(); resolve(value); };
    window.addEventListener("keydown", onKey, true);
    layers.modal.append(layer);
    (box.querySelector("textarea") || buttons.find((b) => b.classList.contains("primary")) || buttons[0])?.focus({ preventScroll: true });
  });
}

// ---------------------------------------------------------------- 書き出し／読み込みの中身

const toBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = (b64) => new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

/** 読めるセーブ枠を、保存されている文字列のまま包んだ書き出し文字列。無ければ null */
export function exportSaveText() {
  const slots = {};
  for (const { key } of SAVE_SLOTS) {
    if (!readSlot(key)) continue;
    try { slots[key] = localStorage.getItem(key); } catch { /* 読めない枠は含めない */ }
  }
  if (!Object.keys(slots).length) return null;
  const progress = {};
  try {
    for (const key of PROGRESS_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) progress[key] = readProgress(raw, key);
    }
  } catch { return null; }
  return PREFIX + toBase64(JSON.stringify({ format: FORMAT, version: 1, exportedAt: Date.now(), slots, progress }));
}

/** 書き出し文字列を検証し、書き込む枠を返す。壊れていれば null（何も書かない） */
export function parseSaveText(text) {
  try {
    const t = String(text || "").replace(/\s+/g, "");
    if (!t.startsWith(PREFIX)) return null;
    const pack = JSON.parse(fromBase64(t.slice(PREFIX.length)));
    if (!pack || pack.format !== FORMAT || pack.version !== 1 || !pack.slots || typeof pack.slots !== "object") return null;
    const known = new Set(SAVE_SLOTS.map((s) => s.key));
    const slots = [];
    for (const [key, raw] of Object.entries(pack.slots)) {
      if (!known.has(key) || typeof raw !== "string") return null;
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object" || !s.day || !isLoadableSave(s)) return null;
      slots.push({ key, raw, s });
    }
    if (pack.progress !== undefined && !object(pack.progress)) return null;
    const progress = {};
    for (const [key, value] of Object.entries(pack.progress || {})) {
      if (!PROGRESS_KEYS.includes(key)) return null;
      progress[key] = readProgress(JSON.stringify(value), key);
    }
    return slots.length ? { slots, progress } : null;
  } catch { return null; }
}

/** 検証済みの枠を書き込む。途中で失敗したら元に戻す。成功なら true */
export function applySlots({ slots, progress = {} }) {
  const keys = [...new Set([...slots.map(({ key }) => key), ...Object.keys(progress)])];
  const before = [];
  try {
    for (const key of keys) before.push([key, localStorage.getItem(key)]);
    const merged = Object.fromEntries(Object.entries(progress).map(([key, source]) => {
      const old = localStorage.getItem(key);
      return [key, JSON.stringify(mergedProgress(key, source, old === null ? null : readProgress(old, key)))];
    }));
    for (const { key, raw } of slots) localStorage.setItem(key, raw);
    for (const [key, raw] of Object.entries(merged)) localStorage.setItem(key, raw);
    return true;
  } catch {
    for (const [key, old] of before) {
      try { if (old === null) localStorage.removeItem(key); else localStorage.setItem(key, old); } catch { /* noop */ }
    }
    return false;
  }
}

// ---------------------------------------------------------------- 全画面／ホーム画面追加

const ua = () => navigator.userAgent || "";
/** iPhone / iPod（iPad は Fullscreen API が使えるので除く） */
export const isIPhone = () => /iPhone|iPod/.test(ua());
export const isStandalone = () => navigator.standalone === true || matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
export const canFullscreen = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) && !isIPhone();
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

/** 全画面にして横向き固定を試みる。失敗は無視する */
export async function enterFullscreen() {
  const root = document.documentElement;
  try { await (root.requestFullscreen || root.webkitRequestFullscreen).call(root); } catch { /* 拒否されても遊べる */ }
  try { await screen.orientation?.lock?.("landscape"); } catch { /* 非対応は無視 */ }
}

/** 全画面を解除する。失敗は無視する */
export async function exitFullscreen() {
  try { await (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); } catch { /* 既に解除済みでも遊べる */ }
}

/** 全画面でなければ入り、全画面なら解除する（#3013: 同じボタンで化／解除の両方） */
export const toggleFullscreen = () => (isFullscreen() ? exitFullscreen() : enterFullscreen());

/** 全画面のボタンを出す場面か。iPhone でホーム画面版を開いているとき・非対応のときは出さない。
 *  全画面中は display-mode が fullscreen に寄って standalone 判定に触れても、解除ボタンは出し続ける */
export const fullscreenEntry = () =>
  isFullscreen() ? "fullscreen" : isStandalone() ? null : canFullscreen() ? "fullscreen" : isIPhone() ? "a2hs" : null;

const HOME_HELP = [
  "ホーム画面に追加すると全画面で遊べます。",
  "Safari の共有ボタン →「ホーム画面に追加」。",
  "Safari のまま遊ぶなら「ぁあ」メニュー →「ツールバーを非表示」（iOS 15 以降）。",
  "iOS の設定 → Safari →「横向きのタブバー」をオフにするとバーが細くなります。",
  "ホーム画面版は Safari と保存場所が別なので、先にここで「書き出し」してから、ホーム画面版で「読み込み」してください。",
];

/** 全画面ボタン（対応端末）／ホーム画面追加の案内ボタン（iPhone）。出さない場面は null */
export function fullscreenButton() {
  const kind = fullscreenEntry();
  if (!kind) return null;
  if (kind === "fullscreen") {
    const btn = el("button.btn.small.xfer-btn", { type: "button", text: isFullscreen() ? "全画面を解除" : "全画面", dataset: { test: "fullscreen" },
      onclick: async () => { await toggleFullscreen(); sync(); } });
    // Esc 等でボタン以外から全画面が切り替わっても、表示名を実状態へ追随させる
    const sync = () => { btn.textContent = isFullscreen() ? "全画面を解除" : "全画面"; };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return btn;
  }
  return el("button.btn.small.xfer-btn", { type: "button", text: "全画面で遊ぶには", dataset: { test: "a2hs-help" },
    onclick: () => modal({ title: "全画面で遊ぶには", className: "xfer-modal",
      body: el("div.xfer-help", { dataset: { test: "a2hs-notice" } }, HOME_HELP.map((t) => el("p", { text: t }))),
      options: [{ label: "閉じる", value: true, primary: true }] }) });
}

// ---------------------------------------------------------------- 画面

const copyText = async (text, area) => {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* 下の選択コピーへ */ }
  try { area.focus(); area.select(); return document.execCommand("copy"); } catch { return false; }
};

async function openExport() {
  const text = exportSaveText();
  if (!text) { toast("書き出せるセーブがありません"); return; }
  const area = el("textarea.xfer-text", { readonly: true, rows: 4, dataset: { test: "export-text" } });
  area.value = text;
  area.addEventListener("focus", () => area.select());
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = el("a", { href: url, download: FILE_NAME });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  await modal({ title: "セーブの書き出し",
    body: el("div.xfer-body", [area]),
    options: [
      { label: "文字列をコピー", test: "export-copy", keep: async () => { toast(await copyText(text, area) ? "コピーしました" : "コピーできません。文字列を長押しで選んでください"); } },
      { label: "ファイル保存", test: "export-file", keep: download },
      { label: "閉じる", value: false, primary: true, test: "export-close" },
    ] });
}

async function openImport() {
  const area = el("textarea.xfer-text", { rows: 4, placeholder: "書き出した文字列を貼り付け", dataset: { test: "import-text" } });
  const file = el("input", { type: "file", accept: ".txt,text/plain", hidden: true, dataset: { test: "import-file" } });
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (f) { try { area.value = await f.text(); } catch { toast("ファイルを読めません"); } }
  });
  const choice = await modal({ title: "セーブの読み込み",
    body: el("div.xfer-body", [area, file]),
    options: [
      { label: "ファイルを選ぶ", test: "import-pick", keep: () => file.click() },
      { label: "読み込む", value: "go", primary: true, test: "import-go" },
      { label: "やめる", value: false, test: "import-cancel" },
    ] });
  if (choice === "go") return openImportWith(area.value);
}

async function openImportWith(text) {
  const pack = parseSaveText(text);
  if (!pack) { await modal({ title: "読み込めません", body: "セーブの文字列が壊れているか、この形式ではありません。今のセーブはそのままです。", options: [{ label: "閉じる", value: true, primary: true, test: "import-error-ok" }] }); return; }
  const names = pack.slots.map(({ key, s }) => `${SAVE_SLOTS.find((x) => x.key === key).label}：${s.day}日目`).join("\n");
  const ok = await modal({ title: "読み込みの確認", className: "xfer-modal",
    body: el("div.xfer-help", [el("p", { text: "同じ枠のセーブは上書きし、ギャラリーと周回記録は今の記録と統合します。" }), el("pre.xfer-slots", { text: names })]),
    options: [{ label: "上書きして読み込む", value: true, primary: true, test: "import-confirm" }, { label: "やめる", value: false, test: "import-abort" }] });
  if (!ok) return;
  if (!applySlots(pack)) { toast("保存できませんでした。今のセーブはそのままです"); return; }
  toast("読み込みました。最初から読み直します");
  setTimeout(() => location.reload(), 600);
}

/** 設定画面に置く「セーブの引っ越し」行。説明は「？」を開いたときだけ出す */
export function saveTransferRow() {
  const help = () => modal({ title: "セーブの引っ越し", className: "xfer-modal",
    body: el("div.xfer-help", HOME_HELP.slice(-1).concat(["書き出した文字列かファイルは、別の端末・ブラウザの「読み込み」で使えます。"]).map((t) => el("p", { text: t }))),
    options: [{ label: "閉じる", value: true, primary: true }] });
  return el("div.cfg-row.xfer-row", { dataset: { test: "save-transfer" } }, [
    el("span", { text: "セーブの引っ越し" }),
    el("span.xfer-btns", [
      el("button.btn.small.xfer-btn", { type: "button", text: "書き出し", dataset: { test: "save-export" }, onclick: () => { openExport(); } }),
      el("button.btn.small.xfer-btn", { type: "button", text: "読み込み", dataset: { test: "save-import" }, onclick: () => { openImport(); } }),
      el("button.btn.small.xfer-btn.xfer-q", { type: "button", text: "？", "aria-label": "セーブの引っ越しの説明", dataset: { test: "save-transfer-help" }, onclick: help }),
    ]),
  ]);
}
