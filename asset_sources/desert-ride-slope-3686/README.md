# サンドボード、坂を見下ろす遠景（#3713 B）

Issue https://github.com/haseatsu114514-dot/shisha-game/issues/3713 の B（坂を見下ろす遠景 2 枚）。

Grok の画像生成で作成した未採用の候補です。ゲームへの組み込み（空と陸の分割・`backdrop.horizon` / `SLOPE` の合わせ）は、オーナー採用後に別作業とします。この PR ではマージしません。

## 配置

- `raw/backdrop_slope_day.png` / `raw/backdrop_slope_dusk.png` — 3600×1440、不透明。縁の線は上から約 808px（検品値は day 809 / dusk 811）
- `originals/` — 生成器が出した 16:9 JPEG と、昼の清掃済み 16:9
- `review/sheet_B.jpg` — 昼・夕・重ね・左右反転の継ぎ目
- `prompts.md` — 実際に送ったプロンプト全文
- `references.md` — 参照画像のパスと SHA-256
- `inspection.md` — 検品メモ

生成器の 16:9 出力（1280×720）を、縁が 56% の位置に来るよう切り、3600×1440 へ拡大しています。手前の斜面（縁より下）は、強い筋や白い線を避けるため生成後にならしています。
