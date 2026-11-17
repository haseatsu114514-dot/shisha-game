# サンドボード、坂を見下ろす遠景（#3713 B）

Issue https://github.com/haseatsu114514-dot/shisha-game/issues/3713 の B（坂を見下ろす遠景 2 枚）。

オーナー採用（2026-11-17「サンドボードのは実装まで」）。ゲームへ組み込み済み。3600×1440 の原画を 1800×720 に縮小し、空と陸に分けて既存の遠景ファイルを差し替えた（`remake/img/ui/desert_ride/backdrop_{day,dusk}_{sky,land}.webp` と `assets/ui/desert_ride/` の PNG）。寸法と基準点は `asset_sources/desert-ride-2306/adoption.json` を更新。`SLOPE.edgePx` は 0（絵の lip を HORIZON に合わせ、54px 下げをやめた）。マージはオーナー確認後。

## 配置

- `raw/backdrop_slope_day.png` / `raw/backdrop_slope_dusk.png` — 3600×1440、不透明。縁の線は上から約 808px（検品値は day 809 / dusk 811）
- `originals/` — 生成器が出した 16:9 JPEG と、昼の清掃済み 16:9
- `review/sheet_B.jpg` — 昼・夕・重ね・左右反転の継ぎ目
- `prompts.md` — 実際に送ったプロンプト全文
- `references.md` — 参照画像のパスと SHA-256
- `inspection.md` — 検品メモ

生成器の 16:9 出力（1280×720）を、縁が 56% の位置に来るよう切り、3600×1440 へ拡大しています。手前の斜面（縁より下）は、強い筋や白い線を避けるため生成後にならしています。


## 実装

- 原画 `raw/backdrop_slope_day.png` / `backdrop_slope_dusk.png`（3600×1440、lip は day 809 / dusk 811）。
- ゲーム用: 1800×720 に縮小し、空（高さ 416）と陸（`landTop` 220 から下、高さ 500）に分割。`horizon` 405、`duneTop` 232。
- 接続: `DESERT_ART`（`desert-ride-art.js`）。描画は従来どおり縁より上を等倍、縁より下を画面下端まで伸ばす。`drawSlopeEdge` の下げは `edgePx=0` のため走らない。
- 出典・プロンプト・検品は本ディレクトリ。手前の砂は谷の塗装を平らに整えてある（引き延ばし用）。アップスケールはやや柔らかい。
