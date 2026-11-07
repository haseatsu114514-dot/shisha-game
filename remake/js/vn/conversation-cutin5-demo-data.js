// 会話カットイン追加5案（#2845）の見比べデモ用データ（#2924）。本編の会話・エンジンからは読まない。
// 絵は、はじめの既存の立ち絵（新画風 new の表情7種）を切り抜くだけ。中間ポーズの新素材は使わない（オーナー決定: まず0枚）。
// 枠の形は Draft PR #2831 の A・C と #2845 の目安の座標（舞台 1280×720）。台詞は data/dialogue/<file>.json の実際の行を
// { dialogue, anchor } で引く（デモ側で台詞を書き換えない）。
//   on: "partner" … anchor の行（相手の行）に、はじめの顔だけを無言で出す / "line" … anchor の行（はじめの行）に出す
//   stay: "line" … その行の間だけ（次の行で即座に消える） / "fade" … 次の行で0.3秒かけて薄れる / ms … ms ミリ秒で消える
//   partners: 出せる条件の「相手の立ち絵の枚数」（#2845 オーナー決定: 相手の行は1枚の時だけ、案3・4 は独白の0枚も可）

export const SPRITE_DIR = "img/sprites/character_variants/new/hajime";
export const SPRITE = { w: 896, h: 1200 };
export const spriteSrc = (face) => `${SPRITE_DIR}/chr_hajime_${face}.webp`;
// 立ち絵（896×1200）の中の、顔の中心と帽子のつば〜目元の中心（原画の px）。表情ごとの小さなずれもここで吸収する
export const FOCUS = {
  face: { normal: [480, 205], sad: [468, 215], serious: [478, 202], surprise: [480, 205], smile: [480, 205] },
  brim: { normal: [482, 170], sad: [470, 180], serious: [480, 168], surprise: [482, 170], smile: [482, 170] },
};

// 枠（舞台 1280×720 の座標）。tall と band は Draft PR #2831 の A・C と同じ形（PR #2910 のデモとも同じ）
export const FRAMES = {
  tall: { x: 36, y: 192, w: 300, h: 334, poly: "0,23 300,0 264,334 0,334" },
  band: { x: 0, y: 308, w: 480, h: 218, poly: "0,31 480,0 425,195 0,218" },
  small: { x: 40, y: 130, w: 210, h: 230, poly: "0,14 210,0 196,230 0,230" },
  eyeband: { x: 0, y: 200, w: 380, h: 120, poly: "0,10 380,0 362,120 0,112" },
  // 相手のいない独白では帯を長めに（#2845 オーナー決定3）
  eyebandLong: { x: 0, y: 200, w: 640, h: 120, poly: "0,12 640,0 616,120 0,110" },
};

// pose: scale=原画 1px を何 px で映すか / fx,fy=focus（face|brim）を置く枠内の位置
// enter: slide 横すべり / fade 浮かぶ / rise 下から持ち上がる / wipe 左から幅を開く
// order: #2845 オーナー決定の「試す順序」2→1→5→4→3
export const CUTINS = [
  {
    id: "2a", plan: 2, order: 1, name: "「その顔」の答え合わせ（重い場面・A相当）",
    scene: "相手がはじめの顔に触れた行で、その顔を見せる。隠したつもりの沈み",
    face: "sad", faceNote: "提案表どおり sad（データ上の直前のはじめの行「……俺の？」は surprise）",
    frame: "tall", pose: { scale: 0.86, fx: 150, fy: 128 }, enter: "slide", on: "partner", stay: "line", partners: [1],
    sample: { file: "ch2_isolation", dialogue: "ch2_tsumugi_color", anchor: "お水が要る顔でした", before: 3, after: 1 },
    bg: "bg_tonari_inside_night.png",
  },
  {
    id: "2c", plan: 2, order: 1, name: "「その顔」の答え合わせ（軽い場面・C相当）", ms: 900,
    scene: "相手に顔を指摘された軽い照れ・ばつの悪さ。0.9秒で消える",
    face: "surprise", faceNote: "直前のはじめの行「え、こんなに見てる人が……！？」の表情",
    frame: "band", pose: { scale: 0.86, fx: 230, fy: 118 }, enter: "slide", on: "partner", partners: [1],
    sample: { file: "ch1_tsumugi", dialogue: "ch1_tsumugi_third", anchor: "急に、そんな顔しないでください", before: 1, after: 1 },
    bg: "bg_tonari_inside_night.png",
  },
  {
    id: "1", plan: 1, order: 2, name: "聞き手の小窓",
    scene: "相手の打ち明け話を、はじめが無言で受け止める（相手の行）。左上の小さめの枠を少し透かす",
    face: "sad", faceNote: "提案表どおり sad",
    frame: "small", pose: { scale: 0.62, fx: 108, fy: 100 }, enter: "fade", on: "partner", stay: "line", partners: [1], dim: true,
    sample: { file: "ch1_tsumugi", dialogue: "ch1_tsumugi_third", anchor: "見せた絵に「心がない」", before: 2, after: 1 },
    bg: "bg_tonari_inside_night.png",
  },
  {
    id: "5", plan: 5, order: 3, name: "胸に落ちる",
    scene: "絆の締めくくりで受け取る・礼を言う行。下から12px持ち上がって出て、枠線だけ琥珀色",
    face: "smile", faceNote: "台詞の表情 smile",
    frame: "tall", pose: { scale: 0.86, fx: 150, fy: 128 }, enter: "rise", on: "line", partners: [1], amber: true,
    sample: { file: "samechan", dialogue: "samechan_bond_finale", anchor: "大事に使います。ありがとうございます", before: 2, after: 1 },
    bg: "bg_shishark.png",
  },
  {
    id: "5b", plan: 5, order: 3, name: "胸に落ちる（スミさんの締めくくり）",
    scene: "道具を受け取って礼を言う行（もう1場面）",
    face: "smile", faceNote: "台詞の表情は normal。提案の「normal → smile 寄り」と既存素材 smile に合わせて smile",
    frame: "tall", pose: { scale: 0.86, fx: 150, fy: 128 }, enter: "rise", on: "line", partners: [1], amber: true,
    sample: { file: "ch1_bonds", dialogue: "ch1_sumi_bond_finale", anchor: "ありがとうございます。大事に使います", before: 2, after: 1 },
    bg: "bg_tonari_inside_night.png",
  },
  {
    id: "4", plan: 4, order: 4, name: "余白に沈む",
    scene: "負けのいちばん底の一言。絵を下げて頭上を空ける。消えるときだけ0.3秒かけて薄れる",
    face: "sad", faceNote: "台詞の表情 sad（手を前で組んでうつむく）",
    frame: "tall", pose: { scale: 0.86, fx: 150, fy: 196 }, enter: "fade", on: "line", stay: "fade", partners: [1], sink: true,
    sample: { file: "ch4_main", dialogue: "ch4_defeat", anchor: "届かなかった。悔しいな", before: 2, after: 1 },
    bg: "bg_dubai_grand_smoke_stage.png",
  },
  {
    id: "4m", plan: 4, order: 4, name: "余白に沈む（独白・相手なし）",
    scene: "店の裏口でひとりの一言。相手の立ち絵が無い場面でも出す（オーナー決定3）",
    face: "sad", faceNote: "台詞の表情 sad",
    frame: "tall", pose: { scale: 0.86, fx: 150, fy: 196 }, enter: "fade", on: "line", stay: "fade", partners: [0], sink: true,
    sample: { file: "ch2_main", dialogue: "ch2_abyss_baito", anchor: "俺、シーシャ、向いてないのかな", before: 3, after: 0 },
    bg: "bg_tonari_inside_night.png", // 会話の metadata.bg と同じ
  },
  {
    id: "3", plan: 3, order: 5, name: "決意の目元帯",
    scene: "大会本番の決意の一言。帽子のつばから目元だけを横長の帯で切り取る。相手がいるので帯は相手の手前（x380）まで",
    face: "serious", faceNote: "台詞の表情 serious",
    frame: "eyeband", pose: { scale: 1.25, fx: 200, fy: 60, focus: "brim" }, enter: "wipe", on: "line", partners: [1],
    sample: { file: "ch4_main", dialogue: "ch4_tournament_start", anchor: "全員に、勝ちたい", before: 2, after: 1 },
    bg: "bg_dubai_grand_smoke_stage.png",
  },
  {
    id: "3m", plan: 3, order: 5, name: "決意の目元帯（心の声・相手なし）",
    scene: "大会直前の心の声。相手がいないので帯を長め（x640）まで伸ばす（オーナー決定3）",
    face: "serious", faceNote: "台詞の表情 serious",
    frame: "eyebandLong", pose: { scale: 1.25, fx: 260, fy: 60, focus: "brim" }, enter: "wipe", on: "line", partners: [0],
    sample: { file: "ch1_tournament", dialogue: "ch1_tournament_arrival", anchor: "今の俺にできることを、やるしかない", before: 2, after: 0 },
    bg: "bg_tournament_stage.png",
  },
];

export const PLAN_NAMES = { 1: "聞き手の小窓", 2: "「その顔」の答え合わせ", 3: "決意の目元帯", 4: "余白に沈む", 5: "胸に落ちる" };

/** 実際の会話から、anchor の行の前後だけを取り出す（分岐・選択肢などの制御行は除く） */
export function sampleLines(cut, dialogues) {
  const d = dialogues[cut.sample.dialogue];
  const lines = (d?.lines || []).filter((l) => typeof l.text === "string" && !l.type);
  const i = lines.findIndex((l) => l.text.includes(cut.sample.anchor));
  if (i < 0) return [];
  const from = Math.max(0, i - cut.sample.before);
  return lines.slice(from, i + cut.sample.after + 1)
    .map((l, k) => ({ ...l, text: l.text.replace(/\[\/?[a-z]+\]/g, ""), cue: from + k === i }));
}

/** 案の行の時点で画面に出ている相手の立ち絵の枚数（デモは相手1人だけ映す。相手が話していない区間は0枚） */
export function partnersAtCue(lines) {
  const i = lines.findIndex((l) => l.cue);
  return lines.slice(0, i + 1).some((l) => l.speaker && l.speaker !== "hajime") ? 1 : 0;
}
