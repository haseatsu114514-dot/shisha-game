// セーブ／ロードの枠選び（オートセーブ＋手動3枠）。タイトルの「ロード」と、日常の MENU から開く。
import { el, yen } from "../core/util.js";
import { layers, modal, toast } from "../core/ui.js";
import { SCHEMA, SAVE_SLOTS, STAT_KEYS, STAT_JA, readSlot, saveToSlot, state } from "../core/state.js";
import { DB, displayName, faceIconUrl } from "../core/data.js";
import { cycleBadgeText, overwriteCycleNote } from "../core/cycle-display.js";
import { chapterDay } from "../core/chapter-clock.js";
import { SE } from "../core/audio.js";

const PHASE_LABEL = { opening: "プロローグ", daily: "日常", tournament: "大会当日", aftermath: "大会後" };
const MAX_FACES = 8;

/** 現行 SCHEMA より新しいバージョンで保存された枠か（表示側の判定。拒否そのものは保存層の責務） */
function isFutureSave(data) {
  return !!data && (Number(data.schema) || 0) > SCHEMA;
}

/** 保存データの chapter／phase から、見出しの章札・日付・フェーズ札を組む */
function slotInfo(data) {
  const chapter = data.chapter || 1;
  const time = data.phase === "daily" ? (data.slot >= 1 ? "夜" : "昼") : "";
  const phase = data.phase === "cleared" ? `第${chapter}章クリア`
    : chapter === 2 && chapterDay(data) === 1 && data.flags?._ch2_day1?.stage === "complete" ? "初日終了" : PHASE_LABEL[data.phase] || "";
  const when = data.savedAt ? new Date(data.savedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  // 2周目以降だけ章札の前に周回数を付ける（1周目・cycle欠損の旧セーブは従来表示のまま。設計 §3.6・§8.3）
  const badge = cycleBadgeText(data);
  return { chapter: badge ? `${badge}・第${chapter}章` : `第${chapter}章`, day: `DAY ${chapterDay(data)}${time ? `・${time}` : ""}`, phase, money: `所持金 ${yen(data.money || 0)}`, when };
}

/** 保存データの能力5種を10段と細いゲージで示す。現在の state を読む step() は使えない。 */
function statGauges(stats) {
  return el("span.ss-stats", STAT_KEYS.map((k) => {
    const v = Math.max(0, Math.min(100, Number(stats?.[k]) || 0));
    const step = Math.max(1, Math.min(10, Math.ceil(v / 10)));
    return el("span.ss-stat", { title: `${STAT_JA[k]} ${step}段（${Math.round(v)}）`, "aria-label": `${STAT_JA[k]} ${step}段` }, [
      el("small", { text: STAT_JA[k] }),
      el("i", { style: { "--v": `${v}%` } }),
    ]);
  }));
}

/** 出会ったキャラの顔アイコン。アイコンが無いキャラ・重複・ネタバレになる private 顔（oneesan）は出さない */
function metFaces(data) {
  const seen = new Set();
  const faces = [];
  for (const id of Object.keys(DB.characters)) {
    if (!data.met?.[id] || id === "oneesan") continue;
    const url = faceIconUrl(id, data);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    faces.push({ url, name: displayName(id, data) });
  }
  const shown = faces.slice(0, MAX_FACES).map((f) => el("img.ss-face", {
    src: f.url, alt: f.name, title: f.name, loading: "lazy", onerror: (e) => { e.target.hidden = true; },
  }));
  if (faces.length > MAX_FACES) shown.push(el("span.ss-more", { text: `+${faces.length - MAX_FACES}` }));
  return shown.length ? el("span.ss-faces", { "aria-label": "出会った人" }, shown) : null;
}

function slotBody(data) {
  if (!data) return [el("span.ss-info.empty", { text: "── 空き ──" })];
  if (isFutureSave(data)) return [el("span.ss-info", [
    el("b", { text: "新しいバージョンのセーブです" }),
    el("small", { text: "今のバージョンでは読み込めません" }),
  ])];
  const info = slotInfo(data);
  return [
    el("span.ss-info", [
      el("b", [el("em.ss-chapter", { text: info.chapter }), el("span", { text: info.day }), info.phase ? el("em.ss-phase", { text: info.phase }) : null]),
      statGauges(data.stats),
      el("small", { text: `${info.money}${info.when ? `　${info.when}` : ""}` }),
    ]),
    metFaces(data),
  ];
}

/**
 * 枠を選ぶ。mode: "save"（オートセーブ枠は押せない）/ "load"（空き枠は押せない）。
 * 戻り値: 選んだ枠の key（やめたら null）
 */
function pickSlot(mode) {
  return new Promise((resolve) => {
    const close = (v) => { layers.modal.classList.remove("show"); layers.modal.replaceChildren(); resolve(v); };
    const rows = SAVE_SLOTS.map((s, i) => {
      const data = readSlot(s.key);
      const future = isFutureSave(data);
      const off = mode === "save" ? s.auto : !data;
      return el(`button.save-slot${off ? ".off" : ""}${s.auto ? ".auto" : ""}${data ? "" : ".blank"}`, {
        disabled: off || null,
        dataset: { test: `slot-${i}` },
        onclick: () => {
          if (mode === "load" && future) {
            SE.cancel();
            toast("新しいバージョンのセーブです", { kind: "warn" });
            return;
          }
          SE.select();
          close(s.key);
        },
      }, [
        el("span.ss-label", [el("small", { text: s.auto ? "AUTO" : `No.${i}` }), el("span", { text: s.label })]),
        ...slotBody(data),
      ]);
    });
    const box = el("div.modal-box.saveload-modal", [
      el("h3", { text: mode === "save" ? "セーブ" : "ロード" }),
      el("p.ss-note", { text: mode === "save" ? "書き込む枠を選ぶ。オートセーブは行動のたびに自動で更新される。" : "読み込むデータを選ぶ。" }),
      el("div.ss-list", rows),
      el("div.modal-actions", [el("button.btn", { text: "やめる", dataset: { test: "slot-cancel" }, onclick: () => { SE.cancel(); close(null); } })]),
    ]);
    layers.modal.replaceChildren(el("div.modal-backdrop"), box);
    layers.modal.classList.add("show");
  });
}

/** 今の状態を手動の枠へ。上書きは確認する */
export async function saveFlow() {
  for (;;) {
    const key = await pickSlot("save");
    if (!key) return false;
    const slot = SAVE_SLOTS.find((s) => s.key === key);
    const existing = readSlot(key);
    if (existing) {
      // 別周回・旧セーブの上書きは、既存の確認1回に注意文を添えて知らせる（二重に確認は出さない）
      const note = overwriteCycleNote(existing, state);
      const ok = await modal({
        title: "上書き",
        body: `${slot.label} のデータを上書きします。よろしいですか？${note ? `<br>${note}` : ""}`,
        options: [{ label: "やめる", value: false }, { label: "上書きする", value: true, primary: true, test: "confirm-overwrite" }],
      });
      if (!ok) continue;
    }
    if (saveToSlot(key)) { SE.money(); toast(`${slot.label} にセーブした`, { kind: "good" }); }
    else toast("セーブできなかった（ブラウザの保存領域がいっぱいかも）", { kind: "warn" });
    return true;
  }
}

/**
 * ロードする枠を選ぶ。inGame=true なら、今の進み具合が上書きされることを確認する。
 * 戻り値: 選んだ枠の key（やめたら null）
 */
export async function loadFlow({ inGame = false } = {}) {
  const key = await pickSlot("load");
  if (!key) return null;
  if (inGame && key !== SAVE_SLOTS[0].key) {
    const ok = await modal({
      title: "ロード",
      body: "今の進み具合（オートセーブ）は、このデータで上書きされます。よろしいですか？",
      options: [{ label: "やめる", value: false }, { label: "ロードする", value: true, primary: true, test: "confirm-load" }],
    });
    if (!ok) return null;
  }
  return key;
}
