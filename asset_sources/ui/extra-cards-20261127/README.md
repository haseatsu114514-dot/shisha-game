# タイトルの EXTRA（あそびば）の絵（EXT03・EXT05）

## 実際の画面の写真（ゲームで使っている・EXT05）

2026-11-28 オーナー「実際のミニゲームのスクショ使いたい　枠でイメージ画像何個か見せて　ミニゲームタイトルと　横スライド式でミニゲーム選択」。
EXTRA の選ぶ画面（`remake/js/scenes/extra.js`）は、ミニゲームを1つずつ横にスライドして選び、各スライドの枠の中で実際の画面の写真3枚を切り替えて見せる。

| 遊び | 写真 | 出どころ |
|---|---|---|
| 斧投げ | 狙う・投げる・刺さる | 遊び方の写真 `remake/img/ui/axe_throw/howto/how_aim`・`how_throw`・`how_score`（実際の画面から撮ったもの） |
| ボドゲカフェ | 本棚・ダイスを振る瞬間・成功の演出 | `remake/img/ui/extra/shots/trpg-1〜3.webp`（`shots/capture.mjs` で撮影） |
| DJ | 1曲目がかかった所・カウントダウン・つなぎ | `remake/img/ui/extra/shots/dj-1〜3.webp`（同上） |
| ラクダレース | 自動操作のデモの走り（3場面） | `remake/img/ui/extra/shots/camel-1〜3.webp`（同上） |
| 砂丘のサンドボード | ブースト・大ジャンプ・スピン | 遊び方の写真 `remake/img/ui/desert_ride_howto/how_boost`・`how_jump`・`how_spin` |

- 撮り方: `node asset_sources/ui/extra-cards-20261127/shots/capture.mjs <出力先> [dj,camel,trpg]`（1280×720・2倍。採用した写真はスクリプトの冒頭に記録）。ゲームの絵は 1280×720 の WebP（quality 80・LFS）
- 題字のロゴがある遊び（ラクダ・砂丘）はロゴ（`remake/img/ui/camel_race/ui/logo.webp`・`desert_ride/logo.webp`）、ほかは英字の見出しを題にする

## 生成したカード絵（ゲームでは使っていない・EXT03 の記録）

2026-11-27 オーナー「エクストラのミニゲームを選ぶ画面はビジュアルも凝りたい　生成してもいいかも」で作ったカード絵。翌日のオーナーの指示（上）で、選ぶ画面は実際の画面の写真に替えたので、ゲームからは外した（原画とプロンプトは記録として残す）。

| 原画（`originals/`） | 場面 | 場所の参照（採用済みの背景） |
|---|---|---|
| `card-axe-01.png` | 的の真ん中に刺さった斧と飛ぶ木くず（斧投げのレーン・夜） | `assets/backgrounds/bg_axe_lane.png` |
| `card-trpg-01.png` | 地図の上で転がる d20 と d6、駒・キャラシート・ランタン（ボドゲカフェ） | `assets/backgrounds/bg_yuzugaya_trpg.webp` |
| `card-dj-01.png` | ブースの後ろから見た DJ コントローラーと、紫と青の照明のフロア（SEAM） | `assets/backgrounds/bg_club_seam.png` |
| `card-camel-01.png` | ロボット騎手を乗せて走る3頭のラクダとゴールの旗（朝のレース場） | `assets/backgrounds/bg_dubai_camel_track_morning.png` |
| `card-desert-01.png` | 夕日の砂丘を切って走るサンドボードと砂しぶき | `assets/backgrounds/bg_dubai_dunes_dusk.png` |

- 作り方: `python3 generate_cards.py <id> [連番]`（OpenAI 画像API の images/edits。1024×1536・quality high）。依頼文はスクリプトの中（場面ごとの文＋カードの構図の文＋[背景の規格](../../../docs/background_standard.md) 2節の英文）。画風の参照は背景の規格の基準画像 `kemurikusa.png`
- 人物・文字・ロゴは描かない。検品: ロゴ・読める文字なし（ダイスの目と本の飾りの字だけ）。シーシャ台は写っていない
- 原画の SHA-256（先頭16桁）: `card-axe-01` ce4390059dc93ab0, `card-trpg-01` a3be1b69beda1768, `card-dj-01` 0ba0735727f0b203, `card-camel-01` eecdae3f85f6799d, `card-desert-01` d6d20bb0c86647e9
