# 縦画面C案の試作で使う生成画像（2026-11-27）

オーナー「画像生成APIが使えるようになったので再度練ったり作ってみて生成を取り入れて　2.6サンバーストを使う」（要望台帳 VPL25・VPL26）。
縦画面C案の試作 `remake/previews/portrait-stage/` のために、OpenAI の画像生成 API（モデル `gpt-image-2.6-sunburst`、1024×1024、品質 medium）で作った。
このフォルダには原画（WebPに変換したもの）とプロンプトを残す。試作が読むのは、切り出して縮めた `remake/previews/portrait-stage/img/` の絵（下の表。VPL27 以降は2枚）。
本編の画面にはまだ組み込んでいない（試作の合格後に、本編の素材の置き場と規格に合わせて作り直す）。

**VPL27 で穴あけをボタンの色が満ちる見せ方に変えたため、ルーペの断面（lens）・針（needle）・ルーペの縁（loupe）の3枚は試作から外した。** 試作の `img/` に残るのは `ui-button.webp` と `ui-dpad.webp` の2枚（VPL32 で足した `ui-needle.webp` と `ui-mouthpiece.webp` は VPL34 で外した）。3枚の原画とプロンプトは、断面の見せ方を見直す時のためにこのフォルダに残す。

| 原画 | 試作で使う絵 | 使う場所 |
|---|---|---|
| `lens-original.webp` | `img/hole-lens.webp`（中央を640×640で切り出し。アルミの線は上から約43%） | 穴あけの左のルーペ（断面）。VPL27 で外した |
| `needle-original.webp` | `img/hole-needle.webp`（不透明な所だけ切り出し） | 穴あけのルーペの針。VPL27 で外した |
| `abtn-original.webp` | `img/ui-button.webp`（512×512） | 丸ボタン（行く・次へ・決める・刺す・吸う）の面 |
| `dpad-original.webp` | `img/ui-dpad.webp`（512×512） | 輪の十字キーの面 |
| `loupe-original.webp` | `img/ui-loupe.webp`（512×512） | 穴あけのルーペの縁。VPL27 で外した |

生成は5枚・各1回（作り直しなし）。

## 穴あけの断面（シーシャ機材が写る絵）

`docs/shisha_reference.md` §4 の手順で、生成前に決めたこと（§4.3）:

```text
人物      : なし（機材の断面だけ）
場面      : 詰める・アルミ（穴あけ）
台の型    : 写さない（ハガルの口の周りの断面だけ）
HMD       : なし（穴あけの段階なので載せない）
炭        : なし
ホース    : なし
吸い口    : なし
構図      : 真横から見た断面のアップ。素焼きのハガル（ソラリス系の厚い赤茶）に葉を平らに詰め、アルミを口に平らに張って縁で折り込む。上は暗い店内のぼけ
```

生成後の確認（§4.4 のうち当てはまるもの）: ハガル＋アルミだけで炭・HMDが無い／アルミは口に平らに張られ、縁で折り込まれている（袋状・布状ではない）／葉は器の中に平らに詰まっている／文字・ロゴ・透かし・UIが焼き込まれていない。いずれも合格。針は絵に描かせず、別の絵（needle）をコードで重ねる。

```text
Game UI asset for a Japanese shisha-bar story game: a close-up cutaway (cross-section) side view of the top of a shisha bowl during the "foil and poke holes" step, painted in a polished anime game illustration style with warm low-key bar lighting (deep plum and amber), clean shapes, two or three tone shading, no airbrushed gloss.

Composition (square): the cut face of an unglazed terracotta ceramic bowl rim fills the lower part of the frame, seen exactly from the side like a diagram slice. Inside the bowl, packed moist shisha tobacco: dark reddish-brown shredded leaves, slightly glossy with molasses, packed evenly and level, its top surface about 2 mm below the rim. A single sheet of thin aluminum foil is stretched flat and taut across the bowl's mouth like a drum skin, its edges folded down over the outer rim. The foil line sits horizontally at about 40 percent from the top of the image and spans the full width. Above the foil: empty dark warm air with a soft bokeh of the bar behind. Leave the upper area simple so a needle can be drawn over it later.

Do not draw: a needle, tools, hands, charcoal, a heat management device, smoke, flames, a hose, text, letters, logos, watermark, UI, frames or borders.
```

## 針

```text
Game UI asset, transparent background: a single foil-poking needle used in a Japanese shisha bar to poke holes in aluminum foil. Drawn in a polished anime game illustration style with clean outlines and two-tone shading, no airbrushed gloss. The tool is perfectly vertical and pointing straight down: a long thin polished stainless steel pin with a sharp tip at the bottom, and a short round handle at the top made of dark walnut wood with a thin brass ferrule where the pin enters the handle. Centered, filling about 85 percent of the image height, narrow. Front view, no perspective tilt. Only the tool on a fully transparent background. No hand, no foil, no bowl, no shadow on the ground, no text, no logo, no watermark.
```

## 丸ボタンの面

```text
Game UI asset, transparent background: a round push button face for a mobile game controller, seen straight from the front, perfectly circular and centered, filling about 92 percent of the image. Material: dark smoky glass (charcoal grey with a hint of plum) with soft swirls of pale white smoke suspended inside the glass, a gentle highlight along the upper edge, slightly domed. A thin polished antique brass rim around the edge. Calm, elegant, like a premium bar's interior detail, in a polished anime game illustration style with clean shapes and two or three tone shading, no airbrushed plastic gloss. Leave the center fairly plain so a label can be overlaid. No text, no letters, no icons, no symbols, no arrows, no logo, no watermark, nothing outside the circle.
```

## 輪の十字キーの面

```text
Game UI asset, transparent background: a round directional control pad for a mobile game, seen straight from the front, perfectly circular and centered, filling about 94 percent of the image. A disc of dark frosted smoky glass (charcoal grey with a hint of plum) divided into four equal quadrant segments by two thin engraved diagonal grooves forming an X, each quadrant slightly cushioned. A small round dark center hub with a tiny brass ring. A thin polished antique brass rim around the outer edge. Faint pale smoke drifting inside the glass. Polished anime game illustration style with clean shapes and two or three tone shading, no airbrushed plastic gloss. No arrows, no triangles, no text, no letters, no icons, no logo, no watermark, nothing outside the circle.
```

## ルーペの縁

```text
Game UI asset, transparent background: the frame of a round magnifying loupe, seen straight from the front, perfectly circular and centered, filling about 96 percent of the image. Only the ring frame is drawn: a fairly thin polished antique brass bezel with a fine knurled outer edge and a slim inner lip, warm amber reflections. The entire inside of the ring must be fully transparent (no glass tint, no reflections inside, nothing inside). Polished anime game illustration style with clean shapes and two or three tone shading. No handle, no text, no letters, no logo, no watermark, nothing outside the ring.
```

## 2回目: 丸ボタンの道具の絵（VPL32・2枚・各1回）

**VPL34 でオーナー「ボタンないのアイコンは白いシェイプで書いて欲しい　生成ではなく」により、この2枚は試作から外した**（ボタンの中の絵はコードの白い図形で描く）。原画とプロンプトは記録として残す。

オーナー「吸い出しや穴あけのアイコンはもっと大きくわかりやすく　穴あけは穴あけの針を大きく」「吸い出しはマスピースにして」。
1回目の針（`needle-original.webp`）は細く、ボタンに大きく置くと針が読みにくいため、持ち手と針を太くした絵を作り直した。

| 原画 | 試作で使う絵 | 使う場所 |
|---|---|---|
| `needle-icon-original.webp` | `img/ui-needle.webp`（不透明な所だけ切り出し、高さ420） | 穴あけの「刺す」ボタンの針（押し具合で下がる） |
| `mouthpiece-original.webp` | `img/ui-mouthpiece.webp`（不透明な所だけ切り出し、幅360） | 吸い出しの「吸う」ボタン |

### 生成前に決めたこと（§4.3）

```text
人物      : なし（道具だけ）
場面      : 穴あけ（針）／吸い出し（マウスピース）。どちらも丸ボタンの絵
台の型    : 写さない
HMD       : なし
炭        : なし
ホース    : 針はなし／マウスピースはハンドルの根元に短く付く切れ端だけ（分岐なし）
吸い口    : 針はなし／マウスピースはハンドル＋使い捨てチップ（先端に差す短い半透明の筒）
構図      : 針は真っすぐ縦・先が下。マウスピースは45度の斜め（ホース側が左下、チップが右上）。透明背景
```

生成後の確認（§4.4 のうち当てはまるもの）: 針は胡桃の持ち手・真鍮の口金・太めの鋼の針で、アルミ・炭・器・手・文字が無い／マウスピースは硬い筒で、ホース側が太く吸い口側がやや細く、ホースとの境目に真鍮の金具（ホースアダプター）、先の使い捨てチップは指2本分ほどで本体より短く細い、チェーン・分岐・手・煙・文字が無い。いずれも合格。

### 穴あけの針

```text
Game UI asset, transparent background: a single foil-poking needle tool used in a Japanese shisha bar to poke holes in aluminum foil, drawn as a bold, instantly readable game icon in a polished anime game illustration style with clean dark outlines and two or three tone shading, no airbrushed gloss.

The tool: a chunky rounded handle of warm walnut wood with visible grain, a polished brass ferrule where the pin enters the handle, and a sturdy polished stainless steel pin. Make the pin clearly visible: its thickness is about one quarter of the handle's width, tapering only at the very end into a sharp point. The handle takes about 40 percent of the total length, the pin about 60 percent.

Composition: perfectly vertical, tip pointing straight down, centered, filling about 90 percent of the image height. Front view, no perspective tilt. Only the tool on a fully transparent background.

Do not draw: hands, foil, a bowl, charcoal, smoke, text, letters, logos, watermark, shadow on the ground, frames or borders.
```

### マウスピース

```text
Game UI asset, transparent background: a single shisha (hookah) hose mouthpiece, drawn large and instantly recognizable as an icon, in a polished anime game illustration style with clean outlines and two or three tone shading, no airbrushed gloss.

The object: the rigid hose handle of a Japanese shisha bar, a straight rigid tube about two palms long, slightly tapered: thicker at the hose end and a little narrower toward the mouth end. Body in glossy black anodized aluminum with a few thin engraved rings. At the thick end, a short polished brass hose adapter ring, and only a short cut-off stub of soft matte black hose attached there (no long hose). At the narrow end, a short translucent teal resin disposable tip (about the length of two fingers, clearly shorter and slimmer than the handle body).

Composition: the mouthpiece lies on a 45 degree diagonal, hose stub at the lower left, teal tip pointing to the upper right, centered and filling about 88 percent of the image diagonal. Bold readable silhouette. Only the object on a fully transparent background.

Do not draw: hands, a person, a hookah body, bowl, charcoal, smoke, a chain, a forked or second hose, text, letters, logos, watermark, shadow on the ground, frames or borders.
```

## 3回目: 作り直した絵と、専用の見た目の部品（VPL37・VPL38・15枚）

オーナー「グラム決めや水入れや雑念弾幕はもっと専用の見た目にしてクオリティ高く見せたいのでデザインして　3種類ずつ候補みたい」「画像生成とかも使ってもいい」「あとはじての吸ってる姿とかも新たに作っていい　ボトルやハガルも昔のやつで見た目しょぼいのでAPI使っていいから」。
`gpt-image-2.6-sunburst`（品質 medium）で作った。原画は `v2/`（WebP・Git LFS）、試作が読む切り出しは `remake/previews/portrait-stage/img/`。
ハガルのふんわり・ノーマル・デンスは、空のハガル（`v2/bowl-empty-original.webp`）を入力にした編集（images/edits）で、器の形・角度をそろえた。はじめの吸い出しは、正規の立ち絵 `chr_hajime_normal.webp` を入力にした編集で本人の見た目をそろえた。
ボトルは1回目（ステムの先が胴の上の方で終わり、本編の目安＝ステムの先が水位の下から3割に合わなかった）を使わず、ステムを深くした2回目を使う（生成は計15回）。

| 原画（v2/） | 試作で使う絵（img/） | 使う所 |
|---|---|---|
| `bottle-original.webp` | `ui-bottle.webp`（640×631） | 水入れのボトル（案A・案B）。案Cは同じ形を線で描く |
| `bowl-empty/airy/normal/firm-original.webp` | `ui-bowl-empty/airy/normal/firm.webp`（512×512・同じ範囲で切り出し） | 配合の器（空→ふんわり→ノーマルと満ちる）、詰め方の3枚の札 |
| `hajime-pull-original.webp` | `craft-pull-hajime.webp`（900×1350） | 吸い出しの一枚絵 |
| `gauge-original.webp` | `ui-gauge.webp` | 水入れ案B の水位計 |
| `scale-original.webp` | `ui-scale.webp` | 配合案A のはかり |
| `bowl-top-original.webp` | `ui-bowl-top.webp` | 配合案B の真上から見た器 |
| `leaf-texture-original.webp` | `ui-leaf-texture.webp` | 配合案B の葉の模様 |
| `tins-original.webp` | `ui-tin-apple/mint/lemon.webp`（1枚を3つに分けた） | 配合案C の葉の缶 |
| `bg-water/smoke/washi-original.webp` | `ui-bg-water/smoke/washi.webp`（780×1170） | 雑念よけ案A・B・C の背景 |

### 生成前に決めたこと（§4.3）

```text
ボトル
人物      : なし
場面      : 水入れ（ボトル単体）
台の型    : 日本のバーのワイドなガラスベースに、細いステンレスのステムがゴムの栓を通って真っすぐ入る（上は見切れ）
HMD       : なし／炭: なし／ホース: なし／吸い口: なし
構図      : 正面・水は入れない（水はコードで描く）。ステムの先は胴の下から約1/3

ハガル（空・ふんわり・ノーマル・デンス・真上）
人物      : なし
場面      : 配合・詰め方（器単体）
台の型    : 写さない
HMD       : なし／炭: なし／ホース: なし／吸い口: なし
構図      : 黒いシリコンの器（銅色の縁・底に5つの穴）。斜め上30度、真上は真上から。葉は口より少し下で平ら（デンスは押し固める・ふんわりはすき間あり）

はじめの吸い出し
人物      : はじめ（正規の立ち絵を入力。黒いキャップの煙の印・黒いパーカー）
場面      : 吸い出し（夜のシーシャバー、上半身）
台の型    : 写さない
HMD       : なし／炭: なし
ホース    : 1本。硬いハンドルの根元の真鍮の金具から出て、右下で画面の外へ
吸い口    : ハンドル＋青緑の使い捨てチップ（口に当てる）
構図      : 縦長の一枚絵。人物はやや左、頭は上の1/3
```

生成後の確認（§4.4・素材規約の必須チェック）: ボトルは水が無く、ステムは栓を通って真っすぐ。ハガル4枚は形・角度・大きさがそろい、炭・アルミ・HMDが無い。はじめはホースが1本で、ハンドル→金具→ホースの順につながり、分岐・第三の端・台本体が無い。帽子の印・服装は立ち絵と同じ。どの絵にも文字・ロゴ・透かしが無い。テカリ・汎用顔・擬似文字・小物の崩れも見当たらない。いずれも合格。

### ボトル（2回目・使う方）

```text
Game asset, transparent background: the glass base (water bottle) of a modern hookah as used in present-day Japanese shisha bars. Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss. Crisp glass highlights.
The base: a wide, low, round-bottomed clear glass vase with a short neck, slightly smoky glass with subtle violet reflections. A slim polished stainless-steel stem goes straight down into the neck through a black rubber grommet and continues deep inside the glass: its open tip ends low in the bowl of the vase, at about one third of the vase body's height above the inner bottom, clearly visible inside the empty glass. Only the lower part of the stem is shown: it is cut off by the top edge of the image.
The bottle is empty: no water. Front view at eye level, centered, the bottle filling about 80 percent of the width.
Do not draw: water, liquid, hose, bowl, charcoal, smoke, hands, text, logos, watermark, table, shadow on the ground.
```

### ハガル（空）

```text
Game asset, transparent background: an empty shisha tobacco bowl as used in present-day Japanese shisha bars: a black silicone bowl with a slightly glossy surface and a thin warm copper rim line, a wide shallow cup on a slim waisted neck, five small holes visible in the flat floor of the cup.
Seen from the front and slightly above (about 30 degrees), centered, filling about 80 percent of the image. Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss.
Empty. Do not draw: tobacco, foil, charcoal, smoke, hands, text, logos, watermark, shadow on the ground.
```

### 水位計

```text
Game UI asset, transparent background: an elegant vertical water-level gauge instrument: a tall clear glass tube held in an antique brass frame with top and bottom caps and small screws, fine engraved tick marks along the brass frame on both sides (no numbers), the glass tube empty.
Front view, perfectly vertical, centered, the instrument filling about 90 percent of the image height and about 30 percent of its width. Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss. Crisp highlights on glass and brass.
Do not draw: water, liquid, text, numbers, logos, watermark.
```

### はかり

```text
Game UI asset, transparent background: a compact digital kitchen scale for weighing shisha tobacco, seen from the front and slightly above (about 25 degrees): a flat square platform of black glass on a slim brushed brass body, a small dark empty display window on the front edge (completely dark, no digits) and two small round buttons beside it.
Centered, filling about 85 percent of the width. Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss. Subtle reflections. Nothing on the platform.
Do not draw: text, digits, numbers, logos, watermark, shadow on the ground.
```

### 真上から見た器

```text
Game UI asset, transparent background: a black silicone shisha tobacco bowl seen exactly from directly above (top-down view), perfectly circular: a thin warm copper rim ring, a wide flat inner floor with five small holes in the center.
Centered, filling about 90 percent of the image. Empty. Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss.
Do not draw: tobacco, foil, charcoal, smoke, text, logos, watermark.
```

### 葉の模様

```text
Seamless tileable texture: top-down close-up of moist shredded shisha tobacco leaves in a neutral light grey-beige color (so it can be tinted later), slightly glossy with molasses, fine shreds evenly spread to all edges, even soft lighting.
Polished anime game illustration style with clean shapes. No bowl, no objects, no text.
```

### 葉の缶

```text
Game UI asset, transparent background: three small round metal tins of shisha flavor tobacco, side by side with even spacing, seen from the front and slightly above, each tin open with its lid leaning against it, showing moist shredded tobacco inside.
Tin colors: left tin deep apple red, middle tin fresh mint green, right tin lemon yellow; plain enamel finish with a thin gold rim, no labels. Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss.
Do not draw: text, letters, labels, logos, watermark, shadow on the ground.
```

### 雑念よけ案A 夜の水面

```text
Vertical game background, no characters: a calm dark water surface at night seen from directly above, deep indigo and violet, faint concentric ripples spreading slowly, a soft blurred reflection of pale moonlight near the upper area, tiny floating specks of light.
Very low contrast in the center so small glowing text and symbols can be read on top. Polished anime game background art, painterly but clean. No text, no objects, no frames.
```

### 雑念よけ案B 煙の夜空

```text
Vertical game background, no characters: a dreamy inner mind space made of slowly drifting shisha smoke, deep plum and charcoal colors with soft violet and warm amber glows, layered wisps of smoke curling like a night nebula, a few tiny stars, darker toward the edges and calm in the center so small glowing text can be read on top.
Polished anime game background art, painterly but clean. No text, no objects, no frames.
```

### 雑念よけ案C 和紙と墨

```text
Vertical game background, no characters: a sheet of handmade Japanese washi paper with visible fibers in warm ivory, with very faint pale grey sumi ink wash strokes resembling drifting smoke near the edges, the center mostly plain and light so black brush text can be read on top.
Flat, evenly lit. No text, no seals, no stamps, no frames, no objects.
```

### はじめの吸い出し（立ち絵を入力した編集）

```text
Use the reference image as the exact character design: the same face, short messy black hair, black baseball cap with the white smoke-line emblem, black zip hoodie with white drawstrings, black t-shirt.
Create a new vertical game illustration (CG): an upper-body shot of this young man in a calm, cozy Japanese shisha bar at night, taking a slow draw from a hookah hose. He holds a rigid black hose handle in his right hand near his mouth; the short translucent teal disposable tip touches his lips; his eyes are half-closed in focus. A single soft black hose continues from the bottom end of the handle through a small brass adapter and leaves the frame at the lower right. A thin wisp of pale smoke drifts up beside his face.
Background: warm indirect lighting, a blurred wooden counter and hanging glass lanterns as soft bokeh, low saturation so the character reads clearly. Composition: the character slightly left of center, head in the upper third, some calm background space on the right.
Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss.
Do not draw: a second hose, a forked hose, the hookah body, a bowl, charcoal, text, letters, logos other than the cap emblem, watermark.
```

### ハガルのふんわり・ノーマル・デンス（空のハガルを入力した編集）

```text
bowl_normal: Fill this same bowl with moist shredded shisha tobacco, packed evenly and level about 2 mm below the rim, dark reddish-brown shreds glossy with molasses. Keep the bowl's shape, color, angle, size and position exactly the same. Transparent background. No foil, no charcoal, no smoke, no text.

bowl_airy: Fill this same bowl loosely with fluffy moist shredded shisha tobacco, airy with visible gaps, slightly lower than the rim, dark reddish-brown shreds. Keep the bowl's shape, color, angle, size and position exactly the same. Transparent background. No foil, no charcoal, no smoke, no text.

bowl_firm: Fill this same bowl densely with moist shredded shisha tobacco pressed flat and tight up to just below the rim, a compact dark reddish-brown surface glossy with molasses. Keep the bowl's shape, color, angle, size and position exactly the same. Transparent background. No foil, no charcoal, no smoke, no text.
```

## 4回目: 葉を写真のような質感に、はじめを背景なしに（VPL40〜42・5枚）

オーナー「シーシャの葉っぱの見た目は写真チックにリアルに　実際に調べて　なんか今ミミズみたいに見えるから」「吸ってる姿は背景はその場に応じて変えれるように　あとマウスピースの見た目が変　逆に見える　後表情も変」。
葉の見た目は、シーシャの作り方・詰め方の解説（thehookahlab.com・hookahvault.com・iconhookah.com）で確かめた: 茎を除いて小さく刻む、ブロンドリーフは黄みの橙〜明るい茶、糖蜜とグリセリンでシロップ状にしっとり、袋から出すと塊になり、ほぐしてふんわりさせてから詰める、表面は縁の1〜2mm下で軽く平らにならす。2回目の葉は長い糸状の刻みで「ミミズ」に見えたので、「小さく不規則な葉のかけら・長い糸状にしない・しっとりした照り・小さな塊」と指定し、器は絵のまま、葉だけを写真のような質感にした。
4枚とも、2回目の空の器（`v2/bowl-empty-original.webp`）を入力にした編集で、器の形・角度をそろえた。`bowl-partial` は葉が少なく底の穴が見える（配合で葉が入っていく途中）、`bowl-airy` は底まで覆ったふんわり（詰め方の札）。
はじめは、正規の立ち絵2枚（新バージョン `character_variants/new/hajime/chr_hajime_normal.webp` と、一つ前の現行 `characters/hajime/chr_hajime_normal.webp`）と1回目のマウスピースの絵（`mouthpiece-original.webp`。ホース側が太く吸い口側が細い）を入力にした編集で、背景なしの人物だけにした（オーナー「吸ってる時のはじめのデザインは新バージョンと一つ前のやつを参考に　現行ってバージョン」。服装・ネックレスなしは新バージョン、顔立ちと陰影の細かさは現行に寄せた。新バージョンだけを入力にした `hajime_pull` は使わない）。吸い口のチップを口に、ハンドルは下へ太くなり、下の金具からホースが1本出て画面の外へ。表情は立ち絵と同じ落ち着いた顔。

| 原画（v3/） | 試作で使う絵（img/） | 使う所 |
|---|---|---|
| `bowl-partial/airy/normal/firm-original.webp` | `ui-bowl-partial/airy/normal/firm.webp`（空の器と同じ範囲で切り出し） | 配合の器（空→途中→ノーマル）、詰め方の3枚の札 |
| `hajime-pull-original.webp` | `craft-pull-hajime.webp`（背景なし） | 吸い出し（場所の背景に重ねる） |

生成後の確認: 器4枚は形・角度・大きさがそろい、炭・アルミ・HMD・文字が無い。葉は長い糸状でなく小さなかけら。はじめはホースが1本で、チップ→ハンドル（下へ太くなる）→金具→ホースの順につながり、分岐・台本体・背景・文字が無い。帽子の印・服装・顔は立ち絵と同じ。いずれも合格。

### bowl_normal（入力: bowl-empty-original.webp）

```text
Fill this same bowl with real shisha (hookah) tobacco, rendered photorealistically like a macro product photograph while the bowl keeps its drawn look: finely chopped tobacco leaf pieces, small irregular torn flakes about 2 to 6 mm with faint leaf veins, NOT long strands, NOT noodles, NOT worms, NOT spaghetti; Virginia blonde leaf in amber to medium-brown tones with a few darker pieces; moist and sticky with molasses and glycerin, a soft syrupy sheen, a few small loose clumps. Packing: even density, the surface lightly pressed flat about 2 mm below the rim. Keep the bowl's shape, color, angle, size and position exactly the same. Transparent background. No foil, no charcoal, no smoke, no text.
```

### bowl_airy（入力: bowl-empty-original.webp）

```text
Fill this same bowl with real shisha (hookah) tobacco, rendered photorealistically like a macro product photograph while the bowl keeps its drawn look: finely chopped tobacco leaf pieces, small irregular torn flakes about 2 to 6 mm with faint leaf veins, NOT long strands, NOT noodles, NOT worms, NOT spaghetti; Virginia blonde leaf in amber to medium-brown tones with a few darker pieces; moist and sticky with molasses and glycerin, a soft syrupy sheen, a few small loose clumps. Packing: loose and fluffy, the flakes sprinkled in with visible air gaps between them, the surface a little uneven about 3 mm below the rim. Keep the bowl's shape, color, angle, size and position exactly the same. Transparent background. No foil, no charcoal, no smoke, no text.
```

### hajime_pull（入力: chr_hajime_normal.webp, mouthpiece-original.webp）

```text
The first reference image is the exact character design: the same face, short messy black hair, black baseball cap with the white smoke-line emblem, black zip hoodie with white drawstrings, black t-shirt. The second reference image is the exact hookah hose handle to use.
Create a new vertical game illustration of this young man only (upper body, from the head down to the waist), on a fully transparent background, taking a slow, relaxed draw from a hookah.
The hose handle: he holds the rigid black handle from the second reference loosely in his right hand. Its orientation must be correct: the short translucent teal disposable tip (the narrow end) is at his lips, the handle becomes slightly THICKER toward the lower end, and at that lower, thicker end the brass hose adapter connects to a single soft black hose that hangs down and leaves the frame at the lower right. The handle is not reversed.
Expression: calm and natural, the same face as the first reference, eyes gently open and looking slightly down toward the handle, eyebrows relaxed, lips softly closed around the tip, no exaggerated half-lidded or sleepy look. A thin wisp of pale smoke drifts from the corner of his mouth.
Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss, same rendering as the first reference.
Do not draw: any background, a second hose, a forked hose, the hookah body, a bowl, charcoal, text, letters, logos other than the cap emblem, watermark, frame.
```

### bowl_firm（入力: bowl-empty-original.webp）

```text
Fill this same bowl with real shisha (hookah) tobacco, rendered photorealistically like a macro product photograph while the bowl keeps its drawn look: finely chopped tobacco leaf pieces, small irregular torn flakes about 2 to 6 mm with faint leaf veins, NOT long strands, NOT noodles, NOT worms, NOT spaghetti; Virginia blonde leaf in amber to medium-brown tones with a few darker pieces; moist and sticky with molasses and glycerin, a soft syrupy sheen, a few small loose clumps. Packing: dense pack, pressed down firmly into a compact, slightly spongy surface about 1 mm below the rim, the flakes tighter and a little darker. Keep the bowl's shape, color, angle, size and position exactly the same. Transparent background. No foil, no charcoal, no smoke, no text.
```

### bowl_airy_full（入力: bowl-empty-original.webp）

```text
Fill this same bowl with real shisha (hookah) tobacco, rendered photorealistically like a macro product photograph while the bowl keeps its drawn look: finely chopped tobacco leaf pieces, small irregular torn flakes about 2 to 6 mm with faint leaf veins, NOT long strands, NOT noodles, NOT worms, NOT spaghetti; Virginia blonde leaf in amber to medium-brown tones with a few darker pieces; moist and sticky with molasses and glycerin, a soft syrupy sheen, a few small loose clumps. Packing: light and fluffy, the flakes completely cover the whole floor of the bowl (no holes or floor visible) but stay loose with small air pockets, the surface softly uneven about 2 to 3 mm below the rim. Keep the bowl's shape, color, angle, size and position exactly the same. Transparent background. No foil, no charcoal, no smoke, no text.
```

### hajime_pull2（使う方。入力: new/hajime/chr_hajime_normal.webp, characters/hajime/chr_hajime_normal.webp, ui/portrait-stage-20261127/mouthpiece-original.webp）

```text
The first and second reference images are two official versions of the same character, Hajime (the first is the new version, the second is the previous version). Draw exactly this character, keeping both references consistent: the same face and age (22-year-old young man, ordinary and friendly), short messy black hair, black baseball cap with the white smoke-line emblem, black zip hoodie with white drawstrings, black t-shirt. Follow the first reference for the outfit (no necklace) and the clean line art; use the second reference for the slightly more mature face and the richer, more detailed shading of the cloth and hair.
The third reference image is the exact hookah hose handle to use.
Create a new vertical game illustration of this young man only (upper body, from the head down to the waist), on a fully transparent background, taking a slow, relaxed draw from a hookah.
The hose handle: he holds the rigid black handle from the third reference loosely in his right hand. Its orientation must be correct: the short translucent teal disposable tip (the narrow end) is at his lips, the handle becomes slightly THICKER toward the lower end, and at that lower, thicker end the brass hose adapter connects to a single soft black hose that hangs down and leaves the frame at the lower right. The handle is not reversed.
Expression: calm and natural, the same face as the references, eyes gently open and looking slightly down toward the handle, eyebrows relaxed, lips softly closed around the tip. A thin wisp of pale smoke drifts from the corner of his mouth.
Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss.
Do not draw: any background, a necklace, a second hose, a forked hose, the hookah body, a bowl, charcoal, text, letters, logos other than the cap emblem, watermark, frame.
```

## VPL39〜48 で使わなくなった絵

オーナーの指摘（缶は変・水位計はいらない・雑念よけは本編の横画面のデザインを縦に）を受けて、3回目の絵のうち次は試作から外した（原画とプロンプトは記録として残す）: `v2/tins-original.webp`（葉の缶。本編の店のパッケージ `remake/img/shop/heaven10/` に替えた）、`v2/gauge-original.webp`（水位計）、`v2/bottle-original.webp`（ボトル。本編の大会公式モデルの台 `remake/img/ui/scene_props/shisha_home_pro.webp` のガラスのベースを切り出した `ui-bottle-pro.webp` に替えた）、`v2/bowl-top-original.webp`・`v2/leaf-texture-original.webp`（真上から見た器の案）、`v2/bg-water/smoke/washi-original.webp`（雑念よけの3案の背景。本編の `steam_mind_world.webp` に戻した）、`v2/bowl-airy/normal/firm-original.webp`（葉が糸状に見えたので v3 に替えた）。試作の `img/` に残るのは、ボタンの面2枚・はかり・ボトル（大会仕様の切り出し）・器5枚・吸い出しのはじめ。

## 5回目: 葉の色と照りを実物の写真に寄せる（VPL50・4枚）

オーナーが実物の写真2枚（ボウルに詰めたシーシャの葉。ブログの画像）を示して「後シーシャの葉っぱのデザインはこう　赤っぽかったり茶色っぽかったりメーカーによる」。
写真から読み取った見た目（ちぎれた葉の破片と短い刻み・シロップで濡れて強い照り・縁が透ける・小さな塊・深い赤〜赤橙と琥珀〜キャラメル色が混ざる）を言葉で指定して作り直した。写真は著作権があるため生成の入力には使っていない。
4枚とも空の器（`v2/bowl-empty-original.webp`）を入力にした編集。`v3/bowl-partial/airy/normal/firm-red-original.webp` が試作の `img/ui-bowl-partial/airy/normal/firm.webp`（4回目の琥珀色の葉は置き換えた）。

```text
Fill this same bowl with real shisha (hookah) tobacco, rendered photorealistically like a close-up photograph while the bowl keeps its drawn look: chopped molasses tobacco, irregular torn leaf pieces about 3 to 10 mm mixed with some short thin shreds, NOT long strands, NOT noodles, NOT worms; the pieces are soaked in syrup: very glossy and wet, with translucent edges, sticking together in small clumps; colors like a red-dyed fruit shisha mixed with a natural one: deep crimson red and reddish orange pieces mixed with amber and caramel brown pieces. Packing: even density, the surface lightly pressed flat about 2 mm below the rim. Keep the bowl's shape, color, angle, size and position exactly the same. Transparent background. No foil, no charcoal, no smoke, no text.
```

## 6回目: 写真のような刻み葉の素材と、炭焼きのHMD（VPL53・VPL55・3枚）

オーナー「まだフレーバーの葉の見た目がおかしい　てかてかしててベタベタ感弱かったりなんかつぶつぶしてたりAI感すごいし何かわからない」。器ごと生成すると、葉がてかてかの絵になり白い粒が出た。そこで器と葉を分けた。葉だけを、上から撮った山盛りの刻み葉の写真のような素材として2枚（赤寄り・茶色寄り、品質 high）生成し、空の器（`img/ui-bowl-empty.webp`）の口の楕円にはめ込んで、途中（まだらに置く）・ふんわり（すき間を暗くする）・ノーマル・デンス（少し暗く締める）の4段階×2色をコードで作った。原画は `v3/leaf-red-original.webp`・`v3/leaf-brown-original.webp`、試作が読むのは `img/ui-leaf-red/brown.webp`（落ちる葉の粒）と `img/ui-bowl-*.webp`・`img/ui-bowl-*-brown.webp`。
オーナー「下画面で炭をタッチして取り出すのでいいかも　上にはトング持ったはじめが映るか上に炭壺があってそこに入れるか」。3案目の「HMDへ載せる」のために、空の器を入力にした編集でハガルの上のロータス型HMDを生成した（`v3/hmd-original.webp` → `img/ui-hmd.webp`）。

### HMD の生成前に決めたこと（§4.3）

```text
人物      : なし
場面      : 炭焼き（取った炭を入れる器具の見本）
台の型    : 写さない（ハガルとHMDだけ）
HMD       : ロータス型。ハガルの口と同じ径、高さ指2本分、側面の細い通気口と床の小穴、蓋は外して写さない
炭        : なし（取った炭はコードで重ねる）
ホース    : なし／吸い口: なし
構図      : 斜め上35度。黒いシリコンのハガル（空の器を入力にして形をそろえる）。透明背景
```

生成後の確認（§4.4）: HMD は1つの型でハガルの口の上に載り、径がそろい、高さは低い。蓋・煙突・取っ手を混ぜていない。炭・アルミ・葉・文字が無い。合格。葉の素材は、白い粒・きらめき・てかりが無く、長い糸状でない。合格。

### 刻み葉の素材（赤寄り）

```text
A realistic close-up photograph taken from directly above of a small loose heap of chopped shisha (hookah) tobacco on a plain dark surface, filling the whole frame edge to edge. The tobacco is torn leaf pieces about 5 to 15 mm with some short fibrous shreds, saturated with thick molasses syrup: damp, sticky and clumped together into soft lumps with a few strings of syrup between them, a satin wet look (NOT mirror glossy, NOT plastic, NOT candy). Soft even diffuse lighting from above, natural colors, sharp focus, true-to-life texture. No white specks, no sparkles, no glitter, no sugar crystals, no water droplets, no bokeh, no bowl, no hands, no tools, no text. Color: a red-dyed fruit flavor mixed with natural leaf: deep crimson and red-brown pieces with some dark caramel-brown pieces.
```

### 刻み葉の素材（茶色寄り）

```text
A realistic close-up photograph taken from directly above of a small loose heap of chopped shisha (hookah) tobacco on a plain dark surface, filling the whole frame edge to edge. The tobacco is torn leaf pieces about 5 to 15 mm with some short fibrous shreds, saturated with thick molasses syrup: damp, sticky and clumped together into soft lumps with a few strings of syrup between them, a satin wet look (NOT mirror glossy, NOT plastic, NOT candy). Soft even diffuse lighting from above, natural colors, sharp focus, true-to-life texture. No white specks, no sparkles, no glitter, no sugar crystals, no water droplets, no bokeh, no bowl, no hands, no tools, no text. Color: a natural blonde-leaf flavor: caramel, amber and medium brown pieces with a few darker brown pieces.
```

### ハガルとHMD（空の器を入力にした編集）

```text
Use the reference image as the exact bowl: the same black silicone shisha bowl with a thin copper rim, the same shape, color, angle and size.
Draw that bowl with a lotus-type heat management device (HMD) sitting on top of it, as used in present-day Japanese shisha bars: a single short round stainless-steel cup that sits on the bowl's rim and covers the mouth of the bowl, the same diameter as the bowl's mouth and only about two fingers tall, with a few slim vertical vent slots around its side and a ring of small holes in its flat floor. The lid is removed and not shown, so the empty inside of the cup is visible from above.
Seen from the front and slightly above (about 35 degrees), centered, the bowl and HMD filling about 80 percent of the image. Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss, matching the reference.
The HMD is empty. Do not draw: charcoal, foil, tobacco, smoke, flames, a lid, a chimney, hands, tongs, text, logos, watermark, shadow on the ground. Transparent background.
```

## 7回目: 炭焼きのはじめ（VPL57・1枚）

オーナー「炭壺のとこにはコンロを持って少し熱の明かりに照らされてるはじめをかく　背景は会場によって変わる」「ヒートマネジメントに乗せる描写はいらない」。
炭壺とトングを持ち、コンロの熱の明かりに下から照らされたはじめを、背景なしの人物で生成した（会場の背景に重ねる）。入力は、新バージョンと現行の立ち絵、本編の炭壺の絵（`heat_carrier.webp`）、本編のトングを持つはじめ（`hajime_craft_heat.webp`）の4枚。原画は `v3/hajime-coal-original.webp`、試作が読むのは `img/craft-coal-hajime.webp`（800×1200）。取った炭は、左手の炭壺の口の中（絵の横73〜84%・縦80〜84%）にコードで重ねる。
6回目のHMD（`v3/hmd-original.webp`）は、この指摘で試作から外した（原画は記録として残す）。

### 生成前に決めたこと（§4.3）

```text
人物      : はじめ（新バージョンと現行の立ち絵を入力。黒いキャップの煙の印・黒いパーカー・ネックレスなし）
場面      : 炭焼き（コンロは画面の下の外。写さない）
台の型    : 写さない
HMD       : なし
炭        : なし（炭壺は空。取った炭はコードで重ねる）
ホース    : なし
吸い口    : なし
構図      : 縦長・上半身・背景なし。右手のトングは下の真ん中へ向け、左手の銅の炭壺（弓形の持ち手）は腰の高さで口が見える向き。下からコンロの暖かい明かり
```

生成後の確認（§4.4・素材規約の必須チェック）: 炭・台・HMD・ホースが無い。炭壺は本編の絵と同じ銅の壺で空。トングは1本。帽子の印・服装・顔は立ち絵と同じで、汎用の別人でない。背景・文字・ロゴが無い。テカリ・擬似文字・小物の崩れも見当たらない。合格（生成は1回）。

```text
The first and second reference images are two official versions of the same character, Hajime (the first is the new version, the second is the previous version). Draw exactly this character, keeping both references consistent: the same face and age (22-year-old young man, ordinary and friendly), short messy black hair, black baseball cap with the white smoke-line emblem, black zip hoodie with white drawstrings, black t-shirt. Follow the first reference for the outfit (no necklace) and the clean line art; use the second reference for the slightly more mature face and the richer shading of cloth and hair.
The third reference image shows his charcoal carrier seen from above: a round hammered-copper pot with an arched copper handle. The fourth reference shows him holding long slim steel tongs.
Create a new vertical game illustration of this young man only (upper body, from the head down to the waist), on a fully transparent background. He is tending charcoal on a small electric stove that is just below the bottom edge of the frame; the stove itself is NOT shown.
Pose: he leans slightly forward and looks down toward the bottom of the frame, concentrating. In his right hand he holds the long slim stainless-steel tongs, angled downward toward the bottom center of the image, the tips near the bottom edge. In his left hand he holds the copper charcoal carrier by its arched handle at about waist height on the right side of the image, tilted a little toward the viewer so that its round open mouth is clearly visible. The carrier is empty.
Lighting: the main light is the warm orange-red glow of the stove coming from below: gentle underlighting on his chin, cheeks, the underside of the cap brim, his hands, the tongs, the copper carrier and the front folds of the hoodie; the upper parts stay in calm shadow. Subtle and natural, not exaggerated.
Expression: calm and focused, natural, the same face as the references.
Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss.
Do not draw: any background, the stove, charcoal pieces, flames, sparks, smoke, a hookah, a bowl, a hose, a necklace, text, letters, logos other than the cap emblem, watermark, frame.
```

## 8回目: 寄りのコンロ（VPL65・1枚）

オーナー「炭焼きはコンロをもっとズームにするか新たにズームしたコンロを作りもう少し炭を大きく　今コンロの上に乗ってる感薄いのとコンロに対して大きすぎに見えるので」。
本編のコンロ（`remake/img/ui/making/heat_stove.webp`）を拡大すると粗くなるため、同じ絵を入力にした編集で、斜め上55度から寄りで写したコンロを作った（コイルと丸い受け皿が画面の幅の約85%、四隅・コード・つまみは画面の外）。炭は描かせず、コードで重ねる。原画は `v3/stove-zoom-original.webp`（1536×1024）、試作が読むのは `img/ui-stove-zoom.webp`（1152×768）。
生成後の確認: 本編のコンロと同じ渦巻きのコイル・銅色のさびた板・4つの爪・赤い光。炭・トング・手・煙・文字が無い。合格（生成は1回）。シーシャ台の機材ではないため §4 の8行は当てはまらない。

```text
Use the reference image as the exact design: the same small single-burner electric hot plate with a spiral heating coil, the same rusty copper-brown metal plate, the same four small support prongs around the coil, the same orange-red glow and the same polished anime game illustration style with clean dark outlines and two or three tone cel shading.
Create a close-up of this hot plate seen from the front and above at about 55 degrees: zoom in so that the round spiral coil and its circular metal tray fill most of the image width (about 85 percent), centered slightly below the middle. The square edges of the plate are cut off by the left, right and bottom edges of the frame; the cord and the knob are not visible. The coil glows a warm orange-red with a soft heat glow; the dark metal around it catches a little of that glow.
Background above the plate: dark, softly blurred, warm brown shadow.
Do not draw: charcoal, coals, tongs, hands, smoke, flames, a pot, text, letters, logos, watermark.
```

## 9回目: 口の開いたボトルと蛇口（VPL81・2枚）

オーナー「水入れはボトルをもう少し下げていいのと水の量はもう少し多めが丁度いい　ボトルの6割ぐらい　あとボトルをやや斜めにして蛇口をつけて水を入れて充していく感じで　水のリアルなゆらしも入れながら」。
蛇口の下で水を満たす場面にするため、ボトルは台から外したガラスのベース単体（ステムなし・口が開いている）にした。これまでの `img/ui-bottle-pro.webp`（本編の大会公式モデルの台 `remake/img/ui/scene_props/shisha_home_pro.webp` のベースの切り出し。ステムと襟つき）を入力にした編集で、同じ形・同じ金の渦と菱形・足の黒と金の帯のまま作った。`ui-bottle-pro.webp` は試作から外した。水・水流・しぶきは描かせず、コードで重ねる。

| 原画（`v3/`） | 試作が読む絵（`remake/previews/portrait-stage/img/`） | 使い道 |
|---|---|---|
| `bottle-open-original.webp`（1024×1536） | `ui-bottle-open.webp`（540×711） | 水入れのボトル。切り出したあと、ガラスの面だけ半透明にした（彩度の低い明るい所を約26%に、白いハイライトは約88%まで残し、金・黒・輪郭はそのまま）。内側の形はこの絵の輪郭から取り、`app.mjs` の `BOTTLE.inner` に書いた |
| `faucet-original.webp`（1024×1024） | `ui-faucet.webp`（360×310） | 水入れの蛇口（吐水口と首の下の方だけ。上は画面の外へ消える） |

生成前の8行（§4.3・ボトル）:

```
人物      : なし
場面      : 準備中（水入れ。ベース単体。ステムは外してある）
台の型    : 本編の大会公式モデルの台のガラスのベース（鐘形・金の渦と菱形・足に黒と金の帯）。ステムとの接続部（黒と金の襟）は外した状態で、口に細い金の縁
HMD       : なし
炭        : なし
ホース    : なし
吸い口    : なし
構図      : 正面・直立・ベース全体・背景なし。口は少し上から見た細い楕円で、開いていることが分かる
```

生成後の確認（§4.4・素材規約の必須チェック）: ボトルはステム・襟・水・ホース・台が無く、口が開いている。胴の形・金の渦・菱形3つ・足の黒と金の帯は入力の絵と同じ。蛇口は吐水口が真下を向き、水・流し台・レバー・手が無い。どちらも文字・ロゴ・透かしが無い。合格（生成は各1回）。蛇口はシーシャの機材ではないため §4 の8行は当てはまらない。
画像の決まり（`docs/shisha_reference.md` §4.1）は「ベースの水は下の方だけ」だが、この場面のちょうどいい水位はオーナーの指示（ボトルの6割ぐらい）に合わせた。絵そのものには水を描いていない。

```text
Use the reference image as the exact design of a glass hookah base (vase): the same bell-shaped clear glass body, the same golden swirl ornament and small golden diamond marks painted on the glass, the same black and gold bands around the wide foot, and the same polished anime game illustration style with clean dark outlines and two or three tone cel shading.
Redraw this same glass base ALONE, taken off the hookah, standing upright and seen straight from the front, as it looks when it is about to be filled with water at a sink:
- Remove the metal stem (the vertical metal tube inside the glass) completely. The inside of the glass is empty: no tube, no rod, no water.
- Remove the black and gold collar at the top. Instead, the glass narrows into a short, fairly wide open neck and ends in an open round mouth with a thin golden rim. The mouth is seen very slightly from above, so the opening reads as a narrow ellipse and it is clear that the vase is hollow and open at the top.
- Keep the proportions of the bell-shaped body and the wide foot the same as the reference. The whole vase is visible, from the open mouth at the top to the foot at the bottom, centered, with a small margin on every side.
- The glass is clear and transparent with a few clean white highlight streaks; it is completely empty and dry.
Fully transparent background.
Do not draw: a stem, a tube, a rod, a hose, a bowl, a tray, charcoal, water, drops, a table, a shadow on the ground, hands, text, letters, logos, watermark.
```

```text
Match the illustration style of the reference image (polished anime game illustration with clean dark outlines and two or three tone cel shading, shiny metal drawn with a few crisp highlight streaks). Do NOT draw the glass vase from the reference; it is only a style reference.
Draw one object only: the lower end of a polished chrome bar-sink faucet (water tap), on a fully transparent background.
The faucet comes down from above: its pipe enters from the top right corner of the image (cut off by the top edge), sweeps in a smooth gooseneck curve to the left, then bends and points straight down, ending in a short cylindrical aerator nozzle. The round opening of the nozzle points straight down and is located at the horizontal center of the image, about one third of the way down from the top. The lower two thirds of the image are empty and transparent.
Bright chrome with cool grey shading and a thin warm reflected light, a slim golden ring just above the nozzle.
Do not draw: water, drops, a sink, a wall, a handle, a lever, a hose, a glass, a bottle, hands, text, letters, logos, watermark.
```

## 10回目: ボトルの口を受け口の形に作り直し（VPL82・候補2枚から1枚）

オーナー「ボトルの水を入れる口の部分はこんな形ではない　なんかカチッとハマるので　今なんかくびれみたいになってるけど実物調べて見た目リアルにして」。
9回目のボトルは、ステムを受ける黒と金の襟を外し、くびれて広がる口にしていた（誤り）。実物は、ベースの口が短くまっすぐな太い首（日本の店で多いロシア系の台は開口約45mm）で、ステムの下の接続部がパッキンやクリック式で差し込まれてはまる（[The Premium Way の Russian base](https://thepremiumway.com/products/russian-style-shisha-base-vase-dark-snow)：45mm の口に差し込む型、[El-Badia の Russian Spirit](https://pro.el-badia.com/en/bases/1960-vase-russian-spirit-basic.html)：首の径45mm・パッキンで固定、[SmokeDex](https://smokedex.info/en/community/glossary/hookah-stem-base)：接続の型・径・パッキン・ねじ／差し込みが台ごとに違う）。
本編の大会公式モデルの台の絵（`remake/img/ui/scene_props/shisha_home_pro.webp`）の、襟から足までを切り出して入力にし、ステムだけを抜いた形で作り直した。黒と金の襟は、ステムがはまるベース側の受け口として残し、上を開けて内側にゴムのパッキンを描かせた。

| 原画（`v3/`） | 試作が読む絵（`remake/previews/portrait-stage/img/`） | 使い道 |
|---|---|---|
| `bottle-open-original.webp`（1024×1536。9回目の原画を置き換えた） | `ui-bottle-open.webp`（540×800） | 水入れのボトル。ガラスの面だけ半透明にした（9回目と同じ加工。受け口は不透明のまま）。内側の形・受け口の穴の手前の縁は `app.mjs` の `BOTTLE` |
| `bottle-open-candidate2-original.webp`（1024×1536） | 使わない | もう1枚の候補。胴が円すいに近く、足の帯の位置も元の台と違うため使わない |

生成前の8行（§4.3）:

```
人物      : なし
場面      : 準備中（水入れ。ベース単体。ステムは抜いてある）
台の型    : 本編の大会公式モデルの台のガラスのベース（鐘形・金の渦と菱形・足に黒と金の帯）。肩のすぐ上に黒と金の受け口（ベース側のクリック式の金具）。上が開いていて内側にゴムのパッキン
HMD       : なし
炭        : なし
ホース    : なし
吸い口    : なし
構図      : 正面からわずかに上・直立・ベース全体・背景なし
```

生成後の確認（§4.4・素材規約の必須チェック）: 受け口は元の台の襟と同じ幅・同じ黒と金で、肩のすぐ上に付き、くびれ・広がる口・長い首が無い。上は開いていて、内側にパッキンの輪と暗い穴が見える。ステム・管・ホースの口・水・台・文字・ロゴが無い。胴の形・金の渦・菱形3つ・足の黒と金の帯は元の台と同じ。合格（2枚のうち1枚を使う）。

```text
The reference image shows the lower part of a hookah: a black-and-gold cylindrical collar sitting on top of a bell-shaped clear glass base, and a thin metal downstem tube going down inside the glass.
Redraw exactly this glass base, with the same design and the same polished anime game illustration style (clean dark outlines, two or three tone cel shading): the same bell-shaped clear glass body, the same golden swirl ornament and three small golden diamond marks painted on the glass, the same black and gold bands around the wide foot, and the same black-and-gold collar on top.
The hookah stem has been pulled out of the base, so the base now stands alone, empty and dry, seen from the front and very slightly from above:
- The black-and-gold collar stays on the base, exactly as wide and as tall as in the reference. It is the base's click-fit socket that the stem snaps into. It sits directly on the rounded glass shoulder; between the collar and the shoulder there is no extra glass neck, no narrow waist and no flared lip.
- Because the stem is removed, the top of the collar is open: draw a wide round opening (about 75 percent of the collar width) seen as a flat ellipse, with a thin dark rubber gasket ring lining its inner edge and a slightly darker hollow inside.
- Remove the metal downstem tube completely; the inside of the glass is empty, with no rod, no tube and no water.
- The whole base is visible from the top of the collar to the foot, centered, with a small margin on every side.
- The glass is clear and transparent with a few clean white highlight streaks.
Fully transparent background.
Do not draw: the stem, a tube, a rod, hose ports, a hose, a bowl, a tray, charcoal, water, drops, a table, a cast shadow, hands, text, letters, logos, watermark.
```

## 11回目: 水入れの流し台（VPL92・候補2枚から1枚）

オーナー「水入れはシンクでやってる感伝わるようにしたいかも　店にこぼしてるみたいだし」。
店の背の作業台にある、カウンターに埋め込んだステンレスの流し台を、背景なしで描かせた（本編の隣の店の背景 `remake/img/backgrounds/bg_tonari_inside_day.webp` を、絵の具合と灯りの色の参照に渡した。部屋は描かせていない）。蛇口・水は描かせず、コードで重ねる。試作では、ボトルの足が流し台の底の前寄り（ドレンの手前）に乗るように、ボトルの大きさに合わせて置く。

| 原画（`v3/`） | 試作が読む絵（`remake/previews/portrait-stage/img/`） | 使い道 |
|---|---|---|
| `sink-original.webp`（1536×1024） | `ui-sink.webp`（1152×768） | 水入れの流し台。底の前寄りは絵の縦 86%、流し台の真ん中は横 51.4% |
| `sink-candidate2-original.webp`（1536×1024） | 使わない | もう1枚の候補。奥行きが浅く、流し台の中が見えにくいため使わない |

生成後の確認（素材規約の必須チェック）: 流し台は空で乾いていて、蛇口・水・食器・ボトル・人・壁・文字・ロゴが無い。カウンターは画面の左右の端まで続き、流し台の奥・両脇・底とドレンが見える。上半分は透明。合格（2枚のうち1枚を使う）。シーシャ台の機材ではないため §4 の8行は当てはまらない。

```text
Match the illustration style and the warm lighting of the reference image (a polished anime game background of a small Japanese shisha bar with clean outlines and soft cel shading). Do NOT draw the room from the reference; it is only a style and lighting reference.
Draw one object only, on a fully transparent background: the work sink behind the bar counter of this shisha bar, where the staff fill the glass hookah bases with water.
- A brushed stainless-steel counter top that spans the whole width of the image (cut off by the left and right edges), seen from the front and slightly from above (about 25 degrees).
- Set into the middle of the counter, one deep rectangular stainless-steel sink basin, about 60 percent of the image width. The inside of the basin is visible: the back wall, the two side walls and the flat bottom with a round chrome drain in the middle. It is empty and dry.
- The front edge of the counter is a straight horizontal band (the apron) across the whole width near the bottom of the image, with a thin dark shadow line under it.
- The whole object sits in the lower 55 percent of the image; everything above the back edge of the counter is fully transparent.
- Warm reflections of the bar lights on the steel, a few soft highlights, very clean.
Do not draw: a faucet, a tap, water, dishes, cups, bottles, hookahs, sponges, towels, people, hands, a wall, tiles, a window, text, letters, logos, watermark.
```

## 12回目: 吸い出しのはじめの絵から煙を消す（VPL96・生成なし）

オーナー「あと最初から少し煙吐いてる絵になってるからそこはなくしたい　アニメーションで煙出せばいいから」。
4回目の `craft-pull-hajime.webp`（背景なし）には、口元から右上へ細い煙が描かれていた。吸い出しでは「吸う」を押すと本編の動く煙を吐く（VPL88）ので、絵の煙は消した。画像生成は使っていない。

- 消し方: 口元の右の範囲（横 440〜780・縦 190〜430）で、白っぽく色の薄い画素と縁の半透明の画素のうち、透明な背景からつながっているものだけを透明にした（目の白・吸い口の照りなど、人物の内側の白は残る）。
- 口の横で煙の下になっていた頬は、隣の肌の色で埋め、あごの線を吸い口までつないだ。
- 人物・吸い口・ホース・顔は変えていない。原画 `v3/hajime-pull-original.webp` はそのまま残す（煙が描かれた元の絵）。

| 原画 | 試作で使う絵（img/） | 使う所 |
|---|---|---|
| `v3/hajime-pull-original.webp`（変えていない） | `craft-pull-hajime.webp`（798×1200・煙を消した） | 吸い出しのはじめ |

## 13回目: 吸い出しで吐く時のはじめ（VPL100・候補2枚から1枚）

オーナー「シーシャの吸い出しで煙を吐く時はホース加えたままではなく吐いてる見た目にして」。
`gpt-image-2.6-sunburst` の編集（images/edits・品質 high・背景は透明・1024×1536・2枚）で作った。鍵は環境変数から読み、値は記録していない。入力は、12回目で煙を消した `craft-pull-hajime.webp`（くわえている絵）1枚だけ。同じ絵の「次の瞬間」として、口と手元だけを変えるよう指示した。そのため、人物の位置・大きさは元の絵とほぼ同じになった（帽子・頭・肩の左右の端のずれは 1024 幅で数ピクセル）。

試作では、「吸う」を押して少しあと、くわえた絵の上にこの絵を重ねて出し、開いた口元から煙を吐く。吐き終わって少ししたら、くわえた絵へ戻す。

### 生成前に決めた8行（§4.3）

```
人物      : hajime（今の吸い出しの絵＝正規の立ち絵2枚から作った4回目の絵を、そのまま入力にする）
場面      : 完成・喫煙（吸った直後に、吸い口を口から離して吐く）
台の型    : 画面に入れない（人物だけ・背景なし）
HMD       : 画面に入れない
炭        : 画面に入れない
ホース    : 右手の硬いハンドルの下の金具 → ホース1本 → 画面の右下の外へ（元の絵と同じ）
吸い口    : 使い捨てチップ（青緑の半透明）をハンドルの先に装着。口から手のひら1つ分離す
構図      : 元の絵と同じ（腰から上・帽子の上端まで・背景なし）。手を胸の高さへ下げ、チップは右上を向く
```

| 原画（v3/） | 試作で使う絵（img/） | 使う所 |
|---|---|---|
| `hajime-exhale-original.webp`（1024×1536） | `craft-pull-hajime-exhale.webp`（798×1200・元の絵と同じ大きさ） | 吸い出しで吐く間。開いた口の前（横 55%・縦 28.7%）から煙を出す |
| `hajime-exhale-candidate2-original.webp`（1024×1536） | 使わない | もう1枚の候補。ハンドルを縦に立てて持ち、手が下の金具寄り。元の絵のハンドルの斜めの向きとつながりにくいので使わない |

生成後の確認（§4.4）: 人物は元の絵と同じ（顔・髪・帽子の印・パーカー・左手はポケット）。ハンドルは向きが正しく（チップが細い側・下へ太くなる・下の端に真ちゅうの金具）、ホースは金具からの1本だけで、画面の右下の外まで途切れず、分岐・3つ目の端がない。チップは唇から離れている。口は小さく丸く開き、頬はふくらませていない。煙・湯気・台の本体・ハガル・炭・文字・ロゴ（帽子の印のほか）が無い。背景は透明。合格（2枚のうち1枚を使う）。

```text
This image is the exact base illustration. Edit it into the next moment while keeping it the same picture: the same young man (Hajime), the same face and age, short messy black hair, black baseball cap with the white smoke-line emblem, black zip hoodie with white drawstrings, black t-shirt, the left hand in the hoodie pocket, the same art style, line weight, cel shading and colors, the same framing, size and position on the canvas (head, shoulders and body exactly where they are now), and the fully transparent background.
Change only this: he has just finished a draw and has taken the hookah hose handle away from his mouth to exhale.
- His right hand, still loosely holding the same rigid black handle, has moved down and slightly forward to about chest height. The handle is held diagonally with the short translucent teal disposable tip pointing up and to the right, clearly away from his face, about a hand's width below and in front of his chin. The tip does not touch his lips.
- The handle keeps its correct orientation and shape: the teal tip is the narrow end, the handle becomes slightly thicker toward the lower end, and at that lower end the brass hose adapter connects to exactly one soft black hose that hangs down and leaves the frame at the lower right. No second hose, no forked hose, no break in the hose.
- Mouth: lips slightly parted in a small, relaxed, rounded opening, as if gently blowing out. Eyes calm, looking slightly down, the same calm and natural expression (no exaggerated pursed lips, no puffed cheeks).
- Do not draw any smoke, vapor or mist anywhere. The smoke is animated separately in the game.
Polished anime game illustration style with clean dark outlines and two or three tone cel shading, no airbrushed gloss.
Do not draw: any background, smoke, a necklace, a second hose, a forked hose, the hookah body, a bowl, charcoal, text, letters, logos other than the cap emblem, watermark, frame.
```

## 14回目: 水入れの流し台を、ボトルと同じ低い目線で蛇口ごと作り直す（VPL101・候補2枚から1枚）

オーナー「水入れゲームシンクとボトルのサイズや立体感が変」。11回目の流し台は高い所から見下ろした絵で、横から見たボトルと目線が合っていなかった。ボトルの方が流し台より大きく見え、足は流し台の手前に浮いていた。蛇口の先も宙に浮いていた。
`gpt-image-2.6-sunburst` の編集（images/edits・品質 high・背景は透明・1536×1024・2枚）で作った。鍵は環境変数から読み、値は記録していない。入力は2枚で、店の背景 `remake/img/backgrounds/bg_tonari_inside_day.webp` は絵柄と光の参考、ボトル `remake/previews/portrait-stage/img/ui-bottle-open.webp` は目線をそろえる参考にした（どちらも描かないよう指示）。

試作に入れる時の手直し（生成はしていない）:
- 蛇口のまっすぐな柱の所（絵の上から300行目）の1行を323行くり返して、首を伸ばした。吐水口からカウンターの手前の縁までを、ボトルの口から足の少し上までの長さに合わせるため（柱は上下に一様なので、伸ばしても形は変わらない）。
- 縮めて 1152×1010 にした。

試作では、吐水口がボトルの口の真上（FAUCET.nx・ny）に来るよう置き、流し台の幅をボトルの約2倍にした。カウンターの手前の縁から下（絵の縦 85.3% より下）は、同じ絵をもう1枚ボトルの上に重ねて、ボトルの足を隠す。

| 原画（v3/） | 試作で使う絵（img/） | 使う所 |
|---|---|---|
| `sink-low-original.webp`（1536×1024） | `ui-sink-faucet.webp`（1152×1010・柱を伸ばした） | 水入れの流し台と蛇口（奥）と、カウンターの手前の縁（ボトルの上） |
| `sink-low-candidate2-original.webp`（1536×1024） | 使わない | もう1枚の候補。流し台の中が浅く見え、ボトルを入れた時に中の奥行きが出にくいため使わない |

11回目の `ui-sink.webp` と、9回目の蛇口 `ui-faucet.webp` は試作で使わなくなったので、`img/` から外した（原画は v3/ にそのまま残す）。

生成後の確認（素材規約の必須チェック）:
- 流し台は空で乾いている。水・ボトル・食器・人・壁・文字・ロゴが無い。
- 目線は低く、カウンターの手前の縁がまっすぐな横線。流し台の床は手前の縁に隠れ、奥と左右の内側の壁が見える。
- 蛇口はカウンターの奥に1本だけ立ち、首を曲げて吐水口が下を向く。
- カウンターより上は透明（蛇口のほか）。
- 合格（2枚のうち1枚を使う）。シーシャ台の機材ではないため、§4 の8行は当てはまらない。

```text
Match the illustration style and the warm lighting of the first reference image (a polished anime game background of a small Japanese shisha bar with clean outlines and soft cel shading). Do NOT draw the room from it; it is only a style and lighting reference.
The second reference is the glass water base of a hookah that will be placed into this sink later by the game. Match its viewing angle exactly: seen straight from the front, with the eye only a little above the counter (looking down about 15 degrees). Do NOT draw that glass base.
Draw on a fully transparent background one object only: the work sink of this shisha bar with its faucet, where the staff fill the glass hookah bases with water.
- A brushed stainless-steel counter that spans the whole width of the image (cut off by the left and right edges). Because the eye is low, the counter top is a fairly thin band in perspective. The front edge of the counter top is one straight horizontal line at about 80 percent of the image height; below it, the vertical front face of the counter (a plain stainless apron) continues down to the bottom edge of the image.
- Set into the counter, centered, one deep rectangular stainless-steel sink basin about 68 percent of the image width. From this low angle you look into it: the inner back wall and the two inner side walls are visible in perspective, and the basin floor is hidden behind the front edge of the counter.
- On the back part of the counter, behind the basin and a little left of center, a tall gooseneck bar faucet in brushed stainless steel: a round base, a vertical column rising high above the counter, a smooth arch at the top, and a short spout that points straight down, ending exactly above the horizontal center of the image at about 15 percent of the image height from the top. One small lever handle on the column.
- Everything above the back edge of the counter is fully transparent except the faucet.
- Warm reflections of the bar lights on the steel, a few soft highlights, very clean.
Do not draw: water, a hookah, a glass base, bottles, glasses, dishes, sponges, towels, people, hands, a wall, tiles, a window, text, letters, logos, watermark.
```

## 15回目: 縦長のキッチンタイマー（VPL127・生成なし）

オーナー「どの案も微妙　さらに考え直して」（蒸らしのタイマーの場面の空き）。空きに物を足すのでなく、タイマーそのものを縦画面の形にした。
新しく生成はしていない。本編の `remake/img/ui/making/kitchen_timer.webp`（1280×853）を部品に分け、等倍のまま組み直した。線の太さと角の丸みは元の絵と同じ。

- 本体: 上の縁（0〜150行）と、下の縁と影（695〜853行）は元のまま。間は、むらの無い516行目の1行をくり返して伸ばした（横幅は元のまま）。
- 液晶（145〜1125・150〜492）: 角の64pxを保って、縦だけ 600px に伸ばした。
- ボタン: 灰（140〜345・525〜690）と緑（578〜908・525〜690）を、角を保って伸ばした（左右52・上44・下56px は元のまま）。2段に並べた。上の段は分・秒（灰）、下の段はリセット（灰・幅36%）とスタート＆ストップ（緑）。
- 出来上がりは 1280×1672（`remake/previews/portrait-stage/img/ui-kitchen-timer-tall.webp`）。液晶の数字と、ボタンの字は試作が上に重ねる（絵に焼き込まない）。

| 元の絵 | 試作で使う絵（img/） | 使う所 |
|---|---|---|
| `remake/img/ui/making/kitchen_timer.webp`（本編・1280×853） | `ui-kitchen-timer-tall.webp`（1280×1672・組み直し） | 蒸らしのタイマーの場面の案D |
