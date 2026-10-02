// セーブ／ロードの枠選び（オートセーブ＋手動3枠）。タイトルの「ロード」と、日常の MENU から開く。
import { el, yen } from "../core/util.js";
import { layers, modal, toast } from "../core/ui.js";
import { SAVE_SLOTS, readSlot, saveToSlot } from "../core/state.js";
import { SE } from "../core/audio.js";

const PHASE_LABEL = { opening: "プロローグ", daily: "日常", tournament: "大会当日", cleared: "第1章クリア" };

function slotInfo(data) {
  if (!data) return "── 空き ──";
  const when = data.savedAt ? new Date(data.savedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const time = data.phase === "daily" ? (data.slot >= 1 ? "夜" : "昼") : "";
  return { head: `DAY ${data.day}${time ? `・${time}` : ""}　${PHASE_LABEL[data.phase] || ""}`, sub: `所持金 ${yen(data.money || 0)}${when ? `　${when}` : ""}` };
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
      const info = slotInfo(data);
      const off = mode === "save" ? s.auto : !data;
      return el(`button.save-slot${off ? ".off" : ""}${s.auto ? ".auto" : ""}`, {
        disabled: off || null,
        dataset: { test: `slot-${i}` },
        onclick: () => { SE.select(); close(s.key); },
      }, [
        el("span.ss-label", { text: s.label }),
        data ? el("span.ss-info", [el("b", { text: info.head }), el("small", { text: info.sub })]) : el("span.ss-info.empty", { text: info }),
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
    if (readSlot(key)) {
      const ok = await modal({
        title: "上書き",
        body: `${slot.label} のデータを上書きします。よろしいですか？`,
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
