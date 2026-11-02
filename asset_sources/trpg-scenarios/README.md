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

- 背景: 未生成（いまは backdrop の色で代用） / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `route`=0, `wrap`=1, `handover`=2, `tactic`=3, `hypotheses`=4

```
--- background: trpg_leaf-mail_room.png ---
Finely finished premium visual-novel game background, single landscape 16:9 image (1280x720), wide cinematic composition, carefully painted anime environment concept art with tactile brush detail, restrained colors, high-quality polished indie game art. NO people, NO silhouettes of people, NO hookah/shisha/waterpipe, NO smoking apparatus, NO text, NO logos, NO watermarks, NO UI. Interior or scene must stay well lit and readable. Not a photograph, not a 3D render, not flat vector art. Scene: 大きな月の下の坂の町。郵便鞄、時計塔、屋根の上、川の橋、パン屋の窓、掲示板。 Setting: 時計坂の町 / 月夜の大通り. Mood: 大きな月。石畳に、猫の足音がひとつ。. Fictional place from a tabletop story (絵本ファンタジー). Concrete click-investigation objects, each a distinct readable prop at its position: 郵便鞄 clearly visible around x52% y80%; 時計塔 clearly visible around x20% y24%; 屋根の上 clearly visible around x66% y18%; 川の橋 clearly visible around x86% y66%; パン屋の窓 clearly visible around x14% y64%; 掲示板 clearly visible around x38% y50%. Keep the upper-center area slightly calm for a title. Believable scale and clean perspective.
```

```
--- choices atlas: choices-leaf-mail.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (届ける道), left to right: (1) 屋根の道 — 猫と月だけが知っている、屋根づたいの近道。; (2) 川沿いの道 — 水面の月を追って、川下へ続く長い道。; (3) 坂の階段 — 百段をのぼって、丘の上へ向かう道。 Row 2 (手紙の包み方), left to right: (4) 封蝋 — 赤い封蝋に月の印。昔ながらの、きちんとした手紙。; (5) 押し花 — 丘の青い花を一輪。景色ごと届ける。; (6) 小さな鈴 — 封筒の角で、ちりんと鳴る。誰からか、音で分かる。 Row 3 (渡し方), left to right: (7) 手渡し — 顔を見て、まっすぐ渡す。; (8) 窓辺にそっと置く — 起こさないように。朝、見つけてもらう。; (9) 歌と一緒に — ミトンの歌を添えて、手紙を渡す。 Row 4 (手紙を追う手), left to right: (10) 走って追いかける — 坂を駆けて、落ちてくるところを待つ。; (11) 凧で捕まえる — 詰所の古い凧を上げ、風ごとすくう。; (12) 夜の鳥に頼む — 時計塔のふくろうに、ひと声かける。 Row 5 (guesses), left to right: (13) 丘の灯台守へ — 毎晩、町に灯りをともすおじいさんへの手紙。; (14) 引っ越した子へ — 遠くの町へ越していった子どもへの手紙。; (15) ミトンを描いた人へ — ミトン自身が書いた、絵描きへのお礼の手紙。
```

```
--- portraits: portraits-leaf-mail.png ---
Generate ONE sprite sheet image, 2048x1024, transparent background (PNG), containing 8 circular character portrait medallions in a 4x2 grid (4 columns, 2 rows), each medallion 460x460 px with even spacing and a transparent margin inside every cell. Style: painterly storybook ink-and-watercolor bust portrait, soft lamplight, muted palette matching the story's world, consistent across all eight. Shoulders-up, facing slightly left, readable face. No text, no numbers, no logos, no frames (the game draws the round frame), no watermark, no shisha pipes, no real brands, no resemblance to any existing character. World: 時計坂の町 / 月夜の大通り (絵本ファンタジー): 大きな月。石畳に、猫の足音がひとつ。
Row 1 = the player's character, four looks of the same role. Androgynous young adult (18-24) so the player can give any name; the look must not depend on background or name:
--- a: look-leaf-mail-lantern --- ランタンの夜番. 短い黒髪に、紺の外套とランタン
--- b: look-leaf-mail-scarf --- マフラーの夜番. 長いマフラーと、星柄の手袋
--- c: look-leaf-mail-cap --- 帽子の夜番. つばの広い帽子に、月の徽章
--- d: look-leaf-mail-glasses --- 眼鏡の夜番. 丸眼鏡と、地図の入った肩かけ鞄
Row 2 = characters the companions made for this story. Light comedy is welcome, keep faces readable:
--- e: pc-yura --- ユラ, 灯りともし. か細い声の灯りともし。梯子をのぼるのは町一番速い Likes: 屋台の夜鳴きラーメン
--- f: pc-neri --- ネリ, 風見の見習い. 風が吹くと倒れそう。……斧投げで鍛えた腕は、びくともしない Likes: 斧投げ。ゆるい顔の猫のお守り
--- g: pc-leon --- レオン, 鐘つき. 時計塔の鐘をつく。鐘の音と同じくらい、言葉も大きい Likes: 林檎の砂糖煮。甘さの原点
--- h: pc-gran --- グラン, 旅の天文学者. 月を測りに来た。宇宙の話は、必ず林檎から始まる Likes: 二つ並んだ林檎。宇宙の原点
```

## 04 怪盗と原点の林檎（`apple-thief`）

- 背景: 未生成（いまは backdrop の色で代用） / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `trap`=0, `post`=1, `confront`=2, `tactic`=3, `hypotheses`=4

```
--- background: trpg_apple-thief_room.png ---
Finely finished premium visual-novel game background, single landscape 16:9 image (1280x720), wide cinematic composition, carefully painted anime environment concept art with tactile brush detail, restrained colors, high-quality polished indie game art. NO people, NO silhouettes of people, NO hookah/shisha/waterpipe, NO smoking apparatus, NO text, NO logos, NO watermarks, NO UI. Interior or scene must stay well lit and readable. Not a photograph, not a 3D render, not flat vector art. Scene: 湖畔の館の夜会。書斎の配合帳、温室の林檎の木、大広間の肖像画、厨房の香りの棚、玄関の予告状、主人の椅子。 Setting: ミルト湖畔 / 白林檎館. Mood: 燭台の灯り。林檎の香り。どこかに、怪盗。. Fictional place from a tabletop story (館の怪盗もの / 謎解き). Concrete click-investigation objects, each a distinct readable prop at its position: 書斎の配合帳 clearly visible around x14% y26%; 温室の林檎の木 clearly visible around x82% y24%; 大広間の肖像画 clearly visible around x47% y18%; 厨房の香りの棚 clearly visible around x18% y70%; 玄関の予告状 clearly visible around x50% y82%; 主人の椅子 clearly visible around x76% y62%. Keep the upper-center area slightly calm for a title. Believable scale and clean perspective.
```

```
--- choices atlas: choices-apple-thief.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (仕掛け), left to right: (1) 鈴の糸 — 通り道に糸を張り、怪盗が来たら鈴が鳴る。; (2) 偽の配合帳 — よく似た帳面を置き、怪盗を書斎へ誘う。; (3) 林檎の香りの道しるべ — 原点の香りを少しずつ置き、温室まで導く。 Row 2 (張り込む場所), left to right: (4) 書斎 — 配合帳のある部屋で、静かに待つ。; (5) 温室 — 林檎の木の下で、二つの椅子と待つ。; (6) 大広間 — 主人の椅子が見える場所で、客に紛れて待つ。 Row 3 (怪盗への向き合い方), left to right: (7) 捕まえる — 逃げ道をふさぎ、正面からそっと手を取る。; (8) 話を聞く — 仮面のままの怪盗の言い分に、耳を傾ける。; (9) 一台を勧める — 原点の香りの一台を用意して、席に招く。 Row 4 (騒ぎへの手), left to right: (10) 客を落ち着かせる — 飲み物を配り、夜会を元の空気に戻す。; (11) 騒ぎを利用する — 人の流れに紛れて、館の裏を見張る。; (12) 予告状を調べる — 二通目のカードから、怪盗の手がかりを探す。 Row 5 (guesses), left to right: (13) 配合帳を、弟子に返したい — 狙いは配合帳。本来の持ち主に届けるつもりかも。; (14) もう一度、主人と一台を囲みたい — 原点の香りを、誰かと分け合いたいのかも。; (15) 謝りの手紙を届けたい — 盗むかわりに、何かを置いていくつもりかも。
```

```
--- portraits: portraits-apple-thief.png ---
Generate ONE sprite sheet image, 2048x1024, transparent background (PNG), containing 8 circular character portrait medallions in a 4x2 grid (4 columns, 2 rows), each medallion 460x460 px with even spacing and a transparent margin inside every cell. Style: painterly storybook ink-and-watercolor bust portrait, soft lamplight, muted palette matching the story's world, consistent across all eight. Shoulders-up, facing slightly left, readable face. No text, no numbers, no logos, no frames (the game draws the round frame), no watermark, no shisha pipes, no real brands, no resemblance to any existing character. World: ミルト湖畔 / 白林檎館 (館の怪盗もの / 謎解き): 燭台の灯り。林檎の香り。どこかに、怪盗。
Row 1 = the player's character, four looks of the same role. Androgynous young adult (18-24) so the player can give any name; the look must not depend on background or name:
--- a: look-apple-thief-cap --- 黒髪のベルボーイ. 短い黒髪に、赤い制帽
--- b: look-apple-thief-glove --- 栗毛の給仕. 栗色の髪を後ろでまとめ、白い手袋
--- c: look-apple-thief-bowtie --- 眼鏡の給仕. 丸い眼鏡に、林檎色の蝶ネクタイ
--- d: look-apple-thief-tail --- 長髪の給仕. 長い髪を一つに結び、黒い燕尾服
Row 2 = characters the companions made for this story. Light comedy is welcome, keep faces readable:
--- e: pc-rosa --- ローザ, 儚げな客室係. 月の光でも溶けそうな客室係。シーツ替えは、館で一番速い Likes: 夜食のラーメンと、ゆるい熊のぬいぐるみ
--- f: pc-marta --- マルタ, か弱いメイド長. か弱いメイド長……のはず。薪割りの斧さばきは、館の誰より正確 Likes: 斧投げと、夜食のラーメン
--- g: pc-shion --- シオン, 似顔絵係. 一度見た顔は忘れない。話すより、描く方が早い Likes: 葉っぱの耳の猫と、ラベンダーの香り
--- h: pc-nocto --- ノクト, 黒幕っぽい案内係. 怪しくない。たぶん。地下室の鍵だけ、なぜか持っている Likes: 推理小説の最後の頁と、ラベンダー
```

## 05 サメ島の宝の地図（`shark-island`）

- 背景: 未生成（いまは backdrop の色で代用） / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `gear`=0, `landing`=1, `offer`=2, `tactic`=3, `hypotheses`=4

```
--- background: trpg_shark-island_room.png ---
Finely finished premium visual-novel game background, single landscape 16:9 image (1280x720), wide cinematic composition, carefully painted anime environment concept art with tactile brush detail, restrained colors, high-quality polished indie game art. NO people, NO silhouettes of people, NO hookah/shisha/waterpipe, NO smoking apparatus, NO text, NO logos, NO watermarks, NO UI. Interior or scene must stay well lit and readable. Not a photograph, not a 3D render, not flat vector art. Scene: 南の島の入り江。地図を広げた岩、王冠の台座、落書きの岩壁、青い水面、古い錨、砂浜の足跡。水の下に大きなサメの影。 Setting: トビウオ諸島 / サメ島の入り江. Mood: 青く澄んだ入り江。白い砂。水の下に、大きな影。. Fictional place from a tabletop story (海賊の冒険). Concrete click-investigation objects, each a distinct readable prop at its position: 宝の地図 clearly visible around x14% y24%; 王冠の台座 clearly visible around x78% y20%; 船乗りの落書き clearly visible around x40% y34%; 入り江の水面 clearly visible around x56% y62%; 古い錨 clearly visible around x85% y60%; 砂浜の足跡 clearly visible around x24% y79%. Keep the upper-center area slightly calm for a title. Believable scale and clean perspective.
```

```
--- choices atlas: choices-shark-island.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (船の装備), left to right: (1) 錨と網 — 沈んだ宝箱を、網ごと引き上げる。; (2) 太鼓と笛 — 船の楽器で、昔の歌を奏でる。; (3) 帆布の日よけ — 入り江に影を作り、静かに過ごせるようにする。 Row 2 (上陸地点), left to right: (4) 北の岩場 — 台座のすぐそば。足場は滑りやすい。; (5) 砂浜 — 柔らかい砂で、足音が立たない。; (6) 洞窟の入口 — 声がよく響き、入り江の奥まで届く。 Row 3 (王への差し出し方), left to right: (7) 宝を返す — 宝箱を開け、王のものを王に返す。; (8) 歌って聞かせる — あの夜の舟歌を、入り江に響かせる。; (9) そっと立ち去る — 何も起こさず、静かに入り江を離れる。 Row 4 (スコールへの手), left to right: (10) 帆をたたむ — 風を受けすぎないよう、帆を下ろす。; (11) 岩陰に逃げ込む — 大きな岩の陰で、雨風をやり過ごす。; (12) ロープで舟をつなぐ — 岸の岩に舟をつなぎ、流されないようにする。 Row 5 (guesses), left to right: (13) なくした王冠を取り戻したい — 冠を台座に返せば、王の機嫌が直りそう。; (14) 昔の舟歌を、もう一度聞きたい — あの夜の歌を聞かせれば、喜んでくれそう。; (15) 宝の上で、静かに昼寝したい — 起こさずに済ませるのが、いちばんかも。
```

```
--- portraits: portraits-shark-island.png ---
Generate ONE sprite sheet image, 2048x1024, transparent background (PNG), containing 8 circular character portrait medallions in a 4x2 grid (4 columns, 2 rows), each medallion 460x460 px with even spacing and a transparent margin inside every cell. Style: painterly storybook ink-and-watercolor bust portrait, soft lamplight, muted palette matching the story's world, consistent across all eight. Shoulders-up, facing slightly left, readable face. No text, no numbers, no logos, no frames (the game draws the round frame), no watermark, no shisha pipes, no real brands, no resemblance to any existing character. World: トビウオ諸島 / サメ島の入り江 (海賊の冒険): 青く澄んだ入り江。白い砂。水の下に、大きな影。
Row 1 = the player's character, four looks of the same role. Androgynous young adult (18-24) so the player can give any name; the look must not depend on background or name:
--- a: look-shark-island-bandana --- バンダナの水夫. 赤いバンダナと、縞のシャツ
--- b: look-shark-island-brim --- 日よけ帽の水夫. つばの広い帽子と、日焼けした腕
--- c: look-shark-island-tricorn --- 三角帽の水夫. 古い三角帽と、継ぎはぎの上着
--- d: look-shark-island-braid --- 三つ編みの水夫. 潮風に揺れる三つ編みと、青い腰布
Row 2 = characters the companions made for this story. Light comedy is welcome, keep faces readable:
--- e: pc-ruri --- ルリ, か弱い船医. 潮風に当たると倒れそう……な船医。薬箱は誰より重い Likes: 港の屋台の、背脂多めのラーメン
--- f: pc-nerine --- ネリネ, 斧投げの見張り番. 風に飛ばされそうな見張り番。なのに、手斧は百発百中 Likes: 斧投げと、ゆるいカモメのぬいぐるみ
--- g: pc-doran --- ドラン, 口上の副船長. 名言なら百は持っている。半分は、その場で作った Likes: 林檎の樽。宇宙はあの香りから始まった
--- h: pc-jiruba --- ジルバ, 仕掛け好きの奇術水夫. 樽から現れ、樽へ消える。船は大きな舞台装置だ Likes: どんでん返しの扉と、林檎の香り
```

## 06 朝霧の王国と、最後の一台（`mist-kingdom`）

- 背景: 未生成（いまは backdrop の色で代用） / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `flavor`=0, `place`=1, `words`=2, `tactic`=3, `hypotheses`=4

```
--- background: trpg_mist-kingdom_room.png ---
Finely finished premium visual-novel game background, single landscape 16:9 image (1280x720), wide cinematic composition, carefully painted anime environment concept art with tactile brush detail, restrained colors, high-quality polished indie game art. NO people, NO silhouettes of people, NO hookah/shisha/waterpipe, NO smoking apparatus, NO text, NO logos, NO watermarks, NO UI. Interior or scene must stay well lit and readable. Not a photograph, not a 3D render, not flat vector art. Scene: 霧に包まれた王宮の広間。玉座、王妃の肖像、霧の窓、審査員席、香り棚と、薄れかけた回廊。 Setting: 朝霧の王国 / 霧の王宮. Mood: 白い霧。薄れていく回廊。小さな王女の、透けそうな笑顔。. Fictional place from a tabletop story (剣と魔法 / 霧の選手権). Concrete click-investigation objects, each a distinct readable prop at its position: 玉座 clearly visible around x50% y28%; 王妃の肖像 clearly visible around x20% y24%; 霧の窓 clearly visible around x82% y22%; 審査員席 clearly visible around x30% y60%; 王宮の香り棚 clearly visible around x70% y58%; 消えかけの回廊 clearly visible around x14% y82%. Keep the upper-center area slightly calm for a title. Believable scale and clean perspective.
```

```
--- choices atlas: choices-mist-kingdom.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (香り), left to right: (1) 王妃の庭の花 — 王女が生まれた庭に咲く、白い花の香り。; (2) 霧の果実 — 朝霧の中で熟す果実。ゆっくり長く香る。; (3) 王女の合わせた茶 — 王女が自分で合わせた、やさしい茶の香り。 Row 2 (一台を置く場所), left to right: (4) 王妃の庭 — 王女が生まれた、小さな花の庭。; (5) 朝霧のバルコニー — 城下を見渡せる、霧のいちばん濃い場所。; (6) 選手権の舞台 — 王国じゅうの人が見守る、選手権の真ん中。 Row 3 (王女に添える言葉), left to right: (7) 思い出を聞く — 王女が話したいことを、急がず聞く。; (8) 夜明けまで隣にいる — 霧が晴れるその時まで、そばにいる。; (9) 作り方を教わる — 王女の一台の作り方を、霧の外へ持ち帰る。 Row 4 (晴れていく霧への手), left to right: (10) 鐘を鳴らして霧を呼び戻す — 塔の古い鐘。その音は霧を呼ぶと言われる。; (11) 消える前に急いで仕上げる — 迷う時間を削って、手を止めずに進める。; (12) 王女を霧の濃い場所へ案内する — 霧の残る奥の間へ、小さな手を引いていく。 Row 5 (guesses), left to right: (13) 生まれた庭の香りを、もう一度かぎたい — 王女が生まれた庭の香りを、その庭で届ければよさそう。; (14) 霧が晴れるまで、誰かに隣にいてほしい — 長く香る一台で、最後の朝を一緒に過ごせばよさそう。; (15) 誰かに、自分を覚えていてほしい — 霧の外へ持ち帰れるものを、皆の前で受け取ればよさそう。
```

```
--- portraits: portraits-mist-kingdom.png ---
Generate ONE sprite sheet image, 2048x1024, transparent background (PNG), containing 8 circular character portrait medallions in a 4x2 grid (4 columns, 2 rows), each medallion 460x460 px with even spacing and a transparent margin inside every cell. Style: painterly storybook ink-and-watercolor bust portrait, soft lamplight, muted palette matching the story's world, consistent across all eight. Shoulders-up, facing slightly left, readable face. No text, no numbers, no logos, no frames (the game draws the round frame), no watermark, no shisha pipes, no real brands, no resemblance to any existing character. World: 朝霧の王国 / 霧の王宮 (剣と魔法 / 霧の選手権): 白い霧。薄れていく回廊。小さな王女の、透けそうな笑顔。
Row 1 = the player's character, four looks of the same role. Androgynous young adult (18-24) so the player can give any name; the look must not depend on background or name:
--- a: look-mist-kingdom-ink --- 黒髪の出場者. 短い黒髪に、借り物の礼服
--- b: look-mist-kingdom-silver --- 銀髪の出場者. 霧に溶けそうな銀髪と、灰色の外套
--- c: look-mist-kingdom-auburn --- 赤毛の出場者. 赤毛を一つに結び、番号札を胸に
--- d: look-mist-kingdom-dawn --- 長髪の出場者. 肩までの髪と、朝焼け色のスカーフ
Row 2 = characters the companions made for this story. Light comedy is welcome, keep faces readable:
--- e: pc-orchard --- オルド, 林檎の紋章の騎士. 選手権の常連。毎回、林檎の香りで勝負する。腕は本物 Likes: 林檎。この宇宙の最初の一個
--- f: pc-grants --- グランツ, 自称・前回王者. 前回の選手権の王者を名乗る。前回が本当にあったかは、誰も知らない Likes: 表彰台の真ん中と、林檎の香り
--- g: pc-koban --- コバン, 会場見物の大工. 選手権には興味がない。王宮の椅子と通路を見に来ただけ Likes: 座り心地のいい椅子と、サメの彫り物
--- h: pc-sharuku --- シャルク, 霧のサメ研究家. 王宮の堀にサメがいると信じて出場した。選手権は、ついで Likes: サメの出る話。怖い場面は、目を細めて見る
```

## 07 星の駅の煙職人ロボ（`smoke-robot`）

- 背景: 未生成（いまは backdrop の色で代用） / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `part`=0, `flavor`=1, `gift`=2, `tactic`=3, `hypotheses`=4

```
--- background: trpg_smoke-robot_room.png ---
Finely finished premium visual-novel game background, single landscape 16:9 image (1280x720), wide cinematic composition, carefully painted anime environment concept art with tactile brush detail, restrained colors, high-quality polished indie game art. NO people, NO silhouettes of people, NO hookah/shisha/waterpipe, NO smoking apparatus, NO text, NO logos, NO watermarks, NO UI. Interior or scene must stay well lit and readable. Not a photograph, not a 3D render, not flat vector art. Scene: 軌道の休憩所。作業台、展望デッキの窓、倉庫の扉、通信室、整備士のメモと失敗作の山。窓の外に青い地球。 Setting: 地球周回軌道 / 星の駅ポラリス. Mood: 夜間モードの灯り。通路の奥で、小さなビープ音。. Fictional place from a tabletop story (SF / ロボと一台). Concrete click-investigation objects, each a distinct readable prop at its position: ピコの作業台 clearly visible around x50% y64%; 展望デッキの窓 clearly visible around x76% y22%; 倉庫の扉 clearly visible around x89% y66%; 通信室の記録 clearly visible around x14% y24%; 整備士のメモ clearly visible around x20% y72%; 失敗した一台の山 clearly visible around x44% y34%. Keep the upper-center area slightly calm for a title. Believable scale and clean perspective.
```

```
--- choices atlas: choices-smoke-robot.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (修理パーツ), left to right: (1) 新しい車輪 — 坂も登れる、太くて丈夫な車輪。; (2) 記憶チップ — 傷ついた記憶を補う、新品のチップ。; (3) 小さなライト — 暗い場所を照らす、頭に載る灯り。 Row 2 (香り), left to right: (4) 技師の好きな柑橘 — 作り手が毎晩頼んでいた、明るい香り。; (5) 地球の森の香り — 宇宙で恋しくなる、雨上がりの木々の香り。; (6) 倉庫で見つけた古い茶葉 — 昔の合作に使われた、やさしい香り。 Row 3 (ピコに添えるもの), left to right: (7) 技師の声の録音 — 『お前の一台が一番だ』と残された声。; (8) 地球の写真 — 昔の旅人がピコと撮った、青い窓辺の一枚。; (9) 仲間のロボの起動キー — 倉庫で眠る旧型ロボを、起こす鍵。 Row 4 (流星群への手), left to right: (10) 隔壁を閉める — 揺れる区画を区切って、通路を守る。; (11) ピコを抱えて避難する — まずはピコを、揺れの少ない中央区画へ。; (12) 管制AIと航路を計算する — 流星の来る向きを読み、駅の向きを変える。 Row 5 (guesses), left to right: (13) 作り手の技師に、一台を届けたい — 技師が好きだった香りを、言葉と一緒に送れそう。; (14) 地球の見える窓辺で、一台を出したい — 旅人が青い窓を眺めて過ごす時間を、作れそう。; (15) 眠る仲間と、一台を作りたい — 倉庫の旧型ロボを起こせば、二台で作れそう。
```

```
--- portraits: portraits-smoke-robot.png ---
Generate ONE sprite sheet image, 2048x1024, transparent background (PNG), containing 8 circular character portrait medallions in a 4x2 grid (4 columns, 2 rows), each medallion 460x460 px with even spacing and a transparent margin inside every cell. Style: painterly storybook ink-and-watercolor bust portrait, soft lamplight, muted palette matching the story's world, consistent across all eight. Shoulders-up, facing slightly left, readable face. No text, no numbers, no logos, no frames (the game draws the round frame), no watermark, no shisha pipes, no real brands, no resemblance to any existing character. World: 地球周回軌道 / 星の駅ポラリス (SF / ロボと一台): 夜間モードの灯り。通路の奥で、小さなビープ音。
Row 1 = the player's character, four looks of the same role. Androgynous young adult (18-24) so the player can give any name; the look must not depend on background or name:
--- a: look-smoke-robot-ink --- 黒髪の夜番. 短い黒髪に、紺の作業着
--- b: look-smoke-robot-silver --- 銀髪の夜番. ふわりと跳ねた銀髪と、反射板つきの上着
--- c: look-smoke-robot-rust --- 赤毛の夜番. 赤毛をゴーグルで押さえる
--- d: look-smoke-robot-helmet --- ヘルメットの夜番. いつも外さない、丸いヘルメット
Row 2 = characters the companions made for this story. Light comedy is welcome, keep faces readable:
--- e: pc-nova --- ノヴァ, 香りの航海士. 香りの配合なら駅一番。名言の前に、少し間を取る Likes: 林檎の香り。宇宙の始まりの味
--- f: pc-cosmo --- コスモ, 原点を探す宇宙飛行士. 宇宙は一つの林檎から始まったと、本気で信じている。腕は確か Likes: ダブルアップル。宇宙の原点
--- g: pc-luna --- ルナ, 展望デッキの記録係. よく見て、よく描く。宇宙でも口数は少ない Likes: ラベンダー色の星雲と、描きかけのスケッチ
--- h: pc-konoha --- コノハ, 猫連れの密航者. 貨物の箱から出てきて、そのまま夜番に雇われた。猫も一緒 Likes: 葉っぱの耳の猫と、ラベンダーの匂いの毛布
```

## 08 試験前夜、消えかけの使い魔（`fading-familiar`）

- 背景: 未生成（いまは backdrop の色で代用） / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `spell`=0, `item`=1, `call`=2, `tactic`=3, `hypotheses`=4

```
--- background: trpg_fading-familiar_room.png ---
Finely finished premium visual-novel game background, single landscape 16:9 image (1280x720), wide cinematic composition, carefully painted anime environment concept art with tactile brush detail, restrained colors, high-quality polished indie game art. NO people, NO silhouettes of people, NO hookah/shisha/waterpipe, NO smoking apparatus, NO text, NO logos, NO watermarks, NO UI. Interior or scene must stay well lit and readable. Not a photograph, not a 3D render, not flat vector art. Scene: 夜の魔法学校。空っぽの寝床、図書館の窓、薬草園、天文台の階段、掲示板の試験表、廊下の煙の跡。 Setting: 星見ヶ丘魔法学校 / 夜の寮と校舎. Mood: 試験前夜の静かな校舎。夜明けまで、あと少し。. Fictional place from a tabletop story (学園ファンタジー・儚さ). Concrete click-investigation objects, each a distinct readable prop at its position: 空っぽの寝床 clearly visible around x15% y30%; 図書館の窓 clearly visible around x80% y24%; 薬草園 clearly visible around x86% y70%; 天文台の階段 clearly visible around x52% y20%; 掲示板の試験表 clearly visible around x20% y72%; 廊下に残る煙の跡 clearly visible around x52% y82%. Keep the upper-center area slightly calm for a title. Believable scale and clean perspective.
```

```
--- choices atlas: choices-fading-familiar.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (使う呪文), left to right: (1) 灯りの呪文 — やわらかい光で、暗い場所を照らす。; (2) 静けさの呪文 — まわりの音を消して、そっと近づく。; (3) 呼び寄せの呪文 — 呼んだ相手を、声のする方へ引き寄せる。 Row 2 (持っていく道具), left to right: (4) ふわふわ綿菓子 — 購買の夜食。煙みたいに、ふわふわ甘い。; (5) 探し物の羅針盤 — なくした物のある方を、針が指す。; (6) 主人の手紙 — メルが使い魔に書いた、短い手紙。 Row 3 (モヤへの呼びかけ), left to right: (7) 名前を呼ぶ — 消えかけの女の子に、名前でまっすぐ呼びかける。; (8) 一緒に試験の練習をする — 明日の課題を、ここで一緒にやってみる。; (9) 杖を見せる — 主人の杖を掲げて、モヤに見せる。 Row 4 (本の嵐への手), left to right: (10) 本を棚へ帰す呪文 — 一冊ずつ、元の棚の番号を唱えて帰す。; (11) 本の嵐を走り抜ける — 頭を低くして、ページの嵐を一気に進む。; (12) 司書の幽霊に頼む — 夜の図書館を守る、物静かな司書にお願いする。 Row 5 (guesses), left to right: (13) 主人が落ちるのが、怖いのかも — 落ちたら自分が返されると思い、隠れている。; (14) なくした杖を、探しに出たのかも — 消える前の最後の贈り物に、主人の杖を探している。; (15) 名前が、ないのかも — 一度も名前を呼ばれず、形を保てなくなっている。
```

```
--- portraits: portraits-fading-familiar.png ---
Generate ONE sprite sheet image, 2048x1024, transparent background (PNG), containing 8 circular character portrait medallions in a 4x2 grid (4 columns, 2 rows), each medallion 460x460 px with even spacing and a transparent margin inside every cell. Style: painterly storybook ink-and-watercolor bust portrait, soft lamplight, muted palette matching the story's world, consistent across all eight. Shoulders-up, facing slightly left, readable face. No text, no numbers, no logos, no frames (the game draws the round frame), no watermark, no shisha pipes, no real brands, no resemblance to any existing character. World: 星見ヶ丘魔法学校 / 夜の寮と校舎 (学園ファンタジー・儚さ): 試験前夜の静かな校舎。夜明けまで、あと少し。
Row 1 = the player's character, four looks of the same role. Androgynous young adult (18-24) so the player can give any name; the look must not depend on background or name:
--- a: look-fading-familiar-ink --- 黒髪の上級生. 短い黒髪に、紺のローブ
--- b: look-fading-familiar-silver --- 銀髪の上級生. 肩までの銀髪に、星の刺繍のマント
--- c: look-fading-familiar-ember --- 赤毛の上級生. 跳ねた赤毛と、呪文で焦げた袖
--- d: look-fading-familiar-owl --- 眼鏡の上級生. 丸眼鏡と、ふくろう色のベスト
Row 2 = characters the companions made for this story. Light comedy is welcome, keep faces readable:
--- e: pc-hirena --- ヒレナ, サメ召喚の三年生. どんな呪文を唱えても、サメが来る。陸ではちょっと困る Likes: サメの出る映画。夜ふかしの上映会
--- f: pc-fukami --- フカミ, 空飛ぶサメの飼育係. 学校の空を泳ぐサメの世話係。サメの機嫌は、天気でわかる Likes: 大きいサメ。とにかく大きいサメ
--- g: pc-mars --- マルス, 林檎ひとすじの錬金術師. 何を錬成しても林檎になる。腕は学年一 Likes: ダブルアップル。宇宙の始まりの香り
--- h: pc-nox --- ノクス, 仮面の転校生. 正体不明の謎の転校生。仮面の下は、だいたいみんな知っている Likes: 林檎と、登場の効果音
```

## 09 夜市と狐のお面（`fox-market`）

- 背景: 未生成（いまは backdrop の色で代用） / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `light`=0, `stall`=1, `farewell`=2, `tactic`=3, `hypotheses`=4

```
--- background: trpg_fox-market_room.png ---
Finely finished premium visual-novel game background, single landscape 16:9 image (1280x720), wide cinematic composition, carefully painted anime environment concept art with tactile brush detail, restrained colors, high-quality polished indie game art. NO people, NO silhouettes of people, NO hookah/shisha/waterpipe, NO smoking apparatus, NO text, NO logos, NO watermarks, NO UI. Interior or scene must stay well lit and readable. Not a photograph, not a 3D render, not flat vector art. Scene: 夏祭りの夜市。お面屋の棚、金魚すくいの水槽、神社の鳥居、綿あめの屋台、落ちていた鈴、迷子案内の掲示板。 Setting: 灯籠通り / 夏の夜市. Mood: 提灯の列と、遠い太鼓。お面の子が、ひとり。. Fictional place from a tabletop story (和の不思議). Concrete click-investigation objects, each a distinct readable prop at its position: お面屋の棚 clearly visible around x15% y30%; 金魚すくいの水槽 clearly visible around x30% y76%; 神社の鳥居 clearly visible around x80% y22%; 綿あめの屋台 clearly visible around x50% y42%; 落ちていた鈴 clearly visible around x63% y84%; 迷子案内の掲示板 clearly visible around x89% y63%. Keep the upper-center area slightly calm for a title. Believable scale and clean perspective.
```

```
--- choices atlas: choices-fox-market.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (道案内の灯り), left to right: (1) 赤い提灯 — 町の家々の軒先にもさがる、いつもの灯り。; (2) 蛍のかご — 火を使わない、山の小川の小さな灯り。; (3) 風鈴の音 — 灯りの代わりに、ちりんと鳴る音で道を示す。 Row 2 (立ち寄る屋台), left to right: (4) 綿あめ — くるくる回る機械と、甘い匂いの屋台。; (5) 金魚すくい — おきくの屋台。赤い金魚と、古い軒先。; (6) お面屋 — 狐やひょっとこが並ぶ、お面の棚。 Row 3 (別れ方), left to right: (7) 手をつないで送る — 最後まで、手を離さずに歩く。; (8) お土産を渡す — 夜市の思い出を、小さな包みにして持たせる。; (9) 鈴を鳴らす — ちりんと一つ。それを、別れの合図にする。 Row 4 (消えた灯りへの手), left to right: (10) 提灯に火を入れ直す — 灯り番の仕事。一つずつ、通りに灯りを戻す。; (11) 花火の明かりを頼りに進む — 花火が開くたび、少しずつ前へ。; (12) 人混みを誘導する — 声をかけ合い、人の流れを落ち着かせる。 Row 5 (guesses), left to right: (13) 家に帰りたい、迷子の子かも — 家族とはぐれた町の子ども。帰り道を探している。; (14) 屋台を味わいに来た子狐かも — 山から下りてきた子狐。夜市の味を、一度だけ知りたい。; (15) 何かを返しに来た使いかも — ずっと昔に借りたものを、返しに来た狐の使い。
```

```
--- portraits: portraits-fox-market.png ---
Generate ONE sprite sheet image, 2048x1024, transparent background (PNG), containing 8 circular character portrait medallions in a 4x2 grid (4 columns, 2 rows), each medallion 460x460 px with even spacing and a transparent margin inside every cell. Style: painterly storybook ink-and-watercolor bust portrait, soft lamplight, muted palette matching the story's world, consistent across all eight. Shoulders-up, facing slightly left, readable face. No text, no numbers, no logos, no frames (the game draws the round frame), no watermark, no shisha pipes, no real brands, no resemblance to any existing character. World: 灯籠通り / 夏の夜市 (和の不思議): 提灯の列と、遠い太鼓。お面の子が、ひとり。
Row 1 = the player's character, four looks of the same role. Androgynous young adult (18-24) so the player can give any name; the look must not depend on background or name:
--- a: look-fox-market-indigo --- 紺の法被の灯り番. 短い黒髪に、紺の法被
--- b: look-fox-market-ash --- 灰色の髪の灯り番. 伸びた灰色の髪を、手ぬぐいでまとめる
--- c: look-fox-market-rust --- 赤茶の髪の灯り番. 日に焼けた肌と、赤茶の癖毛に鉢巻き
--- d: look-fox-market-moss --- 眼鏡の灯り番. 丸眼鏡と、苔色の浴衣
Row 2 = characters the companions made for this story. Light comedy is welcome, keep faces readable:
--- e: pc-kasumi --- カスミ, 霞の灯り番. 夜風にも消えそうな灯り番……のはず。ラーメンの匂いには負けない Likes: 屋台のラーメン。湯気の向こうの提灯
--- f: pc-shizuku --- シズク, 茶屋の看板娘. 体の弱い看板娘……のはず。的当てでは百発百中 Likes: 斧投げと、ゆるい狐のお面。締めのラーメン
--- g: pc-namimaru --- ナミマル, 夜店の用心棒. 腕っぷしと度胸は一人前。暗いところは、ちと苦手 Likes: サメ柄の手ぬぐい。夜の海のサメ映画
--- h: pc-fukajiro --- フカジロウ, サメ待ちの釣り人. 金魚すくいの水槽で、本気でサメを待っている。腕は確か Likes: サメ映画と、いちばん大きなポイ
```

## 10 幕の降りない劇場（`stage-ghost`）

- 背景: 未生成（いまは backdrop の色で代用） / 選択肢の絵: 未生成（いまは文字のカードで代用）
- 行番号: `staging`=0, `prop`=1, `curtain`=2, `tactic`=3, `hypotheses`=4

```
--- background: trpg_stage-ghost_room.png ---
Finely finished premium visual-novel game background, single landscape 16:9 image (1280x720), wide cinematic composition, carefully painted anime environment concept art with tactile brush detail, restrained colors, high-quality polished indie game art. NO people, NO silhouettes of people, NO hookah/shisha/waterpipe, NO smoking apparatus, NO text, NO logos, NO watermarks, NO UI. Interior or scene must stay well lit and readable. Not a photograph, not a 3D render, not flat vector art. Scene: 閉館した劇場。舞台の幕、楽屋の鏡、照明室、客席の最前列、台本の棚、劇場の掲示。空の舞台に淡い人影。 Setting: 港坂 / 閉館した劇場「月灯座」. Mood: 赤い幕。三百の空席。夜明けまで、あと少し。. Fictional place from a tabletop story (やさしい幽霊劇). Concrete click-investigation objects, each a distinct readable prop at its position: 舞台の幕 clearly visible around x50% y46%; 楽屋の鏡 clearly visible around x12% y30%; 照明室 clearly visible around x88% y22%; 客席の最前列 clearly visible around x50% y80%; 台本の棚 clearly visible around x16% y66%; 劇場の掲示 clearly visible around x84% y62%. Keep the upper-center area slightly calm for a title. Believable scale and clean perspective.
```

```
--- choices atlas: choices-stage-ghost.png ---
Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. Not flat UI icons, not photorealistic, no people's faces, no text. Paint each item as an evocative object or tiny diorama (no people's faces). Row 1 (演出), left to right: (1) スポットライト — 光の輪を二つ、舞台の真ん中へ向ける。; (2) 紙吹雪 — 終幕に、天井の籠から紙吹雪を降らせる。; (3) 静かな月明かり — 灯りを落とし、天窓の月だけで照らす。 Row 2 (小道具), left to right: (4) 古い台本 — 棚に残る、いちばん古い一冊。; (5) 花束 — 終幕に手渡す、一抱えの花束。; (6) 空の客席札 — 三百枚の席札を、客席に一枚ずつ並べる。 Row 3 (幕の下ろし方), left to right: (7) 一緒に演じる — 最後の一場をエルと演じきって、幕を下ろす。; (8) ページを読み上げる — 見つけた台詞を声に出して、幕を下ろす。; (9) みんなで拍手する — 客席から全員で拍手を送り、幕を下ろす。 Row 4 (影の観客への手), left to right: (10) 影の観客を席へ案内する — 通路を歩いて、一人ずつ席へ案内する。; (11) 照明室へ走る — 勝手に回る照明を、操作盤で止める。; (12) 即興で芝居を始める — 舞台に立って、影の観客に一幕を見せる。 Row 5 (guesses), left to right: (13) 最後の一場を、誰かと演じたい — 相手役のいない場面を一緒に演じれば、幕を下ろせそう。; (14) なくした最後のページを見つけたい — 欠けた最後の台詞が見つかれば、幕を下ろせるのかも。; (15) 満員の拍手を、一度聞きたい — 客席が拍手で埋まれば、幕を下ろせそう。
```

```
--- portraits: portraits-stage-ghost.png ---
Generate ONE sprite sheet image, 2048x1024, transparent background (PNG), containing 8 circular character portrait medallions in a 4x2 grid (4 columns, 2 rows), each medallion 460x460 px with even spacing and a transparent margin inside every cell. Style: painterly storybook ink-and-watercolor bust portrait, soft lamplight, muted palette matching the story's world, consistent across all eight. Shoulders-up, facing slightly left, readable face. No text, no numbers, no logos, no frames (the game draws the round frame), no watermark, no shisha pipes, no real brands, no resemblance to any existing character. World: 港坂 / 閉館した劇場「月灯座」 (やさしい幽霊劇): 赤い幕。三百の空席。夜明けまで、あと少し。
Row 1 = the player's character, four looks of the same role. Androgynous young adult (18-24) so the player can give any name; the look must not depend on background or name:
--- a: look-stage-ghost-ink --- 黒髪の座員. 短い黒髪に、作業用の前掛け
--- b: look-stage-ghost-rust --- 赤毛の座員. 赤毛を手ぬぐいでまとめる
--- c: look-stage-ghost-silver --- 銀髪の座員. 月明かりのような銀の髪と、紺の上着
--- d: look-stage-ghost-long --- 長髪の座員. 長い髪を一つに結び、黒い稽古着
Row 2 = characters the companions made for this story. Light comedy is welcome, keep faces readable:
--- e: pc-mirei --- ミレイ, 月影の衣装係. 光に透けそうな衣装係。針と糸で、何でも直せる Likes: ゆるいキャラの刺繍ワッペン
--- f: pc-serena --- セレナ, 元看板女優の衣装係. 悲劇の舞台で百回倒れた元女優。いまは衣装係。受け身は完璧 Likes: 楽屋で食べる、夜食のラーメン
--- g: pc-minamo --- ミナモ, 腹話術の旅芸人. 相棒の人形と二人で一座。幽霊は、ほんの少しだけ苦手 Likes: 海の見える芝居小屋と、サメ映画
--- h: pc-hiremaru --- ヒレマル, サメ着ぐるみの芸人. どんな芝居にもサメ役で出る。台本にサメがいなくても出る Likes: サメ映画の、二作目から先
```

