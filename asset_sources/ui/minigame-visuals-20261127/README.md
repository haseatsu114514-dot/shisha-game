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

## 斧投げ — `axe/`

採用 4 枚（生成 4 枚）。オーナー「斧投げとボドゲも頼む」（AXV01）。

| 原画（`axe/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `how_aim.png` | 遊び方の図解「ねらう」（横と縦の線が赤い中心で交わる） | `remake/img/ui/axe_throw/howto/how_aim.webp` |
| `how_throw.png` | 遊び方の図解「投げる」（手元の斧と、上へ弾く矢印） | `…/how_throw.webp` |
| `how_score.png` | 遊び方の図解「得点」（刃が赤い中心に刺さる） | `…/how_score.webp` |
| `how_killshot.png` | 遊び方の図解「キルショット」（青い点に刺さる） | `…/how_killshot.webp` |

- **変換**: 1536×1024 → 768×512 の WebP（quality 86）。
- **参照画像**: 斧投げの実画面（レーンと的）・的の切り出し・斧の絵を渡して、木のレーン・的の輪と赤青の点・斧の形をそろえた（`axe/prompts.md`）。
- **検品**: 人物は手だけ（顔なし）／文字・数字なし（実物の的にある 1〜4 の数字は入れていない）／的の輪・赤い点・青い点の並びは実物と同じ／斧の刃と柄のつながりに崩れなし／実画面のレーンと並べて確認。シーシャの機材は写っていない。
- **組み込み**: `remake/js/minigames/axe-rules.js` の `HOW_CARDS`、`remake/css/axe-throw.css` の「遊び方の図解」。
- 原画の SHA-256（先頭16桁）: `how_aim` 2d01e9a07476156a, `how_throw` 9544f0db51cc9902, `how_score` 654bef0b970bffe6, `how_killshot` e7b5b50ed827170a

## ボドゲカフェ（TRPG）— `trpg/`

採用 3 枚（生成 4 枚）。オーナー「斧投げとボドゲも頼む」（TRP10）、「本をめくってシナリオを決めるような洒落たものにしたい」（TRP11）。

| 原画（`trpg/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `book_locked.png` | 本棚の未解放の本の札（鎖と錠の掛かった本） | `remake/img/ui/trpg/book-locked.webp` |
| `dice_icon.png` | マイダイスを買う札の絵（透過） | `remake/img/ui/trpg/icon-dice.webp` |
| `book_open.png` | 物語を選ぶ画面の、開いた本（透過。紙面は無地で、絵と字は画面が重ねる）（TRP11） | `remake/img/ui/trpg/book-open.webp` |

- **変換**: 本は 768×512 の WebP（quality 86）。ダイスは透過の余白を切り落として 256×256 の WebP（quality 92）。開いた本は透過の余白を切り落として 1526×995 の WebP（quality 88・約87KB）。紙面の位置（横 6.0〜49.2%／51.3〜94.6%、縦 3.4〜89.0%）を測って、CSS の置き場に使っている。
- **参照画像**: 本棚の実画面と TRPG の場面絵を渡して、深い青緑と真鍮の配色・背景の描き方をそろえた（`trpg/prompts.md`）。
- **開いた本の検品**（2案から1案目を採用。2案目は紙面が少し広いが、本が画像の上端と左右の端に接していて、表紙の縁が切れていた。1案目も左の端には接しているが、角の金具と小口は欠けていない）: 真上から見た歪みのない見開き／左右の頁が同じ大きさ／紙面に字・絵・線・しみなし／透過の縁に色のにじみなし／実画面で絵・題・ボタンを重ねて、紙面からはみ出さないことを確認。
- **検品**: 文字・数字なし（本の表紙に題字なし。ダイスの面は星と点だけで、数字は入れていない）／鎖と錠のつながりに崩れなし／透過の縁に色のにじみなし／実画面で他の本の札と並べて確認。
- **組み込み**: `remake/css/trpg-theme.css` の「本棚の文字を減らし、印と顔で見せる」（TRP10）と「本をめくって物語を選ぶ」（TRP11）。
- 原画の SHA-256（先頭16桁）: `book_locked` f2dd53fffecad4d0, `dice_icon` c4ae0219c3887db9, `book_open` 581c2719a0642b5d

