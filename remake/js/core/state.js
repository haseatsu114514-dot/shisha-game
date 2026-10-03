// ゲーム状態（単一の state）とセーブ。
// 旧版と localStorage を共有しないよう、キーはリメイク専用。
// 状態の形を変えたら SCHEMA を上げ、migrate() に1段足す（互換コードはここだけに置く）。

export const SAVE_KEY = "suien_remake_save";
export const CONFIG_KEY = "suien_remake_config";
export const SCHEMA = 8; // 2: スロット・くじ・恋人 / 3: LIME の受信箱 / 4: グラム在庫・天気 / 5: 交流の記憶 / 6: 好感度の端数・LIME返信と予約 / 7: 恋人の端数・接客履歴 / 8: 隠し恋愛値・交友の締めくくり

export const STAT_KEYS = ["technique", "sense", "guts", "charm", "insight"];
export const STAT_JA = { technique: "技術", sense: "センス", guts: "根性", charm: "魅力", insight: "洞察" };
export const STAT_EN = Object.fromEntries(Object.entries(STAT_JA).map(([en, ja]) => [ja, en]));

export const STARTER_EQUIPMENT = ["silicone_bowl", "lotos_hagal", "flat_charcoal"];

/** 現在の状態。load()/newGame() で差し替わる。各モジュールは常にこの参照を読む */
export let state = null;

export function newState() {
  return {
    schema: SCHEMA,
    chapter: 1,
    phase: "opening",          // opening | daily | tournament | cleared
    day: 1,
    slot: 0,                   // 0=昼 1=夜 2=その日の行動は終了
    money: 20000,
    stamina: 100,
    stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
    statXp: {},
    statsAtChapterStart: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
    flags: {},
    met: {},                   // 名乗りを受けたキャラ（名前表示の解禁）
    affinityCarry: {}, // 普通の好感度の小数分。既存ポイントは減らさない
    loveCarry: {}, // 恋人の絆の半ポイントを持ち越す
    baitoRecent: [], // 直近4回の接客の客・日付
    affinity: {},              // キャラ -> 好感度ポイント（段階は stats.js で換算）
    story: {},                 // キャラ -> 固有会話の消化数
    visits: {},                // スポット -> 訪問回数
    visitedDay: {},            // スポット -> 最後に訪れた日（同じ店は1日1回）
    owned: STARTER_EQUIPMENT.slice(),
    equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
    flavors: ["double_apple"], // 一度でも手に入れたフレーバー（図鑑的な記録）。使えるかどうかは flavorStock で決まる
    flavorStock: { double_apple: 50 }, // フレーバーの在庫（g）。1箱50g。大会で詰んだ分だけ減る（課題フレーバーは主催支給）
    weatherSeed: Math.floor(Math.random() * 100000), // 雨の日の抽選種（セーブごとに違う）
    baitoCount: 0,
    lastBaitoDay: 0,           // 最後にシフトに入った日（スミさんのバイト誘いの判定）
    usedBaito: [],
    contacts: [],              // LIME を交換した相手
    limeRead: [],              // 既読の LIME id
    pendingInvite: null, // day/slot/originIdつきの予約
    inbox: [],                 // LIME の受信箱 [{id, day, msg, read, done, log}]（朝に届き、好きなときに読む）
    notes: {},                 // 常連ノート（接客した客 -> 回数）
    relationshipMemories: [],   // 読んだ交流だけを残す。人数・恋愛・大会の加点には使わない
    recipes: {},               // 発見したレシピ
    best: {},                  // 練習ドリルの自己ベスト（0..2）
    rehearsal: null,           // 前日リハーサルの出来（great/good/rough）
    tournament: { attempts: 0, lastRank: null },
    // MOKUMOKUパッキー（日常スロット）。抽選は seed＋総回転数の決定論＝ロードしても結果は変わらない
    reel: {
      seed: (Math.random() * 0x100000000) >>> 0,
      count: 0, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 0, freezeCount: 0,
      pending: [],             // 演出待ちの結果（報酬は確定・適用済み）
      introDone: false,
      lastChapter: 0,
      note: {},                // スロノート（役ごとの回数）
    },
    kuji: {},                  // くじの箱（grade -> {order, drawn, emptyDay}）
    goods: [],                 // くじ等で得た売れる小物 [{name, sell}]
    // 恋人（master_spec #24）: 好感度MAX→告白→付き合う/友達のまま。恋人の絆はデート等でだけ深まる
    lovers: [],
    loveLevel: {},             // 恋人 -> 絆Lv（1..5）
    lovePts: {},               // 恋人 -> 絆ポイント
    loverSince: {},            // 恋人 -> 付き合い始めた日（記念日LIMEの起点）
    lastDate: {},              // 恋人 -> 最後にデートした日
    loverEventsSeen: [],       // 見た恋愛イベント（lover_events.json）
    guilt: 0,                  // うしろめたさ（非表示）。2人以上と付き合うと積もる
    // 交友の締めくくり（daily/bonds.js）。恋愛の答えは実際に選んだものだけ。好感度・訪問回数から推測しない
    romance: {},               // 隠し恋愛値（キャラ -> 恋愛寄りに答えた数）。プレイヤーには見せない
    romanceChoices: {},        // 答えた質問（選択肢 id -> {char, value, day}）。同じ id は一度だけ数える
    finales: {},               // 読んだ好感度MAXの締めくくり（キャラ -> {day, chapter, route: lover|romance|friend}）
    friendHangouts: {},        // 友人とのシーシャのお誘いに乗った回数（キャラ -> 回数）
    seed: Math.floor(Math.random() * 1e6),
    playMs: 0,
  };
}

/** 旧スキーマのセーブを現行の形にそろえる（互換処理はここに集約） */
function migrate(s) {
  const oldSchema = Number(s.schema) || 0;
  s.flags ||= {};
  s.loveCarry = Object.fromEntries(Object.entries(s.loveCarry && typeof s.loveCarry === "object" ? s.loveCarry : {})
    .filter(([, v]) => Number.isFinite(v) && v >= 0 && v < 1));
  s.baitoRecent = (Array.isArray(s.baitoRecent) ? s.baitoRecent : [])
    .filter((entry) => entry && typeof entry.id === "string" && entry.id && Number.isInteger(entry.chapter) && entry.chapter > 0
      && Number.isInteger(entry.day) && entry.day > 0)
    .map((entry) => ({ id: entry.id, chapter: entry.chapter, day: entry.day,
      customers: [...new Set((Array.isArray(entry.customers) ? entry.customers : []).filter((id) => typeof id === "string" && id))] }))
    .slice(-4);
  s.affinityCarry = Object.fromEntries(Object.entries(s.affinityCarry && typeof s.affinityCarry === "object" ? s.affinityCarry : {})
    .filter(([, v]) => Number.isFinite(v) && v >= 0 && v < 1));
  // 旧版は私服デートを店舗訪問の6回目で再生していた。読んだ保存を重ねて再生しない。
  if (oldSchema < 6 && (s.story?.minto || 0) >= 6) {
    s.story.minto -= 1;
    s.flags._minto_fifth_done = true;
  }
  if (oldSchema < 6 && (s.story?.adam || 0) >= 5) {
    s.story.adam -= 1;
    s.flags._adam_arcade_done = true;
  }
  s.inbox = (Array.isArray(s.inbox) ? s.inbox : []).filter((i) => i && typeof i.id === "string" && i.msg && typeof i.msg === "object");
  for (const item of s.inbox) {
    item.originId ||= item.id;
    if (!["waiting", "replied", "expired", "none"].includes(item.replyState)) {
      const replyable = item.msg.type === "invitation" || !!item.msg.replies?.length;
      item.replyState = !replyable ? "none" : !item.done ? "waiting"
        : item.result === "expired" || item.expired ? "expired" : "replied";
    }
  }
  if (oldSchema < 6) {
    // 旧版の店舗招待で誤って付いた外出完了は、実際の外出の承諾と完了が残る場合だけ引き継ぐ。
    for (const id of ["minto", "naru", "adam", "tsumugi", "ageha"]) {
      if (s.flags[`_outing_done_${id}`] && !s.inbox.some((i) => i.result === "accepted" && i.msg.accept_event === `outing_${id}_1`)) {
        delete s.flags[`_outing_done_${id}`];
      }
    }
  }
  if (s.pendingInvite && typeof s.pendingInvite === "object") {
    const inv = s.pendingInvite;
    const item = [...s.inbox].reverse().find((i) => i.msg.sender === inv.sender && i.msg.accept_event === inv.event);
    inv.day ??= s.day;
    inv.originId ||= item?.originId || null;
    inv.afterClose ??= !!item?.msg.after_close;
  }
  // 隠し恋愛値・締めくくり（スキーマ8）。壊れた値は捨て、無いものは空から始める（読んでいない質問を埋めない）
  const record = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
  s.romance = Object.fromEntries(Object.entries(record(s.romance)).filter(([, v]) => Number.isInteger(v) && v > 0));
  s.romanceChoices = Object.fromEntries(Object.entries(record(s.romanceChoices))
    .filter(([, a]) => a && typeof a.char === "string" && Number.isInteger(a.value) && a.value >= 0));
  s.finales = Object.fromEntries(Object.entries(record(s.finales))
    .filter(([, f]) => f && ["lover", "romance", "friend"].includes(f.route)));
  if (oldSchema < 8) {
    // 旧版は好感度MAXだけで告白を自動予約していた。恋愛の答えが無い予約は残さない（既存の恋人関係はそのまま）
    delete s.flags._confession_due;
    delete s.flags._confession_wait;
  }
  // 訪問・好感度から、新しい台詞を読んだと推測しない。オート・手動枠に同じ処理を使う。
  s.relationshipMemories = Array.isArray(s.relationshipMemories)
    ? [...new Set(s.relationshipMemories.filter((id) => typeof id === "string"))]
    : [];
  // グラム在庫の導入前のセーブ: 持っていたフレーバーは1箱（50g）ぶんとして引き継ぐ
  if (!s.flavorStock) {
    s.flavorStock = Object.fromEntries((s.flavors || ["double_apple"]).map((id) => [id, 50]));
    if (s.flags?._rin_sample) s.flavorStock.nightside_earlgrey = 50;
  }
  const fresh = newState();
  for (const k of Object.keys(fresh)) if (!(k in s)) s[k] = fresh[k];
  s.schema = SCHEMA;
  return s;
}

export function setState(s) {
  state = s;
  return state;
}

export function newGame() {
  return setState(newState());
}

export function save() {
  if (!state) return;
  state.savedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* プライベートウィンドウ等で失敗しても遊べるようにする */
  }
}

export function peekSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && typeof s === "object" ? s : null;
  } catch {
    return null;
  }
}

export function load() {
  const s = peekSave();
  return s ? setState(migrate(s)) : null;
}

// ---------------------------------------------------------------- 手動セーブ枠（オートセーブとは別に3枠）

export const SAVE_SLOTS = [
  { key: SAVE_KEY, label: "オートセーブ", auto: true },
  { key: "suien_remake_slot1", label: "スロット 1" },
  { key: "suien_remake_slot2", label: "スロット 2" },
  { key: "suien_remake_slot3", label: "スロット 3" },
];
const BOOT_LOAD_KEY = "suien_remake_boot_load";

/** 枠の中身（無い・壊れている→null） */
export function readSlot(key) {
  try {
    const s = JSON.parse(localStorage.getItem(key) || "null");
    return s && typeof s === "object" && s.day ? s : null;
  } catch {
    return null;
  }
}
export const anySlotSaved = () => SAVE_SLOTS.some((s) => readSlot(s.key));

/** 今の状態を手動の枠に書く（オートセーブも同時に更新） */
export function saveToSlot(key) {
  save();
  try {
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** 枠から読み込んで今の状態にする。以後のオートセーブもこのデータから続く */
export function loadFromSlot(key) {
  const s = readSlot(key);
  if (!s) return null;
  setState(migrate(s));
  save();
  return state;
}

/** ゲーム中にロードしたとき: いったん読み直して、タイトルを飛ばしてそのまま再開する */
export function requestResumeOnBoot() {
  try { sessionStorage.setItem(BOOT_LOAD_KEY, "1"); } catch { /* noop */ }
}
export function consumeResumeOnBoot() {
  try {
    const v = sessionStorage.getItem(BOOT_LOAD_KEY);
    sessionStorage.removeItem(BOOT_LOAD_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
}

// ---------------------------------------------------------------- 設定（セーブとは別）
export const config = {
  bgmVolume: 0.5,
  seVolume: 0.7,
  textSpeed: 2,      // 1=ゆっくり 2=ふつう 3=はやい 4=瞬時
  voiceBlip: true,   // 文字送りの声（キャラ別の音程）
};

export function loadConfig() {
  try {
    Object.assign(config, JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}"));
  } catch { /* noop */ }
  return config;
}

export function saveConfig() {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* noop */ }
}

// ---------------------------------------------------------------- 小さな共通操作
export const flag = (name) => !!(state && state.flags[name]);
export const setFlag = (name, v = true) => { if (state) state.flags[name] = v; };
export const markMet = (id) => { if (state && id) state.met[id] = true; };
export const timeOfDay = () => (state && state.slot >= 1 ? "night" : "day");
