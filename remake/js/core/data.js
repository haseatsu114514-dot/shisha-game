// データローダとアセット解決。
// 正本は リポジトリの data/*.json（台詞・キャラ・フレーバー等）。リメイク版はそれを
// 実行時に fetch するだけで、書き換えも二重コピーもしない。
// ページは remake/index.html なので、リポジトリ直下は "../"。

import { portraitStyle } from "./portrait-style.js";
import { resolvePortrait } from "./portrait-resolver.js";
import { registerFortuneReadings } from "./fortune-effects.js";

const ROOT = "../";
// 章の追加台本は必要になった時だけ読み、起動や他章の通信を増やさない。
export const CHAPTER_DIALOGUE_FILES = { ch2Tournament: "ch2_tournament", cityGuests: "ch2_city_guests", ch4Staff: "ch4_staff_work" };
// データローダは状態モジュールを読み込まない。天気側が表示用の読み取り関数を登録する。
let backgroundWeather = () => null;
export function setBackgroundWeatherSource(source) { backgroundWeather = source; }

/** 読み込んだ全データ。起動時に loadAll()、タイトル後に後段ローダが埋める */
export const DB = {
  characters: {},     // id -> キャラ定義（characters.json）
  samechan: {},         // シーシャークの会話・店
  fortuneTrivia: {},
  fortuneHints: {},
  hiyori: {},         // 登場方法が決まるまで無効のルート定義と、表示確認用台本
  flavors: [],
  flavorById: {},
  equipment: [],
  equipById: {},
  baito: [],          // バイトの接客イベント（ch1 で使うカテゴリのみ）
  dialogues: {},      // dialogue_id -> dialogue
  relationshipMemories: {}, // 実際に読んだ交流の記憶（id -> 記録）
  glossary: [],
  lime: [],
  limeTemplates: {}, // 配信条件と動的IDを持たない、実行時の文面雛形

  recipes: [],
  ngMixes: [],
  kuji: { meta: {}, grades: {} },
  lover: {},          // 恋人まわりの文面（remake/data/lover.json）
  friends: { friends: {} }, // 友人になった相手からの、たまのLIME・一服の場面（remake/data/friends.json）
  casualLime: { people: {} }, // ♥3〜4の知り合いからの、たまの読むだけの雑談（remake/data/casual_lime.json）
  statusTexts: { statPurpose: {}, statTierFx: {} }, // ステの説明・★効果
  broadcast: { nico: {}, step: {}, mc: {}, rivalFeed: [], ticker: {} }, // 大会の実況コメント（remake/data/broadcast.json）
  manifest: { portraits: {}, backgrounds: [], cgs: [], faceIcons: [], making: [], bgm: [] },
  gallery: { items: [] }, // 採用済み漫画・ムービー。候補画像はここへ登録しない。
};

const DIALOGUE_FILES = [
  "ch1_main", "ch1_tournament", "ch1_sumi", "ch1_naru", "ch1_adam", "ch1_minto",
  "ch1_tsumugi", "ch1_rio", "ch1_ageha", "ch1_spots", "ch1_events", "ch1_incognito",
  "confession", "lover_events", // 告白・恋人の節目イベント（正本は旧版と共通）
  "remake_ch1", // リメイク版の進行で使う短い場面（旧版 web/ は読まない）
  "ch1_interval",
  "ch1_bonds", // 交友の締めくくり（好感度MAX）と途中の恋愛／友情の質問（daily/bonds.js）
  "samechan", // 帰り道の出会いと、章2からのシーシャーク
  "craft_inner_voice", // 自主練の作業中・工程終了後のはじめの内心
  "venue_hours", // 店主の案内と街の昼夜差分
  "axe_bar_discovery", // BARの噂と、正式な初対面とは独立した匿名目撃
  "growth_reflection", // 心得の盤: 参拝の場所での内省と大会前夜の内省（SPEC 2.8）
  "growth_lessons", // 心得の盤: 授業（はじめが相談して話を聞く場面。SPEC 2.6）
  "chapter_poems", // 巻頭ポエム（序詩と第1〜5章の章頭詩。brand/chant_poems.md・scenes/chapter-poem.js）
];
// ひよりの参照先は DB.hiyori.route が無い間 disabled に倒れるため、タイトル後に読める。
const DEFERRED_DIALOGUE_FILES = ["hiyori"];
// 映画館と大会制作会話はタイトル後に先読みし、各入口でも完了を待つ。
const CINEMA_DIALOGUE_FILE = "cinema";
const TOURNAMENT_CRAFT_DIALOGUE_FILE = "tournament_craft";
const BAITO_CATEGORIES = new Set(["beginner", "mob", "atmosphere", "regular", "rush", "trouble"]);
const JSON_TIMEOUT_MS = 15000;
const JSON_CONCURRENCY = 4;

async function getJSON(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JSON_TIMEOUT_MS);
  try {
    const res = await fetch(path, { cache: "no-cache", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json(); // 本文の受信もタイムアウトの対象にする
  } catch (e) {
    const reason = controller.signal.aborted
      ? "読み込みが15秒でタイムアウトしました"
      : e?.message || String(e);
    throw new Error(`${path}: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

let deferredDialoguesPromise;
export function loadDeferredDialogues() {
  if (!deferredDialoguesPromise) {
    deferredDialoguesPromise = Promise.all(DEFERRED_DIALOGUE_FILES.map((file) =>
      getJSON(`${ROOT}data/dialogue/${file}.json`).then((data) => [file, data])
    )).then((files) => {
      for (const [file, data] of files) {
        if (file === "hiyori") DB.hiyori = data;
        for (const d of data.dialogues || []) DB.dialogues[d.dialogue_id] = d;
      }
      return DB;
    }).catch((error) => {
      deferredDialoguesPromise = null; // 先読み失敗後は次の呼び出しで再試行できる
      throw error;
    });
  }
  return deferredDialoguesPromise;
}

function dialogueLoader(file) {
  let promise;
  return () => {
    if (!promise) {
      promise = getJSON(`${ROOT}data/dialogue/${file}.json`).then((data) => {
        for (const d of data.dialogues || []) DB.dialogues[d.dialogue_id] = d;
        return DB;
      }).catch((error) => {
        promise = null; // 先読み失敗後は入口から再試行できる
        throw error;
      });
    }
    return promise;
  };
}

export const loadCinemaDialogue = dialogueLoader(CINEMA_DIALOGUE_FILE);
export const loadTournamentCraftDialogue = dialogueLoader(TOURNAMENT_CRAFT_DIALOGUE_FILE);

export async function loadAll(onProgress = () => {}) {
  globalThis.performance?.setResourceTimingBufferSize?.(1000);
  const jobs = [
    ["characters", `${ROOT}data/characters.json`],
    ["relationshipMemories", `${ROOT}data/relationship_memories.json`],
    ["flavors", `${ROOT}data/flavors.json`],
    ["equipment", `${ROOT}data/equipment.json`],
    ["baito", `${ROOT}data/baito_events.json`],
    ["glossary", `${ROOT}data/glossary.json`],
    ["lime", `${ROOT}data/lime_messages.json`],
    ["recipes", `${ROOT}data/recipes.json`],
    ["ngMixes", `${ROOT}data/ng_mixes.json`],
    ["kuji", `${ROOT}data/kuji.json`],
    ["lover", "data/lover.json"],
    ["friends", "data/friends.json"],
    ["casualLime", "data/casual_lime.json"],
    ["statusTexts", "data/status_texts.json"],
    ["broadcast", "data/broadcast.json"],
    ["manifest", "data/manifest.json"],
    ["gallery", "data/gallery.json"],
    ["fortuneTrivia", "data/fortune-trivia.json"],
    ["fortuneHints", "data/fortune-choice-hints.json"],
    ...DIALOGUE_FILES.map((f) => [`dlg:${f}`, `${ROOT}data/dialogue/${f}.json`]),
  ];
  let done = 0;
  const results = [];
  // ローカルサーバーの接続待ちを溢れさせない。失敗したら次の組は開始しない。
  for (let start = 0; start < jobs.length; start += JSON_CONCURRENCY) {
    const batch = await Promise.all(jobs.slice(start, start + JSON_CONCURRENCY).map(async ([key, path]) => {
      const v = await getJSON(path);
      onProgress(++done / jobs.length);
      return [key, v];
    }));
    results.push(...batch);
  }
  const raw = Object.fromEntries(results);

  for (const c of raw.characters) DB.characters[c.id] = c;
  DB.samechan = raw["dlg:samechan"] || {};
  DB.hiyori = raw["dlg:hiyori"] || {};
  DB.relationshipMemories = Object.fromEntries(raw.relationshipMemories.memories.map((m) => [m.id, m]));
  DB.flavors = raw.flavors.flavors.filter((f) => (f.leaf || "blond") === "blond"); // はじめはブロンドのみ（正史）
  DB.flavorById = Object.fromEntries(raw.flavors.flavors.map((f) => [f.id, f]));
  DB.equipment = raw.equipment.equipment;
  DB.equipById = Object.fromEntries(DB.equipment.map((e) => [e.id, e]));
  DB.baito = raw.baito.events.filter((e) => BAITO_CATEGORIES.has(e.category));
  DB.glossary = raw.glossary.groups;
  DB.lime = raw.lime.messages;
  DB.limeTemplates = raw.lime.templates;
  DB.recipes = raw.recipes.recipes;
  DB.ngMixes = raw.ngMixes.ng_mixes;
  DB.kuji = raw.kuji;
  DB.lover = raw.lover;
  DB.friends = raw.friends;
  DB.casualLime = raw.casualLime;
  DB.statusTexts = raw.statusTexts;
  DB.broadcast = raw.broadcast;
  DB.fortuneTrivia = raw.fortuneTrivia;
  DB.fortuneHints = raw.fortuneHints;
  DB.manifest = raw.manifest;
  DB.gallery = raw.gallery;
  WEBP = new Set(DB.manifest.webp || []);
  for (const [key, v] of Object.entries(raw)) {
    if (!key.startsWith("dlg:")) continue;
    for (const d of v.dialogues || []) DB.dialogues[d.dialogue_id] = d;
  }
  registerFortuneReadings(DB);
  return DB;
}

// ---------------------------------------------------------------- 名前

// 最初から知っている相手・モブ。それ以外は名乗るまで「？？？」（master_spec #1）
const ALWAYS_KNOWN = new Set([
  "hajime", "sumi", "tsumugi", "salaryman", "oneesan", "pakki",
  "shop_clerk", "old_man", "customer", "everyone", "staff_choizap", "master_cafe",
  "spice_merchant", "cafe_staff", "traveler",
  "tetsuko", // mukai の看板猫。地の文で最初から名前で呼ぶ
]);
// 立ち絵フォルダ・別名（oneesan はみんとの私服＝ura_* 差分）
export const SPEAKER_ALIAS = { tumugi: "tsumugi", hazime: "hajime", oneesan: "minto" };

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

/**
 * 名前欄・ログ・LIME などに出す名前。
 * @param opts.context "private"＝仕事を離れた私的な場面（会話の metadata.private_scene・LIME）。
 *   みんとは本人から本名を聞いた後（_minto_name_known）の私的な場面だけ private_name（栞）。
 *   店・大会など営業の場面と、名乗る前は「みんと」のまま（私服を見ただけで本名を出さない）
 */
export function displayName(id, state, { context = null } = {}) {
  if (!id) return "";
  if (id === "???") return "？？？";
  if (id === "oneesan" && state?.flags?._minto_identity_revealed) {
    return state.flags._minto_name_known ? DB.characters.minto?.private_name || "栞" : "みんと";
  }
  if (id === "samechan") {
    if (state?.flags?._samechan_name_known) return DB.characters.samechan?.full_name || realName(id);
    if (state?.flags?._samechan_nickname_known || state?.flags?._lime_contact_samechan || state?.contacts?.includes("samechan")
      || state?.limeRead?.includes("lime_naru_samechan_nickname")) return "サメちゃん";
    return "？？？";
  }
  if (id === "minto" && context === "private" && state?.flags?._minto_name_known && DB.characters.minto?.private_name) {
    return DB.characters.minto.private_name;
  }
  if (ALWAYS_KNOWN.has(id) || !state || state.met[id]) return realName(id);
  return "？？？";
}

/** 地の文・内心で呼ぶときの名前（私的な場面のみんとは「栞さん」）。それ以外は表示名と同じ */
export function callName(id, state, opts = {}) {
  const name = displayName(id, state, opts);
  return id === "minto" && name === DB.characters.minto?.private_name ? `${name}さん` : name;
}

// ---------------------------------------------------------------- アセット

// 表示用の軽い WebP（remake/img/・tools/build_images.py が作る）。一覧に無い画像は assets/ の PNG を読む
let WEBP = new Set();
// #983で採用した顔修正を、同名URLに残った旧画像のキャッシュと区別する。
// 2026-10-28: #1081 I03 でみんと通常を斜め向きへ復元したため revision を更新。
// 2026-11-02: 立ち絵の規格（TS09）でみんと営業姿の頭を私服の大きさへ作り直したため revision を更新。
const FACE_CORRECTION_REVISION = "portrait-standard-20261102";
function faceCorrectionVersion(rel) {
  return /^(sprites\/characters\/(minto\/chr_minto_normal|ageha\/chr_ageha_[a-z]+)\.png|ui\/face_icons\/face_(minto|ageha)\.png)$/.test(rel)
    ? `?v=${FACE_CORRECTION_REVISION}` : "";
}
/**
 * 本編の読み込み（loadAll）を通らない単体のページ（一台勝負の試遊ページなど）が、manifest だけを読み込んで使うとき。
 * DB.manifest だけを差し替えると WebP の一覧が空のままで、img() が元の PNG を指してしまう（顔アイコンが出ない）ので、一緒にそろえる
 */
export function useManifest(manifest) {
  DB.manifest = manifest;
  WEBP = new Set(manifest.webp || []);
}
/** assets/ からの相対パス（例 "backgrounds/bg_x.png"）→ 実際に読む URL */
export function img(rel) {
  const url = WEBP.has(rel) ? `img/${rel.replace(/\.png$/, ".webp")}` : `${ROOT}assets/${rel}`;
  return url + faceCorrectionVersion(rel);
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
const BG_TIME_BASE = new Set(["bg_tonari_inside", "bg_tonari_outside", "bg_home", "bg_c_station", "bg_cafe", "bg_street", "bg_kannon", "bg_choizap", "bg_tokyo_park", "bg_mukai_backdoor"]); // bg_mukai_backdoor: てつこといっしょの裏口（TKT01・未着。届くまでは sceneBg が null を返し、画面は bg_street に戻る）
// 窓の無い店内は外光が入らない＝夜も昼の絵のまま（オーナー指定・旧版と同じ）
// bg_ageha_shop.png は 2026-11-12 に窓から昼の光が入る絵へ描き直した（#3282 B7）ので、ここから外した（夜は色調補正が掛かる）。
const BG_NO_NIGHT_TINT = new Set([
  "bg_rojiura_cinema.png",
  "bg_rojiura_cinema_space.png", "bg_rojiura_cinema_monster.png", "bg_rojiura_cinema_detective.png",
  "bg_eden_shop.png", "bg_ryuji_shop.png", "bg_shop.png", "bg_fookah_showroom.png",
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
  // 曇り・雨は同じ曇天画。雨粒は既存weatherレイヤーだけが描く。
  // 差分の用意された場所だけ切り替え、未制作の場所は従来の絵を維持する。
  const weather = backgroundWeather();
  if (weather === "cloud" || weather === "rain") {
    const overcast = name.replace(/_(day|night)\.png$/, "_overcast_$1.png");
    if (list.includes(overcast)) name = overcast;
  }
  const tint = timeOfDay === "night" && !name.endsWith("_night.png") && !BG_NO_NIGHT_TINT.has(name) ? "night" : null;
  return { url: img(`backgrounds/${name}`), tint };
}

export const bgUrl = (ref, timeOfDay = "day") => sceneBg(ref, timeOfDay).url;

export function portraitInfo(speaker, face, style = portraitStyle()) {
  const resolved = resolvePortrait(DB.manifest, speaker, face, style);
  if (!resolved) return null;
  const { folder } = resolved;
  return {
    ...resolved, src: img(resolved.rel),
    scale: (resolved.style === "new" ? DB.characters[folder]?.spriteScaleVariants?.new : null)
      || DB.characters[folder]?.spriteScale || DB.characters[speaker]?.spriteScale || 1,
  };
}

export function cgUrl(id) {
  return (DB.manifest.cgs || []).includes(`${id}.png`) ? img(`cgs/${id}.png`) : null;
}

/** ギャラリー一覧用サムネイル（元CGの WebP から生成した縮小版・最大512px） */
export function cgThumbUrl(id) {
  return (DB.manifest.cgs || []).includes(`${id}.png`) ? `img/cgs/thumbs/${id}.webp` : null;
}

/**
 * 顔ドット絵アイコン。名前欄と同じ条件で、本名を聞いた後の私的な場面のみんと（栞）は私服の顔
 * （face_minto_private）。私服の「お姉さん」も、営業姿の顔で正体が見た目に出ないよう私服の顔にする
 */
export function faceIconUrl(id, state = null, { context = null, style = portraitStyle() } = {}) {
  const privateMinto = id === "oneesan" || (id === "minto" && context === "private" && state?.flags?._minto_name_known);
  const folder = SPEAKER_ALIAS[id] || id;
  const rel = faceIconRel(privateMinto ? "face_minto_private.png" : `face_${folder}.png`, style);
  return rel ? img(rel) : null;
}

/**
 * 設定の「会話の立ち絵」の画風に合わせた顔アイコン（assets/ からの相対パス）。
 * 新バージョンを選んでいて、その人の新バージョンの顔アイコンがあればそれ（立ち絵と同じ絵から作ったもの）。
 * 無い人（新バージョンの立ち絵が無い人）は、会話でも現行の絵になるので現行の顔アイコン（2026-11-06）
 */
function faceIconRel(name, style) {
  if (style !== "classic" && (DB.manifest.faceIconVariants?.[style] || []).includes(name)) return `ui/face_icons/${style}/${name}`;
  return (DB.manifest.faceIcons || []).includes(name) ? `ui/face_icons/${name}` : null;
}

/**
 * 顔アイコンと同じ顔の枠（tools/make_face_icons.py の frames()。立ち絵 896×1200 の画素）。
 * { box: [x0, y0, 辺], eye: [頬の中央 x, 目の高さ y], unit: 顔の大きさ }。その画風で測っていなければ null
 */
export function faceFrame(folder, style = "classic") {
  return DB.manifest.faceFrames?.[style]?.[folder] || null;
}

/** 顔アイコンの全URL（起動時の先読み用）。今の画風で出すものを読む */
export function allFaceIconUrls(style = portraitStyle()) {
  return (DB.manifest.faceIcons || []).map((f) => img(faceIconRel(f, style)));
}

export function makingUrl(name) {
  return (DB.manifest.making || []).includes(name) ? img(`ui/making/${name}`) : null;
}

export function bgmUrl(key) {
  const files = DB.manifest.bgm || [];
  const file = [`${key}.bgm`, `${key}.mp3`].find((name) => files.includes(name));
  if (file) return `${ROOT}assets/audio/bgm/${file}`;
  // 単独の試遊ページは全データを読まない。そこで使う既知の4曲だけ解決する。
  if (["bgm_camel_race", "bgm_ethnic05", "bgm_ethnic08", "bgm_ethnic12"].includes(key))
    return `${ROOT}assets/audio/bgm/${key}.bgm`;
  return null;
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
