# 生成記録

Issue #3367 の原画。Codex 内蔵画像生成で1回につき1部品を生成した。原画の透過化・切り分け・ゲームへの組み込みは行っていない。

## 共通の生成指示

```text
ノベルゲーム「水煙前線」の成長画面「心得の盤」で使うUI部品を1枚だけ描いてください。
添付①は、この盤ですでに使っている絵の一覧（画風と色の役割の正本）、添付②は今の画面です（桃色の番号と線は場所の印なので描かない）。①と同じ描き手に見えるように描いてください。

スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。
（上は全素材の共通指針。この依頼の部品は真正面の平らな絵で、透過の代わりに下の FORMAT のマゼンタの地を使う。大きさは一覧の値）

Never bake in any text, letters, kanji, digits, question marks, check marks, plus or minus signs, logo, gauge fill or watermark (the game draws all of them). No people, no hands, no hookah, no charcoal box, no tongs, no hose.
FORMAT: one part only, flat and front-facing, centered. Unless the part says otherwise, put it on a plain solid magenta #FF00FF background (the game keys it out); keep the magenta exactly #FF00FF and draw no glow, halo, haze, smoke or drop shadow outside the part's outline. For nine-slice parts, keep every decoration inside the stated border band (corners especially), keep straight edges parallel to the canvas, and keep the center plain and evenly textured.
```

## 種類別の生成指示

### 暗い部品

```text
ART DIRECTION "neon lounge": black smoked glass and thin neon tubes with a bright core, as in attachment 1. Light colors are limited to the board colors red-orange #ef8a5e, blue #58a6ff, green #7bd36d, gold #f4d27a, warm white-gold #fff1d0 and pale white #f6f2ff. Pixel-painter shading with fine dot texture, 2 or 3 clean tone steps, light from the upper left. Calm and luxurious, nothing eye-searing.
```

### 紙の部品

```text
Style: the "paper goods" of a bright daytime shisha shop in a Japanese pixel-painterly visual novel. The same warm cream paper as the game's shop screen (#f7f3ed), with lavender (#69497e) lines and fills, and only a touch of amber (#d8963f). Keep fine hand-drawn paper fiber and faint print grain. Avoid photo realism, 3D rendering, perspective, drop shadows, strong gradients and neon. Decoration is limited to thin lines and small smoke curls; no medieval ornaments, gears, jewels, lace, ribbons or flowers.
Attachment 4 is the game's paper panel: match its paper, its lavender double rule and its small smoke-curl flourish exactly.
```

各生成では上の共通文＋該当する種類の文＋下表の個別文を順に連結し、参照画像の役割を追記した。生成対象は毎回1部品だけ。

## 正規化と検品

内蔵生成の生画像を `normalize.py` で指定実寸に Lanczos 縮小した。RGB に変換し、マゼンタ地の近似画素（R/B>180、G<125、|R-B|<90）を正確な `#FF00FF` に置換した。`burst_rays.png` は black モードを使い、RGB 各成分が32未満の画素を `#000000` に置換した。イラスト本体の透過化や切り分けは行っていない。

22枚すべてについてファイル名・実寸・四隅の背景色を機械的に確認し、ファイルサイズと SHA-256 を実測した。外形・文字や記号の有無・外側の光や影・九分割の縁を目視確認した。小さい版は各マスを16pxに縮めて丸・炎・しずく・角を確認した。

`gb_title_rule.png` は最初の2回で背景色または縮小後の視認性が不合格だったため、マゼンタ地と線・煙の大きさを明示して再生成し、3回目の合格版を保存した。

| 区分 | ファイル | 実寸 | バイト数 | SHA-256 | 四隅 |
|---|---|---:|---:|---|---|
| B | `burst_rays.png` | 1024×1024 | 222,431 | `b2879ce3137ed66d24a9541098cc4624c9e3a447a2250ee4793a709723596942` | 一致（`#000000`） |
| C | `gb_badge_check.png` | 256×256 | 38,680 | `8127b4ba3347065db5ef6305bc4277ad19524bc412eaa2c901eb3cf35359d59d` | 一致（`#FF00FF`） |
| C | `gb_badge_cost.png` | 256×256 | 35,828 | `45ae53a7d76c605dd10b7bb3a0ebfd49276fe47f6256f6a5de76677a88d5389b` | 一致（`#FF00FF`） |
| C | `gb_badge_unknown.png` | 256×256 | 34,449 | `0ef3b6fc910bc53633e69d9a66f6fd4b196ea427a8d14872ccfbe5844b89876d` | 一致（`#FF00FF`） |
| C | `gb_card.png` | 768×192 | 146,985 | `263db86f9a39b319f9088d2d091a7f5f356ed00d58e7c6182cb1efb69f9faee9` | 一致（`#FF00FF`） |
| C | `gb_gauge.png` | 1024×96 | 30,830 | `c4b5a9f35c3ee8763a57e05040215d14861e4090b7751d60149623f00f244bc8` | 一致（`#FF00FF`） |
| C | `gb_round_btn.png` | 256×256 | 86,083 | `71ca897d0552a660a1e5528b70540f092889b3c3c51f8a54ca3e0568d8989763` | 一致（`#FF00FF`） |
| C | `gb_tab_off.png` | 768×192 | 123,082 | `b0ad5bc253374d95aa309596cd9acf0c76413ec45874785ce3cb333a4750633b` | 一致（`#FF00FF`） |
| C | `gb_tab_on.png` | 768×192 | 109,970 | `80f11293b2333610c87360f981300a4526bab6f216b94e31aa836fd60a30baa5` | 一致（`#FF00FF`） |
| C | `gb_title_rule.png` | 1024×96 | 5,413 | `008e44f8792496748dcb6ee54cc0800264688a7b0eaa78c600b740d5483afd7d` | 一致（`#FF00FF`） |
| A | `hidane_any_a.png` | 1024×1024 | 692,872 | `ec26aade1d596d35466dae892dfcf061ba37c5dd0b2f5e929183ad38658913c4` | 一致（`#FF00FF`） |
| A | `hidane_any_b.png` | 1024×1024 | 823,110 | `5dfec35c545ced269d99e7fac0b619d26fa22b92bce5f66b388e249b7715f934` | 一致（`#FF00FF`） |
| A | `hidane_body_a.png` | 1024×1024 | 469,785 | `fa4b35090060c1019e9d6e47db570e22f21f22a5642b57398e27cb7de93dd38e` | 一致（`#FF00FF`） |
| A | `hidane_body_b.png` | 1024×1024 | 485,141 | `f4cf8ee59ccdbd47be1b425719001ae16bdfd309a08e25ab1e11fb7e55f2e1c7` | 一致（`#FF00FF`） |
| A | `hidane_sense_a.png` | 1024×1024 | 542,705 | `d26cfe7a5760c3d549b7d138754862d3c109da1e1a1eef25aaa4a918ed6de0f2` | 一致（`#FF00FF`） |
| A | `hidane_sense_b.png` | 1024×1024 | 574,445 | `4897692b4debb6789cda85e36fae28c2740b1f95d0624aa6825a19fb340afbea` | 一致（`#FF00FF`） |
| A | `hidane_small_sheet_a.png` | 1024×256 | 150,837 | `3cd84b807ce84014934885c0b17939f4e9b0ac1acdd20f59a1b625628b4a9f98` | 一致（`#FF00FF`） |
| A | `hidane_small_sheet_b.png` | 1024×256 | 187,599 | `d69e90417280972c8ba838d7553a5f2aa935b43d7ee6313f5a5eca3a953caaac` | 一致（`#FF00FF`） |
| A | `hidane_socket.png` | 512×512 | 159,055 | `853e797cd048aeb951e3a9043ce479d6cbea0d9ed56a1df221d30f642c455e1f` | 一致（`#FF00FF`） |
| A | `hidane_wisdom_a.png` | 1024×1024 | 696,855 | `48145dc1fca2c461fd407d1c55ffe5ca4c29629970af351cabdcc4d47b3ca6cb` | 一致（`#FF00FF`） |
| A | `hidane_wisdom_b.png` | 1024×1024 | 755,410 | `f21448c3da2a2d27374ee05f9712c05e1d152db97f4ef19451edeeb1a6d5063c` | 一致（`#FF00FF`） |
| B | `levelup_plate.png` | 1536×384 | 236,548 | `cd38ea920a0ca65059f96e0625c9df56c7ebc17f59b4eff571fe7888cc110a9d` | 一致（`#FF00FF`） |

## 個別指示と参照画像

### `burst_rays.png`

```text
GBP-05 / burst_rays.png 1024x1024, on a pure black #000000 background instead of magenta — A radial burst of thin warm gold light rays from the exact center, uneven lengths, brightest near the center and fading to black before the edges, with a few tiny ember sparks between the rays. No object in the middle, no lens-flare rings, no text. The game adds it to the screen as light.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_levelup.png` — 配置・大きさの比。桃色の番号と線は描かない

### `gb_badge_check.png`

```text
GBP-07 / gb_badge_check.png 256x256 — The same token with a mint green #9fe6c0 face and a dark green rim, plain face (the game draws a check mark on it).
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- 補助 `asset_sources/ui/growth-board-20261111/reference/parts_board_summary.png` — 右パネルの配置参考

### `gb_badge_cost.png`

```text
GBP-07 / gb_badge_cost.png 256x256 — A small round token like a tiny coin of dark glass with a gold neon rim and a warm amber #ffb43c face, plain face (the game writes a number on it).
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- 補助 `asset_sources/ui/growth-board-20261111/reference/parts_board_summary.png` — 右パネルの配置参考

### `gb_badge_unknown.png`

```text
GBP-07 / gb_badge_unknown.png 256x256 — The same token with a dim, clouded smoky face and a faint gold rim, plain face.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- 補助 `asset_sources/ui/growth-board-20261111/reference/parts_board_summary.png` — 右パネルの配置参考

### `gb_card.png`

```text
GBP-08 / gb_card.png 768x192, nine-slice (64 px) — A small card of cream paper with slightly rounded corners, a lavender hairline border, a slightly darker paper edge on the bottom and right as if it lies on the panel (no cast shadow), and a thicker lavender band 12 px wide along the left edge. Center plain paper.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- 補助 `asset_sources/ui/growth-board-20261111/reference/parts_board_summary.png` — 右パネルの配置参考
- ④ `assets/ui/paper/panel.png` — 紙、ラベンダー二重罫、煙の飾りの正本

### `gb_gauge.png`

```text
GBP-09 / gb_gauge.png 1024x96, nine-slice (48 px left and right, 32 px top and bottom) — A long empty gauge frame: a rounded tube outline in lavender ink on cream paper, with a pale lavender #e6dcea trough inside. Completely empty (the game fills it).
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- 補助 `asset_sources/ui/growth-board-20261111/reference/parts_board_summary.png` — 右パネルの配置参考
- ④ `assets/ui/paper/panel.png` — 紙、ラベンダー二重罫、煙の飾りの正本

### `gb_round_btn.png`

```text
GBP-10 / gb_round_btn.png 256x256 — A round paper button: a cream paper disc with a lavender double rule around the rim, plain center (the game writes a symbol on it).
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- 補助 `asset_sources/ui/growth-board-20261111/reference/parts_board_summary.png` — 右パネルの配置参考
- ④ `assets/ui/paper/panel.png` — 紙、ラベンダー二重罫、煙の飾りの正本

### `gb_tab_off.png`

```text
GBP-06 off / gb_tab_off.png 768x192, same nine-slice — An unselected paper index tab: cream paper with rounded top corners and a flat bottom, a lavender hairline along the top and both sides, a fainter second rule inside, one tiny smoke-curl flourish in the top left corner. Center plain paper.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- 補助 `asset_sources/ui/growth-board-20261111/reference/parts_board_summary.png` — 右パネルの配置参考
- ④ `assets/ui/paper/panel.png` — 紙、ラベンダー二重罫、煙の飾りの正本

### `gb_tab_on.png`

```text
GBP-06 on / gb_tab_on.png 768x192, nine-slice (96 px left and right, 64 px top, 0 px bottom) — The selected index tab of the board: black smoked glass with rounded top corners and a flat bottom edge that runs off the bottom of the canvas, a thin white-gold neon tube along the top and both sides (no line at the bottom). Center plain dark glass.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- 補助 `asset_sources/ui/growth-board-20261111/reference/parts_board_summary.png` — 右パネルの配置参考

### `gb_title_rule.png`

```text
GBP-11 / gb_title_rule.png 1024x96 — A horizontal ornamental rule: a thin lavender line with a small smoke curl at each end and one tiny amber ember dot at the center. Nothing else.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- 補助 `asset_sources/ui/growth-board-20261111/reference/parts_board_summary.png` — 右パネルの配置参考
- ④ `assets/ui/paper/panel.png` — 紙、ラベンダー二重罫、煙の飾りの正本

### `hidane_any_a.png`

```text
GBP-01 A / hidane_any_a.png 1024x1024 — "White fire seed", design A "fire sealed in a bead": a perfectly round bead of polished heat-proof glass with a white-hot ember core burning inside, warm white-gold #fff1d0 with a pure white core, a few wisps of white-gold flame curling inside the glass, one small crisp highlight at the upper left. No metal setting, no base. Bold closed outline; the bead fills about 70% of the canvas.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③ `asset_sources/ui/growth-board-20261030/neon/hidane_any.png` — 外形の役割だけ（質感は踏襲しない）

### `hidane_any_b.png`

```text
GBP-01 B / hidane_any_b.png 1024x1024 — "White fire seed", design B "glowing ember": a round ember glowing white-hot all the way through, fine cracks across its surface with white-gold fire showing in the cracks, and a thin ring of small white-gold flames hugging its edge. Not a pearl, not glass. Bold closed outline; fills about 70% of the canvas.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③ `asset_sources/ui/growth-board-20261030/neon/hidane_any.png` — 外形の役割だけ（質感は踏襲しない）

### `hidane_body_a.png`

```text
GBP-01 A / hidane_body_a.png 1024x1024 — "Crimson fire seed", same make as the attached white bead: the same glass with an ember core, but the outer shape is a flame (pointed at the top, leaning slightly right, two soft lobes). Red-orange #ef8a5e with a pale gold #fff1b8 core.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③ `asset_sources/ui/growth-board-20261030/neon/hidane_body.png` — 外形の役割だけ（質感は踏襲しない）
- ④ `originals/hidane_any_a.png` — A案の同じ作り、光源、質感、大きさ感の見本

### `hidane_body_b.png`

```text
GBP-01 B / hidane_body_b.png 1024x1024 — same make as the attached white ember, shaped as a flame (pointed top, leaning slightly right): a red-orange #ef8a5e ember body at the bottom rising into a flame, cracks glowing pale gold.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③ `asset_sources/ui/growth-board-20261030/neon/hidane_body.png` — 外形の役割だけ（質感は踏襲しない）
- ④ `originals/hidane_any_b.png` — B案の同じ作り、光源、質感、大きさ感の見本

### `hidane_sense_a.png`

```text
GBP-01 A / hidane_sense_a.png 1024x1024 — "Azure fire seed", same make: the outer shape is a smooth teardrop pointed at the top. Blue #58a6ff with a white core.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③ `asset_sources/ui/growth-board-20261030/neon/hidane_sense.png` — 外形の役割だけ（質感は踏襲しない）
- ④ `originals/hidane_any_a.png` — A案の同じ作り、光源、質感、大きさ感の見本

### `hidane_sense_b.png`

```text
GBP-01 B / hidane_sense_b.png 1024x1024 — same make, shaped as a teardrop pointed at the top: blue #58a6ff ember with white-hot cracks and a small steady blue flame tip.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③ `asset_sources/ui/growth-board-20261030/neon/hidane_sense.png` — 外形の役割だけ（質感は踏襲しない）
- ④ `originals/hidane_any_b.png` — B案の同じ作り、光源、質感、大きさ感の見本

### `hidane_small_sheet_a.png`

```text
GBP-02 / hidane_small_sheet_a.png 1024x256 — Four small icons in a row, one centered in each 256x256 cell, left to right: white round, crimson flame, azure teardrop, jade cube. The same shapes as the attached large seeds, simplified for 16 px display: thick dark outline, two or three flat tones, one bright core dot, one highlight. Equal visual size, nothing touching the cell edges.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③〜⑤ `originals/hidane_any_a.png`・`hidane_sense_a.png`・`hidane_wisdom_a.png` — 同案の大きい版の外形と質感。紅火は同案の炎形で指示

### `hidane_small_sheet_b.png`

```text
GBP-02 / hidane_small_sheet_b.png 1024x256 — Four small icons in a row, one centered in each 256x256 cell, left to right: white round, crimson flame, azure teardrop, jade cube. The same shapes as the attached large seeds, simplified for 16 px display: thick dark outline, two or three flat tones, one bright core dot, one highlight. Equal visual size, nothing touching the cell edges.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③〜⑤ `originals/hidane_any_b.png`・`hidane_sense_b.png`・`hidane_wisdom_b.png` — 同案の大きい版の外形と質感。紅火は同案の炎形で指示

### `hidane_socket.png`

```text
GBP-03 / hidane_socket.png 512x512 — A shallow round dish seen from directly above: matte black smoked glass with a thin gold #f4d27a neon rim, slightly darker in the middle, empty.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない

### `hidane_wisdom_a.png`

```text
GBP-01 A / hidane_wisdom_a.png 1024x1024 — "Jade fire seed", same make: the outer shape is a cube with softly rounded corners seen from slightly above (three faces visible). Green #7bd36d with a pale yellow-green core.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③ `asset_sources/ui/growth-board-20261030/neon/hidane_wisdom.png` — 外形の役割だけ（質感は踏襲しない）
- ④ `originals/hidane_any_a.png` — A案の同じ作り、光源、質感、大きさ感の見本

### `hidane_wisdom_b.png`

```text
GBP-01 B / hidane_wisdom_b.png 1024x1024 — same make, shaped as a cube with softly rounded corners seen from slightly above: green #7bd36d ember with pale yellow-green fire in the cracks along its edges. A fantasy fire seed, not a realistic charcoal cube.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_board.png` — 配置・大きさの比。桃色の番号と線は描かない
- ③ `asset_sources/ui/growth-board-20261030/neon/hidane_wisdom.png` — 外形の役割だけ（質感は踏襲しない）
- ④ `originals/hidane_any_b.png` — B案の同じ作り、光源、質感、大きさ感の見本

### `levelup_plate.png`

```text
GBP-04 / levelup_plate.png 1536x384, nine-slice (160 px left and right, 96 px top and bottom) — A long plaque of black smoked glass with softly rounded corners, edged by one thin gold neon tube; a second fainter inner line; at the left and right ends, inside the border band, a small ornament of two ember sparks. Center plain dark glass with a very faint purple sheen. The background outside the plaque is magenta.
```

- ① `asset_sources/ui/growth-board-20261030/neon/contact_sheet.png` — 画風と色の役割の正本
- ② `asset_sources/ui/growth-board-20261111/reference/parts_levelup.png` — 配置・大きさの比。桃色の番号と線は描かない
