// セーブの書き出し／読み込みと、全画面・ホーム画面追加の案内（#2856）。
// iOS のホーム画面アプリは Safari と保存領域が別なので、セーブを文字列／ファイルで持ち運べるようにする。
// 各セーブ枠の生データは変えず、持ち出し用の外装で累積記録と一緒に包む。
import { el } from "../core/util.js";
import { layers, toast } from "../core/ui.js";
import { SAVE_SLOTS, readSlot, isLoadableSave } from "../core/state.js";
import { exportTransferProgress, parseTransferProgress, mergedTransferProgress } from "../core/transfer-progress.js";

const PREFIX = "SUIEN-SAVE2:";
const LEGACY_PREFIX = "SUIEN-SAVE1:";
const FORMAT = "suien-save";
// localStorage に入る記録を UTF-8 / Base64 にしても余裕がある上限。巨大な別ファイルを展開しない。
const MAX_TRANSFER_SIZE = 32 * 1024 * 1024;
// 旧版の引っ越し文字列に含まれる枠。端末内のデータは消さず、取り込み対象からだけ外す。
const RETIRED_SLOTS = new Set(["suien_remake_slot2", "suien_remake_slot3"]);


// ---------------------------------------------------------------- 重ねて開く小窓
// 設定画面の上に重ねる。modal() は下の設定画面ごと消してしまうので、ここだけ重ねて閉じる。

/** options: { label, value, primary?, test?, keep?: () => void }。keep は閉じずに動かす */
function modal({ title, body, options, className = "", focusTest }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    // 設定の上でも通常のモーダルと同じ絶対位置で中央に置き、案内と操作を横画面内に収める。
    const box = el(`div.modal-box.xfer-box${className ? "." + className : ""}`, {
      role: "dialog", "aria-modal": "true", "aria-label": title,
      style: { position: "absolute", width: "min(92%, 800px)", maxWidth: "none" },
    }, [
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
    const close = (value) => {
      window.removeEventListener("keydown", onKey, true);
      layer.remove();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      resolve(value);
    };
    window.addEventListener("keydown", onKey, true);
    layers.modal.append(layer);
    const initial = buttons.find(b => b.dataset.test === focusTest)
      || box.querySelector("textarea:not([readonly])") || buttons.find(b => b.classList.contains("primary")) || buttons[0];
    initial?.focus({ preventScroll: true });
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

function readTransferSlot(raw) {
  try {
    const s = JSON.parse(raw);
    return Number.isSafeInteger(s?.day) && s.day >= 1 && isLoadableSave(s) ? s : null;
  } catch { return null; }
}

/** 読める枠の生データを包む。未来版・破損した枠があっても、他の枠は退避できる。 */
function exportSnapshot(exportedAt = Date.now()) {
  const slots = {};
  const skipped = [];
  for (const { key, label } of SAVE_SLOTS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    if (readTransferSlot(raw)) slots[key] = raw;
    else skipped.push(label);
  }
  if (!Object.keys(slots).length) return { text: null, skipped };
  const text = PREFIX + toBase64(JSON.stringify({ format: FORMAT, version: 2, exportedAt, slots, progress: exportTransferProgress() }));
  return { text, skipped };
}

/** 読めるセーブ枠の書き出し文字列。無ければ null */
export const exportSaveText = () => exportSnapshot().text;

/** 書き出し文字列を検証し、書き込む枠を返す。壊れていれば null（何も書かない） */
export function parseSaveText(text) {
  try {
    if (typeof text !== "string" || text.length > MAX_TRANSFER_SIZE) return null;
    const t = text.replace(/\s+/g, "");
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
      const s = readTransferSlot(raw);
      if (!s) return null;
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

const transferTextArea = (attrs) => el("textarea.xfer-text", {
  // 紙テーマでは明るい入力面に濃い文字。他テーマでは設定済みの入力面・文字色を使う。
  style: {
    background: "var(--inner-face, var(--ink-2))",
    borderColor: "var(--inner-edge, var(--panel-edge))",
    ...(attrs.readonly ? { minHeight: "0", height: "88px" } : {}),
  },
  ...attrs,
});

async function openExport() {
  const now = new Date();
  let snapshot;
  try { snapshot = exportSnapshot(now.getTime()); } catch { toast("記録を読み取れないため、書き出せませんでした"); return; }
  const { text, skipped } = snapshot;
  if (!text) {
    toast(skipped.length ? "今のバージョンで読み取れるセーブがありません" : "書き出せるセーブがありません");
    return;
  }
  const area = transferTextArea({ readonly: true, rows: 2, "aria-label": "バックアップの文字列", dataset: { test: "export-text" } });
  area.value = text;
  area.addEventListener("focus", () => area.select());
  const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = el("a", { href: url, download: `suien-save-${stamp}Z.txt` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  await modal({ title: "セーブの書き出し",
    body: el("div.xfer-help", [
      el("p", { text: "機種変更やサイトデータの削除に備えて、ファイルを保管してください。" }),
      skipped.length ? el("p", { text: `読み取れなかった枠は含みません：${skipped.join("、")}` }) : null,
      area,
      el("p", { text: "セーブ枠・既見CG・写真・ルート記録・周回解放を保存します。設定と本文の既読は含みません。" }),
    ]),
    options: [
      { label: "ファイルを保存", test: "export-file", primary: true, keep: download },
      { label: "文字列をコピー", test: "export-copy", keep: async () => { toast(await copyText(text, area) ? "コピーしました" : "コピーできません。文字列を長押しで選んでください"); } },
      { label: "閉じる", value: false, test: "export-close" },
    ] });
}

async function openImport() {
  const area = transferTextArea({ rows: 3, placeholder: "書き出した文字列を貼り付け", "aria-label": "読み込むセーブの文字列", dataset: { test: "import-text" } });
  const file = el("input", { type: "file", accept: ".txt,text/plain", hidden: true, dataset: { test: "import-file" } });
  const status = el("p", { role: "status", dataset: { test: "import-file-status" } });
  let reading = false, revision = 0;
  const syncButton = () => {
    const button = area.closest(".xfer-box")?.querySelector('[data-test="import-go"]');
    if (button) button.disabled = reading || !area.value.trim();
  };
  area.addEventListener("input", () => { status.textContent = ""; syncButton(); });
  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    file.value = ""; // 同じファイルを選び直せるようにする。
    const current = ++revision;
    const active = () => current === revision && area.isConnected;
    area.value = ""; // ファイルを選んだのに、前に貼った文字列を読み込ませない。
    if (selected.size > MAX_TRANSFER_SIZE) {
      reading = area.readOnly = false;
      status.textContent = "ファイルが大きすぎます。ゲームから書き出した .txt ファイルを選んでください。";
      syncButton();
      return;
    }
    reading = area.readOnly = true;
    status.textContent = "ファイルを開いています…";
    syncButton();
    try {
      const contents = await selected.text();
      if (active()) {
        area.value = contents;
        status.textContent = contents.trim() ? "ファイルを選びました。「読み込む」で内容を確認できます。" : "ファイルが空です。";
      }
    } catch {
      if (active()) status.textContent = "ファイルを読めません。もう一度選んでください。";
    } finally {
      if (active()) { reading = area.readOnly = false; syncButton(); }
    }
  });
  const prompt = modal({ title: "セーブの読み込み", focusTest: "import-pick",
    body: el("div.xfer-help", [
      el("p", { text: "保存した .txt ファイルを選ぶか、書き出した文字列を貼り付けてください。" }),
      area, file, status,
    ]),
    options: [
      { label: "ファイルを選ぶ", test: "import-pick", keep: () => file.click() },
      { label: "読み込む", value: "go", primary: true, test: "import-go" },
      { label: "やめる", value: false, test: "import-cancel" },
    ] });
  syncButton();
  const choice = await prompt;
  if (choice === "go") return openImportWith(area.value);
}

async function openImportWith(text) {
  const slots = parseSaveText(text);
  if (!slots) { await modal({ title: "読み込めません", body: "セーブが壊れているか、今のバージョンで読めない形式です。今のセーブはそのままです。", options: [{ label: "閉じる", value: true, primary: true, test: "import-error-ok" }] }); return; }
  const names = slots.map(({ key, s }) => {
    const old = readSlot(key);
    const before = Number.isSafeInteger(old?.day) ? `${old.day}日目 → ` : "";
    return `${SAVE_SLOTS.find(x => x.key === key).label}：${before}${s.day}日目`;
  }).join("\n");
  const ok = await modal({ title: "読み込みの確認", className: "xfer-modal", focusTest: "import-abort",
    body: el("div.xfer-help", [
      el("p", { text: "表示されたセーブ枠だけを置き換え、タイトルに戻ります。今のセーブを残したい場合は、先に書き出してください。" }),
      el("pre.xfer-slots", { text: names }),
      el("p", { text: slots.progress ? "CG・写真・ルート・周回の記録は今の記録と統合。設定と本文の既読は変えません。" : "旧形式のため、今のCG・ルート・周回記録は変えません。" }),
    ]),
    options: [{ label: "上書きして読み込む", value: true, primary: true, test: "import-confirm" }, { label: "やめる", value: false, test: "import-abort" }] });
  if (!ok) return;
  if (!applySlots(slots)) { toast("保存できませんでした。セーブと累積記録の保存状態を確認してください"); return; }
  location.reload();
}

const SAVE_HELP = [
  "同じ配布リンクを同じブラウザで開くと、自動保存した続きから遊べます。アカウントは不要です。",
  "別の端末やブラウザには自動では移りません。シークレットモードを閉じたり、サイトデータを削除したりすると消えます。",
  "引っ越す前に「書き出し」→「ファイルを保存」。移行先で「読み込み」→「ファイルを選ぶ」。iPhoneのホーム画面版への移行にも使えます。",
];

/** 設定画面に置くバックアップ／読み込み。遊んでいる画面は普段どおり。 */
export function saveTransferRow() {
  const help = () => modal({ title: "セーブの保存と引っ越し", className: "xfer-modal",
    body: el("div.xfer-help", { dataset: { test: "save-storage-guide" } }, SAVE_HELP.map(t => el("p", { text: t }))),
    options: [{ label: "閉じる", value: true, primary: true }] });
  return el("div.cfg-row.xfer-row", { dataset: { test: "save-transfer" } }, [
    el("span", { text: "セーブの管理" }),
    el("span.xfer-btns", [
      el("button.btn.small.xfer-btn", { type: "button", text: "書き出し", dataset: { test: "save-export" }, onclick: () => { openExport(); } }),
      el("button.btn.small.xfer-btn", { type: "button", text: "読み込み", dataset: { test: "save-import" }, onclick: () => { openImport(); } }),
      el("button.btn.small.xfer-btn.xfer-q", { type: "button", text: "？", "aria-label": "セーブの保存と引っ越しの説明", dataset: { test: "save-transfer-help" }, onclick: help }),
    ]),
  ]);
}

