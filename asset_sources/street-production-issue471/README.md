# 第1章・大須風の商店街（#471）

2026-10-13のオーナー追加指示で、本番用の商店街と「奥へ歩く遠近感のある通り」を制作。「商店街は大須商店街みたいにしたい」を反映。

採用候補の原画は `osu-arcade-day-original.png`、同一構図の夜差分 `osu-arcade-night-original.png`、正式なはじめを参照した `hajime-walk-original.png`。最初の `arcade-day-original.png` は方向確認前の比較画像で、ゲームには使用しない。

生成は内蔵image_gen。画像は新しい専用ファイルへ保存し、既存の試作用原画・背景・歩行絵を上書きしていない。昼夜は1664×936のままWebPへ変換。歩行絵は既存 `tools/proto_walk_sheet.py` の共通縮尺/足元揃え/64色と背中の交互脚補正で変換。オーナーの「奥で見えなくなる/扉より小さい」指摘で144dotをゲーム用に採用し、72dotは比較用に保持。原画からの縮小であり、72dotの拡大ではない。

## 参照と構成

- 本人性: `assets/sprites/characters/hajime/chr_hajime_normal.png`。22歳の青年、黒いキャップ/黒髪、黒いパーカーとシャツ、カーゴパンツ、黒い靴、胸元の小さな銀色アクセサリー。つむぎをはじめとして扱わない。
- 歩行の形式: `asset_sources/images/proto_walk/pose_reference_sheet.png` と既存72dotシート。5方向×2コマ、左3方向は反転。旧試作から8方向・足元基準・2コマ・タップ/ダッシュ操作を引き継ぎ、新しい奥行きの床へ投影。
- 場所の資料: [名古屋市公式観光・大須のロケーション資料](https://www.nagoya-info.jp/location/search/detail/50/)、[仁王門通り写真](https://www.nagoya-info.jp/upload/locations/large/678226255eeacf2d43a07.jpg)、[新天地通写真](https://www.nagoya-info.jp/upload/locations/large/8872352115eeac753532c3.jpg)を閲覧。赤い梁、白い透光屋根、密な店構えと日常の業種の混在を構成に使用。写真そのものをゲーム/リポジトリへコピーしていない。
- 店の区別: カフェは左手の木/ガラスと黄土色テント、PEPPERMINTは右手の古い建物をミント/ピンクに改装、KEMURIKUSAはアーケードの先・商店街の外れの暗い木/丸窓/ランタン。実在店舗ロゴや屋号は描かない。ゲーム内店名・価格・休業/案内/イベント表示は実テキスト。

## ゲームで使うもの

- `remake/img/street/arcade-day.webp` / `arcade-night.webp`
- `assets/street_walk/hajime_walk_144.png` / `.json`（72版は比較用）
- `remake/street/` の本編用Canvas。既存の `streetScene.connect(info, visited, enter, back, paused)` 契約で行き先IDだけを返す。訪問、費用、時間、配達、好感度、LIME、保存、スロットは親の日常処理が所有。

入り口/足元/ラベルは原画の1664×936を1280×720へ換算して測定し、`remake/street/model.js` に定義。各入口で人物高は扉高の約83%。奥へ歩くとカメラも背景/扉/人物を同時に前へ寄せる（最大2.4倍）。最奥でも人物高は約97pxを確保し、クリック位置は同じカメラの逆変換を使う。背景外の空白を出さない。手前へ戻るとピン選択を継続。歩行位置/カメラは保存せず、ロード後は入口から始まる。

長い本番アーケードを作る次の段階は「入口・中間・奥」の背景をつなぎ、拡大率を抑えて画質を維持する。このPRでは現構図の追従カメラと縮尺を操作可能な候補として検証する。

これはPRのレビュー用候補。公開済み#460の仮接続とは区別し、未マージの候補を公開完成品と呼ばない。実機スマホ・Safariは未確認。テスト・操作証跡はPR/Issueへ追記する。
