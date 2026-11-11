# シーシャくじのガチャ演出（GCH）Codex用 画像生成プロンプト

2026-11-11。オーナー「（コードで描いた演出は）CSS感がすごいから画像生成も含めて作りたい。お店の雰囲気と祭り感が合わないかも」。
くじの演出を **Dr.fookah の店内（倉庫のような問屋。コンクリートの壁・黒い鉄の棚・段ボール・くるみ材のカウンター）** に合わせ、道具と札を描いた絵に差し替える。
コードは絵の差し込み口つきで出来ている（`remake/js/motions/kuji-art.js`。絵が無いあいだはコードで描いた下絵が出る）。ここで頼む絵が届けば、同じ場所へ同じ大きさで入れ替わる。

- 依頼は GitHub の Issue #3228 で出している（[素材・Codex] シーシャくじの演出の絵）。下の**コードブロックが依頼文の正本**で、Issue には同じ文を載せている（1ブロックに23枚ぶん。1回の生成で1枚）。
- 画風の参照に、採用済みのショップ背景 `assets/backgrounds/bg_shop.png` を毎回添付する（同じ店の道具に見えること）。
- どの絵にもシーシャ台・ハガル・HMD・炭・ホース・葉は描かない（機材の必須手順 `docs/shisha_reference.md` §4 の対象外）。
- 文字・数字・ロゴは描かない（賞の文字・景品名・「大当たり」はコードが重ねる）。
- 受け取った後の切り出し・変換・組み込みは [README](README.md) の手順（実装側の仕事）。

## 作る絵

| # | ファイル | 使う場所 | 画像 | 優先 |
|---|---|---|---|---|
| 1 | `garagara-drum.png` | 抽選器の胴（正面。ゲームが回す） | 1024×1024・透過 | 必須 |
| 2 | `garagara-frame.png` | 胴を支えるA字の脚（手前と奥の2か所に使う） | 1024×1024・透過 | 必須 |
| 3 | `garagara-base.png` | 抽選器の土台の板 | 横1536×1024・透過 | 必須 |
| 4 | `garagara-handle.png` | ハンドル（胴と一緒に回す） | 1024×1024・透過 | 必須 |
| 5 | `garagara-tray.png` | 玉の受け皿 | 横1536×1024・透過 | 必須 |
| 6〜10 | `ball-s` `ball-a` `ball-b` `ball-c` `ball-last` | 賞の玉（金・赤・青・白・黒に銀の輪） | 各1024×1024・透過 | 必須 |
| 11 | `counter.png` | 手前のカウンター（上は透過。後ろに今いる店の背景が見える） | 横1536×1024・上が透過 | 必須 |
| 12〜16 | `card-s` `card-a` `card-b` `card-c` `card-last` | 賞の札の地（景品の窓と文字の余白つき） | 各 横1536×1024・透過 | 必須 |
| 17 | `burst.png` | 札の後ろでゆっくり回る光 | 1024×1024・黒地 | 必須 |
| 18 | `gift.png` | 絵の無い景品の代わりに出す「景品の包み」 | 1024×1024・透過 | 必須 |
| 19 | `sign.png` | カウンターに立てる黒板（賞と玉の色の案内。字はコード） | 縦1024×1536・透過 | あると良い |
| 20 | `bell.png` | S賞で係の人が振る鐘 | 縦1024×1536・透過 | あると良い |
| 21 | `rail.png` | 10連で玉が並ぶ玉置き | 横1536×1024・透過 | あると良い |
| 22 | `banner.png` | S賞の札の上の「大当たり」の帯（字はコード） | 横1536×1024・透過 | あると良い |
| 23 | `sparkle.png` | きらめきの粒 | 1024×1024・黒地 | あると良い |

## Codexへ貼る依頼文

```
あなたへの依頼: シーシャくじの演出に使う絵を、内蔵の画像生成で 1 回に 1 枚ずつ作ってください（1〜18 が必須、19〜23 は余力があれば）。
- 最新 main から branch を作り、原画と記録だけを足して PR にする（Draft でよい）。本編のコード・CSS・既存の画像と、このフォルダの README.md・prompts.md は変更しない。
- 各画像は「STYLE の段落」＋「その画像の段落」を、この順でそのまま英文のプロンプトにする。要約・言い換え・追記をしない。
- 毎回 assets/backgrounds/bg_shop.png を画風と素材の参照として添付する（構図は写さない）。「Attach ...」と書いてある画像は、先に作ったその画像も添付する。
- 生成した PNG は加工せず、asset_sources/ui/kuji-gacha-20261111/raw/ の指定のファイル名で保存する（切り出し・縮小・色の調整をしない）。
- 保存後、asset_sources/ui/kuji-gacha-20261111/raw/GENERATION.md（新しく作る）に 1 枚 1 行で、ファイル名・ピクセル数・bytes・SHA-256・CHECK の結果を書く。添付した参照画像のパスも書く。
- 透過の画像は本物の透過（alpha 0）で出す。道具が本物の透過を出せないときだけ、背景を単色のマゼンタ #FF00FF にして、その旨を GENERATION.md に書く（抜くのは実装側）。切り出し・ゲームへの組み込みはしない。
- 各画像の「CHECK」を原寸で確認し、1 つでも外れたら同じプロンプトで作り直す（3 回作ってもだめなら、どこがだめかを GENERATION.md に書いて次へ進む）。
- 新しい画像は Git LFS になる（git add のあと git lfs ls-files で確認）。
- PR の本文に、作った絵の一覧と CHECK の結果を書く。

=== STYLE（どの画像でも先頭にそのまま置く）===
Style: a hand-painted prop for an anime visual novel, drawn by the same artist as the attached shop background (a stylish industrial hookah-supply warehouse shop in Japan). Detailed digital painting with visible painterly brushwork; forms are built from painted planes with two or three clear value steps, not from smooth airbrushed gradients; thin dark-brown edge lines only where planes meet. Materials: oiled dark walnut wood with visible grain, black powder-coated steel, aged brass with soft wear, kraft cardboard, cream paper. Light: warm ceiling tube lights from above and slightly in front; shadows are neutral brown, never pure black. Calm, tasteful and slightly worn, like real shop fixtures. Not glossy plastic, not a 3D render, not a photo, no neon, no rainbow, no lens flare, no glow or sparkle effects unless the image paragraph asks for them. No text, letters, numbers, logos or watermark anywhere. No people or hands. No hookahs, bowls, hoses, charcoal or tobacco. Use the attached image only for style, materials and palette; do not copy its composition.

--- 1/23: asset_sources/ui/kuji-gacha-20261111/raw/garagara-drum.png ---
Create ONE Japanese raffle drum (the rotating wooden drum of a "garagara" lottery machine) seen EXACTLY from the front, looking straight along its axle, so that its face is a flat REGULAR HEXAGON, on a fully transparent background, square 1024x1024. The hexagon is exactly centred; two of its corners point exactly LEFT and RIGHT and its top and bottom edges are horizontal; its corners touch an imaginary circle whose diameter is 94% of the image width. The face is made of six triangular walnut planks that meet at the centre (the seams run from the centre to each corner), with the grain of each plank running parallel to its outer edge. A black steel band about 4% of the image width wide runs around the whole edge, and each of the six corners has a black steel corner bracket with two small brass rivets. Exactly at the centre there is a round brass hub cap whose diameter is 16% of the image width, sitting on a slightly larger black steel washer. On ONE plank only, the lower-right one, near the edge, there is a small square brass hatch with a round dark hole in it: the door the balls come out of. Lighting is flat and even from the front, with no cast shadow and no strong highlight on one side, because the game rotates this drum. Do not draw the stand, the handle, an axle sticking out, or any ball.
CHECK: regular hexagon with corners pointing left and right / hub centre within 1% of the image centre / real transparent background / exactly one hatch, on the lower-right plank / no stand or handle / no directional shadow.

--- 2/23: asset_sources/ui/kuji-gacha-20261111/raw/garagara-frame.png ---
Create ONE A-shaped SUPPORT FRAME of the same lottery machine, seen exactly from the front, on a fully transparent background, square 1024x1024. Two straight legs of black powder-coated square steel tube lean together and meet at the top at a round bearing: a black steel ring with a brass centre, whose centre is at 50% horizontally and 6% from the top, diameter 11% of the image width. The legs spread downward so that the centres of their feet are at 16% and 84% horizontally, and the feet end at 97% from the top; each foot has a small flat steel plate. A horizontal steel crossbar joins the two legs at 70% from the top. The area between the legs is transparent. Nothing else: no drum, no base board, no shadow.
CHECK: left-right symmetric / bearing centre at the top centre / the space between the legs is real alpha 0 / no shadow / no drum.

--- 3/23: asset_sources/ui/kuji-gacha-20261111/raw/garagara-base.png ---
Create ONE rectangular BASE BOARD of oiled dark walnut, the plinth that the lottery machine stands on, seen from the front and slightly from above (about 20 degrees), on a fully transparent background, landscape 1536x1024, centred. The board fills 90% of the image width. We see its top face as a thin trapezoid (slightly narrower at the back) and, below it, its front edge face; the total visible height is about 13% of the board's width. There is a small brass corner plate at each of the two front corners. No shadow outside the board (the game adds it). Nothing stands on the board.
CHECK: centred / about 7:1 wide to tall / the top face is empty / transparent background.

--- 4/23: asset_sources/ui/kuji-gacha-20261111/raw/garagara-handle.png ---
Create ONE CRANK HANDLE of the same lottery machine seen exactly from the front, on a fully transparent background, square 1024x1024. A flat aged-brass arm runs horizontally from a round brass pivot boss on the LEFT to a turned walnut grip knob on the RIGHT. The pivot boss is a circle centred at 22% from the left and 50% from the top, diameter 12% of the image width, with a dark screw at its centre. The grip points toward the viewer, so we see it end-on as a round walnut knob centred at 78% from the left and 50% from the top, diameter 16% of the image width. The arm between them is 6% of the image width thick. Lighting is flat and even from the front with no cast shadow, because the game rotates this part. Nothing else.
CHECK: the arm is horizontal / boss on the left, knob on the right, both centred on the horizontal midline / transparent background / no shadow.

--- 5/23: asset_sources/ui/kuji-gacha-20261111/raw/garagara-tray.png ---
Create ONE shallow round RECEIVING TRAY (where a lottery ball lands), seen from the front and from above at about 30 degrees so that it reads as a wide flat ellipse, on a fully transparent background, landscape 1536x1024, centred. The outer ellipse is 70% of the image width and about 28% as tall as it is wide, with a low outer wall visible along the front. Rim: turned walnut with a thin brass edge. Inside: dark green felt, empty, with a soft shadow under the far rim. No shadow outside the tray (the game adds it). No ball.
CHECK: empty / the ellipse is level / transparent background.

--- 6/23: asset_sources/ui/kuji-gacha-20261111/raw/ball-s.png ---
Create ONE glossy lacquered LOTTERY BALL on a fully transparent background, square 1024x1024, exactly centred, diameter 70% of the image width. Colour: rich metallic gold (#f7c648 mid-tone, #fff3c0 light, #8a5a10 shadow). One soft window-shaped highlight at the upper left and a faint reflected light at the lower right, hand-painted with two or three value steps. For this part a clean glossy highlight is allowed. No cast shadow, no glow around the ball, no number or mark.
CHECK: one ball, centred / diameter 66-74% of the width / transparent background / no shadow or glow.

--- 7/23: asset_sources/ui/kuji-gacha-20261111/raw/ball-a.png ---
(Attach ball-s.png as the shape reference.) Redraw the attached ball keeping exactly the same size, position, highlight and lighting so that the two images overlay pixel for pixel, on a fully transparent background, square 1024x1024. Change only the colour: bright vermilion red (#e2443c mid-tone, #ffb3a4 light, #701a1a shadow). No cast shadow, no glow, no number or mark.
CHECK: overlays ball-s (same size and position) / red / transparent background.

--- 8/23: asset_sources/ui/kuji-gacha-20261111/raw/ball-b.png ---
(Attach ball-s.png as the shape reference.) Redraw the attached ball keeping exactly the same size, position, highlight and lighting so that the two images overlay pixel for pixel, on a fully transparent background, square 1024x1024. Change only the colour: cobalt blue (#3f82ea mid-tone, #b9d6ff light, #173a80 shadow). No cast shadow, no glow, no number or mark.
CHECK: overlays ball-s / blue / transparent background.

--- 9/23: asset_sources/ui/kuji-gacha-20261111/raw/ball-c.png ---
(Attach ball-s.png as the shape reference.) Redraw the attached ball keeping exactly the same size, position, highlight and lighting so that the two images overlay pixel for pixel, on a fully transparent background, square 1024x1024. Change only the colour: pearl white (#f6f3ec mid-tone, #ffffff light, #a39b8e shadow). No cast shadow, no glow, no number or mark.
CHECK: overlays ball-s / white, still clearly a ball against a light background (the shadow side is visible) / transparent background.

--- 10/23: asset_sources/ui/kuji-gacha-20261111/raw/ball-last.png ---
(Attach ball-s.png as the shape reference.) Redraw the attached ball keeping exactly the same size, position, highlight and lighting so that the two images overlay pixel for pixel, on a fully transparent background, square 1024x1024. Change the colour to deep navy-black (#2a2648 mid-tone, #8b8cc0 light, #07060e shadow) and add ONE thin polished silver band (#d8dce6) around its equator, tilted about 15 degrees. No cast shadow, no glow, no number or mark.
CHECK: overlays ball-s / dark with one silver band / transparent background.

--- 11/23: asset_sources/ui/kuji-gacha-20261111/raw/counter.png ---
Create the SERVICE COUNTER TOP of the shop as a foreground strip, landscape 1536x1024. Everything above 55% from the top is FULLY TRANSPARENT (alpha 0). From a perfectly straight, horizontal BACK EDGE at 55% from the top down to the FRONT EDGE at 78% from the top we see the top surface of a long walnut counter (the same dark oiled walnut as the counter in the attached background), seen from the front and slightly from above; the planks run left to right, with a few plank seams and soft grain. A warm pool of light from the ceiling lies on the centre of the surface; the left and right ends are a little darker. From the front edge (a rounded, slightly lighter lip) down to the bottom of the image we see the dark vertical front face of the counter, in shadow. The surface is completely empty across the full width, because objects are placed on it by code. The strip spans the full image width with no ends visible.
CHECK: above the back edge is real alpha 0 / the back edge is one straight horizontal line at 52-58% from the top / the front edge is at 75-81% / the surface is empty / no props, no text.

--- 12/23: asset_sources/ui/kuji-gacha-20261111/raw/card-s.png ---
Create ONE PRIZE CARD, a thick paper prize tag printed for a shop raffle, lying flat and seen exactly from the front, on a fully transparent background, landscape 1536x1024, centred. The card is a rounded rectangle with an aspect ratio of 2.38:1 that fills 92% of the image width; its corner radius is about 5% of its height. Paper: warm cream cotton paper (#f8f1e2) with a faint fibre texture. Around the edge runs a hot-foil-stamped border about 1.6% of the card width thick, with a second hairline just inside it. FOIL COLOUR for this card: polished gold (#f2c14a with #fff3c8 lights and #8a5a10 darks). The LEFT 38% of the card is a DISPLAY WINDOW: a slightly recessed panel with rounded corners, inset from the card edge by 4% of the card height, filled with a soft radial wash of pale gold that is almost white at its centre; it is otherwise empty, because a product picture is placed there by code. The RIGHT 62% is plain cream paper and completely empty, because text is printed there by code. No text, no letters, no numbers, no emblem, no ribbon, no string, no hole.
CHECK: real alpha 0 outside the card / aspect between 2.3:1 and 2.45:1 / the window is on the left 36-40% and empty / the right side is empty / no text.

--- 13/23: asset_sources/ui/kuji-gacha-20261111/raw/card-a.png ---
(Attach card-s.png as the layout reference.) Redraw the attached card keeping exactly the same shape, size, position, window and layout so that the two images overlay pixel for pixel, on a fully transparent background, landscape 1536x1024. Change only the foil and the window tint. FOIL COLOUR: deep vermilion red foil (#e2443c with #ffd5c8 lights and #7c1a14 darks). The window is a soft radial wash of pale coral that is almost white at its centre. No text.
CHECK: overlays card-s / red foil / window and right side empty.

--- 14/23: asset_sources/ui/kuji-gacha-20261111/raw/card-b.png ---
(Attach card-s.png as the layout reference.) Redraw the attached card keeping exactly the same shape, size, position, window and layout so that the two images overlay pixel for pixel, on a fully transparent background, landscape 1536x1024. Change only the foil and the window tint. FOIL COLOUR: cobalt blue foil (#4f8fe8 with #d6e8ff lights and #1c4690 darks). The window is a soft radial wash of pale sky blue that is almost white at its centre. No text.
CHECK: overlays card-s / blue foil / window and right side empty.

--- 15/23: asset_sources/ui/kuji-gacha-20261111/raw/card-c.png ---
(Attach card-s.png as the layout reference.) Redraw the attached card keeping exactly the same shape, size, position, window and layout so that the two images overlay pixel for pixel, on a fully transparent background, landscape 1536x1024. Change only the foil and the window tint. FOIL COLOUR: pearl silver foil (#d8d2c6 with #ffffff lights and #7b7166 darks). The window is a soft radial wash of pale warm grey that is almost white at its centre. No text.
CHECK: overlays card-s / silver foil, quieter than the gold card / window and right side empty.

--- 16/23: asset_sources/ui/kuji-gacha-20261111/raw/card-last.png ---
(Attach card-s.png as the layout reference.) Redraw the attached card keeping exactly the same shape, size, position, window and layout so that the two images overlay pixel for pixel, on a fully transparent background, landscape 1536x1024. Change the paper to deep charcoal-black cotton paper (#1f1c24) with a faint fibre texture, and the foil to cool silver (#b9b4d8 with #f1f2f8 lights and #3a3660 darks). The window is a soft radial wash of pale lavender-silver that is lightest at its centre. No text.
CHECK: overlays card-s / black paper with silver foil / window and right side empty.

--- 17/23: asset_sources/ui/kuji-gacha-20261111/raw/burst.png ---
Create a RADIAL LIGHT BURST used as a slowly rotating glow behind a prize card, square 1024x1024, opaque, on PURE BLACK (#000000). Soft warm-white rays of light radiate from the exact centre: about twenty-four rays of uneven width and length with feathered edges, like light through dusty air, brightest in a small soft core at the centre and fading completely to black before they reach the image edges (the outer 8% of the image is pure black). Painted, soft and calm: no hard-edged stripes, no lens-flare rings, no sparkles, and no colour other than warm white (#fff4dc) on black. The burst must look the same when it is rotated, so no single ray dominates. For this part the light effect is the subject.
CHECK: the centre of the burst is the image centre / the corners and edges are pure black / no rings or stars / roughly the same in every direction.

--- 18/23: asset_sources/ui/kuji-gacha-20261111/raw/gift.png ---
Create ONE closed KRAFT CARDBOARD GIFT BOX tied with natural jute twine in a cross and a simple bow on top, with a small blank cream paper tag hanging from the bow, seen from the front and slightly from above, on a fully transparent background, square 1024x1024, centred, filling 72% of the image width. No shadow outside the box (the game adds it). No text on the tag or the box.
CHECK: one closed box / the tag is blank / transparent background.

--- 19/23（あると良い）: asset_sources/ui/kuji-gacha-20261111/raw/sign.png ---
Create ONE small tabletop CHALKBOARD SIGN seen exactly from the front, on a fully transparent background, portrait 1024x1536, centred, filling 84% of the image height. A walnut wooden frame about 5% of the board width thick surrounds a matte black chalkboard; two short wooden feet at the bottom. The chalkboard surface is completely EMPTY and evenly dark, with only faint chalk-dust smudges, because words and coloured balls are placed on it by code. No writing, no drawings.
CHECK: the board is empty / upright front view / transparent background.

--- 20/23（あると良い）: asset_sources/ui/kuji-gacha-20261111/raw/bell.png ---
Create ONE brass HANDBELL (the bell a shop clerk rings for a winner) hanging mouth-down from its turned walnut handle, seen from the front and slightly from below so that the dark inside of the mouth and the clapper are just visible, on a fully transparent background, portrait 1024x1536. The handle is at the top and runs straight up to the top edge of the image (it is held from above, outside the picture); the bell's mouth is at about 88% from the top; the bell is 40% of the image width wide at the mouth and centred horizontally. No hand, no motion lines, no shadow.
CHECK: the handle reaches the top edge / centred / transparent background / no hand.

--- 21/23（あると良い）: asset_sources/ui/kuji-gacha-20261111/raw/rail.png ---
Create ONE long narrow BALL RAIL: a straight bar of walnut with a shallow groove lined with dark green felt running along its whole length, both ends rounded, seen from the front and slightly from above, on a fully transparent background, landscape 1536x1024, centred. The rail fills 94% of the image width and is about 5.5% as tall as it is wide. It is perfectly uniform along its length, with no marks, sockets or divisions, so that its middle can be stretched by code. A thin brass edge runs along the rim. No shadow outside the rail (the game adds it). No balls.
CHECK: uniform along its length / level / transparent background / no balls.

--- 22/23（あると良い）: asset_sources/ui/kuji-gacha-20261111/raw/banner.png ---
Create ONE blank RIBBON BANNER of gold-foil paper with folded swallow-tail ends, seen exactly from the front, on a fully transparent background, landscape 1536x1024, centred, filling 70% of the image width, about 16% as tall as it is wide. The centre section is flat and plain so that a short word can be printed on it by code. No text.
CHECK: the centre is plain / level / transparent background / no text.

--- 23/23（あると良い）: asset_sources/ui/kuji-gacha-20261111/raw/sparkle.png ---
Create ONE four-point STAR GLINT of light, square 1024x1024, opaque, on PURE BLACK (#000000): a small bright white core at the exact centre with four thin tapering rays (up, down, left and right; the vertical pair slightly longer) and a soft round glow around the core, fading completely to black before the image edges. White only, no colour, no extra stars. For this part the light effect is the subject.
CHECK: one glint, centred / the edges are pure black / white only.
```
