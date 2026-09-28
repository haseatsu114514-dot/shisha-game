// データローダとアセット解決。
// 正本は リポジトリの data/*.json（台詞・キャラ・フレーバー等）。リメイク版はそれを
// 実行時に fetch するだけで、書き換えも二重コピーもしない。
// ページは remake/index.html なので、リポジトリ直下は "../"。

const ROOT = "../";

/** 読み込んだ全データ。起動時に loadAll() が埋める */
export const DB = {
  characters: {},     // id -> キャラ定義（characters.json）
  flavors: [],
  flavorById: {},
  equipment: [],
  equipById: {},
  baito: [],          // バイトの接客イベント（ch1 で使うカテゴリのみ）
  dialogues: {},      // dialogue_id -> dialogue
  glossary: [],
  lime: [],
  recipes: [],
  ngMixes: [],
  tips: [],
  kuji: { meta: {}, grades: {} },
  lover: {},          // 恋人まわりの文面（remake/data/lover.json）
  statusTexts: { statPurpose: {}, statTierFx: {}, customerNotes: [] }, // ステの説明・★効果・常連ノート
  manifest: { portraits: {}, backgrounds: [], cgs: [], faceIcons: [], making: [], bgm: [] },
};

const DIALOGUE_FILES = [
  "ch1_main", "ch1_tournament", "ch1_sumi", "ch1_naru", "ch1_adam", "ch1_minto",
  "ch1_tsumugi", "ch1_rin", "ch1_ageha", "ch1_spots", "ch1_events", "ch1_incognito",
  "confession", "lover_events", // 告白・恋人の節目イベント（正本は旧版と共通）
  "remake_ch1", // リメイク版の進行で使う短い場面（旧版 web/ は読まない）
];
const BAITO_CATEGORIES = new Set(["beginner", "mob", "atmosphere", "regular", "rush", "trouble"]);

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export async function loadAll(onProgress = () => {}) {
  const jobs = [
    ["characters", `${ROOT}data/characters.json`],
    ["flavors", `${ROOT}data/flavors.json`],
    ["equipment", `${ROOT}data/equipment.json`],
    ["baito", `${ROOT}data/baito_events.json`],
    ["glossary", `${ROOT}data/glossary.json`],
    ["lime", `${ROOT}data/lime_messages.json`],
    ["recipes", `${ROOT}data/recipes.json`],
    ["ngMixes", `${ROOT}data/ng_mixes.json`],
    ["tips", `${ROOT}data/loading_tips.json`],
    ["kuji", `${ROOT}data/kuji.json`],
    ["lover", "data/lover.json"],
    ["statusTexts", "data/status_texts.json"],
    ["manifest", "data/manifest.json"],
    ...DIALOGUE_FILES.map((f) => [`dlg:${f}`, `${ROOT}data/dialogue/${f}.json`]),
  ];
  let done = 0;
  const results = await Promise.all(jobs.map(async ([key, path]) => {
    const v = await getJSON(path);
    onProgress(++done / jobs.length);
    return [key, v];
  }));
  const raw = Object.fromEntries(results);

  for (const c of raw.characters) DB.characters[c.id] = c;
  DB.flavors = raw.flavors.flavors.filter((f) => (f.leaf || "blond") === "blond"); // はじめはブロンドのみ（正史）
  DB.flavorById = Object.fromEntries(raw.flavors.flavors.map((f) => [f.id, f]));
  DB.equipment = raw.equipment.equipment;
  DB.equipById = Object.fromEntries(DB.equipment.map((e) => [e.id, e]));
  DB.baito = raw.baito.events.filter((e) => BAITO_CATEGORIES.has(e.category));
  DB.glossary = raw.glossary.groups;
  DB.lime = raw.lime.messages;
  DB.recipes = raw.recipes.recipes;
  DB.ngMixes = raw.ngMixes.ng_mixes;
  DB.tips = raw.tips.tips;
  DB.kuji = raw.kuji;
  DB.lover = raw.lover;
  DB.statusTexts = raw.statusTexts;
  DB.manifest = raw.manifest;
  WEBP = new Set(DB.manifest.webp || []);
  for (const [key, v] of Object.entries(raw)) {
    if (!key.startsWith("dlg:")) continue;
    for (const d of v.dialogues || []) DB.dialogues[d.dialogue_id] = d;
  }
  return DB;
}

// ---------------------------------------------------------------- 名前

// 最初から知っている相手・モブ。それ以外は名乗るまで「？？？」（master_spec #1）
const ALWAYS_KNOWN = new Set([
  "hajime", "sumi", "salaryman", "kako", "rira", "oneesan", "pakki",
  "shop_clerk", "old_man", "customer", "everyone", "staff_choizap", "master_cafe",
]);
// 立ち絵フォルダ・別名（oneesan はみんとの私服＝ura_* 差分）
export const SPEAKER_ALIAS = { tumugi: "tsumugi", hazime: "hajime", takiguchi: "pakki", oneesan: "minto" };

/** characters.json の name からあだ名（短い呼び名）を取り出す（master_spec #8） */
export function realName(id) {
  const c = DB.characters[id];
  if (!c) return id;
  if (c.display_name) return c.display_name;
  const name = c.name || id;
  const outer = name.replace(/（[^）]*）/g, "");
  if (outer.includes(" / ")) return outer.split(" / ")[0].trim();
  const inParen = /（[^）]*\/\s*([^）]+)）/.exec(name);
  if (inParen) return inParen[1].trim();
  return outer.replace(/\s+/g, "").trim();
}

export function displayName(id, state) {
  if (!id) return "";
  if (id === "???") return "？？？";
  if (ALWAYS_KNOWN.has(id) || !state || state.met[id]) return realName(id);
  return "？？？";
}

// ---------------------------------------------------------------- アセット

// 表示用の軽い WebP（remake/img/・tools/build_images.py が作る）。一覧に無い画像は assets/ の PNG を読む
let WEBP = new Set();
/** assets/ からの相対パス（例 "backgrounds/bg_x.png"）→ 実際に読む URL */
export function img(rel) {
  return WEBP.has(rel) ? `img/${rel.replace(/\.png$/, ".webp")}` : `${ROOT}assets/${rel}`;
}

// 旧ファイル名 → 最新版（参照だけ差し替える）
const BG_ALIASES = {
  "tonari_day.png": "bg_tonari_inside_day.png",
  "tonari_night.png": "bg_tonari_inside_night.png",
  "eden.png": "bg_eden_shop.png",
  "bg_adam_shop.png": "bg_eden_shop.png",
  "bg_naru_shop.png": "kemurikusa.png",
  "bg_fookah_showroom.png": "bg_fookah_showroom.png",
};

// 昼夜の差分がある場所（無印・_day は時間帯で切り替える。明示の _night は演出なのでそのまま）
const BG_TIME_BASE = new Set(["bg_tonari_inside", "bg_tonari_outside", "bg_home", "bg_c_station", "bg_cafe", "bg_street"]);
// 窓の無い店内は外光が入らない＝夜も昼の絵のまま（オーナー指定・旧版と同じ）
const BG_NO_NIGHT_TINT = new Set([
  "bg_eden_shop.png", "bg_ageha_shop.png", "bg_ryuji_shop.png", "bg_shop.png", "bg_fookah_showroom.png",
  "bg_hideaway.png", "kemurikusa.png", "peppermint.png", "bg_tournament_stage.png", "bg_c_station_lobby.png",
]);

/**
 * 背景の参照（"res://assets/backgrounds/x.png" / "x.png" / "bg_x"）→ { url, tint }。
 * 昼夜差分があれば時間帯で選び、差分の無い外光のある場所だけ夜に色調補正（tint="night"）を掛ける
 */
export function sceneBg(ref, timeOfDay = "day") {
  if (!ref) return { url: null, tint: null };
  let name = String(ref).split("/").pop();
  if (!name.endsWith(".png")) name += ".png";
  name = BG_ALIASES[name] || name;
  const list = DB.manifest.backgrounds || [];
  const m = /^(.+?)(_day|_night)?\.png$/.exec(name);
  const base = m[1];
  if (BG_TIME_BASE.has(base) && !(m[2] === "_night" && timeOfDay === "day")) {
    const variant = `${base}_${timeOfDay}.png`;
    if (list.includes(variant)) name = variant;
  }
  if (!list.includes(name)) return { url: null, tint: null };
  const tint = timeOfDay === "night" && !name.endsWith("_night.png") && !BG_NO_NIGHT_TINT.has(name) ? "night" : null;
  return { url: img(`backgrounds/${name}`), tint };
}

export const bgUrl = (ref, timeOfDay = "day") => sceneBg(ref, timeOfDay).url;

export function portraitInfo(speaker, face) {
  const folder = SPEAKER_ALIAS[speaker] || speaker;
  const p = DB.manifest.portraits[folder];
  if (!p) return null;
  let f = face || "normal";
  if (speaker === "oneesan") {
    // 私服のみんと＝ura_* 差分。通常差分で代用すると正体が見た目でバレるので、無ければ出さない
    f = `ura_${f}`;
    if (!p.faces.includes(f)) f = "ura_normal";
    if (!p.faces.includes(f)) return null;
  } else if (!p.faces.includes(f)) {
    const near = { excited: "smile", smug: "smile", wink: "smile", evil: "serious", thinking: "serious", intense: "serious" }[f];
    f = near && p.faces.includes(near) ? near : "normal";
  }
  return {
    folder, face: f,
    src: img(`sprites/characters/${folder}/chr_${folder}_${f}.png`),
    h: p.h || 0.85, b: p.b || 0.02, ax: p.ax ?? 0.5, aspect: p.aspect || 0.75,
    scale: DB.characters[folder]?.spriteScale || DB.characters[speaker]?.spriteScale || 1,
  };
}

export function cgUrl(id) {
  return (DB.manifest.cgs || []).includes(`${id}.png`) ? img(`cgs/${id}.png`) : null;
}

export function faceIconUrl(id) {
  const folder = SPEAKER_ALIAS[id] || id;
  return (DB.manifest.faceIcons || []).includes(`face_${folder}.png`) ? `${ROOT}assets/ui/face_icons/face_${folder}.png` : null;
}

export function makingUrl(name) {
  return (DB.manifest.making || []).includes(name) ? img(`ui/making/${name}`) : null;
}

export function bgmUrl(key) {
  const file = `${key}.mp3`;
  return (DB.manifest.bgm || []).includes(file) ? `${ROOT}assets/audio/bgm/${file}` : null;
}

export function assetUrl(rel) {
  return img(rel.replace(/^res:\/\//, "").replace(/^assets\//, ""));
}

/** 画像を先読みする（遷移の前に読み込み待ちを挟んで、白飛び・ちらつきを防ぐ） */
export function preload(urls, timeoutMs = 4000) {
  const list = urls.filter(Boolean);
  return Promise.race([
    Promise.all(list.map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u; }))),
    new Promise((r) => setTimeout(r, timeoutMs)),
  ]);
}
