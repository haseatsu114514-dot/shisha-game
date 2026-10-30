// 心得の盤のデータ（SPEC 第2版 2章・3章、ADDENDUM-BOARD-LAYOUT）。規則は core/growth-board.js、画面は daily/growth-board-screen.js。
// ここはデータだけ（import なし）。盤の形・マス・スキル・授業・言葉を差し替えるときはこのファイルだけを直す。

/** 能力は3つ（才能・感覚・理論）。盤も3枚 */
export const BOARD_KEYS = ["body", "sense", "wisdom"];
export const BOARD_JA = { body: "才能", sense: "感覚", wisdom: "理論" };
export const BOARD_HEAD = { body: "才", sense: "感", wisdom: "理" };
export const BOARD_PREFIX = { body: "B", sense: "S", wisdom: "W" };

/** 1段＝能力のマス3つ。各盤の能力のマスは27（極みを含む）。10段で上限 */
export const SQUARES_PER_STEP = 3;
export const STAT_SQUARES = 27;
/** 能力のマスを紋に近い順に、章（輪）の範囲へ分ける: 12・6・3・3・3（1.6 の章末の表と合う） */
export const STAT_RING_COUNTS = [12, 6, 3, 3, 3];
/** 極み（その盤の最後の能力のマス）を置く要所 */
export const PEAK_CELL = { body: "-4,3", sense: "-4,3", wisdom: "4,-3" };

/**
 * 盤の型（2.2）。9×7 の方眼に36マス・要所10か所。半分の道を設計して180度回す（点対称）。
 * 線は上下左右の隣だけ。隣にあっても線のないマスは別の道。座標は紋（0,0）からのずれ。
 */
export const HALF_LAYOUT = {
  paths: [
    [[0, -1], [0, -2], [-1, -2], [-2, -2], [-2, -3]], // 上の道 → 左上の要所
    [[0, -2], [0, -3], [1, -3], [2, -3]],             // 上の道の枝 → 上の要所
    [[1, 0], [2, 0], [3, 0], [4, 0]],                 // 右の道 → 右端の要所
    [[3, 0], [3, -1], [3, -2], [4, -2], [4, -3]],     // 右の道の枝 → 右上の隅の要所
    [[2, 0], [2, 1], [3, 1]],                         // 短い枝 → 要所
  ],
  special: [[-2, -3], [2, -3], [4, 0], [4, -3], [3, 1]],
};

// ---------------------------------------------------------------- 言葉（3.2〜3.5）

/** 段ごとの言葉（数値は出さない） */
export const STEP_TEXT = {
  body: ["体力はふつう", "体力が少し増えた", "好かれやすくなってきた", "疲れにくくなった", "審査員の第一印象が良く、少し加点される", "体力が大きく増えた", "人に好かれやすい", "一日中動いてもへこたれない", "体力ほぼ最大、加点されやすい", "体力最大・誰とでもすぐ打ち解ける"],
  sense: ["ジャスト帯は狭め", "ジャスト帯がほんの少し広く", "事故の予兆（焦げ・熱すぎ・吸いすぎ）が見える", "蒸らしで弾に当たりにくい", "弾消しでメンタルも回復する", "ジャスト帯がかなり広く", "大会の一台で一度だけ、大失敗を防ぐ", "リフレッシュの範囲がかなり広い", "外す方が難しい", "ジャスト帯が最も広く、画面全体の弾消し"],
  wisdom: ["ゲージは速く、配合は勘だのみ", "ゲージがほんの少しゆっくり", "配合の相性ヒントが出るように", "熟練度が少し早く上がり、葉が傷みにくい", "黄金比まで何を足すか分かる", "炭の気配・蒸らしの揺らぎが早めに見える", "ゲージがかなりゆっくり", "熟練度がかなり早く上がる", "炭も配合も、ほとんど読める", "ゲージが最もゆっくり、読めるものは全部読める"],
};
/** 能力のマス1つで少しずつ伸びるもの（3.1 の連続して効くもの） */
export const PER_SQUARE = {
  body: "最大体力がわずかに増え、好感度も少し上がりやすく",
  sense: "ジャスト帯がわずかに広がり、蒸らしの当たり判定もわずかに小さく",
  wisdom: "ゲージがわずかにゆっくり、葉の傷みと読み違いもわずかに減る",
};
/** 効く場面（盤の札・右のパネル） */
export const BOARD_WHERE = {
  body: "普段の体力・好感度の上がりやすさ・大会の加点（第一印象）",
  sense: "ジャスト帯・事故の予兆と保険・蒸らし（当たり判定・リフレッシュ・メンタル回復）",
  wisdom: "作りのゲージ・葉の体力・熟練度の伸び・事前に見えるもの（配合・黄金比・炭の気配）",
};
/** できることが増える段（✦。#1691）。表示だけで、数値は変えない */
export const QUALITY_STEPS = {
  body: { 5: "大会で審査員の第一印象の加点" },
  sense: { 3: "事故の予兆が見える", 5: "弾消しでメンタル回復", 7: "大会で一度だけの保険" },
  wisdom: { 3: "配合の相性ヒント", 5: "黄金比のヒント" },
};
/** ランク名は2段ずつ同じ（3.5） */
export const RANKS = {
  body: ["影うすい", "親しみやすい", "華がある", "目が離せない", "カリスマ"],
  sense: ["ふつう", "光るものがある", "冴えてる", "唯一無二", "天才肌"],
  wisdom: ["見習い", "様になってきた", "一人前", "職人肌", "神業"],
};

// ---------------------------------------------------------------- スキル17（2.5）。火種は第1版の2倍
// cell は要所の座標。どの章の要所も、その章までに開く能力のマスだけで道が届くように置いてある（テストで検査）。

export const SKILLS = [
  // 才能（体力・人付き合い・大会の粘り）
  { id: "K03", cell: "4,0", board: "body", ring: 1, cost: 4, glyph: "寝", name: "早寝早起き", scene: "日常", text: "ふつうに眠ったときの体力の戻りが増える" },
  { id: "K04", cell: "3,1", board: "body", ring: 1, cost: 4, glyph: "交", name: "人見知りしない", scene: "日常", text: "はじめての相手・場所・場面の経験値が増える" },
  { id: "K07", cell: "-3,-1", board: "body", ring: 2, cost: 6, glyph: "読", name: "空気を読む", scene: "会話", text: "仲が深まる選択肢に小さな煙の印が出る（告白や大事な場面では出ない）" },
  { id: "K08", cell: "4,-3", board: "body", ring: 3, cost: 6, glyph: "結", name: "疲れ知らず", scene: "熱管理・吸い出し", text: "吸いすぎ・熱すぎの疲れがたまりにくい" },
  { id: "K12", cell: "-2,-3", board: "body", ring: 4, cost: 8, glyph: "胆", name: "大一番の胆力", scene: "大会", text: "大会本番の一台だけ、体調を1段良く扱う" },
  { id: "K13", cell: "2,-3", board: "body", ring: 4, cost: 8, glyph: "援", name: "声援", scene: "大会の蒸らし", text: "大会の蒸らしでリフレッシュを使うと、メンタルが1段回復する" },
  // 感覚（守り・直感・技。上振れ）
  { id: "K15", cell: "4,0", board: "sense", ring: 1, cost: 4, glyph: "会", name: "会心の一服", scene: "炭焼き・吸い出し", text: "ジャスト帯のど真ん中で取ると「会心」。その工程の点が少し上振れする" },
  { id: "K06", cell: "4,-3", board: "sense", ring: 2, cost: 6, glyph: "波", name: "二枚目のリフレッシュ", scene: "蒸らし", text: "蒸らしのリフレッシュを2回使える（2回目は範囲が半分）" },
  { id: "K10", cell: "-2,-3", board: "sense", ring: 3, cost: 6, glyph: "目", name: "審査員の目", scene: "大会", text: "大会の工程ごとに、審査員の受け止めが肌で分かる" },
  { id: "K16", cell: "2,-3", board: "sense", ring: 3, cost: 6, glyph: "勢", name: "勝負勘", scene: "大会", text: "大会で前の工程が会心・ジャストだと、次の工程の点が少し上振れする" },
  { id: "K11", cell: "2,3", board: "sense", ring: 4, cost: 8, glyph: "火", name: "火の番", scene: "熱管理", text: "熱管理で炭を替えるときのジャストの幅が広がる" },
  { id: "K14", cell: "-2,3", board: "sense", ring: 4, cost: 8, glyph: "炭", name: "炭の声", scene: "蒸らし", text: "蒸らし予測で読める揺らぎが増える" },
  // 理論（知識・熟練度・作りの選択肢）
  { id: "K01", cell: "-2,-3", board: "wisdom", ring: 1, cost: 4, glyph: "段", name: "段取り八分", scene: "穴あけ", text: "穴あけの制限時間が少し延びる" },
  { id: "K02", cell: "4,0", board: "wisdom", ring: 1, cost: 4, glyph: "香", name: "香りの記憶", scene: "配合", text: "前回の配合やレシピ帳の配合を1回で呼び出せる（黄金比の答えは出ない）" },
  { id: "K05", cell: "3,1", board: "wisdom", ring: 1, cost: 4, glyph: "空", name: "空模様", scene: "日常", text: "地図と朝の画面で明日の天気が分かる" },
  { id: "K17", cell: "2,3", board: "wisdom", ring: 2, cost: 6, glyph: "葉", name: "葉の持ち", scene: "吸い出し・調整", text: "吸いすぎでの葉の傷みが減る（葉の体力が伸びる）" },
  { id: "K09", cell: "-2,3", board: "wisdom", ring: 3, cost: 6, glyph: "舌", name: "熟練の舌", scene: "制作全般", text: "フレーバーの熟練度が早く育つ" },
];

// ---------------------------------------------------------------- 授業7（2.6）。火種いらず・盤3段で開く

export const LESSON_MIN_STEP = 3;
/** reward: skill（新しい操作）／special（その人らしい強い効き目）／stat（能力が伸びる。bonus はマスの数） */
export const LESSONS = [
  { id: "M-B1", cell: "-4,0", board: "body", who: "minto", need: 5, sig: true, reward: "skill", name: "呼び込み上手",
    hint: "みんとと仲良くなると、お客さんの呼び方を教えてもらえそう",
    text: "バイトの客足が増え、店からの売上ボーナスが増える" },
  { id: "M-S1", cell: "3,1", board: "sense", who: "sumi", need: 0, reward: "skill", name: "蒸らしアタック",
    hint: "感覚盤を3段まで開けたら、スミさんが蒸らしの授業をしてくれる",
    text: "蒸らしで雑念の言葉を斬れる", scene: "ch1_sumi_attack", unlocks: ["_sumi_attack_learned"] },
  { id: "M-S2", cell: "-4,0", board: "sense", who: "adam", need: 5, sig: true, reward: "skill", name: "単体の美学",
    hint: "アダムと仲良くなると、一つの葉で勝負するやり方を教えてもらえそう",
    text: "葉1種だけで作る「単体で勝負」を選べる。その葉の熟練度の高さが深みとして評価される" },
  { id: "M-S3", cell: "-3,-1", board: "sense", who: "tsumugi", need: 5, sig: true, reward: "special", name: "安心できる色",
    hint: "つむぎと仲良くなると、落ち着ける色を教えてもらえそう",
    text: "夜、家シーシャにラベンダーを入れると、眠った時の体力の回復が増える" },
  { id: "M-W1", cell: "-4,0", board: "wisdom", who: "sumi", need: 0, reward: "skill", name: "キューブ炭",
    hint: "理論盤を3段まで開けたら、スミさんが炭の授業をしてくれる",
    text: "キューブ炭を選べる", scene: "ch1_sumi_cube_coals", unlocks: ["_coal_cube_learned"] },
  { id: "M-W2", cell: "2,-3", board: "wisdom", who: "sumi", need: 0, ring: 2, reward: "skill", name: "四つ置き・混ぜ置き",
    hint: "理論盤を3段まで開けたら、スミさんが炭の置き方の奥を教えてくれる",
    text: "炭の四つ置きと、フラット炭とキューブ炭の混ぜ置きを選べる", unlocks: ["_coal_four_unlocked", "_coal_mix_unlocked"] },
  { id: "M-W3", cell: "-3,-1", board: "wisdom", who: "naru", need: 5, sig: true, reward: "skill", name: "全部見てけ",
    hint: "なると仲良くなると、店の見方を教えてもらえそう",
    text: "ライバル店で一服すると、その一台の配合がレシピ帳に残る" },
];
export const REWARD_JA = { skill: "スキル", special: "特殊な技", stat: "能力が伸びる" };

/** キャラのタイプ（2.7）: ♥5でくれる色つきの火種の色だけを決める */
export const CHAR_TYPE = {
  minto: "body", adam: "sense", naru: "wisdom",
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
/** くじのラストワン賞（中身はシークレット）。箱を引き切るたびに色つきの火種1つ（いちばん段の低い盤の色） */
export const KUJI_LAST_ONE_GIFT = 1;
