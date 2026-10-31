// 恋人限定・通常抽選20%のプレミアコンティニュー。好感度や知り合いフラグから恋人だと推測しない。
// プレミアが出なかった場合は従来のスミさんの台詞に戻る。
export const PREMIUM_CONTINUE_RATE = 0.20;

export const PREMIUM_CONTINUE_SCRIPTS = {
  tsumugi: {
    id: "premium_tsumugi", title: "ずっと見てますから", name: "つむぎ",
    bio: "恋人 / つむぎ", speaker: "tsumugi", duration: 20,
    audio: null, // 音声生成後 ../assets/audio/voice/continue/premium_tsumugi.mp3 を指定
    reactions: {
      retry: { text: ["……次の手も、描かせてください"], faces: ["sad", "smile"], effect: "pencil", word: "続きが描けますね" },
      quit: { text: ["……今日はここまで。お疲れさまです"], faces: ["normal", "smile"], effect: "canvas", word: "今日は休みましょう" },
    },
    cues: [
    { at: 0, face: "sad", text: "……さっきの手、描いてたんです" },
    { at: 1.8, face: "normal", text: "迷って、それでも動かしたところ" },
    { at: 4.2, face: "normal", text: "……今のページ、消しません" },
    { at: 7, face: "smile", text: "……あの線、好きなんです" },
    { at: 10.3, face: "smile", text: "次の線も、見せてもらえますか" },
    { at: 13.6, face: "normal", text: "……休むなら、隣にいます" },
    { at: 16.5, face: "smile", text: "……はじめさんは、どうしたいですか" },
    ],
  },
  minto: {
    id: "premium_minto", title: "私もあきらめない", name: "栞",
    bio: "恋人 / 仕事を離れた素の栞", speaker: "minto", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["……うん。次も、ちゃんと見てるよ"], faces: ["ura_sad", "ura_smile"], effect: "warm", word: "ぎゅってするから" },
      quit: { text: ["……頑張ったね。一緒に帰ろ？"], faces: ["ura_normal"], effect: "warm", word: "頑張ったの、知ってるよ" },
    },
    cues: [
    { at: 0, face: "ura_surprise", text: "……はじめくん、大丈夫？" },
    { at: 1.8, face: "ura_sad", text: "……上手くいかなかったところも" },
    { at: 4.2, face: "ura_sad", text: "……ちゃんと、見てたよ" },
    { at: 7, face: "ura_normal", text: "……私も、ちょっと悔しい" },
    { at: 10.3, face: "ura_normal", text: "……続けるなら、応援してる" },
    { at: 13.6, face: "ura_smile", text: "帰りは一緒に帰ろ。……約束" },
    { at: 16.5, face: "ura_smile", text: "……もう一回、作ってみる？" },
    ],
  },
  rin: {
    id: "premium_rin", title: "この先の香り", name: "凛",
    bio: "恋人 / 凛", speaker: "rin", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["いいね。次の一台、確かめよう"], faces: ["serious", "smile"], effect: "scan", word: "次の一台、私に見せて" },
      quit: { text: ["……うん。やめどきも判断のうち"], faces: ["normal"], effect: "scan", word: "やめどきも判断のうち" },
    },
    cues: [
    { at: 0, face: "serious", text: "……お疲れ、はじめくん" },
    { at: 1.8, face: "normal", text: "一台じゃ、まだ分からないでしょ" },
    { at: 4.2, face: "normal", text: "うまくいかない日だって、あるよ" },
    { at: 7, face: "smile", text: "次は一つ、条件を変えてみる？" },
    { at: 10.3, face: "normal", text: "……急がなくていい" },
    { at: 13.6, face: "smile", text: "……付き合うよ、最後まで" },
    { at: 16.5, face: "normal", text: "……次、どうする？" },
    ],
  },
  ageha: {
    id: "premium_ageha", title: "帰るには早くない？", name: "アゲハ",
    bio: "恋人 / MELTY PUFF", speaker: "ageha", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["っしゃあ！ 次いこ、ハジメっち！"], faces: ["excited"], effect: "cheer", word: "っしゃあ！" },
      quit: { text: ["おっけ！ 今日は撤収！ お疲れ！"], faces: ["smile"], effect: "farewell", word: "うち見てたし！" },
    },
    cues: [
    { at: 0, face: "surprise", text: "今の、めっちゃ悔しいじゃん！" },
    { at: 1.8, face: "serious", text: "ハジメっち、うちも悔しい！" },
    { at: 4.2, face: "excited", text: "なら次、一個だけ変えてこ！" },
    { at: 7, face: "excited", text: "応援の声、まだ残ってるし！" },
    { at: 10.3, face: "smile", text: "ハジメっちの次、うち見たい！" },
    { at: 13.6, face: "smile", text: "帰る時は、一緒に帰ろ！" },
    { at: 16.5, face: "excited", text: "もっかい、行っちゃう？" },
    ],
  },
  samechan: {
    id: "premium_samechan", title: "サメの王からの緊急命令", name: "サメちゃん",
    bio: "恋人 / SHISHARK", speaker: "samechan", duration: 20, audio: null,
    reactions: {
      retry: { text: ["コロちゃんと一緒に、再出航じゃ！"], faces: ["surprise", "excited"], effect: "shark", word: "再出航じゃ！" },
      quit: { text: ["……うむ。今日は一緒に帰ろう"], faces: ["normal", "smile"], effect: "shark", word: "よくやった" },
    },
    cues: [
    { at: 0, face: "surprise", text: "……お主、大丈夫か？" },
    { at: 1.8, face: "serious", text: "……むう、今のは悔しいのう" },
    { at: 4.2, face: "ventriloquism", text: "『王命である！ もう一台見せよ！』" },
    { at: 7, face: "ventriloquism", text: "コ、コロちゃん！ 命令はなしじゃ！" },
    { at: 10.3, face: "normal", text: "……わしも、次を見たいだけじゃ" },
    { at: 13.6, face: "smile", text: "……隣の席は、空けておくからの" },
    { at: 16.5, face: "smile", text: "……お主は、どうしたい？" },
    ],
  },
  mashiro: {
    id: "premium_mashiro", title: "まだ味見してない", name: "ましろ",
    bio: "恋人 / ましろ", speaker: "mashiro", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["……うん、もう一台。待ってるね"], faces: ["sleep", "smile"], effect: "stars", word: "もう一台" },
      quit: { text: ["……じゃあ、帰ろっか。お疲れさま"], faces: ["sleep"], effect: "stars", word: "いっぱい頑張ったね" },
    },
    cues: [
    { at: 0, face: "sleep", text: "……ん。お疲れ、はじめくん" },
    { at: 1.8, face: "normal", text: "……僕、はじめくんの煙、好きだよ" },
    { at: 4.2, face: "normal", text: "……僕も、作り直すことあるよ" },
    { at: 7, face: "sad", text: "……勝てない日も、隣にいるよ" },
    { at: 10.3, face: "smile", text: "……終わったら、お茶にしよ" },
    { at: 13.6, face: "sleep", text: "……僕は、ここにいるよ" },
    { at: 16.5, face: "smile", text: "……もう一台、作る？" },
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
