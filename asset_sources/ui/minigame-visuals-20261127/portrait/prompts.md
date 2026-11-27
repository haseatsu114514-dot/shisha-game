# 縦画面の試作用: 実際に送ったプロンプト
モデル `gpt-image-2.6-sunburst`・`/v1/images/edits`（参照画像つき）・quality high。2026-11-27 生成。

## `tk_deck.png` — 1536x1024・背景 opaque

参照画像:
- remake/img/ui/tetsuko/prop_box.webp（段ボール箱。色と筆づかいの参照）
- remake/img/ui/tetsuko/ui_tk_card.webp（紙の札。紙の色と線の参照）

```text
A flat background texture for a mobile game control panel: the inside floor of a kraft cardboard box seen straight from above. Warm honey-brown corrugated cardboard with soft worn creases, faint fibres, a few subtle scuffs and one or two tiny faint cat paw prints pressed into the surface. Along the very top edge runs a thin strip showing the cut corrugated edge of the cardboard (the wavy fluting between two liners), like a rim. Evenly lit, slightly darker toward the bottom corners, no strong shadows. Hand-painted cosy anime game UI style matching the cardboard box and paper card in the reference images (same warm palette, soft brush texture, dark brown ink outlines only on the top rim). The left and right edges must tile seamlessly. No objects, no text, no letters, no logos, no UI buttons. Fill the whole canvas edge to edge.
```

## `tk_book_portrait.png` — 1024x1536・背景 transparent

参照画像:
- remake/img/ui/tetsuko/ui_tk_book.webp（横開きの手帳。画風・色・線の参照）
- remake/img/ui/tetsuko/ui_tk_card.webp（紙の札）

```text
A vertical top-opening ring-bound notebook lying open and flat, seen straight from above, for a cosy cat-themed mobile game UI. It opens upward like a reporter's notepad: one tall kraft cardboard cover as the backing, with TWO cream paper pages stacked vertically on it - an upper page and a lower page of the same width - separated across the middle by a horizontal row of metal spiral rings. Both pages are completely blank cream paper with a very faint paper grain; the upper page is slightly taller than half, the lower page fills the rest. The brown kraft cover shows as an even border about 4 percent wide around the pages, with rounded corners, a small orange ribbon bookmark hanging from the bottom edge and a tiny stamped paw print on the cover corner. Same hand-painted style, warm palette, dark brown ink outline and paper colours as the open notebook in the reference image. The notebook fills almost the whole canvas (portrait orientation), centred, perfectly straight (not rotated), isolated on a fully transparent background. No text, no letters, no numbers, no drawings on the pages.
```

## `desert_stats.png` — 1536x1024・背景 transparent

参照画像:
- remake/img/ui/desert_ride_controls/boost.webp・jump.webp（操作ボタン。革と金の作りの参照）
- remake/img/ui/desert_ride_result/medal_s.webp（結果のメダル）

```text
A sprite sheet of SIX game result icons arranged in a strict 3 columns x 2 rows grid on a fully transparent background, each icon centred in its own equal cell with generous empty margin around it and nothing crossing between cells. All six share one style: chunky hand-painted desert adventure game UI emblems, like small embossed leather-and-gold badges - warm cream and gold shapes with orange accents, dark brown outline, soft highlight, matching the buttons and medal in the reference images. No text, no letters, no numbers anywhere. Top row, left to right: (1) a stopwatch with a single hand - meaning run time; (2) three chain links joined in a row with a small flame above them - meaning combo; (3) a sandboard flipped upside down with a small puff of sand and two impact stars - meaning a fall. Bottom row, left to right: (4) a sandboard landing flat on a dune with a downward arrow above it and a ring around the landing point - meaning landing; (5) a sandboard with two curved arrows circling around it - meaning a spin trick; (6) a bold lightning bolt inside a burst - meaning boost. Each icon is simple, bold and readable at 48 pixels.
```
