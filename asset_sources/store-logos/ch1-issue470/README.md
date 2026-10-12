# 第1章の店舗ロゴ候補

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
- `archive/v1-decorative/`: 初期の装飾的な候補を履歴として保持。現在の選定対象はルートの21案。

RGBA・透過ピクセル・PNGデコード・元画像とのSHA256一致を確認。高不透明度のロゴ画素が画像端に触れていないことを確認。ブラウザで白背景の21案を目視し、表示名・案数・相互の違いを確認しています。

店名変更に対し `python3 tools/lint_dialogue.py ch1_spots` は ERROR 0 / 既存 WARN 19。`spots.js` のJavaScript構文と `git diff --check` を確認。店名の2か所のみの変更のため、ゲーム通しプレイテストは実施していません。

## 保存先

Issue [#470](https://github.com/haseatsu114514-dot/shisha-game/issues/470)、ブランチ `codex/ch1-store-logos-470`。ロゴは選定用の候補として保存。

WORKER: codex-store-logos-20261012-89eaa1ae  
CLAIM: 38293344108 / STATUS: 38293454277

