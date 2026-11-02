# TRPG シナリオの背景と選択肢の絵（Codexへの指示書）

`python3 tools/trpg_art_prompts.py` が各シナリオのJSONから自動で書き出す。調査地点の位置（x%, y%）を背景の指示に焼き込むので、画面の光る輪が絵の物の上に来る。

## 受け取ったあと

1. 背景: 原画 `assets/backgrounds/trpg_<id>_room.png`（1280×720）→ 配信 `remake/img/backgrounds/trpg_<id>_room.webp`（品質90）。JSONの `presentation.image` に `"../../img/backgrounds/trpg_<id>_room.webp"`。
2. 選択肢: 原画 `assets/ui/trpg/choices-<id>.png`（透過・3列×5行）→ 配信 `remake/img/ui/trpg/choices-<id>.webp`（lossless）。JSONの `presentation.choiceArt` に `{"src": "../../img/ui/trpg/choices-<id>.webp", "rowCount": 5, "rows": {...}}`（下の行番号のとおり）。
3. 新規画像は Git LFS（`git lfs ls-files` で確認）。`node tools/validate_trpg_scenario.mjs` で画像の存在を検査し、`remake/trpg-preview.html?scenario=<id>` で輪と物の位置を目視する。
4. 生成日・SHA-256・目視QAを `asset_sources/trpg-scenarios/generation.json` に残す。
5. 人物シート（上段=はじめの見た目4種、下段=仲間の役4人）: 原画を `asset_sources/trpg-sheets/<id>/` に置き、`python3 tools/trpg_crop_portraits.py scenario <sheet.png> <id>` で切り出す。512px原寸は `assets/ui/trpg/`、256px WebP は `remake/img/ui/trpg/` に書かれ、JSONの `portrait` も埋まる。丸窓で目視してから commit。

## 01 世界一普通の一台（`ordinary-cup`）

- 背景: 済 / 選択肢の絵: 旧3列×3行あり（思わぬ展開の手だけ文字のカード）。3列×5行で作り直すと全部が絵になる
- 行番号: `aroma`=0, `seat`=1, `approach`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-ordinary-cup.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (一台の香り), left to right: (1) 穏やかな紅茶 — 温かい飲み物を思わせる、落ち着いた香り。; (2) やわらかい果実 — 甘さが少し残る、店のいつもの香り。; (3) 香ばしいスパイス — 印象に残る、少し華やかな香り。 Row 2 (過ごす席), left to right: (4) 雨を眺める窓辺 — 店の会話から少し離れた、静かな席。; (5) 人と話せるカウンター — 店番や、隣の客の顔が見える席。; (6) 古いメニューのそば — 昔の写真や店の記録を眺められる席。 Row 3 (添える言葉), left to right: (7) 声を添えて、少し離れる — 『どうぞ、ごゆっくり』。必要なら呼んでもらう。; (8) いつもの香りの話をする — 旅人の好きなものや、思い出をゆっくり聞く。; (9) 今日のことを聞いてみる — 『長い道のりでした？』。話すきっかけを作る。 Row 4 (来客への対応), left to right: (10) 漁師たちを奥の席へ — 賑やかさを奥にまとめ、手前を静かに保つ。; (11) 旅人と漁師を引き合わせる — せっかくの縁。同じ卓で話してもらう。; (12) 灯りを落として、静かに — 店の灯りを一段落とし、夜の店にする。 Row 5 (guesses), left to right: (13) 静かに休みたいのかも — 人の声から少し離れ、雨を眺められる時間。; (14) 懐かしい時間が欲しいのかも — 旅先で、いつもの香りや暮らしを思い出す時間。; (15) 誰かと話したいのかも — 一人で過ごした道のりのあと、会話がある時間。
```

## 02 サメは閉店を待たない（`shark-last-order`）

- 背景: 済 / 選択肢の絵: 旧3列×3行あり（思わぬ展開の手だけ文字のカード）。3列×5行で作り直すと全部が絵になる
- 行番号: `tool`=0, `route`=1, `finale`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-shark-last-order.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (仕掛けに使う道具), left to right: (1) 柑橘の香り箱 — 店のフレーバーを箱ごと、おとりに使う。; (2) 密閉と防振のセット — 香りを閉じ、滑り止めで床の振動を減らす。; (3) 点滅する救難灯 — 光を遠くへ運ぶ、小さな浮き仕掛け。 Row 2 (脱出する経路), left to right: (4) 救助艇の来る桟橋 — 短い移動で岸へ。海面の近くを通る。; (5) 屋根からのロープ — 乾いた屋根を通り、救助艇へロープで渡る。; (6) 裏の保守水路 — 光を遮る壁沿い。回り道でも見つかりにくい。 Row 3 (最後の作戦), left to right: (7) 香りを遠くへ流す — 閉店前の最後の一箱を、海へプレゼント。; (8) 全員、静かに移動する — 止めた音を戻さず、互いの手で合図する。; (9) 海上に光の見せ場を作る — 遠い浮き灯へ目を向けさせ、その間に逃げる。 Row 4 (停電への手), left to right: (10) みんなで水をかき出す — 床の水を減らし、足場を守る。; (11) 椅子とテーブルで足場を作る — 高いところを渡れるようにする。; (12) 非常用の無線を直す — 救助艇と、もう一度連絡を取る。 Row 5 (guesses), left to right: (13) 柑橘の甘い香りを追っている — 保管箱の中身を、こちらの逃げ道から離せそう。; (14) 低い振動を追っている — 音を止め、床を揺らさずに移動するべきかも。; (15) 点滅する光を追っている — 光を別の場所に置けば、こちらを見失いそう。
```

## 03 葉っぱ耳の郵便猫（`leaf-mail`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `route`=0, `wrap`=1, `handover`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-leaf-mail.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (届ける道), left to right: (1) 屋根の道 — 猫と月だけが知っている、屋根づたいの近道。; (2) 川沿いの道 — 水面の月を追って、川下へ続く長い道。; (3) 坂の階段 — 百段をのぼって、丘の上へ向かう道。 Row 2 (手紙の包み方), left to right: (4) 封蝋 — 赤い封蝋に月の印。昔ながらの、きちんとした手紙。; (5) 押し花 — 丘の青い花を一輪。景色ごと届ける。; (6) 小さな鈴 — 封筒の角で、ちりんと鳴る。誰からか、音で分かる。 Row 3 (渡し方), left to right: (7) 手渡し — 顔を見て、まっすぐ渡す。; (8) 窓辺にそっと置く — 起こさないように。朝、見つけてもらう。; (9) 歌と一緒に — ミトンの歌を添えて、手紙を渡す。 Row 4 (手紙を追う手), left to right: (10) 走って追いかける — 坂を駆けて、落ちてくるところを待つ。; (11) 凧で捕まえる — 詰所の古い凧を上げ、風ごとすくう。; (12) 夜の鳥に頼む — 時計塔のふくろうに、ひと声かける。 Row 5 (guesses), left to right: (13) 丘の灯台守へ — 毎晩、町に灯りをともすおじいさんへの手紙。; (14) 引っ越した子へ — 遠くの町へ越していった子どもへの手紙。; (15) ミトンを描いた人へ — ミトン自身が書いた、絵描きへのお礼の手紙。
```

## 04 怪盗と原点の林檎（`apple-thief`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `trap`=0, `post`=1, `confront`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-apple-thief.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (仕掛け), left to right: (1) 鈴の糸 — 通り道に糸を張り、怪盗が来たら鈴が鳴る。; (2) 偽の配合帳 — よく似た帳面を置き、怪盗を書斎へ誘う。; (3) 林檎の香りの道しるべ — 原点の香りを少しずつ置き、温室まで導く。 Row 2 (張り込む場所), left to right: (4) 書斎 — 配合帳のある部屋で、静かに待つ。; (5) 温室 — 林檎の木の下で、二つの椅子と待つ。; (6) 大広間 — 主人の椅子が見える場所で、客に紛れて待つ。 Row 3 (怪盗への向き合い方), left to right: (7) 捕まえる — 逃げ道をふさぎ、正面からそっと手を取る。; (8) 話を聞く — 仮面のままの怪盗の言い分に、耳を傾ける。; (9) 一台を勧める — 原点の香りの一台を用意して、席に招く。 Row 4 (騒ぎへの手), left to right: (10) 客を落ち着かせる — 飲み物を配り、夜会を元の空気に戻す。; (11) 騒ぎを利用する — 人の流れに紛れて、館の裏を見張る。; (12) 予告状を調べる — 二通目のカードから、怪盗の手がかりを探す。 Row 5 (guesses), left to right: (13) 配合帳を、弟子に返したい — 狙いは配合帳。本来の持ち主に届けるつもりかも。; (14) もう一度、主人と一台を囲みたい — 原点の香りを、誰かと分け合いたいのかも。; (15) 謝りの手紙を届けたい — 盗むかわりに、何かを置いていくつもりかも。
```

## 05 サメ島の宝の地図（`shark-island`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `gear`=0, `landing`=1, `offer`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-shark-island.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (船の装備), left to right: (1) 錨と網 — 沈んだ宝箱を、網ごと引き上げる。; (2) 太鼓と笛 — 船の楽器で、昔の歌を奏でる。; (3) 帆布の日よけ — 入り江に影を作り、静かに過ごせるようにする。 Row 2 (上陸地点), left to right: (4) 北の岩場 — 台座のすぐそば。足場は滑りやすい。; (5) 砂浜 — 柔らかい砂で、足音が立たない。; (6) 洞窟の入口 — 声がよく響き、入り江の奥まで届く。 Row 3 (王への差し出し方), left to right: (7) 宝を返す — 宝箱を開け、王のものを王に返す。; (8) 歌って聞かせる — あの夜の舟歌を、入り江に響かせる。; (9) そっと立ち去る — 何も起こさず、静かに入り江を離れる。 Row 4 (スコールへの手), left to right: (10) 帆をたたむ — 風を受けすぎないよう、帆を下ろす。; (11) 岩陰に逃げ込む — 大きな岩の陰で、雨風をやり過ごす。; (12) ロープで舟をつなぐ — 岸の岩に舟をつなぎ、流されないようにする。 Row 5 (guesses), left to right: (13) なくした王冠を取り戻したい — 冠を台座に返せば、王の機嫌が直りそう。; (14) 昔の舟歌を、もう一度聞きたい — あの夜の歌を聞かせれば、喜んでくれそう。; (15) 宝の上で、静かに昼寝したい — 起こさずに済ませるのが、いちばんかも。
```

## 06 朝霧の王国と、最後の一台（`mist-kingdom`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `flavor`=0, `place`=1, `words`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-mist-kingdom.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (香り), left to right: (1) 王妃の庭の花 — 王女が生まれた庭に咲く、白い花の香り。; (2) 霧の果実 — 朝霧の中で熟す果実。ゆっくり長く香る。; (3) 王女の合わせた茶 — 王女が自分で合わせた、やさしい茶の香り。 Row 2 (一台を置く場所), left to right: (4) 王妃の庭 — 王女が生まれた、小さな花の庭。; (5) 朝霧のバルコニー — 城下を見渡せる、霧のいちばん濃い場所。; (6) 選手権の舞台 — 王国じゅうの人が見守る、選手権の真ん中。 Row 3 (王女に添える言葉), left to right: (7) 思い出を聞く — 王女が話したいことを、急がず聞く。; (8) 夜明けまで隣にいる — 霧が晴れるその時まで、そばにいる。; (9) 作り方を教わる — 王女の一台の作り方を、霧の外へ持ち帰る。 Row 4 (晴れていく霧への手), left to right: (10) 鐘を鳴らして霧を呼び戻す — 塔の古い鐘。その音は霧を呼ぶと言われる。; (11) 消える前に急いで仕上げる — 迷う時間を削って、手を止めずに進める。; (12) 王女を霧の濃い場所へ案内する — 霧の残る奥の間へ、小さな手を引いていく。 Row 5 (guesses), left to right: (13) 生まれた庭の香りを、もう一度かぎたい — 王女が生まれた庭の香りを、その庭で届ければよさそう。; (14) 霧が晴れるまで、誰かに隣にいてほしい — 長く香る一台で、最後の朝を一緒に過ごせばよさそう。; (15) 誰かに、自分を覚えていてほしい — 霧の外へ持ち帰れるものを、皆の前で受け取ればよさそう。
```

## 07 星の駅の煙職人ロボ（`smoke-robot`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `part`=0, `flavor`=1, `gift`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-smoke-robot.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (修理パーツ), left to right: (1) 新しい車輪 — 坂も登れる、太くて丈夫な車輪。; (2) 記憶チップ — 傷ついた記憶を補う、新品のチップ。; (3) 小さなライト — 暗い場所を照らす、頭に載る灯り。 Row 2 (香り), left to right: (4) 技師の好きな柑橘 — 作り手が毎晩頼んでいた、明るい香り。; (5) 地球の森の香り — 宇宙で恋しくなる、雨上がりの木々の香り。; (6) 倉庫で見つけた古い茶葉 — 昔の合作に使われた、やさしい香り。 Row 3 (ピコに添えるもの), left to right: (7) 技師の声の録音 — 『お前の一台が一番だ』と残された声。; (8) 地球の写真 — 昔の旅人がピコと撮った、青い窓辺の一枚。; (9) 仲間のロボの起動キー — 倉庫で眠る旧型ロボを、起こす鍵。 Row 4 (流星群への手), left to right: (10) 隔壁を閉める — 揺れる区画を区切って、通路を守る。; (11) ピコを抱えて避難する — まずはピコを、揺れの少ない中央区画へ。; (12) 管制AIと航路を計算する — 流星の来る向きを読み、駅の向きを変える。 Row 5 (guesses), left to right: (13) 作り手の技師に、一台を届けたい — 技師が好きだった香りを、言葉と一緒に送れそう。; (14) 地球の見える窓辺で、一台を出したい — 旅人が青い窓を眺めて過ごす時間を、作れそう。; (15) 眠る仲間と、一台を作りたい — 倉庫の旧型ロボを起こせば、二台で作れそう。
```

## 08 試験前夜、消えかけの使い魔（`fading-familiar`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `spell`=0, `item`=1, `call`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-fading-familiar.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (使う呪文), left to right: (1) 灯りの呪文 — やわらかい光で、暗い場所を照らす。; (2) 静けさの呪文 — まわりの音を消して、そっと近づく。; (3) 呼び寄せの呪文 — 呼んだ相手を、声のする方へ引き寄せる。 Row 2 (持っていく道具), left to right: (4) ふわふわ綿菓子 — 購買の夜食。煙みたいに、ふわふわ甘い。; (5) 探し物の羅針盤 — なくした物のある方を、針が指す。; (6) 主人の手紙 — メルが使い魔に書いた、短い手紙。 Row 3 (モヤへの呼びかけ), left to right: (7) 名前を呼ぶ — 消えかけの女の子に、名前でまっすぐ呼びかける。; (8) 一緒に試験の練習をする — 明日の課題を、ここで一緒にやってみる。; (9) 杖を見せる — 主人の杖を掲げて、モヤに見せる。 Row 4 (本の嵐への手), left to right: (10) 本を棚へ帰す呪文 — 一冊ずつ、元の棚の番号を唱えて帰す。; (11) 本の嵐を走り抜ける — 頭を低くして、ページの嵐を一気に進む。; (12) 司書の幽霊に頼む — 夜の図書館を守る、物静かな司書にお願いする。 Row 5 (guesses), left to right: (13) 主人が落ちるのが、怖いのかも — 落ちたら自分が返されると思い、隠れている。; (14) なくした杖を、探しに出たのかも — 消える前の最後の贈り物に、主人の杖を探している。; (15) 名前が、ないのかも — 一度も名前を呼ばれず、形を保てなくなっている。
```

## 09 夜市と狐のお面（`fox-market`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `light`=0, `stall`=1, `farewell`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-fox-market.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (道案内の灯り), left to right: (1) 赤い提灯 — 町の家々の軒先にもさがる、いつもの灯り。; (2) 蛍のかご — 火を使わない、山の小川の小さな灯り。; (3) 風鈴の音 — 灯りの代わりに、ちりんと鳴る音で道を示す。 Row 2 (立ち寄る屋台), left to right: (4) 綿あめ — くるくる回る機械と、甘い匂いの屋台。; (5) 金魚すくい — おきくの屋台。赤い金魚と、古い軒先。; (6) お面屋 — 狐やひょっとこが並ぶ、お面の棚。 Row 3 (別れ方), left to right: (7) 手をつないで送る — 最後まで、手を離さずに歩く。; (8) お土産を渡す — 夜市の思い出を、小さな包みにして持たせる。; (9) 鈴を鳴らす — ちりんと一つ。それを、別れの合図にする。 Row 4 (消えた灯りへの手), left to right: (10) 提灯に火を入れ直す — 灯り番の仕事。一つずつ、通りに灯りを戻す。; (11) 花火の明かりを頼りに進む — 花火が開くたび、少しずつ前へ。; (12) 人混みを誘導する — 声をかけ合い、人の流れを落ち着かせる。 Row 5 (guesses), left to right: (13) 家に帰りたい、迷子の子かも — 家族とはぐれた町の子ども。帰り道を探している。; (14) 屋台を味わいに来た子狐かも — 山から下りてきた子狐。夜市の味を、一度だけ知りたい。; (15) 何かを返しに来た使いかも — ずっと昔に借りたものを、返しに来た狐の使い。
```

## 10 幕の降りない劇場（`stage-ghost`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `staging`=0, `prop`=1, `curtain`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-stage-ghost.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (演出), left to right: (1) スポットライト — 光の輪を二つ、舞台の真ん中へ向ける。; (2) 紙吹雪 — 終幕に、天井の籠から紙吹雪を降らせる。; (3) 静かな月明かり — 灯りを落とし、天窓の月だけで照らす。 Row 2 (小道具), left to right: (4) 古い台本 — 棚に残る、いちばん古い一冊。; (5) 花束 — 終幕に手渡す、一抱えの花束。; (6) 空の客席札 — 三百枚の席札を、客席に一枚ずつ並べる。 Row 3 (幕の下ろし方), left to right: (7) 一緒に演じる — 最後の一場をエルと演じきって、幕を下ろす。; (8) ページを読み上げる — 見つけた台詞を声に出して、幕を下ろす。; (9) みんなで拍手する — 客席から全員で拍手を送り、幕を下ろす。 Row 4 (影の観客への手), left to right: (10) 影の観客を席へ案内する — 通路を歩いて、一人ずつ席へ案内する。; (11) 照明室へ走る — 勝手に回る照明を、操作盤で止める。; (12) 即興で芝居を始める — 舞台に立って、影の観客に一幕を見せる。 Row 5 (guesses), left to right: (13) 最後の一場を、誰かと演じたい — 相手役のいない場面を一緒に演じれば、幕を下ろせそう。; (14) なくした最後のページを見つけたい — 欠けた最後の台詞が見つかれば、幕を下ろせるのかも。; (15) 満員の拍手を、一度聞きたい — 客席が拍手で埋まれば、幕を下ろせそう。
```

## 11 月光花の古城と、終わらないアンコール（`moonflower-encore`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `stage`=0, `scent`=1, `finale`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-moonflower-encore.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (演出), left to right: (1) 薔薇の花びら — 終演の舞台から、客席へ花びらを降らせる。; (2) 蝋燭の灯り — 大広間の明かりを落とし、蝋燭の火だけで照らす。; (3) 霧のスモーク — 床いっぱいに霧を流し、月明かりを浮かび上がらせる。 Row 2 (香り), left to right: (4) 月光花の香り — 夜に開く白い花の、細く甘い香り。; (5) 薔薇と紅茶 — 薔薇の華やかさに、紅茶の渋みを重ねた香り。; (6) 夜の森 — 湿った土と木の葉の、深く落ち着いた香り。 Row 3 (最後の一曲の届け方), left to right: (7) 客席の名前を呼ぶ — 決め台詞の代わりに、客席の一人一人の名前を呼ぶ。; (8) 約束の譜面を渡す — 引き出しの古い譜面を、伯爵の譜面台に置く。; (9) みんなを庭へ連れ出す — 大扉を開けて、客席も楽団も月明かりの庭へ。 Row 4 (コウモリ騒ぎへの手), left to right: (10) 手拍子で落ち着かせる — 暗闇の中、三人で拍子を刻んで客席をまとめる。; (11) 蝋燭を灯し直す — 燭台を一つずつ回り、消えた火を灯していく。; (12) コウモリにも歌を聞かせる — 子守唄を口ずさみ、コウモリたちを眠らせる。 Row 5 (guesses), left to right: (13) 約束の最後の一曲を、まだ弾いていない — 伯爵は昔、誰かと約束した一曲を残しているのかも。; (14) 幽霊たちは、名前を呼んでほしい — 客席のみんなは、ファンとして覚えていてほしいのかも。; (15) 月光花が咲く瞬間を、みんなで見たい — 夜明け前に一度だけ咲く花を、待っているのかも。
```

## 12 盛れない勇者と、プリ帳の魔王（`purikura-hero`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `deco`=0, `light`=1, `pose`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-purikura-hero.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (デコ道具), left to right: (1) スタンプ — キラキラの型を、ぽんと押して飾る。; (2) ペン — 写真に、文字や絵を手書きで描きこむ。; (3) シール — プリ帳に貼れる、交換用のシール。 Row 2 (照明), left to right: (4) リングライト — 顔を明るく、きれいに照らす輪の灯り。; (5) 月明かり — 窓を開けて、やわらかな月の光を入れる。; (6) 花火 — 城の空に、ぱっと大輪の花火を上げる。 Row 3 (決めポーズ), left to right: (7) ハートを作る — 二人で半分ずつ、手でハートを作る。; (8) ピース — 誰でもできる、基本のピースサイン。; (9) サメのポーズ — 両手を頭の上に立てて、ヒレを作る。 Row 4 (ゴーレムへの手), left to right: (10) 笑わせる — 変顔とギャグで、無表情を崩す。; (11) 一緒に写真を撮る — 門番と並んで、記念の一枚を撮ろうと誘う。; (12) こっそり隠れて進む — 堀のサメの背に隠れて、門をくぐる。 Row 5 (guesses), left to right: (13) 一緒に写る友達が、欲しかったのかも — 人を撮るのは、会いに行く口実。本当は、誰かと並んで写りたい。; (14) 自分の写りに、自信がないのかも — みんなの盛りを借りて、自分を盛って写ろうとしている。; (15) なくしたプリ帳を、探しているのかも — 昔なくした思い出のプリ帳を、人を撮りながら探している。
```

## 13 人形館のレクイエム（`doll-requiem`）

- 背景: 済 / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `mend`=0, `tea`=1, `call`=2, `tactic`=3, `hypotheses`=4

```
--- choices atlas: choices-doll-requiem.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (繕い道具), left to right: (1) 糸と針 — ほつれた人形の衣装を、一針ずつ繕う。; (2) 新しいリボン — 人形たちに、おそろいの新しいリボンを結ぶ。; (3) 磨き布 — くもった硝子の瞳を、一体ずつ磨く。 Row 2 (お茶), left to right: (4) ラベンダーと蜂蜜の茶 — 館に伝わる、甘い香りのお茶。; (5) 白い茶 — 雪のように淡い色の、白いお茶。; (6) 温かいミルク — 小さなマグで、温かいミルクを。 Row 3 (人形への呼びかけ), left to right: (7) 人形劇の台本を読む — 残された人形劇の台本を、声に出して読む。; (8) リラを紹介する — リラを人形たちの前に立たせ、新しい主だと伝える。; (9) カーテンを開ける — 館じゅうのカーテンを開け、窓の外を見せる。 Row 4 (停電への手), left to right: (10) オルゴールを一つずつ止める — 廊下を回って、蓋を一つずつ閉じる。; (11) 蝋燭を灯して回る — 燭台に火を移しながら、館を照らして歩く。; (12) 音に合わせて歌う — オルゴールの旋律に、みんなで歌を重ねる。 Row 5 (guesses), left to right: (13) 人形劇の続きを、演じたい — 亡き館主が残した人形劇。その続きを演じれば、落ち着きそう。; (14) 新しい主に、気づいてほしい — 新しい主のリラに気づいてほしい。一緒に遊びたいのかも。; (15) 雪の夜の景色を、見に行きたい — 雪の夜にだけ見える、窓の外の景色を見に行っているのかも。
```

