# ミニゲームの見た目用の生成画像（2026-11-27）

オーナー「ミニゲームのUIや見た目を、ソシャゲや市販ゲームみたいに。最新のイメージ2.6をAPIから使い画像生成も駆使して」「文字で説明しすぎずUIやボタンで視覚的にわかるよう設計していきたい」「画像生成には gpt-image-2.6-sunburst を使ってください」（要望台帳 2026-11-27 の節・DSR98）。

OpenAI の画像 API（`gpt-image-2.6-sunburst`）で生成した原画と、送ったプロンプトの記録。ゲームに入れた絵は、ここから縮小・変換した WebP。

## 砂丘（DESERT RIDE）— `desert/`

採用 7 枚（生成は 8 回。1枚めの試し＝よけるの図解の中画質版は不採用で、保存していない）。

| 原画（`desert/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `how_dodge.png` | 遊び方の図解「よける」 | `remake/img/ui/desert_ride_howto/how_dodge.webp` |
| `how_jump.png` | 遊び方の図解「大ジャンプ」 | `…/how_jump.webp` |
| `how_spin.png` | 遊び方の図解「スピン」 | `…/how_spin.webp` |
| `how_boost.png` | 遊び方の図解「ブースト」 | `…/how_boost.webp` |
| `how_carve.png` | 遊び方の図解「カーブ」 | `…/how_carve.webp` |
| `how_flow.png` | 遊び方の図解「砂流れ」 | `…/how_flow.webp` |
| `title_bg.png` | 入口の背景（旗のコースとゴールの見える砂丘） | `remake/img/ui/desert_ride/title_bg.webp` |

- **変換**: 図解は 1536×1024 → 768×512 の WebP（quality 86）。入口の背景は**左右を反転**してから上の 1536×864（16:9）を切り出した WebP（旗のコースが左＝人物の側へ来るように。右は板が載る）。
- **参照画像**: 滑走で採用済みの絵（はじめの背面の各姿勢・岩・カーブの看板・旗・遠景）と、滑走中の実画面を毎回渡して、人物と砂丘の描き方をそろえた（`desert/prompts.md` に1枚ごとの一覧）。
- **検品**（`docs/asset_ai_guidance.md` の必須項目）: 人物は背面だけで顔が写らない／服・髪・板の色は滑走の絵と同じ／文字・擬似文字なし（カーブの看板は矢印の記号だけ）／手・足・板のつながりに崩れなし／実画面で滑走の絵と並べて同じ描き手に見えることを確認。シーシャの機材は写っていない。
- **組み込み**: `remake/js/minigames/desert-ride.js` の `HOWTO_CARDS`・`howCard`、`remake/css/desert-ride.css` の「遊び方の図解」と入口の背景。
- 原画の SHA-256（先頭16桁）: `how_dodge` 7def0cba9882924c, `how_jump` 4d91ae213f79b358, `how_spin` b95c7dc31b25279f, `how_boost` b6cd0b55d2acd67f, `how_carve` a0a4011802e42699, `how_flow` 14256360440d7249, `title_bg` 73ce60a30fb06f67

## 店番（フロア営業）— `floor/`

採用 3 枚（生成は 4 枚。枠は2枚生成し、まん中に半透明のむらが出た1枚めは不採用で、保存していない）。

| 原画（`floor/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `frame.png` | 開店前・休止・精算の窓の枠（九分割） | `remake/img/ui/tonari-floor/frame-ornate.webp` |
| `ornament.png` | 開店前の窓の上の飾り（モザイクランプと唐草） | `remake/img/ui/tonari-floor/deco-ornament.webp` |
| `ribbon.png` | 営業の名前・「本日の精算」の題札 | `remake/img/ui/tonari-floor/deco-ribbon.webp` |

- **変換**: 透過の余白を切り落として、枠は 768×768、飾りは幅 1100、題札は幅 1000 の WebP（quality 90）。
- **参照画像**: 採用済みの部品（板 `panel`・金の札 `card-primary`・ランプ `lamp-on`・メダル `medal-s`）を渡して、材質（茄子紺の漆・真鍮・モザイクの石）をそろえた（`floor/prompts.md`）。
- **検品**: 文字・擬似文字なし／シーシャの機材は描いていない（ランプと唐草だけ）／枠は四隅だけに飾りがあり、辺はまっすぐな二重線（九分割で伸ばしても崩れない）／透過の縁に色のにじみなし／実画面で既存の部品（金の札・気分の札）と並べて確認。
- **組み込み**: `remake/css/tonari-floor.css` の「開店前・休止・精算の窓の見た目」（TFL67）。
- 原画の SHA-256（先頭16桁）: `frame` 942047f941c64e6c, `ornament` e60626ea4815baa7, `ribbon` 883cfbdaf9987a4a

