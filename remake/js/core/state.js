// ゲーム状態（単一の state）とセーブ。
// 旧版と localStorage を共有しないよう、キーはリメイク専用。
// 状態の形を変えたら SCHEMA を上げ、migrate() に1段足す（互換コードはここだけに置く）。

export const SAVE_KEY = "suien_remake_save";
export const CONFIG_KEY = "suien_remake_config";
export const SCHEMA = 3; // 2: スロット・くじ・恋人を追加 / 3: LIME の受信箱

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
    affinity: {},              // キャラ -> 好感度ポイント（段階は stats.js で換算）
    story: {},                 // キャラ -> 固有会話の消化数
    visits: {},                // スポット -> 訪問回数
    visitedDay: {},            // スポット -> 最後に訪れた日（同じ店は1日1回）
    owned: STARTER_EQUIPMENT.slice(),
    equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
    flavors: ["double_apple"], // 手持ちのフレーバー（1箱買えば章の間は使える）。本番用は Dr.fookah で仕入れる
    baitoCount: 0,
    lastBaitoDay: 0,           // 最後にシフトに入った日（スミさんのバイト誘いの判定）
    usedBaito: [],
    contacts: [],              // LIME を交換した相手
    limeRead: [],              // 既読の LIME id
    inbox: [],                 // LIME の受信箱 [{id, day, msg, read, done, log}]（朝に届き、好きなときに読む）
    notes: {},                 // 常連ノート（接客した客 -> 回数）
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
    seed: Math.floor(Math.random() * 1e6),
    playMs: 0,
  };
}

/** 旧スキーマのセーブを現行の形にそろえる（互換処理はここに集約） */
function migrate(s) {
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
