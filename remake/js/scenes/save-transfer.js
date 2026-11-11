// セーブの書き出し／読み込みと、全画面・ホーム画面追加の案内（#2856）。
// iOS のホーム画面アプリは Safari と保存領域が別なので、セーブを文字列／ファイルで持ち運べるようにする。
// 形式は変えない: 各セーブ枠の保存内容（localStorage の文字列）をそのまま包むだけ。
import { el } from "../core/util.js";
import { layers, toast } from "../core/ui.js";
import { SAVE_SLOTS, readSlot, isLoadableSave } from "../core/state.js";
import { exportTransferProgress, parseTransferProgress, mergedTransferProgress } from "../core/transfer-progress.js";

const PREFIX = "SUIEN-SAVE2:";
const LEGACY_PREFIX = "SUIEN-SAVE1:";
const FORMAT = "suien-save";
const FILE_NAME = "suien-save.txt";
// 旧版の引っ越し文字列に含まれる枠。端末内のデータは消さず、取り込み対象からだけ外す。
const RETIRED_SLOTS = new Set(["suien_remake_slot2", "suien_remake_slot3"]);


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
  return PREFIX + toBase64(JSON.stringify({ format: FORMAT, version: 2, exportedAt: Date.now(), slots, progress: exportTransferProgress() }));
}

/** 書き出し文字列を検証し、書き込む枠を返す。壊れていれば null（何も書かない） */
export function parseSaveText(text) {
  try {
    const t = String(text || "").replace(/\s+/g, "");
    const prefix = t.startsWith(PREFIX) ? PREFIX : t.startsWith(LEGACY_PREFIX) ? LEGACY_PREFIX : null;
    if (!prefix) return null;
    const pack = JSON.parse(fromBase64(t.slice(prefix.length)));
    if (!pack || pack.format !== FORMAT || pack.version !== (prefix === PREFIX ? 2 : 1)
      || !pack.slots || typeof pack.slots !== "object" || Array.isArray(pack.slots)) return null;
    const known = new Set(SAVE_SLOTS.map((s) => s.key));
    const slots = [];
    for (const [key, raw] of Object.entries(pack.slots)) {
      if ((!known.has(key) && !RETIRED_SLOTS.has(key)) || typeof raw !== "string") return null;
      if (RETIRED_SLOTS.has(key)) continue;
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object" || !s.day || !isLoadableSave(s)) return null;
      slots.push({ key, raw, s });
    }
    if (pack.version === 2) slots.progress = parseTransferProgress(pack.progress);
    return slots.length ? slots : null;
  } catch { return null; }
}

/** 検証済みの枠を書き込む。途中で失敗したら元に戻す。成功なら true */
export function applySlots(slots) {
  let writes, before;
  try {
    writes = [...slots, ...mergedTransferProgress(slots.progress || {})];
    before = writes.map(({ key }) => [key, localStorage.getItem(key)]);
  } catch { return false; } // 読取り・統合・退避の失敗では書込みを始めない。
  const written = [];
  try {
    for (const { key, raw } of writes) { localStorage.setItem(key, raw); written.push(key); }
    return true;
  } catch {
    const originals = new Map(before);
    for (const key of written.reverse()) {
      const old = originals.get(key);
      try { if (old === null) localStorage.removeItem(key); else localStorage.setItem(key, old); } catch { /* 復元も失敗した場合、成功とは表示しない */ }
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
  let text;
  try { text = exportSaveText(); } catch { toast("記録を読み取れないため、書き出せませんでした"); return; }
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
    body: el("div.xfer-body", [area, el("p", { text: "セーブ枠・既見CG・写真・ルート記録・周回解放を含みます。設定と本文の既読は含みません。" })]),
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
  const slots = parseSaveText(text);
  if (!slots) { await modal({ title: "読み込めません", body: "セーブの文字列が壊れているか、この形式ではありません。今のセーブはそのままです。", options: [{ label: "閉じる", value: true, primary: true, test: "import-error-ok" }] }); return; }
  const names = slots.map(({ key, s }) => `${SAVE_SLOTS.find((x) => x.key === key).label}：${s.day}日目`).join("\n");
  const ok = await modal({ title: "読み込みの確認", className: "xfer-modal",
    body: el("div.xfer-help", [el("p", { text: "今のセーブを次の内容で上書きします。" }), el("pre.xfer-slots", { text: names }), el("p", { text: slots.progress ? "CG・写真・ルート・到達履歴は今の記録と統合します。周回解放は保持し、最高周回・通算値は大きい方、引き継ぎパッケージは新しい日時の方を残します（同時刻・日時不明は今の方）。通算値は合算しません。設定と本文の既読は変えません。" : "旧形式のため累積記録は含まれていません。今のCG・ルート・周回記録は変えません。" })]),
    options: [{ label: "上書きして読み込む", value: true, primary: true, test: "import-confirm" }, { label: "やめる", value: false, test: "import-abort" }] });
  if (!ok) return;
  if (!applySlots(slots)) { toast("保存できませんでした。セーブと累積記録の保存状態を確認してください"); return; }
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

