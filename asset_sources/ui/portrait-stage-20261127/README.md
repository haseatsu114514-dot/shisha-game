# 縦画面C案の試作で使う生成画像（2026-11-27）

オーナー「画像生成APIが使えるようになったので再度練ったり作ってみて生成を取り入れて　2.6サンバーストを使う」（要望台帳 VPL25・VPL26）。
縦画面C案の試作 `remake/previews/portrait-stage/` のために、OpenAI の画像生成 API（モデル `gpt-image-2.6-sunburst`、1024×1024、品質 medium）で作った。
このフォルダには原画（WebPに変換したもの）とプロンプトを残す。試作が読むのは、切り出して縮めた `remake/previews/portrait-stage/img/` の5枚。
本編の画面にはまだ組み込んでいない（試作の合格後に、本編の素材の置き場と規格に合わせて作り直す）。

| 原画 | 試作で使う絵 | 使う場所 |
|---|---|---|
| `lens-original.webp` | `img/hole-lens.webp`（中央を640×640で切り出し。アルミの線は上から約43%） | 穴あけの左のルーペ（断面） |
| `needle-original.webp` | `img/hole-needle.webp`（不透明な所だけ切り出し） | 穴あけのルーペの針 |
| `abtn-original.webp` | `img/ui-button.webp`（512×512） | 丸ボタン（行く・次へ・決める・刺す・吸う）の面 |
| `dpad-original.webp` | `img/ui-dpad.webp`（512×512） | 輪の十字キーの面 |
| `loupe-original.webp` | `img/ui-loupe.webp`（512×512） | 穴あけのルーペの縁 |

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

