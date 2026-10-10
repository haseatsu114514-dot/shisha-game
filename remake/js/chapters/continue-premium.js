// 恋人限定の低確率コンティニュー。好感度や知り合いフラグから恋人だと推測しない。
// プレミアが出なかった場合は従来のスミさんの台詞に戻る。
export const PREMIUM_CONTINUE_RATE = 0.05;

export const PREMIUM_CONTINUE_SCRIPTS = {
  tsumugi: {
    id: "premium_tsumugi", title: "ずっと見てますから", name: "つむぎ",
    bio: "恋人 / つむぎ", speaker: "tsumugi", duration: 20,
    audio: null, // 音声生成後 ../assets/audio/voice/continue/premium_tsumugi.mp3 を指定
    cues: [
      { at: 0, face: "sad", text: "……あ、はじめさん……その……もう、終わりにしちゃうんですか……？ わたし、まだ勝つところ、見てないです……。" },
      { at: 4.1, face: "normal", text: "……帰っちゃうなら、仕方ないですけど……今日の絵、はじめさんの色だけ、途中になっちゃう……。" },
      { at: 8.3, face: "sad", text: "……もう一回だけ、お願いです。そうしないと、わたし……今夜、ずっと考えちゃう……。" },
      { at: 12.3, face: "serious", text: "明日も……明後日も……諦める瞬間ばっかり、何枚も何枚も描いちゃいそうで……。" },
      { at: 16.6, face: "smile", text: "……ふふっ。『大会に戻る』は、こっちですよ。……ね？ 押してくれますよね？ ……ずっと、見てますから。" },
    ],
  },
  minto: {
    id: "premium_minto", title: "私もあきらめない", name: "栞",
    bio: "恋人 / 仕事を離れた素の栞", speaker: "minto", duration: 20,
    audio: null,
    cues: [
      { at: 0, face: "ura_surprise", text: "……えっ。はじめくん……終わりにするの？ ……あの、まだ、やれるんじゃ……。" },
      { at: 4.1, face: "ura_sad", text: "……私、かっこいいところだけ見たいわけじゃ、ないよ。失敗した日も……一緒にいたいし……。" },
      { at: 8.4, face: "ura_normal", text: "……でも、勝手に諦められたら……ちょっと、寂しい。……応援する準備、いっぱいしてきたのに……。" },
      { at: 12.7, face: "ura_sad", text: "……もう一回、見せて。失敗してもいいから……はじめくんが、本気で作るところ……。" },
      { at: 17.0, face: "ura_smile", text: "……うん。帰ってきたら、ぎゅってする。……約束。" },
    ],
  },
  rin: {
    id: "premium_rin", title: "この先の香り", name: "凛",
    bio: "恋人 / 凛", speaker: "rin", duration: 20,
    audio: null,
    cues: [
      { at: 0, face: "serious", text: "……待って。諦めるには、まだ早いと思うけど。" },
      { at: 3.7, face: "normal", text: "さっきの一台、悔しさはあった。でも、まだちゃんと、はじめくんの香りが残ってた。" },
      { at: 8.0, face: "serious", text: "それを全部、ここで終わりにするの？ ……私は、まだ次の香りを確かめてない。" },
      { at: 12.3, face: "smile", text: "……ねえ。一回だけ、私のわがままを聞いてよ。今度こそ、届けて。" },
      { at: 16.8, face: "normal", text: "……戻るなら、最後まで見てる。恋人の特権ってことで。" },
    ],
  },
  ageha: {
    id: "premium_ageha", title: "帰るには早くない？", name: "アゲハ",
    bio: "恋人 / パラパラ", speaker: "ageha", duration: 20,
    audio: null,
    cues: [
      { at: 0, face: "surprise", text: "えっ！ ちょ待ち待ち待ち！ はじめ、ここで帰んの！？ まーじで！？" },
      { at: 3.8, face: "excited", text: "まだワンチャンどころかツーチャンもスリーチャンもあるっしょ！ あーしの彼氏だぞ！？" },
      { at: 8.1, face: "serious", text: "やらかした？ いいじゃん！ 次で取り返そ！ 失敗ごと全部ひっくるめて、はじめの煙じゃん！" },
      { at: 12.6, face: "smile", text: "あーし、勝つとこ見たい！ もう客席でめっちゃ応援してるし！ ここで帰ったら声援どうすんの！" },
      { at: 17, face: "excited", text: "ほら、コンティニュー！ いっけえええ！" },
    ],
  },
  mashiro: {
    id: "premium_mashiro", title: "まだ味見してない", name: "ましろ",
    bio: "恋人 / ましろ", speaker: "mashiro", duration: 20,
    audio: null,
    cues: [
      { at: 0, face: "sleep", text: "……ん。……終わり？ ……まだ、味見してないのに……。" },
      { at: 4.0, face: "normal", text: "……失敗したなら、もう一台、作ったらいいと思う……。……いつも、そうしてるでしょ……。" },
      { at: 8.3, face: "sad", text: "……私、はじめのシーシャ、好きだよ。……うまくいかないとこも、知ってるし……。" },
      { at: 12.4, face: "smile", text: "……うん。もう一回、作ろ。……終わったら、隣で一緒に吸いたい……。" },
      { at: 16.8, face: "sleep", text: "……それまで、寝ないで待ってる。……たぶん……。" },
    ],
  },
};

/**
 * 当該セーブで恋人関係が成立している人だけ抽選。
 * 第1章のミントは大会の対戦相手なので、恋人であっても登場させない。
 * 抽選は GAME OVER の発生時に1回だけ行い、セーブや画面切替で再抽選しない。
 */
export function choosePremiumContinue(lovers = [], chapter = 1, rng = Math.random) {
  const eligible = [...new Set(lovers)].filter((id) => Boolean(PREMIUM_CONTINUE_SCRIPTS[id]))
    .filter(id => id !== "minto" || chapter > 1);
  if (!eligible.length || rng() >= PREMIUM_CONTINUE_RATE) return null;
  return PREMIUM_CONTINUE_SCRIPTS[eligible[Math.floor(rng() * eligible.length)]];
}
