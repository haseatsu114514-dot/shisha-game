# TRPG キャラクターシート用の画像（Codexへの指示書・未生成）

2026-11-01 の卓の再構成で、各PL席とキャラクターシートに**作中のPC**を表示し、表紙の「キャラクターを作る」で**はじめが演じるPCの見た目**を4種から選べるようになった。
画像が揃うまでは、見た目は色つきのシルエット（頭文字入り）、仲間のPCはプレイヤー本人の立ち絵で代用している。
**画像を置いてJSONのパスを書くだけで切り替わる（コード変更不要）。**

## 必要な画像と組み込み先

| 用途 | 枚数 | 原画（透過PNG・512×512） | 配信（lossless WebP） | JSONに書く場所 |
| --- | --- | --- | --- | --- |
| はじめのPCの見た目（通常編） | 4 | `assets/ui/trpg/look-ordinary-<id>.png` | `remake/img/ui/trpg/look-ordinary-<id>.webp` | `data/dialogue/trpg_ordinary.json` → `builder.looks[].portrait` に `"../../img/ui/trpg/look-ordinary-<id>.webp"` |
| はじめのPCの見た目（サメ編） | 4 | `assets/ui/trpg/look-shark-<id>.png` | `remake/img/ui/trpg/look-shark-<id>.webp` | `data/dialogue/trpg_shark.json` → `builder.looks[].portrait` |
| 仲間のPC（固定） | 6 | `assets/ui/trpg/pc-<id>.png` | `remake/img/ui/trpg/pc-<id>.webp` | 各JSONの `cast[].sheet.portrait` |

- 見た目の id（通常編）: `ink` 黒髪の店番／`ash` 灰色の髪の店番／`rust` 赤茶の髪の店番／`moss` 眼鏡の店番
- 見た目の id（サメ編）: `ink` 黒髪の甲板員／`salt` 潮やけの甲板員／`rust` 赤毛の甲板員／`deep` 長髪の甲板員
- 仲間のPC id: `nico`（ニコ・アダム）/ `luca`（ルカ・つむぎ）／ `otto`（オット・ひより／アダム代役）/ `sera`（セラ・つむぎ）。通常編のフィン・サメ編のレンは「見た目」で置き換えたので不要。
- 見た目は**出自（見習い店番／船乗り帰り／本好きの常連 など）や名前に依存しない**絵にする。どの出自でも同じ顔を使う。性別は曖昧でよい（プレイヤーが名前を決める）。
- 本編の人物（はじめ・アダム・つむぎ・ひより）に似せない。作中の架空人物。
- 画面では丸窓（直径 58〜64px、表紙 60px、シート 58px）で表示する。胸から上・正面寄り・背景透過。

## Codexへのプロンプト（そのままコピペ・2枚のシートで生成）

```
--- 1/2: look-sheet.png ---
Generate ONE sprite sheet image, 2048x1024, transparent background (PNG), containing 8 circular character portrait medallions
in a 4x2 grid (4 columns, 2 rows), each medallion 460x460 px with even spacing and a transparent margin inside every cell.
Style: painterly storybook ink-and-watercolor bust portrait, soft warm lamplight, muted palette (teal, walnut brown, parchment, brass),
consistent across all eight. Shoulders-up, facing slightly left, calm neutral-to-gentle expression, androgynous young adult (18-24),
so a player can give them any name. No text, no numbers, no logos, no frames (the game draws the round frame), no watermark,
no shisha pipes, no real brands, no resemblance to any existing character.

Row 1 (port-town tea house shop hand, story "The Most Ordinary Cup"; linen shirt and a shop apron):
--- a: look-ordinary-ink --- short messy black hair, dark eyes.
--- b: look-ordinary-ash --- long ash-grey hair tied back low, pale.
--- c: look-ordinary-rust --- sun-tanned skin, curly rust-brown hair.
--- d: look-ordinary-moss --- round glasses, moss-green vest over the shirt, neat brown hair.
Row 2 (sea-lounge deckhand, story "The Shark Doesn't Wait for Closing"; orange life vest over a tee, damp hair, night sea lighting):
--- e: look-shark-ink --- short black hair, determined look.
--- f: look-shark-salt --- sun-bleached pale hair, tanned, freckles.
--- g: look-shark-rust --- red hair held by a dark bandana.
--- h: look-shark-deep --- long wet dark-blue hair, dark rain coat with the hood down.

--- 2/2: pc-sheet.png ---
Generate ONE sprite sheet image, 1536x1024, transparent background (PNG), containing 6 circular character portrait medallions
in a 3x2 grid, each 460x460 px with even spacing. Same painterly ink-and-watercolor style and palette as the first sheet.
No text, numbers, logos, frames or watermark.
--- 1/6: pc-nico --- Nico, aroma guide at the tea house, late twenties, warm brown skin, tidy curly hair, rolled sleeves, confident smile, small brass scoop in hand.
--- 2/6: pc-luca --- Luca, window-seat painter, early twenties, pale, long straight hair tucked behind one ear, quiet gaze, pencil behind the ear.
--- 3/6: pc-otto --- Otto, aroma researcher on the sea lounge, thirties, round glasses, neat side-parted hair, lab coat over a sweater, nervous but kind.
--- 4/6: pc-sera --- Sera, lighting operator on the sea lounge, twenties, cropped hair with a headlamp pushed up, dark work jacket, calm and fearless.
--- 5/6: (leave empty / transparent)
--- 6/6: (leave empty / transparent)
```

## 受け取ったあと（こちらの作業）

1. 各シートを格子で切り出し、`pc-<id>.png` / `look-<story>-<id>.png`（512×512・透過）に正規化して `assets/ui/trpg/` へ。新規画像は Git LFS（`git lfs ls-files` で確認）。
2. lossless WebP に変換して `remake/img/ui/trpg/` へ。`python3 remake/tools/build_manifest.py` は不要（manifest 外の画像）。
3. JSON の `portrait` にパスを書く。表紙・宣言カード・判定画面・シート・座席で丸窓が切り替わるのを `remake/trpg-preview.html` で目視確認する。
4. この README に生成日・SHA-256・目視QAの結果を追記する（`generation.json` 推奨）。
