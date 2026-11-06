// 恋人限定・通常抽選20%のプレミアコンティニュー。好感度や知り合いフラグから恋人だと推測しない。
// プレミアが出なかった場合は従来のスミさんの台詞に戻る。
export const PREMIUM_CONTINUE_RATE = 0.20;

// #2524（2026-11-06）: 頭の中の呼びかけ。恋人は会場に来ているのではなく、はじめの頭の中に浮かぶ。
// cues[0] と cues[6] は voice:"self"（はじめの心の声・（）で閉じる）、間の5行が浮かんだ相手の声。
// 連敗の短縮 [0,2,5,6] でも「自問→相手→問いかけ→自答」の形が残るように、index 2 は単独で読める行にする。
// 本人が隣にいる・一緒に帰る・約束するといった来場や新しい約束に読める文は置かない。
export const PREMIUM_CONTINUE_SCRIPTS = {
  tsumugi: {
    id: "premium_tsumugi", title: "消さない線", name: "つむぎ",
    bio: "恋人 / つむぎ", speaker: "tsumugi", duration: 20,
    audio: null, // 音声生成後 ../assets/audio/voice/continue/premium_tsumugi.mp3 を指定
    reactions: {
      retry: { text: ["……次の手も、描かせてください"], faces: ["sad", "smile"], effect: "pencil", word: "次の手" },
      quit: { text: ["……今日はここまで。お疲れさまです"], faces: ["normal", "smile"], effect: "canvas", word: "お疲れさまです" },
    },
    cues: [
    { at: 0, face: "sad", voice: "self", text: "（……浮かんだのは、鉛筆の音だった）" },
    { at: 1.8, face: "normal", text: "……はじめさんの手、描きたくなります" },
    { at: 4.2, face: "normal", text: "迷った線も、消さなくていいんです" },
    { at: 7, face: "smile", text: "……あの線、好きなんです" },
    { at: 10.3, face: "smile", text: "次の線も、見せてもらえますか" },
    { at: 13.6, face: "normal", text: "……はじめさんは、どうしたいですか" },
    { at: 16.5, face: "smile", voice: "self", text: "（……つむぎちゃんなら、そう言う）" },
    ],
  },
  minto: {
    id: "premium_minto", title: "私もあきらめない", name: "栞",
    bio: "恋人 / 仕事を離れた素の栞", speaker: "minto", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["……うん。私も、諦めないから"], faces: ["ura_sad", "ura_smile"], effect: "warm", word: "諦めないから" },
      quit: { text: ["……頑張ったね。今日は、おしまい"], faces: ["ura_normal"], effect: "warm", word: "頑張ったね" },
    },
    cues: [
    { at: 0, face: "ura_surprise", voice: "self", text: "（……栞さんの顔が、浮かんだ）" },
    { at: 1.8, face: "ura_sad", text: "……上手くいかなかったところも" },
    { at: 4.2, face: "ura_sad", text: "……頑張ってたの、私は知ってるよ" },
    { at: 7, face: "ura_normal", text: "……私も、ちょっと悔しい" },
    { at: 10.3, face: "ura_normal", text: "……続けるなら、応援してる" },
    { at: 13.6, face: "ura_smile", text: "……もう一回、作ってみる？" },
    { at: 16.5, face: "ura_smile", voice: "self", text: "（……頭の中なのに、優しいな）" },
    ],
  },
  rio: {
    id: "premium_rio", title: "実験はまだ途中", name: "凛想",
    bio: "恋人 / 凛想", speaker: "rio", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["いいね。次の一台、確かめよう"], faces: ["serious", "smile"], effect: "scan", word: "次の一台" },
      quit: { text: ["……うん。やめどきも判断のうち"], faces: ["normal"], effect: "scan", word: "やめどきも判断のうち" },
    },
    cues: [
    { at: 0, face: "serious", voice: "self", text: "（……凛想さんなら、何て言うかな）" },
    { at: 1.8, face: "normal", text: "一台じゃ、まだ分からないでしょ" },
    { at: 4.2, face: "normal", text: "うまくいかない日だって、あるよ" },
    { at: 7, face: "smile", text: "次は一つ、条件を変えてみる？" },
    { at: 10.3, face: "normal", text: "……急がなくていい" },
    { at: 13.6, face: "normal", text: "……次、どうする？" },
    { at: 16.5, face: "smile", voice: "self", text: "（……実験は、まだ途中ってことか）" },
    ],
  },
  ageha: {
    id: "premium_ageha", title: "頭の中で叫ぶ声", name: "あげは",
    bio: "恋人 / MELTY PUFF", speaker: "ageha", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["っしゃあ！ 次いこ、ハジメっち！"], faces: ["excited"], effect: "cheer", word: "っしゃあ！" },
      quit: { text: ["おっけ！ 今日は撤収！ お疲れ！"], faces: ["smile"], effect: "farewell", word: "お疲れ！" },
    },
    cues: [
    { at: 0, face: "surprise", voice: "self", text: "（……頭の中で、誰かが叫んでる）" },
    { at: 1.8, face: "surprise", text: "今の、めっちゃ悔しいじゃん！" },
    { at: 4.2, face: "serious", text: "ハジメっち、うちも悔しい！" },
    { at: 7, face: "excited", text: "なら次、一個だけ変えてこ！" },
    { at: 10.3, face: "smile", text: "ハジメっちの次、うち見たい！" },
    { at: 13.6, face: "excited", text: "もっかい、行っちゃう？" },
    { at: 16.5, face: "excited", voice: "self", text: "（……うるさい。でも、ちょっと効いた）" },
    ],
  },
  samechan: {
    id: "premium_samechan", title: "サメの王からの緊急命令", name: "サメちゃん",
    bio: "恋人 / SHISHARK", speaker: "samechan", duration: 20, audio: null,
    reactions: {
      retry: { text: ["コロちゃんと一緒に、再出航じゃ！"], faces: ["surprise", "excited"], effect: "shark", word: "再出航じゃ！" },
      quit: { text: ["……うむ。休むのも、航海のうちじゃ"], faces: ["normal", "smile"], effect: "shark", word: "航海のうち" },
    },
    cues: [
    { at: 0, face: "surprise", voice: "self", text: "（……なんで、サメの声が聞こえる）" },
    { at: 1.8, face: "serious", text: "……むう、今のは悔しいのう" },
    { at: 4.2, face: "ventriloquism", text: "『王命である！ もう一台見せよ！』" },
    { at: 7, face: "ventriloquism", text: "コ、コロちゃん！ 命令はなしじゃ！" },
    { at: 10.3, face: "normal", text: "……わしも、次を見たいだけじゃ" },
    { at: 13.6, face: "smile", text: "……お主は、どうしたい？" },
    { at: 16.5, face: "smile", voice: "self", text: "（……コロちゃんまで、頭の中にいる）" },
    ],
  },
  mashiro: {
    id: "premium_mashiro", title: "作れない日もある", name: "ましろ",
    bio: "恋人 / ましろ", speaker: "mashiro", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["……うん、もう一台。待ってるね"], faces: ["sleep", "smile"], effect: "stars", word: "もう一台" },
      quit: { text: ["……じゃあ、おやすみ。お疲れさま"], faces: ["sleep"], effect: "stars", word: "おやすみ" },
    },
    cues: [
    { at: 0, face: "sleep", voice: "self", text: "（……ゆっくりした声が、聞こえた気がした）" },
    { at: 1.8, face: "normal", text: "……僕、はじめくんの煙、好きだよ" },
    { at: 4.2, face: "normal", text: "……僕も、作り直すことあるよ" },
    { at: 7, face: "sad", text: "……作れない日も、あるよねぇ" },
    { at: 10.3, face: "smile", text: "……終わったら、お茶にしよ" },
    { at: 13.6, face: "smile", text: "……もう一台、作る？" },
    { at: 16.5, face: "sleep", voice: "self", text: "（……急かさないのが、ましろちゃんだ）" },
    ],
  },
  hiyori: {
    id: "premium_hiyori", title: "君の一台を", name: "ひより",
    bio: "恋人 / ひより", speaker: "hiyori", duration: 20, audio: null,
    reactions: {
      retry: { text: ["……うん。応援してるね"], faces: ["normal", "smile"], effect: "warm", word: "応援してるね" },
      quit: { text: ["……今日は、ゆっくり休んでね"], faces: ["sad", "smile"], effect: "warm", word: "ゆっくり休んでね" },
    },
    cues: [
    { at: 0, face: "normal", voice: "self", text: "（……ふわっと、誰かの声が浮かんだ）" },
    { at: 1.8, face: "sad", text: "うまくいかない日も、あるよね……" },
    { at: 4.2, face: "normal", text: "……すぐに決めなくても、いいよ" },
    { at: 7, face: "smile", text: "君の一台、吸ってみたいな……" },
    { at: 10.3, face: "normal", text: "……続けるなら、応援してる" },
    { at: 13.6, face: "smile", text: "……はじめくんは、どうしたい？" },
    { at: 16.5, face: "smile", voice: "self", text: "（……儚いのに、妙に残る声だ）" },
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
