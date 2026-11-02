# Issue #2220: 第4章ドバイ背景②

Codex 内蔵 image_gen で生成。原画 PNG は無加工。採用背景は 1280×720 RGB に縮小。ロゴは 1536×1024 RGBA 原画を 768×512 透過 lossless WebP に縮小。

## 参照画像

- `assets/backgrounds/bg_eden_shop.png` — sha256 `2e5eb0e1146609a09a35d090c03c4a676835701db32ddf281c2b749c2c466204`
- `remake/img/backgrounds/bg_dubai_map.webp` — sha256 `05cc504394c91be88f17d11c24a63aa781f1a4c6c97d195ea19bd033c4e7409c`
- `assets/backgrounds/bg_tournament_stage.png` — sha256 `5712add473bc25449ea5a589b56c35fa3c00888323e291c348fd70c287572011`

#1〜#5 は最初の2枚を画風・ドバイの空気の参照に使用し構図は模写しない。#3 のみ3枚目を4台の配置参照に使用。図解・早見表は生成ツールへ添付していない。#6 に画像参照なし。

## 生成前の8行
（§4.3）

```
--- #1 bg_dubai_alley_cafe_night ---
人物      : なし（背景）
場面      : 準備中（ボウル未装着）。火を入れていない休んでいる台。炭・HMD・煙なし
台の型    : 使い込んだ伝統の真鍮の台、ステムの継ぎ目に修理の跡。ガラスのベースは緑がかった色
HMD       : なし（ボウル未装着なので描かない）
炭        : なし
ホース    : 1本。ステム側面のポート → 床へ重力でたわむ → 硬いハンドルの根元。ハンドルは台の脇の低いテーブルに立て掛け
吸い口    : なし
構図      : 画面右奥の床に台。手前中央は空ける。夜、黄色い電球、換気扇

--- #2 bg_dubai_festa ---
人物      : なし（背景）
場面      : 完成・提供前（炭はHMDの中）。人がいないので煙なし
台の型    : 角型モダンの黒い金属ステムに緑と黄の差し色、透明なガラスのベース。2台とも同じ型
HMD       : 蓋なしの低い金属の器。2台とも同じ1モデル
炭        : HMDの中に小さな角炭3個ずつ
ホース    : 各台1本。ステム側面のポート → テーブルの上へたわむ → 硬いハンドル。ハンドルはテーブルに寝かせる
吸い口    : なし
構図      : 大きな展示ホールの一角の出張ブース。小さな丸テーブル2つに1台ずつ、画面の左右寄り。中央手前は空ける

--- #3 bg_dubai_grand_smoke_stage ---
人物      : なし（背景）
場面      : 準備中（ボウル未装着）。競技の前。ステム先端は小さな凸型の金属ポストだけ。ハガル・HMD・炭・煙なし
台の型    : 4台とも同じ大会支給の銀の金属の台、透明なガラスのベース
HMD       : なし（ボウル未装着なので描かない）
炭        : なし
ホース    : 各台1本。ステム側面のポート → カウンターへたわむ → 硬いハンドルの根元。ハンドルはカウンターに寝かせる
吸い口    : なし
構図      : 舞台の上に作業台が4つ一列（台は小さく遠景）。手前は空いた客席、舞台の前に審査員席。中央は空ける
```

## 実際のプロンプト全文

### 1/6

```text
Use case: illustration-story. Asset type: game visual novel background. Reference image 1 is style only (bg_eden_shop); reference image 2 is Dubai atmosphere only (bg_dubai_map). Do not copy reference composition except specified four stations. Anime visual novel background, detailed digital painting, warm lighting, no people, 1280x720, painterly brushwork. A tiny, humble cafe at the far end of a narrow back alley in old Dubai at night. A low plastered ceiling, a wall ventilation fan turning slowly, a few worn wooden tables and low stools, a shelf of plain tins and jars (one tin with a purple label, no writing), bare warm yellow bulbs, the dark alley visible through the open doorway. At the back right, on the floor beside a low table, stands one old, well-used brass shisha with a mended joint on its stem; it is resting and unlit: the bowl is NOT mounted, so the top of the stem ends in a small convex metal post, with no bowl, no HMD, no charcoal and no smoke. Its single hose sags from the side port to the floor and its rigid handle leans against the low table. Quiet, hidden, the kind of place only regulars know. Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text. Ash tray, stem and base proportions must stay correct even though no bowl is mounted. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no Arabic calligraphy, no labels with writing, no logos, no numbers, no watermark. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```

### 2/6

```text
Use case: illustration-story. Asset type: game visual novel background. Reference image 1 is style only (bg_eden_shop); reference image 2 is Dubai atmosphere only (bg_dubai_map). Do not copy reference composition except specified four stations. Anime visual novel background, detailed digital painting, warm festive lighting, no people, 1280x720, painterly brushwork. FESTA: a lively Brazilian-carnival-style pop-up shisha booth set up in one corner of a huge modern exhibition hall in Dubai during a world championship. Strings of colorful bunting and paper flags in green, yellow and blue, a hand-painted wooden counter, low stools around two small round tables, a drum and a tambourine resting on a wooden crate. On each of the two tables stands one finished shisha ready to serve: black square modern stems with green and yellow accents and clear glass bases, the same model on both; each bowl has the same lidless low metal HMD on top with three small cube charcoals inside; one hose per hookah sags from the side port onto the table with its rigid handle lying on the tabletop. No smoke, because nobody is smoking. The warm, joyful booth glows against the cool, dim, huge hall behind it. Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no letters on flags or signs, no logos, no numbers, no watermark. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```

### 3/6

```text
Use case: illustration-story. Asset type: game visual novel background. Reference image 1 is style only (bg_eden_shop); reference image 2 is Dubai atmosphere only (bg_dubai_map). Reference image 3 is four-station layout only (bg_tournament_stage), not appearance. Do not copy reference composition except specified four stations. Anime visual novel background, detailed digital painting, dramatic lighting, no people, 1280x720, painterly brushwork. The stage of GRAND SMOKE, a world shisha championship held in a vast modern hall in Dubai, just before the competition. On a raised stage, four identical preparation stations stand in a row, each with a counter and one silver tournament-issue shisha with a clear glass base; the bowls are NOT mounted yet, so each stem ends in a small convex metal post, with no bowl, no HMD, no charcoal and no smoke; one hose per station sags from the side port onto the counter with its rigid handle lying flat. Desert-inspired décor: sand-gold wall panels, geometric lattice screens, warm golden spotlights cutting through a light haze, a large blank LED screen above the stage (no text), a long judges' desk in front of the stage, rows of empty audience seats in the foreground. Grand, solemn and international. Use the attached bg_tournament_stage.png only for the four-station layout. Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no Arabic calligraphy, no logos, no numbers, no flags with writing, no watermark. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```

### 4/6

```text
Use case: illustration-story. Game visual novel background. Reference image 1 is style only; reference image 2 is Dubai atmosphere only. Preserve the detailed scene brief, but all windows are closed by carved lattice screens and curtains, with NO exterior skyline, skyscrapers, towers, or recognizable landmarks. Do not copy reference composition. Anime visual novel background, detailed digital painting, warm lighting, no people, 1280x720, painterly brushwork. A majlis-style reception room in a private residence in Dubai, late evening. Low cushioned seating along the walls, rich patterned carpets, carved wooden screens, warm brass lamps and soft cream walls. On a low table in front: a brass Arabic coffee pot (dallah), several small handleless coffee cups and a plate of dates. No hookah in this image. Calm, generous and dignified rather than flashy: wealth shown through quiet craftsmanship, not gold everywhere. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no Arabic calligraphy, no inscriptions, no logos, no numbers, no watermark. Do not copy any real palace. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```

### 5/6

```text
Use case: illustration-story. Asset type: game visual novel background. Reference image 1 is style only (bg_eden_shop); reference image 2 is Dubai atmosphere only (bg_dubai_map). Do not copy reference composition except specified four stations. Anime visual novel background, detailed digital painting, warm lighting, no people, 1280x720, painterly brushwork. A quiet street in an older district of Dubai near the creek at night. Low sand-colored buildings with wooden balconies and wind-tower rooftops, small shops already shuttered with warm lamps above the doors, a few date palms, warm streetlights on clean paving, and at the end of the street the creek water glinting under a deep blue night sky with distant city lights. Calm and pleasant for a walk and a conversation. No hookahs. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no Arabic calligraphy, no signs with writing, no logos, no numbers, no watermark, no crushed blacks. Do not copy any real landmark. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```

### 6/6

```text
Use case: logo-brand. Asset type: transparent shop logo for map. Shop logo for "FESTA", a pop-up shisha booth run by a cheerful Brazilian judge at a world championship in Dubai. A bold, playful wordmark reading exactly "FESTA" in rounded heavy uppercase letters, with small carnival confetti, a sunburst behind the letters and a single smoke-ring motif (do not draw a hookah). Palette: vivid green (#2fd27a), sunny yellow and a touch of blue. Flat vector-like rendering, crisp edges, readable when shrunk to a small map pin. Centered on a 1536x1024 canvas with generous margins, TRUE TRANSPARENT background. No other words, no tagline, no watermark, no 3D bevel, no glow halo that fills the background.
```

## 生成物 SHA-256

- `asset_sources/ch4-dubai-backgrounds-20261102/bg_dubai_alley_cafe_night_original.png` — 2626118 B — `2afc7c5267dcf92c332a53fcdd46c2fea489618202345069894a045385227d07`
- `asset_sources/ch4-dubai-backgrounds-20261102/bg_dubai_festa_original.png` — 2798972 B — `98f61c1cc770c81fc63797c845d5f4f2a4c6df2de89cfa65242c022a92d35760`
- `asset_sources/ch4-dubai-backgrounds-20261102/bg_dubai_grand_smoke_stage_original.png` — 2616034 B — `586e128fc457b0c3cdcae043ae9794249923163d02ac37a73c94dedf6f38e59c`
- `asset_sources/ch4-dubai-backgrounds-20261102/bg_dubai_sheikh_residence_original.png` — 2811298 B — `6665664ef6af65afb09d14dfc1f6c743edf6cf5d1ea4183efd205222983e179d`
- `asset_sources/ch4-dubai-backgrounds-20261102/bg_dubai_street_night_original.png` — 2725244 B — `3f557a0fc2705f036bcf4f31a9633d9c664b9f0eafb14a78391989c54958576b`
- `assets/backgrounds/bg_dubai_alley_cafe_night.png` — 1581409 B — `3b53c6a5d1ab4f46a84e2f360eea223a18a1ed73b23da37521817d699576360f`
- `assets/backgrounds/bg_dubai_festa.png` — 1697456 B — `de794b904eee86d1d16dff271e6a432e09c5839308a072f94e8bf63db6fc759c`
- `assets/backgrounds/bg_dubai_grand_smoke_stage.png` — 1568775 B — `6a24a8a500b5682fe361212f0849026fde191a03d03a7debe0531e2739ce0082`
- `assets/backgrounds/bg_dubai_sheikh_residence.png` — 1681186 B — `d354e64c88f7ff40496530777a3c3f5810f3178d2012054c202d76a049cae61a`
- `assets/backgrounds/bg_dubai_street_night.png` — 1631698 B — `7c9a53f14c7860f6fba9bda1989f2c3d562937b55436ecd7eb5125fe3d9d17ba`
- `asset_sources/ch4-store-logos/festa/source.png` — 1480323 B — `9eb9afdaa5c7fd0470a52c99db7ccac9c93aafdc6a6d3d63951ce1f60b0a0e48`
- `assets/ui/store_logos/ch4-festa.webp` — 199018 B — `143ce46ded95817f14c1812bfb7ddc42f3b8b805b0ed1ccab6f10baad2e84ba1`
