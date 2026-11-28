// 店番ゲーム（フロア営業）の店舗定義（Issue #4254）。
// tonari・東京 mukai・ドバイ中心地のカフェの差分（卓数・舞台・単価・基本給・難易度・客層・営業の種類・レア来店・評価）を
// このファイル 1 か所の純粋なデータ定義（FLOOR_VENUES）に集約する。
// レイアウト未定の間は全店舗とも stage: "classic"・tableCount: 5（tonari と同じ配置）を暫定で使い、
// 後から専用レイアウトや卓数・単価・基本給を差し替える時も、ここの値を変えるだけで切り替えられるようにする。
import { floorShiftBasePay, floorShiftPay, FLOOR_COMMISSION_PERCENT } from "../core/shift-pay.js";
import {
  PRICE, HAND_SIZE, GUESTS, VISITORS, NIGHTS, RANKS, SERVE_LINES, SEND_LINES,
} from "./tonari-floor-data.js";
import { CHAT_COMMON, CHAT_TONARI, CHAT_MUKAI, CHAT_DUBAI, VISITOR_CHATS } from "./floor-chats.js";

export const FLOOR_RANK_ORDER = Object.freeze(["C", "B", "A", "S"]);

const freezeObj = (obj) => Object.freeze(obj);
const guest = (id, name, party, stay, rank, trait, drinks, look, extra = {}) => Object.freeze({
  id, name: Array.isArray(name) ? Object.freeze(name) : name, party, stay, rank, trait, drinks,
  look: Object.freeze(look),
  ...(extra.prefPool ? { prefPool: Object.freeze(extra.prefPool.map((p) => Object.freeze({ ...p, has: Object.freeze(p.has) }))) } : {}),
  ...(extra.wantRich ? { wantRich: true } : {}),
  ...(extra.callsPerStay ? { callsPerStay: extra.callsPerStay } : {}),
  ...(extra.fastThirsty ? { fastThirsty: true } : {}),
});
const night = (id, title, forecast, length, arrive, cast) => Object.freeze({
  id,
  title: Array.isArray(title) ? Object.freeze(title) : title,
  forecast: Array.isArray(forecast) ? Object.freeze(forecast) : forecast,
  length,
  arrive: Object.freeze(arrive),
  cast: Object.freeze(cast),
});
const visitor = (id, name, chapters, stay, rank, drinks, order, refill, lines, extra = {}) => Object.freeze({
  id, name, chapters: Object.freeze(chapters), stay, rank, drinks,
  ...(extra.requireAffinity === false ? { requireAffinity: false } : {}),
  order: Object.freeze({ ...order, has: Object.freeze(order.has) }),
  refill: Object.freeze({ ...refill, has: Object.freeze(refill.has) }),
  lines: Object.freeze({
    ...lines,
    calls: Object.freeze(Object.fromEntries(Object.entries(lines.calls).map(([k, v]) => [k, Object.freeze(v)]))),
  }),
});

// ---- 共通の既定ルール（tonari 基準） ----
export const TONARI_RULES = Object.freeze({
  tableCount: 5,
  handSize: HAND_SIZE,
  order: 18,
  orderFirst: 30,
  make: Object.freeze([0, 10, 14, 18]),
  slots: 2,
  call: 22,
  callCap: 2,
  callGap: 16,
  coal: 34,
  coalPerLast: 5,
  tendFrom: 0.35,
  drink: 44,
  top: 30,
  billGrace: 16,
  cool: 6,
  lastCall: 40,
  fever: 30,
  feverDrink: 10,
  feverFirstDrink: 3,
  shuffle: 4, // 2秒（0.5秒刻みで4刻み。全店舗で統一）
  shuffleMatchPercent: 78,
  sightAt: 3, // 4回目（level >= 3）から、客の様子を読んで応える
  mood: Object.freeze({
    start: 40, care: 5, careMiss: -8, careLate: -10, tend: 6, tendMiss: -7,
    billDecay: 0.4, wait: 9, decay: 0.07, decayPerLast: 0.2, feverAfter: 10,
  }),
  rateMood: Object.freeze({ best: 90, good: 72, none: 30 }),
  richMood: 4,
  richWantBonus: 0,
  richSingleCut: 0,
  keenCut: Object.freeze({ best: 0, good: 6, none: 4 }),
  feverTargets: 2,
});

// ---- 東京 mukai（第3章・第5章）のデータ ----
const MUKAI_PREF_COFFEE = [
  { wish: "sweet", label: "コーヒー", has: ["coffee", "cappuccino"], quote: "コーヒー系の香り、あるかな" },
  { wish: "deep", label: "紅茶", has: ["black_tea", "absal_earlgrey"], quote: "お茶の葉が立つやつ、頼める？" },
  { wish: "fresh", label: "ミント・柑橘", has: ["mint", "lime", "lemon"], quote: "すっきり抜ける柑橘かミントで" },
];
const MUKAI_PREF_CRITIC = [
  { wish: "deep", label: "スパイス・茶葉", has: ["cardamom", "cinnamon", "black_tea"], quote: "スパイスか茶葉の効いた一台を" },
  { wish: "sweet", label: "ナッツ・ピスタチオ", has: ["hazelnut", "pistachio"], quote: "香ばしいナッツ系で頼むよ" },
  { wish: "fruit", label: "ライム・ベリー", has: ["lime", "blueberry", "raspberry", "cassis"], quote: "酸味のある果実で、一台頼める？" },
];

export const MUKAI_GUESTS = Object.freeze(Object.fromEntries([
  guest("remote", "作業中の方", 1, "long", "plain", null, 2, ["glasses"]),
  guest("office", ["昼休みの会社員", "仕事帰りの会社員"], 1, "short", "plain", null, 1, ["short"]),
  guest("after_work", ["打ち合わせ帰りの方", "同僚連れの方"], 2, "short", "plain", "talker", 2, ["cap", "bob"]),
  guest("coffee_lover", "コーヒー好きの常連", 1, "normal", "keen", null, 2, ["hat"], { prefPool: MUKAI_PREF_COFFEE }),
  guest("new_tokyo", "初めて寄った方", 1, "normal", "plain", "beginner", 1, ["bob"]),
  guest("critic", "シーシャ通の方", 1, "normal", "keen", null, 2, ["bun"], { prefPool: MUKAI_PREF_CRITIC }),
  guest("night_pair", ["街歩きの二人連れ", "夜遊び帰りの方"], 2, "long", "plain", "talker", 3, ["pony", "long"]),
].map((g) => [g.id, g])));

export const MUKAI_NIGHTS = Object.freeze({
  first: night("first", "はじめてのmukai番", "都心の流れは速い。まずは十一人", 340,
    [4, 10, 48, 92, 136, 180, 224, 260],
    ["new_tokyo", "office", "after_work", "coffee_lover", "remote", "after_work", "office", "critic"]),
  usual: night("usual", ["いつもの昼のmukai", "いつもの夜のmukai"], "入れ替わりが速い。十五人ほど", 360,
    [4, 8, 12, 54, 96, 138, 178, 214, 250, 282],
    ["office", "coffee_lover", "after_work", "remote", "critic", "night_pair", "office", "after_work", "new_tokyo", "night_pair"]),
  rush: night("rush", ["昼の波", "仕事帰りの波"], ["短い客が次々に入る", "仕事帰りの客が続けて入る"], 360,
    [4, 8, 12, 46, 82, 118, 152, 186, 218, 250, 278],
    ["after_work", "office", "critic", "office", "after_work", "coffee_lover", "office", "night_pair", "after_work", "critic", "office"]),
  rain: night("rain", ["高架下の雨の昼", "高架下の雨の夜"], "雨宿りの長居と常連が多い", 380,
    [4, 10, 16, 62, 112, 162, 212, 260, 298],
    ["remote", "coffee_lover", "night_pair", "critic", "new_tokyo", "night_pair", "remote", "coffee_lover", "office"]),
  keen_day: night("keen_day", "常連の集まる日", "香りへのこだわりが強い常連が多い", 372,
    [4, 9, 14, 58, 102, 146, 190, 232, 270, 302],
    ["coffee_lover", "critic", "after_work", "coffee_lover", "remote", "critic", "night_pair", "coffee_lover", "critic", "office"]),
  full: night("full", "満席のmukai", "高架下に客足が絶えない", 396,
    [4, 10, 16, 22, 28, 76, 116, 156, 194, 230, 264, 296, 324],
    ["after_work", "critic", "night_pair", "coffee_lover", "office", "after_work", "critic", "remote", "night_pair", "coffee_lover", "after_work", "critic", "office"]),
});

// mukai のレア来店（第3章・第5章）。大会・審査に触れない言葉だけを使う。
// エミルは東京滞在中の一度きりの出会いのため出さず、ましろ・ムカイさんは店の人間なので来店客には入れない。
export const MUKAI_VISITORS = Object.freeze(Object.fromEntries([
  visitor("ayatori", "綾取", [3, 5], "normal", "keen", 1,
    { wish: "deep", label: "アールグレイ", has: ["absal_earlgrey"], quote: "やあ、はじめくん。アールグレイの一台、お願いできる？" },
    { wish: "fruit", label: "柑橘", has: ["frozen_citrus", "lemon", "orange", "lime"], quote: "もう一台だけ。次は柑橘が立つやつを頼むよ" }, {
      best: "ふうん…アールグレイの立ち方、思ったより素直だね", good: "落ち着く香りだ。次はアールグレイも試したいな", off: "おや、今日の気配とは少し違う香りだね",
      calls: {
        thin: { said: "はじめくん、少し煙が細くなってきたみたいだよ", good: "うん、輪郭が戻ってきた。ありがとう" },
        harsh: { said: "ちょっと熱が走りすぎてるかな。少し緩めてくれる？", good: "そうそう、そのくらいの余韻がいいんだ" },
        thirsty: { said: "お水を一杯もらえるかな。口を洗っておきたいんだ", good: "助かるよ。気が利くね" },
      },
      miss: "おっと、僕が頼んだのは別のことだよ", check: "そろそろお会計をお願いしようかな", skip: "じゃあ、続きは次の機会にしようか",
      bye: "楽しかったよ。またふらっと寄るね", byeLow: "ごちそうさま。また今度ね", mad: "忙しそうだね。今日は引き上げるよ",
    }),
  visitor("steve", "スティーブ", [3, 5], "normal", "keen", 2,
    { wish: "fruit", label: "マウンテンミスト", has: ["mountain_mist"], quote: "ヘイ、ハジメ！ マウンテンミストを一台頼むぜ" },
    { wish: "fruit", label: "レモン・ライム", has: ["lime", "lemon"], quote: "いい風だ、ハジメ。次はレモンかライムで頼むよ" }, {
      best: "おおっ、二口目まで軽い！ やるじゃねえかハジメ！", good: "果物の甘みはいいな。次はマウンテンミストも吸いたいぜ", off: "ノー、ノー、俺が頼んだのは柑橘の風だぜ",
      calls: {
        thin: { said: "ヘイ、ハジメ。煙が痩せてきたぜ、炭を見てくれ", good: "オーライ！ ばっちり立ち上がったな" },
        harsh: { said: "ノー、ノー、熱を急ぎすぎだ。炭を下ろしてくれ", good: "よし、これでライムが飛ばずに残るぜ" },
        thirsty: { said: "悪い、ハジメ。冷たい水を一杯もらえるか", good: "サンキュー！ 生き返るぜ" },
      },
      miss: "ノー、ノー、そっちじゃないぜハジメ", check: "よし、会計を頼むぜハジメ", skip: "まあいいさ、次は自店のタイマーも持ってくるよ",
      bye: "いい一台だったぜ！ また来るよハジメ！", byeLow: "ごちそうさん、ハジメ。またな", mad: "混んでるな。また空いた時に顔を出すぜ",
    }),
  visitor("volk", "ヴォルク", [3, 5], "long", "keen", 1,
    { wish: "fresh", label: "ブラストミント", has: ["nightside_blast_mint"], quote: "…はじめ。ブラストミントを一台、頼めるか" },
    { wish: "deep", label: "ブラックティー", has: ["black_tea"], quote: "もう一台。次はブラックティーを頼む" }, {
      best: "…抜ける冷たさに無駄がない。良い精度だ", good: "悪くない。だが、ブラストミントの立ち上がりも見たかった", off: "…注文と系統がずれているな",
      calls: {
        thin: { said: "温度が落ちた。煙量が足りない、炭を見てくれ", good: "…戻ったな。良い手際だ" },
        harsh: { said: "熱が上がりすぎている。少し下げてくれ", good: "うむ。喉への当たりが収まった" },
        thirsty: { said: "水を頼めるか。舌を整えたい", good: "感謝する" },
      },
      miss: "…違う。頼んだ手はそれではない", check: "会計を頼む", skip: "構わない。ここで締めてくれ",
      bye: "良い時間だった。また寄らせてもらう", byeLow: "では、失礼する", mad: "手が回っていないな。出直そう",
    }),
  visitor("yoru", "針間ヨル", [3, 5], "long", "plain", 2,
    { wish: "deep", label: "フルーツティー", has: ["lemon_tea", "black_tea"], quote: "おつかれ、はじめくん。フルーツティーっぽいの、いける？" },
    { wish: "fruit", label: "ピーチ・ベリー", has: ["peach", "blueberry", "raspberry"], quote: "もう一曲いこうか。次はピーチかベリーでお願い" }, {
      best: "いいね、あたし好みのつなぎ方。落ち着くよ", good: "いい香りだね。次はお茶の葉も合わせてみたいな", off: "んー、今日のフロアとはちょっと違うかな",
      calls: {
        thin: { said: "はじめくん、ちょっと音が細いかも。炭、足せる？", good: "うん、厚みが戻った。いいタイミング" },
        harsh: { said: "少し熱が前に出すぎてるかな。炭、逃がして", good: "そう、そのくらいがちょうど気持ちいい" },
        thirsty: { said: "お水もらっていい？ ちょっと喉が渇いた", good: "ありがと、はじめくん。助かるよ" },
      },
      miss: "あはは、あたしが頼んだのは別の方だよ", check: "ごちそうさま、お会計お願いできる？", skip: "いいよいいよ、また次の夜にしよう",
      bye: "気持ちよかったよ。店の方もまた遊びに来てね", byeLow: "今日はこのへんで。またね", mad: "フロアが回ってないね。あたしはまた今度にするよ",
    }, { requireAffinity: false }),
].map((v) => [v.id, v])));

export const MUKAI_RANKS = Object.freeze([
  Object.freeze({ id: "S", stamp: "大入り", min: 88, line: "見事だな、はじめくん。高架下の波を一人で捌ききった" }),
  Object.freeze({ id: "A", stamp: "上々", min: 74, line: "いい動きだったぞ。常連の顔も、ちゃんと見ていたな" }),
  Object.freeze({ id: "B", stamp: "まずまず", min: 56, line: "悪くない。次は、待たせている常連の卓から先に拾え" }),
  Object.freeze({ id: "C", stamp: "ばたばた", min: 0, line: "東京の波は速いからな。まあ、慣れるまで焦るな" }),
]);

// ---- ドバイ中心地のカフェ（第4章・将来の第5章拡張用）のデータ ----
const DUBAI_PREF_LOCAL = [
  { wish: "fresh", label: "ダブルアップル", has: ["double_apple"], quote: "ダブルアップルを、一台頼む" },
  { wish: "fresh", label: "グレープ・ミント", has: ["grape", "ice_grape", "mint"], quote: "グレープとミントの定番で" },
  { wish: "fresh", label: "レモン・ミント", has: ["lemon", "ice_lemon", "lime"], quote: "レモンかライム、すっとするやつを" },
];
const DUBAI_PREF_VIP = [
  { wish: "deep", label: "ローズ・ジャスミン", has: ["rose", "jasmine"], quote: "華やかな花の香りで、丁寧に頼むよ" },
  { wish: "sweet", label: "ピスタチオ・ハニー", has: ["pistachio", "honey"], quote: "ピスタチオか蜂蜜で、コクのある一台を" },
  { wish: "fresh", label: "カルダモン・スパイス", has: ["cardamom", "cinnamon", "double_apple"], quote: "スパイスの奥行きがある一台を頼めるか" },
];

export const DUBAI_GUESTS = Object.freeze(Object.fromEntries([
  guest("traveler", "観光のお客さん", 1, "normal", "plain", "beginner", 2, ["cap"]),
  guest("souq_shopper", "市場帰りの方", 1, "short", "plain", null, 2, ["short"], { fastThirsty: true }),
  guest("local_regular", "現地の常連さん", 1, "normal", "keen", null, 2, ["hat"], { prefPool: DUBAI_PREF_LOCAL }),
  guest("vip", "VIPのお客さん", 1, "long", "keen", null, 3, ["glasses"], { wantRich: true, callsPerStay: 2, prefPool: DUBAI_PREF_VIP }),
  guest("majlis", ["昼下がりの語らい組", "夜の語らい組"], 2, "long", "keen", "talker", 3, ["bun", "long"], { wantRich: true, callsPerStay: 2 }),
  guest("pair_tour", "旅行客の二人連れ", 2, "normal", "plain", "talker", 2, ["pony", "curly"]),
  guest("business", ["商談合間の方", "仕事終わりの方"], 1, "short", "plain", null, 2, ["bob"]),
].map((g) => [g.id, g])));

export const DUBAI_NIGHTS = Object.freeze({
  first: night("first", "ドバイの初シフト", "身振りと様子で読む。まずは十三人", 360,
    [4, 10, 48, 88, 128, 168, 206, 242, 276],
    ["traveler", "local_regular", "pair_tour", "souq_shopper", "business", "majlis", "local_regular", "vip", "pair_tour"]),
  usual: night("usual", "砂漠の街の昼と夜", "日が落ちてから一気ににぎわう。十八人ほど", 380,
    [4, 10, 46, 86, 130, 176, 204, 232, 260, 286, 310],
    ["business", "local_regular", "pair_tour", "souq_shopper", "vip", "majlis", "local_regular", "majlis", "pair_tour", "vip", "local_regular"]),
  heat_day: night("heat_day", "日差しの強い日", "市場帰りで喉が渇いた客が多い", 380,
    [4, 9, 14, 52, 92, 134, 174, 212, 248, 282, 312],
    ["souq_shopper", "traveler", "pair_tour", "souq_shopper", "local_regular", "pair_tour", "souq_shopper", "majlis", "business", "vip", "pair_tour"]),
  festival: night("festival", "にぎやかな夜", "観光と常連が重なって卓が回る", 400,
    [4, 8, 12, 46, 82, 118, 154, 190, 224, 256, 288, 318, 344],
    ["pair_tour", "local_regular", "souq_shopper", "majlis", "business", "pair_tour", "vip", "local_regular", "majlis", "traveler", "pair_tour", "local_regular", "vip"]),
  majlis: night("majlis", "常連とVIPの日", "じっくり吸うこだわりの客が続く", 396,
    [4, 10, 16, 58, 102, 146, 190, 232, 272, 308, 340],
    ["local_regular", "vip", "majlis", "local_regular", "vip", "majlis", "business", "vip", "majlis", "local_regular", "vip"]),
  full: night("full", "満席のグランドナイト", "どの卓も空く間がない。最大のヤマ場", 420,
    [4, 12, 20, 28, 36, 78, 114, 150, 186, 220, 254, 286, 316, 344, 370],
    ["majlis", "vip", "pair_tour", "local_regular", "souq_shopper", "majlis", "vip", "local_regular", "pair_tour", "majlis", "vip", "local_regular", "business", "pair_tour", "vip"]),
});

// ドバイのレア来店。太陽は審査員であることを匂わせず、シェイクは第4章の正体秘匿を守り chapters: [5] のみ。
export const DUBAI_VISITORS = Object.freeze(Object.fromEntries([
  visitor("naru", "なる", [4], "normal", "keen", 1,
    { wish: "sweet", label: "バニラ", has: ["vanilla"], quote: "おい、はじめ。こっちでもバニラの一台、頼めるか" },
    { wish: "sweet", label: "ビスケット・チョコ", has: ["biscuit", "chocolate"], quote: "もう一台付き合えよ。次はビスケットかチョコで頼む" }, {
      best: "…やるな。この街の乾いた空気でも、甘さが逃げない", good: "悪くない甘さだ。バニラはまた別の機会にな", off: "おいおい、甘い菓子系を頼んだだろ",
      calls: {
        thin: { said: "はじめ、煙が軽くなってきた。炭を見てくれ", good: "よし、しっかり甘さが戻ったな" },
        harsh: { said: "ちょっと焼きすぎだ。熱を逃がしてくれ", good: "うん、焦げが引いて吸いやすくなった" },
        thirsty: { said: "悪い、この街は乾くな。水をもらえるか", good: "助かる。気が利くじゃないか" },
      },
      miss: "違う違う、頼んだのはそっちじゃない", check: "よし、会計を頼むよはじめ", skip: "まあいい、宿に戻るよ。会計な",
      bye: "いい息抜きになった。また宿でな", byeLow: "ごちそうさん。無理しすぎるなよ", mad: "すごい混みようだな。また出直すわ",
    }),
  visitor("noor", "ヌール", [4, 5], "normal", "plain", 2,
    { wish: "fresh", label: "ダブルアップル", has: ["double_apple"], quote: "ハジメ、ここで働いてるの？ ダブルアップルを一台お願い！" },
    { wish: "fresh", label: "ライム・ミント", has: ["lime", "mint"], quote: "もう少し涼んでいくね。次はライムかミントがいいな" }, {
      best: "わあ、おいしい！ お父さんの店とはまた違う軽さだね", good: "これもいい香り！ 次はダブルアップルも吸わせてね", off: "あれ、今日はもう少しすっとする方がよかったな",
      calls: {
        thin: { said: "ハジメ、煙が少し少なくなってきたみたい", good: "うん、またしっかり出てきた！ 早いね" },
        harsh: { said: "ちょっと喉に熱いかな。炭、下げてもらえる？", good: "ありがと、これならゆっくり吸えるよ" },
        thirsty: { said: "お水を一杯もらえる？ 外を歩いて喉が渇いちゃって", good: "ありがとうハジメ！ ちょうど欲しかったの" },
      },
      miss: "あれ？ 私、別のことをお願いしたはずだよ", check: "ハジメ、お会計お願いね", skip: "ううん、大丈夫。今日はここまでにするね",
      bye: "楽しかった！ また砂丘の方にも遊びに来てね", byeLow: "ごちそうさま、ハジメ。お疲れさま", mad: "すごく忙しそうだね。また今度ゆっくり来るよ",
    }),
  visitor("da_silva", "太陽", [4, 5], "normal", "keen", 2,
    { wish: "fruit", label: "パッションフルーツ", has: ["passion_fruit"], quote: "オラ、ハジメ！ パッションフルーツで明るくいこうぜ！" },
    { wish: "fruit", label: "マンゴー・パイン", has: ["mango", "pineapple"], quote: "まだまだこれからだ！ 次はマンゴーかパインを頼むぜ" }, {
      best: "ハハッ、最高だ！ 南国の風が吹き抜けるみたいだな！", good: "いい果実だ！ 次はパッションフルーツでも頼むぜ！", off: "おっと、もう少し陽気な果物が欲しかったな",
      calls: {
        thin: { said: "ヘイ、ハジメ、煙の勢いが落ちてきたぞ！ 炭を見てくれ", good: "オッケー、また祭りの煙になったぜ！" },
        harsh: { said: "おっと、ちょっと熱が強いな！ 風を通してくれるか", good: "よし、これで笑顔のまま吸えるぜ！" },
        thirsty: { said: "冷たい水を一杯くれ！ 喋りすぎちまったな", good: "サンキュー！ いい仕事だぜ、ハジメ！" },
      },
      miss: "ハハッ、そっちじゃないぜ、相棒", check: "よし、会計を頼むぜ！", skip: "いいさ、続きはまたFESTAでな！",
      bye: "最高の一杯だったぜ！ また遊びに来るからな！", byeLow: "サンキューな、はじめ。また会おうぜ", mad: "おお、大盛況だな！ また空いてる時に来るぜ！",
    }),
  visitor("master_hookah", "王煙楼", [4, 5], "long", "keen", 2,
    { wish: "deep", label: "ジャスミン", has: ["jasmine"], quote: "…君が立つのか。ジャスミンを一台、頼もう" },
    { wish: "deep", label: "お茶の葉", has: ["black_tea", "absal_earlgrey"], quote: "もう一服いただく。次はお茶の葉が香る一台を" }, {
      best: "…うむ。花の息が澄んでいて、雑味がない", good: "静かな一台だ。次はジャスミンも味わいたいものだな", off: "…今の客が求めた香りを、もう一度確かめなさい",
      calls: {
        thin: { said: "呼吸に対して煙が細い。炭を足しなさい", good: "…よい。息と煙が揃った" },
        harsh: { said: "少し火が勝ちすぎている。熱を引きなさい", good: "うむ。角が取れて穏やかになった" },
        thirsty: { said: "白湯か水を一杯、いただけるかな", good: "かたじけない。よく見ているな" },
      },
      miss: "…急がず、客の求めを見極めなさい", check: "勘定を頼もう", skip: "十分だ。勘定にしてくれ",
      bye: "よい手際を見せてもらった。また寄ろう", byeLow: "ごちそうさま。精進しなさい", mad: "卓が追いついておらんな。また日に改めよう",
    }),
  visitor("sheikh", "シェイク", [5], "long", "keen", 2,
    { wish: "fresh", label: "カルダモン", has: ["cardamom"], quote: "…いい店だな、ハジメ。カルダモンを一台、頼めるか" },
    { wish: "sweet", label: "コーヒー・ハニー", has: ["coffee", "honey"], quote: "もう少し話していこう。次はコーヒーか蜂蜜の一台を" }, {
      best: "…実にいい。スパイスが丸く開いて、余韻まで静かだ", good: "整った一台だ。次はカルダモンも頼もうかな", off: "…今日は少し違う風が欲しかったな",
      calls: {
        thin: { said: "少し煙が細くなってきた。炭を整えてくれるか", good: "…見事だ。香りがまっすぐ戻った" },
        harsh: { said: "熱が少し強いようだ。炭を一つ引いてくれ", good: "ありがとう。穏やかな甘みになった" },
        thirsty: { said: "水を一つもらえるかな", good: "助かるよ。心遣いに感謝する" },
      },
      miss: "…落ち着いていい。私が頼んだのは別のことだ", check: "お会計を頼もうか", skip: "構わないよ。十分にくつろげた",
      bye: "いい時間をもらった。また顔を見せに来るよ", byeLow: "ありがとう、ハジメ。また会おう", mad: "盛況なようだね。また静かな折に寄らせてもらうよ",
    }),
].map((v) => [v.id, v])));

// ドバイの同行恋人（overseasCompanion.companion）が tonari の VISITORS に無い場合の専用定義。
// tonari の VISITORS（tsumugi・minto・ageha・samechan）と合わせて、同行可能な7名全員が来店できる。
export const COMPANION_VISITORS = Object.freeze(Object.fromEntries([
  visitor("mashiro", "ましろ", [4], "long", "keen", 1,
    { wish: "deep", label: "ブラックティー", has: ["black_tea"], quote: "…はじめくん。ブラックティーの、一台お願いできるかなぁ" },
    { wish: "sweet", label: "コーヒー", has: ["coffee", "cappuccino"], quote: "…もう少しここにいるね。次はコーヒーの香りで" }, {
      best: "…ふわぁ、落ち着くねぇ。はじめくんの紅茶、好きだよ", good: "これもやさしいねぇ。次はブラックティーも吸いたいな", off: "…あれぇ、今日は紅茶の気分だったんだけどな",
      calls: {
        thin: { said: "…はじめくん、煙が少し眠たくなっちゃったかも", good: "…うん、ちゃんと起きてきたよ。ありがと" },
        harsh: { said: "…ちょっと熱いかなぁ。炭、少し逃がしてくれる？", good: "…あ、やわらかくなった。これなら吸えるよ" },
        thirsty: { said: "…お水、一杯もらってもいいかなぁ", good: "…ありがと、はじめくん" },
      },
      miss: "…えっとね、僕がお願いしたのは違う方だよぉ", check: "…そろそろお会計にするね", skip: "…うん、またあとで宿で話そっか",
      bye: "…おつかれさま、はじめくん。あとで待ってるね", byeLow: "…無理しないでね、はじめくん", mad: "…すごく混んでるね。外で少し待ってるよ",
    }),
  visitor("hiyori", "ひより", [4], "normal", "plain", 2,
    { wish: "fruit", label: "ピーチ", has: ["peach"], quote: "…はじめくん。ピーチの香りを、一台いただける？" },
    { wish: "deep", label: "紅茶", has: ["lemon_tea", "black_tea", "absal_earlgrey"], quote: "…もう少しだけ。次は紅茶の香りにしようかな" }, {
      best: "…ふふ、甘い桃の香り。なんだかほっとするね", good: "これも素敵だね。次はピーチもお願いしたいな", off: "…あら、今日は少し違う風だったかな",
      calls: {
        thin: { said: "…煙が、消えかけの夢みたいに細くなっちゃった", good: "…よかった、ちゃんと戻ったね" },
        harsh: { said: "…少し喉に強いかも。熱を和らげてもらえる？", good: "…うん、これならずっと吸っていられるよ" },
        thirsty: { said: "…お水を一杯、いただいてもいいかしら", good: "…ありがとう、はじめくん。助かっちゃった" },
      },
      miss: "…うふふ、はじめくん、そっちじゃないみたい", check: "…そろそろお会計をお願いね", skip: "…いいのよ、今日はここまでにしておくね",
      bye: "…頑張ってる姿、見られてよかった。またあとでね", byeLow: "…お疲れさま、はじめくん", mad: "…忙しそうね。私は先に宿へ戻ってるね",
    }),
  visitor("rio", "凛想", [4], "long", "keen", 1,
    { wish: "deep", label: "アールグレイ", has: ["absal_earlgrey"], quote: "お疲れ、モルモットくん。アールグレイの一台、お願い" },
    { wish: "deep", label: "ローズ・ムスク", has: ["rose", "white_musk"], quote: "もう一台だけ。次はローズかムスクでね" }, {
      best: "…ベルガモットの立ち方、きれいね。よく仕上げた", good: "悪くないね。次はアールグレイも試させて", off: "…注文とは別の系統が出たみたいね",
      calls: {
        thin: { said: "煙、少し落ちてきたね。炭を見てくれる？", good: "戻ったね。手際いいじゃない" },
        harsh: { said: "少し熱が勝ってる。炭を引いて", good: "うん、香りが整った" },
        thirsty: { said: "お水、一杯もらえる？", good: "ありがと。よく気が回るね" },
      },
      miss: "…落ち着いて。私が頼んだのは別のことよ", check: "お会計、お願い", skip: "いいよ。ここまでにしよう",
      bye: "いい接客だったよ。仕事が終わったら教えてね", byeLow: "お疲れさま。無理は禁物よ", mad: "ずいぶん混んでるね。またあとにする",
    }),
].map((v) => [v.id, v])));

export const DUBAI_RANKS = Object.freeze([
  Object.freeze({ id: "S", stamp: "大入り", min: 90, line: "見事だ。言葉の壁を越えて、すべての卓を満足させたな" }),
  Object.freeze({ id: "A", stamp: "上々", min: 76, line: "上々の営業だ。忙しい夜でも落ち着いて回せていた" }),
  Object.freeze({ id: "B", stamp: "まずまず", min: 58, line: "悪くない。次はVIPの卓と、待たせている客から先に拾うんだ" }),
  Object.freeze({ id: "C", stamp: "ばたばた", min: 0, line: "この街の夜は速い。だが、まずは一晩やり切ったな" }),
]);

// ---- 店舗の一覧（1か所に集約） ----
export const FLOOR_VENUES = Object.freeze({
  tonari: freezeObj({
    id: "tonari",
    name: "tonari",
    subtitle: "tonari・ワンオペ営業",
    progressFlag: "_tonari_floor",
    stage: "classic",
    bgm: "tonari",
    bg: freezeObj({ day: "res://assets/backgrounds/bg_tonari_inside.png", night: "res://assets/backgrounds/bg_tonari_inside.png" }),
    boss: freezeObj({ id: "sumi", name: "スミ" }),
    currency: "jpy",
    duskLog: "外が暗くなってきた。夜の客が入りはじめる",
    entry: freezeObj({
      slots: 2, stamina: 40, noonOnly: true, dusk: true,
      basePay: null, commissionPercent: FLOOR_COMMISSION_PERCENT, calledBonus: 5000,
    }),
    price: PRICE,
    rules: TONARI_RULES,
    introHints: freezeObj([
      ["order", "客の気分と同じ印のミックスを出す"],
      ["shuffle", "合うのが無ければシャッフル（{shuffle}かかる）"],
      ["add", "炭が減ったら、頼まれる前に調整へ"],
      ["lamp", "フィーバーはもう一度押すと終了。残りは次に使える"],
    ]),
    guests: GUESTS,
    nights: NIGHTS,
    nightPool: freezeObj({
      first: "first", second: "usual", rain: "rain",
      early: freezeObj(["friday", "newcomers", "usual"]),
      late: freezeObj(["friday", "newcomers", "usual", "full"]),
      lateAt: 5,
    }),
    visitors: VISITORS,
    companionVisitors: null,
    ranks: RANKS,
    serveLines: SERVE_LINES,
    sendLines: SEND_LINES,
    // 雑談（TFL68〜70）: どの店でも通る味の話＋その店の客の話。visitorChats＝本編の人物がレアで来た時だけの話（floor-chats.js）
    chats: freezeObj([...CHAT_COMMON, ...CHAT_TONARI]),
    visitorChats: VISITOR_CHATS.tonari,
  }),

  mukai: freezeObj({
    id: "mukai",
    name: "mukai",
    subtitle: "mukai・ワンオペ営業",
    progressFlag: "_mukai_floor",
    stage: "classic", // 暫定で tonari と同じ配置。後から mukai 専用の舞台を追加すれば差し替えられる
    bgm: "tonari",
    bg: freezeObj({ day: "bg_mukai_shop", night: "bg_mukai_shop" }),
    boss: freezeObj({ id: "mukai_master", name: "ムカイ" }),
    currency: "jpy",
    duskLog: "高架下に夜の灯りが点いてきた。仕事帰りの客が入りはじめる",
    entry: freezeObj({
      slots: 1, stamina: 14, noonOnly: false, dusk: false,
      basePay: null, commissionPercent: FLOOR_COMMISSION_PERCENT, calledBonus: 5000,
    }),
    price: PRICE, // 暫定で共通単価（後で店舗別に上書き可能）
    rules: freezeObj({
      ...TONARI_RULES,
      tableCount: 5, // 暫定で5卓（stage: "classic" に合わせる）
      order: 16,
      orderFirst: 22,
      call: 19,
      callCap: 2,
      callGap: 13,
      coal: 30,
      coalPerLast: 4,
      tendFrom: 0.35,
      drink: 42,
      billGrace: 14,
      sightAt: 1, // 2回目から客の様子を読んで応える
      mood: freezeObj({
        ...TONARI_RULES.mood,
        careLate: -12, tendMiss: -9, billDecay: 0.55, wait: 12, decay: 0.085,
      }),
      keenCut: freezeObj({ best: 0, good: 8, none: 6 }),
    }),
    introHints: freezeObj([
      ["order", "常連は好きな系統を名指しすることもある"],
      ["shuffle", "合うのが無ければシャッフル（{shuffle}かかる）"],
      ["add", "都心の波は速い。炭の調整は早めに回る"],
      ["lamp", "ゲージが溜まったらフィーバーで一気に立て直す"],
    ]),
    guests: MUKAI_GUESTS,
    nights: MUKAI_NIGHTS,
    nightPool: freezeObj({
      first: "first", second: "usual", rain: "rain",
      early: freezeObj(["rush", "keen_day", "usual"]),
      late: freezeObj(["rush", "keen_day", "usual", "full"]),
      lateAt: 4,
    }),
    visitors: MUKAI_VISITORS,
    companionVisitors: null,
    ranks: MUKAI_RANKS,
    serveLines: SERVE_LINES,
    sendLines: SEND_LINES,
    chats: freezeObj([...CHAT_COMMON, ...CHAT_MUKAI]),
    visitorChats: VISITOR_CHATS.mukai,
  }),

  dubai: freezeObj({
    id: "dubai",
    name: "中心地のカフェ",
    subtitle: "ドバイ・中心地のカフェ営業",
    progressFlag: "_dubai_floor",
    stage: "classic", // 暫定で tonari と同じ配置。後からドバイ専用の舞台を追加すれば差し替えられる
    bgm: "bgm_dubai",
    bg: freezeObj({ day: "bg_dubai_cafe_day", night: "bg_dubai_cafe_day" }),
    boss: freezeObj({ id: null, name: "支配人" }),
    currency: "aed",
    duskLog: "砂漠の空が暮れてきた。夜の語らいの客が次々に入ってくる",
    entry: freezeObj({
      slots: 2, stamina: 40, noonOnly: true, dusk: true,
      basePay: null, commissionPercent: FLOOR_COMMISSION_PERCENT, calledBonus: 0,
    }),
    price: PRICE, // 暫定で共通単価（後で店舗別に上書き可能）
    rules: freezeObj({
      ...TONARI_RULES,
      tableCount: 5, // 暫定で5卓（stage: "classic" に合わせる）
      slots: 3, // 同時仕込み枠3台で、高い回転に対応する
      order: 14,
      orderFirst: 20,
      call: 17,
      callCap: 3,
      callGap: 11,
      coal: 26,
      coalPerLast: 4,
      tendFrom: 0.30,
      drink: 38,
      billGrace: 12,
      sightAt: 0, // 言葉の壁があるため、初回から身振り・様子を読んで応える
      mood: freezeObj({
        ...TONARI_RULES.mood,
        careLate: -14, tendMiss: -11, billDecay: 0.70, wait: 14, decay: 0.10,
      }),
      richWantBonus: 6, // VIP・語らい組に3種ミックスが合うと大きく加点
      richSingleCut: 8, // VIP・語らい組に単品を出すと減点
      keenCut: freezeObj({ best: 0, good: 10, none: 8 }),
    }),
    introHints: freezeObj([
      ["order", "言葉の壁がある。客の様子と印を見て応える"],
      ["cook", "ここは同時に3台まで仕込める。VIPには3種ミックスが効く"],
      ["shuffle", "合うのが無ければシャッフル（{shuffle}かかる）"],
      ["add", "乾いた空気で炭と喉が早い。早めの調整と給水が鍵"],
    ]),
    guests: DUBAI_GUESTS,
    nights: DUBAI_NIGHTS,
    nightPool: freezeObj({
      first: "first", second: "usual", rain: null,
      early: freezeObj(["heat_day", "festival", "majlis", "usual"]),
      late: freezeObj(["heat_day", "festival", "majlis", "usual", "full"]),
      lateAt: 4,
    }),
    visitors: DUBAI_VISITORS,
    companionVisitors: freezeObj({ ...VISITORS, ...COMPANION_VISITORS }),
    ranks: DUBAI_RANKS,
    serveLines: SERVE_LINES,
    sendLines: SEND_LINES,
    chats: freezeObj([...CHAT_COMMON, ...CHAT_DUBAI]),
    visitorChats: VISITOR_CHATS.dubai,
  }),
});

export const FLOOR_VENUE_IDS = Object.freeze(Object.keys(FLOOR_VENUES));

/**
 * 店舗定義を返す。ID 文字列でも、検査・拡張用のカスタム店舗オブジェクト（tonari を土台に上書き）でも受けられる。
 */
export function floorVenue(venueOrId = "tonari") {
  if (!venueOrId) return FLOOR_VENUES.tonari;
  if (typeof venueOrId === "string") return FLOOR_VENUES[venueOrId] || FLOOR_VENUES.tonari;
  const base = FLOOR_VENUES[venueOrId.id] || FLOOR_VENUES.tonari;
  return {
    ...base,
    ...venueOrId,
    entry: { ...base.entry, ...(venueOrId.entry || {}) },
    price: { ...base.price, ...(venueOrId.price || {}) },
    rules: {
      ...base.rules,
      ...(venueOrId.rules || {}),
      mood: { ...base.rules.mood, ...(venueOrId.rules?.mood || {}) },
      rateMood: { ...base.rules.rateMood, ...(venueOrId.rules?.rateMood || {}) },
      keenCut: { ...base.rules.keenCut, ...(venueOrId.rules?.keenCut || {}) },
    },
  };
}

/** 店舗・章ごとの基本給（暫定は全店舗共通で shift-pay.js の FLOOR_SHIFT_BASE を参照。店舗別上書きも可）。 */
export function floorVenueBasePay(venueOrId = "tonari", chapter = 1) {
  const v = floorVenue(venueOrId);
  const custom = v.entry?.basePay;
  if (typeof custom === "number") return custom;
  if (Array.isArray(custom) && custom.length) return custom[Math.min(Math.max(1, chapter), custom.length) - 1] ?? custom[0];
  return floorShiftBasePay(chapter);
}

/** 店舗の歩合の率（%）。bonus＝心得の盤の「売り上手」（K28。SBD157）で足すポイント。 */
export function floorVenueCommissionPercent(venueOrId = "tonari", bonus = 0) {
  const v = floorVenue(venueOrId);
  return (v.entry?.commissionPercent ?? FLOOR_COMMISSION_PERCENT) + Math.max(0, Number(bonus) || 0);
}

/** 店舗・章ごとの日当計算（基本給＋売上の歩合10%＋手当）。bonus＝歩合に足すポイント（売り上手）。 */
export function floorVenueShiftPay(venueOrId = "tonari", chapter = 1, sales = 0, allowances = 0, bonus = 0) {
  const v = floorVenue(venueOrId);
  const pct = v.entry?.commissionPercent ?? FLOOR_COMMISSION_PERCENT;
  if (v.entry?.basePay == null && pct === FLOOR_COMMISSION_PERCENT) return floorShiftPay(chapter, sales, allowances, bonus);
  const base = floorVenueBasePay(v, chapter);
  const commission = Math.floor(sales * floorVenueCommissionPercent(v, bonus) / 100);
  return { base, commission, allowances, total: base + commission + allowances };
}

/** メニュー・説明用の日当表記（「基本給12,000円＋売上の10%」）。bonus＝歩合に足すポイント（売り上手）。 */
export function floorVenuePayText(venueOrId = "tonari", chapter = 1, bonus = 0) {
  const v = floorVenue(venueOrId);
  return `基本給${floorVenueBasePay(v, chapter).toLocaleString("ja-JP")}円＋売上の${floorVenueCommissionPercent(v, bonus)}%`;
}

/** 店舗ごとの来店者定義を引く（ドバイの同行恋人を含む）。 */
export function resolveVenueVisitor(venueOrId, visitorId) {
  if (!visitorId) return null;
  const v = floorVenue(venueOrId);
  return v.visitors?.[visitorId] || v.companionVisitors?.[visitorId] || null;
}

/** 店舗ごとの進み具合（回した回数・最高評価・店のファン合計・売上自己ベスト）を読む。 */
export function floorVenueProgress(state, venueOrId = "tonari") {
  const v = floorVenue(venueOrId);
  const saved = state?.flags?.[v.progressFlag];
  return {
    nights: Number.isInteger(saved?.nights) && saved.nights > 0 ? saved.nights : 0,
    best: saved?.best || null,
    fans: Number.isInteger(saved?.fans) && saved.fans > 0 ? saved.fans : 0,
    top: Number.isInteger(saved?.top) && saved.top > 0 ? saved.top : 0,
  };
}

/** 店舗ごとの進み具合を更新する（中断・フォールバックでは呼ばない）。 */
export function recordFloorVenueProgress(state, venueOrId, result) {
  if (!state?.flags || !result || result.fallback) return null;
  const v = floorVenue(venueOrId);
  const progress = floorVenueProgress(state, v);
  const best = FLOOR_RANK_ORDER.indexOf(result.rank) > FLOOR_RANK_ORDER.indexOf(progress.best) ? result.rank : progress.best;
  const next = {
    nights: progress.nights + 1,
    best,
    fans: Math.max(0, progress.fans + (Number.isInteger(result.fans) ? result.fans : 0)),
    top: Math.max(progress.top, Number.isInteger(result.sales) ? result.sales : 0),
  };
  state.flags[v.progressFlag] = next;
  return next;
}

/**
 * 店舗ごとのレア来店を抽選する（5回に1回＋心得の盤 floorRare）。
 * はじめての営業には来ない。面識・好感度1以上（requireAffinity: false の人物は面識のみ）・章の条件を守る。
 * ドバイでは extraVisitorIds（同行中の恋人）も来店候補に加える。
 */
export function floorVenueVisitor(owner, venueOrId, seed, nights, bonus = 0, { affinityLevel = () => 0, extraVisitorIds = [] } = {}) {
  if (nights < 1 || !owner) return null;
  const v = floorVenue(venueOrId);
  const seen = new Set();
  const able = [];
  for (const who of Object.values(v.visitors || {})) {
    if (!who.chapters.includes(owner.chapter)) continue;
    const met = who.id === "yoru" ? !!(owner.met?.yoru || owner.flags?._club_yoru_first_done) : !!owner.met?.[who.id];
    if (!met) continue;
    if (who.requireAffinity !== false && affinityLevel(who.id) < 1) continue;
    seen.add(who.id);
    able.push(who.id);
  }
  for (const id of extraVisitorIds || []) {
    if (!id || seen.has(id)) continue;
    const who = v.companionVisitors?.[id];
    if (!who) continue;
    seen.add(id);
    able.push(id);
  }
  if (!able.length) return null;
  const roll = ((seed >>> 5) ^ Math.imul((owner.day || 0) + 1, 0x9e3779b1)) >>> 0;
  return roll % 100 < 20 + bonus ? able[(roll >>> 8) % able.length] : null;
}
