// tonari フロア営業の台本（価格・配合・客・合図・夜の種類）。ルールは tonari-floor-model.js、画面は tonari-floor-view.js。
// 価格は店の売上の内訳。はじめの所持金には入らない（日当と売上ボーナスは tonari.js が渡す）。
export const PRICE = Object.freeze({
  seat: 500, drink: 400, refill: 400, top: 800,
  shisha: Object.freeze({ short: 1400, normal: 1600, long: 1800 }),
});

/** 提供してからの滞在（1刻み＝店内0.5秒相当）。 */
export const STAY = Object.freeze({ short: 46, normal: 64, long: 86 });
export const STAY_LABEL = Object.freeze({ short: "ショート", normal: "ふつう", long: "ゆっくり" });

// 配合は tonari.js の SHIFT_ORDERS と同じ並び（family＝注文ID、index＝二択の順）。
// 「今日の注文」の客が受け取った一台は、既存の反応・前回の想起（#1073・#1415）へそのまま渡す。
const mix = (family, index, label, note) => ({ id: `${family}:${index}`, family, index, label, note });
export const MIXES = Object.freeze(Object.fromEntries([
  mix("citrus", 0, "レモン＋ミント", "酸味・すっと涼しい"),
  mix("citrus", 1, "オレンジ＋レモン", "酸味・オレンジの香り"),
  mix("fruit_mint_free", 0, "ブルーベリー＋ピーチ", "果実・桃のやわらかい甘さ"),
  mix("fruit_mint_free", 1, "グレープ＋オレンジ", "果実・ぶどうの濃い香り"),
  mix("sweet_round", 0, "バニラ＋ココナッツ", "お菓子・ココナッツ"),
  mix("sweet_round", 1, "ピーチ＋バニラ", "お菓子・桃の香り"),
  mix("double_apple", 0, "ダブルアップル＋ミント少量", "定番・後味が少し涼しい"),
  mix("double_apple", 1, "ダブルアップル単体", "定番・香りそのまま"),
  mix("ch2_after_work", 0, "グレープフルーツ＋ミント", "柑橘・すっと抜ける"),
  mix("ch2_after_work", 1, "キウイ＋レモン", "果物の酸味・しゃきっと"),
  mix("ch2_strawberry_light", 0, "苺＋レモン", "苺・酸味で締める"),
  mix("ch2_strawberry_light", 1, "苺＋ピーチ", "苺・やわらかい甘さ"),
  mix("ch2_night_deep", 0, "紅茶＋レモン", "落ち着く・後味すっきり"),
  mix("ch2_night_deep", 1, "キャラメル＋紅茶", "どっしり・香ばしい甘さ"),
  mix("ch2_tropical_compare", 0, "マンゴー＋パッションフルーツ", "南国・甘酸っぱい"),
  mix("ch2_tropical_compare", 1, "スイカ＋ミント", "みずみずしい・涼しい"),
].map((m) => [m.id, Object.freeze(m)])));

// 客の言葉。best＝ぴったりの一台。同じ注文のもう片方は「悪くない」、off は外れ（言葉とはっきり食い違う一台）。
const wish = (best, off, quote) => Object.freeze({ best, off, quote });
export const WISHES = Object.freeze([
  wish("citrus:0", "sweet_round:0", "柑橘でさっぱり。口に少し涼しさが残ると嬉しいな"),
  wish("citrus:0", "double_apple:1", "すっぱくて、吸ったあとがすーっとするのがいいです"),
  wish("citrus:1", "double_apple:0", "甘すぎない柑橘で。涼しさより、オレンジの香りが好きです"),
  wish("citrus:1", "sweet_round:1", "みかんの皮をむいた時みたいな香りって、ありますか？"),
  wish("fruit_mint_free:0", "citrus:0", "ミントは抜きで、桃がふわっと甘いのをお願いします"),
  wish("fruit_mint_free:0", "double_apple:0", "ベリーの甘酸っぱさがいいな。すーすーするのは苦手で"),
  wish("fruit_mint_free:1", "double_apple:0", "ミントなしで、ぶどうの香りが濃いほうをお願いします"),
  wish("fruit_mint_free:1", "citrus:0", "ぶどうジュースみたいなのがいい。ミントは入れないで"),
  wish("sweet_round:0", "citrus:0", "果物よりお菓子っぽく。ココナッツの焼き菓子みたいな甘さで"),
  wish("sweet_round:0", "double_apple:0", "甘くて丸いのを。南の島のお菓子みたいな香りがいいな"),
  wish("sweet_round:1", "double_apple:1", "甘いのがいいな。桃のお菓子みたいに、果物の香りも残して"),
  wish("sweet_round:1", "citrus:0", "桃のアイスみたいな感じって、できますか？"),
  wish("double_apple:0", "citrus:0", "ダブルアップルを。涼しい後味がほんの少しあるといいな"),
  wish("double_apple:0", "sweet_round:1", "定番のダブルアップルで。少しだけ、すっとさせてください"),
  wish("double_apple:1", "sweet_round:0", "ダブルアップルの香りだけ、そのまま楽しみたいな"),
  wish("double_apple:1", "citrus:1", "ダブルアップル、何も足さずにお願いします"),
  wish("ch2_after_work:0", "ch2_night_deep:1", "仕事帰りで頭が重くて。すっと抜ける、涼しいのがいいな"),
  wish("ch2_after_work:0", "ch2_strawberry_light:1", "苦すぎない柑橘に、ミントをきかせてほしいです"),
  wish("ch2_after_work:1", "ch2_night_deep:1", "頭をしゃきっとさせたい。ミントじゃなく、果物の酸味で"),
  wish("ch2_after_work:1", "ch2_tropical_compare:1", "キウイってありますか？ すーすーしないほうが好きで"),
  wish("ch2_strawberry_light:0", "ch2_night_deep:1", "苺がいいな。甘ったるくならないよう、酸味で締めてほしい"),
  wish("ch2_strawberry_light:0", "ch2_tropical_compare:0", "苺を、きゅっと酸っぱいほうでお願いします"),
  wish("ch2_strawberry_light:1", "ch2_night_deep:0", "苺を。酸っぱいのは苦手だから、やわらかい甘さで"),
  wish("ch2_strawberry_light:1", "ch2_after_work:0", "苺と桃みたいな、やさしい甘さってできますか？"),
  wish("ch2_night_deep:0", "ch2_tropical_compare:1", "夜だし、紅茶みたいに落ち着くのを。後味はすっきりで"),
  wish("ch2_night_deep:0", "ch2_strawberry_light:1", "甘さは控えめで。レモンティーみたいなのがいいです"),
  wish("ch2_night_deep:1", "ch2_strawberry_light:0", "どっしりしたのがいいな。紅茶に、香ばしい甘さを少し"),
  wish("ch2_night_deep:1", "ch2_after_work:1", "キャラメルの香ばしさを、紅茶で落ち着かせた感じで"),
  wish("ch2_tropical_compare:0", "ch2_night_deep:1", "南国の果物を。甘酸っぱくて、香りの濃いのが好きです"),
  wish("ch2_tropical_compare:0", "ch2_after_work:0", "マンゴーみたいな、とろっとした甘酸っぱさがいいな"),
  wish("ch2_tropical_compare:1", "ch2_night_deep:1", "夏っぽく、みずみずしいのを。後味は涼しいほうで"),
  wish("ch2_tropical_compare:1", "ch2_strawberry_light:1", "スイカって頼めますか？ すっと涼しくしてほしいです"),
]);

/** その章で店が出す注文（家族）。第2章は第1章の定番も残る。 */
export const FAMILIES = Object.freeze({
  1: Object.freeze(["citrus", "fruit_mint_free", "sweet_round", "double_apple"]),
  2: Object.freeze(["ch2_after_work", "ch2_strawberry_light", "ch2_night_deep", "ch2_tropical_compare",
    "citrus", "fruit_mint_free", "sweet_round", "double_apple"]),
});

// 名もない客。常連帳・好感度は作らない（#1267）。calls は提供後に出うる合図の候補（先頭から使う）。
// name が [昼, 夜] の客は、シフトの時間帯で呼び名が変わる。
const guest = (id, name, party, stay, calls, look) => Object.freeze({ id, name, party, stay, calls: Object.freeze(calls), look: Object.freeze(look) });
export const GUESTS = Object.freeze(Object.fromEntries([
  guest("first", "初めての方", 1, "normal", ["ask", "thin"], ["bob"]),
  guest("worker", ["仕事の合間の方", "仕事帰りの方"], 1, "short", ["harsh"], ["short"]),
  guest("train", ["昼休みの二人", "終電前の二人"], 2, "short", ["glass"], ["cap", "long"]),
  guest("reader", "読書の方", 1, "long", ["focus", "glass"], ["glasses"]),
  guest("walkers", "散歩帰りの二人", 2, "long", ["thin", "glass"], ["pony", "short"]),
  guest("nose", "香り好きの方", 1, "normal", ["harsh", "thin"], ["bun"]),
  guest("students", "学生の二人", 2, "normal", ["ask", "glass"], ["curly", "cap"]),
  guest("talkers", "話し込む二人", 2, "normal", ["focus", "glass"], ["long", "bob"]),
  guest("elder", "年配の方", 1, "long", ["harsh", "focus"], ["hat"]),
  guest("friends", "友だち同士の二人", 2, "long", ["glass", "ask"], ["bun", "pony"]),
].map((g) => [g.id, g])));

// 手入れの言葉は固定の5つ。並びを変えない（押す位置を手が覚える）。
export const VERBS = Object.freeze([
  Object.freeze({ id: "add", label: "炭を替える", note: "熱を足す" }),
  Object.freeze({ id: "ease", label: "炭を下ろす", note: "熱を逃がす" }),
  Object.freeze({ id: "drink", label: "飲み物を聞く", note: "グラスを見る" }),
  Object.freeze({ id: "talk", label: "ひと声かける", note: "話を聞く" }),
  Object.freeze({ id: "leave", label: "そっとしておく", note: "声はかけない" }),
]);

// 合図。label は卓の吹き出しの短い言葉、sight は読み取る夜（!だけ出る夜）に伝票へ出す様子、
// said は言葉で伝える夜の一言。good は正しく応えた時、verb が正解の手入れ。
export const CALLS = Object.freeze({
  thin: Object.freeze({ verb: "add", label: "煙が薄い", said: "あの、煙が薄くなってきたみたいで",
    sight: "煙が細い。ホースを見て、首をかしげている。", good: "あ、戻ってきた。ありがとう" }),
  harsh: Object.freeze({ verb: "ease", label: "喉にくる", said: "すみません、少し喉にくるかも",
    sight: "小さく咳をして、ホースをそっと置いた。", good: "うん、やわらかくなった" }),
  glass: Object.freeze({ verb: "drink", label: "グラスが空", said: "同じのを、もう一杯いいですか？",
    sight: "氷だけになったグラスを、からからと揺らしている。", good: "ありがとう。ちょうど欲しかったんだ", refill: true }),
  ask: Object.freeze({ verb: "talk", label: "聞きたそう", said: "あの……吸い方、これで合ってますか？",
    sight: "こちらを見て、目が合うと小さく手を上げた。", good: "よかった、合ってたんですね" }),
  focus: Object.freeze({ verb: "leave", label: "夢中", said: "……",
    sight: "手元に夢中で、こちらには気づいていない。煙はよく出ている。", good: "（声はかけずに、そっと離れた）", quiet: true }),
});
/** 外した時の一言（合図ごとに分けない。責めない言い方にする）。 */
export const CALL_MISS = "えっと、そうじゃなくて……";
export const CALL_DISTURBED = "あ、今は大丈夫です";

/** 提供した時の一言。 */
export const SERVE_LINES = Object.freeze({
  best: Object.freeze(["うん、これ。この香りが欲しかった", "わ、ぴったり。よく分かりましたね", "そうそう、こういうのです"]),
  near: Object.freeze(["うん、悪くないね", "あ、こういうのもいいかも", "思ってたのと少し違うけど、おいしい"]),
  off: Object.freeze(["少し、思っていた香りと違うかも……", "あれ、頼んだのと違うような……"]),
  redo: Object.freeze(["こっちだ。作り直してくれて、ありがとう", "うん、今度はぴったり"]),
  top: Object.freeze(["さっきと違う香り、いいですね", "二台目みたいで得した気分"]),
});

// 会計の声かけ（お見送り）。客の顔を見て選ぶ: 笑顔＝もう少し誘える（延長）／ふつう＝お礼／曇り顔＝お詫び。並びは固定。
// 延長はトップ替え（PRICE.top）。一卓に一度まで。売上は店のもので、はじめの所持金には入らない。
export const SENDS = Object.freeze([
  Object.freeze({ id: "extend", label: "もう少し、いかがですか？", note: "トップ替えをすすめる" }),
  Object.freeze({ id: "thanks", label: "ありがとうございました", note: "お礼を言って見送る" }),
  Object.freeze({ id: "sorry", label: "お待たせして、すみません", note: "お詫びして見送る" }),
]);
/** 声かけへの返事。 */
export const SEND_LINES = Object.freeze({
  extend: "じゃあ、もう少しだけ。違う香りも試したい",
  extendMiss: "いえ、今日はこれで",
  thanks: Object.freeze(["ごちそうさま。また来ます", "いい時間でした。ありがとう"]),
  thanksLow: "……どうも",
  sorry: "いえ、大丈夫ですよ。また来ます",
  sorryOdd: "え？ いえいえ、楽しかったですよ",
});

// 今日の段取り（始める前に一つ）。効き目は model の PLAN_EFFECT。
export const PLANS = Object.freeze([
  Object.freeze({ id: "prep", label: "仕込みを先に済ませる", note: "一台が早く仕上がる" }),
  Object.freeze({ id: "coal", label: "炭を多めに熾しておく", note: "合図を長く待ってもらえる" }),
  Object.freeze({ id: "register", label: "レジをスミさんに頼む", note: "会計はスミさんが受ける" }),
]);

// 営業の種類（一回のシフト）。arrive＝来店の刻み、cast＝客の並び。title・forecast が [昼, 夜] のものは時間帯で変わる。
// 最初の営業は合図を3種だけ・言葉で伝える。3回目から段取りを選べ、4回目から合図は様子を読む（model の level）。
const night = (id, title, forecast, length, arrive, cast) => Object.freeze({ id, title, forecast, length, arrive: Object.freeze(arrive), cast: Object.freeze(cast) });
export const NIGHTS = Object.freeze({
  first: night("first", "はじめてのフロア", "客足はゆっくり。まずは四組", 300, [4, 44, 92, 150],
    ["first", "worker", "train", "reader"]),
  usual: night("usual", ["いつもの昼", "いつもの夜"], "いつもどおり。六組ほど", 360, [4, 30, 60, 98, 148, 204],
    ["first", "reader", "train", "walkers", "worker", "nose"]),
  friday: night("friday", ["昼休みの波", "終電前の夜"], ["昼休みの短い客が続く", "終電までの短い客が続く"], 360, [4, 24, 46, 72, 108, 150, 208],
    ["train", "worker", "talkers", "worker", "students", "train", "nose"]),
  rain: night("rain", ["雨の昼下がり", "雨の夜"], "雨で、長居の客が多い", 372, [4, 28, 56, 90, 132, 178, 226],
    ["reader", "walkers", "elder", "first", "friends", "worker", "talkers"]),
  newcomers: night("newcomers", "初めてさんの日", "初めての客が多い", 360, [4, 28, 54, 86, 124, 170, 222],
    ["first", "students", "first", "reader", "students", "worker", "first"]),
  full: night("full", "満席の日", "入口に列ができそうだ", 384, [4, 20, 38, 58, 84, 124, 170, 222],
    ["train", "nose", "walkers", "worker", "friends", "students", "elder", "train"]),
});
/** [昼, 夜] で分かれる言葉を、シフトの時間帯で選ぶ。 */
export const byTime = (value, daytime) => (Array.isArray(value) ? value[daytime ? 0 : 1] : value);

/** 営業の評価。min＝全組の満足の平均。bonus＝店からの売上ボーナス（チップではない）。 */
export const RANKS = Object.freeze([
  Object.freeze({ id: "S", stamp: "大入り", min: 88, bonus: 1500, line: "文句なしだ。店じゅうが、いい顔で帰っていった" }),
  Object.freeze({ id: "A", stamp: "上々", min: 74, bonus: 1000, line: "いい営業だった。卓の様子が、よく見えていたぞ" }),
  Object.freeze({ id: "B", stamp: "まずまず", min: 55, bonus: 500, line: "回せてはいた。次は、待たせている卓から先に見ろ" }),
  Object.freeze({ id: "C", stamp: "ばたばた", min: 0, bonus: 0, line: "ばたついたな。まあ、初めは誰でもこうだ" }),
]);
