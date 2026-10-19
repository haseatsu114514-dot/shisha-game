# A — 採用済み第2章3会話の台本と2表情制作指示

## 採用・完成・実装の境界

本人は **2026-10-16T01:10:48.941549Z「いいよ」** と回答し、アゲハ「感覚を言葉にする」・神崎「一度置いて見直す」・REI「曲の話なら言葉が増える」と、神崎smile・REI seriousを採用した。**この3方向/2表情は再承認待ちへ戻さない。** 今回はその方針に沿った実際の台本稿と制作プロンプトを完成させた。

- **完成した独立成果物:** 本書の3台本（14/12/14表示要素）、レビュー用JSON（ローカル原本 scripts-A-20261016/dialogue-proposal.json）、神崎smile prompt（ローカル原本 scripts-A-20261016/kumicho-smile-prompt.txt）、REI serious prompt（ローカル原本 scripts-A-20261016/rei-serious-prompt.txt）。JSONは本編と同じ`dialogues/lines`形の**本編外の提案**で、ゲームへコピー/接続していない。
- **未実施:** 本編JSON/コード/manifestへの反映、正式ID/保存キーの予約、画像生成/画像実体の採用、ゲームプレイ/テストスイート/公開確認。画像の実体が完成したとは言わない。台本稿は完成しており、後続で組込レビューできる状態。
- **除外:** 夜背景、王冠/英題/本筋改稿、つむぎ条件、別章/他人物、他の親担当案件。夜背景の完成を今回の接続条件にしない。
- 根拠の固定mainは **`35715b902ba9d1c67f3f583d7226dfc7af1af617`**。前回の台本方向/保存契約を使用しつつ、人物正本・現行chat/repeat・終端・成長・素材参照のblobを今回のtreeへ再照合した。取得時刻/終了前再確認は 実行証跡（ローカル原本 A_APPROVED_SCRIPTS_EXECUTION_EVIDENCE.md） を参照。

「表示要素」はVNの1つの`lines[]`要素＝下表の1行。実画面での自動折返し/複数ページの行数とは別で、今回は画面上の折返しを実測していない。最長文は38全角相当以下だが、可読性の画面QA済みという意味ではない。

## 完成台本稿

### あげは — 感覚を言葉にする

仮ID: `remake_ch2_ageha_followup`。**14表示要素（台詞13＋地の文1）**。話者本人のfaceは normal / sad / smile。

| 行 | 話者（speaker） | face | 台詞 |
|---:|---|---|---|
| 1 | 地の文（`(空欄)`） | `(空欄)` | 白いクマの隣に座ると、あげはがこちらへ顔を向けた。 |
| 2 | あげは（`ageha`） | `smile` | ハジメっち、今日もその席？ すっかり定位置じゃん |
| 3 | はじめ（`hajime`） | `normal` | この前の、顔を見てから聞くって話。もう少し聞きたくて |
| 4 | あげは（`ageha`） | `normal` | うん。……でもさ、「なんでそう思ったの？」って聞かれると、困るんだよね |
| 5 | はじめ（`hajime`） | `normal` | 分かってるのに、説明しにくいんですか？ |
| 6 | あげは（`ageha`） | `sad` | そそ。「なんか今日はこう！」しか出てこなくて。自分でも雑すぎってなる |
| 7 | はじめ（`hajime`） | `normal` | 例えば……今なら、どんな感じですか？ |
| 8 | あげは（`ageha`） | `normal` | んー……今日は、急いで話さなくてもいい感じ |
| 9 | はじめ（`hajime`） | `normal` | 俺が、まだ話を聞きたそうにしてるから、とか |
| 10 | あげは（`ageha`） | `normal` | ……あ、それ。立つ気なさそうだなって、見てたかも |
| 11 | はじめ（`hajime`） | `normal` | そう聞くと、どこを見てたのか、少し分かります |
| 12 | あげは（`ageha`） | `smile` | うちも。しゃべってると、あとから言葉が追いつくんだね |
| 13 | はじめ（`hajime`） | `normal` | すぐ説明できなくても、聞いてみてよかったです |
| 14 | あげは（`ageha`） | `smile` | うん。また聞いて。今度も「なんか」で止まるかもだけど！ |

初回chatのa/bどちらからも、客の顔を見る話をもう少し聞きたい、という3行目へつながる。6行目の困り顔は言葉が出にくい小さな躓きで、病弱・人員・重大な秘密の告白ではない。12行目は今この会話で言葉が追いついた小さな実感だけに留め、14行目で今後も説明に詰まる余地を残した。既存repeatの「全部分かるわけではない」「決めつけず聞く」に戻っても矛盾しない。[CHAT][REPEAT][AGECHAR]

### 神崎竜二 — 一度置いて見直す

仮ID: `remake_ch2_kumicho_followup`。**12表示要素（台詞10＋地の文2）**。話者本人のfaceは normal / smile。

| 行 | 話者（speaker） | face | 台詞 |
|---:|---|---|---|
| 1 | 地の文（`(空欄)`） | `(空欄)` | 黒革のソファに腰を下ろし、飲み物を机に置いた。 |
| 2 | 神崎竜二（`kumicho`） | `smile` | おう、小僧。今日は何が引っかかってる |
| 3 | はじめ（`hajime`） | `normal` | この前の、いったん置いて見直すって話です。急いでると、置くのも遅く感じそうで |
| 4 | 神崎竜二（`kumicho`） | `normal` | 手に持ってると、そいつをどうするかばっかり考えちまうからな |
| 5 | 地の文（`(空欄)`） | `(空欄)` | 神崎さんは自分のグラスを置き、机の上で手を開いた。 |
| 6 | 神崎竜二（`kumicho`） | `normal` | 置きゃ、ほかも見える。肘の先とか、次に手を出す場所とかよ |
| 7 | はじめ（`hajime`） | `normal` | ……あ。飲み物を持ったままだと、この空いてる所も使う気にならないですね |
| 8 | 神崎竜二（`kumicho`） | `normal` | そういうこった。急ぐ時ほど、持ったまま迷うな |
| 9 | はじめ（`hajime`） | `normal` | 早く動くより、一度ちゃんと見られるようにするんですね |
| 10 | 神崎竜二（`kumicho`） | `normal` | おう。置き場所だって、一度決めりゃ終いじゃねえぞ |
| 11 | はじめ（`hajime`） | `normal` | はい。店の卓で、手を空けた時に何が見えるか、確かめてみます |
| 12 | 神崎竜二（`kumicho`） | `smile` | ああ。お前の手に合う場所を探せばいい |

自店で実際に試した成功を前提にせず、3行目で前回の助言の理由を聞く。5行目は既存の机/飲み物で伝える地の文で、画像へ新しい手ポーズや器具を要求しない。11行目はこれから確かめる意向に留め、12行目の迎えで完結。既存repeatの「動かして、また確かめろ」へ戻れる。[CHAT][REPEAT][KCHAR]

### REI — 曲の話なら言葉が増える

仮ID: `remake_ch2_rei_followup`。**14表示要素（台詞13＋地の文1）**。話者本人のfaceは normal / serious。

| 行 | 話者（speaker） | face | 台詞 |
|---:|---|---|---|
| 1 | 地の文（`(空欄)`） | `(空欄)` | 棚のCDを見ていると、REIさんが前に見せてくれた一枚を指した。 |
| 2 | REI（`rei`） | `normal` | ……それ、気になる？ |
| 3 | はじめ（`hajime`） | `normal` | はい。REIさんは、この曲のどんなところが好きなんですか？ |
| 4 | REI（`rei`） | `serious` | ……音が、すぐには重ならない |
| 5 | はじめ（`hajime`） | `normal` | 重ならない？ |
| 6 | REI（`rei`） | `serious` | ひとつ鳴って、消えかけたところに、次の音が来る |
| 7 | REI（`rei`） | `serious` | その間が……いい。静かになっても、まだ続きがある感じがして |
| 8 | REI（`rei`） | `serious` | だから、急いで次の曲にしない。……少し、そのままにしてる |
| 9 | はじめ（`hajime`） | `normal` | 音が止まった後も、聴いてるんですね |
| 10 | REI（`rei`） | `normal` | ……ああ。……喋りすぎた |
| 11 | はじめ（`hajime`） | `normal` | いえ。どんなふうに聴いてるのか、少し分かりました |
| 12 | REI（`rei`） | `normal` | ……そうか |
| 13 | はじめ（`hajime`） | `normal` | ほかのCDの話も、また聞いていいですか？ |
| 14 | REI（`rei`） | `normal` | ……うん。気になったら、聞いて |

前回見せてもらったCDを再び話題にするだけで、家で聴いた/ミックスを吸った実績は作らない。4・6〜8行目の音の間と余韻は今回の無名の曲の感想として書いた台詞で、実在曲/歌詞の引用や新音源指定ではない。10行目でnormalへ戻り、14行目の短い応答で完結。既存repeatが後に曲の感想を尋ねても、未試聴のまま矛盾しない。鎧/本名/笑顔の節目は先取りしない。[REI][REPEAT][RCHAR]


### JSONの静的検証

dialogue-proposal.json（ローカル原本 scripts-A-20261016/dialogue-proposal.json）には仮ID3本のみを入れ、各場面は`dialogue_id`/`lines`、各行は`speaker`/`face`/`text`のみとした。ROOMSの現行室内を呼出側で使うため、旧`bg`等のmetadataは入れていない。[LOADER]

検証結果（ローカル原本 scripts-A-20261016/DIALOGUE_STATIC_VALIDATION.json）: **PASS**。ID重複なし、許可話者/許可faceのみ、制御行0・branches0・metadata0・隠れた報酬/flagフィールド0。apply/remember/set_flag/save/連絡先/選択肢/新CG/固定日程はない。台詞で能力加算も示唆しない。

アゲハはmanifest登録済みnormal/sad/smile、はじめはnormalを使用。神崎smile/REI seriousは**採用済み制作方針であって、現在のmanifestにはまだない2キー**。検証はこの差を明示しており、現物が登録済みとしてPASSにしていない。[AGE][MAN][FALL]

## 2表情の具体的制作指示

### 共通の本人参照・検品条件

以下の6パスは固定main treeに実在し、Git blobを確認した。原画/採用PNG/配信WebPの役割は既存metadataと一致。[META]

| 本人素材 | 現在のGit blob SHA |
|---|---|
| [asset_sources/ch2-characters/kumicho/normal-source.png](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/asset_sources/ch2-characters/kumicho/normal-source.png) | `6977f1276fe4ce7ed41df4094dd986568d5320cd` |
| [assets/sprites/characters/kumicho/chr_kumicho_normal.png](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/assets/sprites/characters/kumicho/chr_kumicho_normal.png) | `f6fa5c49e8e7bcae039c7880fae5e71ba29e3dad` |
| [remake/img/sprites/characters/kumicho/chr_kumicho_normal.webp](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/img/sprites/characters/kumicho/chr_kumicho_normal.webp) | `7223cd97bbd40e2ea399d22a8dc10256f28e7903` |
| [asset_sources/ch2-characters/rei/normal-source.png](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/asset_sources/ch2-characters/rei/normal-source.png) | `9e3d967f36d0f5175a517bb6238a117f4fe80f71` |
| [assets/sprites/characters/rei/chr_rei_normal.png](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/assets/sprites/characters/rei/chr_rei_normal.png) | `eb78c8cb3da598a48e4788b01e603e25b41c7fd4` |
| [remake/img/sprites/characters/rei/chr_rei_normal.webp](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/img/sprites/characters/rei/chr_rei_normal.webp) | `a804cef8835592af3b4b1e61f263b4afb3e18ec5` |

**今回は画像バイトをダウンロード/復号/実見していない。** 表のblobはGitHub treeの同一性情報であり、画素のhashや目視合格を今回検証した結果ではない。寸法・顔・傷の位置・画風が実見で一致したとも主張しない。制作担当は本人原画と採用PNGを実際に開いてから、下のpromptを使う。正確なピクセル寸法/足元/透過/画素比較結果は、そこで実測して制作記録へ残す。

参照の優先度は、**本人原画＝顔/髪/傷/刺青/衣装等の細部、採用PNG＝ゲーム内の尺度/配置、人物正本＝年齢/人物の整合**。一般的なvisual conceptから別の服・傷・刺青を新設せず、採用画像の形を優先する。神崎は39歳、REIは25歳の現行人物として保つ。[KCHAR][RCHAR][ART]

| 検品項目 | 合格条件 | 不合格例 |
|---|---|---|
| 本人性 | 原画/normal/候補を並べて、顔輪郭・目/鼻/顎・髪の左右・年齢感・体格・衣装・見えている傷/刺青が同一 | 顔が細長くなる、別人/若返り、髪色の左右反転、傷/刺青の追加/削除 |
| 変更範囲 | 顔の表情だけが意図通り変わる。頭/体/手/指/小物と全身姿勢を維持 | 表情差分なのに手を開く/物を持つ/体を向け直す、新器具/CDを描く |
| normal並び比較 | 目線・目の間隔・瞳位置・頭の外周・肩幅/腰/足元が揃い、表情以外の移動が見えない | 笑うと顔全体が横へずれる、足が浮く、別のカメラ角度 |
| 透過/構造 | 頭髪/衣装/指の外周、身体と腕の間まで自然。背景や光輪を足さない | 背景色/白縁/謎の半透明光、指・髪の欠落、衣装端の切れ |
| 配信時の尺度 | 現採用normalと同じ最終キャンバス/人物尺度/足元の基準で比較し、顔切れ・意図しない拡大縮小なし | 別人物の大きさへ揃える、顔だけ拡大、足先が切れる |
| 記録 | 元出力・実際のprompt・参照パス/blob/画素hash・実寸法・生成時刻/ツール・採否を対応付ける | 元出力を上書き、候補を採用済みと記録、未計測寸法を埋める |

### 神崎smile — 迎えと締めの小さな笑み

- **対応台詞:** 神崎2行目「おう、小僧。今日は何が引っかかってる」、12行目「ああ。お前の手に合う場所を探せばいい」。4/6/8/10行目の手順説明はnormalへ戻す。
- **表情差分:** 閉じた口の両端をわずかに上げ、目/眉の緊張を少しだけ緩める。目は開いたままで目線はnormalと同方向。鋭い顔・小さな傷・髪・体格・衣装・見える刺青・丁寧な手は本人画像どおり。
- **合格:** 縮小したVNでも小さな迎えの柔らかさが分かり、normalと並べても別人化/位置ずれなし。**不合格:** 歯を見せる大笑い、smug/威圧/挑発、赤面/若返り、閉じ目笑顔、手/指/持ち物の変更。
- **演技の扱い:** 台本5行目のグラス/手を開く動きはナレーション。立ち絵のポーズ差分や新しいグラス絵を追加する指定ではない。

候補作成用の実文（独立txtにも同内容を保存）:

```text
用途: 第2章の客席で読む新しい短い会話に使う、既存人物の表情差分候補。新しい人物デザインや新画風の提案ではない。
この指示を実行する担当は、次の本人原画と現採用PNGを実際に開き、同じ人物であることと画像の寸法・透過・足元を先に確認する。入力にはこの2点の本人画像を添付し、別作品・画風候補・他人物の画像を本人参照として代用しない。
原画: asset_sources/ch2-characters/kumicho/normal-source.png
原画Git blob: 6977f1276fe4ce7ed41df4094dd986568d5320cd
採用PNG: assets/sprites/characters/kumicho/chr_kumicho_normal.png
採用PNG Git blob: f6fa5c49e8e7bcae039c7880fae5e71ba29e3dad
参照固定main: 35715b902ba9d1c67f3f583d7226dfc7af1af617
元の画風・描線・色・肌/衣装の質感・陰影の段階・画像内の照明を維持する。顔の輪郭、目の形と間隔、鼻、顎、耳、髪型、髪の左右の配置、体格、衣装の形と配色、見えている傷・刺青・装飾、首・肩・腕・手・指の形と位置、全身姿勢を原画のまま保つ。原画と採用PNGで配置調整が異なる場合は、原画を本人/細部、採用PNGを最終表示位置・縮尺の基準とする。左右反転しない。
対象は神崎竜二、既存設定の39歳の成人男性。既存の鋭い顔と強さを保ち、客を迎える時に口角がわずかに上がる、抑えた笑みへ変える。両目は開いたまま、目元と眉の緊張だけをごく少し和らげる。口は閉じた小さな笑みで、歯を見せず、頬の持ち上がりも最小限にする。目線・瞳の位置はnormalと同じ相手へ向ける。小さな変化でもnormalと並べた時に迎える柔らかさが読めること。
高笑い、満面の笑顔、にやりとしたsmug、挑発、悪人顔、若返り、幼い顔、目を閉じた笑顔、赤面、傷を増やす演出は禁止。傷の正確な場所、髪、体格、服と刺青は本人原画に従い、文章から別のスーツや刺青を再設計しない。
使用する場面は「おう、小僧。今日は何が引っかかってる」と「ああ。お前の手に合う場所を探せばいい」の短い迎えと締め。机/グラス/手を開く動きは台本のナレーションで伝えるので、この表情差分の手や持ち物を変えない。
変更範囲は顔の表情だけ。頭の向き、体の向き、ポーズ、手や指、持ち物を新造・移動しない。見えていない傷や刺青を想像して追加しない。元から見えるものだけを位置・形・量まで維持する。
同じ画面内位置・同じ人物尺度を目標とする。元画像で見えている頭頂・足先・身体の外周を新たに切らない。元絵に写っていない身体や衣装を推測して描き足さず、表示範囲を維持する。元画像の姿勢・髪先・衣装端・指先の余白を保つ。完全な透明背景の独立立ち絵として出力する。背景、室内、床、背景色、煙、シーシャ器具、文字、ラベル、枠、ロゴ、光の輪、追加人物、比較シートを追加しない。1枚にこの人物1体・この表情1つだけ。
原画相当の画像を1枚だけ生成し、生成時の無加工出力を候補原本として保存する。既存normalは上書きしない。透過・寸法・本人性・配置の合否は生成後の検品で確認する。数値上の寸法一致だけで本人性合格にしない。
```

### REI serious — 曲を思い浮かべる静かな集中

- **対応台詞:** REI4行目「音が、すぐには重ならない」、6〜8行目の音の間/余韻の説明。2/10/12/14行目はnormal。10行目で説明から日常の短い返事へ戻す。
- **表情差分:** 両目を開いたまま、上まぶた/眉に小さな集中を加える。瞳・アイライン・目の大きさ/位置、顔の比率は変えず、口は閉じた中立。赤黒の非対称髪の左右/束/長さ、メイク、首/手など見える刺青、衣装・銀小物・姿勢は本人画像どおり。
- **合格:** normalより集中が読めるが、怒り/威嚇にならず、全身/顔の尺度と目線が揃う。**不合格:** 笑顔/赤面/涙/叫び/戦闘顔、怒りのV字眉、過度な細目、別人格、衣装/刺青の再デザイン。
- **演技の扱い:** 1行目でCDを指す動きはナレーション。serious立ち絵にCDや楽器を持たせない。笑顔の節目や深い告白の表情を先取りしない。

候補作成用の実文:

```text
用途: 第2章の客席で読む新しい短い会話に使う、既存人物の表情差分候補。新しい人物デザインや新画風の提案ではない。
この指示を実行する担当は、次の本人原画と現採用PNGを実際に開き、同じ人物であることと画像の寸法・透過・足元を先に確認する。入力にはこの2点の本人画像を添付し、別作品・画風候補・他人物の画像を本人参照として代用しない。
原画: asset_sources/ch2-characters/rei/normal-source.png
原画Git blob: 9e3d967f36d0f5175a517bb6238a117f4fe80f71
採用PNG: assets/sprites/characters/rei/chr_rei_normal.png
採用PNG Git blob: eb78c8cb3da598a48e4788b01e603e25b41c7fd4
参照固定main: 35715b902ba9d1c67f3f583d7226dfc7af1af617
元の画風・描線・色・肌/衣装の質感・陰影の段階・画像内の照明を維持する。顔の輪郭、目の形と間隔、鼻、顎、耳、髪型、髪の左右の配置、体格、衣装の形と配色、見えている傷・刺青・装飾、首・肩・腕・手・指の形と位置、全身姿勢を原画のまま保つ。原画と採用PNGで配置調整が異なる場合は、原画を本人/細部、採用PNGを最終表示位置・縮尺の基準とする。左右反転しない。
対象は零-REI-、既存設定の25歳の成人男性。赤黒の非対称な髪は、赤/黒それぞれの側と束・長さまで本人画像に合わせる。元のメイク、顔の比率、首や手など見えている刺青、衣装・銀色の装飾は一切増減しない。
曲の音の間を思い浮かべて説明する、静かな集中の真剣顔へ変える。両目を開いたまま、上まぶたと眉にごく小さい集中の緊張を加え、視線の焦点を保つ。目を細めすぎず、眉を怒りのV字にせず、瞳・アイライン・目の大きさを変えない。口は閉じた中立のまま、口角を上げない。頭と目線の方向、姿勢はnormalと同じ。
怒り、威嚇、叫び、戦闘顔、舞台の別人格、smile、sad、驚き、赤面、涙、笑顔の初披露や深い告白を連想させる演出は禁止。normalと並べて小さな集中の差が分かるが、別人・別の年齢感にはならないこと。
使用する場面は「音が、すぐには重ならない」から、音の間・余韻を少し長く説明する部分。CDを指す動きはナレーションで伝えるので、この立ち絵にCD/楽器/ホースなどの持ち物や新ポーズを足さない。
変更範囲は顔の表情だけ。頭の向き、体の向き、ポーズ、手や指、持ち物を新造・移動しない。見えていない傷や刺青を想像して追加しない。元から見えるものだけを位置・形・量まで維持する。
同じ画面内位置・同じ人物尺度を目標とする。元画像で見えている頭頂・足先・身体の外周を新たに切らない。元絵に写っていない身体や衣装を推測して描き足さず、表示範囲を維持する。元画像の姿勢・髪先・衣装端・指先の余白を保つ。完全な透明背景の独立立ち絵として出力する。背景、室内、床、背景色、煙、シーシャ器具、文字、ラベル、枠、ロゴ、光の輪、追加人物、比較シートを追加しない。1枚にこの人物1体・この表情1つだけ。
原画相当の画像を1枚だけ生成し、生成時の無加工出力を候補原本として保存する。既存normalは上書きしない。透過・寸法・本人性・配置の合否は生成後の検品で確認する。数値上の寸法一致だけで本人性合格にしない。
```

### 原画・指示・候補と採用後の保存予定

以下は**後続制作の予定パス**。今回リポジトリに作成/登録したものではない。採用方向は確定しているが、未生成の個々の画像を完成/採用済みとは記録しない。

| 段階 | 神崎 | REI |
|---|---|---|
| 候補原本（無加工） | `asset_sources/ch2-characters/kumicho/smile-candidates/01-source.png` | `asset_sources/ch2-characters/rei/serious-candidates/01-source.png` |
| 実際に使った指示 | 同候補フォルダ`01-prompt.txt` | 同候補フォルダ`01-prompt.txt` |
| 生成/比較/採否記録 | 同候補フォルダ`01-record.json`。参照原画/PNG・blob/画素hash・実寸法・生成時刻/ツール・比較・採否を記録 | 同左 |
| 選定原画の保存先候補 | `asset_sources/ch2-characters/kumicho/smile-source.png` | `asset_sources/ch2-characters/rei/serious-source.png` |
| 採用後ゲーム用PNG | `assets/sprites/characters/kumicho/chr_kumicho_smile.png` | `assets/sprites/characters/rei/chr_rei_serious.png` |
| 採用後表示WebP | `remake/img/sprites/characters/kumicho/chr_kumicho_smile.webp` | `remake/img/sprites/characters/rei/chr_rei_serious.webp` |
| 登録・記録 | `asset_sources/ch2-characters/metadata.json`の対象、`remake/data/manifest.json`のkumicho faces/webp配列 | 同REI部分 |

元normal原画/採用PNG/WebP/各framingを上書きしない。採用後の変換は共通尺度/足元を維持して行い、PNG/WebPのRGBA一致・透過・顔解決/実表示を確認する。現行登録ツールの限定対象更新は`python3 remake/tools/build_manifest.py --portraits-only kumicho rei`で、manifest内のwebp配列へ記録する。**これは後続採用後の手順であり、今回実行していない。** 共通metadata/manifestは同時編集せず1人が統合する。[BUILD]

## 本文の終端と接続契約

### 既存経路へ一度だけ挟む

本案の順序は **既存chatを完走 → 次の実訪問で新1会話 → 以後は既存repeat**。初回chatと新会話を同じ有料行動へ連結しない。各会話の最終行はアゲハ14・神崎12・REI14。最終行が表示されただけではなく、その後の正常終端を待つ。[VISIT][END]

| 場合 | 選択/確定 |
|---|---|
| `_ch2_talks[id]`なし/0 | 現行chat。未面識なら現行名乗りから。初回相談完走を新会話の完走にしない |
| 現行の実相談完走カウンタ1以上、新会話の明示的完走記録なし | 本稿の当該仮ID1本を選ぶ。新しい好感度/章日/練習/試聴条件を増やさない |
| 旧保存で相談/総訪問が多数・旧思い出あり | 新読了未定義=未読。総訪問/高好感度/旧記憶から新会話を読了推定しない |
| 新会話を正常完走済み | 現行repeat。新会話を報酬付きで再生し直さない |
| 途中reload/LOAD | 最後の確定保存へ戻り、新会話の読了なし。次の実訪問で冒頭から再試行 |

仮IDはJSONの3本であり、正式登録/予約ではない。新読了キー候補は以前の`flags._ch2_followup_done`等の限定記録で、**今回はschema/キーを確定予約しない**。旧カウンタや未知の保存項目を上書き移行しない。

### 費用/成長/読了を別々に先行保存しない

1. 新IDの台本と既存室内画像を課金前に検証する。JSONはROOMSを使う呼出側の室内参照に従い、旧店舗PNG/大会舞台metadataを持ち込まない。[LOADER][PLAY]
2. `play()`の戻り値あり・cancelledなし・state所有者が同じ、を確認した後だけ新読了と通常訪問記録を更新。`visited`配列は開始時に既にID入りなので、完走証明にはしない。[PLAY][END]
3. 完走の直後に台本や訪問関数から新たな早期saveを追加しない。既存paidActionの成長精算、calendarの`visitedDay[ch2_<id>]`/slot/afterActionの保存境界で費用/成長と一緒に確定する。[CAL][GROW]
4. 各新会話は現行の再訪枠：**3,000円・既存体力補正・1行動・好感度呼出5・現在の能力成長候補**を維持。`earnStat(...,4)`は実4Pではなく候補の重みで、実成長はpaidActionの通常枠。新台詞には追加成長/能力報酬文なし。[VISIT][GROW]
5. あげはの連絡先は既存初回chat完走時だけ。今回の新台詞は既存remember/解禁/LIMEを付けず、旧思い出/恋人/友人/在庫/装備も不変。インライン制御行を後から足さない。[VISIT][MEM]
6. 同日1店1回・既存昼夜/固定夜/約束/DAY14導線を維持。台詞の「この前」は連日来訪を要求せず、神崎11行目は未実施の練習をこれから確かめる文。REIは試聴した記録を要しない。

### 具体行に対応する受入表（後続実装用、今回は未実行）

| 検査地点/操作 | 期待する受入結果 |
|---|---|
| 3店とも1行目へ入る前：ID欠落/不正台本・室内画像失敗・体力確認取消・所持金不足 | 課金/行動/新読了を確定しない。エラー後に通常地図へ戻り、再試行可能 |
| アゲハ6行目・神崎5行目・REI7行目でreload/別の保存枠LOAD | 新読了を付けず、保存済みの行動前地点へ戻る。費用/成長/同日訪問の二重確定なし |
| アゲハ14・神崎12・REI14の表示中で中断 | 最終行を出しただけで読了trueにしない。正常finish前は未完 |
| 同じ最終行を送って正常finish | state所有者一致後だけ新読了。3,000円/既存体力補正/1枠/再訪好感度/能力候補を一度だけ精算 |
| 完走直後の連打/手動SAVE→reload→LOAD | 新会話を再度報酬付きで再生しない。同日再訪不可、別日訪問は既存repeat。スロット結果も再抽選しない |
| アゲハ初回a/bの各保存→新1〜14行 | どちらも3行目の相談へ自然につながる。回答履歴/新しい約束を捏造しない |
| 神崎11行目を含む旧保存/次回repeat | 実施済み練習成功や新技能を推定しない。0分解禁/兄弟/素性/装備の値は追加せず、trueの旧保存なら保持 |
| REI3〜8行目→既存repeat | 家で試聴済み/飲用済みとしない。CDを話題にするだけで、新音源の取得/再生/実在歌詞なし。smile/本名/鎧の開示なし |
| アゲハ2/12/14、神崎2/12、REI4/6〜8のface表示 | アゲハ既存faceを実参照。神崎smile/REI seriousの採用画像が実際に解決される。normalフォールバックだけで素材完成と判定しない |
| 画像遅延/顔画像故障・SKIP/AUTO/通常送り | 現行の読込みガード/代替で操作継続。資源/読了の結果は送り方で変わらない。新制御行・選択肢を足さない |
| 同stateの明示cancelled / LOAD後にstateが別物 | 前者の未確定費用/体力の局所復元を実装で確認。後者へ旧副作用を適用しない。現mainはcancelled確認前に課金するため、同state取消のRAM復元を既に保証済みと扱わない |
| 旧セーブ：新キーなし、相談回数0/1/複数、総訪問多数 | 新読了を数から生成せず、初回chat/新followup/既存repeatの正しい順。人物/関係/思い出/所持品・既存連絡先を保持 |
| PC/横タッチ/必要な縦DSで3本 | 会話の自然さ・折返し・話者/face・末尾・画像/足元を確認。今回の「14/12/14」は自動折返し画面のQA成功を意味しない |

後続担当は既存`remake/test/browser/ch2_daily.mjs`の2回目repeat期待を新1会話へ合わせ、3回目repeatを追加し、既存の費用/保存/連絡先assertを維持する。[OLDQA] 台本直呼びのfixture試験と本編地図からの実到達を分け、実訪問の`visitedDay`/slot精算まで待つ。新規suite/既存回帰を行ったhead・ブラウザ・保存前後差分を記録する。今回ゲームプレイ/テストスイート/インストールは不要として実施していない。

## 正式実装までの担当調整

独立台本・promptの完成は担当調整待ちで止めず、ここまで仕上げた。一方、次に本編へ書き込む前の調整は残る。

| 相手/対象 | 今回読み取れた事実 | 正式実装前の具体的調整 |
|---|---|---|
| #563現owner | `codex-563-20261015-01a13c35`。[bot台帳](https://github.com/haseatsu114514-dot/shisha-game/issues/563#issuecomment-6186741993)はclaimed、run38697952277。[保存引継ぎ](https://github.com/haseatsu114514-dot/shisha-game/issues/563#issuecomment-6187031979)は`codex/563-ch2-inventory`/PR#567/保存head`dac8e286...`、予約保持。#567は棚卸し文書の統合で、3会話/2表情の実装ではない | 現ownerが継続するか、停止/保存成果を確認して正規に引き継ぐかを整理。本稿3仮ID、準備JSON/訪問JS/ローダ、2人物sprite/manifestを対象として共有。別workerの予約を無断で解除/流用しない [CLAIM] |
| #564添削担当 | Open、今回も全コメント0。本文はClaude優先/回復確認後に着手、登録だけで自動発注完了ではない。同じJSONの実編集/予定を示す公開コメントはない | `data/dialogue/ch2_preparation.json`の新3IDだけを誰が取り込むか、既存chat/repeatの全体添削と編集順を合わせる。現担当が実際に編集中か・未pushがないかは読取りでは不明。無断で全体添削を代行しない |
| 関連Open PR実files | 開始時7件から調査中#599追加で終了前8件。#481（55 files）、#539（29 files）、#550（11 files）、#557（3 files）、#566（1 files）、#580（18 files）、#587（114 files）、#599（8 files）の実filesを全ページ取得し変更件数一致。予定の準備JSON/準備訪問JS/ローダ/manifest/共有metadata/2人物spriteへの**直接パス重複0** | 調査中に#599（運用規約8パス）がOpenへ追加された。今回固定mainへの統合は確認されておらず、その案を現規約としない。未push/今後の変更計画は不明。#580のcalendar/map、#481のmap、#566のbondsテストへ変更を広げるなら先に担当調整。共有台詞JSON/metadata/manifestは1人へ集約 |
| #549 | Openの保留境界として本文だけを確認。王冠/英題/本筋改稿は別工程 | 今回の台詞/画像へ持ち込まない。3方向/2表情の承認を、この別件の承認に拡張しない |

**今回claim/status/transfer/release、コメント/PR更新、ゲームファイル編集は行っていない。** 公開claimed履歴と元担当の実稼働/停止は別で、実稼働/未push/他担当のローカル変更は未確認。この不明を「競合なし・自由着手」としない。3方向/2表情の本人承認は既に得ており、その許可の再確認は要求しない。

## 根拠ファイル/行・検証境界

27本の必要ソース原文を最新treeと照合し、同じblobは前回取得物を再利用した。具体件数/原文SHA256/Git blobは SOURCE_MANIFEST.json（ローカル原本 scripts-A-20261016/SOURCE_MANIFEST.json）。下記は本書固定SHAのファイル/行。今回の台本本文/プロンプトは新しく著述した独立成果物で、現mainの既存台詞や生成済み画像だと偽らない。

| 参照 | 固定SHAの根拠 |
|---|---|
| CHAT | [既存アゲハ/神崎chat](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/dialogue/ch2_preparation.json#L1-L208) |
| REI | [既存REI chat](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/dialogue/ch2_preparation.json#L209-L310) |
| VISIT | [既存訪問・費用・正常完走・報酬/連絡先](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/chapters/ch2-preparation.js#L25-L64) |
| LOADER | [ROOMSと限定IDローダ](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/chapters/ch2-city-data.js#L16-L58) |
| CAL | [paidAction/訪問済み/slotの精算](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/daily/calendar.js#L305-L379) |
| GROW | [成長候補と実成長の境界](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/core/stats.js#L91-L128) |
| PLAY | [play開始・所有者/取消・画像待機](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/vn/engine.js#L130-L200) |
| END | [正常終端とcancelled](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/vn/engine.js#L264-L283) |
| MEM | [rememberの実行副作用](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/core/relationships.js#L1-L11) |
| FALL | [faceのnormal代替](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/core/data.js#L245-L262) |
| MAN | [神崎/REIはnormalのみ](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/data/manifest.json#L216-L232) |
| AGE | [アゲハ既存5表情](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/data/manifest.json#L18-L29) |
| ART | [本人性/店の素材境界](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/docs/asset_ai_guidance.md#L18-L37) |
| OLDQA | [実訪問/費用/保存/失敗の既存検査](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/test/browser/ch2_daily.mjs#L101-L160) |
| CLAIM | [既存予約/停止/引継ぎ境界](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/docs/issue_claim_protocol.md#L1-L50) |
| META | [原画・採用・配信の記録](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/asset_sources/ch2-characters/metadata.json#L1-L86) |
| BUILD | [採用後の限定portrait/WebP/manifest出力](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/tools/build_manifest.py#L227-L260) |
| AGECHAR | [agehaの現行人物正本](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/characters.json#L430-L467) |
| KCHAR | [kumichoの現行人物正本](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/characters.json#L490-L519) |
| RCHAR | [reiの現行人物正本](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/characters.json#L275-L321) |
| HCHAR | [hajimeの現行人物正本](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/characters.json#L3-L30) |
| REPEAT | [3人の既存repeat](https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/dialogue/ch2_preparation.json#L311-L401) |

今回の制約内での**成果物作成にブロッカーはない**。正式組込みには上表の担当調整と、台本/実生成候補の組込レビューが必要。画像は未生成、動的QAは未実施。前回の全成果/証跡/sourceを不変に保ち、Libraryへの書込みはwrapperに委ねた。

[CHAT]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/dialogue/ch2_preparation.json#L1-L208
[REI]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/dialogue/ch2_preparation.json#L209-L310
[VISIT]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/chapters/ch2-preparation.js#L25-L64
[LOADER]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/chapters/ch2-city-data.js#L16-L58
[CAL]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/daily/calendar.js#L305-L379
[GROW]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/core/stats.js#L91-L128
[PLAY]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/vn/engine.js#L130-L200
[END]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/vn/engine.js#L264-L283
[MEM]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/core/relationships.js#L1-L11
[FALL]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/js/core/data.js#L245-L262
[MAN]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/data/manifest.json#L216-L232
[AGE]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/data/manifest.json#L18-L29
[ART]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/docs/asset_ai_guidance.md#L18-L37
[OLDQA]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/test/browser/ch2_daily.mjs#L101-L160
[CLAIM]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/docs/issue_claim_protocol.md#L1-L50
[META]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/asset_sources/ch2-characters/metadata.json#L1-L86
[BUILD]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/remake/tools/build_manifest.py#L227-L260
[AGECHAR]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/characters.json#L430-L467
[KCHAR]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/characters.json#L490-L519
[RCHAR]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/characters.json#L275-L321
[HCHAR]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/characters.json#L3-L30
[REPEAT]: https://github.com/haseatsu114514-dot/shisha-game/blob/35715b902ba9d1c67f3f583d7226dfc7af1af617/data/dialogue/ch2_preparation.json#L311-L401


---

# レビュー用JSON提案の全文

以下はリポジトリ外の台本提案。ゲームへの登録・接続・予約はしていない。

```json
{
  "dialogues": [
    {
      "dialogue_id": "remake_ch2_ageha_followup",
      "lines": [
        {
          "speaker": "",
          "face": "",
          "text": "白いクマの隣に座ると、あげはがこちらへ顔を向けた。"
        },
        {
          "speaker": "ageha",
          "face": "smile",
          "text": "ハジメっち、今日もその席？ すっかり定位置じゃん"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "この前の、顔を見てから聞くって話。もう少し聞きたくて"
        },
        {
          "speaker": "ageha",
          "face": "normal",
          "text": "うん。……でもさ、「なんでそう思ったの？」って聞かれると、困るんだよね"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "分かってるのに、説明しにくいんですか？"
        },
        {
          "speaker": "ageha",
          "face": "sad",
          "text": "そそ。「なんか今日はこう！」しか出てこなくて。自分でも雑すぎってなる"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "例えば……今なら、どんな感じですか？"
        },
        {
          "speaker": "ageha",
          "face": "normal",
          "text": "んー……今日は、急いで話さなくてもいい感じ"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "俺が、まだ話を聞きたそうにしてるから、とか"
        },
        {
          "speaker": "ageha",
          "face": "normal",
          "text": "……あ、それ。立つ気なさそうだなって、見てたかも"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "そう聞くと、どこを見てたのか、少し分かります"
        },
        {
          "speaker": "ageha",
          "face": "smile",
          "text": "うちも。しゃべってると、あとから言葉が追いつくんだね"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "すぐ説明できなくても、聞いてみてよかったです"
        },
        {
          "speaker": "ageha",
          "face": "smile",
          "text": "うん。また聞いて。今度も「なんか」で止まるかもだけど！"
        }
      ]
    },
    {
      "dialogue_id": "remake_ch2_kumicho_followup",
      "lines": [
        {
          "speaker": "",
          "face": "",
          "text": "黒革のソファに腰を下ろし、飲み物を机に置いた。"
        },
        {
          "speaker": "kumicho",
          "face": "smile",
          "text": "おう、小僧。今日は何が引っかかってる"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "この前の、いったん置いて見直すって話です。急いでると、置くのも遅く感じそうで"
        },
        {
          "speaker": "kumicho",
          "face": "normal",
          "text": "手に持ってると、そいつをどうするかばっかり考えちまうからな"
        },
        {
          "speaker": "",
          "face": "",
          "text": "神崎さんは自分のグラスを置き、机の上で手を開いた。"
        },
        {
          "speaker": "kumicho",
          "face": "normal",
          "text": "置きゃ、ほかも見える。肘の先とか、次に手を出す場所とかよ"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "……あ。飲み物を持ったままだと、この空いてる所も使う気にならないですね"
        },
        {
          "speaker": "kumicho",
          "face": "normal",
          "text": "そういうこった。急ぐ時ほど、持ったまま迷うな"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "早く動くより、一度ちゃんと見られるようにするんですね"
        },
        {
          "speaker": "kumicho",
          "face": "normal",
          "text": "おう。置き場所だって、一度決めりゃ終いじゃねえぞ"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "はい。店の卓で、手を空けた時に何が見えるか、確かめてみます"
        },
        {
          "speaker": "kumicho",
          "face": "smile",
          "text": "ああ。お前の手に合う場所を探せばいい"
        }
      ]
    },
    {
      "dialogue_id": "remake_ch2_rei_followup",
      "lines": [
        {
          "speaker": "",
          "face": "",
          "text": "棚のCDを見ていると、REIさんが前に見せてくれた一枚を指した。"
        },
        {
          "speaker": "rei",
          "face": "normal",
          "text": "……それ、気になる？"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "はい。REIさんは、この曲のどんなところが好きなんですか？"
        },
        {
          "speaker": "rei",
          "face": "serious",
          "text": "……音が、すぐには重ならない"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "重ならない？"
        },
        {
          "speaker": "rei",
          "face": "serious",
          "text": "ひとつ鳴って、消えかけたところに、次の音が来る"
        },
        {
          "speaker": "rei",
          "face": "serious",
          "text": "その間が……いい。静かになっても、まだ続きがある感じがして"
        },
        {
          "speaker": "rei",
          "face": "serious",
          "text": "だから、急いで次の曲にしない。……少し、そのままにしてる"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "音が止まった後も、聴いてるんですね"
        },
        {
          "speaker": "rei",
          "face": "normal",
          "text": "……ああ。……喋りすぎた"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "いえ。どんなふうに聴いてるのか、少し分かりました"
        },
        {
          "speaker": "rei",
          "face": "normal",
          "text": "……そうか"
        },
        {
          "speaker": "hajime",
          "face": "normal",
          "text": "ほかのCDの話も、また聞いていいですか？"
        },
        {
          "speaker": "rei",
          "face": "normal",
          "text": "……うん。気になったら、聞いて"
        }
      ]
    }
  ]
}
```

---

# 今回の実行証跡

# A 採用済み3会話＋2表情制作指示 実行証跡

## 開始・終了と本人承認

- 同一公式CLI A thread `01a141a7-f239-70b3-aa49-b43272d9f8f0` の明示続行依頼。別A/他アカウント/他AIを起動していない。wrapperによる起動前確認は依頼文の情報で、Aが再実行した確認とは主張しない。
- 開始: **2026-10-16T01:14:10.313917+00:00**（UTC）
- 完了: **2026-10-16T01:25:51.133607+00:00**（UTC）
- 最終main GET: **2026-10-16T01:24:29.654935+00:00**（UTC）
- main: 開始/終了とも **`35715b902ba9d1c67f3f583d7226dfc7af1af617`**。前回終了mainとも同じ。
- 本人承認: 2026-10-16T01:10:48.941549Z「いいよ」。3方向と神崎smile/REI seriousは採用済みとして使用し、再承認待ちへ戻していない。今回作ったのは具体台本稿と制作指示で、ゲームへの反映/画像の完成はしていない。

## 完成成果

- 統合台本・表情仕様（ローカル原本 chapter2-approved-scripts-A.md）
- レビュー用JSON（ローカル原本 scripts-A-20261016/dialogue-proposal.json）：アゲハ14、神崎12、REI14の計40表示要素。
- 神崎smile prompt（ローカル原本 scripts-A-20261016/kumicho-smile-prompt.txt） / REI serious prompt（ローカル原本 scripts-A-20261016/rei-serious-prompt.txt）
- 台詞の静的検証（ローカル原本 scripts-A-20261016/DIALOGUE_STATIC_VALIDATION.json） / source原文hash・画像パスblob（ローカル原本 scripts-A-20261016/SOURCE_MANIFEST.json）
- 途中成果（ローカル原本 A_APPROVED_SCRIPTS_PROGRESS.md） / 集計JSON（ローカル原本 scripts-A-20261016/EXECUTION_SUMMARY.json）

全書込みは今回許可された`research/scripts-A-20261016/`、3つの指定Markdown、`work/`内の新しい補助スクリプトだけ。checkoutは作っていない。前回までのresearch/workの成果・証跡・取得source等 **383ファイル** は開始時にhashを保存し、終了時全一致を確認した。保護hash一覧（ローカル原本 scripts-A-20261016/previous-files-hashes.json）。前回の原文は上書きしていない。

## 実際のGitHub GET

すべて既存gh認証で明示 `gh api repos/haseatsu114514-dot/shisha-game/...` のGETだけ。認証状態/キー/トークン/環境内容を調べず、通常の既存CLI/ghを利用した。詳細なendpoint・開始/完了UTC・returncode・保存先は commands.jsonl（ローカル原本 scripts-A-20261016/commands.jsonl）。今回 **35 GET試行、成功35 / 失敗0**。

1. `commits/main`を開始・終了前・最後にGET。同じSHA。
2. `git/trees/35715b902ba9d1c67f3f583d7226dfc7af1af617?recursive=1`をGET、truncated=false。必要なソース27本と画像参照6パスを照合。
3. 固定SHAの`contents/AGENTS.md`、`contents/docs/current_documentation_guide.md`、`contents/docs/issue_claim_protocol.md`をGET。現行ルール/正本/非変更調査の境界を確認。
4. #563/#564の本文と`comments?per_page=100&page=1`をGETし、終了前も再取得。#563は全2コメント、#564は0。本文/updated_at/コメント内容は開始と終了で同じ。#549は保留境界の本文だけを取得し、改稿側の調査へ広げていない。
5. Open PR一覧を全ページ取得（1ページ）、開始7件の各詳細/実filesを全ページGET。終了前に8件となり、追加#599の詳細と8 filesを取得。他7headは不変。#587だけfiles2ページ。

全Open実files: #481=55 / #539=29 / #550=11 / #557=3 / #566=1 / #580=18 / #587=114 / 追加#599=8。各詳細`changed_files`と取得件数が一致。

今回の組込み予定`data/dialogue/ch2_preparation.json`、`remake/js/chapters/ch2-preparation.js`、`ch2-city-data.js`、manifest、共有ch2-characters metadata、神崎/REIの原画/PNG配下に**Open PRの直接変更パス重複0**。新PR#599はAGENTS/参照ガイド/予約規約・workflow/スキル等の運用案で、固定mainへはまだ統合されていない。今回その案を現規約として採用していない。#580等のcalendar/mapへの波及は別調整、未pushや実稼働は不明。

## 読んだ根拠・原文の同一性

前回から同じblobの必要ソース**24本を再利用**。今回取得した入口3文書を含む計**27本**の復号原文について、`SHA1('blob '+len+'\0'+bytes)`を最新treeと照合し全一致。個々のSHA256/元ローカルpath/物理行数もSOURCE_MANIFESTに保存。

人物正本、現行chat/repeat、旧3人物の候補台本、ROOMS/ローダ、訪問完走、VN終端、paidAction、calendar、思い出/保存/face代替、素材記録を読み取った。`rg`/`nl`/Python標準ライブラリを使い、存在する旧取得原文を参照。不要な全Issue/Closed PRの再取得や全ソースの再ダウンロードはしていない。

画像は**原画・採用PNG・配信WebPの正確な6パスとGit blob**をtree/metadataから確認した。画像バイトはダウンロード/復号/表示していない。原画寸法・画素一致・本人性/画風・透過に今回目視/実測で合格を出したとは言わない。promptにも、制作担当が実画像を開いて参照・計測する条件を含めた。

全raw GET結果のSHA256は RAW_RESPONSE_HASHES.json（ローカル原本 scripts-A-20261016/RAW_RESPONSE_HASHES.json）。復号原文は元のままで、今回の新しい台詞JSONとは区別。

## 実際に行った静的検証

`python3 work/approved_validate_dialogue.py`を実行しPASS。

- rootは`dialogues`のみ、3 sceneのみ。sceneは`dialogue_id/lines`だけ、lineは`speaker/face/text`だけ。
- 仮IDは`remake_ch2_ageha_followup` / `remake_ch2_kumicho_followup` / `remake_ch2_rei_followup`。重複なし、正式登録/予約なし。
- 許可話者と許可faceだけ。神崎smile/REI seriousは承認済みの新制作方針で、現manifest未登録の2キーと明記。登録済みだと偽っていない。
- 制御行/branches/metadata/隠れたreward/flagフィールドは全0。不可視制御文字/改行なし、話者台詞の末尾句点なし。禁止した解禁・新関係・味覚回復等の語を入れない検査も実施し、内容を人手で読み直した。
- 行数は14/12/14。地の文は1/2/1、話者台詞13/10/13。最大長35/38/29.5全角相当。画面折返し・フォント実測ではない。
- 統合Markdownの40行がJSON本文と一致し、2本の独立promptを統合文書へ同内容で掲載したことを検査。
- 最後にリンク/固定SHA行範囲/素材blob/成果物hash/前回保護hashを検証し、ARTIFACT_VALIDATION.json（ローカル原本 scripts-A-20261016/ARTIFACT_VALIDATION.json）に記録する。

## 担当境界・未確認

#563最新bot台帳は [6186741993](https://github.com/haseatsu114514-dot/shisha-game/issues/563#issuecomment-6186741993)、claimed owner `codex-563-20261015-01a13c35`、run38697952277。[引継ぎ6187031979](https://github.com/haseatsu114514-dot/shisha-game/issues/563#issuecomment-6187031979)は棚卸し文書PR#567、保存head`dac8e286...`、予約保持。これは今回Aがclaim/statusを取得したという意味ではない。元担当の現在の稼働/停止/未pushは不明。

#564はOpen/全コメント0、Claude優先の全体添削予定。新3IDを入れる同じJSONの現在の実編集/予定は公開情報で判別できない。正式実装前に#563担当と3ID/準備訪問/ローダ/素材登録の範囲、#564担当と同じJSONの編集順を具体的に調整する。独立台本/promptの完成はこの調整待ちで止めず進めた。今回、担当移管/解除/新claim/自動AI委任は行っていない。

## 失敗・未実施・禁止操作

- **GET失敗/明示拒否:** 今回はなし。denied=0 / pending approval=0。usage-limit/auth/approval拒否を観測していない。
- **今回未実施:** ゲームプレイ、Node/ブラウザのテストスイート/台詞lint本体の実行、ブラウザ/アプリ起動、依存追加/インストール、画像生成/実画像採用/目視、公開版/CI動作検証。標準Pythonによる独立JSON/成果物の静的検証だけ実施。
- **禁止操作は実施なし:** checkout、ゲームコード/本編JSON/manifest編集、Issue/コメント/PRの作成更新終了、workflow dispatch、claim/status/transfer/release、merge/push、設定変更/ログイン、認証情報ファイル/キー/トークン/環境内容の読取り出力、追加課金/モデルAPI直呼び、他AI委任、他checkout/旧コピー/Trash/Godot操作。
- **成果物作成のブロッカーなし。** 正式組込みには既存担当/編集順の調整と、具体台本/実生成候補の組込レビューが残る。採用済み方向/2表情について同じ許可は聞き直さない。
- LibraryへAからは書き込まずwrapperへ委ねる。


# 公式Aの今回の実行確認

公式CLI Aの同じthread `01a141a7-f239-70b3-aa49-b43272d9f8f0` を、ユーザー指定の既存 `CODEX_HOME=$HOME/.codex` で再開した。起動前の限定プロセス確認で実行中standalone CLIはなく、重複起動していない。構造化ログのthread.startedとturn.completed、最終回答ファイルを確認した。認証情報読み取り・新ログイン・アカウント切替・設定変更は行っていない。

Aはリポジトリ外で3台本と2制作指示を完成し、383の既存成果ファイルが不変であることを検証した。正式実装、画像生成、担当移管、二重claim、ゲームコード編集はしていない。


## 成果物検証の記録

```json
{
  "at": "2026-10-16T01:26:20.001639+00:00",
  "status": "PASS",
  "markdown_rows_match_json": 40,
  "standalone_prompts_embedded_exactly": 2,
  "fixed_sha_file_line_links_checked": 44,
  "local_links_valid": true,
  "source_hashes_valid": 27,
  "previous_files_unchanged": 383,
  "artifacts": [
    {
      "path": "research/chapter2-approved-scripts-A.md",
      "bytes": 42126,
      "sha256": "f0da8fdac02bf9783d57e8f36db6320c898357a5266b1c76c85887a084792572"
    },
    {
      "path": "research/A_APPROVED_SCRIPTS_EXECUTION_EVIDENCE.md",
      "bytes": 8728,
      "sha256": "cf67d1b7b72c9b692a7515bbf9e358b7eaf3e4fe26faec1dafaa6565b9ca659b"
    },
    {
      "path": "research/A_APPROVED_SCRIPTS_PROGRESS.md",
      "bytes": 1982,
      "sha256": "de47f543a22582cd1f7bd48a6643479d0866583be55f610775c46a00578a41bd"
    },
    {
      "path": "research/scripts-A-20261016/dialogue-proposal.json",
      "bytes": 6995,
      "sha256": "02545c794efa8449bff08a1ecf555fe22caf2c0381d768e71b696cb01d895f89"
    },
    {
      "path": "research/scripts-A-20261016/kumicho-smile-prompt.txt",
      "bytes": 3603,
      "sha256": "499d1c6c6e8c0505dcb458de9dcbe574c0efacc7086873157b0f7c6dfcfe4df7"
    },
    {
      "path": "research/scripts-A-20261016/rei-serious-prompt.txt",
      "bytes": 3730,
      "sha256": "aa467258c9029acef820de8ebc2cbe5a663bf8d9737227770665746aa623cbc7"
    }
  ]
}
```
