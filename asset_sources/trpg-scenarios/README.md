# TRPG シナリオの背景と選択肢の絵（Codexへの指示書）

`python3 tools/trpg_art_prompts.py` が各シナリオのJSONから自動で書き出す。調査地点の位置（x%, y%）を背景の指示に焼き込むので、画面の光る輪が絵の物の上に来る。

## 受け取ったあと

1. 背景: 原画 `assets/backgrounds/trpg_<id>_room.png`（1280×720）→ 配信 `remake/img/backgrounds/trpg_<id>_room.webp`（品質90）。JSONの `presentation.image` に `"../../img/backgrounds/trpg_<id>_room.webp"`。
2. 選択肢: 原画 `assets/ui/trpg/choices-<id>.png`（透過・3列×5行）→ 配信 `remake/img/ui/trpg/choices-<id>.webp`（lossless）。JSONの `presentation.choiceArt` に `{"src": "../../img/ui/trpg/choices-<id>.webp", "rowCount": 5, "rows": {...}}`（下の行番号のとおり）。
3. 新規画像は Git LFS（`git lfs ls-files` で確認）。`node tools/validate_trpg_scenario.mjs` で画像の存在を検査し、`remake/trpg-preview.html?scenario=<id>` で輪と物の位置を目視する。
4. 生成日・SHA-256・目視QAを `asset_sources/trpg-scenarios/generation.json` に残す。

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

