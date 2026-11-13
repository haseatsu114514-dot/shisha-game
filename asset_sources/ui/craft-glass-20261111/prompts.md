# シーシャ作りの部品「ガラスと革」（CSL18 方向B）Codex用 画像生成プロンプト

2026-11-11。オーナー「CSS使ってます感が強い見た目は嫌だ　シーシャ作りパートも」（CSL18）→ 見本4枚（`../craft-texture-20261111/mock/`）から、オーナー「質感はさっきのサンプルだと右下のやつが好き」＝**方向B（ガラスと革）・吸い出しの見本 `pull-B.png`**。

この依頼で作るのは、シーシャ作りの画面の部品17枚です。今の部品は「夜紫の平らな面＋細い線」の画風で作ったので（`../craft-night-20261102/`・`../craft-stage-20261110/`）、同じ画風で差し替えても CSS っぽさは消えません。部品を**素材感のある絵**（曇りガラス・紫の革と縫い目・銅の縁と鋲）に作り直します。

- 下の**コードブロックをそのまま Codex へ貼ります**（1回の生成で1枚）。
- 画風の段落（STYLE）は、見本で選ばれた方向Bの文を部品向けに書き直したもの。見本 `pull-B.png` を**素材と色の参照**として毎回添付します（配置は真似しない）。
- **熱の柱・一言の板・ダイヤルの台座・今の工程の札・柱の札**は、今の部品（`../craft-stage-20261110/`）と**同じ形・同じ寸法の割合**で頼みます。受け取ったら絵を差し替えるだけで、九分割の切り方や位置合わせはそのまま使えます。
- どの部品にもシーシャ台・ハガル・HMD・炭・ホース・人物は描きません（`docs/shisha_reference.md` §4 の対象外）。
- 文字・数字・印（✓や？）・ゲージの目盛り・色の帯・針は**コードが描く**ので、絵には入れません（`docs/prompts/asset_gen_prompts.md` の分業）。
- 受け取った後の切り出し・変換・組み込みは [README](README.md)（実装側の仕事）。

## 作る部品

| # | ファイル | 使う場所 | 画像 | 優先 |
|---|---|---|---|---|
| 1 | `tile.png` | 選ぶ札（詰め方・通気・機材の選択、配合の葉の行） | 横1536×1024・透過・九分割 | 必須 |
| 2 | `tile-on.png` | 選んでいる札（1 と重なる） | 同上 | 必須 |
| 3 | `panel.png` | 舞台の上の面（配合の左の列・穴あけの説明・炭壺の帯・吸い出しの下の札・ライバルの小窓） | 同上 | 必須 |
| 4 | `frame.png` | 大きな作業面の額（詰め方・配合のマットの絵のまわり）。中は透明 | 同上 | 必須 |
| 5 | `strip.png` | 説明の帯（香りの一言・配合の合計・ひとことの案内） | 横1536×1024・透過・横に伸ばす | 必須 |
| 6 | `plaque.png` | 小さな札（柱の上の温度帯・ぬるい等、吸い出しの見出し、針の現在位置） | 横1536×1024・透過・九分割 | 必須 |
| 7 | `key.png` | 二番手のボタン（吸い出しをする・提供する・次のリングへ ほか） | 同上 | 必須 |
| 8 | `key-amber.png` | 主のボタン（吸う・詰める・決める・穴を開ける ほか。7 と重なる） | 同上 | 必須 |
| 9 | `bead.png` | 上のレールの工程の玉（番号・✓はコード） | 正方1024×1024・透過 | 必須 |
| 10 | `rail-now.png` | 上のレールの今の工程の札（左の丸に番号） | 横1536×1024・透過 | 必須 |
| 11 | `badge.png` | 丸い札（右上の「？」、大会のライバルの顔の縁） | 正方1024×1024・透過 | 必須 |
| 12 | `spine-housing.png` | 熱の柱の外枠（中の管はコード） | 縦1024×1536・透過 | 必須 |
| 13 | `dial-bezel.png` | 吸い出しの半円ダイヤルの台座（色の帯と針はコード） | 横1536×1024・透過 | 必須 |
| 14 | `voice-plate.png` | 左下の見守る人・実況の一言の板 | 横1536×1024・透過 | 必須 |
| 15 | `tile-off.png` | 選べない札（1 と重なる） | 横1536×1024・透過 | あると良い |
| 16 | `dial-glass.png` | ダイヤルの色の帯に重ねるガラスの照り（13 と重なる） | 横1536×1024・透過 | あると良い |
| 17 | `stage-leather.png` | 吸い出し・蒸らしの舞台の奥の面 | 横1536×1024・不透過 | あると良い |

工程の灯5種（`../craft-stage-20261110/` の `lamp-*`）は、もともとガラスの玉の絵なので作り直しません。

## Codexへ貼る依頼文

```
あなたへの依頼: 下の 17 枚を、内蔵の画像生成で 1 回に 1 枚ずつ作ってください（1〜14 が必須、15〜17 は余力があれば）。
- 各画像は「STYLE の段落」＋「その画像の段落」を、この順でそのまま英文のプロンプトにする。要約・言い換え・追記をしない。
- どの画像にも asset_sources/ui/craft-texture-20261111/mock/pull-B.png を「素材と色の参照（配置は真似しない）」として添付する。
- 2・8・15・16 は、段落の最初に書いた先の画像も「形の参照」として添付してから生成する。
- 生成した PNG は加工せず、指定の保存先へ保存する（切り出し・縮小・色の調整をしない）。
- 保存後、asset_sources/ui/craft-glass-20261111/README.md の「原画の記録」の表に 1 枚 1 行で、ファイル名・ピクセル数・bytes・SHA-256・CHECK の結果を書く。
- 各画像の CHECK を原寸で確認し、1 つでも外れたら同じプロンプトで作り直す（3 回作ってもだめなら、どこがだめかを README に書いて次へ進む）。
- 新しい画像は Git LFS になる（git add のあと git lfs ls-files で確認）。本編のコード・CSS・既存の画像は変更しない。
- 終わったら最新 main から作った branch で PR にし、17 枚の一覧と CHECK の結果を本文に書く。

=== STYLE（どの画像でも先頭にそのまま置く）===
Style: tactile, hand-crafted game UI parts for the hookah-crafting mini game of a Japanese night shisha-bar visual novel, in the material direction "glass and leather" shown in the attached reference mock-up (use it for materials, colours and finish only, not for layout). Materials: smoked, frosted night-violet glass (#2a1d3c to #150d22) with etched, bevelled edges; deep plum leather (#2e1d45 to #221534) with a fine grain and tone-on-tone stitching; warm copper (#b87333, highlights #e3a56a, shadows #6b3a1e) for frames, corner caps and small round rivets. Every part has visible thickness, a bevelled edge, a soft contact shadow, fine surface texture and subtle wear, like the menus of a premium Japanese console or mobile game. Dim warm amber lamp light from the upper left; glass catches one soft highlight along its upper edge. Selected or active states glow with a soft violet neon rim (#c9a7e6 to #a678e0); the primary key is amber glass (#f2b66b to #c8823a). Seen straight from the front with no perspective tilt. Calm, low saturation except the violet glow and the amber key. No flat colour fills, no thin uniform one-pixel outlines, no plain pill shapes. Decoration limited to stitching, rivets and copper corner caps; no gears, jewels, lace, ribbons, flowers or medieval ornaments. No shisha pipes or hardware, no people. Never bake in any text, letters, logo, digits, gauges, scale marks, icons, check marks, question marks, hearts or watermark.

--- 1/17: asset_sources/ui/craft-glass-20261111/raw/tile.png ---
Create ONE rectangular CHOICE TILE on a fully transparent background, landscape 1536x1024, centred, filling about 88% of the image width, with an aspect of about 3:1. A smoked, frosted night-violet glass tile with an etched, bevelled inner edge, set in a copper frame with one small round copper rivet in each corner. The glass face is evenly frosted and dark enough that white text printed on it by code stays readable; one soft highlight runs along the upper edge only. The frame is the same thickness on all four sides (about 7% of the tile height) and the four corners are identical, so the tile can be stretched by nine-slice scaling: keep the middle part of every edge plain (no rivets, ornaments or marks there) and keep the glass face plain (no pattern, no emboss). A soft contact shadow just under the tile. No glow. No text, no icon, no number.
CHECK: one tile only / frame equal on four sides and corners identical / edges and glass face plain in the middle / transparent outside the tile / no glow, no text.

--- 2/17: asset_sources/ui/craft-glass-20261111/raw/tile-on.png ---
(Attach raw/tile.png as the shape reference.) Redraw the attached tile keeping exactly the same tile, frame, rivets, size and position so that the two images overlay pixel for pixel, on a fully transparent background, landscape 1536x1024. SELECTED state: the glass is lit softly from behind with violet light, and a violet neon rim (#c9a7e6 to #a678e0) runs just inside the copper frame, evenly on all four sides; a soft violet outer glow reaches about 3% of the image width beyond the frame and fades to full transparency. The copper is slightly brighter. Keep the glass face plain so white text stays readable. No text, no icon, no number.
CHECK: overlays tile.png (same frame size and position) / the violet rim is even on four sides / the glow fades to alpha 0 before the image edge / no text.

--- 3/17: asset_sources/ui/craft-glass-20261111/raw/panel.png ---
Create ONE large rectangular LEATHER PANEL on a fully transparent background, landscape 1536x1024, centred, filling about 92% of the image width, with an aspect of about 3:2. Deep plum leather (#2e1d45 fading to #221534) with a fine grain, a narrow copper edge strip around the outside, a line of tone-on-tone stitching parallel to the edge at an even inset all the way round, and a small copper corner cap with one rivet on each corner. The edge band (copper strip plus stitching) is the same width on all four sides (about 6% of the panel height) and the four corners are identical, so the panel can be stretched by nine-slice scaling: keep the middle of every edge plain, and keep the whole centre a plain, even leather surface with no pattern, emboss, crease or stain. A soft contact shadow under the panel. No text, no icon.
CHECK: one panel only / edge band equal on four sides and corners identical / the centre is plain leather / transparent outside / no text.

--- 4/17: asset_sources/ui/craft-glass-20261111/raw/frame.png ---
Create ONE rectangular PICTURE FRAME on a fully transparent background, landscape 1536x1024, centred, filling about 92% of the image width, with an aspect of about 2:1. The frame border is an outer band of plum leather with tone-on-tone stitching and an inner bevelled copper bezel, with a copper corner cap on each corner. The whole INSIDE of the frame is a FULLY TRANSPARENT window (alpha 0): artwork is shown through it by code, so draw nothing inside. The border is the same width on all four sides (about 7% of the frame height) and the four corners are identical, so it can be stretched by nine-slice scaling; keep the middle of every edge plain. A thin soft inner shadow may fall just inside the bezel, but only on the very edge of the window. No text, no icon.
CHECK: the inside is real alpha 0 / the border is equal on four sides and corners identical / transparent outside / no text.

--- 5/17: asset_sources/ui/craft-glass-20261111/raw/strip.png ---
Create ONE long, thin GLASS PLAQUE STRIP on a fully transparent background, landscape 1536x1024, centred, filling about 92% of the image width, with an aspect of about 12:1. A bar of smoked, frosted night-violet glass with an etched, bevelled edge, held at each end by a small copper end cap with one rivet; the two end caps are identical. Between the caps the strip looks exactly the same along its whole length (one soft highlight along the upper edge, plain frosted face) so that its middle can be stretched horizontally by code. A soft contact shadow under the strip. No text, no icon, no number.
CHECK: aspect about 12:1 / both end caps identical / the middle is uniform from left to right / transparent outside / no text.

--- 6/17: asset_sources/ui/craft-glass-20261111/raw/plaque.png ---
Create ONE small NAME PLAQUE on a fully transparent background, landscape 1536x1024, centred, filling about 80% of the image width, with an aspect of about 3.2:1 and fully rounded ends (a capsule). A smoked night-violet glass face with a bevelled edge, set in a thick polished copper rim (about 9% of the plaque height) with one tiny rivet at the middle of each rounded end. The glass face is plain and dark so a coloured word printed on it by code stays readable; one soft highlight along the upper edge. The rim is the same thickness all the way round, and the plaque looks the same between the two rounded ends so it can be stretched horizontally. A soft contact shadow under it. No text, no icon.
CHECK: capsule with fully rounded ends / rim thickness even / the glass face is plain / transparent outside / no text.

--- 7/17: asset_sources/ui/craft-glass-20261111/raw/key.png ---
Create ONE thick rectangular BUTTON KEY on a fully transparent background, landscape 1536x1024, centred, filling about 86% of the image width, with an aspect of about 2.6:1 and slightly rounded corners. A thick block of smoked violet glass with a bevelled top edge, sitting in a copper frame with a small rivet in each corner, raised above the surface with a visible side thickness and a soft contact shadow, so it clearly reads as a key that can be pressed. The glass face is plain so a white label printed on it by code stays readable. The frame is the same thickness on all four sides and the corners are identical, so the key can be stretched by nine-slice scaling; keep the middle of every edge plain. No glow. No text, no icon.
CHECK: reads as a thick pressable key / frame equal on four sides and corners identical / the face is plain / transparent outside / no text.

--- 8/17: asset_sources/ui/craft-glass-20261111/raw/key-amber.png ---
(Attach raw/key.png as the shape reference.) Redraw the attached key keeping exactly the same key, frame, rivets, size and position so that the two images overlay pixel for pixel, on a fully transparent background, landscape 1536x1024. PRIMARY state: the glass block is warm amber glass (#f2b66b at the centre to #c8823a at the edge) lit from inside, the copper frame is brighter and polished, and a soft amber outer glow reaches about 3% of the image width beyond the frame and fades to full transparency. The face stays plain so a dark label printed on it by code stays readable. No text, no icon.
CHECK: overlays key.png (same frame size and position) / amber, clearly the main action / the glow fades to alpha 0 before the image edge / no text.

--- 9/17: asset_sources/ui/craft-glass-20261111/raw/bead.png ---
Create ONE round GLASS BEAD set in a copper ring, seen straight from the front, on a fully transparent background, square 1024x1024, exactly centred. The ring's outer diameter is about 60% of the image width. A smooth low dome of smoked night-violet glass with one small soft highlight at the upper left, held by a thin copper ring with a bevelled edge; a soft contact shadow under it. The centre of the glass is plain so a number or a check mark printed by code stays readable. No glow. No text, no number, no icon.
CHECK: one bead only, centred / ring diameter 55-65% of the width / the centre is plain / transparent background / no text.

--- 10/17: asset_sources/ui/craft-glass-20261111/raw/rail-now.png ---
Create ONE wide CAPSULE PLATE on a fully transparent background, landscape 1536x1024, centred, filling about 85% of the image width, with an aspect of about 3.4:1 and fully rounded ends. A violet-lit glass capsule (#4a2f6b at the top to #2e1d45 at the bottom, softly glowing from inside) in a polished copper rim, with a soft violet outer glow about 2% of the image width that fades to full transparency. At the LEFT end, inset by about 10% of the capsule height, there is a round seat with a thin copper ring holding a plain warm-white (#f6f1fa) glass disc whose diameter is about 68% of the capsule height; a number is printed on it by code. The rest of the face is plain so that a white label can be printed by code, and the right 65% is uniform so that it can be stretched horizontally. No text, no number, no icon.
CHECK: the white disc is empty / the right 65% has no decoration / the glow fades to alpha 0 / transparent background / no text.

--- 11/17: asset_sources/ui/craft-glass-20261111/raw/badge.png ---
Create ONE round BADGE seen straight from the front, on a fully transparent background, square 1024x1024, exactly centred. A smoked night-violet glass dome with one soft highlight at the upper left, set in a wide polished copper ring with four tiny rivets at the top, bottom, left and right; the ring's outer diameter is about 70% of the image width and its width is about 9% of the diameter. A soft contact shadow under it. The glass centre is plain so a symbol or a face picture can be placed on it by code. No glow. No text, no question mark, no icon.
CHECK: one badge only, centred / the ring is even all the way round / the centre is plain / transparent background / no text or question mark.

--- 12/17: asset_sources/ui/craft-glass-20261111/raw/spine-housing.png ---
Create ONE tall, slim vertical THERMOMETER POLE HOUSING on a fully transparent background, portrait 1024x1536, centred, standing upright. The whole object fills about 20% of the image width and 94% of the image height. It has three parts from top to bottom: (1) a small rounded CAP, about 7% of the object's height, slightly wider than the shaft, with a flat top so that a separate name plate can sit on it (do not draw the plate); (2) a long straight SHAFT, about 83% of the height, with perfectly parallel sides and exactly the same look along its whole length (no ornaments, rings, joints or marks on the shaft) so that its middle can be stretched vertically by code; (3) a small weighted round FOOT, about 10% of the height, a little wider than the cap, so the pole reads as standing on a counter. Body: warm polished copper tube with a bevelled edge and a soft highlight along the left side; the cap and the foot are copper with a ring of tiny rivets. Down the middle of the shaft there is a long vertical WINDOW that is FULLY TRANSPARENT (alpha 0), about 55% of the shaft width, running from just under the cap to just above the foot, with rounded ends and a thin bevelled glass-and-copper rim. The glass tube, liquid, colours, marks and pointer are drawn by code, so leave the window completely empty. No scale marks, no numbers, no text, no icon, no flame.
CHECK: background and window are real alpha 0 / shaft is uniform top to bottom / cap, shaft and foot are all present / nothing drawn inside the window / no text or marks.

--- 13/17: asset_sources/ui/craft-glass-20261111/raw/dial-bezel.png ---
Create ONE HALF-ROUND GAUGE HOUSING (the upper half of a round instrument, with the flat edge at the bottom) on a fully transparent background, landscape 1536x1024, centred horizontally, with the flat edge at about 78% of the image height. It is seen straight from the front, flat. Its outer radius R is about 44% of the image width. From outside to inside: (1) an outer BEZEL ring from 0.945 R to 1.0 R in polished copper with small round rivets spaced evenly along it; (2) a wide ARC WINDOW from 0.53 R to 0.945 R that is FULLY TRANSPARENT (alpha 0) along the whole half circle; coloured glass zones and the needle tip are drawn there by code, so leave it completely empty; (3) an inner half-disc FACE inside 0.53 R in deep plum leather with a curved line of tone-on-tone stitching near its edge and a thin copper inner rim, otherwise plain; (4) at the centre of the flat edge a small plain round PIVOT SEAT with a radius of about 0.06 R, dark glass in a copper ring (the needle and its cap are drawn by code). Under the flat edge there is a slim straight BASE BAR about 0.05 R tall and about 2.1 R wide, polished copper with small rivets near both ends. No tick marks, no scale, no numbers, no letters, no needle, no coloured zones, no icons.
CHECK: the arc window is real alpha 0 and has the same width all the way round / no ticks, numbers or needle / flat edge is horizontal / symmetric left and right.

--- 14/17: asset_sources/ui/craft-glass-20261111/raw/voice-plate.png ---
Create ONE wide SPEECH PLATE on a fully transparent background, landscape 1536x1024, centred, filling about 90% of the image width, with an aspect of about 4:1. It is a rounded rectangle with a corner radius of about 18% of its height, except the BOTTOM-LEFT corner, which is almost square (radius about 4%) like the tail corner of a speech tag; that corner has a small copper corner cap. Face: deep plum leather (#221534 to #2e1d45) with a fine grain, a narrow copper edge and a line of tone-on-tone stitching at an even inset all the way round. At the left end, inset by about 12% of the plate height, there is a round PORTRAIT SEAT whose diameter is about 62% of the plate height: a plain dark glass disc (#150d22) in a thin copper ring; a face picture is placed on it by code. Everything to the right of the seat is plain so that two lines of white text can be printed by code, and the right 70% of the plate is uniform so that it can be stretched horizontally. No text, no icon, no face, no speech-bubble tail sticking out.
CHECK: transparent background / bottom-left corner is the square one / the seat is empty / the right 70% has no decoration.

--- 15/17: asset_sources/ui/craft-glass-20261111/raw/tile-off.png ---
(Attach raw/tile.png as the shape reference.) Redraw the attached tile keeping exactly the same tile, frame, rivets, size and position so that the two images overlay pixel for pixel, on a fully transparent background, landscape 1536x1024. DISABLED state: the glass is darker and greyer (#1b1424 to #110c18) with no highlight, the copper is dull and tarnished brown, and nothing glows. Keep the face plain. No text, no icon, no lock symbol.
CHECK: overlays tile.png / clearly darker and duller than tile.png / no glow / no text or symbol.

--- 16/17: asset_sources/ui/craft-glass-20261111/raw/dial-glass.png ---
(Attach raw/dial-bezel.png as the shape reference.) On a fully transparent background, landscape 1536x1024, draw ONLY a sheet of clear glass that exactly covers the ARC WINDOW of the attached gauge housing (the half ring from 0.53 R to 0.945 R, same centre and radius), so that the two images overlay pixel for pixel. The glass itself is almost fully transparent (alpha about 0 to 15%): show only soft reflections — one curved highlight along the outer part of the arc from the upper left, a faint bevel shine along both the inner and the outer edge of the arc, and a few very faint frosted streaks. Everything outside the arc window is fully transparent (alpha 0). No colours, no zones, no segment lines, no ticks, no needle, no text.
CHECK: overlays the arc window of dial-bezel.png exactly / mostly transparent with only highlights / alpha 0 outside the arc / no colours, lines or text.

--- 17/17: asset_sources/ui/craft-glass-20261111/raw/stage-leather.png ---
Create ONE large plum LEATHER WALL PANEL that fills the whole image, landscape 1536x1024, opaque. Deep plum leather (#221534 to #2e1d45) with a fine grain, a line of tone-on-tone stitching running around the panel at an even inset of about 4% of the image height, and a very faint embossed pattern of large plain square tiles across the panel (low contrast, like the background of the reference mock-up). Dim warm amber light from the upper left, the right and bottom edges slightly darker. The centre is calm and even so a gauge and buttons placed on it by code stay clear. No frame drawn around the image edge, no objects, no text, no icon.
CHECK: opaque and fills the image / stitching at an even inset / the emboss is faint and even / no objects or text.
```

## 作らないもの（今の素材を使う）

- 工程の灯5種（`../craft-stage-20261110/` の `lamp-*`）: もともとガラスの玉の絵。
- 舞台の天板（石・作業マット）、ランクの絵、はじめの作業絵、コンロ・炭・炭壺・タイマー・アルミ・ボウル・シーシャ台、フレーバーの商品パッケージ。
