# 第1章の店舗ロゴ候補

## 採用済みの7案

[採用ロゴの一覧](adopted.html) / [実際のマップ](ingame-qa/map-1331.png) / [スマートフォンのマップ](ingame-qa/map-844.png) / [tonariへの入店](ingame-qa/arrival-tonari.png)

ユーザーの添付画像を採用。tonariは後の添付で **初期案Bのモザイクランプ** に確定しました。

| 店舗 | 採用案 |
|---|---|
| tonari | 初期案 B・モザイクランプ |
| KEMURIKUSA | 修正版 A・細い英字 |
| EDEN | 初期案 A・赤と緑の林檎 |
| PEPPERMINT | 修正版 B・ひらがな |
| Dr.fookah | 修正版 C・四角い枠 |
| C.STATION | 修正版 C・二段文字 |
| チョイザップ | 初期案 B・緑のC |

ユーザー指定の「マップの看板」「入店時の表示」に接続。明るい看板に原画の採用部分を表示し、面識のある店主の顔は小さく添えます。入店の幕を覆ったところで約0.65秒ロゴを表示し、店内の背景・会話・メニューへ進みます。街歩きの入口も同じ入店表示を使用。SKIPでは短く、減らした動きでは静止表示。カフェなどロゴのない施設と未解放の場所の表示は従来どおりです。

素材は `assets/ui/store_logos/`。`store-logos.js` の座標窓で元PNGの採用部分だけを表示し、原画の文字・配色・透明度を保持しています。元画像と採用素材はバイト一致。採用元・座標・ハッシュは [adopted.json](adopted.json) に記録。

専用ブラウザテスト18ケース（PC・スマートフォン縦横、店主とイベントのバッジ重なり、7店の実クリックによる入店、実際の店舗メニュー、入店前に待つ来店、未解放、SKIP、減らした動き、画像取得失敗）を確認。既存の移動・画面引継ぎ7ケース、マップ・通知・閉店・施設の回帰、街歩き33ケース、日常接客と風邪・終日休養のVMテストも確認。画像の原寸・透過・採用部分を目視確認。

## 候補の保存履歴

[比較ページ](index.html) / [主要4店舗の一覧](previews/stores-01-04.png) / [その他3店舗の一覧](previews/stores-05-07.png)

7店について各3案、計21案。各画像は **左=A、中央=B、右=C**。店舗ごとに3案をまとめた透過PNGです。

| 店舗 | A | B | C | 原寸PNG |
|---|---|---|---|---|
| tonari | やわらかな小文字 | となりの手書き文字 | tの小さなシンボル | [画像](sheets/tonari.png) |
| KEMURIKUSA | 細長い英字ロゴ | 手書きのケムリクサ | Kを組んだマーク | [画像](sheets/kemurikusa.png) |
| EDEN | 静かなセリフ体 | Eの幾何学マーク | 太字と二つの点 | [画像](sheets/eden.png) |
| PEPPERMINT／ぺぱーみんと | 小悪魔の英字ロゴ | ひらがなショップ文字 | 丸みのある小文字 | [画像](sheets/peppermint.png) |
| Dr.fookah | 専門店の文字組み | 細いdfモノグラム | 四角い卸店サイン | [画像](sheets/dr-fookah.png) |
| C.STATION | 大型チェーンの英字 | Cの入口マーク | 二段のサイン文字 | [画像](sheets/c-station.png) |
| チョイザップ | 日常ジムの太字 | 一歩進む小さな記号 | チョイの文字遊び | [画像](sheets/choizap.png) |

## 制作条件

店名を主役に、文字組み・余白・シンボルの大きさを整えた単色の店舗ロゴとして制作。現行の店舗設定・背景の実物に加え、実在シーシャ店の公式ロゴを目視し、画像生成に参照として添付しています。

- [musch](https://www.musch.jp/): 小さな抽象シンボルと読みやすい小文字の組み方。
- [NORTH VILLAGE](https://shisha.tokyo/): 単色の独特な英字ワードマーク。
- [C.STAND](https://c-stand-shisha.com/): 店名・シンボル・業態説明の階層。
- [PukuPuku](https://shisha-pukupuku.com/): 小さなシンボルと横組みの筆記体。
- [チルイン](https://shisha-chillin.com/): 和文によるコンパクトな横組み。

参照画像のURLとハッシュは [real-shop-references.json](real-shop-references.json)、ゲーム側の参照元は [references.json](references.json)、生成文は [prompts.json](prompts.json) に記録。実在店のロゴ原本は配布用素材に含めていません。

## 喫茶こはく

ユーザー指定により、名前未設定のカフェを **「喫茶こはく」** と命名。午後の光とスパイスラテの温かさをイメージしています。

マップの `cafe` 表示名と初来店の店名紹介に反映。今回のロゴ制作対象は上表の7店です。カフェのロゴは制作対象から除外しています。

## ファイルと確認

- `sheets/`: 7店舗の原寸透過PNG。画像生成の出力をそのまま保存。
- `manifest.json`: 画像寸法、SHA256、A/B/C、透過・画像端の確認記録。
- `previews/`: 原寸PNGを白背景の比較ページに配置し、ブラウザで撮影した一覧。
- `preview-qa.json`: デスクトップ・スマートフォン幅、全画像の読込、背景切替の確認結果。
- `archive/v1-decorative/`: 初期の装飾的な候補を履歴として保持。現在の採用は冒頭の7案。

RGBA・透過ピクセル・PNGデコード・元画像とのSHA256一致を確認。高不透明度のロゴ画素が画像端に触れていないことを確認。ブラウザで白背景の21案を目視し、表示名・案数・相互の違いを確認しています。

候補制作時の店名変更に対し `python3 tools/lint_dialogue.py ch1_spots` は ERROR 0 / 既存 WARN 19。`spots.js` のJavaScript構文と `git diff --check` を確認。当時は店名の2か所のみの変更のため、ゲーム通しプレイテストは実施していません。採用・組み込み後の確認は冒頭に記載。

## 保存先

Issue [#470](https://github.com/haseatsu114514-dot/shisha-game/issues/470)、[PR #473](https://github.com/haseatsu114514-dot/shisha-game/pull/473)、ブランチ `codex/ch1-store-logos-470`。上表の7案を本編に接続。候補と原画も履歴として保存。

WORKER: codex-store-logos-20261012-89eaa1ae  
CLAIM: 38293344108 / ADOPTION STATUS: 38298014351

