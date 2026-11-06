# Issue #2746 ヌールのサンドボードライダー

Codex 内蔵 image_gen で生成した透過 PNG 原画。ゲーム用 WebP は `remake/img/ui/desert_ride/rider_noor_*.webp`。

## 参照と画風

- 画風参照／現行 rider_* 参照: 各ポーズの `remake/img/ui/desert_ride/rider_*.webp`。
- ヌール立ち絵参照: `remake/img/sprites/characters/noor/chr_noor_normal.webp`。
- 同一人物参照: 最初に生成した `rider_noor_ride.png`。
- 画風固定の指示: 既存 rider の日本アニメ調、輪郭線、セル調の陰影、背面視点、板の遠近を合わせる。

## 生成指示の共通部分

成人した日焼け肌のヌール・アル＝サーリム。黒髪を後ろで緩く束ね、頭にサングラス、首に薄いベージュのスカーフ。袖をまくったカーキのアウトドアシャツ、ベージュのカーゴパンツ、暗色のブーツ。青緑のサンドボードに乗る全身を背面から描く。背景は実際に透過させ、地面・砂・植物・シーシャ機材・文字・他人は描かない。各ポーズを別々に生成。

| 原画 | ポーズ指示 | WebP寸法 |
| --- | --- | --- |
| rider_noor_ride.png | 安定した通常滑走 | 489×768 |
| rider_noor_jump.png | 空中で膝を曲げる | 537×670 |
| rider_noor_lean_left.png | 画面左へ強く傾けて旋回 | 536×724 |
| rider_noor_lean_right.png | 画面右へ強く傾けて旋回 | 542×771 |
| rider_noor_brace.png | 着地に備えて深くしゃがむ | 561×644 |
| rider_noor_fall.png | 板が離れた転倒 | 554×655 |

WebP は原画を既存 rider と同じキャンバス寸法へ縮小し、透過を保持して保存した。
