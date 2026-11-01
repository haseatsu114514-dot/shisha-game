// 心得の盤のデータ（SPEC 第2版 2章・3章、ADDENDUM-BOARD-LAYOUT）。規則は core/growth-board.js、画面は daily/growth-board-screen.js。
// ここはデータだけ（import なし）。盤の形・マス・スキル・授業・言葉を差し替えるときはこのファイルだけを直す。

/** 能力は3つ（才能・感覚・理論）。盤も3枚 */
export const BOARD_KEYS = ["body", "sense", "wisdom"];
export const BOARD_JA = { body: "才能", sense: "感覚", wisdom: "理論" };
export const BOARD_HEAD = { body: "才", sense: "感", wisdom: "理" };
export const BOARD_PREFIX = { body: "B", sense: "S", wisdom: "W" };
/**
 * 火種の名前（2026-10-30 オーナー「火種の名前が今センスない」→ 推奨の「色の火」を採用。SBD62）。
 * 白火＝レベルアップでもらう、どのマスにも使える火（白は全部の色を混ぜた光）。紅火・蒼火・翠火＝その盤の色の火（関門を越えられる）。
 * 色と形でも見分ける: 白火＝白金の丸い熾き、紅火＝赤橙の炎、蒼火＝水色のしずく、翠火＝青緑の角（キューブ炭）。
 */
export const HIDANE_NAME = { any: "白火", body: "紅火", sense: "蒼火", wisdom: "翠火" };

/**
 * 盤の型 v10（2026-10-30 オーナーが提案の推奨を全部採用。SBD62・SBD63）。
 * - 紋は盤の下の端（座標 0,0）。道は紋の左・右・上の3本で、上へ育つ。座標は紋からのずれ（x は −6〜6、y は −8〜0。上が負）。
 * - v13「輪つきの木」（2026-10-31 オーナー「配置は設計にある輪つきの木で作りたい」SBD73）: 各盤に輪を入れた。
 *   才能＝扇（紋は下の真ん中。左右の羽の先が K04/K03 を通って上の骨とつながる弧2本）、感覚＝渦（紋は左下。中ほどの道が
 *   右回りに1周して K21 を通って戻る）、理論＝木（紋は下から1段上。幹の上で K23/K24 を通る冠の輪）。
 *   輪の上の火種2のスキル（K03/K04・K21・K23/K24）は「通行料」: 近道を使うには払う。紋の隣3つの恩恵は全部違い、同じ恩恵は3つ並ばない。
 * - 要のマス（notable。各盤3つ: 近く・中ほど・関門の先）: 能力のマス・火種1のまま、名前つきの強化版（NOTABLES）。目的地になる。
 * - 授業は会う章の順に紋から遠い（SBD65）: 第1章＜第2章＜第3章＜第4章。
 * - 帯は3つ: 近く（第1章で開く・関門なし）、中ほど（第2章から・関門なし）、関門の先。
 *   普通のマスの恩恵は 近く×1・中ほど×2・関門の先×3。
 * - 関門は4つ。**授業は関門のすぐ隣**（2人目は1マス先）。第2章の関門は紋のそば、あとの章の関門は中ほどの道の先。
 *   関門の先は 授業 → ×3のマス2つ → 強いスキル（火種6か8）。
 * - 紋のそばの授業は第1章で会う人だけ。授業はその人に会うまで盤に出さない。関門は色の火でどこからでも越えられる。
 * - **極みは道から外す**（SBD63「極みがあるルートが強くなりすぎそう」）: 上の真ん中に浮かび、その盤の能力のマスを全部灯すと灯せる。
 * - ✦のマス: 灯すと「できること」が1つ増える（段の廃止で、段に付いていたものを移した。FEATURES）。
 * cells: [座標, 種類, 章, 恩恵, ✦, 要]。stat＝能力のマス（火種1。恩恵は SQUARE_PERKS のキー、✦は FEATURES のキー、要は NOTABLES のキー）、gate＝関門（色の火1）、spot＝要所（スキル・授業・極み）。
 * 3つの盤は同じ大きさ（各66: 能力のマス26・関門4・スキル36。第1章で開く範囲は各17）。合計198。1周目で3つの盤どれも7割まで開ける。
 */
export const BOARD_SHAPES = {
  body: {
    cells: [["-1,0", "stat", 1, "charm", null, "friendly"], ["-2,0", "stat", 1, "sleep"], ["-3,0", "stat", 1, "charm"], ["1,0", "stat", 1, "sleep"], ["2,0", "stat", 1, "stamina"], ["3,0", "stat", 1, "sleep"], ["0,-1", "stat", 1, "stamina"], ["0,-2", "stat", 1, "charm"], ["0,-3", "stat", 1, "stamina"], ["-2,-2", "stat", 2, "charm"], ["-2,-3", "stat", 2, "stage"], ["-1,-3", "stat", 2, "sleep"], ["2,-2", "stat", 2, "sleep"], ["2,-3", "stat", 2, "stage"], ["1,-3", "stat", 2, "charm"], ["0,-4", "stat", 3, "stage"], ["0,-5", "stat", 3, "charm", "stage", "spotlight"], ["-5,0", "stat", 2, "charm"], ["-6,0", "stat", 2, "stage"], ["5,0", "stat", 3, "sleep"], ["6,0", "stat", 3, "sleep", null, "ironsleep"], ["-4,-3", "stat", 3, "stage"], ["-5,-3", "stat", 3, "stamina"], ["1,-6", "stat", 4, "stamina"], ["2,-6", "stat", 4, "charm"], ["-4,0", "gate", 2, "charm"], ["4,0", "gate", 3, "sleep"], ["-3,-3", "gate", 3, "stamina"], ["0,-6", "gate", 4, "stage"], ["-2,-1", "spot", 1], ["2,-1", "spot", 1], ["-1,-2", "spot", 1], ["1,-2", "spot", 1], ["-3,-1", "spot", 2], ["3,-1", "spot", 3], ["-6,-1", "spot", 2], ["-4,-1", "spot", 2], ["6,-1", "spot", 3], ["4,-1", "spot", 3], ["-5,-4", "spot", 4], ["-3,-4", "spot", 3], ["3,-6", "spot", 4], ["0,-7", "spot", 4], ["0,-8", "spot", 5]],
    edges: [["-1,0", "-2,0"], ["-2,0", "-3,0"], ["1,0", "2,0"], ["2,0", "3,0"], ["0,-1", "0,-2"], ["0,-2", "0,-3"], ["0,-2", "-1,-2"], ["0,-2", "1,-2"], ["-2,0", "-2,-1"], ["-2,-1", "-2,-2"], ["-2,-2", "-2,-3"], ["-2,-3", "-1,-3"], ["-1,-3", "0,-3"], ["2,0", "2,-1"], ["2,-1", "2,-2"], ["2,-2", "2,-3"], ["2,-3", "1,-3"], ["1,-3", "0,-3"], ["-3,0", "-3,-1"], ["3,0", "3,-1"], ["-2,-3", "-3,-3"], ["0,-3", "0,-4"], ["0,-4", "0,-5"], ["0,-5", "0,-6"], ["-3,0", "-4,0"], ["-4,0", "-5,0"], ["-5,0", "-6,0"], ["-6,0", "-6,-1"], ["-4,0", "-4,-1"], ["3,0", "4,0"], ["4,0", "5,0"], ["5,0", "6,0"], ["6,0", "6,-1"], ["4,0", "4,-1"], ["-3,-3", "-4,-3"], ["-4,-3", "-5,-3"], ["-5,-3", "-5,-4"], ["-3,-3", "-3,-4"], ["0,-6", "1,-6"], ["1,-6", "2,-6"], ["2,-6", "3,-6"], ["0,-6", "0,-7"]],
  },
  sense: {
    cells: [["-1,0", "stat", 1, "pull"], ["-2,0", "stat", 1, "heat"], ["-3,0", "stat", 1, "pull"], ["1,0", "stat", 1, "breath"], ["2,0", "stat", 1, "dodge", null, "fire_eye"], ["3,0", "stat", 1, "breath"], ["0,-1", "stat", 1, "dodge"], ["0,-2", "stat", 1, "heat", "omen"], ["0,-3", "stat", 1, "dodge"], ["1,-3", "stat", 2, "heat"], ["2,-3", "stat", 2, "breath"], ["3,-3", "stat", 2, "heat"], ["3,-4", "stat", 3, "dodge", "mental"], ["3,-5", "stat", 3, "breath", null, "smoke_breath"], ["2,-5", "stat", 3, "heat", "insurance"], ["1,-5", "stat", 3, "breath"], ["0,-5", "stat", 3, "dodge"], ["5,0", "stat", 2, "pull"], ["6,0", "stat", 2, "pull"], ["-2,-2", "stat", 2, "dodge"], ["-2,-3", "stat", 2, "dodge"], ["5,-4", "stat", 3, "heat"], ["6,-4", "stat", 3, "heat"], ["4,-6", "stat", 4, "breath"], ["5,-6", "stat", 4, "breath", null, "hairbreadth"], ["4,0", "gate", 2, "pull"], ["-1,-2", "gate", 2, "dodge"], ["4,-4", "gate", 3, "heat"], ["3,-6", "gate", 4, "breath"], ["-3,-1", "spot", 1], ["2,-1", "spot", 1], ["-1,-1", "spot", 1], ["1,-2", "spot", 1], ["-2,-1", "spot", 1], ["3,-1", "spot", 1], ["0,-4", "spot", 2], ["2,-4", "spot", 3], ["6,-1", "spot", 3], ["5,-1", "spot", 2], ["-2,-4", "spot", 3], ["-3,-2", "spot", 2], ["6,-3", "spot", 4], ["4,-3", "spot", 3], ["5,-7", "spot", 4], ["2,-7", "spot", 5]],
    edges: [["-1,0", "-2,0"], ["-2,0", "-3,0"], ["1,0", "2,0"], ["2,0", "3,0"], ["0,-1", "0,-2"], ["0,-2", "0,-3"], ["-3,0", "-3,-1"], ["2,0", "2,-1"], ["-1,-1", "-1,0"], ["0,-2", "1,-2"], ["-2,0", "-2,-1"], ["3,0", "3,-1"], ["0,-3", "1,-3"], ["1,-3", "2,-3"], ["2,-3", "3,-3"], ["3,-3", "3,-4"], ["3,-4", "3,-5"], ["3,-5", "2,-5"], ["2,-5", "1,-5"], ["1,-5", "0,-5"], ["0,-5", "0,-4"], ["0,-4", "0,-3"], ["2,-3", "2,-4"], ["2,-4", "2,-5"], ["3,0", "4,0"], ["4,0", "5,0"], ["5,0", "6,0"], ["6,0", "6,-1"], ["5,0", "5,-1"], ["-1,-1", "-1,-2"], ["-1,-2", "-2,-2"], ["-2,-2", "-2,-3"], ["-2,-3", "-2,-4"], ["-2,-2", "-3,-2"], ["3,-4", "4,-4"], ["4,-4", "5,-4"], ["5,-4", "6,-4"], ["6,-4", "6,-3"], ["4,-4", "4,-3"], ["3,-5", "3,-6"], ["3,-6", "4,-6"], ["4,-6", "5,-6"], ["5,-6", "5,-7"]],
  },
  wisdom: {
    cells: [["-1,0", "stat", 1, "leaf"], ["-2,0", "stat", 1, "coal"], ["-2,1", "stat", 1, "leaf", null, "leaf_eye"], ["1,0", "stat", 1, "gauge"], ["2,0", "stat", 1, "tongue"], ["2,1", "stat", 1, "gauge"], ["0,-1", "stat", 1, "tongue"], ["0,-2", "stat", 1, "gauge", "pairing"], ["0,-3", "stat", 1, "tongue"], ["0,-4", "stat", 2, "coal"], ["0,-5", "stat", 2, "tongue", "golden", "golden_tongue"], ["-1,-5", "stat", 2, "coal"], ["1,-5", "stat", 2, "leaf"], ["-2,-5", "stat", 3, "coal"], ["2,-5", "stat", 3, "leaf"], ["-1,-3", "stat", 2, "tongue"], ["1,-6", "stat", 3, "tongue"], ["-4,0", "stat", 2, "coal"], ["-5,0", "stat", 2, "coal"], ["4,0", "stat", 2, "gauge"], ["5,0", "stat", 2, "gauge"], ["-4,-5", "stat", 3, "leaf"], ["-4,-6", "stat", 3, "leaf"], ["3,-6", "stat", 4, "coal", null, "long_coal"], ["4,-6", "stat", 4, "tongue"], ["-3,0", "gate", 2, "coal"], ["3,0", "gate", 2, "gauge"], ["-3,-5", "gate", 3, "leaf"], ["2,-6", "gate", 4, "tongue"], ["-3,1", "spot", 1], ["3,1", "spot", 1], ["-1,-2", "spot", 1], ["1,-2", "spot", 1], ["-1,-4", "spot", 2], ["1,-4", "spot", 2], ["-5,-1", "spot", 2], ["-3,-1", "spot", 2], ["-4,1", "spot", 2], ["5,-1", "spot", 3], ["3,-1", "spot", 2], ["-5,-6", "spot", 3], ["-3,-4", "spot", 3], ["4,-7", "spot", 4], ["2,-7", "spot", 4], ["0,-7", "spot", 5]],
    edges: [["-1,0", "-2,0"], ["-2,0", "-2,1"], ["1,0", "2,0"], ["2,0", "2,1"], ["0,-1", "0,-2"], ["0,-2", "0,-3"], ["-2,1", "-3,1"], ["2,1", "3,1"], ["0,-2", "-1,-2"], ["0,-2", "1,-2"], ["0,-3", "0,-4"], ["0,-4", "0,-5"], ["0,-5", "-1,-5"], ["0,-5", "1,-5"], ["-1,-5", "-2,-5"], ["1,-5", "2,-5"], ["0,-3", "-1,-3"], ["-1,-3", "-1,-4"], ["2,-5", "2,-6"], ["1,-5", "1,-6"], ["0,-4", "-1,-4"], ["-1,-4", "-1,-5"], ["0,-4", "1,-4"], ["1,-4", "1,-5"], ["-2,0", "-3,0"], ["-3,0", "-4,0"], ["-4,0", "-5,0"], ["-5,0", "-5,-1"], ["-3,0", "-3,-1"], ["-4,0", "-4,1"], ["2,0", "3,0"], ["3,0", "4,0"], ["4,0", "5,0"], ["5,0", "5,-1"], ["3,0", "3,-1"], ["-2,-5", "-3,-5"], ["-3,-5", "-4,-5"], ["-4,-5", "-4,-6"], ["-4,-6", "-5,-6"], ["-3,-5", "-3,-4"], ["1,-6", "2,-6"], ["2,-6", "3,-6"], ["3,-6", "4,-6"], ["4,-6", "4,-7"], ["2,-6", "2,-7"]],
  },
};

/** 紋の場所（方眼の座標。SBD65「スタート位置とかも盤によって少し変えたい」）: 才能＝下の真ん中、感覚＝左下、理論＝下から1段上（根が下へ） */
export const HUB_AT = { body: "0,0", sense: "-3,0", wisdom: "0,-1" };
/** 極み（その盤の能力のマスを全部灯すと灯せる。道にはつながない）の場所 */
export const PEAK_CELL = { body: "0,-8", sense: "2,-7", wisdom: "0,-7" };
/** 盤ごとの能力のマスの数（極みを含む）。段は 1＋（9×灯した数÷この数）の切り捨て、10段まで */
export const STAT_SQUARES = Object.fromEntries(Object.entries(BOARD_SHAPES)
  .map(([b, shape]) => [b, shape.cells.filter(([, kind]) => kind === "stat").length + 1]));
/** 盤の方眼の広さ（描画用） */
export const GRID = { w: 6, h: 8 }; // x は −w〜w、y は −h〜0（紋は下の端）

// ---------------------------------------------------------------- 言葉（3.2〜3.5）

/**
 * ✦のマス（2026-10-30 オーナー「9段とか10段みたいな概念は無くす」SBD63）: 段に付いていた「できること」を、決まったマスに移した。
 * そのマスを灯すと開く。どのマスかは BOARD_SHAPES の5つ目。効き目は growth-effects.js と各制作工程へ接続。通常公開前は GROWTH_BOARD の裏。
 */
export const FEATURES = {
  stage: { board: "body", name: "審査員の第一印象", text: "大会で審査員の第一印象が良く、少し加点される" },
  omen: { board: "sense", name: "事故の予兆", text: "事故の予兆（焦げ・熱すぎ・吸いすぎ）が見える" },
  mental: { board: "sense", name: "弾消しで回復", text: "蒸らしで弾を消すと、メンタルも少し回復する" },
  insurance: { board: "sense", name: "一度だけの保険", text: "大会の一台で一度だけ、大失敗を防ぐ" },
  pairing: { board: "wisdom", name: "配合の相性", text: "配合の相性ヒントが出る" },
  golden: { board: "wisdom", name: "黄金比のヒント", text: "黄金比まで何を足せばいいか分かる" },
};
/**
 * 普通のマス（白火で灯す能力のマス）の恩恵（2026-10-30 オーナー「少しでも恩恵はつけたい。毎回違うのでなくてもいい」SBD59）。
 * どの恩恵かはマスごと（BOARD_SHAPES の4つ目）。強さは帯で決まる（SBD62「遠くをとりに行くやつはリターンを合わせたい」）:
 * 近く×1・中ほど×2・関門の先×3。text の {n} が帯の倍率で n×1／n×2／n×3 になる。数字は調整の初期値。表示と実効値は同じ集計を使う（growth-effects.js）。
 */
/**
 * 要のマス（2026-10-31 SBD73）: 能力のマスの中の目的地。その道の恩恵の名前つきの強化版。火種1・総量は変えない。
 * 数字は仮（効き目は C5 で決める）。bonus は帯の倍率にさらに掛ける倍率。
 */
export const NOTABLES = {
  friendly: { board: "body", name: "人懐こい", text: "初めて会った日の好感度が少し上がりやすい", bonus: 1.5 },
  spotlight: { board: "body", name: "舞台映え", text: "提供の時、審査員の目が集まる", bonus: 1.5 },
  ironsleep: { board: "body", name: "不眠の体", text: "寝不足の日でも体力の減りが小さい", bonus: 1.5 },
  fire_eye: { board: "sense", name: "火の目", text: "炭焼きのジャスト帯が目で分かりやすい", bonus: 1.5 },
  smoke_breath: { board: "sense", name: "煙の呼吸", text: "リフレッシュの範囲が一回り広い", bonus: 1.5 },
  hairbreadth: { board: "sense", name: "紙一重", text: "蒸らしの弾を紙一重でかわせる", bonus: 1.5 },
  leaf_eye: { board: "wisdom", name: "葉の目利き", text: "葉の傷みが見た目で分かる", bonus: 1.5 },
  golden_tongue: { board: "wisdom", name: "黄金の舌", text: "黄金比に近いほど舌が教える", bonus: 1.5 },
  long_coal: { board: "wisdom", name: "長持ちの炭", text: "炭の熱が長く持つ", bonus: 1.5 },
};
export const PERK_TIERS = [null, { mult: 1, name: "近く" }, { mult: 2, name: "中ほど" }, { mult: 3, name: "台座の先" }];
/**
 * 色の台座（もとの関門。2026-10-31 オーナー「章のロックに加えて、色の火種しか使えない所も作って欲しい。色火種をはめると進めて、その能力もゲットできる」SBD89）。
 * 色の火（紅火・蒼火・翠火）を1つはめると先へ進めて、その台座の能力が手に入る。台座1つ＝台座の先のマスの約1.3倍。
 * どの台座の能力かは BOARD_SHAPES の台座のマスの4つ目（各盤の4つの能力を1つずつ）
 */
export const GATE_TIER = { mult: 4, name: "色の台座" };
export const SQUARE_PERKS = {
  body: {
    base: { glyph: "基", name: "基礎", text: "最大体力 ＋{1}・寝た時の回復 ＋{1}%" },
    perks: {
      stamina: { glyph: "体", name: "体力", text: "最大体力 ＋{2}" },
      sleep: { glyph: "眠", name: "眠り", text: "寝た時の体力の回復 ＋{1}%" },
      charm: { glyph: "人", name: "人柄", text: "好感度が上がりやすく（＋{1}%）" },
      stage: { glyph: "華", name: "華", text: "大会の審査員の第一印象 ＋{1}" },
    },
  },
  sense: {
    base: { glyph: "基", name: "基礎", text: "蒸らしの当たり判定 −{1}%・ジャスト帯 ＋{0.5}%" },
    perks: {
      heat: { glyph: "火", name: "火加減", text: "炭焼き・熱管理のジャスト帯 ＋{0.5}%" },
      pull: { glyph: "吸", name: "吸い", text: "吸い出しのジャスト帯 ＋{0.5}%" },
      dodge: { glyph: "避", name: "かわし", text: "蒸らしの当たり判定が小さく（−{1}%）" },
      breath: { glyph: "息", name: "呼吸", text: "リフレッシュの範囲が広く（＋{2}）" },
    },
  },
  wisdom: {
    base: { glyph: "基", name: "基礎", text: "ゲージ ＋{0.5}% ゆっくり・葉のダメージ −{1}%" },
    perks: {
      gauge: { glyph: "段", name: "段取り", text: "作りのゲージが ＋{0.5}% ゆっくり" },
      leaf: { glyph: "葉", name: "葉", text: "吸いすぎの葉のダメージ −{1}%" },
      tongue: { glyph: "舌", name: "舌", text: "フレーバーの熟練度の伸び ＋{1}%" },
      coal: { glyph: "炭", name: "炭の持ち", text: "炭の熱が下がりにくく（＋{1}%）" },
    },
  },
};

/** 効く場面（盤の札・右のパネル） */
export const BOARD_WHERE = {
  body: "普段の体力・好感度の上がりやすさ・大会の加点（第一印象）",
  sense: "ジャスト帯・事故の予兆と保険・蒸らし（当たり判定・リフレッシュ・メンタル回復）",
  wisdom: "作りのゲージ・葉の体力・熟練度の伸び・事前に見えるもの（配合・黄金比・炭の気配）",
};

// ---------------------------------------------------------------- スキル24（2.5）。各盤8つ（近く 4×2・中ほど 2×2・関門の先 5×2と7×2）・火種の合計は各36・第1章は各2つ（2026-10-30 オーナー「バランスをとって」SBD60）。
// デンスパック（K18）は理論盤で覚える（オーナー採用 SBD57。新規の盤モードは習得で解放。旧セーブと旧モードの選択肢は互換フラグで保持）
// cell は要所の座標、ring はその章までに届けたい章。要所の章（BOARD_SHAPES）がこれ以下であることを読み込み時に確かめる。

export const SKILLS = [
  // 才能（体力・人付き合い・大会の粘り）
  { id: "K03", cell: "2,-1", board: "body", ring: 1, cost: 4, glyph: "寝", name: "早寝早起き", scene: "日常", text: "ふつうに眠ったときの体力の戻りが増える" },
  { id: "K04", cell: "-2,-1", board: "body", ring: 1, cost: 4, glyph: "交", name: "人見知りしない", scene: "日常", text: "はじめての相手・場所・場面の経験値が増える" },
  { id: "K07", cell: "-6,-1", board: "body", ring: 2, cost: 5, glyph: "読", name: "空気を読む", scene: "会話", text: "仲が深まる選択肢に小さな煙の印が出る（告白や大事な場面では出ない）" },
  { id: "K08", cell: "6,-1", board: "body", ring: 3, cost: 5, glyph: "結", name: "疲れ知らず", scene: "熱管理・吸い出し", text: "吸いすぎ・熱すぎの疲れがたまりにくい" },
  { id: "K12", cell: "-5,-4", board: "body", ring: 4, cost: 7, glyph: "胆", name: "大一番の胆力", scene: "大会", text: "大会本番の一台だけ、体調を1段良く扱う" },
  { id: "K13", cell: "3,-6", board: "body", ring: 4, cost: 7, glyph: "援", name: "声援", scene: "大会の蒸らし", text: "大会の蒸らしでリフレッシュを使うと、メンタルが1段回復する" },
  // 感覚（守り・直感・技。上振れ）
  { id: "K15", cell: "-3,-1", board: "sense", ring: 1, cost: 4, glyph: "会", name: "会心の一服", scene: "炭焼き・吸い出し", text: "ジャスト帯のど真ん中で取ると「会心」。その工程の点が少し上振れする" },
  { id: "K06", cell: "2,-1", board: "sense", ring: 1, cost: 4, glyph: "波", name: "二枚目のリフレッシュ", scene: "蒸らし", text: "蒸らしのリフレッシュを2回使える（2回目は範囲が半分）" },
  { id: "K10", cell: "6,-1", board: "sense", ring: 3, cost: 5, glyph: "目", name: "審査員の目", scene: "大会", text: "大会の工程ごとに、審査員の受け止めが肌で分かる" },
  { id: "K16", cell: "-2,-4", board: "sense", ring: 3, cost: 5, glyph: "勢", name: "勝負勘", scene: "大会", text: "大会で前の工程が会心・ジャストだと、次の工程の点が少し上振れする" },
  { id: "K11", cell: "6,-3", board: "sense", ring: 4, cost: 7, glyph: "火", name: "火の番", scene: "熱管理", text: "熱管理で炭を替えるときのジャストの幅が広がる" },
  { id: "K14", cell: "5,-7", board: "sense", ring: 4, cost: 7, glyph: "炭", name: "炭の声", scene: "蒸らし", text: "蒸らし予測で読める揺らぎが増える" },
  // 理論（知識・熟練度・作りの選択肢）
  { id: "K01", cell: "3,1", board: "wisdom", ring: 1, cost: 4, glyph: "段", name: "段取り八分", scene: "穴あけ", text: "穴あけの制限時間が少し延びる" },
  { id: "K02", cell: "-5,-1", board: "wisdom", ring: 2, cost: 5, glyph: "香", name: "香りの記憶", scene: "配合", text: "前回の配合やレシピ帳の配合を1回で呼び出せる（黄金比の答えは出ない）" },
  { id: "K05", cell: "5,-1", board: "wisdom", ring: 3, cost: 5, glyph: "空", name: "空模様", scene: "日常", text: "地図と朝の画面で明日の天気が分かる" },
  { id: "K17", cell: "-5,-6", board: "wisdom", ring: 3, cost: 7, glyph: "葉", name: "葉の持ち", scene: "吸い出し・調整", text: "吸いすぎでの葉の傷みが減る（葉の体力が伸びる）" },
  { id: "K09", cell: "4,-7", board: "wisdom", ring: 4, cost: 7, glyph: "舌", name: "熟練の舌", scene: "制作全般", text: "フレーバーの熟練度が早く育つ" },
  { id: "K18", cell: "-3,1", board: "wisdom", ring: 1, cost: 4, glyph: "密", name: "デンスパック", scene: "パッキング", text: "詰め方に「デンスパック」が加わる（密に詰めて厚い味へ。蒸らしは長めに）" },
  // 中ほどの「たまに面白い」スキル（2026-10-30 オーナー「授業以外でも中間でたまに面白い取りたいってなるスキルを入れたい」SBD66）。火種2・関門なし
  { id: "K19", cell: "3,-1", board: "body", ring: 3, cost: 2, glyph: "顔", name: "顔が広い", scene: "日常", text: "街を歩くと、知り合いにばったり会いやすくなる（偶然の会話が増える）" },
  { id: "K21", cell: "0,-4", board: "sense", ring: 2, cost: 2, glyph: "輪", name: "スモークリング", scene: "吸い出し", text: "吸い出しをジャストで取ると煙の輪が出て、審査員の受けが少し良くなる" },
  { id: "K22", cell: "2,-4", board: "sense", ring: 3, cost: 2, glyph: "残", name: "残り香", scene: "蒸らし", text: "蒸らしで雑念を3つ続けて消すと、少しのあいだ周りの雑念がゆっくりになる" },
  { id: "K23", cell: "-1,-4", board: "wisdom", ring: 2, cost: 2, glyph: "利", name: "目利き", scene: "買い物", text: "葉を買う時に掘り出し物が並び、少し安く買える" },
  { id: "K24", cell: "1,-4", board: "wisdom", ring: 2, cost: 2, glyph: "記", name: "メモ魔", scene: "制作全般", text: "作った一台の配合と点がレシピ帳に残り、前回との差が分かる" },
];

// ---------------------------------------------------------------- 授業20（2.6）。火種いらず。会っていて♥の条件を満たし、道が届けば開く（段の条件は SBD63 でなくした）
// 2026-10-30 オーナー: 授業はその人のタイプ（属性）の盤に入る。灯すと「相談できる」になり、次にその人に会った時に
// はじめが相談して話を聞く場面（scene）を見て習得する。章（ring）はその人に会える章。

/** reward: skill（新しい操作）／special（その人らしい強い効き目）／stat（能力が伸びる。bonus はマスの数） */
// 2026-11-01 オーナー指示: 差し入れスキルは廃止。保存済みのID・位置・支払を保って通常マスへ。
export const STAT_UPGRADES = [
  { id:"K20", cell:"-3,-1", board:"body", ring:2, cost:2, perk:"charm" },
];

export const LESSONS = [
  { id: "M-B1", cell: "-1,-2", board: "body", who: "minto", need: 5, sig: true, reward: "skill", name: "呼び込み上手",
    hint: "みんとと仲良くなると、お客さんの呼び方を教えてもらえそう",
    text: "バイトの客足が増え、店からの売上ボーナスが増える", scene: "lesson_minto_calling" },
  { id: "M-S1", cell: "-1,-1", board: "sense", who: "sumi", need: 0, reward: "skill", name: "蒸らしアタック",
    hint: "盤の道が届いたら、スミさんが蒸らしの授業をしてくれる",
    text: "蒸らしで雑念の言葉を斬れる", scene: "ch1_sumi_attack", unlocks: ["_sumi_attack_learned"] },
  { id: "M-S2", cell: "1,-2", board: "sense", who: "adam", need: 5, sig: true, reward: "skill", name: "単体の美学",
    hint: "アダムと仲良くなると、一つの葉で勝負するやり方を教えてもらえそう",
    text: "葉1種だけで作る「単体で勝負」を選べる。その葉の熟練度の高さが深みとして評価される", scene: "lesson_adam_single" },
  { id: "M-S3", cell: "-2,-1", board: "sense", who: "tsumugi", need: 5, sig: true, reward: "special", name: "安心できる色",
    hint: "つむぎと仲良くなると、落ち着ける色を教えてもらえそう",
    text: "夜、家シーシャにラベンダーを入れると、眠った時の体力の回復が増える", scene: "lesson_tsumugi_lavender" },
  { id: "M-W1", cell: "-1,-2", board: "wisdom", who: "sumi", need: 0, reward: "skill", name: "キューブ炭",
    hint: "盤の道が届いたら、スミさんが炭の授業をしてくれる",
    text: "キューブ炭を選べる", scene: "ch1_sumi_cube_coals", unlocks: ["_coal_cube_learned"] },
  { id: "M-W2", cell: "-3,-1", board: "wisdom", who: "sumi", need: 0, ring: 2, reward: "skill", name: "四つ置き・混ぜ置き",
    hint: "盤の道が届いたら、スミさんが炭の置き方の奥を教えてくれる",
    text: "炭の四つ置きと、フラット炭とキューブ炭の混ぜ置きを選べる", unlocks: ["_coal_four_unlocked", "_coal_mix_unlocked"], scene: "lesson_sumi_four" },
  { id: "M-W3", cell: "1,-2", board: "wisdom", who: "naru", need: 5, sig: true, reward: "skill", name: "全部見てけ",
    hint: "なると仲良くなると、店の見方を教えてもらえそう",
    text: "ライバル店で一服すると、その一台の配合がレシピ帳に残る", scene: "lesson_naru_watch" },
  { id: "M-W6", cell: "-3,-2", board: "sense", who: "sumi", need: 0, ring: 2, reward: "special", name: "カルダモンの一つまみ",
    hint: "盤の道が届いたら、スミさんが相性の悪い葉のつなぎ方を教えてくれる",
    text: "配合にカルダモンを一つまみ足すと、相性の悪い組み合わせのぶつかりがやわらぐ", scene: "lesson_sumi_cardamom" },
  { id: "M-B2", cell: "-4,-1", board: "body", who: "rei", need: 5, ring: 2, sig: true, reward: "special", name: "花を重ねる",
    hint: "零と仲良くなると、香りの重ね方を教えてもらえそう",
    text: "花の葉を2種以上重ねると香りの層ができ、調整のたびに次の層が立つ", scene: "lesson_rei_layers" },
  { id: "M-S4", cell: "5,-1", board: "sense", who: "ageha", need: 5, ring: 2, sig: true, reward: "skill", name: "ズボーって",
    hint: "アゲハと仲良くなると、感覚の吸い方を教えてもらえそう",
    text: "吸い出しに「ズボー（一気に深く）」が加わる。温度を大きく上げて立て直せる", scene: "lesson_ageha_zuboo" },
  { id: "M-W4", cell: "-4,1", board: "wisdom", who: "kumicho", need: 5, ring: 2, sig: true, reward: "skill", name: "0分蒸らし",
    hint: "組長と仲良くなると、蒸らさない立ち上げ方を教えてもらえそう",
    text: "蒸らしを 00:00 で始められる。低温から吸いながら熱を立ち上げる", scene: "lesson_kumicho_zero" },
  { id: "M-B3", cell: "4,-1", board: "body", who: "kuze", need: 5, ring: 3, sig: true, reward: "special", name: "白紙の味カード",
    hint: "久世と仲良くなると、出し方の勝負どころを教えてもらえそう",
    text: "提供の時に味の名前を伏せられる。審査員の受け止めの振れ幅が大きくなる", scene: "lesson_kuze_blank" },
  { id: "M-S5", cell: "4,-3", board: "sense", who: "steve", need: 5, ring: 3, sig: true, reward: "special", name: "ピザとシーシャの夜",
    hint: "スティーブと仲良くなると、みんなで集まる夜に誘ってもらえそう",
    text: "仲間を誘って「ピザとシーシャの夜」を開ける。誘った人の好感度がまとめて上がる（同じ人は続けて呼べない）", scene: "lesson_steve_pizza" },
  { id: "M-W5", cell: "-3,-4", board: "wisdom", who: "volk", need: 5, ring: 3, sig: true, reward: "special", name: "Точность",
    hint: "ヴォルクと仲良くなると、どんな日も同じ熱にするやり方を教えてもらえそう",
    text: "雨・湿気・気温による温まり方の違いを読み切り、天気で熱が狂いにくくなる", scene: "lesson_volk_precision" },
  // 追加の6人（2026-10-30 オーナーが推しの案を全部採用。SBD57）。会って相談する場面は growth_lessons.json（SBD70）
  // ひよりの授業は斧投げを明かした後（_hiyori_real_self_known）だけ分かる（2026-10-31 オーナー「斧投げ明かした後で」SBD71）
  { id: "M-S6", cell: "3,-1", board: "sense", who: "rin", need: 5, ring: 1, sig: true, reward: "special", name: "ブルーベリーに帰る",
    hint: "凛と仲良くなると、迷った時に帰る葉を教えてもらえそう",
    text: "配合にブルーベリーを2割以上入れると、どんな葉と合わせても香りがまとまり、配合の点が上がる", scene: "lesson_rin_blueberry" },
  { id: "M-B4", cell: "1,-2", board: "body", who: "hiyori", need: 5, ring: 1, sig: true, revealFlag: "_hiyori_real_self_known", reward: "special", name: "ラーメンと斧で元気",
    hint: "ひよりと仲良くなると、元気でいるコツを教えてもらえそう",
    text: "最大体力が大きく増える", scene: "lesson_hiyori_genki" },
  { id: "M-W7", cell: "3,-1", board: "wisdom", who: "samechan", need: 5, ring: 2, sig: true, reward: "skill", name: "シャークアタック",
    hint: "サメちゃんと仲良くなると、アタックの強い使い方を教えてもらえそう",
    text: "蒸らしのアタックがサメの噛みつきになる。左右にも広がり、コンボ3ごとに大きく噛みついて周りの雑念をまとめて消す（蒸らしアタックが要る）", scene: "lesson_samechan_shark" },
  { id: "M-B5", cell: "-3,-4", board: "body", who: "mashiro", need: 5, ring: 3, sig: true, reward: "special", name: "ブラックティーを一割",
    hint: "ましろと仲良くなると、ほかの葉を消さない足し方を教えてもらえそう",
    text: "配合にブラックティーを1〜2割入れると、ほかの葉の香りを消さずに奥行きが出て、配合の点が上がる", scene: "lesson_mashiro_blacktea" },
  { id: "M-W8", cell: "2,-7", board: "wisdom", who: "sheikh", need: 5, ring: 4, sig: true, reward: "special", name: "グレープの王道", revealFlag: "_ch4_sheikh_revealed",
    hint: "あの人と仲良くなると、王道の一台の作り方を教えてもらえそう",
    text: "グレープ系統が単独で最多の一台は、最後の総合評価の受け止めが一段良くなる", scene: "lesson_sheikh_grape" },
  { id: "M-B6", cell: "0,-7", board: "body", who: "da_silva", need: 5, ring: 4, sig: true, reward: "skill", name: "フェスタの煙",
    hint: "太陽と仲良くなると、場をひっくり返す煙の出し方を教えてもらえそう",
    text: "1台に1回、蒸らしのリフレッシュが画面全体に広がり、すべての雑念を消す", scene: "lesson_da_silva_festa" },
];
export const REWARD_JA = { skill: "スキル", special: "特殊な技", stat: "能力が伸びる" };

/** キャラのタイプ（2.7）: ♥5でくれる色つきの火種の色だけを決める */
export const CHAR_TYPE = {
  minto: "body", adam: "sense", naru: "wisdom",
  rin: "sense", hiyori: "body", samechan: "wisdom", mashiro: "body", sheikh: "wisdom", da_silva: "body",
  rei: "body", ageha: "sense", kumicho: "wisdom",
  kuze: "body", steve: "sense", volk: "wisdom",
};

// ---------------------------------------------------------------- 遊びのご褒美（2026-10-30 オーナー指示 SBD39・SBD40）
// 斧投げ・TRPG・DJ をやり込んで一定の水準に届いたら、色つきの火種を1つ。寝る前の精算で渡す。
// 量は小さく（オーナー: 「あげすぎ。♥5まで上げてやっと色の火種がもらえるぐらい」「ミニゲームをやりたくない人もいる」）。
// 遊ばなくても盤の進みはほとんど変わらない。色は遊びの性格で: 斧投げ＝才能、DJ＝感覚、TRPG＝理論。
export const PLAY_REWARDS = [
  { id: "axe-a", game: "axe", rank: "A", label: "斧投げで Aランク", gift: { body: 1 } },
  { id: "trpg-star3", game: "trpg", stars: 3, label: "TRPGで★3の卓", gift: { wisdom: 1 } },
  // DJ はまだ本編に入っていない（remake/previews/dj）。入ったら最高ランクを state に残し、ここを読む
  { id: "dj-a", game: "dj", rank: "A", label: "DJで Aランク", gift: { sense: 1 } },
];
/** くじのラストワン賞（中身はシークレット）。箱を引き切るたびに色つきの火種1つ（いちばん伸びの少ない盤の色） */
export const KUJI_LAST_ONE_GIFT = 1;
