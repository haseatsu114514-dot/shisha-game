// デバッグ用の道具（2026-11-02 オーナー「デバッグ用に役立つ機能入れたい。何倍速とかシーシャ作りパートスキップとか。
// リリースするときは消すけど」）。URL に ?debug=1 を付けると左下に「DBG」が出る（?debug=0 で消える。端末に覚える）。
// - 速さ: ×1／×2／×4／×8（time-warp.js。音は変えない）
// - シーシャ作り: 自分で／自動で成功／自動で失敗（検査用の craftTest.auto を使う。各工程が操作なしで進む）
// - 便利: 体力を満タン・お金＋10万円・経験値＋200・火種＋6
// - 今の状態（章・日・時間帯・体力・お金）
// 会話の早送りは、会話の操作バーの SKIP（設定で未読も飛ばせる）を使う。
// ホーム画面に追加したiPhoneなど URL を変えられない時は、タイトルの版の表示を5回続けて押すと出し入れできる（scenes/title.js の debugTapToggle）。
// リリース前に消す: remake/js/dev/ のフォルダと、main.js の「デバッグ用の道具」の1行、title.js の debugTapToggle（remake/README.md）。
import { state, newState, setState, save, loadFromSlot, requestResumeOnBoot, SCHEMA, config, saveConfig } from "../core/state.js";
import { addStamina, addMoney, maxStamina, ROMANCEABLE, AFFINITY_RANK_PTS, affinityLevel } from "../core/stats.js";
import { chapterDay, chapterFinalDay } from "../core/chapter-clock.js";
import { advanceToChapterTwo, dayOneProgress } from "../chapters/ch2-progress.js";
import { advanceToChapterThree, chapterThreeProgress } from "../chapters/ch3-progress.js";
import { advanceToChapterFour, chapterFourProgress } from "../chapters/ch4-progress.js";
import { advanceToChapterFive, chapterFiveProgress } from "../chapters/ch5-progress.js";
import { craftTest } from "../craft/session.js";
import { growthEnabled, gainExp, ensureGrowth } from "../core/growth.js";
import { emit } from "../core/bus.js";
import { refreshPortraits } from "../vn/engine.js";
import { installTimeWarp, setSpeed, getSpeed, SPEEDS, realTime } from "./time-warp.js";
import { createBackgroundPreview } from "./background-preview.js";
import { mountMiniGameDebug } from "./minigame-launcher.js";

const SPEED_KEY = "suien_debug_speed";
const CRAFT_KEY = "suien_debug_craft";
const CRAFT_MODES = Object.freeze([
  { value: "", label: "自分で" },
  { value: "good", label: "自動で成功" },
  { value: "bad", label: "自動で失敗" },
]);
const store = {
  get: key => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch {} },
};

const STYLE = `
.dbg-toggle{position:fixed;left:8px;bottom:8px;z-index:2147483000;font:700 12px/1 system-ui,sans-serif;padding:8px 10px;border-radius:8px;
  border:1px solid #f5c26b;background:rgba(20,16,30,.82);color:#f5c26b;cursor:pointer;letter-spacing:.06em}
.dbg-toggle[data-speed]:not([data-speed="1"])::after{content:" ×" attr(data-speed)}
.dbg-panel{position:fixed;left:8px;bottom:48px;z-index:2147483000;width:min(300px,calc(100vw - 16px));max-height:calc(100vh - 64px);overflow:auto;
  background:rgba(20,16,30,.94);color:#f4ede0;border:1px solid #f5c26b;border-radius:10px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;
  box-shadow:0 8px 24px rgba(0,0,0,.5)}
.dbg-panel[hidden]{display:none}
.dbg-panel h4{margin:8px 0 4px;font-size:12px;color:#f5c26b;font-weight:700}
.dbg-panel h4:first-child{margin-top:0}
.dbg-row{display:flex;flex-wrap:wrap;gap:6px}
.dbg-panel button{font:600 12px/1 system-ui,sans-serif;padding:7px 9px;border-radius:6px;border:1px solid #6b5a8a;background:#2b2340;color:#f4ede0;cursor:pointer}
.dbg-panel button[aria-pressed="true"]{background:#f5c26b;border-color:#f5c26b;color:#1c1626}
.dbg-panel select,.dbg-panel input{font:12px system-ui,sans-serif;max-width:100%;min-width:0;padding:6px;border:1px solid #6b5a8a;border-radius:6px;background:#2b2340;color:#f4ede0}
.dbg-panel input[type="number"]{width:64px}
.dbg-panel input[type="file"]{width:100%}
.dbg-panel .dbg-row{align-items:center}
.dbg-state{font:12px/1.5 ui-monospace,monospace;color:#cfc6b6;white-space:pre-wrap}
.dbg-note{font-size:11px;color:#9d93a8;margin-top:6px}
.dbg-preview-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1000;pointer-events:none}
.dbg-preview-image[hidden],.dbg-preview-close[hidden]{display:none}
.dbg-preview-close{position:fixed;right:8px;bottom:8px;z-index:2147483000;font:600 12px system-ui,sans-serif;padding:8px 10px;
  border:1px solid #f5c26b;border-radius:8px;background:rgba(20,16,30,.9);color:#f5c26b;cursor:pointer}
`;

function el(tag, { dataset = {}, ...props } = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const [key, value] of Object.entries(dataset)) node.dataset[key] = value;
  node.append(...children);
  return node;
}
const SLOT = ["昼", "夜", "就寝"];
const CHAR_LABELS = { tsumugi: "つむぎ", minto: "みんと", rio: "凛想", ageha: "あげは", mashiro: "ましろ", hiyori: "ひより", samechan: "サメちゃん" };

// 画面で走っている旧ループを破棄するため、保存後は既存のブート再開経路へ戻す。
function resumeSaved() {
  if (!save()) throw new Error("保存に失敗しました");
  requestResumeOnBoot();
  location.reload();
}

function warp(slot, nextDay = false) {
  if (!state || state.phase !== "daily") throw new Error("日常パートで使用してください");
  if (nextDay) {
    const last = chapterFinalDay(state);
    if (last !== null && chapterDay(state) >= last) throw new Error("章の最終日です。章ジャンプを使ってください");
    state.day += 1;
    state.slot = 0;
    state.restDay = null;
  } else {
    if (state.slot >= slot) throw new Error("現在より後の時間帯を選んでください");
    state.slot = slot;
  }
  resumeSaved();
}

// 各章の正規遷移は前章の完了状態を要求する。デバッグ用の新規状態でその境界だけ満たして呼ぶ。
function chapterStart(chapter) {
  const next = newState();
  next.flags._ch1_opening = { introDone: false };
  for (let step = 2; step <= chapter; step++) {
    next.phase = "cleared";
    if (step === 3) {
      next.flags._ch2_cleared = true;
      next.flags._ch2_read_ch2_tournament_ageha_heart = true;
      next.flags._ch2_tournament = { stage: "complete" };
    }
    if (step === 4) next.flags._ch3_cleared = true;
    if (step === 5) next.flags._ch4_cleared = true;
    const advance = [null, null, advanceToChapterTwo, advanceToChapterThree, advanceToChapterFour, advanceToChapterFive][step];
    if (!advance(next)) throw new Error(`第${step}章の入口を作れませんでした`);
  }
  setState(next);
  resumeSaved();
}

function importSave(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("JSON を読み取れません"); }
  // migrate は古いセーブの欠落を補うため、任意のオブジェクトも受け入れる。外部入力には最小形を要求する。
  if (!data || Array.isArray(data) || typeof data !== "object"
    || !Number.isInteger(data.schema) || data.schema < 1 || data.schema > SCHEMA
    || !Number.isInteger(data.chapter) || data.chapter < 1 || data.chapter > 5
    || !Number.isInteger(data.day) || data.day < 1 || !["opening", "daily", "tournament", "aftermath", "cleared"].includes(data.phase)
    || !Number.isInteger(data.slot) || data.slot < 0 || data.slot > 2
    || !data.flags || Array.isArray(data.flags) || typeof data.flags !== "object") throw new Error("セーブデータの形式が正しくありません");
  const validate = data => {
    // 第2章は未接続時代の手動SAVEを、通常再開と同じ境界で補完する。
    if (data.chapter === 2) dayOneProgress(data);
    try {
      if (data.chapter === 3) chapterThreeProgress(data);
      if (data.chapter === 4) chapterFourProgress(data);
      if (data.chapter === 5) chapterFiveProgress(data);
    } catch { throw new Error("章の進行地点が正しくありません"); }
  };
  const key = "suien_debug_import_candidate";
  try {
    localStorage.setItem(key, raw);
    if (!loadFromSlot(key, { validate })) throw new Error("セーブの検証または保存に失敗しました");
  } finally { localStorage.removeItem(key); }
  requestResumeOnBoot();
  location.reload();
}
function stateText() {
  const s = state;
  if (!s) return "（ゲーム開始前）";
  const money = typeof s.money === "number" ? `${s.money.toLocaleString("ja-JP")}円` : "-";
  return `第${s.chapter ?? "-"}章 DAY${s.day ?? "-"} ${SLOT[s.slot] ?? "-"}（${s.phase ?? "-"}）\n体力 ${s.stamina ?? "-"}／${state ? maxStamina() : "-"}  お金 ${money}`;
}

let mounted = false;
/** 左下に DBG ボタンとパネルを出す（一度だけ）。保存した速さ・シーシャ作りの設定を当てる。 */
export function mountDebugPanel() {
  if (mounted) return;
  mounted = true;
  installTimeWarp();
  setSpeed(Number(store.get(SPEED_KEY)) || 1);
  craftTest.auto = CRAFT_MODES.some(mode => mode.value && mode.value === store.get(CRAFT_KEY)) ? store.get(CRAFT_KEY) : null;

  document.head.append(el("style", { id: "dbg-style", textContent: STYLE }));
  const toggle = el("button", { className: "dbg-toggle", type: "button", textContent: "DBG", title: "デバッグ用の道具（` キーでも開閉）",
    dataset: { test: "debug-toggle", speed: String(getSpeed()) } });
  const panel = el("div", { className: "dbg-panel", hidden: true, dataset: { test: "debug-panel" } });
  const status = el("div", { className: "dbg-state", dataset: { test: "debug-state" } });

  const pressed = (row, value) => { for (const b of row.children) b.setAttribute("aria-pressed", String(b.dataset.value === String(value))); };
  const speedRow = el("div", { className: "dbg-row" }, SPEEDS.map(speed => el("button", { type: "button", textContent: `×${speed}`,
    dataset: { value: String(speed), test: `debug-speed-${speed}` },
    onclick: () => { store.set(SPEED_KEY, String(setSpeed(speed))); toggle.dataset.speed = String(getSpeed()); pressed(speedRow, getSpeed()); } })));
  const craftRow = el("div", { className: "dbg-row" }, CRAFT_MODES.map(mode => el("button", { type: "button", textContent: mode.label,
    dataset: { value: mode.value, test: `debug-craft-${mode.value || "manual"}` },
    onclick: () => { craftTest.auto = mode.value || null; store.set(CRAFT_KEY, mode.value); pressed(craftRow, mode.value); } })));
  const portraitSelect = el("select", { dataset: { test: "debug-portrait-style" }, title: "会話の立ち絵の画風",
    onchange: () => { config.portraitStyle = portraitSelect.value; saveConfig(); refreshPortraits(); } },
    [["new", "新バージョン"], ["classic", "現行"]].map(([value, label]) => el("option", { value, textContent: label })));
  const syncPortraitStyle = () => { portraitSelect.value = config.portraitStyle === "classic" ? "classic" : "new"; };
  syncPortraitStyle();
  const portraitRow = el("div", { className: "dbg-row" }, [portraitSelect]);
  const backgroundPreview = createBackgroundPreview();
  const miniGames = mountMiniGameDebug();
  const action = (label, test, run) => el("button", { type: "button", textContent: label, dataset: { test },
    onclick: () => { if (!state) return; run(); emit("hud"); status.textContent = stateText(); } });
  const tools = el("div", { className: "dbg-row" }, [
    action("体力を満タン", "debug-stamina", () => addStamina(maxStamina() - (state.stamina || 0))),
    action("お金＋10万円", "debug-money", () => addMoney(100000)),
    action("経験値＋200", "debug-exp", () => { if (growthEnabled()) gainExp(200); }),
    action("火種＋6", "debug-hidane", () => { if (growthEnabled()) { const g = ensureGrowth(); g.hidane.any = (g.hidane.any || 0) + 6; } }),
  ]);
  const message = el("div", { className: "dbg-note", role: "status", dataset: { test: "debug-message" } });
  const run = task => { try { task(); message.textContent = "反映しました"; status.textContent = stateText(); } catch (error) { message.textContent = error.message; } };
  const warpRow = el("div", { className: "dbg-row" }, [
    el("button", { type: "button", textContent: "夜へ", dataset: { test: "debug-night" }, onclick: () => run(() => warp(1)) }),
    el("button", { type: "button", textContent: "翌日へ", dataset: { test: "debug-next-day" }, onclick: () => run(() => warp(0, true)) }),
  ]);
  const chapterSelect = el("select", { dataset: { test: "debug-chapter-select" }, title: "ジャンプ先の章" },
    [1, 2, 3, 4, 5].map(n => el("option", { value: String(n), textContent: `第${n}章・章頭` })));
  const chapterRow = el("div", { className: "dbg-row" }, [chapterSelect,
    el("button", { type: "button", textContent: "章頭へ", dataset: { test: "debug-chapter-go" },
      onclick: () => run(() => chapterStart(Number(chapterSelect.value))) }),
  ]);
  const character = el("select", { dataset: { test: "debug-character" }, title: "キャラ" },
    ROMANCEABLE.map(id => el("option", { value: id, textContent: CHAR_LABELS[id] || id })));
  const hearts = el("select", { dataset: { test: "debug-hearts" }, title: "好感度のハート" },
    [0, 1, 2, 3, 4, 5].map(n => el("option", { value: String(n), textContent: `♥ ${n}` })));
  const lovePoints = el("input", { type: "number", min: "0", max: "999", step: "1", value: "9", dataset: { test: "debug-love-points" }, title: "恋愛ポイント（恋人の絆）" });
  const lover = el("input", { type: "checkbox", dataset: { test: "debug-lover" }, title: "恋人状態" });
  const syncRelationship = () => {
    const id = character.value, dating = !!state?.lovers?.includes(id);
    lover.checked = dating;
    hearts.value = String(dating ? (state.loveLevel[id] || 1) : affinityLevel(id));
    lovePoints.value = String(dating ? (state.lovePts[id] || 9) : 9);
  };
  character.onchange = syncRelationship;
  const relationshipRow = el("div", { className: "dbg-row" }, [character, hearts, lovePoints,
    el("label", {}, [lover, "恋人"]),
    el("button", { type: "button", textContent: "設定", dataset: { test: "debug-relationship-set" }, onclick: () => run(() => {
      if (!state) throw new Error("ゲーム開始後に使用してください");
      const id = character.value, level = Number(hearts.value), points = Number(lovePoints.value);
      if (!Number.isInteger(points) || points < 0 || points > 999) throw new Error("ポイントは0〜999で指定してください");
      if (lover.checked) {
        if (!state.lovers.includes(id)) state.lovers.push(id);
        state.affinity[id] = Math.max(state.affinity[id] || 0, AFFINITY_RANK_PTS[5]);
        state.loveLevel[id] = Math.max(1, level);
        state.lovePts[id] = Math.max(points, AFFINITY_RANK_PTS[state.loveLevel[id]]);
        state.loverSince[id] ??= state.day;
      } else {
        state.lovers = state.lovers.filter(value => value !== id);
        state.affinity[id] = AFFINITY_RANK_PTS[level];
        delete state.loveLevel[id]; delete state.lovePts[id]; delete state.loverSince[id]; delete state.lastDate[id];
      }
      state.affinityCarry[id] = 0; state.loveCarry[id] = 0;
      if (!save()) throw new Error("保存に失敗しました");
      emit("hud"); emit("lovers", { id });
      syncRelationship();
    }) }),
  ]);
  const importFile = el("input", { type: "file", accept: ".json,application/json", dataset: { test: "debug-save-file" } });
  const saveRow = el("div", { className: "dbg-row" }, [
    el("button", { type: "button", textContent: "JSONを書き出す", dataset: { test: "debug-save-export" }, onclick: () => run(() => {
      if (!state) throw new Error("ゲーム開始後に使用してください");
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), link = el("a", { href: url, download: `suien-save-ch${state.chapter}-day${state.day}.json` });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }) }),
    importFile,
    el("button", { type: "button", textContent: "JSONを読み込む", dataset: { test: "debug-save-import" }, onclick: async () => {
      const file = importFile.files?.[0];
      if (!file) { message.textContent = "JSONファイルを選んでください"; return; }
      try { importSave(await file.text()); } catch (error) { message.textContent = error.message; }
    } }),
  ]);
  pressed(speedRow, getSpeed());
  pressed(craftRow, craftTest.auto || "");
  panel.append(
    el("h4", { textContent: "速さ（音は変わらない）" }), speedRow,
    el("h4", { textContent: "シーシャ作り" }), craftRow,
    el("h4", { textContent: "会話の立ち絵" }), portraitRow,
    el("div", { className: "dbg-note", textContent: "通常の設定と共通。未導入の人物・衣装は現行、未導入の表情は同じ画風の通常絵。進行・セーブは変えない。" }),
    el("h4", { textContent: "背景プレビュー" }), backgroundPreview.row,
    el("div", { className: "dbg-note", textContent: "一覧には既存の時間帯・状態差分も含む。表示だけを重ね、進行とセーブは変えない。" }),
    el("h4", { textContent: "便利" }), tools,
    el("h4", { textContent: "ミニゲーム（セーブに記録しない）" }), miniGames,
    el("h4", { textContent: "日付・時間帯" }), warpRow,
    el("h4", { textContent: "章・場面ジャンプ" }), chapterRow,
    el("h4", { textContent: "好感度・恋人" }), relationshipRow,
    el("h4", { textContent: "セーブの入出力" }), saveRow, message,
    el("h4", { textContent: "今の状態" }), status,
    el("div", { className: "dbg-note", textContent: "会話の早送りは、会話の SKIP。経験値は寝ると精算される。" }),
    el("div", { className: "dbg-note", textContent: "この道具を消す: URL に ?debug=0。リリース前には remake/js/dev/ を消す。" }),
  );
  const open = show => { panel.hidden = !show; if (show) { backgroundPreview.refresh(); syncPortraitStyle(); status.textContent = stateText(); if (state) syncRelationship(); } };
  toggle.addEventListener("click", () => open(panel.hidden));
  document.addEventListener("keydown", event => {
    if (event.key === "`" && !event.repeat && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) open(panel.hidden);
  });
  realTime.setInterval(() => { if (!panel.hidden) status.textContent = stateText(); }, 500);
  document.body.append(panel, toggle);
}

