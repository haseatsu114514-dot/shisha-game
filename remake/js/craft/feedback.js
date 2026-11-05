// 工程の成績を、記号と見守る人物の短い一言で伝える。
import { state } from "../core/state.js";
import { DB } from "../core/data.js";
import { recordedTemperatureStates } from "./temperature-records.js";

/** 自主練の内心も、他の台詞と同じ正本JSONから読む。 */
export function innerVoiceLine(step, kind) {
  return (DB.dialogues[`craft_inner_${step}_${kind}`] || DB.dialogues[`craft_inner_default_${kind}`])?.lines[0]?.text || "";
}

export function evaluationOf(score) {
  return score >= 90 ? { mark: "◎", tone: "bright", index: 0, kind: "just", label: "とても良い" }
    : score >= 65 ? { mark: "○", tone: "warm", index: 1, kind: "good", label: "良い" }
      : { mark: "△", tone: "quiet", index: 2, kind: "bad", label: "次は整えよう" };
}

const COMMENTS = {
  sumi: {
    holes: ["いいぞ。空気の通り道が揃ってる", "穴は開いたな。間隔を揃えるともっといい", "少し偏ったな。次に作る時は、目印と間隔をよく見よう"],
    heat: ["いい火だ。全面がきれいに熾きてる", "悪くねえ。全面が赤くなる頃合いを、もう一度見とけ", "取り出す時機を確かめよう。黒い面が消えたのが目印だ"],
    steam: ["落ち着いて待てたな。その調子だ", "少し揺れたが、踏ん張ったな", "気が散ったな。息を整えていこう"],
    pull: ["いい頃合いだ。これなら出せる", "よし。次も熱を見ながら整えてみろ", "熱が合わなかったな。焦らず一口ずつだ"],
    care: ["最後まで守ったな。いい仕事だ", "立て直せたな。次も熱を見ていこう", "次は熱の流れを一つずつ確かめよう"],
    default: ["いい手つきだ。その調子でいこう", "悪くねえ。落ち着いて続けろ", "焦らなくていい。一つずつ確かめよう"],
  },
  dr_kemuri: {
    holes: ["穴の間隔が均一です。いい状態ですね", "通り道はできています。次は間隔も揃えましょう", "偏りが見えますね。次に作る時は、目印と間隔を確かめましょう"],
    heat: ["全面が均一に熾きています。いい状態です", "火は入っています。取り出す時機も確かめましょう", "取り出す時機に偏りがありますね。黒い面が残っていないか確かめましょう"],
    care: ["最後まで温度が安定していますね", "立て直せています。次は変化を早めに見ましょう", "熱の振れが大きいですね。一手ずつ確かめましょう"],
    default: ["いい状態です。丁寧な手順ですね", "形になっています。もう少し整えてみましょう", "一度手順を確かめましょう。まだ調整できます"],
  },
  maezono: {
    steam: ["お、落ち着いてるねえ！ 続きも楽しみだ", "踏ん張ったねえ。そのままいこう", "ちょっと力が入ってるねえ。肩の力を抜こうか"],
    pull: ["シーシャはおいしいねえ！ いい温度だ", "いいねえ。次は温度をもっと揃えたいね", "少し熱が合わなかったねえ。次は一口ずついこう"],
    default: ["お、いいねえ！ 続きが楽しみだ", "いいねえ。そのまま丁寧にいこう", "一つずつ整えていこうか。まだこれからだよ"],
  },
  emil: {
    steam: ["待つところまで、手順が通っている", "熱は入っている。次の一口も見よう", "急いで触れたな。葉の時間を確かめたい"],
    pull: ["最初の煙と、奥の味がつながった", "煙は出た。次は続く味を見せてくれ", "熱が合っていない。もう一口ずつ確かめよう"],
    default: ["手に理由がある。続けてくれ", "形は見えた。最後まで確かめよう", "まだ直せる。一つずつ見よう"],
  },
  sui: {
    default: ["……手元が落ち着いている。そのまま続けなさい", "形にはなっている。最後まで見よう", "……急ぐな。まず一つずつ整えなさい"],
  },
  // 第4章のゲスト審査員。FESTAで話した時と同じ、くだけた短い口調。
  da_silva: {
    holes: ["いいな、通り道が揃ってる。煙が気持ちよく抜けるぞ", "穴は開いた。間隔が揃えば、もっと軽くなる", "通り道が偏ってる。吸う人が引っかかるぞ"],
    heat: ["炭が全面で笑ってる。いい火だ", "火は入った。取り出す瞬間、もう一回見とけ", "火の入りがまだらだ。炭の顔を見てやれ"],
    care: ["最後まで楽しく吸える熱だ。いいフェスタだった", "途中で戻したな。客は見てるぞ、ちゃんと", "熱が暴れてる。客の顔を見る前に、台を見ろ"],
    default: ["いいね、手が迷ってない", "悪くない。もう一段、楽しくできる", "固くなってるぞ。息、吐いとけ"],
  },
};

export function feedbackLine(id, step, evaluation) {
  if (id === "hajime") return innerVoiceLine(step, ["excellent", "good_result", "retry"][evaluation.index]);
  const voice = COMMENTS[id] || COMMENTS.sumi;
  return (voice[step] || voice.default)[evaluation.index];
}

/** 第1章結果表の上園。完成品の品質点を、温度の成否に読み替えない。 */
export function judgeComment(cs) {
  const temperatures = recordedTemperatureStates(cs);
  if (temperatures.every(value => value === true)) return "提供も2回の調整も、いい温度だったねえ";
  if (temperatures.some(value => value === false)) return "温度が合わなかったところがあるねえ。次は一口ずついこう";
  return feedbackLine("maezono", "default", evaluationOf(cs?.parts?.shisha || 0));
}

// 結果画面に登場する5人。COMMENTS・WATCHと大会台詞の口調を使い、未記録の失敗原因は断定しない。
const JUDGE_DEDUCTION_LINES = {
  maezono: {
    holes: "穴：次は間隔を揃えてみようか",
    heat: "炭：取り出す頃合いを見てみようか",
    shisha: "完成品：配合と仕上がりを見直そうか",
    care1: "調整1：炭の交換を見直したいねえ",
    care2: "調整2：後半の熱も確かめたいねえ",
  },
  dr_kemuri: {
    holes: "穴：目印と間隔を確かめましょう",
    heat: "炭：全面の熾き具合を確かめましょう",
    shisha: "完成品：配合と熱のつながりを見ましょう",
    care1: "調整1：交換する炭の数を見直しましょう",
    care2: "調整2：葉の残りと熱を確かめましょう",
  },
  sui: {
    holes: "穴：急がず、間隔を揃えなさい",
    heat: "炭：取り出す時機を見直しなさい",
    shisha: "完成品：配合の狙いを最後まで通しなさい",
    care1: "調整1：一手ずつ熱を確かめなさい",
    care2: "調整2：最後まで葉と熱を見なさい",
  },
  emil: {
    holes: "穴：通り道の間隔を確かめたい",
    heat: "炭：取り出す瞬間をもう一度見よう",
    shisha: "完成品：配合から続く味を見せてくれ",
    care1: "調整1：炭を換えた後の変化を見よう",
    care2: "調整2：葉の残りと熱を最後まで見よう",
  },
  da_silva: {
    holes: "穴：目印を見て、間隔を揃えようぜ",
    heat: "炭：全面が赤くなる瞬間を見とけ",
    shisha: "完成品：配合と仕上がり、もう一段だ",
    care1: "調整1：炭の交換、焦らず見直そうぜ",
    care2: "調整2：後半の葉と熱も見てやれ",
  },
};

// 表示専用。全審査員が同じ工程品質を使い、好み・試喫順の補正は工程別ではない。
// finalize と同じ重みで満点との差を比較。同点は穴・炭・完成品・調整1・調整2の順。
export function judgeDeductionReason(cs, judgeId) {
  const skipped = cs?.foilSkipped || cs?.holes?.skipped;
  const items = [
    ["holes", "穴あけに減点、目印と間隔を確かめよう"],
    ["heat", "炭焼きに減点、取り出す頃合いを確かめよう"],
    ["shisha", "完成品に減点、配合と仕上がりを見直そう"],
    ["care1", "調整1に減点、炭の交換と熱の変化を見よう"],
    ["care2", "調整2に減点、後半の葉と熱の変化を見よう"],
  ];
  let worst = null, maxLoss = 0, recorded = 0;
  for (const [item, text] of items) {
    if (item === "holes" && skipped) continue;
    const score = cs?.parts?.[item];
    if (!Number.isFinite(score)) continue;
    recorded++;
    // 通常は各20%。穴あけ省略の第1章大会だけ完成品40%（共通の分母は比較に不要）。
    const weight = skipped && (cs.chapter ?? state?.chapter) === 1 && cs.mode === "tournament" && item === "shisha" ? 2 : 1;
    const loss = Math.max(0, 100 - score) * weight;
    if (loss > maxLoss) { maxLoss = loss; worst = { item, text }; }
  }
  if (worst) return { ...worst, text: JUDGE_DEDUCTION_LINES[judgeId]?.[worst.item] || worst.text };
  return { item: null, text: recorded ? "記録のある工程は減点なし、丁寧に仕上げたね" : "工程の記録がなく、減点項目は確認できない" };
}

// 判定前の「見ている」間に出す一言。地の文の説明ではなく、本人が話す体で短く。
const WATCH = {
  sumi: { default: "手元を見ているぞ。落ち着いていけ" },
  dr_kemuri: {
    setup: "水の加減、見ていきますね", pack: "詰め方を見ていきます", holes: "穴の配置を見ていきましょう",
    heat: "炭の熾き具合を見ていきます", place: "炭の置き方を見てみましょう", care: "ここからの熱の管理を見ていきます",
    default: "ここからの手順を見ていきますね",
  },
  maezono: { steam: "さて、蒸らしだねえ。楽しみだ", pull: "どんな味になるか見てみよう", default: "ここからだねえ、楽しみにしてるよ" },
  emil: { mix: "……配分を見ている", steam: "……葉の時間を見ている", pull: "……味の変化を見ている", default: "……ここからを見ている" },
  sui: { care: "……ここからの手際を見ていよう", default: "……ここからを見ていよう" },
  da_silva: { holes: "さて、通り道の作り方だ", heat: "炭、見せてもらうぞ", default: "審査席から見てるぞ" },
};

export function watchLine(id, step) {
  const voice = WATCH[id] || WATCH.sumi;
  return voice[step] || voice.default;
}

const LIVE = {
  sumi: {
    holes: ["その間隔だ。いい手つきだな", "少し手が詰まったか。落ち着いて続けろ"],
    heat: ["炭の全面まで赤くなってるな", "取り出した炭の焼け具合を確かめよう"],
    steam: ["……", "……"],
    pull: ["煙が落ち着いてきたな", "口に来る熱を、もう一度確かめてみろ"],
    care: ["煙が揃ってきたな", "熱が揺れてるな。落ち着いて見よう"],
    default: ["いい手つきだ。続けてみろ", "焦らなくていい。丁寧にいこう"],
  },
  dr_kemuri: {
    holes: ["空気の通り道が揃ってきましたね", "穴の間隔に少し偏りが見えますね"],
    heat: ["全面に熱が入ってきていますね", "炭の中と表面では、温まり方が違いますね"],
    care: ["温度が落ち着いてきましたね", "熱の流れが変わりましたね"],
    default: ["手順が落ち着いていますね", "少し手が急いでいるようですね"],
  },
  maezono: {
    steam: ["……", "……"],
    pull: ["いい煙が上がってきたねえ！", "熱の入り方が変わってきたねえ"],
    default: ["お、いい手つきだねえ", "ちょっと力が入っているねえ"],
  },
  emil: {
    steam: ["……葉を待っている", "……熱の動きを見ている"],
    pull: ["奥の味まで届いてきた", "熱の変化を確かめよう"],
    default: ["理由のある手つきだ", "急がず、台を見よう"],
  },
  sui: {
    default: ["……手元は落ち着いているな", "……急ぐ必要はない"],
  },
  da_silva: {
    holes: ["おっ、揃ってきた", "急ぐな、まだ間に合う"],
    heat: ["いい赤だ", "炭の色、もう一回見ろ"],
    default: ["いいぞ、その調子", "肩の力、抜いとけ"],
  },
};

// 操作の説明を口にするのはチュートリアルのスミさんだけ。
const TUTORIAL_GUIDES = {
  holes: "配置を選んで、光る目印で押せ。選んだ配置を開け終えたら仕上げだ",
  heat: "炭の全面が赤くなったら押せ。3つとも取り出したら完了だ",
  steam: "……", // SF17・25: 蒸らし中は表情と心拍で示し、操作・呼吸を説明しない。
  pull: "針を止めて吸い方を決めろ。2回以上吸い、緑の範囲で味を整えて提供だ",
  care: "消耗した炭を何個交換するか決めて焼け。吸って最後まで守るんだ",
};
const TUTORIAL_LIVE = {
  holes: ["その調子だ。目印と重なる瞬間を狙え", "次の目印を見よう。焦らずタイミングを合わせろ"],
  heat: ["その赤だ。残りの炭も全面の色を見て押せ", "取り出した炭と、まだ焼いている炭の色を見比べろ"],
  steam: ["……", "……"],
  pull: ["味が整ったら、キープの中央で温度を保てるぞ", "まだ合わせられる。キープ左で微減、右で微増だ"],
};
export const tutorialGuide = step => TUTORIAL_GUIDES[step] || "";

export function commentaryLine(id, step, positive, { tutorial = false } = {}) {
  if (id === "hajime") return innerVoiceLine(step, positive ? "good" : "bad");
  if (tutorial && id === "sumi" && TUTORIAL_LIVE[step]) return TUTORIAL_LIVE[step][positive ? 0 : 1];
  const voice = LIVE[id] || LIVE.sumi;
  return (voice[step] || voice.default)[positive ? 0 : 1];
}
