// tonari フロア営業の台本（単価・気分・フレーバー・ミックス・客・ケア・夜の種類・評価）。ルールは tonari-floor-model.js、画面は tonari-floor-view.js。
// 遊びの形（2026-11-20 オーナー）: 一人で店を回す。客は「フルーツ系が吸いたい」のように気分を言うだけで、
// 提供は、並んでいるミックスの一覧から選ぶ（原作の、キャストを卓に着ける所にあたる。一覧はシャッフルできる）。
// お金はすべて店のもの。はじめの所持金には入らない（日当と売上ボーナスは tonari.js が渡す）。
// 原価・仕入れ・利益は扱わない（「ただ満足させて売上をいかに上げるかのゲームにする」。東京編・ドバイ編のバイトでも同じ遊びを使う）。

// 単価（2026-11-20 オーナー指定）: 基本（シーシャ一台）2,000円・チャージ700円（ひとり）・
// トップ替え（おかわり）が入ると＋1,500円・ドリンクは1杯600円（初回の1杯は必ず注文。追加は居心地しだい）。
export const PRICE = Object.freeze({ shisha: 2000, charge: 700, top: 1500, drink: 600 });

/**
 * 客の気分（どんな一台が吸いたいか）＝ミックスの属性。原作の「見た目のタイプ」にあたり、ミックスごとにメイン（◎）とサブ（○）がある。
 * id は既存の属性キー。say＝客が吹き出しで言う言葉（台詞なので句点で終えない）。
 */
export const WISHES = Object.freeze([
  Object.freeze({ id: "fruit", label: "フルーティ", color: "#ff8f6b", say: Object.freeze(["フルーツ系が吸いたいな", "果物っぽいのが吸いたいです"]) }),
  Object.freeze({ id: "sweet", label: "スイート", color: "#f7a8d8", say: Object.freeze(["お菓子系が吸いたい", "甘いのが吸いたい気分です"]) }),
  Object.freeze({ id: "fresh", label: "刺激系", color: "#7fd8e8", say: Object.freeze(["ピリッとしたのがいいな", "爽快な刺激が欲しいです"]) }),
  Object.freeze({ id: "deep", label: "リラックス", color: "#b9a6ff", say: Object.freeze(["まったりできるのがいいな", "落ち着くのが吸いたいです"]) }),
]);
export const WISH_IDS = Object.freeze(WISHES.map((w) => w.id));

// 店の棚のフレーバー。**本編のフレーバー（data/flavors.json。大会で使える物）から選ぶ**（2026-11-20 オーナー「このゲームの大会とかで使えるフレーバーでの組み合わせで」）。
// id は本編と同じ。label＝ミックスの名前に使う短い呼び名（メーカー名は付けない）、family＝属性（本編の系統から決まる: fruit→フルーティ／sweet→スイート／
// 清涼と刺激のあるスパイス→刺激系／花と茶葉→リラックス）、also＝サブに出来る属性（柑橘の爽やかさや茶葉の落ち着きなど）、chapter＝本編で出回る章。
// 本編のデータとの食い違い（無い id・系統のずれ・章のずれ・大会で使えない物）は、remake/test/tonari_floor_model.mjs が止める。
// 本編でのフレーバー名（メーカー名を除いた部分）。ミックス名の後ろの（）に、使ったフレーバーとして出す（TFL44）。
// label はミックス名を組むための短い呼び名なので、本編の名前と違う物と、長くて折れ目が要る物をここに書く
// （「｜」は、狭い札で折ってよい所。data/flavors.json の名前と食い違うと検査で止まる）
const FULL_NAMES = Object.freeze({
  cool_mint: "クール｜ミント", blueberry_mint: "ブルーベリー｜ミント", ice_grape: "アイス｜グレープ", ice_lemon: "アイス｜レモン",
  peppermint_shake: "ペパーミント｜シェイク", frozen_citrus: "フローズン｜シトラス", frozen_berry: "フローズン｜ベリー",
  grapefruit: "グレープ｜フルーツ", pineapple: "パイナップル", blueberry: "ブルーベリー", strawberry: "ストロベリー",
  lemon_tea: "レモン｜ティー", cherry: "レッド｜チェリー", passion_fruit: "パッション｜フルーツ", chocolate: "チョコレート",
  cotton_candy: "コットン｜キャンディ", hazelnut: "ヘーゼル｜ナッツ", white_gummy_bear: "ホワイト｜グミベア", double_apple: "ダブル｜アップル",
  black_tea: "ブラック｜ティー", absal_earlgrey: "アール｜グレイ", white_musk: "ホワイト｜ムスク", sakura: "桜",
});
const flavor = (id, label, family, also = [], chapter = 1) => {
  const parts = Object.freeze((FULL_NAMES[id] || label).split("｜"));
  return Object.freeze({ id, label, full: parts.join(""), fullParts: parts, family, also: Object.freeze(also), chapter });
};
export const AROMATIC_SPICES = Object.freeze(["double_apple", "cinnamon", "cardamom", "ginger"]);

export const FLAVORS = Object.freeze(Object.fromEntries([
  // 清涼・スパイス（刺激系）
  flavor("mint", "ミント", "fresh"), flavor("cool_mint", "クールミント", "fresh"), flavor("blueberry_mint", "ベリーミント", "fresh", ["fruit"]),
  flavor("ice_grape", "アイスグレープ", "fresh", ["fruit"]), flavor("ice_lemon", "アイスレモン", "fresh", ["fruit"]),
  flavor("peppermint_shake", "ミントシェイク", "fresh", ["sweet"]), flavor("frozen_citrus", "フローズンシトラス", "fresh", ["fruit"]),
  flavor("frozen_berry", "フローズンベリー", "fresh", ["fruit"]),
  flavor("double_apple", "アップル", "fresh", ["fruit"]), flavor("cinnamon", "シナモン", "fresh", ["sweet"]),
  flavor("cardamom", "カルダモン", "fresh"), flavor("ginger", "ジンジャー", "fresh"),
  // fruit（フルーティ）
  flavor("lemon", "レモン", "fruit", ["fresh"]), flavor("orange", "オレンジ", "fruit", ["fresh"]), flavor("grapefruit", "グレープフルーツ", "fruit", ["fresh"]),
  flavor("watermelon", "スイカ", "fruit", ["fresh"]), flavor("kiwi", "キウイ", "fruit", ["fresh"]), flavor("pineapple", "パイン", "fruit"),
  flavor("mango", "マンゴー", "fruit"), flavor("peach", "ピーチ", "fruit"), flavor("grape", "グレープ", "fruit"), flavor("blueberry", "ベリー", "fruit"),
  flavor("raspberry", "ラズベリー", "fruit"), flavor("cassis", "カシス", "fruit"), flavor("strawberry", "イチゴ", "fruit"), flavor("guava", "グアバ", "fruit"),
  flavor("melon", "メロン", "fruit"), flavor("banana", "バナナ", "fruit", ["sweet"]), flavor("coconut", "ココナッツ", "fruit", ["sweet"]),
  flavor("lychee", "ライチ", "fruit", ["deep"]), flavor("lemon_tea", "レモンティー", "fruit", ["deep"]),
  flavor("cherry", "チェリー", "fruit", [], 2), flavor("passion_fruit", "パッション", "fruit", [], 2),
  // sweet（スイート）
  flavor("vanilla", "バニラ", "sweet"), flavor("chocolate", "チョコ", "sweet"), flavor("caramel", "キャラメル", "sweet"), flavor("cotton_candy", "わたあめ", "sweet"),
  flavor("hazelnut", "ナッツ", "sweet"), flavor("honey", "ハニー", "sweet"), flavor("cola", "コーラ", "sweet"),
  flavor("coffee", "コーヒー", "sweet", ["deep"]), flavor("cappuccino", "カプチーノ", "sweet", ["deep"]),
  flavor("milk", "ミルク", "sweet", [], 2), flavor("white_gummy_bear", "グミ", "sweet", ["fruit"], 2),
  // 花・茶葉（リラックス）。ブラックティーの本編カテゴリは spice。
  flavor("black_tea", "ティー", "deep"), flavor("absal_earlgrey", "アールグレイ", "deep", ["fresh"]),
  flavor("rose", "ローズ", "deep"), flavor("jasmine", "ジャスミン", "deep"), flavor("lavender", "ラベンダー", "deep"), flavor("chamomile", "カモミール", "deep"),
  flavor("white_musk", "ムスク", "deep"), flavor("sakura", "サクラ", "deep", [], 2),
].map((f) => [f.id, f])));

// ミックスの一覧（店で出せる一台）。営業中は、この中から HAND_SIZE 個が並び、選んで出す。出すと次の一つが補充され、シャッフルで全部を入れ替えられる。
// main＝メインの属性（その気分の客に ◎）、sub＝サブの属性（その気分の客に ○。無いミックスもある）。それ以外の気分には ×。
// ひと目で分かるよう、合い方はこの二つだけで決める（2026-11-20 オーナー「一目で何属性がメインなのかわかりやすくして」）。
// main は材料の属性（family）から、sub は材料の family か also から選ぶ。冷たさやスパイスが立つ物は刺激系。茶葉の味が主役の物はリラックス、甘さが主役の物はスイートをメインにする。
// name を省くと材料の label をつなげる。name の「｜」は、狭い札で折ってよい位置（表示では消える）。出回る章は、材料のいちばん遅い章（mixChapter）。
// name＝ミックスの名前（「｜」は、狭い札で折ってよい所）。省くと、2種は材料の呼び名をつなげる（レモンミント）。
// 1種の物はミックスではないので、名前は付けず「本編のフレーバー名＋単」（ダブルアップル単・コットンキャンディ単）になる（TFL47）
const mix = (id, flavors, main, sub = null, name = null) => Object.freeze({ id, flavors: Object.freeze(flavors), main, sub, name });
export const MIXES = Object.freeze(Object.fromEntries([
  // ---- 刺激系がメイン ----
  mix("lemonmint", ["lemon", "mint"], "fresh", "fruit"), mix("grapemint", ["grape", "mint"], "fresh", "fruit"), mix("orangemint", ["orange", "mint"], "fresh", "fruit"),
  mix("pinemint", ["pineapple", "mint"], "fresh", "fruit"), mix("peachmint", ["peach", "mint"], "fresh", "fruit"), mix("watermelonmint", ["watermelon", "mint"], "fresh", "fruit"),
  mix("berrymint", ["blueberry_mint"], "fresh", "fruit"), mix("icelemon", ["ice_lemon"], "fresh", "fruit"),
  mix("icegrape", ["ice_grape"], "fresh", "fruit"), mix("frozencitrus", ["frozen_citrus"], "fresh", "fruit"),
  mix("frozenberry", ["frozen_berry"], "fresh", "fruit"), mix("chocomint", ["chocolate", "mint"], "fresh", "sweet"),
  mix("mintshake", ["peppermint_shake"], "fresh", "sweet"), mix("colamint", ["cola", "mint"], "fresh", "sweet"),
  mix("applemint", ["double_apple", "mint"], "fresh", "fruit"), mix("lavendermint", ["lavender", "mint"], "fresh", "deep"),
  mix("coolmint", ["cool_mint"], "fresh"), mix("doublemint", ["mint", "cool_mint"], "fresh", null, "ダブル｜ミント"),
  // ---- 果物を使う定番 ----
  mix("peachmango", ["peach", "mango"], "fruit"), mix("grapeberry", ["grape", "blueberry"], "fruit"), mix("raspberrycassis", ["raspberry", "cassis"], "fruit"),
  mix("guavapine", ["guava", "pineapple"], "fruit"), mix("mangoorange", ["mango", "orange"], "fruit", "fresh"), mix("pineorange", ["pineapple", "orange"], "fruit", "fresh"),
  mix("lemonorange", ["lemon", "orange"], "fruit", "fresh"), mix("watermelonkiwi", ["watermelon", "kiwi"], "fruit", "fresh"),
  mix("grapefruit", ["grapefruit"], "fruit", "fresh"), mix("mangococonut", ["mango", "coconut"], "fruit", "sweet"),
  mix("bananavanilla", ["banana", "vanilla"], "fruit", "sweet"), mix("melonvanilla", ["melon", "vanilla"], "fruit", "sweet"),
  mix("berryvanilla", ["blueberry", "vanilla"], "fruit", "sweet"), mix("strawberryvanilla", ["strawberry", "vanilla"], "fruit", "sweet"),
  mix("peachlychee", ["peach", "lychee"], "fruit", "deep"), mix("lycheerose", ["lychee", "rose"], "deep", "fruit"), mix("peachtea", ["peach", "black_tea"], "deep", "fruit"),
  mix("lemontea", ["lemon_tea"], "fruit", "deep"),
  mix("pinepassion", ["pineapple", "passion_fruit"], "fruit"), mix("cherryvanilla", ["cherry", "vanilla"], "fruit", "sweet"),
  mix("mangomilk", ["mango", "milk"], "fruit", "sweet"), mix("strawberrymilk", ["strawberry", "milk"], "fruit", "sweet"),
  // ---- 甘い香りを使う定番 ----
  mix("chocovanilla", ["chocolate", "vanilla"], "sweet"), mix("caramelvanilla", ["caramel", "vanilla"], "sweet"), mix("caramelnuts", ["caramel", "hazelnut"], "sweet"),
  mix("choconuts", ["chocolate", "hazelnut"], "sweet"), mix("honeynuts", ["honey", "hazelnut"], "sweet"), mix("vanillacola", ["vanilla", "cola"], "sweet"),
  mix("cottoncandy", ["cotton_candy"], "sweet"), mix("honeylemon", ["honey", "lemon"], "sweet", "fruit"), mix("vanillapeach", ["vanilla", "peach"], "sweet", "fruit"),
  mix("chocobanana", ["chocolate", "banana"], "sweet", "fruit"), mix("chocoorange", ["chocolate", "orange"], "sweet", "fruit"),
  mix("caramelbanana", ["caramel", "banana"], "sweet", "fruit"), mix("colalemon", ["cola", "lemon"], "sweet", "fresh"),
  mix("cafemocha", ["coffee", "chocolate"], "sweet", "deep", "カフェ｜モカ"), mix("cappuccino", ["cappuccino"], "sweet", "deep"),
  mix("honeyginger", ["honey", "ginger"], "sweet", "fresh"), mix("caramelapple", ["caramel", "double_apple"], "sweet", "fresh"),
  mix("honeymilk", ["honey", "milk"], "sweet"), mix("caramelmilk", ["caramel", "milk"], "sweet"), mix("whitegummy", ["white_gummy_bear"], "sweet", "fruit"),
  // ---- 花・お茶・スパイスを使う定番 ----
  mix("rosejasmine", ["rose", "jasmine"], "deep"), mix("muskrose", ["white_musk", "rose"], "deep"), mix("rosetea", ["rose", "black_tea"], "deep"),
  mix("jasminetea", ["jasmine", "black_tea"], "deep"), mix("cardamomtea", ["cardamom", "black_tea"], "deep", "fresh"), mix("gingertea", ["ginger", "black_tea"], "deep", "fresh"),
  mix("apple", ["double_apple"], "fresh", "fruit"), mix("cinnamonapple", ["cinnamon", "double_apple"], "fresh", "fruit"),
  mix("cinnamonorange", ["cinnamon", "orange"], "fresh", "fruit"), mix("jasminepeach", ["jasmine", "peach"], "deep", "fruit"),
  mix("jasminelychee", ["jasmine", "lychee"], "deep", "fruit"), mix("roseberry", ["rose", "raspberry"], "deep", "fruit"),
  mix("cinnamontea", ["cinnamon", "black_tea"], "deep", "fresh"), mix("lavenderhoney", ["lavender", "honey"], "deep", "sweet"),
  mix("chamomilehoney", ["chamomile", "honey"], "deep", "sweet"), mix("cardamomhoney", ["cardamom", "honey"], "fresh", "sweet"),
  mix("earlgrey", ["absal_earlgrey"], "deep", "fresh"), mix("lavenderlemon", ["lavender", "lemon"], "deep", "fresh"),
  mix("milktea", ["absal_earlgrey", "milk"], "deep", "sweet", "ミルク｜ティー"), mix("sakurapeach", ["sakura", "peach"], "deep", "fruit"),
  // ---- 3種のミックス（2026-11-20 オーナー「ミックスは3種のも入れて欲しい」・TFL47）。仕込みが長いぶん、合った時の満足が少し高い。
  //      名前は、右の列の札に収まるよう5字までの切れ目で。材料は、（）が2行に収まる並び（まん中と後ろ、または前の二つが短い） ----
  mix("mojito", ["lemon", "mint", "honey"], "fresh", "fruit", "モヒート"), mix("suikacooler", ["watermelon", "mint", "lemon"], "fresh", "fruit", "スイカ｜クーラー"),
  mix("berrysmoothie", ["frozen_berry", "banana", "vanilla"], "fresh", "fruit", "ベリー｜スムージー"), mix("grapesoda", ["ice_grape", "mint", "cola"], "fresh", "sweet", "グレープ｜ソーダ"),
  mix("minttea", ["mint", "jasmine", "honey"], "fresh", "deep", "ミント｜ティー"),
  mix("tropical", ["pineapple", "mango", "banana"], "fruit", null, "トロピカル"), mix("berries", ["blueberry", "raspberry", "cassis"], "fruit", null, "ベリーズ"),
  mix("vitamin", ["lemon", "orange", "kiwi"], "fruit", "fresh", "ビタミン"), mix("peachmelba", ["peach", "raspberry", "vanilla"], "fruit", "sweet", "ピーチ｜メルバ"),
  mix("fruittea", ["peach", "lemon", "black_tea"], "deep", "fruit", "フルーツ｜ティー"), mix("fruitmilk", ["banana", "peach", "milk"], "fruit", "sweet", "フルーツ｜牛乳"),
  mix("tiramisu", ["chocolate", "coffee", "vanilla"], "sweet", "deep", "ティラミス"), mix("chocoparfait", ["chocolate", "banana", "vanilla"], "sweet", "fruit", "チョコ｜パフェ"),
  mix("honeytoast", ["caramel", "honey", "vanilla"], "sweet", null, "ハニー｜トースト"), mix("creamsoda", ["melon", "vanilla", "cola"], "sweet", "fruit", "クリーム｜ソーダ"),
  mix("caramelmacchiato", ["caramel", "coffee", "vanilla"], "sweet", "deep", "キャラメル｜マキアート"),
  mix("nutslatte", ["hazelnut", "coffee", "milk"], "sweet", "deep", "ナッツ｜ラテ"), mix("pudding", ["caramel", "vanilla", "milk"], "sweet", null, "プリン"),
  mix("chai", ["black_tea", "cinnamon", "honey"], "deep", "fresh", "チャイ"), mix("flowergarden", ["lavender", "rose", "jasmine"], "deep", null, "フラワー｜ガーデン"),
  mix("applepie", ["double_apple", "cinnamon", "vanilla"], "sweet", "fresh", "アップル｜パイ"), mix("herbtea", ["chamomile", "lavender", "honey"], "deep", "sweet", "ハーブ｜ティー"),
  mix("gingerlemon", ["ginger", "lemon", "honey"], "fresh", "fruit", "ジンジャー｜レモン"), mix("sakuralatte", ["sakura", "absal_earlgrey", "milk"], "deep", "sweet", "サクラ｜ラテ"),
].map((m) => [m.id, m])));
/** ミックスが出回る章（材料のいちばん遅い章）。 */
export const mixChapter = (id) => Math.max(...MIXES[id].flavors.map((f) => FLAVORS[f].chapter));
/** その章の店で出せるミックス（東京編・ドバイ編で同じ遊びを開く時も、章で増える）。 */
export const mixIdsFor = (chapter = 1) => Object.keys(MIXES).filter((id) => mixChapter(id) <= Math.max(1, chapter));
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
