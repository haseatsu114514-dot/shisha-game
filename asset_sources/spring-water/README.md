# スプリングウォーターの商品画像

サメちゃんの好きな単体フレーバー。ゲーム内はアフサール。実在のAfzal Natural Spring Waterを味の参考とし、実物ロゴ・包装は複製しない。

- `source.png`: image_gen生成原画（1280×1280 RGBA）。黒い箱、銀の雫、水色の湧き水。
- 配布: `remake/img/shop/character-flavors/spring-water.webp`（512×512、ロスレス、透過）。
- 原画と512px版を目視。文字・実在ロゴ・人物なし、箱全体が画像内に収まる。
- 制作記録: `generation.json`。参照は既存レモン箱の画風と形状のみ。

実装は `data/flavors.json`、`data/dialogue/samechan.json`、`shop-catalogs.js`、`shop-art-character-flavors.js`。

GitHubのCLI認証が無効のため画像のGit LFSアップロードは未完。原画・配布画像の実体はこの作業環境に保存済み。アップロード完了まで公開しない。

認証復旧後、このcheckoutで今回の2オブジェクトだけを送る（約1.8MB）。

```sh
git lfs push --object-id origin ea30758bf15ba5c593c0b24ac020086c166533a4887bfed80f51d3e1f9b4e0d2 293290140264536ee08e5fb3c75ddb047fc62d6236d4e395d0d5ef7d5ae4afc2
```

検証: 熟練度・在庫・SAVE/LOADのVM検査と商品表示検査、台詞lintが成功。PC・横タッチの購入・新画像decode・会話経験値の一度だけ付与・配合操作のassertionは通過。ブラウザ検査全体は依存PR #1023の既存商品画像4枚を取得できないためresource検査で失敗。画像送信後に `CASE_FILTER=spring-water-pc` / `spring-water-touch` で `remake/test/browser/flavor_mastery.mjs` を再確認する。
