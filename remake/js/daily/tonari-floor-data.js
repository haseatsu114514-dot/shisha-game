// tonari フロア営業の台本（単価・フレーバー・客・注文・ケア・夜の種類・評価）。ルールは tonari-floor-model.js、画面は tonari-floor-view.js。
// 2026-11-20 オーナーの「シーシャ経営ミニゲーム システム・UI設計仕様書」（ワンオペ＆30種フレーバー調合型）に合わせた形。
// お金はすべて店のもの。はじめの所持金には入らない（日当と売上ボーナスは tonari.js が渡す）。

// 単価（2026-11-20 オーナー指定）: 基本（シーシャ一台）2,000円・チャージ700円（ひとり）・
// トップ替え（おかわり＝延長）が入ると＋1,500円・ドリンクは1杯600円（初回の1杯は必ず注文。追加は居心地しだい）。
export const PRICE = Object.freeze({ shisha: 2000, charge: 700, top: 1500, drink: 600 });
/** 原価とサービス費。炭は一台・トップ替えごと、ショップカードは渡した枚数。フレーバーの原価は FLAVORS の cost。 */
export const COST = Object.freeze({ coal: 120, card: 100 });

/** 吸い心地の4特性（卓の札の帯の色にも使う）。 */
export const TRAITS = Object.freeze([
  Object.freeze({ id: "taste", label: "味・香り", short: "香り", color: "#b592ff" }),
  Object.freeze({ id: "chill", label: "チル", short: "チル", color: "#7fd39a" }),
  Object.freeze({ id: "cloud", label: "爆煙", short: "爆煙", color: "#f0c060" }),
  Object.freeze({ id: "last", label: "持続性", short: "持続", color: "#8fd6ff" }),
]);
export const TRAIT_IDS = Object.freeze(TRAITS.map((t) => t.id));

/** フレーバーの4大系統（棚のタブの並び）。 */
export const FAMILIES = Object.freeze([
  Object.freeze({ id: "fruit", label: "フルーツ系", tab: "フルーツ" }),
  Object.freeze({ id: "fresh", label: "スッキリ系", tab: "スッキリ" }),
  Object.freeze({ id: "sweet", label: "甘系", tab: "甘" }),
  Object.freeze({ id: "deep", label: "重め・スパイス系", tab: "茶葉・スパイス" }),
]);
export const FAMILY_LABEL = Object.freeze(Object.fromEntries(FAMILIES.map((f) => [f.id, f.label])));

export const TAG_LABEL = Object.freeze({
  mint: "ミント・清涼", citrus: "柑橘", juicy: "ジューシー", classic: "王道", herb: "ハーブ", sweet: "甘い", cream: "クリーム",
  dessert: "デザート", nut: "ナッツ", tea: "紅茶・茶葉", floral: "フローラル", spice: "スパイス", heavy: "重め", light: "軽め",
});

// 店の棚のフレーバー（30種）。family＝系統、also＝半分だけ寄与する系統（柑橘や茶葉でスッキリ感を出す、など）、
// tags＝特性タグ（相性とNGの判定に使う）、traits＝[味・香り, チル, 爆煙, 持続性]（0〜3）、cost＝1回使う原価。
const flavor = (id, label, family, also, tags, traits, cost) => Object.freeze({
  id, label, family, also: Object.freeze(also), tags: Object.freeze(tags), traits: Object.freeze(traits), cost,
});
export const FLAVORS = Object.freeze(Object.fromEntries([
  // フルーツ系（10）
  flavor("apple", "ダブルアップル", "fruit", ["deep"], ["classic", "spice"], [3, 1, 2, 3], 110),
  flavor("grape", "グレープ", "fruit", [], ["juicy", "classic"], [2, 1, 3, 2], 90),
  flavor("peach", "ピーチ", "fruit", [], ["juicy", "sweet"], [3, 2, 2, 1], 90),
  flavor("mango", "マンゴー", "fruit", [], ["juicy", "sweet"], [3, 1, 2, 2], 100),
  flavor("berry", "ベリーミックス", "fruit", [], ["juicy"], [2, 1, 3, 1], 90),
  flavor("lychee", "ライチ", "fruit", ["fresh"], ["juicy", "light"], [2, 2, 1, 1], 100),
  flavor("lemon", "レモン", "fruit", ["fresh"], ["citrus"], [2, 1, 2, 1], 80),
  flavor("grapefruit", "グレープフルーツ", "fruit", ["fresh"], ["citrus"], [2, 2, 1, 2], 90),
  flavor("orange", "オレンジ", "fruit", [], ["citrus", "juicy"], [3, 1, 2, 1], 80),
  flavor("pine", "パイン", "fruit", [], ["juicy", "sweet"], [2, 1, 3, 1], 90),
  // スッキリ・清涼系（6）
  flavor("mint", "ミント", "fresh", [], ["mint"], [1, 2, 3, 2], 70),
  flavor("ice", "アイス", "fresh", [], ["mint"], [0, 2, 3, 3], 60),
  flavor("lime", "ライム", "fresh", ["fruit"], ["citrus"], [2, 2, 1, 1], 80),
  flavor("eucalyptus", "ユーカリ", "fresh", [], ["mint", "herb"], [1, 3, 2, 2], 100),
  flavor("lemongrass", "レモングラス", "fresh", [], ["herb", "citrus"], [2, 3, 1, 2], 100),
  flavor("guava", "グァバミント", "fresh", ["fruit"], ["mint", "juicy"], [2, 2, 2, 1], 100),
  // 甘系・スイーツ系（7）
  flavor("vanilla", "バニラ", "sweet", [], ["cream", "sweet"], [2, 3, 2, 2], 90),
  flavor("caramel", "キャラメル", "sweet", [], ["dessert", "sweet"], [3, 2, 1, 3], 100),
  flavor("chocolate", "チョコレート", "sweet", ["deep"], ["dessert", "sweet", "heavy"], [3, 2, 1, 3], 110),
  flavor("milk", "ミルク", "sweet", [], ["cream"], [1, 3, 3, 1], 80),
  flavor("honey", "ハニー", "sweet", [], ["sweet"], [2, 3, 1, 2], 90),
  flavor("pistachio", "ピスタチオ", "sweet", [], ["nut", "cream"], [3, 2, 1, 2], 120),
  flavor("cookie", "クッキー", "sweet", [], ["dessert", "nut", "sweet"], [3, 2, 2, 2], 110),
  // 茶葉・フローラル・スパイス系（7）
  flavor("earlgrey", "アールグレイ", "deep", ["fresh"], ["tea", "citrus"], [3, 3, 1, 2], 110),
  flavor("jasmine", "ジャスミン", "deep", ["fresh"], ["tea", "floral", "light"], [2, 3, 1, 1], 110),
  flavor("chai", "チャイ", "deep", ["sweet"], ["tea", "spice"], [3, 2, 1, 3], 110),
  flavor("rose", "ローズ", "deep", [], ["floral"], [3, 2, 1, 2], 120),
  flavor("hinoki", "ヒノキ", "deep", [], ["heavy", "herb"], [2, 3, 1, 3], 130),
  flavor("cardamom", "カルダモン", "deep", [], ["spice"], [3, 1, 2, 3], 120),
  flavor("cinnamon", "シナモン", "deep", ["sweet"], ["spice", "sweet"], [3, 1, 2, 3], 100),
].map((f) => [f.id, f])));

// 相性のいい組み合わせ（タグ同士）。二つのフレーバーが、片方ずつのタグを持つと成立する。
export const SYNERGIES = Object.freeze([
  ["citrus", "mint"], ["tea", "cream"], ["juicy", "spice"], ["citrus", "sweet"], ["dessert", "nut"],
  ["floral", "juicy"], ["tea", "citrus"], ["cream", "juicy"], ["classic", "mint"], ["tea", "spice"],
].map((pair) => Object.freeze(pair)));

// NG の言い方ごとの、避けるタグ。
export const NG = Object.freeze({
  mint: Object.freeze({ tags: Object.freeze(["mint"]), label: "ミント無し", said: "ミント無しで" }),
  sweet: Object.freeze({ tags: Object.freeze(["sweet", "cream", "dessert"]), label: "甘いの無し", said: "甘いのは抜きで" }),
  heavy: Object.freeze({ tags: Object.freeze(["heavy", "spice"]), label: "重いの無し", said: "重たいのは抜きで" }),
  citrus: Object.freeze({ tags: Object.freeze(["citrus"]), label: "酸っぱいの無し", said: "酸っぱいのは抜きで" }),
});

// 注文の言葉の部品（客の台詞なので、句点で終えない）。
export const ORDER_WORDS = Object.freeze({
  family: Object.freeze({ fruit: "フルーツ系", fresh: "スッキリ系", sweet: "甘い系", deep: "紅茶やスパイスの系統" }),
  trait: Object.freeze({ taste: "香りがしっかり立つの", chill: "ゆったり落ち着けるの", cloud: "煙しっかりめ", last: "長くもつの" }),
  omakase: Object.freeze({
    taste: "今日はおまかせで。香りのいいのをお願いします",
    chill: "今日はおまかせで！ なんか落ち着く感じでよろしく",
    cloud: "おまかせします。煙がもくもく出るやつがいいな",
    last: "おまかせで。ゆっくり長く吸えるのがいいです",
  }),
  // 指定フレーバー＋仕上げの向き
  finish: Object.freeze({ fruit: "果物っぽく", fresh: "爽やかに", sweet: "少し甘めに", deep: "落ち着いた感じに" }),
});

// 店の定番ミックスの初期（はじめが覚えている4つ）。定番は最大8枠。保存は flags._tonari_floor.presets。
export const PRESET_MAX = 8;
export const STARTER_PRESETS = Object.freeze([["lemon", "mint"], ["peach", "vanilla"], ["apple"], ["earlgrey", "milk"]].map((m) => Object.freeze(m)));

/** 提供してからの滞在（1刻み＝店内0.5秒相当）。 */
export const STAY = Object.freeze({ short: 56, normal: 76, long: 100 });
export const STAY_LABEL = Object.freeze({ short: "ショート", normal: "ふつう", long: "ロング" });

// 名もない客。常連帳・好感度は作らない（#1267）。rank＝要求の高さ（"plain" 一般 / "keen" こだわり）、
// trait＝"beginner"（吸い方の案内が要る）/ "talker"（雑談を好む）、drinks＝追加ドリンクの上限。
// name が [昼, 夜] の客は、シフトの時間帯で呼び名が変わる。
const guest = (id, name, party, stay, rank, trait, drinks, look) => Object.freeze({ id, name, party, stay, rank, trait, drinks, look: Object.freeze(look) });
export const GUESTS = Object.freeze(Object.fromEntries([
  guest("first", "初めての方", 1, "normal", "plain", "beginner", 1, ["bob"]),
  guest("worker", ["仕事の合間の方", "仕事帰りの方"], 1, "short", "plain", null, 1, ["short"]),
  guest("train", ["昼休みの二人", "終電前の二人"], 2, "short", "plain", "talker", 1, ["cap", "long"]),
  guest("reader", "読書の方", 1, "long", "plain", null, 2, ["glasses"]),
  guest("walkers", "散歩帰りの二人", 2, "long", "plain", "talker", 2, ["pony", "short"]),
  guest("nose", "香り好きの方", 1, "normal", "keen", null, 2, ["bun"]),
  guest("students", "学生の二人", 2, "normal", "plain", "beginner", 1, ["curly", "cap"]),
  guest("talkers", "話し込む二人", 2, "normal", "plain", "talker", 2, ["long", "bob"]),
  guest("elder", "年配の方", 1, "long", "keen", null, 2, ["hat"]),
  guest("friends", "友だち同士の二人", 2, "long", "plain", "talker", 3, ["bun", "pony"]),
].map((g) => [g.id, g])));
/** 客層ごとの、吸い心地の要求水準（ミックスの特性値がこれ以上なら満点）。 */
export const DEMAND = Object.freeze({ plain: 2, keen: 2.5 });
export const RANK_LABEL = Object.freeze({ plain: "一般", keen: "こだわり" });

// ケア（温度調整・接客）の言葉は固定の5つ。並びを変えない（押す位置を手が覚える）。
export const VERBS = Object.freeze([
  Object.freeze({ id: "add", label: "炭を替える", note: "熱を足す" }),
  Object.freeze({ id: "ease", label: "炭を下ろす", note: "熱を逃がす" }),
  Object.freeze({ id: "water", label: "お水を出す", note: "無料のサービス" }),
  Object.freeze({ id: "teach", label: "吸い方を案内する", note: "ペースを伝える" }),
  Object.freeze({ id: "chat", label: "雑談する", note: "感想を聞く" }),
]);

// ケアの種類。label は卓の札の短い言葉、sight は様子を読む夜（!だけ出る夜）に出す一文、said は言葉で伝わる夜の一言。
// good は正しく応えた時、verb が正解。coal は定期の温度調整（炭の経過）。
export const CALLS = Object.freeze({
  coal: Object.freeze({ verb: "add", label: "炭の時間", said: "（炭が小さくなってきた。そろそろ替え時だ）",
    sight: "炭が白く小さくなっている。煙はまだ出ているが、細くなってきた。", good: "あ、戻ってきた。ありがとう" }),
  thin: Object.freeze({ verb: "add", label: "煙が薄い", said: "あの、煙が薄くなってきたみたいで",
    sight: "煙が細い。ホースを見て、首をかしげている。", good: "うん、しっかり出てきた" }),
  harsh: Object.freeze({ verb: "ease", label: "焦げっぽい", said: "すみません、少し焦げっぽいかも",
    sight: "眉を寄せて、ホースをそっと置いた。煙は濃い。", good: "うん、やわらかくなった" }),
  thirsty: Object.freeze({ verb: "water", label: "喉が渇いた", said: "ふう……少し喉が渇いてきたな",
    sight: "喉に手をやって、小さく咳払いをした。グラスは空だ。", good: "ありがとう。気が利きますね" }),
  cough: Object.freeze({ verb: "teach", label: "むせている", said: "けほっ……これ、吸い方合ってます？",
    sight: "深く吸いこみすぎて、むせている。", good: "なるほど、ゆっくり吸えばいいんですね" }),
  chatty: Object.freeze({ verb: "chat", label: "話したそう", said: "これ、おいしいですね。何を混ぜてるんですか？",
    sight: "こちらを見て、目が合うとにこっと笑った。", good: "へえ、そうなんだ。また頼もうかな" }),
});
/** 外した時の一言（ケアごとに分けない。責めない言い方にする）。 */
export const CALL_MISS = "えっと、そうじゃなくて……";

/** 提供した時の一言。 */
export const SERVE_LINES = Object.freeze({
  best: Object.freeze(["うん、これ。この香りが欲しかった", "わ、ぴったり。よく分かりましたね", "そうそう、こういうのです"]),
  good: Object.freeze(["うん、いいですね", "あ、こういうのもいいかも", "おいしい。ありがとう"]),
  ok: Object.freeze(["うん、悪くないね", "思ってたのと少し違うけど、おいしい"]),
  off: Object.freeze(["少し、思っていた香りと違うかも……", "あれ、頼んだのと違うような……"]),
  ng: Object.freeze(["あ、これ……抜いてって言ったの、入ってません？"]),
});
/** 会計・延長の一言。 */
export const SEND_LINES = Object.freeze({
  extend: Object.freeze(["居心地いいから、もう少し吸っていきたいな", "トップ替え、お願いできますか？"]),
  card: "へえ、カード。また来ますね",
  cardLow: "……どうも",
  bye: Object.freeze(["ごちそうさま。また来ます", "いい時間でした。ありがとう"]),
  byeLow: "……ごちそうさま",
  mad: "もういいです。帰ります",
});

// 営業の種類（一回のシフト）。arrive＝来店の刻み（卓が空いていなければ、空くまで待ってから入る）、cast＝客の並び。
// title・forecast が [昼, 夜] のものは時間帯で変わる。回した回数（level）で、注文の種類とケアの見せ方が変わる（model）。
const night = (id, title, forecast, length, arrive, cast) => Object.freeze({ id, title, forecast, length, arrive: Object.freeze(arrive), cast: Object.freeze(cast) });
export const NIGHTS = Object.freeze({
  first: night("first", "はじめてのワンオペ", "客足はゆっくり。まずは五組", 320, [4, 10, 70, 130, 190],
    ["first", "worker", "train", "reader", "worker"]),
  usual: night("usual", ["いつもの昼", "いつもの夜"], "いつもどおり。七組ほど", 360, [4, 9, 14, 80, 130, 180, 230],
    ["first", "reader", "train", "walkers", "worker", "nose", "talkers"]),
  friday: night("friday", ["昼休みの波", "終電前の夜"], ["昼休みの短い客が続く", "終電までの短い客が続く"], 360, [4, 8, 12, 60, 100, 140, 180, 220, 260],
    ["train", "worker", "talkers", "worker", "students", "train", "nose", "worker", "first"]),
  rain: night("rain", ["雨の昼下がり", "雨の夜"], "雨で、長居の客が多い", 372, [4, 9, 14, 70, 130, 190, 240],
    ["reader", "walkers", "elder", "first", "friends", "worker", "talkers"]),
  newcomers: night("newcomers", "初めてさんの日", "初めての客が多い", 360, [4, 9, 14, 70, 120, 170, 220, 260],
    ["first", "students", "first", "reader", "students", "worker", "first", "train"]),
  full: night("full", "満席の日", "卓がずっと埋まりそうだ", 384, [4, 7, 10, 13, 16, 80, 120, 160, 200, 240, 270],
    ["train", "nose", "walkers", "worker", "friends", "students", "elder", "train", "talkers", "worker", "reader"]),
});
/** [昼, 夜] で分かれる言葉を、シフトの時間帯で選ぶ。 */
export const byTime = (value, daytime) => (Array.isArray(value) ? value[daytime ? 0 : 1] : value);

/** 満足（居心地）の5段階。min＝内部値の下限。色は顔アイコンの色。 */
export const MOODS = Object.freeze([
  Object.freeze({ id: "max", label: "大満足", min: 85, color: "#b592ff", face: "smile" }),
  Object.freeze({ id: "good", label: "満足", min: 65, color: "#f0b64e", face: "smile" }),
  Object.freeze({ id: "ok", label: "普通", min: 40, color: "#7fd39a", face: "flat" }),
  Object.freeze({ id: "low", label: "不満", min: 20, color: "#6fb0e8", face: "frown" }),
  Object.freeze({ id: "mad", label: "激怒", min: 0, color: "#ef7f6a", face: "frown" }),
]);

/** 営業の評価。min＝全組の満足の平均。bonus＝店からの売上ボーナス（チップではない）。 */
export const RANKS = Object.freeze([
  Object.freeze({ id: "S", stamp: "大入り", min: 88, bonus: 1500, line: "文句なしだ。一人で、店じゅうをいい顔にして帰した" }),
  Object.freeze({ id: "A", stamp: "上々", min: 74, bonus: 1000, line: "いい営業だった。卓の様子が、よく見えていたぞ" }),
  Object.freeze({ id: "B", stamp: "まずまず", min: 56, bonus: 500, line: "回せてはいた。次は、待たせている卓から先に見ろ" }),
  Object.freeze({ id: "C", stamp: "ばたばた", min: 0, bonus: 0, line: "ばたついたな。まあ、一人で回せば最初はこうだ" }),
]);
