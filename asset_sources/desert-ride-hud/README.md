# サンドボード HUD・ブースト演出の生成画像

2026-11-10 オーナー依頼（「UIは画像生成とかも使っていいのでクオリティを上げて」「ブーストはなんか大袈裟にオーラとか出したい」）に対し、メーター枠・カーブ案内・リカバリー表記・ブーストHUDと、ライダー周りのオーラ／爆発／火花を生成して入れた。

ゲームで使うファイルは `remake/img/ui/desert_ride_hud/` の WebP（透過）。文言は画像に焼き込まず、速度・コース名・案内・「立て直せる！」などはコード側で描く。

## ファイル

- `panel.webp` — 左右 HUD の羊皮紙風の枠
- `speedo-dial.webp` — 速度メーターの文字盤
- `gauge-frame.webp` — ブーストゲージの枠
- `curve-sign.webp` — カーブ案内の看板
- `course-plate.webp` — コース名のプレート
- `recover-badge.webp` — リカバリー表示の徽章
- `bolt.webp` — ゲージ横の稲妻アイコン
- `boost-aura.webp` / `boost-burst.webp` / `boost-spark.webp` — ブースト中のオーラ・爆発・火花

生成原画は白／黒／チェッカー背景つきだったため、透過を切り出してから入れている。
