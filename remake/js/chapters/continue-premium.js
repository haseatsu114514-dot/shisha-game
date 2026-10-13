// 恋人限定・通常抽選20%のプレミアコンティニュー。好感度や知り合いフラグから恋人だと推測しない。
// プレミアが出なかった場合は従来のスミさんの台詞に戻る。
export const PREMIUM_CONTINUE_RATE = 0.20;

export const PREMIUM_CONTINUE_SCRIPTS = {
  tsumugi: {
    id: "premium_tsumugi", title: "ずっと見てますから", name: "つむぎ",
    bio: "恋人 / つむぎ", speaker: "tsumugi", duration: 20,
    audio: null, // 音声生成後 ../assets/audio/voice/continue/premium_tsumugi.mp3 を指定
    reactions: {
      retry: { text: ["……よかったぁ。……ふふ。", "まだ、続きが描けますね。", "……ちゃんと見てます。"], faces: ["sad", "smile"], effect: "pencil", word: "続きが描けますね" },
      quit: { text: ["……そっか。今日は休みましょう。", "……途中の絵、大事に取っておきますね。", "……ふふ。"], faces: ["normal", "smile"], effect: "canvas", word: "今日は休みましょう" },
    },
    cues: [
      { at: 0, face: "sad", text: "……あ、はじめさん……その……" },
      { at: 1.2, face: "sad", text: "もう、終わりにしちゃうんですか……？" },
      { at: 2.5, face: "sad", text: "わたし、まだ勝つところ、見てないです……。" },
      { at: 4, face: "normal", text: "……帰っちゃうなら、仕方ないですけど……" },
      { at: 5.4, face: "normal", text: "今日の絵、はじめさんの色だけ" },
      { at: 6.6, face: "normal", text: "途中になっちゃう……。" },
      { at: 7.6, face: "sad", text: "……もう一回だけ、お願いです。" },
      { at: 8.8, face: "sad", text: "そうしないと、わたし……" },
      { at: 9.9, face: "sad", text: "今夜、ずっと考えちゃう……。" },
      { at: 11.1, face: "serious", text: "明日も……明後日も……" },
      { at: 12.1, face: "serious", text: "諦める瞬間ばっかり" },
      { at: 13.1, face: "serious", text: "何枚も何枚も描いちゃいそうで……。" },
      { at: 14.4, face: "smile", text: "……ふふっ。" },
      { at: 15.2, face: "smile", text: "『大会に戻る』は、こっちですよ。" },
      { at: 16.5, face: "smile", text: "……ね？ 押してくれますよね？" },
      { at: 17.7, face: "smile", text: "……ずっと、見てますから。" },
    ],
  },
  minto: {
    id: "premium_minto", title: "私もあきらめない", name: "栞",
    bio: "恋人 / 仕事を離れた素の栞", speaker: "minto", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["……うん。そうだよね。私、ちゃんと見てる。", "……帰ってきたら、ぎゅってするから。"], faces: ["ura_sad", "ura_smile"], effect: "warm", word: "ぎゅってするから" },
      quit: { text: ["……うん。頑張ったの、知ってるよ。", "今日は帰って、あったかいもの飲も？"], faces: ["ura_normal"], effect: "warm", word: "頑張ったの、知ってるよ" },
    },
    cues: [
      { at: 0, face: "ura_surprise", text: "……えっ。はじめくん……終わりにするの？" },
      { at: 1.7, face: "ura_surprise", text: "……あの、まだ、やれるんじゃ……。" },
      { at: 3.3, face: "ura_sad", text: "……私、かっこいいところだけ" },
      { at: 4.7, face: "ura_sad", text: "見たいわけじゃ、ないよ。" },
      { at: 6, face: "ura_sad", text: "失敗した日も……一緒にいたいし……。" },
      { at: 7.6, face: "ura_normal", text: "……でも、勝手に諦められたら……" },
      { at: 9.1, face: "ura_normal", text: "ちょっと、寂しい。" },
      { at: 10.2, face: "ura_normal", text: "……応援する準備、いっぱいしてきたのに……。" },
      { at: 12.1, face: "ura_sad", text: "……もう一回、見せて。" },
      { at: 13.3, face: "ura_sad", text: "失敗してもいいから……" },
      { at: 14.5, face: "ura_sad", text: "はじめくんが、本気で作るところ……。" },
      { at: 16.1, face: "ura_smile", text: "……うん。帰ってきたら、ぎゅってする。" },
      { at: 17.8, face: "ura_smile", text: "……約束。" },
    ],
  },
  rin: {
    id: "premium_rin", title: "この先の香り", name: "凛",
    bio: "恋人 / 凛", speaker: "rin", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["……いい返事。次の一台、私に見せて。", "まだサンプルは終わってないから。"], faces: ["serious", "smile"], effect: "scan", word: "次の一台、私に見せて" },
      quit: { text: ["……うん。やめどきも判断のうち。", "次は違う配合、試そっか。"], faces: ["normal"], effect: "scan", word: "やめどきも判断のうち" },
    },
    cues: [
      { at: 0, face: "serious", text: "……待って。" },
      { at: 1.1, face: "serious", text: "諦めるには、まだ早いと思うけど。" },
      { at: 2.9, face: "normal", text: "さっきの一台、悔しさはあった。" },
      { at: 4.7, face: "normal", text: "でも、まだちゃんと" },
      { at: 6, face: "normal", text: "はじめくんの香りが残ってた。" },
      { at: 7.7, face: "serious", text: "それを全部、ここで終わりにするの？" },
      { at: 9.7, face: "serious", text: "……私は、まだ次の香りを確かめてない。" },
      { at: 11.8, face: "smile", text: "……ねえ。" },
      { at: 12.8, face: "smile", text: "一回だけ、私のわがままを聞いてよ。" },
      { at: 14.7, face: "smile", text: "今度こそ、届けて。" },
      { at: 16, face: "normal", text: "……戻るなら、最後まで見てる。" },
      { at: 17.8, face: "normal", text: "恋人の特権ってことで。" },
    ],
  },
  ageha: {
    id: "premium_ageha", title: "帰るには早くない？", name: "アゲハ",
    bio: "恋人 / パラパラ", speaker: "ageha", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["っしゃあ！ それでこそハジメっち！", "アタシの声援、ちゃんと届いた！？"], faces: ["excited"], effect: "cheer", word: "っしゃあ！" },
      quit: { text: ["おっけ！ 今日は撤収！", "ハジメっちの頑張り、アタシ見てたし！"], faces: ["smile"], effect: "farewell", word: "アタシ見てたし！" },
    },
    cues: [
      { at: 0, face: "surprise", text: "えっ！ ちょ待ち待ち待ち！" },
      { at: 1.4, face: "surprise", text: "ハジメっち、ここで帰んの！？ まーじで！？" },
      { at: 3.4, face: "excited", text: "まだワンチャンどころか" },
      { at: 4.7, face: "excited", text: "ツーチャンもスリーチャンもあるっしょ！" },
      { at: 6.5, face: "excited", text: "アタシの彼氏だぞ！？" },
      { at: 7.8, face: "serious", text: "やらかした？ いいじゃん！ 次で取り返そ！" },
      { at: 9.7, face: "serious", text: "失敗ごと全部ひっくるめて" },
      { at: 11.1, face: "serious", text: "ハジメっちの煙じゃん！" },
      { at: 12.4, face: "smile", text: "アタシ、勝つとこ見たい！" },
      { at: 13.8, face: "smile", text: "もう客席でめっちゃ応援してるし！" },
      { at: 15.5, face: "smile", text: "ここで帰ったら声援どうすんの！" },
      { at: 17.1, face: "excited", text: "ほら、コンティニュー！ いっけえええ！" },
    ],
  },
  samechan: {
    id: "premium_samechan", title: "サメの王からの緊急命令", name: "サメちゃん",
    bio: "恋人 / SHISHARK", speaker: "samechan", duration: 20, audio: null,
    reactions: {
      retry: { text: ["おおっ！ それでこそ、わしの……", "いや、コロちゃんの勇者じゃ！", "いざ、再出航じゃ！"], faces: ["surprise", "excited"], effect: "shark", word: "再出航じゃ！" },
      quit: { text: ["……うむ。サメも休むときは休むのじゃ。", "コロちゃんも『よくやった』と申しておる。"], faces: ["normal", "smile"], effect: "shark", word: "よくやった" },
    },
    cues: [
      { at: 0, face: "surprise", text: "おっ、お主ぃ！？ 何をしておる！" },
      { at: 1.5, face: "surprise", text: "その指の先は……" },
      { at: 2.5, face: "surprise", text: "『諦める』ではないか！？" },
      { at: 3.8, face: "serious", text: "サメは泳ぐのをやめると大変なのじゃ！" },
      { at: 5.4, face: "serious", text: "……いや、種類によるが……" },
      { at: 6.7, face: "serious", text: "今はそれどころではない！" },
      { at: 7.9, face: "ventriloquism", text: "『王命である！ 大会へ戻れ！』" },
      { at: 9.4, face: "ventriloquism", text: "……コ、コロちゃん！" },
      { at: 10.6, face: "ventriloquism", text: "勝手に命令するでない！" },
      { at: 11.8, face: "normal", text: "……わしは勝ち負けには疎いが" },
      { at: 13.2, face: "normal", text: "お主の煙は好きじゃ。" },
      { at: 14.3, face: "normal", text: "まだ、もう一度見たいのじゃぞ……。" },
      { at: 15.9, face: "smile", text: "……一緒に、戻ろう。" },
      { at: 17, face: "smile", text: "今度はわしも……うんと応援するからの！" },
    ],
  },
  mashiro: {
    id: "premium_mashiro", title: "まだ味見してない", name: "ましろ",
    bio: "恋人 / ましろ", speaker: "mashiro", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["……うん、もう一台。", "……今度こそ、おいしいの、ちょうだい……。"], faces: ["sleep", "smile"], effect: "stars", word: "もう一台" },
      quit: { text: ["……じゃあ、帰ろっか。", "……いっぱい頑張ったね。", "……お布団、直行……。"], faces: ["sleep"], effect: "stars", word: "いっぱい頑張ったね" },
    },
    cues: [
      { at: 0, face: "sleep", text: "……ん。……終わり？" },
      { at: 1.4, face: "sleep", text: "……まだ、味見してないのに……。" },
      { at: 3.2, face: "normal", text: "……失敗したなら" },
      { at: 4.4, face: "normal", text: "もう一台、作ったらいいと思う……。" },
      { at: 6.3, face: "normal", text: "……いつも、そうしてるでしょ……。" },
      { at: 8.1, face: "sad", text: "……私、はじめのシーシャ、好きだよ。" },
      { at: 10.1, face: "sad", text: "……うまくいかないとこも、知ってるし……。" },
      { at: 12.3, face: "smile", text: "……うん。もう一回、作ろ。" },
      { at: 13.9, face: "smile", text: "……終わったら、隣で一緒に吸いたい……。" },
      { at: 16, face: "sleep", text: "……それまで、寝ないで待ってる。" },
      { at: 17.8, face: "sleep", text: "……たぶん……。" },
    ],
  },
};

/**
 * 当該セーブで恋人関係が成立している人だけ抽選。
 * 第1章のミントは大会の対戦相手なので、恋人であっても登場させない。
 * 抽選は GAME OVER の発生時に1回だけ行い、セーブや画面切替で再抽選しない。
 */
export function choosePremiumContinue(lovers = [], chapter = 1, rng = Math.random, previousSpeaker = null) {
  // 同じヒロインの連続出演は不可。候補がその1人しかいなければ通常スミさん版へ戻す。
  // （次がスミさんならさらに次の回で同じ恋人が再び選ばれる可能性はある）
  const eligible = [...new Set(lovers)].filter(id => Boolean(PREMIUM_CONTINUE_SCRIPTS[id]))
    .filter(id => id !== "minto" || chapter > 1)
    .filter(id => id !== previousSpeaker);
  if (!eligible.length || rng() >= PREMIUM_CONTINUE_RATE) return null;
  return PREMIUM_CONTINUE_SCRIPTS[eligible[Math.floor(rng() * eligible.length)]];
}
