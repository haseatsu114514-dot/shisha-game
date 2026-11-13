// カードゲーム「一台勝負」のカードと数値。ルールの正本は docs/design/card_game/（第0.7版のルールブックと cards.js）。
// ここはゲーム内で動かすための写しで、名前・数値・文がルールブックとずれないことを remake/test/ichidai_rules.mjs が確かめる。
// 画面にも規則にも依らない純データ（DOM・保存に触れない）。

/** 葉の系統。k=しるしの1文字 */
export const KINDS = Object.freeze({
  fruit: { name: "フルーツ", k: "果" }, cool: { name: "清涼", k: "涼" }, spice: { name: "スパイス", k: "香" },
  floral: { name: "フローラル", k: "花" }, sweet: { name: "スイート", k: "甘" }, none: { name: "なし", k: "—" },
});

// t=味値 lo〜hi=適温 j=ジャスト s=焦げライン（99は焦げない） pair=相性の系統
export const FLAVORS = Object.freeze([
  { id: "lemon", name: "レモン", brand: "アルファーヘブン", kind: "fruit", t: 2, lo: 4, hi: 6, j: [4, 5, 6], s: 8, pair: "cool", ab: "【表情】適温のどこでもジャスト。" },
  { id: "peach", name: "ピーチ", brand: "ドバジ", kind: "fruit", t: 3, lo: 3, hi: 5, j: [4], s: 6, pair: "floral", ab: "【やわらか】脇役のとき、下側のズレを適温として扱う。" },
  { id: "mango", name: "マンゴー", brand: "ドバジ", kind: "fruit", t: 4, lo: 5, hi: 6, j: [6], s: 7, pair: "sweet", ab: "" },
  { id: "blueberry", name: "ブルーベリー", brand: "アルファーヘブン", kind: "fruit", t: 3, lo: 4, hi: 6, j: [5], s: 7, pair: "cool", ab: "" },
  { id: "mint", name: "ミント", brand: "アルファーヘブン", kind: "cool", t: 2, lo: 3, hi: 6, j: [4, 5], s: 9, pair: "fruit", ab: "【クッション】脇役のとき、主役の焦げラインを+1する。" },
  { id: "ice_grape", name: "アイスグレープ", brand: "アルファーヘブン", kind: "cool", t: 3, lo: 3, hi: 5, j: [4], s: 7, pair: "sweet", ab: "" },
  { id: "cool_mint", name: "クールミント", brand: "アルファーヘブン", kind: "cool", t: 3, lo: 4, hi: 7, j: [6], s: 9, pair: "fruit", ab: "【キレ】脇役のとき、上側のズレを適温として扱う。" },
  { id: "death_by_ice", name: "デスバイアイス", brand: "フォースフェクタ", kind: "cool", t: 4, lo: 6, hi: 8, j: [8], s: 9, pair: "none", ab: "【強烈】1枚でもボウルにあれば、枚数に関係なく主役になる。" },
  { id: "double_apple", name: "ダブルアップル", brand: "アルファーヘブン", kind: "spice", t: 3, lo: 6, hi: 8, j: [7], s: 10, pair: "none", ab: "【原点】ボウルがこの葉だけなら、適温の一口+1。" },
  { id: "cinnamon", name: "シナモン", brand: "アルファーヘブン", kind: "spice", t: 3, lo: 6, hi: 8, j: [7], s: 99, pair: "sweet", ab: "【耐熱】焦げない。" },
  { id: "cardamom", name: "カルダモン", brand: "アフサール", kind: "spice", t: 4, lo: 5, hi: 6, j: [6], s: 7, pair: "floral", ab: "" },
  { id: "black_tea", name: "ブラックティー", brand: "アフサール", kind: "spice", t: 3, lo: 5, hi: 7, j: [6], s: 9, pair: "fruit", ab: "【下支え】脇役のとき、濃厚の条件が「8枚以上」になる。" },
  { id: "rose", name: "ローズ", brand: "アフサール", kind: "floral", t: 4, lo: 3, hi: 4, j: [4], s: 5, pair: "fruit", ab: "" },
  { id: "lavender", name: "ラベンダー", brand: "アルファーヘブン", kind: "floral", t: 3, lo: 3, hi: 5, j: [4], s: 7, pair: "sweet", ab: "【鎮静】ボウルに2枚以上あれば、相手のカードで自分の炭と判定熱は変わらない。" },
  { id: "jasmine", name: "ジャスミン", brand: "アフサール", kind: "floral", t: 3, lo: 4, hi: 6, j: [5], s: 7, pair: "fruit", ab: "【余韻】ボウルに2枚以上あれば、各セッション最後の一口+1。" },
  { id: "spring_water", name: "スプリングウォーター", brand: "アフサール", kind: "floral", t: 1, lo: 2, hi: 8, j: [], s: 10, pair: "none", ab: "【つなぎ】ほかの葉があるかぎり主役にならない。脇役のとき、主役の相性を必ず満たす。" },
  { id: "vanilla", name: "バニラ", brand: "アルファーヘブン", kind: "sweet", t: 3, lo: 5, hi: 7, j: [6], s: 8, pair: "spice", ab: "【NG：ミント】ミントと2枚ずつ以上重なると、ミックスと相性の加点なし。" },
  { id: "white_gummy_bear", name: "ホワイトグミベア", brand: "フワリ", kind: "sweet", t: 3, lo: 4, hi: 6, j: [5], s: 8, pair: "fruit", ab: "" },
  { id: "chocolate", name: "チョコレート", brand: "ドバジ", kind: "sweet", t: 4, lo: 5, hi: 6, j: [6], s: 7, pair: "cool", ab: "" },
  { id: "coffee", name: "コーヒー", brand: "ドバジ", kind: "sweet", t: 4, lo: 7, hi: 8, j: [8], s: 9, pair: "sweet", ab: "" },
]);

export const BOWLS = Object.freeze([
  { id: "silicone", name: "シリコンボウル", cap: 12, ab: "【扱いやすい】ゲーム中1回、自分の焦げを取り消す。葉を失わず、その一口はズレ（1点）になる。" },
  { id: "beat80", name: "80beatハガル", cap: 15, ab: "【大口】「詰める」で5枚まで取れる。" },
  { id: "funnel", name: "雲窯ファンネルハガル", cap: 16, ab: "【蜜だまり】セッションの終わりに減る葉が1枚になる。" },
  { id: "clay", name: "素焼きハガル", cap: 20, ab: "【育つ器】単品なら毎口+1。2種類以上入っているあいだは濃厚にならない。" },
]);

export const HMDS = Object.freeze([
  { id: "lotus", name: "ロートスHMD", ab: "【均一】各セッション1回、ズレの一口を適温として採点する。" },
  { id: "tanukish", name: "タヌキッシュリッド", ab: "【素直】炭を外したら、カードを1枚引く（1ターンに1回）。素焼きハガルとは組めない。" },
  { id: "amaburst", name: "アマバースト", ab: "【高火力】自分の判定熱はつねに+1。" },
  { id: "big_tanukish", name: "ビッグタヌキッシュリッド", ab: "【熱持ち】各セッション最初の自分のターンは冷めない。" },
  // 炭1個で回す低温用のHMD（2026-11-11 オーナー「機材によっては1個でいけるのとかある。低温用の」「実際にそういう機材あるから作る」）
  { id: "one_coal", name: "C1", ab: "【一つ火】置ける炭は2つまで。炭が1つだけのあいだ、冷めない。" },
]);

// type: coal=炭 / tech=技 / tool=器具 / person=人物 / event=イベント
// need: 必要な熱。自分の熱（＝火力ゾーンの炭の火の合計）がこの数以上なら使える。払わない（第0.7版で「必要火力」から言い換えた。数は同じ）
// pay: 使うために落とすもの（第0.3版。2026-11-11 オーナー「炭を使うのではなく、火力を落として発動って感じ」。第0.7版で「熱を落として使う」）。
//      fire=熱をその数だけ落とす（火のいちばん小さい炭から、火を1ずつ下げる）。leaf=主役の葉をその数だけ減らす。必要な熱は落とす前の熱で見る
// extra: 使ったあと、このターンにカードをもう1枚使える（自分のターンに1枚の枠を返す）
// when: turn=手番 / puff=一口（提供の自分のターンに、そのラウンドの自分の一口へ仕込む。めくる前に決める） / prep=準備 / any=いつでも（自分のターンならどのフェイズでも）
// 炭カードだけ: ig=着火（焼けるまでのターン数） heat=新品の火（のせたときの火。冷めるたびに1ずつ下がり、0で灰。回復しない）
export const CARDS = Object.freeze([
  { id: "flat", name: "フラット炭", type: "coal", ig: 1, heat: 2, tx: "火2。【早い】置いた次の自分のターンに焼ける。" },
  { id: "cube", name: "キューブ炭", type: "coal", ig: 2, heat: 3, tx: "火3。【火持ち】火が大きく、長くもつ。焼けるまで2ターン。" },
  { id: "dense_flat", name: "高密度フラット炭", type: "coal", ig: 1, heat: 2, tx: "火2。【早い】置いた次の自分のターンに焼ける。火力ゾーンにのせたとき、カードを1枚引く。" },
  { id: "heat_in", name: "熱を入れる吸い", type: "tech", need: 1, when: "puff", tx: "この一口の判定熱+1。適温かジャストになったら、さらに印象+1。" },
  { id: "heat_out", name: "熱を逃がす吸い", type: "tech", need: 6, when: "puff", tx: "この一口の判定熱−2。適温かジャストになったら、さらに+1点。" },
  { id: "blow", name: "ブロー", type: "tech", need: 4, when: "puff", tx: "この一口、自分は焦げない。焦げライン以上なら適温として採点する。" },
  { id: "show_smoke", name: "見せ煙", type: "tech", need: 3, pay: { leaf: 1 }, when: "puff", tx: "葉を1枚減らして使う。この一口の印象+4。" },
  { id: "all_in", name: "渾身の一口", type: "tech", need: 6, pay: { fire: 1 }, when: "puff", tx: "熱を1落として使う。この一口がジャストなら、さらに+3点・印象+2。" },
  { id: "duel", name: "勝負の一服", type: "tech", need: 3, when: "puff", tx: "この審査で一票を取ったら、さらに+3点。" },
  { id: "read", name: "吸い方を読む", type: "tech", need: 0, when: "turn", tx: "次のラウンドの審査カードを、自分だけ先に見る。" },
  { id: "ash_tap", name: "灰落とし", type: "tech", need: 3, when: "turn", tx: "次の自分のターン、冷めない。" },
  { id: "add_coal", name: "追い炭", type: "tech", need: 0, extra: 1, when: "turn", tx: "山札の上から2枚までを、裏向きのまま種火（火1）として、空いている炭の枠に置く。このターン、カードをもう1枚使える。" },
  { id: "tongs", name: "トングさばき", type: "tech", need: 3, pay: { fire: 1 }, extra: 1, when: "turn", tx: "熱を1落として使う。カードを2枚引く。このターン、カードをもう1枚使える。" },
  { id: "fan", name: "火おこし", type: "tech", need: 1, when: "any", tx: "自分の炭焼き場の炭を、すべて1段階進める。" },
  { id: "inner", name: "内寄せ", type: "tech", need: 3, when: "turn", tx: "このセッションの終わりまで、自分の印象+1。" },
  { id: "outer", name: "外寄せ", type: "tech", need: 4, when: "turn", tx: "このセッションの終わりまで、自分の判定熱−1。" },
  { id: "loosen", name: "葉をほぐす", type: "tech", need: 3, when: "turn", tx: "このセッションの終わりに、自分の葉は減らない。" },
  { id: "breath", name: "ひと息", type: "tech", need: 0, extra: 1, when: "turn", tx: "カードを1枚引く。このターン、カードをもう1枚使える。" },
  { id: "reset", name: "仕切り直し", type: "tech", need: 5, pay: { fire: 2 }, extra: 1, when: "turn", tx: "熱を2落として使う。カードを3枚引く。このターン、カードをもう1枚使える。" },
  { id: "windguard", name: "風防", type: "tool", need: 2, when: "any", tx: "風防カウンターを2個のせて出す。冷めるとき、炭の火を1下げるかわりにカウンターを1個取ってよい。0個になったら灰へ。相手のカードで自分の炭は弱まらない。" },
  { id: "chacosta", name: "チャコスタ", type: "tool", need: 3, when: "any", tx: "自分のターンのはじめ、炭焼き場に炭が3つ以上あれば、カードを1枚引く。" },
  { id: "timer", name: "キッチンタイマー", type: "tool", need: 1, when: "any", tx: "自分のターンのはじめに炭が焼けたら、カードを1枚引く（1ターンに1枚まで）。" },
  { id: "ice_hose", name: "アイスホース", type: "tool", need: 4, when: "any", tx: "上側のズレを適温として扱う。" },
  { id: "diffuser", name: "ディフューザー", type: "tool", need: 3, when: "any", tx: "ズレの一口でも、ミックスと相性の加点を得る。" },
  { id: "hype", name: "実況の煽り", type: "event", need: 5, when: "turn", tx: "相手の次の一口の判定熱+1。" },
  { id: "draft", name: "すきま風", type: "event", need: 3, when: "turn", tx: "相手の炭を1つ、相手が選んで火を1下げる。" },
  { id: "venue_heat", name: "会場の熱気", type: "event", need: 2, when: "turn", tx: "全員の次の一口の判定熱+1。" },
  { id: "go_second", name: "後の先", type: "event", need: 1, when: "turn", tx: "次のラウンド、自分が後手になる。" },
  { id: "buyout", name: "買い占め", type: "event", need: 0, when: "prep", tx: "このターンの「詰める」で、さらに2枚取れる。" },
  { id: "repack", name: "詰め直し", type: "event", need: 1, when: "prep", tx: "蒸らす前だけ。ボウルの葉を2枚まで場の山に戻し、同じ枚数を場から取る。" },
  { id: "encore", name: "アンコール", type: "event", need: 7, pay: { fire: 2 }, when: "puff", tx: "最終セッションだけ。熱を2落として使う。この一口の点をもう一度得る。" },
  { id: "sumi", name: "スミさん", type: "person", need: 3, when: "any", tx: "【炭を見る目】自分の炭カードは着火が1ターン早い（フラット炭は置いたターンにのせられる）。" },
  { id: "naru", name: "なる", type: "person", need: 2, when: "any", tx: "【甘さを追う】主役がスイートなら、ジャストの一口+1。" },
  { id: "adam", name: "アダム", type: "person", need: 3, when: "any", tx: "【手入れ大全】単品なら毎口+1。" },
  { id: "minto", name: "みんと", type: "person", need: 2, when: "any", tx: "【ひとりの時間】清涼の葉が2枚以上あれば、焦げても葉を失わない。" },
  { id: "mashiro", name: "ましろ", type: "person", need: 2, when: "any", tx: "【消さない量】脇役が2種類以上あれば、毎口+1。" },
  { id: "tsumugi", name: "つむぎ", type: "person", need: 2, when: "any", tx: "【預けた器】主役がフローラルなら、下側のズレを適温として扱う。" },
  { id: "packy", name: "パッキー", type: "person", need: 2, when: "any", tx: "【実況】相手が一票を取るたび、カードを1枚引く。" },
]);

export const TYPE_LABEL = Object.freeze({ coal: "炭", tech: "技", tool: "器具", person: "人物", event: "イベント" });
export const WHEN_LABEL = Object.freeze({ turn: "手番", puff: "一口", prep: "準備", any: "いつでも" });

// 審査カード（吸い方）。dh=全員の判定熱の変化 just=ジャストの追加点 band=適温の追加点 offZero=ズレが0点
export const PUFFS = Object.freeze({
  normal: { id: "normal", style: "ふつうに吸う", tx: "変化なし。", dh: 0 },
  happy: { id: "happy", style: "にこにこ吸う", tx: "適温の一口+1点。", dh: 0, band: 1 },
  measure: { id: "measure", style: "温度を測る", tx: "ジャストの一口+1点。ズレの一口は0点。", dh: 0, just: 1, offZero: true },
  long: { id: "long", style: "長く吸う", tx: "全員の判定熱+1。", dh: 1 },
  slow: { id: "slow", style: "ゆっくり吸う", tx: "全員の判定熱−1。", dh: -1 },
  strong: { id: "strong", style: "強く吸う", tx: "全員の判定熱+1。ジャストの一口+1点。", dh: 1, just: 1 },
  deep: { id: "deep", style: "深く吸う", tx: "全員の判定熱+2。", dh: 2 },
});

// 審査員。puffs=審査カード4枚（[吸い方, 枚数]）。bonus=ゲームの終わりの「決め手」
export const JUDGES = Object.freeze([
  { id: "kamizono", name: "上園 文太郎", motto: "おいしいねえ", puffs: [["normal", 2], ["happy", 1], ["slow", 1]], bonus: "伸び（最後のセッションの点−第1セッションの点）が大きい作り手に+4。同点なら全員+2。" },
  { id: "hakase", name: "チャコール博士", motto: "熱の記録", puffs: [["normal", 1], ["measure", 2], ["long", 1]], bonus: "焦げの回数が少ない作り手に+4（同数なら全員+2）。0回の作り手はさらに+2。" },
  { id: "sensu", name: "千須 豪", motto: "最後の一口", puffs: [["normal", 2], ["long", 2]], bonus: "最終ラウンドの一口の点が高い作り手に+5。同点なら全員+2。" },
  { id: "emir", name: "エミル・ユルマズ", motto: "受け継いだ手順", puffs: [["normal", 2], ["slow", 2]], bonus: "ゲーム終了時、ボウルに残った葉が多い作り手に+4。同数なら全員+2。" },
  { id: "taiyo", name: "ダ・シルヴァ太陽", motto: "熱の芯", puffs: [["normal", 1], ["strong", 2], ["deep", 1]], bonus: "ジャストの一口の回数が多い作り手に+4。同数なら全員+2。" },
]);

// 入門の一局（第0.7版）: はじめての人のための短い対戦。一台は詰めてあり、種火も置いてある。準備は「炭を焼く」2ターンだけ、
// 提供は2セッション（6ラウンド）。一票と決め手は無く、点は一口の点だけ。審査カードは、ふつう・にこにこ・ゆっくり・長く の4種。
// 大会の一覧（TOURNAMENTS）には入れない（設定の画面の「入門の一局」から始める）。rules は createGame の規則の上書き
export const INTRO = Object.freeze({
  kit: "s0", level: 0,
  tournament: Object.freeze({ id: "intro", name: "入門の一局", sessions: 2, judges: ["kamizono", "sensu"], task: null, blurb: "はじめての人へ。炭と熱だけの、短い一局。" }),
  rules: Object.freeze({ useVote: false, useBonus: false, prepack: true, autoEmbers: 3, prepTurns: 2, steamDraw: 1 }),
});

// 大会。sessions=セッション数（1セッション=3ラウンド） judges=審査員（空なら審査カードを使わず、毎回「ふつうに吸う」） task=課題フレーバー
export const TOURNAMENTS = Object.freeze([
  { id: "practice", name: "練習試合", sessions: 3, judges: [], task: null, blurb: "審査カードなし。毎回「ふつうに吸う」。はじめての一戦に。" },
  { id: "crown", name: "SMOKE CROWN CUP", sessions: 3, judges: ["kamizono", "hakase", "sensu"], task: "lemon", blurb: "課題はレモン。吸い方はおだやか。" },
  { id: "open_cloud", name: "HAZE: OPEN CLOUD", sessions: 3, judges: ["kamizono", "sensu", "hakase"], task: null, blurb: "課題なし。葉えらびから勝負。" },
  { id: "national", name: "HAZE: NATIONAL TOKYO", sessions: 4, judges: ["emir", "hakase", "sensu"], task: null, blurb: "4セッション。上にも下にも揺れる。" },
  { id: "grand", name: "HAZE: GRAND SMOKE", sessions: 4, judges: ["sensu", "emir", "taiyo"], task: null, blurb: "4セッション。吸い方が荒い。" },
]);

/** はじめての場（フレーバー場に並べる10種） */
export const FIRST_MARKET = Object.freeze(["lemon", "mint", "blueberry", "peach", "vanilla", "double_apple", "cinnamon", "black_tea", "rose", "mango"]);

// 組み済みの一式（デッキ40枚＋セッティング＋詰める葉のめやす）。plan は CPU が詰める葉で、人には「おすすめ」として見せる。
// ルールブックの組み済みデッキを元に、ゲーム内で4式が釣り合うように葉と数枚を入れ替えてある（確かめ方は remake/test/ichidai_rules.mjs）。
// 第0.5版（冷める1・審査カードを先にめくる・ダブルアップルのジャスト1つ）に合わせて、a・b・c の札を1〜2枚ずつ入れ替えた
// （つよいCPU同士・組み合わせと席と大会をそろえた1920局で a53・b45・c51・d51）
export const KITS = Object.freeze([
  { id: "a", tier: "advanced", name: "ミックスの構え型", bowl: "funnel", hmd: "lotus", plan: [["blueberry", 8], ["mint", 4]],
    blurb: "帯の真ん中に置き、吸いの技で受ける。相手は煽りで揺さぶる。",
    cards: [["flat", 8], ["dense_flat", 2], ["cube", 2], ["heat_in", 3], ["heat_out", 3], ["ash_tap", 2], ["add_coal", 2], ["breath", 1], ["inner", 2], ["blow", 2], ["all_in", 2], ["duel", 2], ["windguard", 2], ["timer", 1], ["diffuser", 1], ["hype", 2], ["go_second", 1], ["mashiro", 1], ["packy", 1]] },
  { id: "b", tier: "advanced", name: "単品の火持ち型", bowl: "clay", hmd: "amaburst", plan: [["double_apple", 12]],
    blurb: "キューブ炭で高い熱を保ち、濃い煙で点を重ねる。",
    cards: [["cube", 8], ["flat", 4], ["dense_flat", 1], ["heat_in", 2], ["inner", 2], ["ash_tap", 2], ["fan", 2], ["reset", 1], ["breath", 2], ["show_smoke", 3], ["all_in", 2], ["heat_out", 2], ["chacosta", 2], ["draft", 2], ["hype", 2], ["encore", 1], ["adam", 1], ["sumi", 1]] },
  { id: "c", tier: "advanced", name: "低温の攻め型", bowl: "silicone", hmd: "tanukish", plan: [["rose", 7], ["peach", 4]],
    blurb: "味値4のローズ。ジャストのすぐ上が焦げ。読む・逃がす・ブローで攻めきる。",
    cards: [["flat", 9], ["dense_flat", 2], ["heat_out", 3], ["heat_in", 3], ["blow", 2], ["read", 2], ["inner", 2], ["ash_tap", 2], ["tongs", 2], ["breath", 2], ["show_smoke", 1], ["duel", 2], ["windguard", 2], ["timer", 1], ["venue_heat", 1], ["go_second", 1], ["fan", 2], ["packy", 1]] },
  { id: "d", tier: "advanced", name: "一つ火の低温型", bowl: "funnel", hmd: "one_coal", plan: [["peach", 8], ["rose", 5]],
    blurb: "キューブ炭1つで低い熱を保つ。炭を足す手間が少ないぶん、手札を技に回す。",
    cards: [["cube", 5], ["flat", 4], ["dense_flat", 1], ["heat_in", 3], ["show_smoke", 2], ["duel", 2], ["blow", 1], ["read", 3], ["inner", 2], ["breath", 2], ["tongs", 1], ["loosen", 2], ["ash_tap", 2], ["fan", 1], ["windguard", 1], ["timer", 1], ["diffuser", 1], ["draft", 1], ["venue_heat", 1], ["go_second", 1], ["buyout", 1], ["minto", 1], ["packy", 1]] },
]);

// 基本のカード（第0.7版）: 文がそれだけで読めて、条件や例外を持たないもの。基本の一式はこの中だけで組む。
// これ以外（人物・相手の判定熱を動かすカード・「もう1枚使える」と熱を落とすカードの組・条件つきの器具）は上級の一式で使う
export const BASIC_CARDS = Object.freeze(["flat", "cube", "dense_flat", "heat_in", "heat_out", "blow", "show_smoke", "all_in", "duel", "read", "ash_tap", "fan", "inner", "breath", "windguard", "timer", "draft"]);
// 基本の一式（第0.7版。オーナー「カードやデッキによって難しい戦略も取れるに寄せたい」）: 基本のカードと、能力の無い葉だけ。
// 深さ（人物・イベント・条件つきの葉と機材）は、上の4つ（上級の一式）とデッキ構築で足す
export const BASIC_KITS = Object.freeze([
  { id: "s1", tier: "basic", name: "まんなかの一台", bowl: "silicone", hmd: "lotus", plan: [["blueberry", 8], ["ice_grape", 4]],
    blurb: "適温が広く、焦げにくい。まずはこれ。★の熱5を保つ。",
    cards: [["flat", 9], ["dense_flat", 2], ["cube", 2], ["heat_in", 3], ["heat_out", 3], ["blow", 2], ["all_in", 2], ["duel", 2], ["show_smoke", 2], ["read", 2], ["ash_tap", 3], ["inner", 2], ["fan", 1], ["breath", 2], ["windguard", 2], ["timer", 1]] },
  { id: "s2", tier: "basic", name: "低い熱の一台", bowl: "funnel", hmd: "one_coal", plan: [["ice_grape", 8], ["white_gummy_bear", 2]],
    blurb: "炭は2つまで。キューブ炭1つなら冷めない。★の熱4を、少ない手で保つ。",
    cards: [["cube", 5], ["flat", 5], ["dense_flat", 2], ["heat_in", 3], ["blow", 2], ["show_smoke", 2], ["duel", 2], ["read", 3], ["ash_tap", 2], ["inner", 3], ["fan", 2], ["breath", 3], ["windguard", 2], ["timer", 2], ["draft", 2]] },
]);
/** 入門の一局の一式: 炭3種と技6種だけ（一票が無いので、印象のカードは入れない） */
export const INTRO_KIT = Object.freeze({ id: "s0", tier: "intro", name: "はじめての一台", bowl: "silicone", hmd: "lotus", plan: [["blueberry", 8], ["ice_grape", 4]],
  blurb: "炭と熱だけを覚える一台。",
  cards: [["flat", 11], ["dense_flat", 3], ["cube", 8], ["heat_in", 3], ["heat_out", 3], ["blow", 3], ["ash_tap", 3], ["fan", 3], ["read", 3]] });

const byId = (list) => Object.freeze(Object.fromEntries(list.map((x) => [x.id, x])));
export const FLAVOR = byId(FLAVORS);
export const CARD = byId(CARDS);
export const BOWL = byId(BOWLS);
export const HMD = byId(HMDS);
export const JUDGE = byId(JUDGES);
export const TOURNAMENT = byId([...TOURNAMENTS, INTRO.tournament]);
export const KIT = byId([...BASIC_KITS, ...KITS, INTRO_KIT]);

/** [id, 枚数] の並びを、カードidの配列にする */
export const expandDeck = (list) => list.flatMap(([id, n]) => Array(n).fill(id));

// ───────── トレカとしての札（番号とレア度） ─────────
// 画面の札に出す通し番号とレア度。集める遊び（入手・図鑑）はまだ無く、レア度は見た目のための仮の割り当て
// （2026-11-11 オーナー「トレカ風にしたい。ゲーム内で集める楽しみもある」。決まったらここを書き換える）。
// kind: flavor=葉 / bowl=ボウル（ハガル） / hmd=HMD / card=デッキのカード
export const RARITIES = Object.freeze({
  C: { name: "コモン", mark: "C" }, U: { name: "アンコモン", mark: "U" }, R: { name: "レア", mark: "R" }, SR: { name: "スーパーレア", mark: "SR" },
});
const CARD_RARITY = {
  flat: "C", cube: "C", dense_flat: "U",
  heat_in: "C", heat_out: "C", blow: "U", show_smoke: "U", all_in: "R", duel: "R", read: "C", ash_tap: "C", add_coal: "U", tongs: "U", fan: "C",
  inner: "U", outer: "U", loosen: "U", breath: "C", reset: "R",
  windguard: "U", chacosta: "U", timer: "U", ice_hose: "R", diffuser: "R",
  hype: "U", draft: "U", venue_heat: "U", go_second: "R", buyout: "U", repack: "U", encore: "SR",
  sumi: "SR", naru: "SR", adam: "SR", minto: "SR", mashiro: "SR", tsumugi: "SR", packy: "SR",
};
const SERIES = Object.freeze([...FLAVORS.map((x) => `flavor:${x.id}`), ...BOWLS.map((x) => `bowl:${x.id}`), ...HMDS.map((x) => `hmd:${x.id}`), ...CARDS.map((x) => `card:${x.id}`)]);
/** 通し番号の総数（葉20・ボウル4・HMD4・デッキのカード38） */
export const SERIES_SIZE = SERIES.length;
/** 通し番号（1から）。知らない札は 0 */
export const numberOf = (kind, id) => SERIES.indexOf(`${kind}:${id}`) + 1;
/** レア度（C/U/R/SR）。葉は味値で決める（味1〜2=C・3=U・4=R）。ボウルとHMDは R */
export function rarityOf(kind, id) {
  if (kind === "flavor") return FLAVOR[id].t >= 4 ? "R" : FLAVOR[id].t === 3 ? "U" : "C";
  if (kind === "bowl" || kind === "hmd") return "R";
  return CARD_RARITY[id] || "C";
}
