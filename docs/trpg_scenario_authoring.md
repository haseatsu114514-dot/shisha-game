# TRPGシナリオの書き方（小さな卓の冒険）

新しい短編を足すときの正本。1本＝1つのJSON（`data/dialogue/trpg_<名前>.json`）と、catalog への登録だけで遊べる。
画面・ルールのコードは変えない。手本は `data/dialogue/trpg_ordinary.json`（自由に調べる型）と `trpg_shark.json`（調べる回数に限りがある型）。

```bash
node tools/validate_trpg_scenario.mjs data/dialogue/trpg_<名前>.json   # 構造・参照・話者・表情・字数・全組み合わせの完走・行数
python3 tools/lint_dialogue.py trpg_<名前>                             # 台詞の規範（ERROR 0・WARN 0 にする）
```

## 1本の流れ（約10分）

| 場面 | 中身 | JSON |
| --- | --- | --- |
| キャラ作りの時間 | GMの呼びかけ → 仲間2人が自分の役を紹介 → はじめが「俺は{pc}。{pcTitle}でいく」 | `sessionZero`・`companionBuilds` |
| 01 導入 | 卓の会話 → GMの場面描写 → PC3人の登場の一文 → 物語の人物（NPC）が困りごとを話す | `intro`・`listen`・`profiles[].arrival` |
| 判定1 | 「どうする？」で誰が何をするか宣言 → 2d20＋能力値 | `checks.listen` |
| 02 聞き込み | NPCに4つの話題から2つ質問。答えは隠れた事情ごとに違う | `interview`・`profiles[].answers` |
| 03 調査 | 6つの地点を調べて手がかり3つ以上。仲間に相談できる | `spots`・`profiles[].evidence`・`consult` |
| 見立て | 3択。選ぶと仲間がその読みについて話す | `hypotheses[].discussion` |
| 04 思わぬ展開 | GMが邪魔を出す → 切り抜け方3択 → 宣言 → 判定 | `twist`・`flow.twist`・`checks.twist` |
| 05 準備 | 2項目を3択ずつ → 判定（仲間の切り札＋7が使える） | `flow.prepare`・`checks.prepare` |
| 06 クライマックス | 1項目を3択 → 判定（もう1人の切り札） | `flow.serve`・`checks.serve` |
| 結末 | 準備2項目＋クライマックスが事情に合えば本来の結末、外れれば「一緒に見つけた」系の結末。卓の振り返り・後日談 | `endings`・`debrief`・`epilogue` |

- 結末は**準備とクライマックスの選択**で決まる（`fitWeights` の合計が3以上で本来の結末。クライマックスは重み2）。サイコロは途中の出来事だけを変える。思わぬ展開の手（`tactic`）は重み0。
- どの出目・どの選択でも最後まで遊べる。失敗は「思わぬ出来事」として笑える展開にする。
- **標準ルートの台詞は95〜140行**（検査ツールが数える）。これで読む時間と15回前後の選択を合わせて約10分。

## 卓の人と席

- GMは部員（ひより・サメちゃん・アダム・つむぎ）から1人。はじめは必ずPL（切り札は振り直し `abilityType: "reroll"`）。
- 仲間のPL席は2つ。切り札は1人が `prepare`（準備に＋7）、もう1人が `serve`（クライマックスに＋7）。
- `campaign.seats` はGMとはじめを `required: true`、仲間は `false`（来られなければGMが兼任）。スミさん・なるは入れない。
- 仲間の役は `companionBuilds.<席>.<プレイヤー>` に2案。1案目は `cast[].sheet` と同じ内容。各案に `making`（本人が役を紹介する2〜4行、`metadata.making: true`）。好きなもの（`likes`）とパロディを入れて、本人らしく。
- はじめの役は `builder`（見た目4・出自3・`statHelp`）。出自1つ目＝ `cast` のはじめの sheet。
- 能力値は 観察 `eye`・手際 `hand`・話術 `talk`・度胸 `nerve`。各1〜5、合計11以下。

## 宣言（行動の3択）

- 4つの判定（`listen`・`twist`・`prepare`・`serve`）に `approaches` を3つ。1つ目ははじめ、残りは仲間2人。誰がどの能力で何をするかを `label`（短い行動）と `detail`（{pc}などを使った説明）で。
- `declare` の台詞は2行: PLが行動を口にする → GMが「○○で判定。目標は30」。
- 各判定の結果 `success`・`mixed`・`trouble` は2〜3行。

## 台詞のルール（検査ツールとリンタが見る）

- 1行は全角48字以内。改行を入れない。台詞の末尾に「。」を付けない。「。……短い続き」は「、……」に。
- 話者は `cast` の人だけ（`making` は本人・GM・はじめだけ）。NPCとナレーションはGMが話す（`role` を「GM／場面」や「<NPC名>／物語」に）。
- 表情は話者に実在するものだけ: はじめ normal/smile/serious/surprise/excited/sad/smug、ひより normal/smile/sad/serious/surprise、アダム normal/smile/serious/surprise/intense、つむぎ normal/smile/serious/surprise/sad/evil/bow、サメちゃん normal/smile/serious/surprise/excited/ventriloquism（コロちゃんの腹話術）。
- PC名は直書きしない。はじめの役は `{pc}`、仲間の役は `{pc:<席のID>}`、はじめの肩書きは `{pcTitle}`、今夜のGMの名前は `{gm}`。
- 本編の店・人物を物語の登場人物にしない。実在のブランド名・作品名・人名を出さない（パロディは「よくあるお約束」で）。ゴア表現・ジャンプスケアなし。全員無事に終わる。怪物や魔法の設定は作中だけのもの。

## キャラの声（GM・PLのとき）

- **ひより**: 「儚い女」を演じる。「……」「かしら」「わ」「ね」。驚くと素が出て大きな反応（「猫！？」）。素は明るくノリがいい。斧投げ・ラーメン・ゆるいキャラグッズが好き。GMは物語を大切に、話しやすい。
- **サメちゃん**: 一人称「わし」、はじめは「お主」。「〜じゃ」「〜のじゃ」「〜じゃぞ」。右手のサメのパペット・コロちゃん（話すときは `face: "ventriloquism"`、`role: "コロちゃん／卓の会話"`）は一人称「余」で「〜である」「〜せよ」。サメ映画が好き、グロは苦手（強がる）。
- **アダム**: 一人称「俺」。舞台の仕掛けが好きで、大げさな名言と自己演出。ダブルアップル（林檎）を宇宙の原点のように語る。腕は本物。GMなら芝居がかった語り手（「さあ、幕を上げよう」）。
- **つむぎ**: 寡黙。「……」から話し始め、はじめには「はじめさん」と丁寧語。絵を描く（葉っぱの耳の猫が好き）。ラベンダーが好き。たまにいたずらっぽい（evil の表情）。GMなら短い文で静かに語る。
- **はじめ**: 素直で感じのいい青年。一人称「俺」。ひよりは「ひよりさん」、つむぎは「つむぎ」、サメちゃんは「サメちゃん」、アダムは「アダムさん」。内心は（）で。

## 見た目と画像

- 背景（1280×720）と選択肢の絵（3列×5行のタイル）は後からCodexで作る。画像がない間は `presentation.backdrop`（CSSのグラデーション）と文字のカードで遊べる。
- 画像が届いたら `presentation.image` と `presentation.choiceArt`（`{src, rowCount: 5, rows: {<準備1>:0, <準備2>:1, <クライマックス>:2, <思わぬ展開>:3, hypotheses:4}}`）を書く。指示書は `asset_sources/trpg-scenarios/README.md`。

## 登録

`data/trpg_catalog.json` の `scenarios` に `{id, file, price, stockRequires}` を足す（入荷条件にGMを含める）。GMが新しい人なら `data/dialogue/trpg_table_talk.json` に `trpg_talk_<GM>_{critical,critical_full,fumble,double,heat_up,heat_max}` を足す。

## 企画一覧（全10本）

| 番号 | ID / ファイル | 題名 | GM | PL（はじめ＋） | ジャンル | 調査 |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | ordinary-cup / trpg_ordinary.json | 世界一普通の一台 | ひより | アダム・つむぎ | 日常ミステリー | 自由 |
| 02 | shark-last-order / trpg_shark.json | サメは閉店を待たない | サメちゃん | ひより・つむぎ | サメ映画・脱出 | 4箇所・危機 |
| 03 | moon-mail / trpg_moon_mail.json | 月夜の猫郵便 | つむぎ | ひより・アダム | 絵本ファンタジー | 自由 |
| 04 | tea-thief / trpg_tea_thief.json | 怪盗は紅茶を盗まない | アダム | ひより・つむぎ | 館の怪盗もの | 4箇所・警戒 |
| 05 | shark-island / trpg_shark_island.json | サメ島の宝の地図 | サメちゃん | ひより・アダム | 海賊の冒険 | 4箇所・潮 |
| 06 | snow-lodge / trpg_snow_lodge.json | 雪の山荘と消えた主役 | ひより | つむぎ・アダム | 山荘ミステリー（事件なし） | 自由 |
| 07 | star-robot / trpg_star_robot.json | 星の駅の迷子ロボ | サメちゃん | アダム・つむぎ | SF | 4箇所・酸素 |
| 08 | magic-exam / trpg_magic_exam.json | 魔法学校の試験前夜 | ひより | サメちゃん・アダム | 学園ファンタジー | 自由 |
| 09 | fox-market / trpg_fox_market.json | 夜市と狐のお面 | つむぎ | ひより・サメちゃん | 和の不思議 | 自由 |
| 10 | stage-ghost / trpg_stage_ghost.json | 幕の降りない劇場 | アダム | ひより・サメちゃん | やさしい幽霊劇 | 4箇所・夜明け |
