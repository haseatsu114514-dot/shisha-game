// カードゲーム「一台勝負」のカードと数値。ルールの正本は docs/design/card_game/（第0.2版のルールブックと cards.js）。
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
  { id: "double_apple", name: "ダブルアップル", brand: "アルファーヘブン", kind: "spice", t: 3, lo: 6, hi: 8, j: [6, 7, 8], s: 10, pair: "none", ab: "【表情】適温のどこでもジャスト。" },
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
  { id: "tanukish", name: "タヌキッシュリッド", ab: "【素直】炭焼き場の枠+1。素焼きハガルとは組めない。" },
  { id: "amaburst", name: "アマバースト", ab: "【高火力】自分の判定熱はつねに+1。" },
  { id: "big_tanukish", name: "ビッグタヌキッシュリッド", ab: "【熱持ち】各セッション最初の自分のターンは冷めない。" },
]);

// type: coal=炭 / tech=技 / tool=器具 / person=人物 / event=イベント
// cost: 火力。burn: 燃焼（その数の炭を灰にして払う）
// when: turn=手番 / puff=一口（審査カードをめくったあと。自分の一口にだけ効く） / prep=準備 / any=いつでも（自分のターンならどのフェイズでも）
// 炭カードだけ: ig=着火（焼けるまでのターン数） heat=表向きのときの熱
export const CARDS = Object.freeze([
  { id: "flat", name: "フラット炭", type: "coal", ig: 1, heat: 1, tx: "【小回り】冷めるとき、裏返しても熱は下がらない。" },
  { id: "cube", name: "キューブ炭", type: "coal", ig: 2, heat: 2, tx: "表向きのあいだ熱2・火力2。裏返ると熱1。【火持ち】表向きのあいだ、自分の冷める段階が1つ減る（1より少なくはならない）。" },
  { id: "dense_flat", name: "高密度フラット炭", type: "coal", ig: 1, heat: 1, tx: "【小回り】冷めるとき、裏返しても熱は下がらない。炭ゾーンにのせたとき、カードを1枚引く。" },
  { id: "heat_in", name: "熱を入れる吸い", type: "tech", cost: 1, when: "puff", tx: "この一口の判定熱+1。" },
  { id: "heat_out", name: "熱を逃がす吸い", type: "tech", cost: 1, when: "puff", tx: "この一口の判定熱−1。" },
  { id: "blow", name: "ブロー", type: "tech", cost: 1, when: "puff", tx: "この一口、自分は焦げない。焦げライン以上ならズレ（1点）になる。" },
  { id: "show_smoke", name: "見せ煙", type: "tech", cost: 2, when: "puff", tx: "この一口が適温かジャストで、濃厚なら、さらに+2点。" },
  { id: "all_in", name: "渾身の一口", type: "tech", cost: 3, when: "puff", tx: "この一口がジャストなら、さらに+3点。" },
  { id: "duel", name: "勝負の一服", type: "tech", cost: 2, when: "puff", tx: "この審査で一票を取ったら、さらに+3点。" },
  { id: "read", name: "吸い方を読む", type: "tech", cost: 0, when: "turn", tx: "審査カードの山のいちばん上を自分だけ見て、元に戻す。" },
  { id: "ash_tap", name: "灰落とし", type: "tech", cost: 1, when: "turn", tx: "次の自分のターン、冷めない。" },
  { id: "add_coal", name: "追い炭", type: "tech", cost: 0, when: "turn", tx: "山札の上から1枚を、裏向きのまま種火として炭ゾーンに置く。" },
  { id: "tongs", name: "トングさばき", type: "tech", cost: 0, when: "turn", tx: "自分の種火を1枚灰にする。カードを2枚引く。" },
  { id: "fan", name: "火おこし", type: "tech", cost: 1, when: "any", tx: "自分の炭焼き場の炭を、すべて1段階進める。" },
  { id: "inner", name: "内寄せ", type: "tech", cost: 2, when: "turn", tx: "このセッションの終わりまで、自分の判定熱+1。" },
  { id: "outer", name: "外寄せ", type: "tech", cost: 1, when: "turn", tx: "このセッションの終わりまで、自分の判定熱−1。" },
  { id: "loosen", name: "葉をほぐす", type: "tech", cost: 2, when: "turn", tx: "このセッションの終わりに、自分の葉は減らない。" },
  { id: "breath", name: "ひと息", type: "tech", cost: 1, when: "turn", tx: "カードを2枚引く。" },
  { id: "reset", name: "仕切り直し", type: "tech", burn: 2, when: "turn", tx: "カードを3枚引く。" },
  { id: "windguard", name: "風防", type: "tool", cost: 2, when: "any", tx: "風防カウンターを2個のせて出す。冷めるとき、1段階ぶんのかわりにカウンターを1個取ってよい。0個になったら灰へ。相手のカードで自分の炭は弱まらない。" },
  { id: "chacosta", name: "チャコスタ", type: "tool", cost: 2, when: "any", tx: "炭焼き場の枠+2。" },
  { id: "timer", name: "キッチンタイマー", type: "tool", cost: 1, when: "any", tx: "自分のターンのはじめに炭が焼けたら、カードを1枚引く（1ターンに1枚まで）。" },
  { id: "ice_hose", name: "アイスホース", type: "tool", cost: 2, when: "any", tx: "上側のズレを適温として扱う。" },
  { id: "diffuser", name: "ディフューザー", type: "tool", cost: 2, when: "any", tx: "ズレの一口でも、ミックスと相性の加点を得る。" },
  { id: "hype", name: "実況の煽り", type: "event", cost: 2, when: "turn", tx: "相手の次の一口の判定熱+1。" },
  { id: "draft", name: "すきま風", type: "event", cost: 2, when: "turn", tx: "相手の炭ゾーンの炭を1つ、相手が選んで1段階弱める。" },
  { id: "venue_heat", name: "会場の熱気", type: "event", cost: 1, when: "turn", tx: "全員の次の一口の判定熱+1。" },
  { id: "go_second", name: "後の先", type: "event", cost: 1, when: "turn", tx: "次のラウンド、自分が後手になる。" },
  { id: "buyout", name: "買い占め", type: "event", cost: 1, when: "prep", tx: "このターンの「詰める」で、さらに2枚取れる。" },
  { id: "repack", name: "詰め直し", type: "event", cost: 1, when: "prep", tx: "蒸らす前だけ。ボウルの葉を2枚まで場の山に戻し、同じ枚数を場から取る。" },
  { id: "encore", name: "アンコール", type: "event", cost: 4, when: "puff", tx: "最終セッションだけ。この一口の点をもう一度得る。" },
  { id: "sumi", name: "スミさん", type: "person", cost: 3, when: "any", tx: "【炭を見る目】自分の炭カードは着火が1ターン早い（フラット炭は置いたターンにのせられる）。" },
  { id: "naru", name: "なる", type: "person", cost: 2, when: "any", tx: "【甘さを追う】主役がスイートなら、ジャストの一口+1。" },
  { id: "adam", name: "アダム", type: "person", cost: 3, when: "any", tx: "【手入れ大全】単品なら毎口+1。" },
  { id: "minto", name: "みんと", type: "person", cost: 2, when: "any", tx: "【ひとりの時間】清涼の葉が2枚以上あれば、焦げても葉を失わない。" },
  { id: "mashiro", name: "ましろ", type: "person", cost: 2, when: "any", tx: "【消さない量】脇役が2種類以上あれば、毎口+1。" },
  { id: "tsumugi", name: "つむぎ", type: "person", cost: 2, when: "any", tx: "【預けた器】主役がフローラルなら、下側のズレを適温として扱う。" },
  { id: "packy", name: "パッキー", type: "person", cost: 2, when: "any", tx: "【実況】自分が一票を取るたび、カードを1枚引く。" },
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
  { id: "kamizono", name: "上園 文太郎", motto: "おいしいねえ", puffs: [["normal", 2], ["happy", 1], ["slow", 1]], bonus: "第1セッションが終わった時点の点が高い作り手に+4。同点なら全員+2。" },
  { id: "hakase", name: "チャコール博士", motto: "熱の記録", puffs: [["normal", 1], ["measure", 2], ["long", 1]], bonus: "焦げの回数が少ない作り手に+4（同数なら全員+2）。0回の作り手はさらに+2。" },
  { id: "sensu", name: "千須 豪", motto: "最後の一口", puffs: [["normal", 2], ["long", 2]], bonus: "最終ラウンドの一口の点が高い作り手に+5。同点なら全員+2。" },
  { id: "emir", name: "エミル・ユルマズ", motto: "受け継いだ手順", puffs: [["normal", 2], ["slow", 2]], bonus: "ゲーム終了時、ボウルに残った葉が多い作り手に+4。同数なら全員+2。" },
  { id: "taiyo", name: "ダ・シルヴァ太陽", motto: "熱の芯", puffs: [["normal", 1], ["strong", 2], ["deep", 1]], bonus: "ジャストの一口の回数が多い作り手に+4。同数なら全員+2。" },
]);

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
// ルールブックの組み済みデッキを元に、ゲーム内で3式が釣り合うように葉と数枚を入れ替えてある（確かめ方は remake/test/ichidai_rules.mjs）
export const KITS = Object.freeze([
  { id: "a", name: "ミックスの構え型", bowl: "funnel", hmd: "lotus", plan: [["blueberry", 8], ["mint", 4]],
    blurb: "帯の真ん中に置き、吸いの技で受ける。相手は煽りで揺さぶる。",
    cards: [["flat", 8], ["dense_flat", 2], ["cube", 2], ["heat_in", 3], ["heat_out", 3], ["ash_tap", 2], ["add_coal", 2], ["breath", 1], ["read", 2], ["blow", 2], ["all_in", 2], ["duel", 2], ["windguard", 2], ["timer", 1], ["diffuser", 1], ["hype", 2], ["go_second", 1], ["mashiro", 1], ["packy", 1]] },
  { id: "b", name: "単品の火持ち型", bowl: "clay", hmd: "amaburst", plan: [["double_apple", 12]],
    blurb: "キューブ炭で高い熱を保ち、濃い煙で点を重ねる。",
    cards: [["cube", 8], ["flat", 4], ["dense_flat", 1], ["heat_in", 2], ["inner", 2], ["ash_tap", 2], ["fan", 2], ["reset", 2], ["show_smoke", 3], ["all_in", 3], ["blow", 2], ["chacosta", 2], ["draft", 2], ["hype", 2], ["encore", 1], ["adam", 1], ["sumi", 1]] },
  { id: "c", name: "低温の攻め型", bowl: "silicone", hmd: "tanukish", plan: [["rose", 7], ["peach", 4]],
    blurb: "味値4のローズ。ジャストのすぐ上が焦げ。読む・逃がす・ブローで攻めきる。",
    cards: [["flat", 9], ["dense_flat", 2], ["heat_out", 3], ["heat_in", 2], ["blow", 2], ["read", 3], ["outer", 1], ["ash_tap", 2], ["tongs", 2], ["breath", 2], ["all_in", 2], ["duel", 2], ["windguard", 2], ["timer", 1], ["venue_heat", 1], ["go_second", 1], ["fan", 2], ["packy", 1]] },
]);

const byId = (list) => Object.freeze(Object.fromEntries(list.map((x) => [x.id, x])));
export const FLAVOR = byId(FLAVORS);
export const CARD = byId(CARDS);
export const BOWL = byId(BOWLS);
export const HMD = byId(HMDS);
export const JUDGE = byId(JUDGES);
export const TOURNAMENT = byId(TOURNAMENTS);
export const KIT = byId(KITS);

/** [id, 枚数] の並びを、カードidの配列にする */
export const expandDeck = (list) => list.flatMap(([id, n]) => Array(n).fill(id));
