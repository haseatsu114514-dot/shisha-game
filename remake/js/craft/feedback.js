// 工程の成績を、記号と見守る人物の短い一言で伝える。
import { DB } from "../core/data.js";

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
    holes: ["いいぞ。空気の通り道が揃ってる", "穴は開いたな。間隔を揃えるともっといい", "少し偏ったな。次は外周を丁寧に"],
    heat: ["いい火だ。全面がきれいに熾きてる", "悪くねえ。全面が赤くなる頃合いを、もう一度見とけ", "取り出す時機を確かめよう。黒い面が消えたのが目印だ"],
    steam: ["落ち着いて待てたな。その調子だ", "少し揺れたが、踏ん張ったな", "気が散ったな。息を整えていこう"],
    pull: ["いい頃合いだ。これなら出せる", "よし。次も熱を見ながら整えてみろ", "熱が合わなかったな。焦らず一口ずつだ"],
    care: ["最後まで守ったな。いい仕事だ", "立て直せたな。次も熱を見ていこう", "次は熱の流れを一つずつ確かめよう"],
    default: ["いい手つきだ。その調子でいこう", "悪くねえ。落ち着いて続けろ", "焦らなくていい。一つずつ確かめよう"],
  },
  dr_kemuri: {
    holes: ["穴の間隔が均一です。いい状態ですね", "通り道はできています。次は間隔も揃えましょう", "偏りが見えますね。外周から整えてみましょう"],
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
  nagumo: {
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
  const rounds = [cs?.pull, cs?.careHistory?.[0], cs?.careHistory?.[1]];
  // 各工程の終了時に記録した判定を読む。最後の葉の傷みで過去の適温帯を狭めない。
  const temperatures = rounds.map(result => result && !result.failed && !result.skipped
    && Number.isFinite(result.score) && Number.isFinite(result.temp) && typeof result.inZone === "boolean"
    ? result.inZone : null);
  if (temperatures.every(value => value === true)) return "提供も2回の調整も、いい温度だったねえ";
  if (temperatures.some(value => value === false)) return "温度が合わなかったところがあるねえ。次は一口ずついこう";
  return feedbackLine("maezono", "default", evaluationOf(cs?.parts?.shisha || 0));
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
  nagumo: { care: "……ここからの手際を見ていよう", default: "……ここからを見ていよう" },
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
  nagumo: {
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
