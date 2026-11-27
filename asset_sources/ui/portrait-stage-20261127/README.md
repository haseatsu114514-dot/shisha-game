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

