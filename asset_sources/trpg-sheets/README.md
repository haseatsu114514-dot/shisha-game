# TRPG キャラクターシート用のPC似顔絵（Codex生成依頼・未生成）

2026-11-01 の卓の再構成で、各PL席とキャラクターシートに **作中のPC（フィン・ニコ・ルカ／レン・オット・セラ）** を表示するようになった。
現行はプレイヤー本人（はじめ・アダム・つむぎ・ひより）の立ち絵を丸窓に入れて代用している。PCの似顔絵が揃えば、
`data/dialogue/trpg_*.json` の `cast[].sheet.portrait` に配信パスを書くだけで、シート・行動宣言・判定画面の丸窓がPCの絵に切り替わる（コード変更不要）。

- 原画の保存先: `assets/ui/trpg/pc-<id>.png`（透過PNG・512×512）
- 配信: `remake/img/ui/trpg/pc-<id>.webp`（lossless）→ `sheet.portrait` に `"../../img/ui/trpg/pc-<id>.webp"`
- id: `fin` `nico` `luca`（世界一普通の一台）／ `ren` `otto` `sera`（サメは閉店を待たない）
- 本編人物・既存立ち絵の設定は変えない。PCは作中の架空人物で、本編キャラに似せない。

## Codex用プロンプト（1ブロックでコピペ）

```
Generate ONE sprite sheet image, 1536x1024, transparent background (PNG), containing 6 circular character portrait medallions
arranged in a 3x2 grid (3 columns, 2 rows), each medallion 460x460 px with even spacing. Style: painterly storybook ink-and-watercolor
bust portrait, soft warm lamplight, muted harbor palette (teal, walnut brown, parchment, brass), consistent across all six.
Shoulders-up, facing slightly left, gentle expressions. No text, no numbers, no logos, no borders drawn around the medallions
(the game draws the frame), no watermark, no shisha pipes, no real brands.

Row 1 (port-town tea house crew, story "The Most Ordinary Cup"):
--- 1/6: pc-fin --- Fin, apprentice shop hand, late teens, short dark messy hair, apron over a linen shirt, earnest and a little flustered.
--- 2/6: pc-nico --- Nico, aroma guide, late twenties, warm brown skin, tidy curly hair, rolled sleeves, confident smile, holds a small brass scoop.
--- 3/6: pc-luca --- Luca, window-seat painter, early twenties, pale, long straight hair tucked behind one ear, quiet gaze, pencil behind the ear.
Row 2 (sea lounge crew, story "The Shark Doesn't Wait for Closing", shark-movie poster flavor but still painterly):
--- 4/6: pc-ren --- Ren, rookie deckhand, late teens, wind-blown short hair, life vest over a tee, grinning, ready to run.
--- 5/6: pc-otto --- Otto, aroma researcher, thirties, round glasses, neat side-parted hair, lab coat over a sweater, nervous but kind.
--- 6/6: pc-sera --- Sera, lighting operator, twenties, cropped hair with a headlamp pushed up, dark work jacket, calm and fearless.

Keep every medallion fully inside its cell with a transparent margin. Do not draw frames, names, stats or dice.
```

受け取ったら 3×2 で切り出し、`pc-<id>.png`（512×512）に正規化してから lossless WebP へ変換し、`generation.json` に生成指示・SHA-256・目視QAを残す。
