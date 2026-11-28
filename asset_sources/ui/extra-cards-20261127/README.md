# タイトルの EXTRA（あそびば）のカード絵（EXT03）

2026-11-27 オーナー「エクストラのミニゲームを選ぶ画面はビジュアルも凝りたい　生成してもいいかも」。
タイトルの EXTRA の選ぶ画面（`remake/js/scenes/extra.js`）に並べる、ミニゲーム5つのカード絵。

| 原画（`originals/`） | ゲームの絵 | 場面 | 場所の参照（採用済みの背景） |
|---|---|---|---|
| `card-axe-01.png` | `remake/img/ui/extra/card-axe.webp` | 的の真ん中に刺さった斧と飛ぶ木くず（斧投げのレーン・夜） | `assets/backgrounds/bg_axe_lane.png` |
| `card-trpg-01.png` | `remake/img/ui/extra/card-trpg.webp` | 地図の上で転がる d20 と d6、駒・キャラシート・ランタン（ボドゲカフェ） | `assets/backgrounds/bg_yuzugaya_trpg.webp` |
| `card-dj-01.png` | `remake/img/ui/extra/card-dj.webp` | ブースの後ろから見た DJ コントローラーと、紫と青の照明のフロア（SEAM） | `assets/backgrounds/bg_club_seam.png` |
| `card-camel-01.png` | `remake/img/ui/extra/card-camel.webp` | ロボット騎手を乗せて走る3頭のラクダとゴールの旗（朝のレース場） | `assets/backgrounds/bg_dubai_camel_track_morning.png` |
| `card-desert-01.png` | `remake/img/ui/extra/card-desert.webp` | 夕日の砂丘を切って走るサンドボードと砂しぶき | `assets/backgrounds/bg_dubai_dunes_dusk.png` |

- 作り方: `python3 generate_cards.py <id> [連番]`（OpenAI 画像API の images/edits。1024×1536・quality high）。依頼文はスクリプトの中（場面ごとの文＋カードの構図の文＋[背景の規格](../../../docs/background_standard.md) 2節の英文）
- 参照画像: 場所の参照に上の背景、画風の参照に背景の規格の基準画像 `kemurikusa.png`
- 人物は描かない（本人性の崩れを避け、遊びの見せ場の道具と場所で見せる）。文字・ロゴも描かない（名前は画面の文字で出す）。カードの上15%・下25%は題字を重ねるので暗めに
- ゲームの絵は原画を 640×960 に縮めた webp（quality 82）。新しい画像なので Git LFS
- 検品: ロゴ・読める文字なし（ダイスの目と本の飾りの字だけ）。シーシャ台は写っていない。5枚を並べて画風と明るさがそろっていることを確認
- 原画の SHA-256（先頭16桁）: `card-axe-01` ce4390059dc93ab0, `card-trpg-01` a3be1b69beda1768, `card-dj-01` 0ba0735727f0b203, `card-camel-01` eecdae3f85f6799d, `card-desert-01` d6d20bb0c86647e9
