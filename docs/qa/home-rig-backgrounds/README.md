# 家背景の所持シーシャ台（#640）

PR再開時に指摘されたタッチ版寝る前モーダルの重複は、[変更前・元提出・修正後の同条件再確認](bedtime-recheck/README.md)を参照。導入前にも再現し、家シーシャのタッチモーダルに限って背景ぼかしを外した。元の画面記録は提出時点の証拠として保持する。

基準main: `13bf4a125d781c1d1bc4e6e94687e72f8d9477f4`。承認済みv3の2原画を無変更で使い、既存のSVG背景合成へ所持品の判定を追加した。家背景自体の画素・会話・使用する台の優先順位・装備・消費・成長・セーブschemaは変更していない。

`state.owned` の2品を独立に読む。台を一つ選ぶ `homeRig()` は表示に使わない。表示情報をセーブへ追加せず、LOAD／NEW GAMEや入手時の既存UI通知後に接続中の家背景を再評価する。同じURLを再指定した場合の背景キャッシュにも、現在の台の画像一覧を含める。家の練習窓は作業中の台を維持して背景だけを共通合成へ接続した。

## 比較

PCはChromium 1280×720、タッチは844×390／isMobile／hasTouch。beforeは基準mainの `scene-art.js` と `ui.js` をブラウザで差し替え、同じ所持状態・画角・時間帯で撮影した。変更前後を並べるための撮影時だけの差し替えで、ゲームコードへ条件分岐は追加していない。JPEGはquality 82。ゲームの配信画像は通常のmanifestビルドによるWebP。

| 表示 | 変更前（両方所持） | 変更後（両方所持） |
|---|---|---|
| PC・昼 | [before](before-pc-day-both.jpg) | [after](after-pc-day-both.jpg) |
| PC・夜 | [before](before-pc-night-both.jpg) | [after](after-pc-night-both.jpg) |
| タッチ・昼 | [before](before-touch-day-both.jpg) | [after](after-touch-day-both.jpg) |
| タッチ・夜 | [before](before-touch-night-both.jpg) | [after](after-touch-night-both.jpg) |

| 状態 | PC昼 | PC夜 | タッチ昼 | タッチ夜 |
|---|---|---|---|---|
| 未所持 | [画像](after-pc-day-none.jpg) | [画像](after-pc-night-none.jpg) | [画像](after-touch-day-none.jpg) | [画像](after-touch-night-none.jpg) |
| 卓上のみ | [画像](after-pc-day-tabletop.jpg) | [画像](after-pc-night-tabletop.jpg) | [画像](after-touch-day-tabletop.jpg) | [画像](after-touch-night-tabletop.jpg) |
| 公式のみ | [画像](after-pc-day-pro.jpg) | [画像](after-pc-night-pro.jpg) | [画像](after-touch-day-pro.jpg) | [画像](after-touch-night-pro.jpg) |
| 両方 | [画像](after-pc-day-both.jpg) | [画像](after-pc-night-both.jpg) | [画像](after-touch-day-both.jpg) | [画像](after-touch-night-both.jpg) |

会話・操作UIを含む画面: [PC帰宅](pc-remake_homecoming_0.jpg)／[タッチ帰宅](touch-remake_homecoming_0.jpg)、[PC一服](pc-bedtime.jpg)／[タッチ一服](touch-bedtime.jpg)、家プレビュー [PC昼](pc-preview-day.jpg)／[PC夜](pc-preview-night.jpg)／[タッチ昼](touch-preview-day.jpg)／[タッチ夜](touch-preview-night.jpg)。台は背景レイヤー内で描き、操作を受け取らない。

## 再現と検証範囲

既存のPlaywright依存・system Chromiumとローカルpreviewサーバを再利用。フルclone、素材取得、依存のダウンロードなし。

```sh
python3 remake/tools/serve_preview.py --port 8123
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/home_rig_backgrounds.mjs
HOME_RIG_BASELINE=1 CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/home_rig_backgrounds.mjs
```

本件スイートはPC／タッチそれぞれで以下を検査する。最終実行結果は [results.json](results.json) とPRの完全HEADを参照。

- 4所持状態×昼夜、装備に大会台があっても未所持なら非表示、同じ背景URLの再描画、表示処理によるstate不変。
- 旧無印背景と曇天昼夜も同じ判定。無関係な街背景には追加しない。
- 実際の卓上台受取・S賞の実くじgrantと保存、入手直後の表示。
- 4状態の実手動SAVE/LOAD、元手動枠の不変、ブラウザ再読込と実auto LOAD、NEW GAME。両方所持枠／未所持枠を交互に実LOAD。
- 実台本の休養・帰宅3種、寝る前の実モーダルと一服台本の背景、昼夜の実マップ家プレビュー・ボタンの画面内配置。
- 家の練習窓の背景とNEW GAMEによる解除。既存の使用中の作業台は変更しない。
- 保存済みの夜をCONTINUE→slot0実LOAD→本編 `advanceDay()` で朝→地図へ進め、朝の家背景に2台が載ることをDOM観測する。

独立レビューと最終CIの確認状況はPRへ記録する。実機スマホ／Safari、公開版QA、NEW GAMEからくじ当選・DAY7受取までの自然通しプレイは未実施。くじは実処理を通すが、テスト用に箱の先頭をS賞へ固定している。夜→朝の開始セーブもテストfixtureを使う。
