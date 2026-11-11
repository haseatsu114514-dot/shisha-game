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

各 PNG は実寸・ファイルサイズ・SHA-256・四隅の背景色を機械的に確認し、外形・文字や記号の有無・外側の光や影・九分割の縁を目視確認した。小さい版は16px相当で丸・炎・しずく・角を確認した。

| 区分 | ファイル | 実寸 | バイト数 | SHA-256 | 四隅 |
|---|---|---:|---:|---|---|
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

## 個別指示と参照画像

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
