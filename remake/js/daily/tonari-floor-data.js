// tonari フロア営業の台本（単価・気分・フレーバー・ミックス・客・ケア・夜の種類・評価）。ルールは tonari-floor-model.js、画面は tonari-floor-view.js。
// 遊びの形（2026-11-20 オーナー）: 一人で店を回す。客は「フルーツ系が吸いたい」のように気分を言うだけで、
// 提供は、並んでいるミックスの一覧から選ぶ（原作の、キャストを卓に着ける所にあたる。一覧はシャッフルできる）。
// 売上は店のお金。はじめには tonari.js が日当（基本給・売上歩合・手当）を渡す。
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
  peppermint_shake: "ペパーミント｜シェイク", frozen_citrus: "フローズン｜シトラス",
  grapefruit: "グレープ｜フルーツ", pineapple: "パイナップル", blueberry: "ブルーベリー", strawberry: "ストロベリー",
  lemon_tea: "レモン｜ティー", cherry: "レッド｜チェリー", passion_fruit: "パッション｜フルーツ", chocolate: "チョコレート",
  cotton_candy: "コットン｜キャンディ", hazelnut: "ヘーゼル｜ナッツ", white_gummy_bear: "ホワイト｜グミベア", double_apple: "ダブル｜アップル",
  dragonfruit: "ドラゴン｜フルーツ", red_gummy_bear: "レッド｜グミベア", spring_water: "スプリング｜ウォーター",
  black_tea: "ブラック｜ティー", absal_earlgrey: "アール｜グレイ", white_musk: "ホワイト｜ムスク", sakura: "桜",
  mountain_mist: "マウンテン｜ミスト", nightside_blast_mint: "ブラスト｜ミント",
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
  flavor("dragonfruit", "ドラゴンフルーツ", "fruit", [], 2),
  // sweet（スイート）
  flavor("vanilla", "バニラ", "sweet"), flavor("chocolate", "チョコ", "sweet"), flavor("caramel", "キャラメル", "sweet"), flavor("cotton_candy", "わたあめ", "sweet"),
  flavor("hazelnut", "ナッツ", "sweet"), flavor("honey", "ハニー", "sweet"), flavor("cola", "コーラ", "sweet"),
  flavor("coffee", "コーヒー", "sweet", ["deep"]), flavor("cappuccino", "カプチーノ", "sweet", ["deep"]),
  flavor("milk", "ミルク", "sweet", [], 2), flavor("white_gummy_bear", "グミ", "sweet", ["fruit"], 2),
  flavor("red_gummy_bear", "レッドグミベア", "sweet", ["fruit"], 2),
  flavor("spring_water", "スプリングウォーター", "deep", [], 2),
  // 花・茶葉（リラックス）。ブラックティーの本編カテゴリは spice。
  flavor("black_tea", "ティー", "deep"), flavor("absal_earlgrey", "アールグレイ", "deep", ["fresh"]),
  flavor("rose", "ローズ", "deep"), flavor("jasmine", "ジャスミン", "deep"), flavor("lavender", "ラベンダー", "deep"), flavor("chamomile", "カモミール", "deep"),
  flavor("white_musk", "ムスク", "deep"), flavor("sakura", "サクラ", "deep", [], 2),
  // 第3章以降で出回るフレーバー（東京 mukai・ドバイの店番で棚に加わる。第1・2章の並びには影響しない）
  flavor("lime", "ライム", "fruit", ["fresh"], 3), flavor("biscuit", "ビスケット", "sweet", [], 3),
  flavor("pistachio", "ピスタチオ", "sweet", ["deep"], 3), flavor("mountain_mist", "マウンテンミスト", "fruit", ["fresh"], 3),
  flavor("nightside_blast_mint", "ブラストミント", "fresh", [], 3),
].map((f) => [f.id, f])));

// ミックスの一覧（店で出せる一台）。営業中は、この中から HAND_SIZE 個が並び、選んで出す。出すと次の一つが補充され、シャッフルで全部を入れ替えられる。
// main＝メインの属性（その気分の客に ◎）、sub＝サブの属性（その気分の客に ○。無いミックスもある）。それ以外の気分には ×。
// ひと目で分かるよう、合い方はこの二つだけで決める（2026-11-20 オーナー「一目で何属性がメインなのかわかりやすくして」）。
// main はミックスの顔となる材料の family、sub は2番手の材料の family が基本。同系統なら、他の材料や also からサブを選ぶこともある。
// アップルミントはオーナー指定で、ダブルアップルのリンゴ感（also の fruit）をメインにする。単品のダブルアップルは family の fresh。
// name を省くと材料の label をつなげる。name の「｜」は、狭い札で折ってよい位置（表示では消える）。出回る章は、材料のいちばん遅い章（mixChapter）。
// name＝ミックスの名前（「｜」は、狭い札で折ってよい所）。省くと、2種は材料の呼び名をつなげる（レモンミント）。
// 1種の物はミックスではないので、名前は付けず「本編のフレーバー名＋単」（ダブルアップル単・コットンキャンディ単）になる（TFL47）
const mix = (id, flavors, main, sub = null, name = null) => Object.freeze({ id, flavors: Object.freeze(flavors), main, sub, name });
export const MIXES = Object.freeze(Object.fromEntries([
  // ---- ミント・清涼系のフレーバーを使う定番 ----
  mix("lemonmint", ["lemon", "mint"], "fruit", "fresh"), mix("grapemint", ["grape", "mint"], "fruit", "fresh"), mix("orangemint", ["orange", "mint"], "fruit", "fresh"),
  mix("pinemint", ["pineapple", "mint"], "fruit", "fresh"), mix("peachmint", ["peach", "mint"], "fruit", "fresh"), mix("watermelonmint", ["watermelon", "mint"], "fruit", "fresh"),
  mix("berrymint", ["blueberry_mint"], "fresh", "fruit"), mix("icelemon", ["ice_lemon"], "fresh", "fruit"),
  mix("icegrape", ["ice_grape"], "fresh", "fruit"), mix("frozencitrus", ["frozen_citrus"], "fresh", "fruit"),
  mix("chocomint", ["chocolate", "mint"], "sweet", "fresh"),
  mix("mintshake", ["peppermint_shake"], "fresh", "sweet"), mix("colamint", ["cola", "mint"], "sweet", "fresh"),
  mix("applemint", ["double_apple", "mint"], "fruit", "fresh"), mix("lavendermint", ["lavender", "mint"], "deep", "fresh"),
  mix("coolmint", ["cool_mint"], "fresh"), mix("doublemint", ["mint", "cool_mint"], "fresh", null, "ダブル｜ミント"),
  mix("mint", ["mint"], "fresh"), mix("rosemint", ["rose", "mint"], "deep", "fresh"), mix("jasminemint", ["jasmine", "mint"], "deep", "fresh"),
  mix("cherrymint", ["cherry", "mint"], "fruit", "fresh"), mix("passionmint", ["passion_fruit", "mint"], "fruit", "fresh"),
  mix("dragonmint", ["dragonfruit", "mint"], "fruit", "fresh", "ドラゴン｜ミント"),
  mix("gummymint", ["white_gummy_bear", "mint"], "sweet", "fresh"), mix("redgummymint", ["red_gummy_bear", "mint"], "sweet", "fresh", "赤グミ｜ミント"),
  mix("milkmint", ["milk", "mint"], "sweet", "fresh"), mix("sakuramint", ["sakura", "mint"], "deep", "fresh"),
  mix("springmint", ["spring_water", "mint"], "deep", "fresh", "スプリング｜ミント"),
  // ---- 果物を使う定番 ----
  mix("peachmango", ["peach", "mango"], "fruit"), mix("grapeberry", ["grape", "blueberry"], "fruit"), mix("raspberrycassis", ["raspberry", "cassis"], "fruit"),
  mix("guavapine", ["guava", "pineapple"], "fruit"), mix("mangoorange", ["mango", "orange"], "fruit", "fresh"), mix("pineorange", ["pineapple", "orange"], "fruit", "fresh"),
  mix("lemonorange", ["lemon", "orange"], "fruit", "fresh"), mix("watermelonkiwi", ["watermelon", "kiwi"], "fruit", "fresh"),
  mix("grapefruit", ["grapefruit"], "fruit", "fresh"), mix("mangococonut", ["mango", "coconut"], "fruit", "sweet"),
  mix("bananavanilla", ["banana", "vanilla"], "fruit", "sweet"), mix("melonvanilla", ["melon", "vanilla"], "fruit", "sweet"),
  mix("berryvanilla", ["blueberry", "vanilla"], "fruit", "sweet"), mix("strawberryvanilla", ["strawberry", "vanilla"], "fruit", "sweet"),
  mix("peachlychee", ["peach", "lychee"], "fruit", "deep"), mix("lycheerose", ["lychee", "rose"], "fruit", "deep"), mix("peachtea", ["peach", "black_tea"], "fruit", "deep"),
  mix("lemontea", ["lemon_tea"], "fruit", "deep"),
  mix("pinepassion", ["pineapple", "passion_fruit"], "fruit"), mix("cherryvanilla", ["cherry", "vanilla"], "fruit", "sweet"),
  mix("mangomilk", ["mango", "milk"], "fruit", "sweet"), mix("strawberrymilk", ["strawberry", "milk"], "fruit", "sweet"),
  mix("grapelychee", ["grape", "lychee"], "fruit", "deep"), mix("cassislychee", ["cassis", "lychee"], "fruit", "deep"),
  mix("guavalychee", ["guava", "lychee"], "fruit", "deep"), mix("cassisgrapefruit", ["cassis", "grapefruit"], "fruit", "fresh", "カシス｜グレフル"),
  mix("kiwigrape", ["kiwi", "grape"], "fruit", "fresh"), mix("melonpeach", ["melon", "peach"], "fruit"),
  mix("guavamango", ["guava", "mango"], "fruit"), mix("pinecoconut", ["pineapple", "coconut"], "fruit", "sweet"),
  mix("passionorange", ["passion_fruit", "orange"], "fruit", "fresh"), mix("dragonlychee", ["dragonfruit", "lychee"], "fruit", "deep", "ドラゴン｜ライチ"),
  // ---- 甘い香りを使う定番 ----
  mix("chocovanilla", ["chocolate", "vanilla"], "sweet"), mix("caramelvanilla", ["caramel", "vanilla"], "sweet"), mix("caramelnuts", ["caramel", "hazelnut"], "sweet"),
  mix("choconuts", ["chocolate", "hazelnut"], "sweet"), mix("honeynuts", ["honey", "hazelnut"], "sweet"), mix("vanillacola", ["vanilla", "cola"], "sweet"),
  mix("cottoncandy", ["cotton_candy"], "sweet"), mix("honeylemon", ["honey", "lemon"], "sweet", "fruit"), mix("vanillapeach", ["vanilla", "peach"], "sweet", "fruit"),
  mix("chocobanana", ["chocolate", "banana"], "sweet", "fruit"), mix("chocoorange", ["chocolate", "orange"], "sweet", "fruit"),
  mix("caramelbanana", ["caramel", "banana"], "sweet", "fruit"), mix("colalemon", ["cola", "lemon"], "sweet", "fruit"),
  mix("cafemocha", ["coffee", "chocolate"], "sweet", "deep", "カフェ｜モカ"), mix("cappuccino", ["cappuccino"], "sweet", "deep"),
  mix("honeyginger", ["honey", "ginger"], "sweet", "fresh"), mix("caramelapple", ["caramel", "double_apple"], "sweet", "fresh"),
  mix("honeymilk", ["honey", "milk"], "sweet"), mix("caramelmilk", ["caramel", "milk"], "sweet"), mix("whitegummy", ["white_gummy_bear"], "sweet", "fruit"),
  mix("vanillacinnamon", ["vanilla", "cinnamon"], "sweet", "fresh"), mix("vanillashake", ["vanilla", "peppermint_shake"], "sweet", "fresh", "バニラ｜シェイク"),
  mix("caramelcappuccino", ["caramel", "cappuccino"], "sweet", "deep"), mix("nutscoffee", ["hazelnut", "coffee"], "sweet", "deep"),
  mix("cottonrose", ["cotton_candy", "rose"], "sweet", "deep"), mix("redgummy", ["red_gummy_bear"], "sweet", "fruit"),
  mix("gummypine", ["white_gummy_bear", "pineapple"], "sweet", "fruit"),
  // ---- 花・お茶・スパイスを使う定番 ----
  mix("rosejasmine", ["rose", "jasmine"], "deep"), mix("muskrose", ["white_musk", "rose"], "deep"), mix("rosetea", ["rose", "black_tea"], "deep"),
  mix("jasminetea", ["jasmine", "black_tea"], "deep"), mix("cardamomtea", ["cardamom", "black_tea"], "fresh", "deep"), mix("gingertea", ["ginger", "black_tea"], "fresh", "deep"),
  mix("apple", ["double_apple"], "fresh", "fruit"), mix("cinnamonapple", ["cinnamon", "double_apple"], "fresh", "fruit"),
  mix("cinnamonorange", ["cinnamon", "orange"], "fresh", "fruit"), mix("jasminepeach", ["jasmine", "peach"], "deep", "fruit"),
  mix("jasminelychee", ["jasmine", "lychee"], "deep", "fruit"), mix("roseberry", ["rose", "raspberry"], "deep", "fruit"),
  mix("cinnamontea", ["cinnamon", "black_tea"], "fresh", "deep"), mix("lavenderhoney", ["lavender", "honey"], "deep", "sweet"),
  mix("chamomilehoney", ["chamomile", "honey"], "deep", "sweet"), mix("cardamomhoney", ["cardamom", "honey"], "fresh", "sweet"),
  mix("earlgrey", ["absal_earlgrey"], "deep", "fresh"), mix("lavenderlemon", ["lavender", "lemon"], "deep", "fruit"),
  mix("milktea", ["absal_earlgrey", "milk"], "deep", "sweet", "ミルク｜ティー"), mix("sakurapeach", ["sakura", "peach"], "deep", "fruit"),
  mix("muskjasmine", ["white_musk", "jasmine"], "deep"), mix("chamomiletea", ["chamomile", "black_tea"], "deep"),
  mix("honeytea", ["honey", "black_tea"], "sweet", "deep"), mix("vanillatea", ["vanilla", "black_tea"], "sweet", "deep"),
  mix("muskvanilla", ["white_musk", "vanilla"], "deep", "sweet"), mix("cardamomearlgrey", ["absal_earlgrey", "cardamom"], "deep", "fresh", "スパイス｜紅茶"),
  mix("earlgreyorange", ["absal_earlgrey", "orange"], "fruit", "deep", "オレンジ｜ティー"), mix("chamomilepeach", ["chamomile", "peach"], "deep", "fruit"),
  mix("sakurajasmine", ["sakura", "jasmine"], "deep"), mix("springlychee", ["spring_water", "lychee"], "deep", "fruit", "スプリング｜ライチ"),
  mix("sakuratea", ["sakura", "absal_earlgrey"], "deep", "fresh", "サクラ｜ティー"), mix("chamomilemilk", ["chamomile", "milk"], "deep", "sweet"),
  // 第2章の客が好む葉。本編で買えるフレーバーを使う。
  mix("dragonfruit", ["dragonfruit"], "fruit"), mix("berryredgummy", ["strawberry", "red_gummy_bear"], "fruit", "sweet", "イチゴ｜赤グミ"), mix("springwater", ["spring_water"], "deep"),
  // ---- 3種のミックス（2026-11-20 オーナー「ミックスは3種のも入れて欲しい」・TFL47）。仕込みが長いぶん、合った時の満足が少し高い。
  //      名前は、右の列の札に収まるよう5字までの切れ目で。材料は、（）が2行に収まる並び（まん中と後ろ、または前の二つが短い） ----
  mix("mojito", ["lemon", "mint", "honey"], "fruit", "fresh", "モヒート"), mix("suikacooler", ["watermelon", "mint", "lemon"], "fruit", "fresh", "スイカ｜クーラー"),
  mix("grapesoda", ["ice_grape", "mint", "cola"], "fresh", "sweet", "グレープ｜ソーダ"),
  mix("minttea", ["mint", "jasmine", "honey"], "fresh", "deep", "ミント｜ティー"), mix("cherrycooler", ["cherry", "lemon", "mint"], "fruit", "fresh", "チェリー｜クーラー"),
  mix("tropical", ["pineapple", "mango", "banana"], "fruit", null, "トロピカル"), mix("berries", ["blueberry", "raspberry", "cassis"], "fruit", null, "ベリーズ"),
  mix("vitamin", ["lemon", "orange", "kiwi"], "fruit", "fresh", "ビタミン"), mix("peachmelba", ["peach", "raspberry", "vanilla"], "fruit", "sweet", "ピーチ｜メルバ"),
  mix("berryrose", ["blueberry", "raspberry", "rose"], "fruit", "deep", "ベリー｜ローズ"), mix("sangria", ["grape", "orange", "cassis"], "fruit", "fresh", "サングリア"),
  mix("fruittea", ["peach", "lemon", "black_tea"], "fruit", "deep", "フルーツ｜ティー"), mix("fruitmilk", ["banana", "peach", "milk"], "fruit", "sweet", "フルーツ｜牛乳"),
  mix("tiramisu", ["chocolate", "coffee", "vanilla"], "sweet", "deep", "ティラミス"), mix("chocoparfait", ["chocolate", "banana", "vanilla"], "sweet", "fruit", "チョコ｜パフェ"),
  mix("honeytoast", ["caramel", "honey", "vanilla"], "sweet", null, "ハニー｜トースト"), mix("creamsoda", ["melon", "vanilla", "cola"], "sweet", "fruit", "クリーム｜ソーダ"),
  mix("caramelmacchiato", ["caramel", "coffee", "vanilla"], "sweet", "deep", "キャラメル｜マキアート"), mix("churros", ["caramel", "cinnamon", "vanilla"], "sweet", "fresh", "チュロス"),
  mix("nutslatte", ["hazelnut", "coffee", "milk"], "sweet", "deep", "ナッツ｜ラテ"), mix("pudding", ["caramel", "vanilla", "milk"], "sweet", null, "プリン"),
  mix("cinnamonmilk", ["cinnamon", "honey", "milk"], "fresh", "sweet", "シナモン｜ミルク"), mix("vanillalatte", ["coffee", "vanilla", "milk"], "sweet", "deep", "バニラ｜ラテ"),
  mix("chai", ["black_tea", "cinnamon", "honey"], "deep", "fresh", "チャイ"), mix("flowergarden", ["lavender", "rose", "jasmine"], "deep", null, "フラワー｜ガーデン"),
  mix("sweetgarden", ["rose", "vanilla", "jasmine"], "deep", "sweet", "スイート｜ガーデン"), mix("coolherb", ["lavender", "mint", "chamomile"], "deep", "fresh", "クール｜ハーブ"),
  mix("applepie", ["double_apple", "cinnamon", "vanilla"], "fresh", "sweet", "アップル｜パイ"), mix("herbtea", ["chamomile", "lavender", "honey"], "deep", "sweet", "ハーブ｜ティー"),
  mix("gingerlemon", ["ginger", "lemon", "honey"], "fresh", "fruit", "ジンジャー｜レモン"), mix("sakuralatte", ["sakura", "absal_earlgrey", "milk"], "deep", "sweet", "サクラ｜ラテ"),
  mix("sakurachai", ["sakura", "cinnamon", "black_tea"], "deep", "fresh", "サクラ｜チャイ"),
  // ---- 第3章以降のミックス（mukai・ドバイの店番で並ぶ。第1・2章の mixIdsFor には入らない） ----
  mix("mountainmist", ["mountain_mist"], "fruit", "fresh"), mix("blastmint", ["nightside_blast_mint"], "fresh"),
  mix("limemint", ["lime", "mint"], "fruit", "fresh"), mix("lemonlime", ["lemon", "lime"], "fruit", "fresh"),
  mix("limepeach", ["lime", "peach"], "fruit", "fresh"), mix("limecola", ["lime", "cola"], "fruit", "sweet"),
  mix("biscuittea", ["biscuit", "black_tea"], "sweet", "deep", "ビスケット｜ティー"),
  mix("chocobiscuit", ["chocolate", "biscuit"], "sweet", null, "チョコ｜ビスケット"),
  mix("pistachiomilk", ["pistachio", "milk"], "sweet", "deep", "ピスタチオ｜ミルク"),
  mix("blastearlgrey", ["absal_earlgrey", "nightside_blast_mint"], "fresh", "deep", "ブラスト｜グレイ"),
  mix("biscuitrose", ["biscuit", "rose"], "sweet", "deep", "ビスケット｜ローズ"),
  mix("limejasmine", ["lime", "jasmine"], "fruit", "deep", "ライム｜ジャスミン"),
  mix("oasismint", ["lemon", "lime", "mint"], "fruit", "fresh", "オアシス｜ミント"),
  mix("pistachiolatte", ["pistachio", "coffee", "milk"], "sweet", "deep", "ピスタチオ｜ラテ"),
  mix("luqaimat", ["biscuit", "honey", "cardamom"], "sweet", "fresh", "ルカイ｜マット"),
  mix("pistachiohoney", ["pistachio", "honey", "milk"], "sweet", "deep", "ピスタチオ｜ハニー"),
  mix("limeginger", ["lime", "ginger", "honey"], "fruit", "fresh", "ライム｜ジンジャー"),
  mix("earllime", ["absal_earlgrey", "lime", "honey"], "deep", "fruit", "アール｜ライム"),
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
// party＝一緒に来る人数。**一つの卓に座るのは一人だけ**（2026-11-20 オーナー「2人が一卓に座るのは無くす。2人同時にきたら1席1席で1人一台ずつ」・TFL51）。
// 二人連れは同じ時に来て、空いている卓へ一人ずつ座り、注文・満足・会計も一人ずつ。name は一人ずつの呼び名（二人とも同じ呼び名で、卓の番号で見分ける）
const guest = (id, name, party, stay, rank, trait, drinks, look) => Object.freeze({ id, name, party, stay, rank, trait, drinks, look: Object.freeze(look) });
export const GUESTS = Object.freeze(Object.fromEntries([
  guest("first", "初めての方", 1, "normal", "plain", "beginner", 1, ["bob"]),
  guest("worker", ["仕事の合間の方", "仕事帰りの方"], 1, "short", "plain", null, 1, ["short"]),
  guest("train", ["昼休みの方", "終電前の方"], 2, "short", "plain", "talker", 1, ["cap", "long"]),
  guest("reader", "読書の方", 1, "long", "plain", null, 2, ["glasses"]),
  guest("walkers", "散歩帰りの方", 2, "long", "plain", "talker", 2, ["pony", "short"]),
  guest("nose", "香り好きの方", 1, "normal", "keen", null, 2, ["bun"]),
  guest("students", "学生さん", 2, "normal", "plain", "beginner", 1, ["curly", "cap"]),
  guest("talkers", "話し好きの方", 2, "normal", "plain", "talker", 2, ["long", "bob"]),
  guest("elder", "年配の方", 1, "long", "keen", null, 2, ["hat"]),
  guest("friends", "友だち連れの方", 2, "long", "plain", "talker", 3, ["bun", "pony"]),
].map((g) => [g.id, g])));
// たまに遊びに来る、本編の人物（2026-11-20 オーナー「好感度1以上の人物がたまにレアで遊びに来たりとかも入れたい」）。
// 来る条件（顔見知り・好感度1以上・章）は tonari.js が決める。ここは注文と台詞だけ。台詞は大会の前後どちらでも通る言葉にする（交流の時系列ルール）。
// 好感度は動かさない。chapters＝来てよい章。
// 個性（2026-11-25 オーナー「ライバルとか来たりするけど口調が他のモブと同じだったり注文も同じなのでちゃんと個性を持たせて」・TFL65・66）:
//   order＝その人だけの注文。気分（wish）に加えて、好きなフレーバー（has）を名指しする。has の入った一台が◎、気分がメインの一台が○、ほかは×
//   （モブの客は気分を言うだけで、名指ししない）。label＝卓の札の気分の所に出す言葉。refill＝おかわりの注文（言い出す一言ごと）。
//   lines＝来店から帰るまでの、その人の口調の言葉: best／good／off（提供した時）・calls（頼みの言葉 said と、応えた時 good）・miss（頼みを外した時）・
//   check（会計を頼む時）・skip（おかわりを聞きそびれた時）・bye／byeLow（見送り）・mad（待たせて帰る時）。台詞なので句点で終えない
const visitor = (id, name, chapters, stay, rank, drinks, order, refill, lines) => Object.freeze({
  id, name, chapters: Object.freeze(chapters), stay, rank, drinks,
  order: Object.freeze({ ...order, has: Object.freeze(order.has) }), refill: Object.freeze({ ...refill, has: Object.freeze(refill.has) }),
  lines: Object.freeze({ ...lines, calls: Object.freeze(lines.calls) }),
});
export const VISITORS = Object.freeze(Object.fromEntries([
  // つむぎ: ラベンダーを好む（characters.json）。煙に色が見える（言葉に色が出るが、人の判定はしない）。ていねいで、間に「……」
  visitor("tsumugi", "つむぎ", [1, 2], "long", "plain", 1,
    { wish: "deep", label: "ラベンダー", has: ["lavender"], quote: "……はじめさん。ラベンダーの、ありますか" },
    { wish: "deep", label: "お花", has: ["lavender", "rose", "jasmine", "chamomile", "sakura"], quote: "……もう少し、描いていきます。次は、お花のを" }, {
      best: "……やわらかい紫。好きな色です、これ", good: "……落ち着く色、です。ありがとうございます", off: "……少し、にぎやかな色、ですね",
      calls: {
        thin: { said: "……煙の色が、薄くなってきました", good: "……色が、戻りました" },
        harsh: { said: "……縁が、ちりちりした色に。熱い、かもです", good: "……やわらかく、なりました" },
        thirsty: { said: "……すみません。お水、もらえますか", good: "……ありがとうございます。助かります" },
      },
      miss: "……あ、えっと。そうじゃ、なくて", check: "……お会計、お願いします", skip: "……やっぱり、今日はここまでにします",
      bye: "……ごちそうさまでした。また、描きに来ます", byeLow: "……ごちそうさま、でした", mad: "……すみません。今日は、帰ります",
    }),
  // なる: バニラと甘いお菓子系が軸（characters.json）。気さくで面倒見がいい。待たされても怒らない
  visitor("naru", "なる", [1], "normal", "keen", 1,
    { wish: "sweet", label: "バニラ", has: ["vanilla"], quote: "よう、はじめ。バニラの効いた甘いやつ、頼むわ" },
    { wish: "sweet", label: "チョコ・キャラメル", has: ["chocolate", "caramel"], quote: "もう一台いけるな。次はチョコかキャラメルで" }, {
      best: "……うまいな。焼き菓子みたいだ", good: "甘いのはいいな。バニラは、次の楽しみにしとく", off: "ん、甘いのを頼んだんだけどな",
      calls: {
        thin: { said: "おい、煙が痩せてきた。炭、見てくれるか", good: "よし、戻った。早いな" },
        harsh: { said: "ちょっと焦げてる。熱、下げてくれ", good: "うん、甘さが戻った" },
        thirsty: { said: "悪い、水もらえるか", good: "サンキュ。気が利くな" },
      },
      miss: "いや、そうじゃなくてな", check: "はじめ、会計頼む", skip: "……まあいいや。会計で",
      bye: "ごちそうさん。また来るわ", byeLow: "……ごちそうさん", mad: "忙しそうだな。また来るわ",
    }),
  // アダム: ダブルアップル特化（characters.json）。芝居がかった言い回しで、林檎を宇宙の原点のように語る
  visitor("adam", "アダム", [1, 2], "normal", "keen", 1,
    { wish: "fresh", label: "ダブルアップル", has: ["double_apple"], quote: "……はじめよ。ダブルアップルを。宇宙の原点を、一台" },
    { wish: "fresh", label: "ダブルアップル", has: ["double_apple"], quote: "……幕間だ。もう一台、林檎を。メーカーは任せる" }, {
      best: "……よい。林檎が、まっすぐ立っている", good: "……悪くない。だが、林檎がいない", off: "……これは、林檎ではない",
      calls: {
        thin: { said: "……煙が細い。林檎が、息をしていない", good: "……よい。呼吸が戻った" },
        harsh: { said: "……熱すぎる。アニスが焦げている", good: "……うむ。香りが還ってきた" },
        thirsty: { said: "……水を。舌を、まっさらにしたい", good: "……感謝する" },
      },
      miss: "……違う。そうではない", check: "……会計を。幕を下ろそう", skip: "……ならば、ここで幕だ",
      bye: "……また来る。林檎を、絶やすな", byeLow: "……また来る", mad: "……出直そう。林檎は、待つことも知っている",
    }),
  // 私服の話者は oneesan。名乗る前の会話にも使うので、店での素性には触れない。
  visitor("minto", "お姉さん", [1, 2, 3, 4, 5], "normal", "plain", 1,
    { wish: "fresh", label: "ミント", has: ["mint"], quote: "…今日は、ミントを吸いに来たの" },
    { wish: "fresh", label: "ミント", has: ["mint"], quote: "…きみのミント、もう一台吸っていっていい？" }, {
      best: "…このミント、息を吐いたあとも涼しいね", good: "すっとするね。次はミントも吸いたいな", off: "…今日は、もう少し涼しいのがよかったな",
      calls: {
        thin: { said: "…煙が薄くなってきたみたい", good: "うん、また香る。ありがとう" },
        harsh: { said: "少し喉に当たるの。熱を下げてもらえる？", good: "…これならゆっくり吸えるね" },
        thirsty: { said: "お水を一杯、もらってもいい？", good: "ありがとう。ひと息つけた" },
      },
      miss: "…あのね、お願いしたのは別のことなの", check: "そろそろ、お会計してもらえる？", skip: "…やっぱり、続きは今度にしようかな",
      bye: "ごちそうさま。ここで吸うと落ち着くね", byeLow: "今日はこの辺で。ごちそうさま", mad: "…今日は帰るね。またゆっくり来るから",
    }),
  visitor("ageha", "あげは", [2, 3, 4, 5], "normal", "plain", 1,
    { wish: "sweet", label: "ホワイトグミベア", has: ["white_gummy_bear"], quote: "ハジメっち、うちホワイトグミベアがいい！" },
    { wish: "sweet", label: "レッドグミベア", has: ["red_gummy_bear"], quote: "次、レッドグミベア！ 白と吸い比べたいじゃん" }, {
      best: "これこれ！ グミ、ほんとに噛めそう", good: "この甘さも好き。グミの方も気になる！", off: "んー、うち今日はグミの口なんだよね",
      calls: {
        thin: { said: "ハジメっち、さっきより煙少なくない？", good: "戻った！ このひと口待ってた！" },
        harsh: { said: "あっつ！ 炭、ひとつ下ろせる？", good: "うん、今のめちゃ吸いやすい！" },
        thirsty: { said: "うち、お水もらっていい？", good: "ありがと！ 生き返った〜" },
      },
      miss: "待って、そっちじゃないってば", check: "ハジメっち、お会計よろしく！", skip: "やっぱもう出るね。お会計で！",
      bye: "ごちそうさま！ またグミ吸いに来るね", byeLow: "じゃあね、ハジメっち", mad: "今日は時間切れ！ また今度ね",
    }),
  visitor("kumicho", "神崎竜二", [2, 3, 4, 5], "normal", "keen", 1,
    { wish: "fruit", label: "ドラゴンフルーツ", has: ["dragonfruit"], quote: "あんちゃん、ドラゴンフルーツを一台頼みやす" },
    { wish: "fruit", label: "ドラゴンフルーツ", has: ["dragonfruit"], quote: "もう一服したいねえ。ドラゴンフルーツで頼みやす" }, {
      best: "ああ、いいねえ。葉の甘みがよく出てやす", good: "いい果物でさ。ドラゴンフルーツも吸いたいねえ", off: "あんちゃん、頼んだ葉と違いやせんか",
      calls: {
        thin: { said: "あんちゃん、炭を見ちゃくれませんかね。煙が細い", good: "おう、しっかり出てきやした" },
        harsh: { said: "こいつはちいと熱い。炭を下ろしておくんなせえ", good: "そうそう。こいつが吸いたかったんでさ" },
        thirsty: { said: "水を一杯、いただけやすか", good: "いやあ、ありがてえ" },
      },
      miss: "あんちゃん、そいつは別の卓じゃありやせんか", check: "勘定をお願いしやす", skip: "いや、今日は勘定にしてくだせえ",
      bye: "いい一服でやした。あんちゃん、ごちそうさん", byeLow: "そろそろお暇しやす", mad: "出直すとしやすか。あんちゃん、またな",
    }),
  visitor("kuraudo", "†黒羅雨℃†", [2, 3, 4, 5], "normal", "keen", 1,
    { wish: "fruit", label: "カシス", has: ["cassis"], quote: "…カシスを。余韻が残るやつ" },
    { wish: "fruit", label: "カシス", has: ["cassis"], quote: "もう一台。…カシスを、もう一度吸いたい" }, {
      best: "…吐き切っても、まだカシスがいる", good: "果物の香りはいい。…カシスも欲しかった", off: "…思ってた香りと違う",
      calls: {
        thin: { said: "…煙が途切れる。炭を見てくれ", good: "…そのままでいい。香ってきた" },
        harsh: { said: "…熱が強い。少し下げてほしい", good: "今くらいがいい。…ありがとう" },
        thirsty: { said: "…水、一杯もらえるか", good: "助かった。喉が乾いてた" },
      },
      miss: "…そっちじゃない。こっちの卓だ", check: "…会計、いいか", skip: "…いや、ここで終わりにする",
      bye: "…最後のひと口がよかった。また来る", byeLow: "…今日は、これで", mad: "…席、空けるよ。また今度",
    }),
  visitor("samechan", "？？？", [2, 3, 4, 5], "normal", "plain", 1,
    { wish: "deep", label: "スプリングウォーター", has: ["spring_water"], quote: "お主、スプリングウォーターはあるかの？" },
    { wish: "deep", label: "スプリングウォーター", has: ["spring_water"], quote: "もう一台、スプリングウォーターを所望するぞ" }, {
      best: "うむ、この花の香りじゃ。ひと口で分かるぞ", good: "落ち着くのう。次はあの花の香りも頼むぞ", off: "むむ、今日は花の香りがよかったのじゃ",
      calls: {
        thin: { said: "お主、煙が細くなっておるぞ", good: "おお、またたっぷり出るようになったのう" },
        harsh: { said: "ちと熱いのう。炭を下ろしてくれんか", good: "うむ、ちょうどよい熱じゃ" },
        thirsty: { said: "水を一杯もらえるかの", good: "かたじけない。喉が潤ったぞ" },
      },
      miss: "む？ 頼みたいのはそれではないぞ", check: "お主、勘定を頼むぞ", skip: "いや、今日はここまでにしておくかの",
      bye: "よい席じゃった。また寄らせてもらうぞ", byeLow: "では、そろそろ帰るとしようかの", mad: "今日は引き上げるぞ、コロちゃん",
    }),
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

// ケアの種類（客からの頼み）。台詞・地の文・正しく応えた時の一言を組にする。
// 炭の調整は自分から行える。放っておくと、汎用の客は thin か harsh で頼む。
const call = (verb, label, lines) => Object.freeze({
  verb, label, lines: Object.freeze(lines.map(([said, sight, good]) => Object.freeze({ said, sight, good }))),
});
export const CALLS = Object.freeze({
  thin: call("add", "煙が薄い", [
    ["あの、煙が薄くなってきたみたいで", "煙が細い。ホースを見て、首をかしげている。", "うん、しっかり出てきた"],
    ["さっきより煙が少ないんですけど、炭を見てもらえますか？", "ひと口吸って、吐いた煙を見つめる。煙はすぐに消えた。", "ああ、さっきの香りが戻ってきた"],
    ["…あれ、もうほとんど煙が出ないな", "ホースを取り直してもう一度吸う。煙はほとんど出ない。", "今度はちゃんと出る。ありがとう"],
    ["煙も香りも弱くなってきました。炭、足せますか？", "台の上をのぞき込んでいる。口元から細い煙がひと筋だけ上がった。", "また香ってきましたね"],
  ]),
  harsh: call("ease", "熱を下げて", [
    ["すみません、少し熱いかも。熱、下げてもらえますか", "眉を寄せて、ホースをそっと置いた。煙は濃い。", "うん、やわらかくなった"],
    ["さっきから煙が喉に当たるんです。炭、少し下ろせますか？", "濃い煙を吐くなり、目を細めてホースを置いた。", "今のは喉に引っかからないですね"],
    ["…ちょっと焦げっぽいです。熱が強いのかな", "煙が立つ台から少し身を引いた。かすかに焦げた匂いがする。", "焦げた感じ、なくなりました"],
    ["ひと口目より熱くなってきたので、少し見てもらえますか？", "ひと口吸っただけで顔をしかめた。台にはまだ赤い炭が載っている。", "これくらいの熱なら、ゆっくり吸えそう"],
  ]),
  thirsty: call("water", "喉が渇いた", [
    ["ふう……少し喉が渇いてきたな", "喉に手をやって、小さく咳払いをした。グラスは空だ。", "ありがとう。気が利きますね"],
    ["すみません、お水を一杯いただけますか？", "空になったグラスを手に、カウンターへ目を向けた。", "冷たくておいしい。ひと息つけます"],
    ["だいぶ吸ったなあ。お水、もらってもいいですか？", "ホースを置き、グラスを傾ける。底で氷だけが鳴った。", "喉が潤った。助かりました"],
    ["…喉が渇いちゃった。お冷や、ありますか？", "グラスの最後のひと口を飲み干し、唇をぬらした。", "お水ちょうど欲しかったところです"],
  ]),
  cough: call("teach", "むせている", [
    ["けほっ……これ、吸い方合ってます？", "深く吸いこみすぎて、むせている。", "なるほど、ゆっくり吸えばいいんですね"],
    ["…思ったより煙が来ますね。どれくらい吸えばいいんですか？", "勢いよく吸った途端、煙を吐ききれずに何度も咳き込んだ。", "少しずつなら、香りがよく分かります"],
    ["初めてで加減が分からなくて。もう一度、吸い方を聞いてもいいですか？", "ホースを口元まで持ち上げては下ろす。胸の前で小さく手を上げた。", "息を整えてから、もう一回やってみます"],
    ["…吸うたびにむせちゃうな。コツってありますか？", "続けざまに吸って、口元を押さえた。ホースを握ったまま呼吸を整えている。", "間を空けると楽ですね。今度はむせなかった"],
  ]),
  chatty: call("chat", "話したそう", [
    ["これ、おいしいですね。何を混ぜてるんですか？", "こちらを見て、目が合うとにこっと笑った。", "へえ、そうなんだ。また頼もうかな"],
    ["この香り、最後にふわっと来ますね。何の葉だろう", "煙を吐いて口元をほころばせた。目が合うと、ミックスの札を指さした。", "聞いたあとだと、いっそう香りますね"],
    ["こういう組み合わせ、初めてです。よく出るんですか？", "ミックスの名前を指でなぞり、通りかかるこちらに笑いかけた。", "好みがひとつ増えました"],
    ["最初と今とで香りが違う気がします。面白いですね、これ", "ひと口ごとに少し考え込んでいる。目が合うと、話しかけるように体を向けた。", "今度は違う香りも試したくなりました"],
  ]),
});

/** 外した時の一言（ケアごとに分けない。責めない言い方にする）。 */
export const CALL_MISS = Object.freeze([
  "えっと、そうじゃなくて……",
  "すみません、お願いしたかったのは別のことなんです",
  "…ごめんなさい。伝え方が悪かったかな",
  "ありがとう。でも、そっちじゃないんです",
]);

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
  first: night("first", "はじめてのワンオペ", "客足はゆっくり。まずは六人", 320, [4, 10, 70, 130, 190],
    ["first", "worker", "train", "reader", "worker"]),
  usual: night("usual", ["いつもの昼", "いつもの夜"], "いつもどおり。十人ほど", 360, [4, 9, 14, 80, 130, 180, 230],
    ["first", "reader", "train", "walkers", "worker", "nose", "talkers"]),
  friday: night("friday", ["昼休みの波", "終電前の夜"], ["昼休みの短い客が続く", "終電までの短い客が続く"], 360, [4, 8, 12, 60, 100, 140, 180, 220, 260],
    ["train", "worker", "talkers", "worker", "students", "train", "nose", "worker", "first"]),
  rain: night("rain", ["雨の昼下がり", "雨の夜"], "雨で、長居の客が多い", 372, [4, 9, 14, 70, 130, 190, 240],
    ["reader", "walkers", "elder", "first", "friends", "worker", "talkers"]),
  newcomers: night("newcomers", "初めてさんの日", "初めての客が多い", 360, [4, 9, 14, 70, 120, 170, 220, 260],
    ["first", "students", "first", "reader", "students", "worker", "first", "train"]),
  full: night("full", "満席の日", "卓がずっと埋まりそうだ", 384, [4, 8, 12, 16, 20, 90, 135, 180, 220, 255, 285],
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

/** 営業の評価。min＝全組の満足の平均。 */
export const RANKS = Object.freeze([
  Object.freeze({ id: "S", stamp: "大入り", min: 88, line: "文句なしだ。一人で、店じゅうをいい顔にして帰した" }),
  Object.freeze({ id: "A", stamp: "上々", min: 74, line: "いい営業だった。卓の様子が、よく見えていたぞ" }),
  Object.freeze({ id: "B", stamp: "まずまず", min: 56, line: "回せてはいた。次は、待たせている卓から先に見ろ" }),
  Object.freeze({ id: "C", stamp: "ばたばた", min: 0, line: "ばたついたな。まあ、一人で回せば最初はこうだ" }),
]);

/**
 * チュートリアル（2026-11-25 オーナー「またチュートリアルを作りたい」・TFL64）。はじめての店番の前に、スミさんが横について一通りやらせる。
 * 一つずつ「やること」を出し、それ以外の操作は受けない（やることが済むと次へ）。時間は、待つ段（仕込み・入れ替え）だけ流れる。
 * 客と並ぶミックスは決めてある（tonari-floor-model.js の createFloorTutorial）。text＝スミさんの言葉（台詞なので句点で終えない）、
 * panel＝接客の画面の中で読む言葉（その段は画面の中に出す）。並びと段の中身は tonari-floor-view.js の TUTORIAL_FLOW。
 */
export const TUTORIAL = Object.freeze({
  hello: "一通りやってみるぞ。客は来たら、空いてる卓に勝手に座る",
  arrive: "……来たな。卓の上を見てろ",
  wish: "札の色と印が、客の吸いたい気分だ。りんごの印は、フルーティ",
  open: "1卓を押して、注文を聞いてこい",
  pick: "札の左の大きい印が、客の気分と同じなら◎だ。◎の一台を出せ",
  prep: "仕込みは勝手に進む。仕上がれば、卓へ運ばれる",
  shuffle: "2卓はリラックスの気分だが、合う一台が並んでない。シャッフルで入れ替えろ",
  shuffling: "入れ替えの間は出せない。待たせた分だけ、客の満足は下がるぞ",
  quick: "右の一覧の札を押せば、そのまま出せる。◎の札を押せ",
  prep2: "出した一台は一覧から抜けて、次のが入る",
  care: "1卓の様子が変わった。押して、頼みを聞いてこい",
  careAnswer: "むせてるな。吸い方を案内してやれ",
  tend: "2卓の炭が減ってきた。言われる前に整えに行け。押すだけでいい",
  bill: "1卓がお会計だ。会計も、押すだけでいい",
  fever: "いい接客をすると、フィーバーの灯りが溜まる。光っているボタンを押してみろ",
  feverWait: "フィーバーの間は、卓が最高の居心地になる。灯りが減っていくのを見てろ",
  feverStop: "もう一度押せば切れるぞ。使わなかった灯りは、次に取っておける",
  done: "……一通りは以上だ。あとは本番で、手際を見せろ",
  nudge: "そこじゃない。光ってる所だ",
});
