# サンドボード結果画面の部品（#3713 A）

Issue https://github.com/haseatsu114514-dot/shisha-game/issues/3713 の A（結果画面の部品 9 枚）。

オーナー採用（2026-11-17「サンドボードのは実装まで」）。ゲームへ組み込み済み（WebP は 2 倍寸法、`remake/img/ui/desert_ride_result/`。PNG 原寸の実装コピーは `assets/ui/desert_ride_result/`。採否とハッシュは `adoption.json`）。文字・数字・ラベルは焼き込まず、コードが描く。マージはオーナー確認後。

## 配置

- `raw/` — 指定寸法の PNG（本物の α。文字・数字・ロゴなし）
  - `medal_s.png` / `medal_a.png` / `medal_b.png` / `medal_c.png` — 1024×1024
  - `ribbon_win.png` / `ribbon_lose.png` — 1040×200
  - `board.png` — 1400×600（9-slice 想定。飾りは端から 48px 以内）
  - `button_primary.png` / `button_secondary.png` — 520×200（3-slice 想定）
- `originals/` — 生成器が返した JPEG（透過なし。クロマキー前の原画）
- `review/sheet_A.jpg` — チェッカー上の 9 点と、1280×720 の結果画面の仮組み
- `prompts.md` — 実際に送ったプロンプト全文
- `references.md` — 参照画像のパスと SHA-256
- `inspection.md` — 検品メモ

生成器は本物の α を出せず、出力は JPEG でした。単色のクロマ背景（指定は #FF00FF。実際の画素は純色からややズレる）で生成し、キー処理と縁の整理をしています。詳細は検品メモへ。


## 実装

- WebP（透過・quality 90 / method 6）: `remake/img/ui/desert_ride_result/*.webp`
  - メダルは 1024→512（表示の円盤 約 193px に対して 2.5 倍）。リボン・板・ボタンは原画寸法のまま（表示の約 2 倍）。
- 接続: `remake/css/desert-ride.css`（`.dr-rank` の背景、`.dr-race-result` のリボン、`.dr-rows` の 9-slice、`.dr-button` の背景）。`remake/css/bundle-1.css` は `build_css_bundles.py` で再生成。
- メダルの文字は円盤の中心（原画 1024 での円の中心 513, 422）に置く。リボンは勝敗の文言の後ろ。板は `border-image-slice: 44 80`。
- 出典・プロンプト・参照 SHA-256・検品は本ディレクトリの `prompts.md` / `references.md` / `inspection.md`。生成器は本物の α を出せず、クロマキーしている（検品メモ）。
