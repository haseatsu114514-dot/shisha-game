// 会話演出デモ（#2732 / 案は #2666）の定義。判断用のデモで、本編の台本・進行には組み込まない。
// 各案の「番号・名前・何が起きるか・見方・再現仕様・サンプル会話」をここに集める（ページと説明一覧の正本）。
// 本文の印: [pause]＝文中の一拍 / [shiver]…[/shiver]＝震え文字。行のフラグは lines の各項目で指定する。

export const EFFECT_ORDER = [1, 2, 13, 22, 29, 3, 7, 8, 12, 15, 23, 11];

export const EFFECTS = [
  {
    no: 1, name: "溜めの一拍", tag: "推奨", weight: "軽",
    summary: "行頭に0.3〜0.8秒の無音を置いてから文字送りを始める。",
    watch: "「……私、この店が好き。」の前で、台詞欄が空のまま少し待つ。OFFだと間髪入れずに文字が出る。",
    spec: "行に beat（ms）。文字送り開始を beat だけ遅らせる。画面は動かさない。SKIP／自動送りの高速では省く。",
    bgm: false,
    lines: [
      { speaker: "hajime", face: "normal", text: "今日、ずっと言おうと思ってたことがある。" },
      { speaker: "hiyori", face: "smile", text: "なあに？ 急に改まって。" },
      { speaker: "hajime", face: "normal", beat: 800, text: "……この店で、一緒に働いてほしい。" },
      { speaker: "hiyori", face: "surprise", beat: 500, text: "……うん。喜んで。" },
    ],
  },
  {
    no: 2, name: "言いよどみの減速", tag: "推奨", weight: "軽",
    summary: "本文の「……」の区間だけ文字送りを半速以下にし、文字送りの音（blip）も止める。",
    watch: "「えっと……その……」の「……」でゆっくりになり、音も途切れる。OFFだと一定の速さで進む。",
    spec: "「…」が2つ以上続く区間を自動検出。その区間の1字あたりの待ちを約2.4倍にし、blip を鳴らさない。",
    bgm: false,
    lines: [
      { speaker: "minto", face: "normal", text: "えっと……その……ね。\nあのお客さん、私のこと……見てなかった？" },
      { speaker: "hajime", face: "normal", text: "気のせいじゃないか。" },
      { speaker: "minto", face: "sad", text: "そう……かな……。\nでも、ちょっと……こわくて。" },
    ],
  },
  {
    no: 13, name: "表情切替の予兆", tag: "推奨", weight: "軽",
    summary: "表情が変わる直前の0.12秒だけ立ち絵を少し暗くしてから切り替える。",
    watch: "ひよりの表情が 通常→驚き→笑顔→悲しみ と飛ぶたび、切り替わりの直前に一瞬だけ暗くなる。",
    spec: "face が変わる行で、立ち絵の brightness を .35 へ0.12秒落としてから画像を替え、すぐ戻す。動きを減らす設定では省く。",
    bgm: false,
    lines: [
      { speaker: "hiyori", face: "normal", text: "今日はいつも通りだね。" },
      { speaker: "hiyori", face: "surprise", text: "あれ？ これ、私の知らない茶葉……！" },
      { speaker: "hiyori", face: "smile", text: "えへへ、ハジメくんが選んでくれたんだ。" },
      { speaker: "hiyori", face: "sad", text: "でも、もう残りが少ないんだね。" },
    ],
  },
  {
    no: 22, name: "周辺減光", tag: "推奨", weight: "軽",
    summary: "重要行で画面の縁だけを暗くし、中央の人物を残す。",
    watch: "3〜4行目で四隅がじわっと暗くなり、最後の行の後に戻る。",
    spec: "#vn の上に放射グラデの層（opacity 0→1を0.6秒）。動きを減らす設定では瞬時に切り替える。",
    bgm: false,
    lines: [
      { speaker: "hiyori", face: "normal", text: "明日、いよいよ大会だね。" },
      { speaker: "hajime", face: "normal", text: "ああ。" },
      { speaker: "hiyori", face: "smile", vignette: true, text: "ここまで来られたの、ハジメくんのおかげだよ。" },
      { speaker: "hajime", face: "normal", vignette: true, text: "……お前が信じてくれたからだ。" },
      { speaker: "hiyori", face: "smile", text: "えへへ。じゃあ、今日はもう帰って寝よう。" },
    ],
  },
  {
    no: 29, name: "BGMの息継ぎ", tag: "推奨", weight: "軽",
    summary: "重要行でBGMを一瞬 −6dB に落とし、次の行で戻す。光も動きも無い音の溜め。",
    watch: "音ありで再生する。2〜3行目でBGMが小さくなり（右上のメーターも下がる）、次の行で戻る。",
    spec: "行に duck。BGMのゲインを約0.15秒で半分（−6dB）へ、次の行の頭から約0.4秒で戻す。ここでは合成音のパッド音で代用（新素材なし）。",
    bgm: true,
    lines: [
      { speaker: "hiyori", face: "normal", text: "お店、どうなるんだろうね。" },
      { speaker: "hajime", face: "normal", duck: true, text: "……なくならないさ。\n俺がここにいる限りは。" },
      { speaker: "hiyori", face: "smile", duck: true, text: "……うん。" },
      { speaker: "hiyori", face: "smile", text: "じゃあ、炭を足そうか。" },
    ],
  },
  {
    no: 3, name: "文中ポーズ", tag: "追加", weight: "軽",
    summary: "文の途中で0.4秒止まり、▼は出さずに続きが出る。",
    watch: "「レモンは……2グラム、です」の「……」の後で一拍止まってから数字が出る。OFFだと止まらず続く。",
    spec: "本文の [pause] で0.4秒待つ。待っている間は▼を出さず、クリックは本文を最後まで出す。",
    bgm: false,
    lines: [
      { speaker: "hajime", face: "normal", text: "今日の配合を言うぞ。" },
      { speaker: "hajime", face: "normal", text: "レモンは[pause]2グラム、です。" },
      { speaker: "hiyori", face: "smile", text: "ミントは[pause]たっぷり、でしょ？" },
    ],
  },
  {
    no: 7, name: "心の声の薄墨", tag: "追加", weight: "軽",
    summary: "（）で始まる本文を、自動で薄い墨色・少し小さくし、文字送りの音を消す。",
    watch: "（）の行だけ色が沈んで小さくなり、音もしない。OFFだと地の台詞と同じ見た目。",
    spec: "本文が「（」で始まる行に .inner クラス（色 #9aa0b8・0.9倍）。blip を鳴らさない。全キャラの（）に効く。",
    bgm: false,
    lines: [
      { speaker: "hajime", face: "normal", text: "（今日は、ここで一息つこう）" },
      { speaker: "hiyori", face: "smile", text: "ハジメくん、お茶淹れたよ。" },
      { speaker: "hiyori", face: "smile", text: "（……なんで私、こんなにどきどきしてるんだろう）" },
      { speaker: "hajime", face: "normal", text: "ありがとう。いただくよ。" },
    ],
  },
  {
    no: 8, name: "震え文字", tag: "追加", weight: "軽",
    summary: "指定した区間の文字が1pxで小刻みに揺れる。",
    watch: "「さ、さむい……」と「こ、こわくない」の部分だけが細かく震える。動きを減らすを入れると止まる。",
    spec: "本文の [shiver]…[/shiver] を span 化し、0.08秒周期で ±1px。reduce-shake／prefers-reduced-motion では静止。",
    bgm: false,
    lines: [
      { speaker: "hiyori", face: "sad", text: "[shiver]さ、さむい……[/shiver]\n路地の風、冷たいね。" },
      { speaker: "hajime", face: "normal", text: "上着を貸そうか。" },
      { speaker: "minto", face: "sad", text: "[shiver]こ、こわくない……[/shiver]\nこわくないもん……。" },
    ],
  },
  {
    no: 12, name: "名札の色変わり", tag: "追加", weight: "軽",
    summary: "話者の名札の下に、キャラのテーマ色の線が引かれる。誰の台詞かが一目で分かる。",
    watch: "話者が替わるたびに、名札の下線の色がひより（桃）・みんと・ハジメで変わる。OFFだと全員同じ金色。",
    spec: "名札に border-bottom 3px を足し、色は manifest の introArt[id].color。常設の小さな印で、動きは無い。",
    bgm: false,
    lines: [
      { speaker: "hiyori", face: "smile", text: "いらっしゃいませ！" },
      { speaker: "minto", face: "normal", text: "こんばんは。今日も来ちゃった。" },
      { speaker: "hajime", face: "normal", text: "ちょうど席が空いたところだ。" },
      { speaker: "hiyori", face: "smile", text: "どうぞ、こちらへ。" },
    ],
  },
  {
    no: 15, name: "うなずき・首振り", tag: "追加", weight: "軽",
    summary: "立ち絵が縦に4px×2回（うなずき）、または横に4px×2回（首振り）動く。",
    watch: "「うん」で立ち絵が上下、「ちがうよ」で左右に小さく動く。画面は揺れない。",
    spec: "行に nod／shake_head。話者の立ち絵に Web Animations で translate を往復させる（約0.5秒）。reduceShake では省く。",
    bgm: false,
    lines: [
      { speaker: "hajime", face: "normal", text: "この配合で合ってるか？" },
      { speaker: "hiyori", face: "smile", nod: "nod", text: "うん。" },
      { speaker: "hajime", face: "normal", text: "じゃあ、炭は強めでいいな。" },
      { speaker: "hiyori", face: "normal", nod: "shake_head", text: "ちがうよ、今日は弱めで。" },
    ],
  },
  {
    no: 23, name: "背景のピント送り", tag: "追加", weight: "軽",
    summary: "会話に集中する区間だけ背景をぼかし（blur 4px）、終わると0.6秒で戻す。",
    watch: "2〜3行目で背景だけがぼやけて人物が浮く。4行目で背景が戻る。",
    spec: "行に focus。#bg に filter: blur(4px) を0.6秒で掛け、focus の無い行で戻す。動きを減らす設定では瞬時。",
    bgm: false,
    lines: [
      { speaker: "hiyori", face: "normal", text: "今日はお客さん、多かったね。" },
      { speaker: "hiyori", face: "smile", focus: true, text: "……ねえ、ハジメくん。\n二人だけで話してもいい？" },
      { speaker: "hajime", face: "normal", focus: true, text: "ああ。聞かせてくれ。" },
      { speaker: "hiyori", face: "smile", text: "ありがとう。じゃあ、片付けながらね。" },
    ],
  },
  {
    no: 11, name: "宣言の一字送り", tag: "追加", weight: "軽",
    summary: "短い決意の行だけ1文字ずつ重く出し、文字送りの音を乾いた tick に替える。",
    watch: "「俺が勝つ。」と「作ります。」がゆっくり、一字ずつ出る。OFFだと普通の速さ。",
    spec: "行に decl。1字あたり約90msで出し、blip の代わりに SE.tick。長い行には使わない（短い宣言向け）。",
    bgm: false,
    lines: [
      { speaker: "hiyori", face: "normal", text: "大会、どうするの？" },
      { speaker: "hajime", face: "normal", decl: true, text: "俺が勝つ。" },
      { speaker: "hiyori", face: "smile", text: "じゃあ、私は最高の一杯を。" },
      { speaker: "hiyori", face: "smile", decl: true, text: "作ります。" },
    ],
  },
];

/** [pause]／[shiver] を取り除いた表示文（組版の確認用） */
export const plainText = (text) => String(text).replace(/\[pause\]|\[\/?shiver\]/g, "");
