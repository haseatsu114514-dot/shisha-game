# 水入れの水量計の銅枠（シーシャ作りパート添削・2026-11-18）

オーナー「シーシャ作りパートの添削…必要であればパーツも生成させつつ」（2026-11-18）。水入れの水量計は 2px の水色の線だけで、隣の温度計の銅の筒や作業台のガラスと革の部品（`../craft-glass-20261111/`）と質感がそろっていなかったので、銅の枠を1枚生成した。

| ファイル | サイズ | bytes | SHA-256 | 内容 |
|---|---:|---:|---|---|
| [`raw/water-gauge-frame-raw.jpg`](raw/water-gauge-frame-raw.jpg) | 720×1280 | 118144 | `04070e29e9890b9c55c5a7e3c0aa15e476a0069da6feaa476162798e495e9f3c` | 生成原画（未加工）。参照に `remake/img/ui/craft-glass/frame.webp` を添付 |

## 組み込み

- `remake/img/ui/craft-glass/water-gauge-frame.webp`（288×512）: 原画の内側の緑と外側の黒を透過にして縮小。
- `remake/css/craft-water.css` の `.craft-water-meter` に `border-image`（切り出し 20px・表示 9px）で貼る。読み込めないときは銅色の 9px 枠になる。
