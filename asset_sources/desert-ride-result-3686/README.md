# サンドボード結果画面の部品（#3713 A）

Issue https://github.com/haseatsu114514-dot/shisha-game/issues/3713 の A（結果画面の部品 9 枚）。

Grok の画像生成で作成した未採用の候補です。ゲームへの組み込み（WebP 化・CSS 接続）は、オーナー採用後に別作業とします。この PR ではマージしません。

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
