// 恋人のコンティニュー台本と、スミさん／恋人の出演者選び（#2524・2026-11-06 オーナー指示）。
// 恋人は「プレミア」の希少枠ではなく、スミさんと同じ通常枠として出る。出演者はスミさんか、そのセーブで成立済みの恋人だけ。
// 好感度や知り合いフラグから恋人だと推測しない（state.lovers だけを見る）。
// 頭の中の呼びかけ。恋人は会場に来ているのではなく、はじめの頭の中に浮かぶ声として書く。
// 7行すべてが相手の声（はじめの自問は置かない）。本人が隣にいる・一緒に帰る・約束するといった来場や新しい約束に読める文は置かない。
// 連敗の短縮 [0,2,5,6] でも「声がかかる→励まし→休む選択も肯定→問いかけ」が残るように、index 2 と 5 は単独で読める行にする。
export const LOVER_CONTINUE_SCRIPTS = {
  tsumugi: {
    id: "lover_tsumugi", title: "消さない線", name: "つむぎ",
    bio: "恋人 / つむぎ", speaker: "tsumugi", duration: 20,
    audio: null, // 音声生成後 ../assets/audio/voice/continue/lover_tsumugi.mp3 を指定
    reactions: {
      retry: { text: ["……次の手も、描かせてください"], faces: ["sad", "smile"], effect: "pencil", word: "次の手" },
      quit: { text: ["……今日はここまで。お疲れさまです"], faces: ["normal", "smile"], effect: "canvas", word: "お疲れさまです" },
    },
    cues: [
    { at: 0, face: "sad", text: "……はじめさんの手、描きたくなります" },
    { at: 1.8, face: "normal", text: "迷った線も、消さなくていいんです" },
    { at: 4.2, face: "smile", text: "……あの線、好きなんです" },
    { at: 7, face: "smile", text: "次の線も、見せてもらえますか" },
    { at: 10.3, face: "normal", text: "……今のページ、消しません" },
    { at: 13.6, face: "normal", text: "……休むのも、絵のうちですよ" },
    { at: 16.5, face: "smile", text: "……はじめさんは、どうしたいですか" },
    ],
  },
  minto: {
    id: "lover_minto", title: "私もあきらめない", name: "栞",
    bio: "恋人 / 仕事を離れた素の栞", speaker: "minto", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["……うん。私も、諦めないから"], faces: ["ura_sad", "ura_smile"], effect: "warm", word: "諦めないから" },
      quit: { text: ["……頑張ったね。今日は、おしまい"], faces: ["ura_normal"], effect: "warm", word: "頑張ったね" },
    },
    cues: [
    { at: 0, face: "ura_surprise", text: "……はじめくん、大丈夫？" },
    { at: 1.8, face: "ura_sad", text: "……上手くいかなかったところも" },
    { at: 4.2, face: "ura_sad", text: "……頑張ってたの、私は知ってるよ" },
    { at: 7, face: "ura_normal", text: "……私も、ちょっと悔しい" },
    { at: 10.3, face: "ura_normal", text: "……続けるなら、応援してる" },
    { at: 13.6, face: "ura_smile", text: "……休むなら、それも応援する" },
    { at: 16.5, face: "ura_smile", text: "……もう一回、作ってみる？" },
    ],
  },
  rio: {
    id: "lover_rio", title: "実験はまだ途中", name: "凛想",
    bio: "恋人 / 凛想", speaker: "rio", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["いいね。次の一台、確かめよう"], faces: ["serious", "smile"], effect: "scan", word: "次の一台" },
      quit: { text: ["……うん。やめどきも判断のうち"], faces: ["normal"], effect: "scan", word: "やめどきも判断のうち" },
    },
    cues: [
    { at: 0, face: "serious", text: "……お疲れ、はじめくん" },
    { at: 1.8, face: "normal", text: "一台じゃ、まだ分からないでしょ" },
    { at: 4.2, face: "normal", text: "うまくいかない日だって、あるよ" },
    { at: 7, face: "smile", text: "次は一つ、条件を変えてみる？" },
    { at: 10.3, face: "normal", text: "……急がなくていい" },
    { at: 13.6, face: "smile", text: "……実験は、まだ途中だよ" },
    { at: 16.5, face: "normal", text: "……次、どうする？" },
    ],
  },
  ageha: {
    id: "lover_ageha", title: "バイブスはまだ残ってる", name: "あげは",
    bio: "恋人 / MELTY PUFF", speaker: "ageha", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["っしゃあ！ 次いこ、ハジメっち！"], faces: ["excited"], effect: "cheer", word: "っしゃあ！" },
      quit: { text: ["おっけ！ 今日は撤収！ お疲れ！"], faces: ["smile"], effect: "farewell", word: "お疲れ！" },
    },
    cues: [
    { at: 0, face: "surprise", text: "今の、めっちゃ悔しいじゃん！" },
    { at: 1.8, face: "serious", text: "ハジメっち、うちも悔しい！" },
    { at: 4.2, face: "excited", text: "なら次、一個だけ変えてこ！" },
    { at: 7, face: "excited", text: "バイブスはまだ、残ってるっしょ！" },
    { at: 10.3, face: "smile", text: "ハジメっちの次、うち見たい！" },
    { at: 13.6, face: "smile", text: "帰るなら帰るで、ちゃんと休みな！" },
    { at: 16.5, face: "excited", text: "もっかい、行っちゃう？" },
    ],
  },
  samechan: {
    id: "lover_samechan", title: "サメの王からの緊急命令", name: "サメちゃん",
    bio: "恋人 / SHISHARK", speaker: "samechan", duration: 20, audio: null,
    reactions: {
      retry: { text: ["コロちゃんと一緒に、再出航じゃ！"], faces: ["surprise", "excited"], effect: "shark", word: "再出航じゃ！" },
      quit: { text: ["……うむ。よく戦った。錨を下ろせ"], faces: ["normal", "smile"], effect: "shark", word: "よく戦った" },
    },
    cues: [
    { at: 0, face: "surprise", text: "……お主、大丈夫か？" },
    { at: 1.8, face: "serious", text: "……むう、今のは悔しいのう" },
    { at: 4.2, face: "ventriloquism", text: "『王命である！ もう一台見せよ！』" },
    { at: 7, face: "ventriloquism", text: "コ、コロちゃん！ 命令はなしじゃ！" },
    { at: 10.3, face: "normal", text: "……わしも、次を見たいだけじゃ" },
    { at: 13.6, face: "smile", text: "……休むのも、航海のうちじゃぞ" },
    { at: 16.5, face: "smile", text: "……お主は、どうしたい？" },
    ],
  },
  mashiro: {
    id: "lover_mashiro", title: "作れない日もある", name: "ましろ",
    bio: "恋人 / ましろ", speaker: "mashiro", duration: 20,
    audio: null,
    reactions: {
      retry: { text: ["……うん、もう一台。待ってるね"], faces: ["sleep", "smile"], effect: "stars", word: "もう一台" },
      quit: { text: ["……じゃあ、おやすみ。お疲れさま"], faces: ["sleep"], effect: "stars", word: "おやすみ" },
    },
    cues: [
    { at: 0, face: "sleep", text: "……ん。お疲れ、はじめくん" },
    { at: 1.8, face: "normal", text: "……僕、はじめくんの煙、好きだよ" },
    { at: 4.2, face: "normal", text: "……僕も、作り直すことあるよ" },
    { at: 7, face: "sad", text: "……作れない日も、あるよねぇ" },
    { at: 10.3, face: "smile", text: "……終わったら、お茶にしよ" },
    { at: 13.6, face: "sleep", text: "……急がなくて、いいよぉ" },
    { at: 16.5, face: "smile", text: "……もう一台、作る？" },
    ],
  },
  hiyori: {
    id: "lover_hiyori", title: "君の一台を", name: "ひより",
    bio: "恋人 / ひより", speaker: "hiyori", duration: 20, audio: null,
    reactions: {
      retry: { text: ["……うん。応援してるね"], faces: ["normal", "smile"], effect: "warm", word: "応援してるね" },
      quit: { text: ["……今日は、ゆっくり休んでね"], faces: ["sad", "smile"], effect: "warm", word: "ゆっくり休んでね" },
    },
    cues: [
    { at: 0, face: "normal", text: "……はじめくん、お疲れさま" },
    { at: 1.8, face: "sad", text: "うまくいかない日も、あるよね……" },
    { at: 4.2, face: "normal", text: "……すぐに決めなくても、いいよ" },
    { at: 7, face: "smile", text: "君の一台、吸ってみたいな……" },
    { at: 10.3, face: "normal", text: "……続けるなら、応援してる" },
    { at: 13.6, face: "sad", text: "今日は、休んでもいいんだよ……" },
    { at: 16.5, face: "smile", text: "……はじめくんは、どうしたい？" },
    ],
  },
};

/**
 * 出演者を選ぶ。候補はスミさんと、そのセーブで恋人関係が成立している人（state.lovers）だけ。
 * 第1章の栞は大会の対戦相手なので、恋人であっても登場させない。
 * スミさんと恋人は同じ確率で選び、直前と同じ人物は（他に候補がいれば）続けて出さない。
 * 選定は GAME OVER の発生時に1回だけ行い、セーブや画面切替で選び直さない。
 */
export function chooseContinueSpeaker(lovers = [], chapter = 1, rng = Math.random, previousSpeaker = null) {
  const eligible = [...new Set(Array.isArray(lovers) ? lovers : [])].filter(id => Boolean(LOVER_CONTINUE_SCRIPTS[id]))
    .filter(id => id !== "minto" || chapter > 1);
  const pool = ["sumi", ...eligible];
  const fresh = pool.filter(id => id !== previousSpeaker);
  const choices = fresh.length ? fresh : pool;
  const roll = Number(rng());
  const index = Number.isFinite(roll) ? Math.min(choices.length - 1, Math.max(0, Math.floor(roll * choices.length))) : 0;
  return choices[index];
}
