# シーシャ作り「一枚の舞台」レイアウト（CSL）Codex用 画像生成プロンプト

2026-11-10。オーナー「UIとかアセットは画像生成を新たにしてもいい」「コーデックスに画像生成任せられるので必要なパーツの生成プロンプトをまとめて」。
新しいレイアウト（[設計の要点](../../../docs/design/craft-stage-layout.md)・モック `remake/previews/craft-stage-layout/`）で**新しく要る形の部品だけ**を頼む。ボタン・板・コンロ・炭・タイマー・はじめの作業絵・フレーバーのパッケージは今の素材をそのまま使うので作らない。

- 下の**コードブロックをそのまま Codex へ貼る**（1ブロックに12枚ぶん。1回の生成で1枚）。
- 画風の段落（STYLE）は現行の夜紫UI（[craft-night の style.txt](../craft-night-20261102/prompts/style.txt)）と同じ文。言い換えない。
- どの部品にもシーシャ台・ハガル・HMD・炭・ホースは描かない（機材の必須手順 `docs/shisha_reference.md` §4 の対象外）。
- 受け取った後の切り出し・変換・組み込みは [README](README.md) の手順（実装側の仕事）。

## 作る部品

| # | ファイル | 使う場所 | 画像 | 優先 |
|---|---|---|---|---|
| 1 | `spine-housing.png` | 熱の柱の外枠（全工程で同じ場所に立つ） | 縦1024×1536・透過 | 必須 |
| 2〜6 | `lamp-off` `lamp-faint` `lamp-fair` `lamp-good` `lamp-shine` | 上のレールの工程の灯（未着手・かすか・茶・橙・輝く金） | 各1024×1024・透過 | 必須 |
| 7 | `voice-plate.png` | 左下の見守る人・実況の一言の板 | 横1536×1024・透過 | 必須 |
| 8 | `counter-stone.png` | 舞台の天板（石）: 炭焼き・調整 | 横1536×1024・不透過 | 必須 |
| 9 | `counter-mat.png` | 舞台の天板（作業マット）: 配合・詰め方・穴あけ・蒸らし時間 | 横1536×1024・不透過 | 必須 |
| 10 | `dial-bezel.png` | 吸い出しの半円ダイヤルの台座 | 横1536×1024・透過 | 必須 |
| 11 | `spine-plate.png` | 熱の柱の上の状態の札の縁（吸い出し以降に出る） | 横1536×1024・透過 | あると良い |
| 12 | `rail-now.png` | 上のレールの「今の工程」の札 | 横1536×1024・透過 | あると良い |

## Codexへ貼る依頼文

```
あなたへの依頼: 下の 12 枚を、内蔵の画像生成で 1 回に 1 枚ずつ作ってください（1〜10 が必須、11・12 は余力があれば）。
- 各画像は「STYLE の段落」＋「その画像の段落」を、この順でそのまま英文のプロンプトにする。要約・言い換え・追記をしない。
- 3〜6 と 9 は、先に作った画像（指定あり）を参照として添付してから生成する。
- 生成した PNG は加工せず、指定の保存先へ保存する（切り出し・縮小・色の調整をしない）。
- 保存後、asset_sources/ui/craft-stage-20261110/README.md の「原画の記録」の表に 1 枚 1 行で、ファイル名・ピクセル数・bytes・SHA-256 を書く。
- 各画像の「CHECK」を原寸で確認し、1 つでも外れたら同じプロンプトで作り直す（3 回作ってもだめなら、どこがだめかを README に書いて次へ進む）。
- 新しい画像は Git LFS になる（git add のあと git lfs ls-files で確認）。本編のコード・CSS・既存の画像は変更しない。
- 終わったら最新 main から作った branch で PR にし、12 枚の一覧と CHECK の結果を本文に書く。

=== STYLE（どの画像でも先頭にそのまま置く）===
Style: the night-time "lounge goods" of a stylish Japanese shisha bar, drawn for a pixel-painterly visual novel and used as flat game UI parts. Deep night purple (#150d22 ground, #221534 panels, #2e1d45 cards) is the main colour and fills most of the surface, soft lavender light (#c9a7e6) is the secondary colour, warm white (#f6f1fa) is only for faint highlights, and muted gold (#e3bd6e) is a thin single accent line. Calm, chill, dim indirect lighting from one direction, subtle smoke haze. Surfaces are never plain flat fills: keep a faint velvet weave or paper fibre, a soft one-directional light gradient, a thin double rule (gold outside, lavender inside) and a soft inner shadow at the edges so the part reads as a real object. Flat, front-facing, no perspective, no photo realism, no 3D bevels, no neon glow tubes, no rainbow, no strong saturation. Decoration limited to hairlines and small smoke curls; no medieval ornaments, gears, jewels, lace, ribbons or flowers. No shisha pipes or hardware. Never bake in any text, letters, logo, digits, gauges, icons, hearts or watermark.

--- 1/12: asset_sources/ui/craft-stage-20261110/raw/spine-housing.png ---
Create ONE tall, slim vertical THERMOMETER POLE HOUSING on a fully transparent background, portrait 1024x1536, centred, standing upright. The whole object fills about 20% of the image width and 94% of the image height. It has three parts from top to bottom: (1) a small rounded CAP, about 7% of the object's height, slightly wider than the shaft, with a flat top so that a separate name plate can sit on it (do not draw the plate); (2) a long straight SHAFT, about 83% of the height, with perfectly parallel sides and exactly the same look along its whole length (no ornaments, rings, joints or marks on the shaft) so that its middle can be stretched vertically by code; (3) a small weighted round FOOT, about 10% of the height, a little wider than the cap, so the pole reads as standing on a counter. Body: night purple velvet (#221534) with a thin muted gold outer hairline and a lavender inner hairline, and a soft lavender light along the left edge. Down the middle of the shaft there is a long vertical WINDOW that is FULLY TRANSPARENT (alpha 0), about 55% of the shaft width, running from just under the cap to just above the foot, with rounded ends and a thin gold rim. The glass tube, liquid, colours, marks and pointer are drawn by code, so leave the window completely empty. No scale marks, no numbers, no text, no icon, no flame.
CHECK: background and window are real alpha 0 / shaft is uniform top to bottom / cap, shaft and foot are all present / nothing drawn inside the window / no text or marks.

--- 2/12: asset_sources/ui/craft-stage-20261110/raw/lamp-off.png ---
Create ONE small round GLASS CABOCHON LAMP set in a thin metal ring, seen straight from the front, on a fully transparent background, square 1024x1024, exactly centred. The ring's outer diameter is about 56% of the image width; leave the rest of the image empty (other versions of this lamp add a glow there). The glass is a smooth low dome with one small soft highlight at the upper left. UNLIT state: the glass is dark smoked night purple (#2e1d45 fading to #150d22), the ring is a thin lavender (#c9a7e6) line at low contrast, there is no light inside and no outer glow. No text, no icon, no number.
CHECK: one lamp only, centred / ring diameter 52-60% of the width / transparent background / no glow.

--- 3/12: asset_sources/ui/craft-stage-20261110/raw/lamp-faint.png ---
(Attach lamp-off.png as the shape reference.) Redraw the attached lamp keeping exactly the same lamp, ring, size, position and viewing angle so that the two images overlay pixel for pixel, on a fully transparent background, square 1024x1024. Change only the light. FAINT state: a tiny dim grey-violet point of light deep inside the glass; the dome is only slightly brighter than the unlit lamp; the ring stays a thin lavender line; no outer glow. No text, no icon, no number.
CHECK: overlays lamp-off (same ring size and position) / clearly darker than lamp-fair / no outer glow.

--- 4/12: asset_sources/ui/craft-stage-20261110/raw/lamp-fair.png ---
(Attach lamp-off.png as the shape reference.) Redraw the attached lamp keeping exactly the same lamp, ring, size, position and viewing angle so that the images overlay pixel for pixel, on a fully transparent background, square 1024x1024. Change only the light and the ring tint. FAIR state: a dull brown-amber ember glow inside the glass (#d9b99a at the centre, #94674a, #5a3b2b at the edge); the ring turns dark bronze; no outer glow. No text, no icon, no number.
CHECK: overlays lamp-off / brown, not orange / no outer glow.

--- 5/12: asset_sources/ui/craft-stage-20261110/raw/lamp-good.png ---
(Attach lamp-off.png as the shape reference.) Redraw the attached lamp keeping exactly the same lamp, ring, size, position and viewing angle so that the images overlay pixel for pixel, on a fully transparent background, square 1024x1024. Change only the light and the ring tint. GOOD state: a warm orange glow inside the glass (#ffe2b0 at the centre, #f0994a, #9c5320 at the edge); the ring turns warm bronze-gold; a soft orange outer glow reaches about 8% of the image width beyond the ring and fades to full transparency. For this part the glow is allowed; keep it calm, not neon. No text, no icon, no number.
CHECK: overlays lamp-off / orange / the glow fades to alpha 0 before the image edge.

--- 6/12: asset_sources/ui/craft-stage-20261110/raw/lamp-shine.png ---
(Attach lamp-off.png as the shape reference.) Redraw the attached lamp keeping exactly the same lamp, ring, size, position and viewing angle so that the images overlay pixel for pixel, on a fully transparent background, square 1024x1024. Change only the light and the ring tint. SHINE state: a bright gold light inside the glass (#fff6d6 at the centre, #f5cf7a, #b8862f at the edge); the ring is polished gold; a soft gold outer glow reaches about 14% of the image width beyond the ring and fades to full transparency; four very small star glints sit on the rim. For this part the glow is allowed; keep it elegant, not neon. No text, no icon, no number.
CHECK: overlays lamp-off / clearly the brightest of the five / the glow fades to alpha 0 before the image edge.

--- 7/12: asset_sources/ui/craft-stage-20261110/raw/voice-plate.png ---
Create ONE wide SPEECH PLATE on a fully transparent background, landscape 1536x1024, centred, filling about 90% of the image width, with an aspect of about 4:1. It is a rounded rectangle with a corner radius of about 18% of its height, except the BOTTOM-LEFT corner, which is almost square (radius about 4%) like the tail corner of a speech tag. Face: night purple velvet (#1b112a to #221534) with a thin lavender-grey (#6d5a86) outer hairline, a second faint inner hairline and a soft inner shadow. At the left end, inset by about 12% of the plate height, there is a round PORTRAIT SEAT whose diameter is about 62% of the plate height: a plain dark disc (#150d22) with a thin lavender-gold rim; a face picture is placed on it by code. Everything to the right of the seat is plain so that two lines of white text can be printed by code, and the right 70% of the plate is uniform so that it can be stretched horizontally. No text, no icon, no face, no speech-bubble tail sticking out.
CHECK: transparent background / bottom-left corner is the square one / the seat is empty / the right 70% has no decoration.

--- 8/12: asset_sources/ui/craft-stage-20261110/raw/counter-stone.png ---
Create ONE night-time KITCHEN COUNTER surface used as the stage floor of a coal-heating mini game, landscape 1536x1024, opaque. The camera looks down at the counter from the front at about 50 degrees. The counter top fills the image from the bottom edge up to a straight horizontal BACK EDGE at about 16% from the top; above the back edge there is only darkness (#150d22) with a faint lavender haze. Surface: dark grey-violet stone with a faint polished sheen and very subtle veins, lit by dim lavender light from the upper left; no warm pools of light and no reflections of objects. The LEFT 30% of the image falls gradually into deep shadow (#150d22) with nothing in it. Small props only at the far RIGHT edge, partly cut by the frame: a folded dark cloth and a small dark metal tray. The central 70% of the counter is completely empty and plain so that a stove, coals and cards can be placed by code. Do not draw any frame, border line or rounded panel edge on the image. No people, no stove, no coals, no tongs, no shisha hardware, no text.
CHECK: no frame or border drawn on it / back edge is one straight line at 12-20% from the top / centre is empty / left side fades to dark / props only at the right edge.

--- 9/12: asset_sources/ui/craft-stage-20261110/raw/counter-mat.png ---
(Attach counter-stone.png as the framing reference.) Keep exactly the same camera, the same back-edge height and the same lighting as the attached image so that the two images can be swapped, landscape 1536x1024, opaque. Replace the stone with a dark walnut wooden counter, and lay a large plum-coloured linen WORK MAT (#2e1d45) with a neat stitched hem on it; the mat covers the central 72% of the counter width and most of its depth. Keep the same deep shadow on the left 30%. Small props only at the far RIGHT edge, partly cut by the frame: a small empty ceramic dish and a folded cloth. The mat is completely empty and plain so that a bowl, foil and cards can be placed by code. Do not draw any frame, border line or rounded panel edge on the image. No people, no shisha hardware, no tobacco, no tools, no text.
CHECK: same camera and back edge as counter-stone / the mat is empty / no frame drawn on it / props only at the right edge.

--- 10/12: asset_sources/ui/craft-stage-20261110/raw/dial-bezel.png ---
Create ONE HALF-ROUND GAUGE HOUSING (the upper half of a round instrument, with the flat edge at the bottom) on a fully transparent background, landscape 1536x1024, centred horizontally, with the flat edge at about 78% of the image height. It is seen straight from the front, flat. Its outer radius R is about 44% of the image width. From outside to inside: (1) an outer BEZEL ring from 0.945 R to 1.0 R, night purple with a thin muted gold hairline outside and a lavender hairline inside; (2) a wide ARC WINDOW from 0.53 R to 0.945 R that is FULLY TRANSPARENT (alpha 0) along the whole half circle; coloured zones and the needle tip are drawn there by code, so leave it completely empty; (3) an inner half-disc FACE inside 0.53 R, night purple velvet (#221534) with two or three very faint concentric hairlines and a soft inner shadow, otherwise plain; (4) at the centre of the flat edge a small plain round PIVOT SEAT with a radius of about 0.06 R, dark with a thin gold rim (the needle and its cap are drawn by code). Under the flat edge there is a slim straight BASE BAR about 0.05 R tall and about 2.1 R wide, night purple with a gold hairline on top. No tick marks, no scale, no numbers, no letters, no needle, no coloured zones, no icons.
CHECK: the arc window is real alpha 0 and has the same width all the way round / no ticks, numbers or needle / flat edge is horizontal / symmetric left and right.

--- 11/12（あると良い）: asset_sources/ui/craft-stage-20261110/raw/spine-plate.png ---
Create ONE small CAPSULE-SHAPED FRAME (the rim of a name plate) on a fully transparent background, landscape 1536x1024, centred, filling about 80% of the image width, with an aspect of about 3.2:1 and fully rounded ends. Only the RIM is drawn: a muted gold outer hairline and a lavender inner hairline, about 6% of the capsule height thick in total, with a soft shadow just under the lower edge. The whole INSIDE of the capsule is FULLY TRANSPARENT (alpha 0); the colour and the word are drawn by code. No text, no icon.
CHECK: inside is real alpha 0 / rim thickness is even / no text.

--- 12/12（あると良い）: asset_sources/ui/craft-stage-20261110/raw/rail-now.png ---
Create ONE wide CAPSULE PLATE on a fully transparent background, landscape 1536x1024, centred, filling about 85% of the image width, with an aspect of about 3.4:1 and fully rounded ends. Face: lavender-lit night purple satin (#4a2f6b at the top to #2e1d45 at the bottom) with a thin lavender (#c9a7e6) rim and a soft lavender outer glow about 2% of the image width. At the LEFT end, inset by about 10% of the capsule height, there is a plain warm-white (#f6f1fa) round disc whose diameter is about 68% of the capsule height; a number is printed on it by code. The rest of the face is plain so that a white label can be printed by code, and the right 65% is uniform so that it can be stretched horizontally. No text, no number, no icon.
CHECK: the white disc is empty / the right 65% has no decoration / transparent background.
```

## 作らないもの（今の素材を使う）

- はじめの作業絵（`hajime_craft_*`・`hajime_steam_wait`）: 枠から出して切り抜きのまま左に立たせる。穴あけの手元は、押した場所に穴が出る今の仕組み（#402）を残すため作り直さない。
- 金・紫・白のボタン、板、額縁（`assets/ui/craft-night/`）、コンロ・炭・炭壺・タイマー・アルミ・ボウル・シーシャ台（`assets/ui/making/`）、フレーバーの商品パッケージ（`remake/img/shop/`）。
- ランクの絵（D〜SSS）: オーナーが以前選んだ7枚（#2473 の本文「⑩路線・密着①の画像7枚は未組込み」）を使う。**リポジトリには未保存**なので、原画を `asset_sources/ui/craft-rank/` へ保存してから組み込む（新しく生成しない）。
