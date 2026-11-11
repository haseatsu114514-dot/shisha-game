# Issue #3418 自室版特注台3種 原画記録

## 生成前の構成メモ

```text
人物      : なし（自室に置く台だけの透過の絵）
場面      : 準備中（ボウル未装着）。先端は小さな凸型の金属ポスト
台の型    : 採用済みの職人仕立ての特注台（自室版）と同じ。真鍮の細いステム、手吹きガラスの丸いベース、上部の受け皿。ステムはベースの口に黒いゴムのパッキンで真っ直ぐ差さる
HMD       : なし（ボウル未装着）
炭        : なし
ホース    : 1本。ステム右側のホースポート → 重力でたわむ → 左下の硬いハンドル。通り道と色は shisha_home_stand_custom.png と同じ。左の小さな金具はパージ弁で、ホースをつながない
吸い口    : なし（ハンドルの先は金属の先端だけ。チップ・マイチップなし）
構図      : 1024×1536・透過・3/4斜め上。shisha_home_stand_custom.png と同じ位置と大きさ（ステムの軸 x≈448、ポストの上端 y≈74、受け皿 x 220〜679、ベース x 200〜697、ガラスの底 y≈1250）。人物・部屋なし
差分      : melty＝ステムのふくらみとベースの口の上の継手をピンク地に焦げ茶のレオパード、ガラスは薄いピンクに点々の柄／tosu＝ガラスのベースだけ橙と琥珀の渦、金属は元のまま／engraved＝真鍮のステムの前面に「逢縁」2字を縦に小さく刻む、ほかは元のまま
```

## 参照画像

画像3 `../siryou/shisha-hardware-reference/web-refs/images/stand-russian-03.jpg` は指定場所および `~/workspace/` 配下に実ファイルがなく未入手。既存 `generation.json` では元の店の絵で使った記録（SHA-256 a46c01fb85d71861c6cabbe5710a93cb13a815f3c07e898a459a219ba355319d）だけ確認。生成には画像1と各台の画像2の2枚を渡す。

- 画像1 編集元 `assets/ui/scene_props/shisha_home_stand_custom.png` SHA-256 `1e62c0c31c2fe2fc762700a4707dd2700b574582b72dce78cf48389fdad80ca3`
- 画像2 melty 色・柄・刻印 `asset_sources/kuji-equipment-3019-20261111/stand_custom_melty.png` SHA-256 `35731587dcbd41526d4a025d7d592baccabee19c831b111a7e9044f54827cd63`
- 画像2 tosu 色・柄・刻印 `asset_sources/kuji-equipment-3019-20261111/stand_custom_tosu.png` SHA-256 `b6fa2ad3279c0a8259213876f32826246827cec4f80bc9d78e4f96808dd03d32`
- 画像2 engraved 色・柄・刻印 `asset_sources/kuji-equipment-3019-20261111/stand_custom_engraved.png` SHA-256 `8d7678991b963952e44eb619bf4bf9832d4eb8b9c5dae87451e2b672ef92e238`

## melty 全文プロンプト

```text
Create ONE transparent game prop: a limited-edition version of the hookah stand in image 1, as it stands in the player's room. EDIT image 1 (shisha_home_stand_custom.png). Keep exactly: the same canvas (1024x1536 portrait), the same position and size of the stand on the canvas, the same 3/4 view from slightly above, the same silhouette and proportions of the brass stem, the wide ash tray, the small convex bare metal post on top, the black rubber grommet at the mouth of the base, the straight downstem inside the hand-blown glass base, the hose port on the right side, the separate small purge valve on the left, and exactly the same single black hose path and rigid handle with its brass tip. Keep the same polished painted rendering and soft lighting. True alpha background with all four corners fully transparent; no floor, no cast shadow, no room, no person, no hand. Do not move, resize, re-pose or redesign anything; change only the finish described below. Image 2 is the approved shop art of this limited stand: copy only its colors, pattern or engraving, not its framing, angle or missing hose. Image 3 is a real Japanese shisha-shop stand photograph for structure and scale only; do not copy its design, its size in the photo, its colors, labels or room.

FINISH: MELTY PUFF limited colorway, the same as image 2. Soft pink lacquer with dark-brown leopard rosettes on the central bulge of the stem and on the collar just above the mouth of the base. The hand-blown glass base is lightly tinted pink with spaced dark-brown leopard rosettes; it still reads clearly as transparent glass, with water only in its lower part and the downstem visible through it. The tray, the top post, the hose port, the purge valve and the connector rims stay plain brass. The hose and handle stay black with the brass tip, exactly as in image 1. No shop name, logo or text.

Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.
For this image there is no character and no room: the paragraph above is the general structure rule only. The bowl is not mounted: the top of the stand is only the small convex metal post; draw no bowl, HMD, coals, foil or smoke. The handle rests freely with no hand, exactly where it is in image 1. Joints: mouth of the base → sealing grommet → central stem → small top post; the hose port and the purge valve stay separate; no extra branches, tubes or double mouths.
```

## tosu 全文プロンプト

```text
Create ONE transparent game prop: a limited-edition version of the hookah stand in image 1, as it stands in the player's room. EDIT image 1 (shisha_home_stand_custom.png). Keep exactly: the same canvas (1024x1536 portrait), the same position and size of the stand on the canvas, the same 3/4 view from slightly above, the same silhouette and proportions of the brass stem, the wide ash tray, the small convex bare metal post on top, the black rubber grommet at the mouth of the base, the straight downstem inside the hand-blown glass base, the hose port on the right side, the separate small purge valve on the left, and exactly the same single black hose path and rigid handle with its brass tip. Keep the same polished painted rendering and soft lighting. True alpha background with all four corners fully transparent; no floor, no cast shadow, no room, no person, no hand. Do not move, resize, re-pose or redesign anything; change only the finish described below. Image 2 is the approved shop art of this limited stand: copy only its colors, pattern or engraving, not its framing, angle or missing hose. Image 3 is a real Japanese shisha-shop stand photograph for structure and scale only; do not copy its design, its size in the photo, its colors, labels or room.

FINISH: Tosu limited color, the same as image 2. Only the hand-blown glass base changes: rich translucent orange and amber swirls melted inside the glass itself. It stays transparent glass, not opaque paint: the downstem and the low water level remain visible. All brass parts, the black grommet, the hose and the handle stay exactly as in image 1. No pattern, label or text.

Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.
For this image there is no character and no room: the paragraph above is the general structure rule only. The bowl is not mounted: the top of the stand is only the small convex metal post; draw no bowl, HMD, coals, foil or smoke. The handle rests freely with no hand, exactly where it is in image 1. Joints: mouth of the base → sealing grommet → central stem → small top post; the hose port and the purge valve stay separate; no extra branches, tubes or double mouths.
```

## engraved 全文プロンプト

```text
Create ONE transparent game prop: a limited-edition version of the hookah stand in image 1, as it stands in the player's room. EDIT image 1 (shisha_home_stand_custom.png). Keep exactly: the same canvas (1024x1536 portrait), the same position and size of the stand on the canvas, the same 3/4 view from slightly above, the same silhouette and proportions of the brass stem, the wide ash tray, the small convex bare metal post on top, the black rubber grommet at the mouth of the base, the straight downstem inside the hand-blown glass base, the hose port on the right side, the separate small purge valve on the left, and exactly the same single black hose path and rigid handle with its brass tip. Keep the same polished painted rendering and soft lighting. True alpha background with all four corners fully transparent; no floor, no cast shadow, no room, no person, no hand. Do not move, resize, re-pose or redesign anything; change only the finish described below. Image 2 is the approved shop art of this limited stand: copy only its colors, pattern or engraving, not its framing, angle or missing hose. Image 3 is a real Japanese shisha-shop stand photograph for structure and scale only; do not copy its design, its size in the photo, its colors, labels or room.

FINISH: personalised engraving, the same as image 2. Keep the clear glass and plain brass of image 1 unchanged. On the front face of the long upper part of the brass stem, below the tray, engrave exactly the two Japanese characters 「逢縁」 arranged vertically, 逢 above 縁, as a thin dark-brown cut into the brass (not a sticker, plaque or paint). The two characters must be correct when zoomed in, but small and discreet, no wider than the stem. No other text, logo or ornament anywhere.

Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.
For this image there is no character and no room: the paragraph above is the general structure rule only. The bowl is not mounted: the top of the stand is only the small convex metal post; draw no bowl, HMD, coals, foil or smoke. The handle rests freely with no hand, exactly where it is in image 1. Joints: mouth of the base → sealing grommet → central stem → small top post; the hose port and the purge valve stay separate; no extra branches, tubes or double mouths.
```

## 原画・数値検品

| 台 | 生成回数 | 原画 bytes | SHA-256 | 寸法・形式 | α>16 外接枠 | 四隅α | 輪郭マスクIoU |
|---|---:|---:|---|---|---|---|---:|
| melty | 1 | 1620451 | `9181cb6364bbcb99d7ee9fb6e78a2584e03f900d0f4fd5c246be99658fbcbcdf` | 1024×1536 RGBA | (201, 73, 994, 1415) | [0, 0, 0, 0] | 0.95979 |
| tosu | 1 | 1631764 | `311311fbe1500e95c13013e23c43da4d079946e1fb493cf7f7ccde1dd0a7a77e` | 1024×1536 RGBA | (200, 74, 998, 1416) | [0, 0, 0, 0] | 0.97498 |
| engraved | 1 | 1622955 | `41ebf95b21f6f5a1e1bc402278891cf18e773026e54c163fc49d9311c1ee8f63` | 1024×1536 RGBA | (201, 71, 996, 1417) | [0, 0, 0, 0] | 0.98595 |

- 数値: 3枚とも PASS。外接枠は基準 `(200, 74, 996, 1416)` から各辺 ±12 px 以内。原画は生成出力を無加工で保存。
- 輪郭: 原寸と半透明重ね合わせで、ステム・受け皿・ポスト・ベース・ホース・ハンドルの外形位置は一致。色柄による透過領域の違いでマスクIoUは表のとおり。
- 透過のふち: 明背景と暗背景に合成して確認。薄いアルファのごみ・白いふちは見えない。
- 人物: 対象外（人物なし）。
- 積み順・付け根: ベース→黒いパッキン→直線のステム→受け皿→小さな凸型ポスト。ホースポートと左のパージ弁は別金具。用途不明の枝なし。
- ボウル・HMD・炭・アルミ・その縮尺・HMDのモデル: 対象外（未装着）。いずれも描画なし。受け皿・ステム・ベースの比は編集元と同じ。
- ホース: ポート→ハンドル、ハンドル→ポートの両方向で1本。分岐・途切れ・3つ目の端・大回りの輪なし。
- 吸い口・マイチップ: 対象外。煙なし。
- 文字・ロゴ・透かし・UI: なし。engraved の「逢縁」2字のみ例外。
- melty: ピンクと焦げ茶のレオパードがステムと継手、薄桃のガラスにあり、水と内部のダウンステムを確認。店の絵と同系の台。
- tosu: 橙・琥珀の渦はガラス内に見え、水と内部のダウンステムが透ける。金属・ホース・ハンドルは元のまま。店の絵と同系の台。
- engraved: 原寸拡大で縦書き「逢縁」（逢が上、縁が下）を確認。その他の装飾なし。
- 3枚とも元の自室版と同じ描き手に見えるテカリ・光の乗り方。強いエアブラシ調の追加なし。

## 比較図

- `comparison.jpg`: 編集元・melty・tosu・engraved を同じ倍率で横並び。比較用のみ。
