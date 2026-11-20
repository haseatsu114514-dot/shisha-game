// tonari フロア営業の台本（単価・気分・フレーバー・ミックス・客・ケア・夜の種類・評価）。ルールは tonari-floor-model.js、画面は tonari-floor-view.js。
// 遊びの形（2026-11-20 オーナー）: 一人で店を回す。客は「フルーツ系が吸いたい」のように気分を言うだけで、
// 提供は、並んでいるミックスの一覧から選ぶ（原作の、キャストを卓に着ける所にあたる。一覧はシャッフルできる）。
// お金はすべて店のもの。はじめの所持金には入らない（日当と売上ボーナスは tonari.js が渡す）。
// 原価・仕入れ・利益は扱わない（「ただ満足させて売上をいかに上げるかのゲームにする」。東京編・ドバイ編のバイトでも同じ遊びを使う）。

// 単価（2026-11-20 オーナー指定）: 基本（シーシャ一台）2,000円・チャージ700円（ひとり）・
// トップ替え（おかわり）が入ると＋1,500円・ドリンクは1杯600円（初回の1杯は必ず注文。追加は居心地しだい）。
export const PRICE = Object.freeze({ shisha: 2000, charge: 700, top: 1500, drink: 600 });

/**
 * 客の気分（どんな一台が吸いたいか）。原作の「見た目のタイプ」にあたり、ミックスごとに ◎○△× の合い方がある。
 * id はフレーバーの系統と同じ。say＝客が吹き出しで言う言葉（台詞なので句点で終えない）。
 */
export const WISHES = Object.freeze([
  Object.freeze({ id: "fruit", label: "フルーティ", color: "#ff8f6b", say: Object.freeze(["フルーツ系が吸いたいな", "果物っぽいのが吸いたいです"]) }),
  Object.freeze({ id: "sweet", label: "スイート", color: "#f7a8d8", say: Object.freeze(["お菓子系が吸いたい", "甘いのが吸いたい気分です"]) }),
  Object.freeze({ id: "fresh", label: "リフレッシュ", color: "#7fd8e8", say: Object.freeze(["さっぱりしたのが吸いたいな", "すっきりしたい気分です"]) }),
  Object.freeze({ id: "deep", label: "リラックス", color: "#b9a6ff", say: Object.freeze(["まったりできるのがいいな", "落ち着くのが吸いたいです"]) }),
]);
export const WISH_IDS = Object.freeze(WISHES.map((w) => w.id));

// 店の棚のフレーバー（30種）。ミックスの材料。family＝系統（＝気分）、also＝半分だけ寄与する系統（柑橘や茶葉でさっぱり感を出す、など）、
// tags＝香りの札（今は表示だけ）、traits＝[味・香り, チル, 爆煙, 持続性]（0〜3。持続性は、炭の調整の間隔に効く）。
const flavor = (id, label, family, also, tags, traits) => Object.freeze({
  id, label, family, also: Object.freeze(also), tags: Object.freeze(tags), traits: Object.freeze(traits),
});
export const FLAVORS = Object.freeze(Object.fromEntries([
  // フルーツ系（10）
  flavor("apple", "ダブルアップル", "fruit", ["deep"], ["classic", "spice"], [3, 1, 2, 3]),
  flavor("grape", "グレープ", "fruit", [], ["juicy", "classic"], [2, 1, 3, 2]),
  flavor("peach", "ピーチ", "fruit", [], ["juicy", "sweet"], [3, 2, 2, 1]),
  flavor("mango", "マンゴー", "fruit", [], ["juicy", "sweet"], [3, 1, 2, 2]),
  flavor("berry", "ベリーミックス", "fruit", [], ["juicy"], [2, 1, 3, 1]),
  flavor("lychee", "ライチ", "fruit", ["fresh"], ["juicy", "light"], [2, 2, 1, 1]),
  flavor("lemon", "レモン", "fruit", ["fresh"], ["citrus"], [2, 1, 2, 1]),
  flavor("grapefruit", "グレープフルーツ", "fruit", ["fresh"], ["citrus"], [2, 2, 1, 2]),
  flavor("orange", "オレンジ", "fruit", [], ["citrus", "juicy"], [3, 1, 2, 1]),
  flavor("pine", "パイン", "fruit", [], ["juicy", "sweet"], [2, 1, 3, 1]),
  // スッキリ・清涼系（6）
  flavor("mint", "ミント", "fresh", [], ["mint"], [1, 2, 3, 2]),
  flavor("ice", "アイス", "fresh", [], ["mint"], [0, 2, 3, 3]),
  flavor("lime", "ライム", "fresh", ["fruit"], ["citrus"], [2, 2, 1, 1]),
  flavor("eucalyptus", "ユーカリ", "fresh", [], ["mint", "herb"], [1, 3, 2, 2]),
  flavor("lemongrass", "レモングラス", "fresh", [], ["herb", "citrus"], [2, 3, 1, 2]),
  flavor("guava", "グァバミント", "fresh", ["fruit"], ["mint", "juicy"], [2, 2, 2, 1]),
  // 甘系・スイーツ系（7）
  flavor("vanilla", "バニラ", "sweet", [], ["cream", "sweet"], [2, 3, 2, 2]),
  flavor("caramel", "キャラメル", "sweet", [], ["dessert", "sweet"], [3, 2, 1, 3]),
  flavor("chocolate", "チョコレート", "sweet", ["deep"], ["dessert", "sweet", "heavy"], [3, 2, 1, 3]),
  flavor("milk", "ミルク", "sweet", [], ["cream"], [1, 3, 3, 1]),
  flavor("honey", "ハニー", "sweet", [], ["sweet"], [2, 3, 1, 2]),
  flavor("pistachio", "ピスタチオ", "sweet", [], ["nut", "cream"], [3, 2, 1, 2]),
  flavor("cookie", "クッキー", "sweet", [], ["dessert", "nut", "sweet"], [3, 2, 2, 2]),
  // 茶葉・フローラル・スパイス系（7）
  flavor("earlgrey", "アールグレイ", "deep", ["fresh"], ["tea", "citrus"], [3, 3, 1, 2]),
  flavor("jasmine", "ジャスミン", "deep", ["fresh"], ["tea", "floral", "light"], [2, 3, 1, 1]),
  flavor("chai", "チャイ", "deep", ["sweet"], ["tea", "spice"], [3, 2, 1, 3]),
  flavor("rose", "ローズ", "deep", [], ["floral"], [3, 2, 1, 2]),
  flavor("hinoki", "ヒノキ", "deep", [], ["heavy", "herb"], [2, 3, 1, 3]),
  flavor("cardamom", "カルダモン", "deep", [], ["spice"], [3, 1, 2, 3]),
  flavor("cinnamon", "シナモン", "deep", ["sweet"], ["spice", "sweet"], [3, 1, 2, 3]),
].map((f) => [f.id, f])));

// ミックスの一覧（店で出せる一台）。営業中は、この中から HAND_SIZE 個が並び、選んで出す。出すと次の一つが補充され、シャッフルで全部を入れ替えられる。
// 気分との合い方（◎○△×）は、材料の系統から決まる（model の mixRatings）。name を省くと、材料の名前をつなげる。
const mix = (id, flavors, name = null) => Object.freeze({ id, flavors: Object.freeze(flavors), name });
export const MIXES = Object.freeze(Object.fromEntries([
  mix("lemonmint", ["lemon", "mint"]), mix("peachvanilla", ["peach", "vanilla"]), mix("apple", ["apple"]), mix("milktea", ["earlgrey", "milk"], "ミルクティー"),
  mix("grapemint", ["grape", "mint"]), mix("mangomilk", ["mango", "milk"]), mix("berryice", ["berry", "ice"], "ベリーアイス"), mix("orangemint", ["orange", "mint"]),
  mix("chai", ["chai", "cinnamon"]), mix("lycheerose", ["lychee", "rose"]), mix("pinemint", ["pine", "mint"]), mix("caramelmilk", ["caramel", "milk"]),
  mix("limemint", ["lime", "mint"]), mix("jasminepeach", ["jasmine", "peach"]), mix("chocomint", ["chocolate", "mint"], "チョコミント"), mix("honeylemon", ["honey", "lemon"]),
  mix("vanillacookie", ["vanilla", "cookie"]), mix("pistachiomilk", ["pistachio", "milk"]), mix("hinokijasmine", ["hinoki", "jasmine"]), mix("rosejasmine", ["rose", "jasmine"]),
  mix("cardamomchai", ["cardamom", "chai"]), mix("guava", ["guava"]), mix("eucalyptusmint", ["eucalyptus", "mint"]), mix("lemongrasslime", ["lemongrass", "lime"], "ハーブライム"),
  mix("icemint", ["ice", "mint"]), mix("grapeberry", ["grape", "berry"], "グレープベリー"), mix("mangoorange", ["mango", "orange"]), mix("cinnamonapple", ["cinnamon", "apple"], "シナモンアップル"),
  mix("chocovanilla", ["chocolate", "vanilla"], "チョコバニラ"), mix("honeymilk", ["honey", "milk"]), mix("earllemon", ["earlgrey", "lemon"], "レモンティー"), mix("peachice", ["peach", "ice"]),
  mix("peachmango", ["peach", "mango"]), mix("pineorange", ["pine", "orange"]),
].map((m) => [m.id, m])));
/** 一度に並ぶミックスの数。 */
export const HAND_SIZE = 5;

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
// たまに遊びに来る、本編の人物（2026-11-20 オーナー「好感度1以上の人物がたまにレアで遊びに来たりとかも入れたい」）。
// 来る条件（顔見知り・好感度1以上・章）は tonari.js が決める。ここは気分と台詞だけ。台詞は大会の前後どちらでも通る言葉にする（交流の時系列ルール）。
// 好感度は動かさない。chapters＝来てよい章、wish＝気分。
const visitor = (id, name, chapters, stay, rank, drinks, wish, quote, lines) => Object.freeze({ id, name, chapters: Object.freeze(chapters), stay, rank, drinks, wish, quote, lines: Object.freeze(lines) });
export const VISITORS = Object.freeze(Object.fromEntries([
  visitor("tsumugi", "つむぎ", [1, 2], "long", "plain", 1, "deep", "……はじめさん。落ち着くのを、お願いします", {
    best: "……やわらかい色、です。好きです、これ", good: "……落ち着きます。ありがとうございます", off: "……少し、にぎやかな色、ですね", bye: "……ごちそうさまでした。また、描きに来ます" }),
  visitor("naru", "なる", [1], "normal", "keen", 1, "sweet", "よう、はじめ。甘いやつ、頼むわ", {
    best: "……うまいな。焼き菓子みたいだ", good: "いいじゃん。ちゃんと甘い", off: "ん、甘いのを頼んだんだけどな", bye: "ごちそうさん。また来るわ" }),
  visitor("adam", "アダム", [1, 2], "normal", "keen", 1, "fruit", "……はじめよ。今日は、果実の煙を頼む", {
    best: "……よい。果実が、まっすぐ立っている", good: "……悪くない", off: "……これは、果実ではない", bye: "……また来る" }),
].map((v) => [v.id, v])));

export const RANK_LABEL = Object.freeze({ plain: "一般", keen: "こだわり" });

// ケア（温度調整・接客）の言葉は固定の5つ。並びを変えない（押す位置を手が覚える）。
export const VERBS = Object.freeze([
  Object.freeze({ id: "add", label: "炭を替える", note: "熱を足す" }),
  Object.freeze({ id: "ease", label: "炭を下ろす", note: "熱を逃がす" }),
  Object.freeze({ id: "water", label: "お水を出す", note: "無料のサービス" }),
  Object.freeze({ id: "teach", label: "吸い方を案内する", note: "ペースを伝える" }),
  Object.freeze({ id: "chat", label: "雑談する", note: "感想を聞く" }),
]);

// ケアの種類（客からの頼み）。label は卓の札の短い言葉、sight は様子を読む夜（!だけ出る夜）の一文、said は言葉で伝わる夜の一言、
// good は正しく応えた時、verb が正解。炭の調整は、頼まれる前に自分から行く（model の「調整」）。放っておくと thin か harsh で頼まれる。
export const CALLS = Object.freeze({
  thin: Object.freeze({ verb: "add", label: "煙が薄い", said: "あの、煙が薄くなってきたみたいで",
    sight: "煙が細い。ホースを見て、首をかしげている。", good: "うん、しっかり出てきた" }),
  harsh: Object.freeze({ verb: "ease", label: "熱を下げて", said: "すみません、少し熱いかも。熱、下げてもらえますか",
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
  best: Object.freeze(["うん、これ。こういうのが吸いたかった", "わ、ぴったり。よく分かりましたね", "そうそう、こういうのです"]),
  good: Object.freeze(["うん、いいですね", "あ、こういうのもいいかも", "おいしい。ありがとう"]),
  ok: Object.freeze(["うん、悪くないね", "思ってたのと少し違うけど、おいしい"]),
  off: Object.freeze(["少し、思っていたのと違うかも……", "あれ、今日の気分とは違うような……"]),
});
/** 会計・おかわりの一言。 */
export const SEND_LINES = Object.freeze({
  extend: Object.freeze(["居心地いいから、もう一台いきたいな", "おかわり、お願いできますか？"]),
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

/**
 * 満足（居心地）の5段階。min＝内部値の下限。color＝顔の印の色、face＝顔の印（tonari-floor-art.js の記号）。
 * 顔の印は、◎ ○ △ の形の中に顔を描く（2026-11-20 オーナー「◎○△の中に顔を描いたりとか」）: 大満足＝◎／満足＝○／普通＝△／不満＝▽／激怒＝◇。
 */
export const MOODS = Object.freeze([
  Object.freeze({ id: "max", label: "大満足", min: 85, color: "#ffd84d", face: "moodMax" }),
  Object.freeze({ id: "good", label: "満足", min: 65, color: "#9fe08a", face: "moodGood" }),
  Object.freeze({ id: "ok", label: "普通", min: 40, color: "#e8dcc4", face: "moodOk" }),
  Object.freeze({ id: "low", label: "不満", min: 20, color: "#7fb2e6", face: "moodLow" }),
  Object.freeze({ id: "mad", label: "激怒", min: 0, color: "#ef6a5a", face: "moodMad" }),
]);

/** 営業の評価。min＝全組の満足の平均。bonus＝店からの売上ボーナス（チップではない）。 */
export const RANKS = Object.freeze([
  Object.freeze({ id: "S", stamp: "大入り", min: 88, bonus: 1500, line: "文句なしだ。一人で、店じゅうをいい顔にして帰した" }),
  Object.freeze({ id: "A", stamp: "上々", min: 74, bonus: 1000, line: "いい営業だった。卓の様子が、よく見えていたぞ" }),
  Object.freeze({ id: "B", stamp: "まずまず", min: 56, bonus: 500, line: "回せてはいた。次は、待たせている卓から先に見ろ" }),
  Object.freeze({ id: "C", stamp: "ばたばた", min: 0, bonus: 0, line: "ばたついたな。まあ、一人で回せば最初はこうだ" }),
]);
