# TRPGシナリオの書き方（小さな卓の冒険）

新しい短編を足すときの正本。1本＝1つのJSON（`data/dialogue/trpg_<名前>.json`）と、catalog への登録だけで遊べる。

> **シナリオを増やすときは、タイトル（題名・GM・PL・ジャンル・あらすじ）の段階でオーナーに相談し、了承を得てから書き始める**（2026-11-01 オーナー指示）。下の「企画一覧」の未了承の行は案であり、書き始めてよい合図ではない。
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

- GMは本ごとに部員またはサイ。部員はひより・サメちゃん・アダム・つむぎ・クラウド・あげは。あげはの持ち込み本はサイがGMを手伝う。はじめは必ずPL（切り札は振り直し `abilityType: "reroll"`）。
- 仲間のPL席は2つ。切り札は1人が `prepare`（準備に＋7）、もう1人が `serve`（クライマックスに＋7）。
- `campaign.seats` はGMとはじめと持ち込み主を `required: true`、それ以外の仲間は `false`。任意の空席はサイの店の常連が埋める。鉄仮面さん・スミさん・なるは入れない。
- 仲間の役は `companionBuilds.<席>.<プレイヤー>` に2案。1案目は `cast[].sheet` と同じ内容。各案に `making`（本人が役を紹介する2〜4行、`metadata.making: true`）。好きなもの（`likes`）とパロディを入れて、本人らしく。
- はじめの役は `builder`（見た目4・出自3・`statHelp`）。出自1つ目＝ `cast` のはじめの sheet。
- 能力値は 観察 `eye`・手際 `hand`・話術 `talk`・度胸 `nerve`。各1〜5、合計11以下。

## 宣言（行動の3択）

- 4つの判定（`listen`・`twist`・`prepare`・`serve`）に `approaches` を3つ。1つ目ははじめ、残りは仲間2人。誰がどの能力で何をするかを `label`（短い行動）と `detail`（{pc}などを使った説明）で。
- `declare` の台詞は2行: PLが行動を口にする → GMが「○○で判定。目標は30」。
- 判定の成功には「ごほうび」が付く（TRF02・2026-11-11）: `listen`＝聞き込みが1つ増える、`twist`・`prepare`＝次の選択にGMのヒント（合わない選択肢に付箋）、`serve`＝結末に「会心のクライマックス」の印。卓の上の札は短い言葉（「質問 ＋1」「GMのヒント」「会心の印」）で共通。変えたい判定だけ `checks.<判定>.stake` に書く（全角8字まで。説明の文は書かない。決まりの説明は「？」とチュートリアルにある）。聞き込みの案内文（`interview.prompt`・`presentation.interviewIdle`）の数は「二つ」と漢数字で書く（成功した夜は画面が「三つ」に読み替える）。
- GMのヒントは「合わない選択肢」に付くので、**準備とクライマックスの各項目で、どの事情（profile）にも合わない選択肢を1つは残す**（`likes` に全部の選択肢を入れない。検査ツールがERRORにする）。
- 各判定の結果 `success`・`mixed`・`trouble` は2〜3行。
- 新しい人がGMをする本を足す時は、`data/dialogue/trpg_table_talk.json` にそのGMの掛け合い（`critical`・`critical_full`・`fumble`・`double`・`heat_up`・`heat_max`・`near1`・`near2`・`reward_question`・`reward_hint`・`reward_finale`）も足す。無くても遊べるが、出目の一言が出ない卓になる。

## 台詞のルール（検査ツールとリンタが見る）

- 1行は全角48字以内。改行を入れない。台詞の末尾に「。」を付けない。「。……短い続き」は「、……」に。
- 話者は `cast` の人だけ（`making` は本人・GM・はじめだけ）。NPCとナレーションはGMが話す（`role` を「GM／場面」や「<NPC名>／物語」に）。
- **`role` が見せ方を決める**（TRF10・2026-11-12）: 「GM／場面」＝語り（立ち絵なし・名札は「ゲームマスター（名前）」）、GMが話す「<NPC名>／物語」＝人影の札とその名前、PLが話す「{pc}／物語」「{pc:<席>}／物語」＝役衣装の姿と役の名前、空か「GM／卓の会話」「PL／卓の会話」＝卓の会話（PLは本人の立ち絵・座席の帯。**GMは顔を出さず、印と「ゲームマスター（名前）」**・TRF20）。物語の中の台詞に「卓の会話」と書くと、部屋の絵が沈んで本人の姿で話してしまう。人物ではないもの（予告状・手紙など）を読む時は名前を「〜状」「〜の手紙」にすると紙の札になる。揺れ・光を入れたい行には `fx: "shake"`／`fx: "flash"`（任意）。
- 表情は話者に実在するものだけ: はじめ normal/smile/serious/surprise/excited/sad/smug、ひより normal/smile/sad/serious/surprise、アダム normal/smile/serious/surprise/intense、つむぎ normal/smile/serious/surprise/sad/evil/bow、サメちゃん normal/smile/serious/surprise/excited/ventriloquism（コロちゃんの腹話術）。
- PC名は直書きしない。はじめの役は `{pc}`、仲間の役は `{pc:<席のID>}`、はじめの肩書きは `{pcTitle}`、今夜のGMの名前は `{gm}`。
- 本編の店・人物を物語の登場人物にしない。実在のブランド名・作品名・人名を出さない（パロディは「よくあるお約束」で）。ゴア表現・ジャンプスケアなし。全員無事に終わる。怪物や魔法の設定は作中だけのもの。

## キャラの声（GM・PLのとき）

- **ひより**: 「儚い女」を演じる。「……」「かしら」「わ」「ね」。驚くと素が出て大きな反応（「猫！？」）。素は明るくノリがいい。斧投げ・ラーメン・ゆるいキャラグッズが好き。GMは物語を大切に、話しやすい。
- **サメちゃん**: 一人称「わし」、はじめは「お主」。「〜じゃ」「〜のじゃ」「〜じゃぞ」。右手のサメのパペット・コロちゃん（話すときは `face: "ventriloquism"`、`role: "コロちゃん／卓の会話"`）は一人称「余」で「〜である」「〜せよ」。サメ映画が好き、グロは苦手（強がる）。
- **アダム**: 一人称「俺」。舞台の仕掛けが好きで、大げさな名言と自己演出。ダブルアップル（林檎）を宇宙の原点のように語る。腕は本物。GMなら芝居がかった語り手（「さあ、幕を上げよう」）。
- **つむぎ**: 寡黙。「……」から話し始め、はじめには「はじめさん」と丁寧語。絵を描く（葉っぱの耳の猫が好き）。ラベンダーが好き。たまにいたずらっぽい（evil の表情）。GMなら短い文で静かに語る。
- **クラウド**（`rei`・2026-11-02 部員に追加）: V系が好きな人見知りの青年。一人称「俺」、はじめは「お前」。短い文と「……」。TRPGは休みの日に遊ぶ経験者で、GMになると語りが急に饒舌でドラマチックになる（卓の会話に戻ると照れて短くなる）。花の香り（薔薇・ジャスミン・ラベンダー）が好きで、自作の一台の名前は好きな曲へのオマージュ（「月光花」「DOLLS REQUIEM」など）。表情 normal/serious/smile/surprise。本名・私生活の顔を偽物扱いしない。
- **あげは**（`ageha`・2026-11-02 部員に追加）: 平成ギャルマインドで誰にでも優しい。一人称「うち」、はじめは「ハジメっち」。「ウケる」「やば」「〜じゃん」「てか」。ノリで入部したのに、役を演じ始めると誰よりハマるタイプ（遊ぶ順番は自由なので「人生初のTRPG」とは書かない）。プリクラ・グミ（白と赤のグミベア）・トロピカルな香り・読者モデル。表情 normal/sad/serious/smile/surprise。手の震えなどの秘密や、大会の勝敗・恋愛の状態には触れない。
- 正本に呼び方がない組み合わせ（あげは↔クラウド・ひより・サメちゃん・アダム、クラウド↔ほかの部員）は、名前で呼び合わせない。あげははGMを「GMさん」と呼んでよい。物語の中ではPC名で呼ぶ。
- **はじめ**: 素直で感じのいい青年。一人称「俺」。ひよりは「ひよりさん」、つむぎは「つむぎ」、サメちゃんは「サメちゃん」、アダムは「アダムさん」。内心は（）で。
- はじめはクラウドを「クラウドさん」、あげはを「あげはさん」と呼び、どちらにも敬語。

## 見た目と画像

- 背景（1280×720）と選択肢の絵（3列×5行のタイル）は後からCodexで作る。画像がない間は `presentation.backdrop`（CSSのグラデーション）と文字のカードで遊べる。
- 画像が届いたら `presentation.image` と `presentation.choiceArt`（`{src, rowCount: 5, rows: {<準備1>:0, <準備2>:1, <クライマックス>:2, <思わぬ展開>:3, hypotheses:4}}`）を書く。指示書は `asset_sources/trpg-scenarios/README.md`。

## 登録

`data/trpg_catalog.json` の `scenarios` に `{id, file, price, stockRequires}` を足す（入荷条件にGMを含める）。GMが新しい人なら `data/dialogue/trpg_table_talk.json` に `trpg_talk_<GM>_{critical,critical_full,fumble,double,heat_up,heat_max}` を足す。

## 企画の方針（オーナー指示）

- **タイトルの段階で相談し、了承を得てから書く**（2026-11-01）。
- **新規シナリオはシーシャかキャラに少し絡める**。たまに絡まない回があってもよい（2026-11-02）。
- **ひよりがGMの回だけ「儚さ」を題名と物語に入れる**（消えていくもの・一夜かぎり・朝霧など。2026-11-02）。悲しい結末にはせず、ほろ苦く温かく終える。
- シーシャに触れるときは香り・一台・過ごす時間の話にとどめ、機材や工程の細かい説明はしない（描写の正本は `docs/shisha_reference.md`）。

## 現行の9冊

| 区分 | ID / ファイル | 持ち込み主・GM |
|---|---|---|
| 汎用 | regular-harbor / trpg_regular_harbor.json | サイ（GM） |
| 汎用 | regular-mail / trpg_regular_mail.json | サイ（GM） |
| 部員 | ordinary-cup / trpg_ordinary.json | ひより（GM） |
| 部員 | shark-last-order / trpg_shark.json | サメちゃん（GM） |
| 部員 | leaf-mail / trpg_leaf_mail.json | つむぎ（GM） |
| 部員 | apple-thief / trpg_apple_thief.json | アダム（GM） |
| 部員 | moonflower-encore / trpg_moonflower_encore.json | クラウド（GM） |
| 部員 | purikura-hero / trpg_purikura_hero.json | あげは（PL）・サイ（GM） |
| 最終 | mist-kingdom / trpg_mist_kingdom.json | サイ（GM） |

題名・料金・入荷条件は `data/trpg_catalog.json` と [本棚・招集の仕様](trpg_preview.md) を参照。

## 現行の本数と補充役（2026-11-11）

シナリオは部員6人に1冊ずつ、部員なしで遊べる汎用2冊、サイの最終シナリオ1冊の計9冊。追加で増やさず、この枠で整える。入荷条件の正本は `data/trpg_catalog.json`。`member` が持ち込みの部員、`clearRequires` が最終シナリオまでに読み終える6冊。

鉄仮面さんは参加しない。汎用卓はサイがGM、はじめとサイの店の常連A・BがPL。`regulara` / `regularb` は専用のモブで、通常表情の人影を使う。部員シナリオの任意のPL席にも常連の候補・`alternatives`・台詞の `variants`・`companionBuilds` と本人の役紹介を用意する。必須の部員とGMは常連で置換しない。他キャラの口調・私生活・固有の持ちネタを補充役へ引き継がない。
