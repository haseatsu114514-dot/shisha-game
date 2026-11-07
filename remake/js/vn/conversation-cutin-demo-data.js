// 会話カットイン案のデモ用データ（#2903）。本編の会話・エンジンからは読まない。
// 絵は現行の登場グラフィックカットイン（顔の白い絵柄）1枚だけを使い、枠・切り取り・頭や肩の角度・出入りで案を分ける。
// 台詞は data/dialogue/<file>.json の実際の行を { dialogue, anchor } で引く（デモ側で台詞を書き換えない）。
//   on: "line" … anchor の行（はじめの行）に出す / "partner" … anchor の行（相手の行）に、はじめの顔だけを無言で出す
//   kind: "A" … 次の行まで残る / "C" … ms ミリ秒で消える

export const ART = "img/ui/character_intros/graphic/hajime.webp";
// 原画（1024×1024）の中の顔の中心（幅に対する割合）。回転もここを軸にする
export const FACE = { x: 0.56, y: 0.38 };
export const BRIM = { x: 0.56, y: 0.3 }; // 帽子のつば〜前髪（目元帯用）

// 枠（舞台 1280×720 の座標）。tall と band は Draft PR #2831 の A・C と同じ形
export const FRAMES = {
  tall: { x: 36, y: 192, w: 300, h: 334, poly: "0,23 300,0 264,334 0,334" },
  band: { x: 0, y: 308, w: 480, h: 218, poly: "0,31 480,0 425,195 0,218" },
  small: { x: 40, y: 130, w: 210, h: 230, poly: "0,14 210,0 196,230 0,230" },
  slit: { x: 60, y: 96, w: 150, h: 424, poly: "22,0 150,0 128,424 0,424" },
  eyeband: { x: 0, y: 206, w: 380, h: 120, poly: "0,10 380,0 362,120 0,112" },
};

// pose: w=絵の幅(px) / cx,cy=顔の中心を置く枠内の位置 / rot=頭と肩の角度(度、＋で相手側＝右へ傾く) / focus=FACE|BRIM
// enter: slide 横すべり / fade 浮かぶ / rise 下から持ち上がる / wipe 左から幅を開く / slit 縦に開く
export const CUTINS = [
  {
    id: "A1", kind: "A", name: "基本の残る形", origin: "#2831 A",
    scene: "はじめの普段の強調。気持ちが動いた一言（通常時の基本形）",
    pose: { w: 420, cx: 150, cy: 145, rot: 0 }, frame: "tall", enter: "slide", on: "line",
    change: "現行グラフィックの構図そのまま（比較の基準）",
    sample: { file: "ch1_tsumugi", dialogue: "ch1_tsumugi_second", anchor: "なんか、いいな。煙をそんなふうに", before: 2, after: 2 },
  },
  {
    id: "A2", kind: "A", name: "聞き手の小窓", origin: "#2845 案1",
    scene: "相手の打ち明け話を黙って受け止める（相手の行に、はじめは無言）。1会話1回まで",
    pose: { w: 300, cx: 110, cy: 108, rot: 4 }, frame: "small", enter: "fade", on: "partner", dim: true,
    change: "頭と肩を相手側（右）へ約4°傾ける。枠は小さく左上、少し透かす",
    sample: { file: "ch1_tsumugi", dialogue: "ch1_tsumugi_third", anchor: "見せた絵に「心がない」", before: 2, after: 1 },
  },
  {
    id: "A3", kind: "A", name: "「その顔」の答え合わせ（重い場面）", origin: "#2845 案2",
    scene: "相手がはじめの顔に触れた行で、その顔を見せる。隠したつもりの沈み",
    pose: { w: 420, cx: 150, cy: 152, rot: -2 }, frame: "tall", enter: "slide", on: "partner",
    change: "頭をわずかに引いて（−2°）重心を下げる",
    sample: { file: "ch2_isolation", dialogue: "ch2_tsumugi_color", anchor: "お水が要る顔でした", before: 3, after: 1 },
  },
  {
    id: "A4", kind: "A", name: "余白に沈む", origin: "#2845 案4",
    scene: "負け・挫折のいちばん底の一言。1章に1〜2回だけ",
    pose: { w: 400, cx: 146, cy: 196, rot: -3 }, frame: "tall", enter: "fade", on: "line", sink: true,
    change: "絵を枠の下へ下げて頭上を空け、頭と肩を少し落とす（−3°）。消えるときだけ0.3秒で薄れる",
    sample: { file: "ch4_main", dialogue: "ch4_defeat", anchor: "届かなかった。悔しいな", before: 2, after: 1 },
  },
  {
    id: "A5", kind: "A", name: "胸に落ちる", origin: "#2845 案5",
    scene: "絆の締めくくりで受け取る・礼を言う行。相手ごとに1回まで",
    pose: { w: 420, cx: 152, cy: 150, rot: 2 }, frame: "tall", enter: "rise", on: "line", amber: true,
    change: "会釈の手前くらいに頭を下げる（＋2°）。下から12px持ち上がって出る。枠線はこの案だけ琥珀色",
    sample: { file: "samechan", dialogue: "samechan_bond_finale", anchor: "大事に使います。ありがとうございます", before: 2, after: 1 },
  },
  {
    id: "A6", kind: "A", name: "決意の目元帯", origin: "#2845 案3",
    scene: "大会本番・決意の一言。次の行まで残る。1章に2〜3回まで",
    pose: { w: 760, cx: 206, cy: 62, rot: -2, focus: "brim" }, frame: "eyeband", enter: "wipe", on: "line",
    change: "帽子のつば〜口元だけを横長に切り取り、あごを少し引く（−2°）",
    sample: { file: "ch4_main", dialogue: "ch4_tournament_start", anchor: "全員に、勝ちたい", before: 2, after: 1 },
  },
  {
    id: "A7", kind: "A", name: "向き直る一言", origin: "新規",
    scene: "相手に向き直って本音で受けて立つ一言（勝負を受ける・頼みを引き受ける）",
    pose: { w: 470, cx: 156, cy: 150, rot: -3 }, frame: "tall", enter: "slide", on: "line",
    change: "少しだけ寄せ（顔を約1割大きく）、頭を起こして肩を開く（−3°）",
    sample: { file: "ch5_main", dialogue: "ch5_opening", anchor: "受けます。うまく言い返せないんで", before: 2, after: 1 },
  },
  {
    id: "C1", kind: "C", name: "基本の短く消える形", origin: "#2831 C", ms: 900,
    scene: "短い驚き・ツッコミ（特別な場面の基本形）",
    pose: { w: 380, cx: 220, cy: 126, rot: 0 }, frame: "band", enter: "slide", on: "line",
    change: "現行グラフィックの構図そのまま（比較の基準）。0.9秒で消える",
    sample: { file: "ch1_tsumugi", dialogue: "ch1_tsumugi_second", anchor: "えっ、見てないのに、わかるの？", before: 1, after: 1 },
  },
  {
    id: "C2", kind: "C", name: "「その顔」の答え合わせ（軽い場面）", origin: "#2845 案2", ms: 900,
    scene: "相手に顔を指摘された軽い照れ・ばつの悪さ（相手の行に出す）",
    pose: { w: 380, cx: 224, cy: 130, rot: 3 }, frame: "band", enter: "slide", on: "partner",
    change: "頭を相手側へ少し傾ける（＋3°）。0.9秒で消える",
    sample: { file: "ch1_tsumugi", dialogue: "ch1_tsumugi_third", anchor: "急に、そんな顔しないでください", before: 1, after: 1 },
  },
  {
    id: "C3", kind: "C", name: "図星の一閃", origin: "新規", ms: 600,
    scene: "図星を突かれてごまかす一言。縦の細い枠が一瞬だけ差し込む",
    pose: { w: 520, cx: 72, cy: 196, rot: -3 }, frame: "slit", enter: "slit", on: "line",
    change: "顔に寄せて縦に細く切り取り、頭をわずかに引く（−3°）。0.6秒で消える",
    sample: { file: "ch4_desert", dialogue: "ch4_desert_arrive", anchor: "ひ、日焼けです", before: 1, after: 1 },
  },
  {
    id: "C4", kind: "C", name: "目元の一瞬", origin: "新規（#2845 案3 の短い版）", ms: 700,
    scene: "大会直前の心の声。相手のいない独白でも短く出せる",
    pose: { w: 760, cx: 206, cy: 64, rot: 0, focus: "brim" }, frame: "eyeband", enter: "wipe", on: "line",
    change: "目元帯と同じ切り取りで角度は現行のまま。0.7秒で消える",
    sample: { file: "ch1_tournament", dialogue: "ch1_tournament_arrival", anchor: "今の俺にできることを、やるしかない", before: 2, after: 0 },
  },
  {
    id: "C5", kind: "C", name: "不意打ちの振り向き", origin: "新規", ms: 900,
    scene: "思いがけず名指しされた瞬間（「え、俺が？」）",
    pose: { w: 400, cx: 236, cy: 124, rot: 4 }, frame: "band", enter: "slide", on: "line",
    change: "頭と肩を相手側へ向ける（＋4°）。少し寄せる。0.9秒で消える",
    sample: { file: "ch1_bonds", dialogue: "ch1_sumi_bond_finale", anchor: "え、俺がですか", before: 1, after: 1 },
  },
];

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
